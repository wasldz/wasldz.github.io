// ============================================
// 💬 نظام المحادثات
// شات المديرية + شات بين المؤسسات
// ============================================

// 💬 CHAT SYSTEM
// 🔥 إعادة هيكلة نظام تخزين الشات (تحسين الديناميكية #2):
// ------------------------------------------------------------
// سابقاً: كل محادثة (chats/{code}) كانت تُخزَّن كمصفوفة واحدة، وأي رسالة
// جديدة أو تعديل حالة "مقروء" كانا يعيدان كتابة المصفوفة بأكملها فوق
// النسخة السابقة في Firebase. هذا يسبب:
//   1) تعارض/فقدان رسائل (Race condition) عند كتابة طرفين في نفس اللحظة
//      — الكتابة الأخيرة كانت تمحو رسالة الطرف الآخر بالكامل.
//   2) إرسال كامل سجل المحادثة عبر الشبكة مع كل رسالة جديدة، حتى لو كانت
//      المحادثة تحتوي مئات الرسائل — استهلاك متزايد للبيانات مع الوقت.
//
// الآن: كل رسالة تُخزَّن كعنصر مستقل عبر push() تحت chats/{code}/{msgId}،
// بنفس الأسلوب المستخدم أصلاً في شات الاجتماعات المرئية (meet/.../chat).
// هذا يضمن عدم فقدان أي رسالة عند التزامن، ويجعل حجم البيانات المرسلة مع
// كل رسالة صغيراً وثابتاً بغض النظر عن طول المحادثة. تحديث حالة "مقروء"
// يتم أيضاً بشكل مستهدف (تحديث الحقل الخاص بكل رسالة فقط) بدل إعادة بث
// المحادثة كاملة.
const _chatCache = {};

function getChatMessages(code) {
  return _chatCache[code] || [];
}

// إضافة رسالة جديدة واحدة إلى محادثة إنشغال معيّن (push مستقل، بدون overwrite)
function appendChatMessage(code, msg) {
  const ref = database.ref('chats/' + code).push();
  const msgWithKey = { ...msg, _key: ref.key };
  // تحديث فوري للكاش المحلي حتى تظهر الرسالة مباشرة دون انتظار رجوعها من الشبكة
  const list = getChatMessages(code);
  list.push(msgWithKey);
  _chatCache[code] = list;
  ref.set(msg).catch(err => {
    console.error('[chat] فشل إرسال الرسالة:', err);
    showToast('⚠️ تحذير', 'تعذّر إرسال الرسالة، تحقق من الاتصال وحاول مجدداً');
  });
  return msgWithKey;
}

// تحديث حالة "مقروء" لرسائل محددة فقط (بدل إعادة كتابة المحادثة بأكملها)
function markChatMessagesRead(code, role) {
  const msgs = getChatMessages(code);
  const updates = {};
  let changed = false;
  msgs.forEach(m => {
    if (m.sender && m.sender !== role && !m.read && m.sender !== 'system') {
      m.read = true;
      changed = true;
      if (m._key) updates['chats/' + code + '/' + m._key + '/read'] = true;
    }
  });
  if (changed && Object.keys(updates).length > 0) {
    database.ref().update(updates).catch(err => console.warn('[chat] تعذّر تحديث حالة القراءة:', err));
  }
  return changed;
}

function listenToChats() {
  database.ref('chats').on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    Object.keys(data).forEach(code => {
      const rawNode = data[code];
      // دعم الشكل الجديد (كائن مفاتيحه معرّفات push) والشكل القديم (مصفوفة) معاً
      // لضمان توافق أي بيانات قديمة متبقية في القاعدة دون كسر التطبيق.
      let newMsgs;
      if (Array.isArray(rawNode)) {
        newMsgs = rawNode.filter(Boolean);
      } else {
        newMsgs = Object.keys(rawNode).map(key => ({ ...rawNode[key], _key: key }));
        newMsgs.sort((a, b) => (a.time || 0) - (b.time || 0));
      }
      const existing = getChatMessages(code);
      if (newMsgs.length === existing.length && JSON.stringify(newMsgs) === JSON.stringify(existing)) return;
      const isNewIncoming = newMsgs.length > existing.length;
      _chatCache[code] = newMsgs;
      if (currentChatCode === code) {
        renderChatMessages(currentRole);
      } else if (isNewIncoming) {
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg.sender && lastMsg.sender !== currentRole && lastMsg.sender !== 'system') {
          const msgKey = code + '_' + lastMsg.time;
          if (!notifiedMessages.has(msgKey)) {
            notifiedMessages.add(msgKey);
            showToastWithAction(lastMsg.text || '(مرفق)', `📩 رسالة جديدة من ${lastMsg.sender} - ${code}`, () => { openChat(code, currentRole); });
            notifyBrowser(`📩 رسالة جديدة - ${code}`, lastMsg.text || '(مرفق)', () => { openChat(code, currentRole); });
          }
        }
      }
      if (isNewIncoming) {
        if (currentRole === 'directorate' || currentRole === 'department') renderList();
        else renderChatHub();
        if (currentRole === 'department') renderDeptIssuesTable();
      }
    });
  });
}

function openChat(code, role) {
  const allIssues = [...activeIssues, ...archivedIssues, ...centerIssues, ...centerArchived];
  const issue = allIssues.find(i => i.code === code);
  if (!issue) { showToast("⚠️ خطأ", "لم يتم العثور على الإنشغال"); return; }
  currentChatCode = code;
  document.getElementById('chatTitle').textContent = '💬 غرفة الشات الفوري';
  document.getElementById('chatSubtitle').textContent = `${issue.center || 'مركز'} — ${code}`;
  renderPinnedOriginalIssue(issue);
  markChatMessagesRead(code, role);
  notifiedMessages.delete(code);
  const sendBtn = document.getElementById('chatSendBtn');
  if (role === 'directorate' || role === 'department') {
    sendBtn.className = 'chat-icon-btn send';
  } else {
    sendBtn.className = 'chat-icon-btn send-accent';
  }
  const voiceBtn = document.getElementById('chatVoiceBtn');
  if (voiceBtn) voiceBtn.style.display = role === 'directorate' ? 'flex' : 'none';
  renderChatMessages(role);
  document.getElementById('chatModal').classList.add('open');
  removeAttachment();
}

function renderPinnedOriginalIssue(issue) {
  const panel = document.getElementById('chatOriginalIssue');
  if (!panel) return;
  const isFromDirectorate = issue && (issue.source === 'directorate' || issue.isBroadcast || String(issue.author || '').includes('المديرية'));
  if (!isFromDirectorate) {
    panel.classList.remove('show');
    panel.innerHTML = '';
    return;
  }
  const title = issue.title || 'إنشغال وارد من المديرية';
  const text = issue.content || issue.details || 'لا يوجد مضمون مرفق';
  panel.innerHTML = `<div class="coi-head">
      <div class="coi-title"><i class="fa-solid fa-building-columns"></i> ${escapeHtml(title)}</div>
      <span class="coi-priority"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(issue.priority || 'عادي')}</span>
    </div>
    <div class="coi-text">${linkifyText(text)}</div>`;
  panel.classList.add('show');
}

function closeChat() { if (_voiceRecorder && _voiceRecorder.state === 'recording') _voiceRecorder.stop(); document.getElementById('chatModal').classList.remove('open'); currentChatCode = null; }

function renderChatMessages(role) {
  const container = document.getElementById('chatMessages');
  const msgs = getChatMessages(currentChatCode);
  const htmlContent = msgs.map(m => {
    let attachHtml = '';
    if (m.attachment) {
      if (m.attachment.type && m.attachment.type.startsWith('image/')) {
        attachHtml = `<img class="chat-attach-img" src="${m.attachment.data}" onclick="openLightbox('${m.attachment.data}')">`;
      } else if (m.attachment.type && m.attachment.type.startsWith('audio/')) {
        attachHtml = `<audio class="chat-voice-player" controls preload="metadata" src="${m.attachment.data}">متصفحك لا يدعم تشغيل الصوت</audio>`;
      } else {
        attachHtml = `<a class="chat-attach-file" href="${m.attachment.data}" download="${escapeHtml(m.attachment.name)}"><i class="fa-solid fa-file"></i> ${escapeHtml(m.attachment.name)}</a>`;
      }
    }
    const timeStr = new Date(m.time).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
    let bubbleClass = '', senderLabel = '';
    if (m.sender === 'system') {
      bubbleClass = 'directorate-msg';
      senderLabel = '⚙️ النظام';
    } else if (m.sender === 'directorate' || m.sender === 'department') {
      bubbleClass = 'directorate-msg';
      senderLabel = m.sender === 'department' ? 'المصلحة' : 'المديرية';
    } else {
      bubbleClass = 'center-msg';
      senderLabel = 'المركز';
    }
    const isOwn = (m.sender === currentRole) || (m.sender === 'department' && currentRole === 'department');
    const readMark = isOwn ? `<span class="chat-read-mark" style="margin-right:4px; font-size:12px; color:${m.read ? 'var(--gold)' : 'var(--text-dim)'};">${m.read ? '✓✓' : '✓'}</span>` : '';
    return `<div class="chat-bubble ${bubbleClass}"><span class="chat-sender-label">${senderLabel}</span>${m.text ? escapeHtml(m.text) : ''}${attachHtml}<span class="chat-time">${readMark}${timeStr}</span></div>`;
  }).join('');
  container.innerHTML = htmlContent || '<div style="color:var(--text-dim); text-align:center; padding:40px; font-size:18px;">لا توجد رسائل بعد</div>';
  container.scrollTop = container.scrollHeight;
}

function handleChatFileAttach(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { alert("⚠️ حجم الملف يتجاوز الحد الأقصى المسموح به (4 ميغابايت)."); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(ev) {
    pendingAttachment = { name: file.name, type: file.type, data: ev.target.result };
    document.getElementById('chatAttachName').textContent = file.name;
    document.getElementById('chatAttachPreview').style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function removeAttachment() {
  pendingAttachment = null;
  document.getElementById('chatAttachPreview').style.display = 'none';
  document.getElementById('chatFileInput').value = '';
}

function sendChatMessage() {
  if (!currentChatCode) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text && !pendingAttachment) return;
  const senderName = currentRole === 'directorate' ? 'directorate' : 
                     currentRole === 'department' ? 'department' : 'center';
  appendChatMessage(currentChatCode, { sender: senderName, text, attachment: pendingAttachment, time: Date.now(), read: false });
  input.value = '';
  removeAttachment();
  renderChatMessages(currentRole);
}



// 💬 INTER-INSTITUTION CHAT
function populateInterChatRecipients() {
  const select = document.getElementById('interChatRecipient');
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="all">الجميع</option>';
  INSTITUTIONS_DATA.forEach(inst => { select.innerHTML += `<option value="${inst.name}">${inst.name}</option>`; });
  select.innerHTML += `<option value="directorate">المديرية</option>`;
  departments.forEach(dept => { select.innerHTML += `<option value="${dept.name}">${dept.name}</option>`; });
  if (currentValue && (currentValue === 'all' || currentValue === 'directorate' || 
      INSTITUTIONS_DATA.some(i => i.name === currentValue) || departments.some(d => d.name === currentValue))) {
    select.value = currentValue;
  }
  select.onchange = function() {
    const badge = document.getElementById('recipientBadge');
    if (this.value === 'all') { badge.textContent = 'الجميع'; badge.style.background = 'var(--algeria-green)'; }
    else if (this.value === 'directorate') { badge.textContent = 'المديرية'; badge.style.background = 'var(--algeria-red)'; }
    else { badge.textContent = this.value.length > 20 ? this.value.substring(0, 20) + '...' : this.value; badge.style.background = 'var(--algeria-green)'; }
  };
  // تحديث الـ badge فوراً
  if (select.value) {
    const badge = document.getElementById('recipientBadge');
    if (select.value === 'all') { badge.textContent = 'الجميع'; badge.style.background = 'var(--algeria-green)'; }
    else if (select.value === 'directorate') { badge.textContent = 'المديرية'; badge.style.background = 'var(--algeria-red)'; }
    else { badge.textContent = select.value.length > 20 ? select.value.substring(0, 20) + '...' : select.value; badge.style.background = 'var(--algeria-green)'; }
  }
}

function openInterChat() {
  populateInterChatRecipients();
  renderInterChatMessages();
  document.getElementById('interChatModal').classList.add('open');
}

function closeInterChat() { document.getElementById('interChatModal').classList.remove('open'); }

// 🔥 تحسين الديناميكية #2: نُخزّن رسائل محادثة المؤسسات كعناصر push() مستقلة
// تحت عقدة 'interChatRoom' بدل مصفوفة واحدة كانت تُعاد كتابتها بالكامل مع كل
// رسالة (data/interChat سابقاً)، لنفس أسباب نظام الشات الفردي أعلاه: تفادي
// فقدان رسائل عند التزامن المتزامن، وتقليل حجم البيانات المرسلة مع كل رسالة.
// (يبقى المتغيّر العام interChatMessages للتوافق مع أي كود عرض قديم فقط).
function getInterChatMessages() {
  return interChatMessages;
}

function appendInterChatMessage(msg) {
  const ref = database.ref('interChatRoom').push();
  interChatMessages.push({ ...msg, _key: ref.key });
  ref.set(msg).catch(err => {
    console.error('[interChat] فشل إرسال الرسالة:', err);
    showToast('⚠️ تحذير', 'تعذّر إرسال الرسالة، تحقق من الاتصال وحاول مجدداً');
  });
}

function listenToInterChat() {
  database.ref('interChatRoom').on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    const msgs = Object.keys(data).map(key => ({ ...data[key], _key: key }));
    msgs.sort((a, b) => (a.time || 0) - (b.time || 0));
    interChatMessages = msgs;
    renderInterChatMessages();
  });
}

function renderInterChatMessages() {
  const container = document.getElementById('interChatMessages');
  const msgs = getInterChatMessages();
  const htmlContent = msgs.map(m => {
    const timeStr = new Date(m.time).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
    const isMe = m.sender === getCenterName() || m.sender === 'المديرية' || departments.some(d => d.name === m.sender);
    const bubbleClass = isMe ? 'center-msg' : 'directorate-msg';
    const senderLabel = m.sender || 'غير معروف';
    const recipientLabel = m.recipient ? ` → ${m.recipient}` : '';
    let attachHtml = '';
    if (m.attachment) {
      if (m.attachment.type && m.attachment.type.startsWith('image/')) {
        attachHtml = `<img class="chat-attach-img" src="${m.attachment.data}" onclick="openLightbox('${m.attachment.data}')">`;
      } else {
        attachHtml = `<a class="chat-attach-file" href="${m.attachment.data}" download="${escapeHtml(m.attachment.name)}"><i class="fa-solid fa-file"></i> ${escapeHtml(m.attachment.name)}</a>`;
      }
    }
    return `<div class="chat-bubble ${bubbleClass}"><span class="chat-sender-label">${escapeHtml(senderLabel)}${recipientLabel}</span>${m.text ? escapeHtml(m.text) : ''}${attachHtml}<span class="chat-time">${timeStr}</span></div>`;
  }).join('');
  container.innerHTML = htmlContent || '<div style="color:var(--text-dim); text-align:center; padding:40px; font-size:18px;">لا توجد رسائل في غرفة المؤسسات</div>';
  container.scrollTop = container.scrollHeight;
}

function handleInterChatFileAttach(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { alert("⚠️ حجم الملف يتجاوز الحد الأقصى المسموح به (4 ميغابايت)."); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(ev) {
    interChatPendingAttachment = { name: file.name, type: file.type, data: ev.target.result };
    showToast("📎 مرفق", `تم إرفاق ${file.name}`);
  };
  reader.readAsDataURL(file);
}

function sendInterChatMessage() {
  const input = document.getElementById('interChatInput');
  const text = input.value.trim();
  const recipient = document.getElementById('interChatRecipient').value;
  const recipientLabel = recipient === 'all' ? 'الجميع' : 
                         recipient === 'directorate' ? 'المديرية' : 
                         INSTITUTIONS_DATA.find(i => i.name === recipient)?.name || 
                         departments.find(d => d.name === recipient)?.name || recipient;
  if (!text && !interChatPendingAttachment) return;
  const senderName = currentRole === 'directorate' ? 'المديرية' : 
                     currentRole === 'department' ? departments.find(d => d.id === currentDepartment)?.name || 'مصلحة' :
                     getCenterName();
  appendInterChatMessage({ sender: senderName, recipient: recipientLabel, text, attachment: interChatPendingAttachment, time: Date.now() });
  interChatPendingAttachment = null;
  input.value = '';
  renderInterChatMessages();
  document.getElementById('interChatFileInput').value = '';
}



// 📋 CENTER CHAT HUB
function renderChatHub() {
  const container = document.getElementById('chatHubContainer');
  if (!container) return;
  const centerName = getCenterName();
  const sentByCenter = centerIssues.filter(issue => issue.center === centerName);
  const receivedFromDirectorate = activeIssues.filter(issue => issue.center === centerName && issue.source === 'directorate');
  const myIssues = [...receivedFromDirectorate, ...sentByCenter].sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  if (myIssues.length === 0) { 
    container.innerHTML = `<div class="chat-hub-table-wrap"><div class="empty-msg">لا توجد انشغالات أو محادثات للمتابعة.</div></div>`; 
    return; 
  }
  let rows = myIssues.map(issue => {
    const isResolved = issue.status && issue.status.indexOf('تم الحل') !== -1;
    const hasAttach = issue.attachments && issue.attachments.length > 0;
    const msgs = getChatMessages(issue.code);
    const hasUnread = msgs.length > 0 && msgs[msgs.length - 1].sender && msgs[msgs.length - 1].sender !== 'center' && !msgs[msgs.length - 1].read;
    const timeAgo = getTimeAgo(issue.createdAt || Date.now());
    const preview = issue.details ? issue.details.substring(0, 60) + (issue.details.length > 60 ? '...' : '') : '';
    const deptName = getDepartmentName(issue.department);
    return `<tr class="${hasUnread ? 'row-unread' : ''}" onclick="openChat('${issue.code}', 'center')">
      <td><strong style="font-size:17px;">${escapeHtml(issue.code)}</strong><br><span style="font-size:13px; color:var(--text-dim);">${timeAgo}</span></td>
      <td style="font-size:17px;">${issue.source === 'directorate' ? '<span style="color:var(--algeria-red);font-weight:800;"><i class="fa-solid fa-building-columns"></i> وارد من المديرية</span>' : escapeHtml(issue.type)}</td>
      <td style="font-size:14px; font-weight:700;">${escapeHtml(deptName)}</td>
      <td><span class="status-badge ${isResolved ? 'resolved' : 'pending'}">${isResolved ? '✅ تم الحل' : '🔄 قيد المعالجة'}</span></td>
      <td style="font-size:16px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(preview)}</td>
      <td>${hasAttach ? '<span class="attach-badge"><i class="fa-solid fa-paperclip"></i> مرفق</span>' : ''}${hasUnread ? '<span class="unread-badge"><i class="fa-solid fa-bell"></i> جديد</span>' : ''}</td>
      <td style="font-size:16px; color:var(--text-dim);"><i class="fa-regular fa-comment"></i> ${msgs.length}</td>
    </tr>`;
  }).join('');
  container.innerHTML = `<div class="chat-hub-table-wrap"><div class="table-scroll"><table><thead><tr><th style="min-width:160px;">الرمز المرجعي</th><th style="min-width:150px;">المصلحة</th><th style="min-width:150px;">المصلحة المسؤولة</th><th style="min-width:130px;">الحالة</th><th style="min-width:220px;">ملخص الإنشغال</th><th style="min-width:150px;">المرفقات</th><th style="min-width:90px;">الرسائل</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}



// 🔔 CHECK FOR NEW MESSAGES
function checkForNewMessages() {
  const allCodes = new Set();
  [...activeIssues, ...archivedIssues, ...centerIssues, ...centerArchived].forEach(i => allCodes.add(i.code));
  allCodes.forEach(code => {
    const msgs = getChatMessages(code);
    if (msgs.length === 0) return;
    const last = msgs[msgs.length - 1];
    const chatOpenOnThis = currentChatCode === code && document.getElementById('chatModal').classList.contains('open');
    if (chatOpenOnThis && last.sender && last.sender !== currentRole && last.sender !== 'system') {
      markChatMessagesRead(code, currentRole);
      renderChatMessages(currentRole);
    } else if (last.sender && last.sender !== currentRole && !last.read && last.sender !== 'system') {
      const msgKey = code + '_' + last.time;
      if (!notifiedMessages.has(msgKey)) {
        notifiedMessages.add(msgKey);
        let senderName = last.sender;
        if (last.sender === 'directorate') senderName = 'المديرية';
        else if (last.sender === 'department') senderName = 'المصلحة';
        else senderName = 'المركز';
        showToastWithAction(last.text || '(مرفق)', `📩 رسالة جديدة من ${senderName} - ${code}`, () => { openChat(code, currentRole); });
        notifyBrowser(`📩 رسالة جديدة من ${senderName}`, `${code}: ${last.text || '(مرفق)'}`, () => { openChat(code, currentRole); });
        if (currentRole === 'directorate' || currentRole === 'department') renderList();
        else renderChatHub();
        if (currentRole === 'department') renderDeptIssuesTable();
      }
    }
  });
}



// 🎙️ الرد الصوتي على انشغالات المؤسسات
let _voiceRecorder = null;
let _voiceStream = null;
let _voiceChunks = [];
let _voiceTimer = null;
let _voiceSeconds = 0;

async function toggleVoiceRecording() {
  if (currentRole !== 'directorate') return;
  const btn = document.getElementById('chatVoiceBtn');
  if (_voiceRecorder && _voiceRecorder.state === 'recording') {
    _voiceRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast('⚠️ غير مدعوم', 'متصفحك لا يدعم التسجيل الصوتي. استخدم Chrome أو Edge حديثاً.');
    return;
  }
  try {
    _voiceStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true } });
    _voiceChunks = [];
    _voiceSeconds = 0;
    const preferred = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    _voiceRecorder = new MediaRecorder(_voiceStream, preferred ? { mimeType:preferred, audioBitsPerSecond:64000 } : undefined);
    _voiceRecorder.ondataavailable = e => { if (e.data?.size) _voiceChunks.push(e.data); };
    _voiceRecorder.onstop = finishVoiceRecording;
    _voiceRecorder.start(250);
    if (btn) { btn.classList.add('recording'); btn.innerHTML='<i class="fa-solid fa-stop"></i>'; btn.title='إيقاف التسجيل'; }
    _voiceTimer = setInterval(() => {
      _voiceSeconds++;
      if (btn) btn.title = 'إيقاف التسجيل (' + _voiceSeconds + ' ث)';
      if (_voiceSeconds >= 60 && _voiceRecorder?.state === 'recording') _voiceRecorder.stop();
    },1000);
    showToast('🎙️ بدأ التسجيل', 'اضغط زر الإيقاف عند الانتهاء. الحد الأقصى 60 ثانية.');
  } catch(err) {
    showToast('⚠️ تعذر التسجيل', 'يرجى السماح للمتصفح باستخدام الميكروفون.');
  }
}

function finishVoiceRecording() {
  clearInterval(_voiceTimer);
  _voiceStream?.getTracks().forEach(t => t.stop());
  _voiceStream = null;
  const btn = document.getElementById('chatVoiceBtn');
  if (btn) { btn.classList.remove('recording'); btn.innerHTML='<i class="fa-solid fa-microphone"></i>'; btn.title='تسجيل رد صوتي'; }
  const type = _voiceRecorder?.mimeType || 'audio/webm';
  const blob = new Blob(_voiceChunks, { type });
  _voiceChunks = [];
  if (!blob.size) return;
  if (blob.size > 3 * 1024 * 1024) { showToast('⚠️ التسجيل كبير', 'تعذر إرفاق التسجيل. حاول تسجيل رد أقصر.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    pendingAttachment = { name:'رد صوتي ' + new Date().toLocaleTimeString('ar-DZ',{hour:'2-digit',minute:'2-digit'}) + '.webm', type, data:e.target.result };
    document.getElementById('chatAttachName').textContent = '🎙️ رد صوتي جاهز للإرسال (' + Math.max(1,_voiceSeconds) + ' ث)';
    document.getElementById('chatAttachPreview').style.display = 'flex';
    showToast('✅ التسجيل جاهز', 'اضغط زر الإرسال لإرسال الرد الصوتي.');
  };
  reader.readAsDataURL(blob);
}

