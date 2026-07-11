// ============================================
// 📋 إدارة الانشغالات (المخاوف)
// إضافة، عرض، تعديل، حذف
// ============================================

// 📋 LIST FUNCTIONS
let currentListTab = 'all';

function switchListTab(tab) {
  currentListTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-btn[onclick="switchListTab('${tab}')"]`)?.classList.add('active');
  renderList();
}

function priorityPillHtml(p) {
  if (p === 'مستعجل جداً') return `<span class="pill pill-urgent">مستعجل جداً 🔴</span>`;
  if (p === 'متوسط') return `<span class="pill pill-medium">متوسط 🟡</span>`;
  return `<span class="pill pill-normal">عادي 🟢</span>`;
}

function sourceBadgeHtml(source) {
  if (source === 'directorate') return `<span style="color:var(--algeria-green); font-weight:800; font-size:14px;">المديرية</span>`;
  return `<span style="color:var(--algeria-red); font-weight:800; font-size:14px;">مركز</span>`;
}

function hasUnreadMessages(code) {
  const msgs = getChatMessages(code);
  if (msgs.length === 0) return false;
  const last = msgs[msgs.length - 1];
  if (currentRole === 'department') {
    return last.sender !== 'department' && !last.read;
  }
  return last.sender !== currentRole && !last.read;
}

function hasAttachment(issue) { return issue.attachments && issue.attachments.length > 0; }

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `منذ ${days} يوم`;
  if (hours > 0) return `منذ ${hours} ساعة`;
  if (minutes > 0) return `منذ ${minutes} دقيقة`;
  return 'الآن';
}

function getDepartmentName(id) {
  if (!id) return 'غير محددة';
  const dept = departments.find(d => d.id === id);
  return dept ? dept.name : 'غير محددة';
}

const debouncedRenderList = debounce(() => renderList(), 250);
const debouncedRenderArchive = debounce(() => renderArchive(), 250);

function matchesDateRange(createdAt, fromId, toId) {
  const fromVal = document.getElementById(fromId)?.value || '';
  const toVal = document.getElementById(toId)?.value || '';
  if (!fromVal && !toVal) return true;
  const d = new Date(createdAt);
  if (fromVal && d < new Date(fromVal + 'T00:00:00')) return false;
  if (toVal && d > new Date(toVal + 'T23:59:59')) return false;
  return true;
}

function renderList() {
  const search = (document.getElementById('list-search')?.value || '').trim().toLowerCase();
  const priorityFilter = document.getElementById('list-priority-filter')?.value || '';
  const statusFilter = document.getElementById('list-status-filter')?.value || '';
  const sourceFilter = document.getElementById('list-source-filter')?.value || '';
  const deptFilter = document.getElementById('list-dept-filter')?.value || '';
  const container = document.getElementById('listTableBody');
  if (!container) return;
  
  let filtered = [];
  if (currentListTab === 'archived_center') {
    filtered = centerArchived.filter(issue => {
      const matchesSearch = !search || issue.code.toLowerCase().includes(search) || issue.center.toLowerCase().includes(search) || issue.type.toLowerCase().includes(search);
      const matchesPriority = !priorityFilter || issue.priority === priorityFilter;
      const matchesDate = matchesDateRange(issue.createdAt, 'list-date-from', 'list-date-to');
      return matchesSearch && matchesPriority && matchesDate;
    });
  } else {
    filtered = activeIssues.filter(issue => {
      if (currentListTab === 'directorate' && issue.source !== 'directorate') return false;
      if (currentListTab === 'centers' && issue.source !== 'center') return false;
      const matchesSearch = !search || issue.code.toLowerCase().includes(search) || issue.center.toLowerCase().includes(search) || issue.type.toLowerCase().includes(search);
      const matchesPriority = !priorityFilter || issue.priority === priorityFilter;
      const isResolved = !!(issue.status && issue.status.indexOf('تم الحل') !== -1);
      const matchesStatus = !statusFilter || (statusFilter === 'resolved' ? isResolved : !isResolved);
      const matchesSource = !sourceFilter || issue.source === sourceFilter;
      const matchesDept = !deptFilter || issue.department === deptFilter;
      const matchesDate = matchesDateRange(issue.createdAt, 'list-date-from', 'list-date-to');
      return matchesSearch && matchesPriority && matchesStatus && matchesSource && matchesDept && matchesDate;
    });
  }
  
  if (filtered.length === 0) { container.innerHTML = `<div class="empty-msg">${currentListTab === 'archived_center' ? 'لا توجد إنشغالات مرسلة من المراكز في الأرشيف.' : 'لا توجد إنشغالات مطابقة حالياً.'}</div>`; return; }
  
  const LIST_COLGROUP = '<colgroup><col style="width:120px"><col style="width:130px"><col style="width:110px"><col style="width:110px"><col style="width:100px"><col style="width:110px"><col style="width:90px"><col style="width:70px"><col style="width:70px"><col style="width:150px"><col style="width:70px"><col style="width:170px"></colgroup>';
  
  container.innerHTML = filtered.map(issue => {
    const unread = currentListTab !== 'archived_center' && hasUnreadMessages(issue.code);
    const hasAttach = hasAttachment(issue);
    const timeAgo = getTimeAgo(issue.createdAt);
    const isArchived = currentListTab === 'archived_center';
    const isBroadcast = issue.isBroadcast || false;
    const deptName = getDepartmentName(issue.department);
    return `<div class="list-row-scroll ${unread ? 'row-unread' : ''}"><table class="list-fixed-table">${LIST_COLGROUP}<tbody><tr>
      <td class="wrap-cell"><strong style="font-size:16px;">${escapeHtml(issue.code)}</strong><br><span style="font-size:13px; color:var(--text-dim);">${timeAgo} ${isBroadcast ? '📢' : ''}</span></td>
      <td class="wrap-cell" style="font-size:16px;">${escapeHtml(issue.center)}</td>
      <td class="wrap-cell" style="font-size:16px;">${escapeHtml(issue.type)}</td>
      <td class="wrap-cell" style="font-size:14px; font-weight:700;">${escapeHtml(deptName)}</td>
      <td>${priorityPillHtml(issue.priority)}</td>
      <td class="wrap-cell" style="font-size:16px;">${escapeHtml(issue.author)}</td>
      <td>${sourceBadgeHtml(issue.source)}</td>
      <td><button class="btn-mini view-btn" onclick="openDetails('${issue.code}', ${isArchived ? 'true' : 'false'})"><i class="fa-solid fa-eye"></i></button></td>
      <td>${hasAttach ? '<span style="color:var(--algeria-green);"><i class="fa-solid fa-paperclip"></i></span>' : '<span style="color:var(--text-dim);">-</span>'}</td>
      <td>${isArchived ? '<span class="status-resolved">مؤرشف 📦</span>' : `<select class="status-select" onchange="toggleStatus('${issue.code}', this.value)"><option value="pending" ${issue.status && issue.status.indexOf('قيد المعالجة') !== -1 ? 'selected' : ''}>قيد المعالجة</option><option value="resolved" ${issue.status && issue.status.indexOf('تم الحل') !== -1 ? 'selected' : ''}>تم الحل</option></select>`}</td>
      <td>${isArchived ? '<span style="color:var(--text-dim);">-</span>' : `<button class="btn-chat ${unread ? 'new-msg' : ''}" onclick="openChat('${issue.code}', '${currentRole}')">${unread ? '<i class="fa-solid fa-bell"></i>' : '<i class="fa-solid fa-comments"></i>'}</button>`}</td>
      <td>${isArchived ? `<button class="btn-mini success" onclick="restoreFromCenterArchive('${issue.code}')"><i class="fa-solid fa-rotate-left"></i></button><button class="btn-mini danger" onclick="deleteFromCenterArchive('${issue.code}')"><i class="fa-solid fa-trash"></i></button>` : `
        <button class="btn-mini" onclick="openTransfer('${issue.code}')" title="تحويل إلى مصلحة أخرى" style="border-color:var(--gold); color:var(--gold);"><i class="fa-solid fa-arrow-left"></i></button>
        ${issue.source === 'center' ? `<button class="btn-mini" onclick="archiveCenterIssue('${issue.code}')" style="border-color:var(--gold); color:var(--gold);"><i class="fa-solid fa-box-archive"></i></button>` : ''}
        <button class="btn-mini danger" onclick="deleteIssue('${issue.code}')"><i class="fa-solid fa-trash"></i></button>
      `}</td>
    </tr></tbody></table></div>`;
  }).join('');
  
  // بعد إعادة رسم الصفوف (نتيجة فلترة أو تحديث)، نطبّق نفس موضع تمرير رأس الجدول
  // الحالي على كل الصفوف الجديدة حتى لا تفقد التوافق مع بعضها
  const headerScroll = document.getElementById('listHeaderScroll');
  if (headerScroll && headerScroll.scrollLeft > 0) {
    container.querySelectorAll('.list-row-scroll').forEach(row => { row.scrollLeft = headerScroll.scrollLeft; });
  }
}

function openTransfer(code) {
  const issue = activeIssues.find(i => i.code === code);
  if (!issue) { showToast('⚠️ خطأ', 'لم يتم العثور على الإنشغال'); return; }
  document.getElementById('transferCodeDisplay').textContent = code;
  const select = document.getElementById('transferDeptSelect');
  select.innerHTML = departments.map(d => `<option value="${d.id}" ${d.id === issue.department ? 'selected' : ''}>${d.name}</option>`).join('');
  document.getElementById('transferReason').value = '';
  document.getElementById('transferModal').classList.add('open');
}

function closeTransfer() {
  document.getElementById('transferModal').classList.remove('open');
}

function confirmTransfer() {
  const code = document.getElementById('transferCodeDisplay').textContent;
  const deptId = document.getElementById('transferDeptSelect').value;
  const reason = document.getElementById('transferReason').value.trim();
  
  if (!deptId) { alert('يرجى اختيار المصلحة المستهدفة'); return; }
  
  const issue = activeIssues.find(i => i.code === code);
  if (!issue) { showToast('⚠️ خطأ', 'لم يتم العثور على الإنشغال'); return; }
  
  issue.department = deptId;
  issue.transferHistory = issue.transferHistory || [];
  issue.transferHistory.push({
    from: getDepartmentName(issue.department),
    to: getDepartmentName(deptId),
    reason: reason || 'تحويل',
    date: Date.now()
  });
  
  appendChatMessage(code, {
    sender: 'system',
    text: `🔄 تم تحويل الإنشغال إلى ${getDepartmentName(deptId)} ${reason ? ' (سبب: ' + reason + ')' : ''}`,
    time: Date.now(),
    read: false
  });
  
  addAuditLog('تحويل إنشغال', code, `إلى ${getDepartmentName(deptId)}${reason ? ' — ' + reason : ''}`);
  saveToFirebase();
  closeTransfer();
  renderList();
  renderDeptDashboard();
  showToast('✅ تم التحويل', `تم تحويل الإنشغال ${code} إلى ${getDepartmentName(deptId)}`);
}

function archiveCenterIssue(code) {
  if (!confirm("هل تريد أرشفة هذا الإنشغال من المراكز؟")) return;
  const idx = activeIssues.findIndex(i => i.code === code && i.source === 'center');
  if (idx === -1) return;
  const issue = activeIssues[idx];
  activeIssues.splice(idx, 1);
  centerArchived.push(issue);
  addAuditLog('أرشفة إنشغال مركز', code, issue.center || '');
  saveToFirebase();
  renderList(); renderKPIs(); updateChart();
  showToast("📦 تم الأرشفة", `تم أرشفة الإنشغال ${code} من المراكز.`);
}

function toggleStatus(code, value) {
  if (value === 'resolved') {
    const idx = activeIssues.findIndex(i => i.code === code);
    if (idx === -1) { showToast("⚠️ خطأ", "لم يتم العثور على الإنشغال"); return; }
    const issue = activeIssues[idx];
    issue.status = "تم الحل ✅";
    activeIssues.splice(idx, 1);
    archivedIssues.unshift(issue);
    addAuditLog('تسوية إنشغال', code, issue.center || '');
    saveToFirebase();
    renderKPIs();
    updateChart();
    renderList();
    renderArchive();
    const centerIdx = centerIssues.findIndex(i => i.code === code);
    if (centerIdx !== -1) { centerIssues[centerIdx].status = "تم الحل ✅"; saveToFirebase(); }
    showToast("✅ تم الحل", `تم تسوية الإن��غال ${code} ونقله إلى الأرشيف`);
  }
}

function deleteIssue(code) {
  if (!confirm("هل أنت متأكد من الحذف النهائي؟")) return;
  addAuditLog('حذف إنشغال', code, '');
  activeIssues = activeIssues.filter(i => i.code !== code);
  saveToFirebase();
  renderKPIs(); updateChart(); renderList();
}



// 📦 ARCHIVE FUNCTIONS
function renderArchive() {
  const search = (document.getElementById('archive-search')?.value || '').trim().toLowerCase();
  const sourceFilter = document.getElementById('archive-source-filter')?.value || '';
  const deptFilter = document.getElementById('archive-dept-filter')?.value || '';
  const tbody = document.getElementById('archiveTableBody');
  if (!tbody) return;
  
  let filtered = archivedIssues.filter(issue => {
    const matchesSearch = !search || issue.code.toLowerCase().includes(search) || issue.center.toLowerCase().includes(search) || issue.type.toLowerCase().includes(search);
    const matchesSource = !sourceFilter || issue.source === sourceFilter;
    const matchesDept = !deptFilter || issue.department === deptFilter;
    const matchesDate = matchesDateRange(issue.createdAt, 'archive-date-from', 'archive-date-to');
    return matchesSearch && matchesSource && matchesDept && matchesDate;
  });
  
  if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="11" class="empty-msg">لا توجد إنشغالات في الأرشيف.</td></tr>`; return; }
  
  tbody.innerHTML = filtered.map(issue => {
    const hasAttach = hasAttachment(issue);
    const timeAgo = getTimeAgo(issue.createdAt);
    const deptName = getDepartmentName(issue.department);
    return `<tr>
      <td><strong style="font-size:16px;">${escapeHtml(issue.code)}</strong><br><span style="font-size:13px; color:var(--text-dim);">${timeAgo}</span></td>
      <td style="font-size:16px;">${escapeHtml(issue.center)}</td>
      <td style="font-size:16px;">${escapeHtml(issue.type)}</td>
      <td style="font-size:14px; font-weight:700;">${escapeHtml(deptName)}</td>
      <td>${priorityPillHtml(issue.priority)}</td>
      <td style="font-size:16px;">${escapeHtml(issue.author)}</td>
      <td>${sourceBadgeHtml(issue.source)}</td>
      <td><button class="btn-mini view-btn" onclick="openDetails('${issue.code}', true)"><i class="fa-solid fa-eye"></i></button></td>
      <td>${hasAttach ? '<span style="color:var(--algeria-green);"><i class="fa-solid fa-paperclip"></i></span>' : '<span style="color:var(--text-dim);">-</span>'}</td>
      <td><span class="status-resolved">تم الحل ✅</span></td>
      <td style="white-space:nowrap;"><button class="btn-mini gold" onclick="openArchiveTransferModal('${issue.code}')"><i class="fa-solid fa-arrow-left"></i></button><button class="btn-mini" onclick="restoreFromArchive('${issue.code}')"><i class="fa-solid fa-rotate-left"></i></button><button class="btn-mini danger" onclick="deleteFromArchive('${issue.code}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`;
  }).join('');
}

function restoreFromArchive(code) {
  if (!confirm("هل تريد إعادة هذا الإنشغال إلى القائمة النشطة؟")) return;
  const idx = archivedIssues.findIndex(i => i.code === code);
  if (idx === -1) return;
  const issue = archivedIssues[idx];
  issue.status = "قيد المعالجة 🔄";
  archivedIssues.splice(idx, 1);
  activeIssues.unshift(issue);
  addAuditLog('استعادة من الأرشيف', code, issue.center || '');
  saveToFirebase();
  renderKPIs(); updateChart(); renderList(); renderArchive();
}

function deleteFromArchive(code) {
  if (!confirm("هل أنت متأكد من الحذف النهائي من الأرشيف؟")) return;
  addAuditLog('حذف من الأرشيف', code, '');
  archivedIssues = archivedIssues.filter(i => i.code !== code);
  saveToFirebase();
  renderKPIs(); updateChart(); renderArchive();
}

// فتح نافذة التحويل من الأرشيف إلى مصلحة
function openArchiveTransferModal(code) {
  const issue = archivedIssues.find(i => i.code === code);
  if (!issue) { showToast('⚠️ خطأ', 'لم يتم العثور على الإنشغال'); return; }
  
  document.getElementById('archiveTransferCodeDisplay').textContent = code;
  const select = document.getElementById('archiveTransferDeptSelect');
  select.innerHTML = departments.map(d => `<option value="${d.id}" ${d.id === issue.department ? 'selected' : ''}>${d.name}</option>`).join('');
  document.getElementById('archiveTransferReason').value = '';
  document.getElementById('archiveTransferCode').value = code;
  document.getElementById('archiveTransferModal').classList.add('open');
}

function closeArchiveTransfer() {
  document.getElementById('archiveTransferModal').classList.remove('open');
}

function confirmArchiveTransfer() {
  const code = document.getElementById('archiveTransferCode').value;
  const deptId = document.getElementById('archiveTransferDeptSelect').value;
  const reason = document.getElementById('archiveTransferReason').value.trim();
  
  if (!deptId) { alert('يرجى اختيار المصلحة المستهدفة'); return; }
  
  const idx = archivedIssues.findIndex(i => i.code === code);
  if (idx === -1) { showToast('⚠️ خطأ', 'لم يتم العثور على الإنشغال'); return; }
  
  const issue = archivedIssues[idx];
  const oldDept = issue.department;
  issue.department = deptId;
  issue.transferHistory = issue.transferHistory || [];
  issue.transferHistory.push({
    from: oldDept,
    to: deptId,
    reason: reason,
    timestamp: new Date().toLocaleString('ar-DZ')
  });
  issue.status = "قيد المعالجة 🔄";
  
  // نقل الإنشغال من الأرشيف إلى القائمة النشطة
  archivedIssues.splice(idx, 1);
  activeIssues.unshift(issue);
  
  addAuditLog('تحويل من الأرشيف', code, `إلى ${getDepartmentName(deptId)}${reason ? ' — ' + reason : ''}`);
  saveToFirebase();
  closeArchiveTransfer();
  showToast('✅ تم التحويل', `تم تحويل الإنشغال ${code} إلى المصلحة بنجاح!`);
  renderKPIs(); updateChart(); renderList(); renderArchive();
}



// 📝 SUBMIT NEW ISSUE
function submitNewIssue() {
  const center = document.getElementById('add-form-center').value;
  const type = document.getElementById('add-form-type').value;
  const priority = document.getElementById('add-form-priority').value;
  const author = document.getElementById('add-form-author').value.trim();
  const details = document.getElementById('add-form-details').value.trim();
  if (!center || !type || !details) { alert("يرجى تعبئة كل الحقول الأساسية قبل الحفظ."); return; }
  
  const dept = getDepartmentForType(type);
  const deptId = dept ? dept.id : '';
  
  const newIssue = { 
    code: generateRefCode(), 
    center, 
    type, 
    priority, 
    author: author || "غير محدد", 
    details, 
    status: "قيد المعالجة 🔄", 
    createdAt: Date.now(), 
    source: 'directorate', 
    attachments: [],
    department: deptId,
    transferHistory: []
  };
  activeIssues.unshift(newIssue);
  saveToFirebase();
  if (!isMuted) playNotificationSound();
  showToast("✅ تم الحفظ", `تم تدوين الإنشغال ${newIssue.code} بنجاح! ${dept ? 'تم توجيهه إلى ' + dept.name : ''}`);
  document.getElementById('add-form-author').value = '';
  document.getElementById('add-form-details').value = '';
  renderKPIs();
  updateChart();
  renderList();
  renderDeptDashboard();
  switchTab('list');
}

function generateRefCode() {
  const now = new Date();
  return `REF-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
}



// 📦 SEND FROM CENTER
function setupPasteFeature() {
  window.addEventListener('paste', function(e) {
    const sendPage = document.getElementById('page-send-panel');
    if (!sendPage || sendPage.classList.contains('hidden')) return;
    const items = (e.clipboardData || window.clipboardData).items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = function(ev) {
          pendingCenterFile = { data: ev.target.result, type: 'image', name: 'لقطة شاشة.png' };
          const zone = document.getElementById('pasteZone');
          if (zone) { zone.classList.add('captured'); zone.textContent = '📸 تم التق��ط الصورة وجاهزة للإرسال!'; }
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        break;
      }
    }
  });
}

function handleCenterFileSelection(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
    pendingCenterFile = { data: ev.target.result, type: fileType, name: file.name };
    const zone = document.getElementById('pasteZone');
    if (zone) { zone.classList.add('captured'); zone.textContent = fileType === 'pdf' ? '📄 تم اختيار ملف PDF جاهز للإرسال!' : '📸 تم اختيار صورة جاهزة للإرسال!'; }
  };
  reader.readAsDataURL(file);
}

function sendFromCenter() {
  const details = document.getElementById('form-details').value.trim();
  if (!details) { alert("يرجى كتابة الشرح الدقيق للمشكلة أو الإنشغال قبل الإرسال."); return; }
  const btn = document.getElementById('sendBtn');
  // منع الضغط المتكرر/المزدوج على الزر أثناء المعالجة (يسبب إحساساً بعدم السلاسة وإرسالاً مكرراً)
  if (btn.disabled) return;

  // إذا كان الزر عالقاً معطلاً من محاولة سابقة فاشلة، نعيد ضبطه دائماً قبل المتابعة
  const originalBtnHtml = '<i class="fa-solid fa-broadcast"></i> بث وإرسال الإنشغال';
  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.style.cursor = 'wait';
  btn.textContent = '⏳ جاري الإرسال...';

  // نُعيد العمل الثقيل (الحفظ + إعادة رسم الجداول والرسوم البيانية) إلى دورة التنفيذ التالية
  // حتى تُتاح الفرصة للمتصفح لرسم حالة "جاري الإرسال" فوراً على الزر أولاً.
  // بدون هذا التأجيل يبقى الزر بلا أي استجابة مرئية لحظة الضغط لأن كل العمليات
  // كانت تُنفَّذ ضمن نفس الدفعة المتزامنة قبل أن يعيد المتصفح رسم الواجهة.
  requestAnimationFrame(() => setTimeout(() => processSendFromCenter(btn, details, originalBtnHtml), 0));
}

function processSendFromCenter(btn, details, originalBtnHtml) {
  try {
    const type = document.getElementById('form-type').value;
    const priority = document.getElementById('form-priority').value;
    const reporter = document.getElementById('form-reporter').value.trim() || "غير محدد";
    const targetDeptId = document.getElementById('form-target-dept').value;
    const center = getCenterName();
    const code = generateRefCode();

    // استخدام المصلحة التي اختارها المستخدم، أو البحث عن المصلحة المناسبة حسب التصنيف
    let deptId = targetDeptId;
    if (!deptId) {
      const dept = getDepartmentForType(type);
      deptId = dept ? dept.id : '';
    }

    const attachments = [];
    if (pendingCenterFile) {
      attachments.push({
        name: pendingCenterFile.name || (pendingCenterFile.type === 'image' ? 'صورة_مرفقة.png' : 'مرفق.pdf'),
        type: pendingCenterFile.type === 'image' ? 'image/png' : 'application/pdf',
        data: pendingCenterFile.data
      });
    }

    const payload = {
      code, center, type, priority, reporter, details,
      status: "قيد المعالجة 🔄",
      attachments,
      source: 'center',
      createdAt: Date.now(),
      department: deptId,
      transferHistory: []
    };
    centerIssues.unshift(payload);

    const activeCopy = {
      code, center, type, priority,
      author: reporter, details,
      status: "قيد المعالجة 🔄",
      createdAt: Date.now(),
      source: 'center',
      attachments: attachments.length > 0 ? attachments : [],
      department: deptId,
      transferHistory: []
    };
    activeIssues.unshift(activeCopy);

    // لا نسمح لفشل التخزين المحلي (مثلاً امتلاء المساحة بسبب مرفقات كبيرة)
    // بإيقاف الإرسال بالكامل أو تجميد الزر إلى الأبد
    try {
      saveToFirebase();
    } catch (storageErr) {
      console.error('تعذر حفظ نسخة محلية كاملة (قد تكون المساحة ممتلئة):', storageErr);
      // نحاول رغم ذلك دفع البيانات إلى Firebase مباشرة حتى لو فشل التخزين المحلي
      try { _debouncedPushToFirebase(); } catch (e2) { console.error(e2); }
      showToast("⚠️ تنبيه", "تم إرسال الإنشغال لكن قد تكون مساحة التخزين المحلي ممتلئة. يفضل حذف بعض المرفقات القديمة.");
    }

    if (!isMuted) { try { playNotificationSound(); } catch (soundErr) { console.warn('تعذر تشغيل صوت التنبيه:', soundErr); } }
    const deptName = getDepartmentName(deptId);
    showToast("✅ تم الإرسال", `تم إرسال الإنشغال ${code} بنجاح! ${deptName ? 'تم توجيهه إلى ' + deptName : ''}`);
    document.getElementById('form-details').value = '';
    document.getElementById('form-reporter').value = '';
    document.getElementById('form-file').value = '';
    document.getElementById('form-priority').selectedIndex = 0;
    document.getElementById('form-target-dept').value = '';
    resetPasteZone();
    renderChatHub();
    renderList();
    renderKPIs();
    updateChart();
    renderDeptDashboard();
  } catch (err) {
    console.error('فشل إرسال الإنشغال من المركز/المعهد/المدرسة الخاصة:', err);
    showToast("❌ فشل الإرسال", "حدث خطأ أثناء إرسال الإنشغال. يرجى المحاولة مرة أخرى أو تحديث الصفحة.");
  } finally {
    // مهما حدث (نجاح أو خطأ)، يجب أن يعود الزر قابلاً للاستخدام دائماً
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.innerHTML = originalBtnHtml;
  }
}

function resetPasteZone() {
  pendingCenterFile = null;
  const zone = document.getElementById('pasteZone');
  if (zone) { zone.classList.remove('captured'); zone.textContent = '📸 اضغط هنا ثم Ctrl+V للصق لقطة شاشة'; }
}



// 🔴 إنشغال وارد من المديرية — نافذة منبثقة بشكل شات
const _incomingIssueQueue = [];
let _incomingIssueOpenCode = null;
let _incomingCurrentIssue = null;

function _incomingSeenKey() {
  return 'incoming_directorate_seen_' + (getCenterName() || 'center');
}
function _getIncomingSeen() {
  try { return JSON.parse(localStorage.getItem(_incomingSeenKey()) || '{}'); } catch(e) { return {}; }
}
function _markIncomingSeen(code) {
  const seen = _getIncomingSeen();
  seen[code] = Date.now();
  const keys = Object.keys(seen).sort((a,b) => seen[b]-seen[a]).slice(0,200);
  const compact = {}; keys.forEach(k => compact[k]=seen[k]);
  localStorage.setItem(_incomingSeenKey(), JSON.stringify(compact));
}

function detectIncomingDirectorateIssues(issues) {
  if (currentRole !== 'center' || !Array.isArray(issues)) return;
  const centerName = getCenterName();
  const seen = _getIncomingSeen();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const incoming = issues
    .filter(i => i && i.source === 'directorate' && i.center === centerName && !seen[i.code] && (i.createdAt || 0) >= cutoff)
    .sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));
  incoming.forEach(issue => {
    if (_incomingIssueOpenCode !== issue.code && !_incomingIssueQueue.some(q => q.code === issue.code)) _incomingIssueQueue.push(issue);
  });
  showNextIncomingIssueChat();
}

function showNextIncomingIssueChat() {
  if (_incomingIssueOpenCode || currentRole !== 'center') return;
  const issue = _incomingIssueQueue.shift();
  if (!issue) return;
  _incomingIssueOpenCode = issue.code;
  _incomingCurrentIssue = issue;
  _markIncomingSeen(issue.code);
  document.getElementById('incomingIssueChat')?.remove();
  const box = document.createElement('div');
  box.id = 'incomingIssueChat';
  box.className = 'incoming-issue-chat attention';
  const sentTime = new Date(issue.createdAt || Date.now()).toLocaleTimeString('ar-DZ',{hour:'2-digit',minute:'2-digit'});
  const title = issue.title || 'إنشغال جديد من المديرية';
  box.innerHTML = `<div class="directorate-alert-screen">
    <div class="directorate-alert-icon"><i class="fa-solid fa-building-columns"></i></div>
    <div class="directorate-alert-kicker"><i class="fa-solid fa-circle-exclamation"></i> وارد رسمي</div>
    <h3>إنشغال جديد من المديرية</h3>
    <div class="das-title">${escapeHtml(title)}</div>
    <div class="das-meta">المرجع: ${escapeHtml(issue.code)} · اليوم ${sentTime} · ${escapeHtml(issue.priority || 'عادي')}</div>
    <div class="directorate-alert-actions">
      <button class="open-alert" onclick="openIncomingIssuePreview()"><i class="fa-solid fa-envelope-open-text"></i> فتح الانشغال والاطلاع عليه</button>
      <button class="soft-alert" onclick="toggleIncomingIssueSound()"><i class="fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-low'}" id="incomingSoundIcon"></i> الصوت</button>
      <button class="soft-alert" onclick="closeIncomingIssueChat()"><i class="fa-solid fa-clock"></i> لاحقاً</button>
    </div>
  </div>`;
  document.body.appendChild(box);
  if (!isMuted) playIncomingIssueSoftSound();
}

function openIncomingIssuePreview() {
  const issue = _incomingCurrentIssue;
  const box = document.getElementById('incomingIssueChat');
  if (!issue || !box) return;
  box.classList.remove('attention');
  const sentTime = new Date(issue.createdAt || Date.now()).toLocaleTimeString('ar-DZ',{hour:'2-digit',minute:'2-digit'});
  const title = issue.title || 'إنشغال جديد من المديرية';
  const text = issue.content || issue.details || 'لا يوجد مضمون مرفق';
  box.innerHTML = `
    <div class="incoming-issue-head">
      <div class="incoming-avatar"><i class="fa-solid fa-building-columns"></i></div>
      <div class="incoming-title"><strong>المديرية</strong><small>${escapeHtml(title)} · ${escapeHtml(issue.code)}</small></div>
      <button class="incoming-head-btn" onclick="toggleIncomingIssueSound()" title="كتم/تشغيل الصوت"><i class="fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-low'}" id="incomingSoundIcon"></i></button>
      <button class="incoming-head-btn" onclick="closeIncomingIssueChat()" title="إغلاق"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="incoming-issue-body" id="incomingIssueBody">
      <div class="incoming-date-separator">اليوم · ${sentTime}</div>
      <div class="incoming-chat-bubble from-directorate">
        <span class="bubble-sender">المديرية</span>
        <strong style="display:block;margin-bottom:5px;">${escapeHtml(title)}</strong>${linkifyText(text)}
        <span class="incoming-priority"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(issue.priority || 'عادي')}</span>
      </div>
    </div>
    <div class="incoming-issue-input">
      <input id="incomingIssueReply" type="text" placeholder="اكتب ردك على المديرية..." onkeydown="if(event.key==='Enter')sendIncomingIssueReply('${escapeHtml(issue.code)}')">
      <button class="incoming-send-btn" onclick="sendIncomingIssueReply('${escapeHtml(issue.code)}')" title="إرسال"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
    <div class="incoming-open-chat" onclick="openIncomingIssueFullChat('${escapeHtml(issue.code)}')"><i class="fa-solid fa-up-right-from-square"></i> فتح المحادثة الكاملة</div>`;
  setTimeout(() => document.getElementById('incomingIssueReply')?.focus(),250);
}

function playIncomingIssueSoftSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [620,780].forEach((f,i) => {
      const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(.001,now+i*.14);g.gain.linearRampToValueAtTime(.09,now+i*.14+.025);g.gain.exponentialRampToValueAtTime(.001,now+i*.14+.28);
      o.start(now+i*.14);o.stop(now+i*.14+.3);
    });
  } catch(e) {}
}

function toggleIncomingIssueSound() {
  toggleMute();
  const icon = document.getElementById('incomingSoundIcon');
  if (icon) icon.className = 'fa-solid ' + (isMuted ? 'fa-volume-xmark' : 'fa-volume-low');
  if (!isMuted) playIncomingIssueSoftSound();
}

function sendIncomingIssueReply(code) {
  const input = document.getElementById('incomingIssueReply');
  const text = (input?.value || '').trim();
  if (!text) return;
  appendChatMessage(code, { sender:'center', text, attachment:null, time:Date.now(), read:false });
  input.value='';
  const body = document.getElementById('incomingIssueBody');
  if (body) {
    const bubble=document.createElement('div');bubble.className='incoming-chat-bubble from-center';
    bubble.innerHTML='<span class="bubble-sender">أنت</span>'+linkifyText(text);
    body.appendChild(bubble);body.scrollTop=body.scrollHeight;
  }
  showToast('✅ تم إرسال الرد','وصل ردك إلى المديرية في المحادثة.');
}

function openIncomingIssueFullChat(code) {
  closeIncomingIssueChat(false);
  openChat(code,'center');
}
function closeIncomingIssueChat(showNext=true) {
  document.getElementById('incomingIssueChat')?.remove();
  _incomingIssueOpenCode=null;
  _incomingCurrentIssue=null;
  if (showNext) setTimeout(showNextIncomingIssueChat,250);
}



// 📢 BROADCAST
function selectBroadcastTarget(target) {
  broadcastTarget = target;
  document.querySelectorAll('.broadcast-options button').forEach(b => b.classList.remove('active'));
  document.querySelector(`.broadcast-options button[data-target="${target}"]`)?.classList.add('active');
  updateBroadcastCount();
}

function updateBroadcastCount() {
  const count = document.getElementById('broadcastCount');
  if (!count) return;
  let targets = [];
  if (broadcastTarget === 'all') targets = INSTITUTIONS_DATA;
  else if (broadcastTarget === 'centers') targets = INSTITUTIONS_DATA.filter(i => i.type === 'center');
  else if (broadcastTarget === 'private') targets = INSTITUTIONS_DATA.filter(i => i.type === 'private');
  const label = broadcastTarget === 'all' ? 'جميع المؤسسات' : broadcastTarget === 'centers' ? 'المراكز والمعاهد' : 'المدارس الخاصة';
  count.textContent = `سيتم الإرسال إلى: ${label} (${targets.length} مؤسسة)`;
}

function sendBroadcast() {
  const title = document.getElementById('broadcast-title').value.trim();
  const content = document.getElementById('broadcast-content').value.trim();
  const priority = document.getElementById('broadcast-priority').value;
  if (!title || !content) { alert("يرجى كتابة عنوان ونص التعميم قبل الإرسال."); return; }
  let targets = [];
  if (broadcastTarget === 'all') targets = INSTITUTIONS_DATA;
  else if (broadcastTarget === 'centers') targets = INSTITUTIONS_DATA.filter(i => i.type === 'center');
  else if (broadcastTarget === 'private') targets = INSTITUTIONS_DATA.filter(i => i.type === 'private');
  if (targets.length === 0) { alert("لا توجد مؤسسات في الفئة المحددة."); return; }
  const code = generateRefCode();
  targets.forEach(inst => {
    const issue = { 
      code: code + '-' + inst.code, 
      center: inst.name, 
      type: "تعميم", 
      title: title,
      content: content,
      priority: priority, 
      author: "المديرية (تعميم)", 
      details: `📢 **${title}**\n\n${content}\n\n📌 هذا التعميم مرسل إلى: ${inst.name}`, 
      status: "قيد المعالجة 🔄", 
      createdAt: Date.now(), 
      source: 'directorate', 
      attachments: [], 
      isBroadcast: true,
      department: '',
      transferHistory: []
    };
    activeIssues.unshift(issue);
  });
  saveToFirebase();
  renderKPIs();
  updateChart();
  renderList();
  showToast("📢 تم الإرسال", `تم إرسال التعميم إلى ${targets.length} مؤسسة`);
  document.getElementById('broadcast-title').value = '';
  document.getElementById('broadcast-content').value = '';
}

