// ============================================
// 🎥 نظام الاجتماعات (WebRTC)
// ملف موحّد - يمكن تقسيمه لاحقاً
// ============================================

// 🎥 VIDEO MEETING SYSTEM (WebRTC + Firebase signaling)
// 🏗️ البنية:
//  - كل غرفة لقاء تُخزَّن في عقدة Firebase: meet/{roomId}/{participants,offer,answer,candidates,chat,share}
//  - تبادل الإشارات (offer/answer/ICE candidates) عبر Firebase لتأسيس WebRTC P2P
//  - البثّ المرئي والصوتي يجري مباشرة بين المتصفّحين (لا يمر عبر الخادم)
//  - دعم مشاركة الشاشة عبر getDisplayMedia (مع استبدال الـ track الحالي)
const meet = {
  roomId: null,           // معرّف الغرفة الحالية
  userId: null,           // معرّف المستخدم الفريد في هذه الغرفة
  userName: '',           // اسم العرض
  peerConn: null,          // RTCPeerConnection
  localStream: null,       // MediaStream للكاميرا/المايك
  screenStream: null,      // MediaStream لمشاركة الشاشة (مؤقت)
  remoteStreams: new Map(),// Map<userId, {stream, name, videoOff, audioOff, handRaised, micLocked}>
  dataChannels: new Map(), // Map<userId, RTCDataChannel> (لإشارات mute/unmute + شات)
  isAudioMuted: false,
  isVideoMuted: false,
  isScreenSharing: false,
  isChatOpen: false,
  isHandRaised: false,     // 🙋 حالة رفع اليد
  isHandQueueOpen: false,  // 🙋 حالة لوحة المتدخلين
  isMicLockedByAdmin: false, // 🔒 هل المايك مقفل من الإدارة؟
  isFullscreen: false,    // 🖥️ وضع ملء الشاشة
  isParticipantsOpen: false, // 👥 حالة نافذة المنتسبين
  isDmOpen: false,         // 💌 حالة نافذة الدردشة الخاصة
  activeDmPeer: null,      // معرّف الشخص الذي أدردش معه
  unreadChat: 0,           // 💬 عدد الرسائل غير المقروءة في الشات العام
  unreadDm: 0,             // 💌 عدد الرسائل الخاصة غير المقروءة
  handRaisedList: new Map(),// Map<userId, {name, time}> لقائمة طلبات التدخل
  dmThreads: new Map(),    // Map<peerUid, [{from, text, time, isMe}]> الرسائل الخاصة لكل محادثة
  dmUnread: new Map(),     // Map<peerUid, number> عدد الرسائل غير المقروءة لكل محادثة
  groupMessages: [],       // 💬 مصفوفة الرسائل الجماعية (الشات الجديد)
  firebaseListeners: [],    // للمراقبة والتظيف عند مغادرة الغرفة
  rtcConfig: {             // STUN servers المجانية لاكتشاف الـ IP
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  }
};

function _meetUserName() {
  // اسم العرض: اسم المستخدم الحالي بحسب دوره
  if (currentRole === 'directorate') return 'المديرية';
  if (currentRole === 'department') {
    const d = departments.find(x => x.id === currentDepartment);
    return d ? d.name : 'مصلحة';
  }
  return getCenterName() || 'مستخدم';
}

function initMeetPage() {
  // عند فتح الصفحة لأول مرة، اشترك بقائمة الغرف النشطة + اسم العرض
  meet.userName = _meetUserName();
  // ضبط اسم افتراضي للغرفة
  const input = document.getElementById('meetRoomInput');
  if (input && !input.value) input.value = 'room-' + Date.now().toString(36).slice(-4);
  listenToMeetRoomsList();
  // إظهار/إخفاء بطاقة الدعوة للمديرية + صندوق الوارد للمدعوّين
  const inviteCard = document.getElementById('meetInviteCard');
  const inboxCard = document.getElementById('meetInboxCard');
  if (currentRole === 'directorate') {
    if (inviteCard) inviteCard.style.display = 'block';
    if (inboxCard) inboxCard.style.display = 'none';
  } else {
    if (inviteCard) inviteCard.style.display = 'none';
    if (inboxCard) inboxCard.style.display = 'block';
    // أعد إرفاق المستمع فقط إذا لم يكن مرفقاً من initApp
    if (!_meetInvitesListener) listenToMeetInvitations();
  }
  // إذا كنّا داخل غرفة، نُعيد رسم الشاشة
  if (meet.roomId) renderMeetActive();
}



// 📣 نظام الدعوات: ترسل المديرية دعوة للاجتماع إلى المراكز/المصالح
// البنية في Firebase: meetInvites/{inviteId} = { roomId, roomName, from, to, note, time, senderRole }
// المرسل: المديرية (currentRole === 'directorate')
// المستقبل: المراكز (centers) والمصالح (departments)
function getMyTargetKey() {
  // معرّف الجهة الحالية لاستقبال الدعوات (المركز/المصلحة)
  if (currentRole === 'center') return 'c_' + getCenterName();
  if (currentRole === 'department') {
    const d = departments.find(x => x.id === currentDepartment);
    return 'd_' + (d ? d.id : currentDepartment);
  }
  return null;
}

function _meetInviteMatches(invite) {
  if (!invite || !invite.to) return false;
  const myKey = getMyTargetKey();
  if (!myKey) return false;
  // "all" يستهدف الجميع
  if (invite.to === 'all' || invite.to === 'everyone') return true;
  // كل قائمة محددة (مصفوفة) أو قيمة واحدة
  const targets = Array.isArray(invite.to) ? invite.to : [invite.to];
  return targets.includes(myKey) || targets.includes(currentRole);
}

async function sendMeetInvitation() {
  if (!meet.roomId) {
    showToast('⚠️ تنبيه', 'يجب أن تكون داخل غرفة أولاً قبل إرسال دعوة');
    return;
  }
  const target = document.getElementById('meetInviteTarget')?.value || 'all';
  const note = (document.getElementById('meetInviteNote')?.value || '').trim();
  // قائمة المراكز/المصالح المستهدفة
  const targets = [];
  if (target === 'all' || target === 'everyone') {
    targets.push('all');
    INSTITUTIONS_DATA.forEach(inst => targets.push('c_' + inst.name));
    departments.forEach(d => targets.push('d_' + d.id));
  } else if (target === 'centers') {
    INSTITUTIONS_DATA.filter(i => i.type === 'center').forEach(inst => targets.push('c_' + inst.name));
  } else if (target === 'private') {
    INSTITUTIONS_DATA.filter(i => i.type === 'private').forEach(inst => targets.push('c_' + inst.name));
  } else if (target === 'departments') {
    departments.forEach(d => targets.push('d_' + d.id));
  }
  const roomName = document.getElementById('meetRoomInput')?.value || meet.roomId;
  const inviteData = {
    roomId: meet.roomId,
    roomName: roomName,
    from: meet.userName,
    senderRole: 'directorate',
    to: targets,
    note: note,
    time: firebase.database.ServerValue.TIMESTAMP
  };
  const ref = await database.ref('meetInvites').push(inviteData);
  showToast('📣 تم إرسال الدعوة', 'تم إرسال الدعوة إلى ' + (target === 'all' ? 'الجميع' : (target === 'centers' ? 'المراكز والمعاهد' : (target === 'private' ? 'المدارس الخاصة' : 'المصالح'))));
  // عرض الدعوة في قائمة الدعوات المرسلة
  const list = document.getElementById('meetInvitesSentList');
  if (list) {
    const div = document.createElement('div');
    div.style.cssText = 'padding:10px 12px; background:var(--bg-card-2); border-radius:8px; margin-top:8px; font-size:13px; border-right:3px solid var(--algeria-green);';
    div.innerHTML = `<div style="font-weight:800; color:var(--algeria-green);"><i class="fa-solid fa-check-circle"></i> تم الإرسال</div><div style="color:var(--text-dim); margin-top:2px;">${escapeHtml(target === 'all' ? 'الجميع' : (target === 'centers' ? 'المراكز والمعاهد' : (target === 'private' ? 'المدارس الخاصة' : 'المصالح')))} · ${escapeHtml(new Date().toLocaleTimeString('ar-DZ', {hour:'2-digit', minute:'2-digit'}))}</div>`;
    list.prepend(div);
  }
  // مسح حقل الملاحظة
  if (document.getElementById('meetInviteNote')) document.getElementById('meetInviteNote').value = '';
}

let _meetInvitesListener = null;
function listenToMeetInvitations() {
  if (_meetInvitesListener) { _meetInvitesListener.off(); _meetInvitesListener = null; }
  const ref = database.ref('meetInvites').orderByChild('time').limitToLast(20);
  _meetInvitesListener = ref;
  ref.on('value', (snapshot) => {
    const all = snapshot.val() || {};
    const invites = Object.keys(all).map(id => ({ id, ...all[id] })).filter(_meetInviteMatches);
    // ترتيب: الأحدث أولاً
    invites.sort((a, b) => (b.time || 0) - (a.time || 0));
    renderMeetInbox(invites);
  });
}

function renderMeetInbox(invites) {
  const list = document.getElementById('meetInboxList');
  const count = document.getElementById('meetInboxCount');
  if (!list) return;
  if (!invites || invites.length === 0) {
    list.innerHTML = '<div class="empty-msg" style="padding:20px; font-size:15px;">لا توجد دعوات حالياً</div>';
    if (count) count.style.display = 'none';
    return;
  }
  if (count) {
    count.style.display = 'inline-block';
    count.textContent = invites.length;
  }
  list.innerHTML = invites.map(inv => {
    const timeAgo = inv.time ? getTimeAgo(inv.time) : 'الآن';
    const noteHtml = inv.note ? `<div class="mic-note"><i class="fa-solid fa-quote-right"></i> ${escapeHtml(inv.note)}</div>` : '';
    return `<div class="meet-invite-card">
      <i class="fa-solid fa-video" style="font-size:28px; color:var(--algeria-green);"></i>
      <div class="mic-info">
        <div class="mic-title">${escapeHtml(inv.roomName || inv.roomId)}</div>
        <div class="mic-meta">📍 من ${escapeHtml(inv.from || 'المديرية')} · ${timeAgo}</div>
        ${noteHtml}
      </div>
      <div class="mic-actions">
        <button class="btn-mini" onclick="joinMeetFromInvite('${escapeHtml(inv.roomId)}','${escapeHtml(inv.roomName || inv.roomId)}')" style="background:var(--grad-brand); color:#fff; border-color:transparent;"><i class="fa-solid fa-right-to-bracket"></i> انضمام مباشر</button>
        <button class="btn-mini" onclick="dismissMeetInvite('${escapeHtml(inv.id)}')"><i class="fa-solid fa-xmark\"></i></button>
      </div>
    </div>`;
  }).join('');
  // 🟢 تشغيل تنبيه صوتي + مرئي عند وصول أول دعوة
  if (invites.length > 0 && !_meetInboxNotified) {
    _meetInboxNotified = true;
    playMeetInviteAlert();
    showFloatingMeetInvite(invites[0]);
  }
  // إذا أصبحت فارغة بعد الحذف، اسمح بإعادة التنبيه
  if (invites.length === 0) _meetInboxNotified = false;
}

let _meetInboxNotified = false;
function dismissMeetInvite(id) {
  if (!id) return;
  database.ref('meetInvites/' + id).remove();
  // إخفاء الإشعار العائم إذا كان معروضاً
  const banner = document.getElementById('meetFloatingInvite');
  if (banner) banner.remove();
  // إيقاف الرنة المتكررة
  stopAllMeetRingtones();
}

function playMeetInviteAlert() {
  // صوت تنبيه مميز (3 نغمات متتالية)
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [0, 0.18, 0.36].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = [880, 1100, 1320][i];
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.25, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    });
  } catch(e) { console.log('Audio alert failed:', e); }
}

function showFloatingMeetInvite(invite) {
  // إزالة أي إشعار سابق
  const existing = document.getElementById('meetFloatingInvite');
  if (existing) existing.remove();
  if (!invite) return;
  const noteHtml = invite.note ? `<div style="font-size:13px; opacity:0.92; margin-top:4px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.18);"><i class="fa-solid fa-quote-right"></i> ${escapeHtml(invite.note)}</div>` : '';
  const div = document.createElement('div');
  div.id = 'meetFloatingInvite';
  // 🆕 تنبيه أحمر متكرر بدلاً من الأخضر
  div.className = 'meet-incoming-banner meet-incoming-banner-red';
  div.innerHTML = `
    <div class="mib-icon"><i class="fa-solid fa-video"></i></div>
    <div class="mib-body">
      <div class="mib-title"><span class="live-dot"></span> دعوة اجتماع جديدة</div>
      <div class="mib-sub">
        <strong>${escapeHtml(invite.roomName || invite.roomId)}</strong> — من ${escapeHtml(invite.from || 'المديرية')}
        ${noteHtml}
      </div>
    </div>
    <div class="mib-actions">
      <button class="mib-btn" onclick="joinMeetFromInvite('${escapeHtml(invite.roomId)}','${escapeHtml(invite.roomName || invite.roomId)}')">
        <i class="fa-solid fa-right-to-bracket"></i> انضمام
      </button>
      <button class="mib-btn stop-ringtone-btn" onclick="stopAllMeetRingtones(); this.innerHTML='<i class=\'fa-solid fa-volume-xmark\'></i> تم الكتم';" title="إيقاف الصوت">
        <i class="fa-solid fa-volume-high"></i> كتم
      </button>
      <button class="mib-btn dismiss" onclick="document.getElementById('meetFloatingInvite')?.remove(); stopAllMeetRingtones();">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  document.body.appendChild(div);
  // 🆕 تشغيل رنة المسنجر المتكررة (مع زر إيقاف يدوي)
  startInviteNotifRingtone();
  // إزالة تلقائية بعد 90 ثانية (وقت أطول مع الرنة المتكررة)
  setTimeout(() => { if (document.getElementById('meetFloatingInvite')) { document.getElementById('meetFloatingInvite').remove(); stopAllMeetRingtones(); } }, 90000);
}

// 🆕 الانضمام المباشر من الإشعار العائم (للمراكز/المصالح/المعاهد)
function joinMeetFromInvite(roomId, roomName) {
  // إغلاق الإشعار العائم وإيقاف الرنة فوراً
  const banner = document.getElementById('meetFloatingInvite');
  if (banner) banner.remove();
  stopAllMeetRingtones();
  // تأكد من الانتقال إلى صفحة قاعة الاجتماعات أولاً
  const meetPage = document.getElementById('page-meet');
  const isOnMeetPage = meetPage && !meetPage.classList.contains('hidden');
  if (!isOnMeetPage) {
    // انتقل إلى صفحة قاعة الاجتماعات
    switchTab('meet');
  }
  // ضع اسم الغرفة في حقل الإدخال (لإعلام المستخدم)
  setTimeout(() => {
    const input = document.getElementById('meetRoomInput');
    if (input) input.value = roomName || roomId;
    // انضم للغرفة مباشرة
    joinMeetRoom(roomId, roomName);
  }, isOnMeetPage ? 50 : 300);
}



// 📋 قائمة الغرف النشطة (تعرض الغرف الموجودة في Firebase)
function listenToMeetRoomsList() {
  // تنظيف أي مستمع سابق لتفادي التكرار
  if (meet._roomsListRef) { meet._roomsListRef.off(); meet._roomsListRef = null; }
  const ref = database.ref('meet');
  meet._roomsListRef = ref;
  ref.on('value', (snapshot) => {
    const all = snapshot.val() || {};
    renderMeetRoomsList(all);
  });
}

function renderMeetRoomsList(allRooms) {
  const list = document.getElementById('meetStatusList');
  if (!list) return;
  const now = Date.now();
  const STALE_MS = 5 * 60 * 1000; // نعتبر الغرفة منتهية إذا لم يتجدد lastSeen منذ 5 دقائق
  const entries = Object.keys(allRooms).map(roomId => {
    const room = allRooms[roomId] || {};
    const participants = room.participants || {};
    const partCount = Object.keys(participants).length;
    const lastSeen = room.lastSeen || 0;
    const status = lastSeen > now - STALE_MS ? (partCount > 0 ? 'live' : 'waiting') : 'ended';
    return { roomId, name: room.name || roomId, partCount, lastSeen, status };
  });
  // ترتيب: النشطة أولاً ثم المنتظرة ثم المنتهية
  const order = { live: 0, waiting: 1, ended: 2 };
  entries.sort((a, b) => order[a.status] - order[b.status] || b.lastSeen - a.lastSeen);
  // عدد الغرف المنتهية (لإظهار زر "حذف الكل")
  const endedCount = entries.filter(e => e.status === 'ended').length;
  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-msg" style="padding:20px; font-size:15px;">لا توجد غرف نشطة حالياً</div>';
    return;
  }
  // بناء HTML مع رأس يحتوي زر "حذف الكل" للغرف المنتهية
  let html = '';
  if (endedCount > 0) {
    html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;margin-bottom:8px;background:rgba(224,27,63,0.06);border:1px solid rgba(224,27,63,0.18);border-radius:10px;">
      <span style="font-size:13px;font-weight:700;color:var(--text-dim);"><i class="fa-solid fa-broom" style="color:var(--algeria-red);margin-left:6px;"></i> ${endedCount} غرفة منتهية</span>
      <button onclick="deleteAllEndedMeetRooms()" style="padding:6px 12px;border-radius:8px;background:var(--grad-red);color:#fff;border:none;font-weight:800;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit;transition:var(--transition);" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
        <i class="fa-solid fa-trash-can"></i> حذف الكل
      </button>
    </div>`;
  }
  html += entries.map(e => {
    const pillClass = e.status === 'live' ? 'live' : (e.status === 'waiting' ? 'waiting' : 'ended');
    const pillText = e.status === 'live' ? 'مباشرة' : (e.status === 'waiting' ? 'بانتظار' : 'انتهت');
    const canJoin = e.status !== 'ended';
    // زر حذف يظهر دائماً (لجميع الأدوار) — ليتمكن أي مستخدم من تنظيف القائمة
    const deleteBtn = `<button class="btn-mini" onclick="event.stopPropagation(); deleteMeetRoom('${escapeHtml(e.roomId)}', '${escapeHtml(e.name)}')" style="border-color:var(--algeria-red);color:var(--algeria-red);padding:6px 10px;" title="حذف هذه الغرفة"><i class="fa-solid fa-trash-can"></i></button>`;
    return `<div class="meet-status-item">
      <div class="msi-info">
        <div class="msi-name">${escapeHtml(e.name)}</div>
        <div class="msi-meta">👥 ${e.partCount} مشارك · ${e.status === 'ended' ? 'منتهية' : 'منذ ' + getTimeAgo(e.lastSeen)}</div>
      </div>
      <span class="msi-pill ${pillClass}">${pillText}</span>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        ${canJoin ? `<button class="btn-mini" onclick="joinMeetRoom('${escapeHtml(e.roomId)}')"><i class="fa-solid fa-right-to-bracket"></i> دخول</button>` : ''}
        ${deleteBtn}
      </div>
    </div>`;
  }).join('');
  list.innerHTML = html;
}

// 🆕 حذف غرفة واحدة من Firebase (متاحة لجميع الأدوار)
function deleteMeetRoom(roomId, roomName) {
  if (!roomId) return;
  const displayName = roomName || roomId;
  if (!confirm(`هل تريد حذف الغرفة "${displayName}" نهائياً؟\n\nسيتم حذف جميع الرسائل والبيانات المرتبطة بها.`)) return;
  // لا نسمح بحذف غرفة نشطة (فيها مشاركون) إلا بعد تحذير
  const roomRef = database.ref('meet/' + roomId);
  roomRef.once('value', snap => {
    const room = snap.val() || {};
    const partCount = Object.keys(room.participants || {}).length;
    if (partCount > 0) {
      if (!confirm(`⚠️ تحذير: الغرفة نشطة ويوجد بها ${partCount} مشارك(ين).\n\nهل أنت متأكد من حذفها؟`)) return;
    }
    // حذف الغرفة بالكامل + الدعوات المرتبطة بها
    Promise.all([
      roomRef.remove(),
      database.ref('meetInvites').orderByChild('roomId').equalTo(roomId).once('value', invitesSnap => {
        const updates = {};
        const invites = invitesSnap.val() || {};
        Object.keys(invites).forEach(invId => { updates['meetInvites/' + invId] = null; });
        if (Object.keys(updates).length > 0) database.ref().update(updates);
      })
    ]).then(() => {
      showToast('🗑️ تم الحذف', `تم حذف الغرفة "${displayName}" بنجاح`);
      console.log('[meet] room deleted:', roomId);
    }).catch(err => {
      console.error('delete room error:', err);
      showToast('⚠️ خطأ', 'تعذّر حذف الغرفة: ' + err.message);
    });
  });
}

// 🆕 حذف جميع الغرف المنتهية دفعة واحدة
function deleteAllEndedMeetRooms() {
  const list = document.getElementById('meetStatusList');
  if (!list) return;
  // نجمع الغرف المنتهية من الحالة المعروضة
  const now = Date.now();
  const STALE_MS = 5 * 60 * 1000;
  database.ref('meet').once('value', snap => {
    const all = snap.val() || {};
    const endedRoomIds = Object.keys(all).filter(roomId => {
      const room = all[roomId] || {};
      const lastSeen = room.lastSeen || 0;
      const partCount = Object.keys(room.participants || {}).length;
      return lastSeen <= now - STALE_MS && partCount === 0;
    });
    if (endedRoomIds.length === 0) {
      showToast('ℹ️ لا شيء للحذف', 'لا توجد غرف منتهية');
      return;
    }
    if (!confirm(`هل تريد حذف ${endedRoomIds.length} غرفة منتهية نهائياً؟\n\nهذا الإجراء لا يمكن التراجع عنه.`)) return;
    // حذف متزامن
    const updates = {};
    endedRoomIds.forEach(id => { updates['meet/' + id] = null; });
    database.ref().update(updates).then(() => {
      showToast('🗑️ تم الحذف', `تم حذف ${endedRoomIds.length} غرفة منتهية`);
      console.log('[meet] deleted', endedRoomIds.length, 'ended rooms');
    }).catch(err => {
      console.error('delete all ended error:', err);
      showToast('⚠️ خطأ', 'تعذّر حذف بعض الغرف');
    });
  });
}



// 🚪 إنشاء أو الانضمام لغرفة
function createOrJoinMeetRoom() {
  const input = document.getElementById('meetRoomInput');
  const raw = (input?.value || '').trim();
  if (!raw) { showToast('⚠️ تنبيه', 'يرجى إدخال اسم للغرفة'); return; }
  // تنظيف الاسم لاستخدامه كمفتاح في Firebase (يُسمح بحروف لاتينية وأرقام و - _ فقط)
  const roomId = 'r_' + raw.toLowerCase().replace(/[^a-z0-9_\-]/g, '-').slice(0, 40);
  joinMeetRoom(roomId, raw);
}

async function joinMeetRoom(roomId, displayName) {
  if (meet.roomId === roomId) {
    // أصلاً داخل هذه الغرفة
    return;
  }
  // مغادرة أي غرفة سابقة
  if (meet.roomId) leaveMeetRoom();

  // 🎥 طلب إذن الكاميرا والمايكروفون (اختياري)
  // نجعل الكاميرا والمايك غير إجباريين: إذا رفض المستخدم أو لم تتوفر
  // أجهزة، يكمل المستخدم دخوله للغرفة كـ "مستمع فقط" ويستطيع رؤية ومشاركة
  // شاشة الآخرين واستقبال الشات.
  meet.localStream = null;
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // نطلب الكاميرا والمايك بشكل منفصل حتى لو فشلت إحداها تكمل الأخرى
      let combinedStream = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        combinedStream = stream;
      } catch (e1) {
        // محاولة الحصول على الفيديو فقط ثم الصوت فقط
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
          combinedStream = videoStream;
        } catch (e2) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            combinedStream = audioStream;
          } catch (e3) {
            // لا يوجد كاميرا ولا مايك — ندخل كمراقب فقط
            combinedStream = null;
          }
        }
      }
      meet.localStream = combinedStream;
    }
  } catch (err) {
    console.warn('Media access not available:', err);
    meet.localStream = null;
  }

  meet.roomId = roomId;
  // معرّف فريد لكل مستخدم داخل الغرفة (تغيير مع كل دخول لتفادي التعارض)
  meet.userId = 'u_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  if (displayName) {
    // خزّن الاسم المعروض داخل الغرفة
    const roomRef = database.ref('meet/' + roomId);
    roomRef.once('value', snap => {
      if (!snap.val() || !snap.val().name) roomRef.update({ name: displayName });
    });
  }
  // 🆕 قفل المايكروفون افتراضياً عند الدخول من المراكز/المصالح/المعاهد
  // (المديرية فقط تدخل بالمايك مفتوح)
  const shouldMuteOnJoin = (currentRole === 'center' || currentRole === 'department');
  if (shouldMuteOnJoin && meet.localStream) {
    meet.isAudioMuted = true;
    meet.localStream.getAudioTracks().forEach(t => { t.enabled = false; });
  } else {
    meet.isAudioMuted = false;
  }
  // تحديث الحالة الأولية في Firebase
  await database.ref('meet/' + roomId + '/participants/' + meet.userId).set({
    name: meet.userName,
    joinedAt: firebase.database.ServerValue.TIMESTAMP,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
    audioMuted: shouldMuteOnJoin,  // 🆕 يعكس الحالة الفعلية للمايك عند الدخول
    videoMuted: false,
    screenSharing: false,
    handRaised: false,
    micLockedByAdmin: false
  });
  await database.ref('meet/' + roomId + '/lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
  if (!displayName) {
    database.ref('meet/' + roomId + '/name').once('value', snap => {
      if (snap.val() && document.getElementById('meetRoomInput')) {
        document.getElementById('meetRoomInput').value = snap.val();
      }
    });
  } else {
    document.getElementById('meetRoomInput').value = displayName;
  }
  // عرض شاشة المكالمة النشطة
  renderMeetActive();
  // تحديث زر المايك بعد الرسم ليعكس الحالة (مقفل/مفتوح)
  updateLocalAudioBtn();
  // إنشاء RTCPeerConnection وبدء الاستماع لبقيّة المشاركين
  setupPeerConnection();
  listenToRoomParticipants();
  listenToMeetSignaling();
  // إظهار زر "قائمة المتدخلين" للمديرية فقط
  if (currentRole === 'directorate') {
    const handBtn = document.getElementById('meetToggleHands');
    if (handBtn) handBtn.style.display = 'inline-flex';
  }
  // تحديث lastSeen دورياً كي لا تُحذف الغرفة
  if (meet._heartbeat) clearInterval(meet._heartbeat);
  // 🆕 تحسين الاستهلاك: 60 ثانية بدلاً من 20 ثانية (يقلل writes بـ 66%)
  meet._heartbeat = setInterval(() => {
    if (!meet.roomId) { clearInterval(meet._heartbeat); return; }
    // تحديث فقط إذا كانت الغرفة لا تزال نشطة (مشاركين > 0)
    database.ref('meet/' + meet.roomId + '/participants').once('value', partSnap => {
      const parts = partSnap.val() || {};
      if (Object.keys(parts).length === 0) {
        // لا أحد في الغرفة — أوقف الـ heartbeat لتوفير عمليات
        clearInterval(meet._heartbeat);
        meet._heartbeat = null;
        return;
      }
      database.ref('meet/' + meet.roomId + '/participants/' + meet.userId + '/lastSeen')
        .set(firebase.database.ServerValue.TIMESTAMP);
      database.ref('meet/' + meet.roomId + '/lastSeen')
        .set(firebase.database.ServerValue.TIMESTAMP);
    });
  }, 60000);  // 🆕 كان 20000 (20 ثانية) — الآن 60000 (60 ثانية)
  // إشعار مناسب بحسب الحالة
  if (meet.localStream) {
    if (shouldMuteOnJoin) {
      showToast('🎥 انضممت للغرفة', 'المايكروفون مقفل افتراضياً — اضغط على زر 🎤 لفتحه عند الرغبة');
    } else {
      showToast('🎥 انضممت للغرفة', 'تم الانضمام بالصوت والصورة. شارك اسم الغرفة مع زملائك!');
    }
  } else {
    showToast('👁️ انضممت كمراقب', 'لا توجد كاميرا/مايك في جهازك — ستشاهد وتسمع الآخرين فقط.');
  }
  console.log('[meet] joined room', roomId, 'as', meet.userId, shouldMuteOnJoin ? '(mic auto-muted)' : '');
}



// 🖼️ رسم واجهة المكالمة النشطة
function renderMeetActive() {
  const stage = document.getElementById('meetStage');
  if (!stage) return;
  const roomName = document.getElementById('meetRoomInput')?.value || meet.roomId;
  // تنظيف المحتوى السابق (مع الحفاظ على أزرار)
  stage.innerHTML = `
    <div class="meet-active">
      <div class="meet-room-head">
        <div class="room-title"><i class="fa-solid fa-video"></i> ${escapeHtml(roomName)}</div>
        <div class="room-meta" id="meetRoomMeta">رمز الغرفة: ${escapeHtml(meet.roomId)} · أنت: ${escapeHtml(meet.userName)}</div>
      </div>
      <div class="meet-videos" id="meetVideos">
        <div class="meet-video-tile" id="meetLocalTile">
          <video id="meetLocalVideo" autoplay playsinline muted></video>
          <div class="tile-off" id="meetLocalOff" style="display:none;"><i class="fa-solid fa-user-slash"></i><div style="font-size:13px;">لا توجد كاميرا/مايك</div></div>
          <div class="tile-name" id="meetLocalName"><span class="dot"></span> ${escapeHtml(meet.userName)} (أنت)</div>
        </div>
      </div>
      <div class="meet-controls">
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn" id="meetToggleAudio" onclick="toggleMeetAudio()" title="كتم/إلغاء كتم المايك"><i class="fa-solid fa-microphone"></i></button>
          <div class="meet-ctrl-label">المايك</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn" id="meetToggleVideo" onclick="toggleMeetVideo()" title="إخفاء/إظهار الكاميرا"><i class="fa-solid fa-video"></i></button>
          <div class="meet-ctrl-label">الكاميرا</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn" id="meetToggleScreen" onclick="toggleMeetScreen()" title="مشاركة الشاشة"><i class="fa-solid fa-desktop"></i></button>
          <div class="meet-ctrl-label">الشاشة</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn" id="meetRaiseHand" onclick="toggleRaiseHand()" title="رفع اليد لطلب الكلمة"><i class="fa-solid fa-hand"></i></button>
          <div class="meet-ctrl-label">طلب</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn active" id="meetToggleChat" onclick="toggleMeetChat()" title="فتح/إغلاق الشات الجانبي"><i class="fa-solid fa-comments"></i></button>
          <span class="chat-badge" id="meetChatBadge">0</span>
          <div class="meet-ctrl-label">الشات</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn" id="meetToggleParticipants" onclick="toggleParticipantsPanel()" title="قائمة المنتسبين للاجتماع" style="display:none;"><i class="fa-solid fa-users"></i></button>
          <div class="meet-ctrl-label">المنتسبون</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn" id="meetToggleHands" onclick="toggleHandQueuePanel()" title="قائمة طلبات التدخل" style="display:none;"><i class="fa-solid fa-list"></i></button>
          <div class="meet-ctrl-label">المتدخلون</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn" id="meetDmBtn" onclick="openDmInbox()" title="الرسائل الخاصة" style="display:none; position:relative;">
            <i class="fa-solid fa-envelope"></i>
            <span class="chat-badge" id="meetDmBadge">0</span>
          </button>
          <div class="meet-ctrl-label">الرسائل</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn" id="meetFullscreen" onclick="toggleMeetFullscreen()" title="ملء الشاشة"><i class="fa-solid fa-expand"></i></button>
          <div class="meet-ctrl-label">ملء</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn" id="meetCopyId" onclick="copyMeetRoomId()" title="نسخ رمز الغرفة"><i class="fa-solid fa-share-nodes"></i></button>
          <div class="meet-ctrl-label">دعوة</div>
        </div>
        <div class="meet-ctrl-group" id="meetEndAllGroup" style="display:none;">
          <button class="meet-ctrl-btn danger" onclick="forceEndMeetForAll()" title="إنهاء الاجتماع للجميع" style="background: linear-gradient(135deg, #8B0000, #DC143C); border: 2px solid #fff;"><i class="fa-solid fa-power-off"></i></button>
          <div class="meet-ctrl-label">إنهاء للكل</div>
        </div>
        <div class="meet-ctrl-group">
          <button class="meet-ctrl-btn danger" onclick="leaveMeetRoom()" title="إنهاء المكالمة"><i class="fa-solid fa-phone-slash"></i></button>
          <div class="meet-ctrl-label">إنهاء</div>
        </div>
      </div>
      <div class="meet-side-panel" id="meetSidePanel" style="display:none !important;">
        <div class="panel-head">
          <span><i class="fa-solid fa-comments"></i> شات الغرفة</span>
          <button onclick="toggleMeetChat()" title="إغلاق"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="chat-msgs" id="meetChatMsgs"></div>
        <div class="chat-input">
          <input type="text" id="meetChatInput" placeholder="رسالة..." onkeydown="if(event.key==='Enter')sendMeetChat()">
          <button onclick="sendMeetChat()"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
      </div>

      <!-- 🙋 قائمة طلبات التدخل (تظهر للمديرية فقط) -->
      <div class="meet-hand-queue-panel" id="meetHandQueuePanel">
        <div class="panel-head">
          <span><i class="fa-solid fa-hand"></i> طلبات التدخل</span>
          <button onclick="toggleHandQueuePanel()" title="إغلاق"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="hand-queue-list" id="meetHandQueueList">
          <div class="meet-hand-queue-empty">لا توجد طلبات حالياً</div>
        </div>
      </div>

      <!-- 👥 قائمة المنتسبين للاجتماع (للمديرية) -->
      <div class="meet-participants-panel" id="meetParticipantsPanel">
        <div class="panel-head">
          <span><i class="fa-solid fa-users"></i> المنتسبون <span id="meetParticipantsCount" style="background:rgba(0,122,61,0.18);color:var(--algeria-green);font-size:12px;padding:2px 10px;border-radius:12px;margin-right:6px;">0</span></span>
          <button onclick="toggleParticipantsPanel()" title="إغلاق"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="participants-list" id="meetParticipantsList">
          <div class="participants-empty">لا يوجد منتسبون بعد</div>
        </div>
      </div>

      <!-- 💌 نافذة الدردشة الخاصة (تفتح عند النقر على زر الرسالة بجانب اسم) -->
      <div class="meet-dm-panel" id="meetDmPanel">
        <div class="panel-head">
          <div class="dm-avatar" id="meetDmAvatar">م</div>
          <div class="dm-title">
            <strong id="meetDmName">—</strong>
            <small><i class="fa-solid fa-circle" style="font-size:7px;color:var(--algeria-green);"></i> متصل الآن</small>
          </div>
          <button onclick="closeDmPanel()" title="إغلاق"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="dm-msgs" id="meetDmMsgs"></div>
        <div class="dm-input">
          <input type="text" id="meetDmInput" placeholder="رسالة خاصة..." onkeydown="if(event.key==='Enter')sendMeetDm()">
          <button onclick="sendMeetDm()" title="إرسال"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
      </div>
    </div>
  `;
  // ربط الفيديو المحلي
  const localVid = document.getElementById('meetLocalVideo');
  const localOff = document.getElementById('meetLocalOff');
  if (meet.localStream) {
    if (localVid) {
      localVid.srcObject = meet.localStream;
      localVid.muted = true; // صامت دائماً لتفادي الصدى
    }
    if (localOff) localOff.style.display = 'none';
  } else {
    // لا توجد كاميرا/مايك — نظهر placeholder
    if (localVid) localVid.style.display = 'none';
    if (localOff) {
      localOff.style.display = 'flex';
      localOff.innerHTML = '<i class="fa-solid fa-user-slash"></i><div style="font-size:13px;">دخلت كمراقب (لا توجد كاميرا/مايك)</div>';
    }
  }
  // تعطيل أزرار الصوت/الفيديو إذا لم تتوفر
  if (!meet.localStream) {
    const audioTracks = meet.localStream ? meet.localStream.getAudioTracks() : [];
    const videoTracks = meet.localStream ? meet.localStream.getVideoTracks() : [];
    if (audioTracks.length === 0) {
      const audioBtn = document.getElementById('meetToggleAudio');
      if (audioBtn) { audioBtn.disabled = true; audioBtn.style.opacity = '0.4'; audioBtn.title = 'المايك غير متوفر'; }
    }
    if (videoTracks.length === 0) {
      const videoBtn = document.getElementById('meetToggleVideo');
      if (videoBtn) { videoBtn.disabled = true; videoBtn.style.opacity = '0.4'; videoBtn.title = 'الكاميرا غير متوفرة'; }
    }
  }
  // إظهار كل مشارك موجود مسبقاً (سيتم لاحقاً عبر المستمع)
  renderAllRemoteTiles();
  // إظهار أزرار المديرية الحصرية
  if (currentRole === 'directorate') {
    const handBtn = document.getElementById('meetToggleHands');
    if (handBtn) handBtn.style.display = 'inline-flex';
    const participantsBtn = document.getElementById('meetToggleParticipants');
    if (participantsBtn) participantsBtn.style.display = 'inline-flex';
    const dmBtn = document.getElementById('meetDmBtn');
    if (dmBtn) dmBtn.style.display = 'inline-flex';
    const endAllGroup = document.getElementById('meetEndAllGroup');
    if (endAllGroup) endAllGroup.style.display = 'inline-flex';
  }
}

function renderAllRemoteTiles() {
  // عرض كل remoteStreams الحالية على شكل بلاطات
  const videos = document.getElementById('meetVideos');
  if (!videos) return;
  // البلاط المحلي
  let localTile = document.getElementById('meetLocalTile');
  // البلاطات البعيدة
  for (const [uid, info] of meet.remoteStreams.entries()) {
    let tile = document.getElementById('meet-tile-' + uid);
    if (!tile) {
      tile = document.createElement('div');
      tile.id = 'meet-tile-' + uid;
      tile.className = 'meet-video-tile' + (info.screenSharing ? ' screen-share' : '');
      // 🔒 زر القفل (يظهر للمديرية فقط) في أعلى يمين كل بلاط
      const showLockBtn = currentRole === 'directorate';
      tile.innerHTML = `
        <video id="meet-video-${uid}" autoplay playsinline></video>
        <div class="tile-name ${info.audioMuted || info.micLockedByAdmin ? 'muted' : ''}" id="meet-name-${uid}"><span class="dot"></span> ${escapeHtml(info.name || 'مشارك')}</div>
        <div class="tile-actions"><span title="مشاركة شاشة" style="display:${info.screenSharing ? 'flex' : 'none'}"><i class="fa-solid fa-display"></i></span></div>
        ${showLockBtn ? `<button class="meet-tile-lock-btn ${info.micLockedByAdmin ? 'locked' : ''}" id="meet-lock-btn-${uid}" onclick="event.stopPropagation(); toggleRemoteMicLock('${uid}')" title="${info.micLockedByAdmin ? 'إلغاء قفل المايك' : 'قفل المايك'}"><i class="fa-solid ${info.micLockedByAdmin ? 'fa-lock' : 'fa-microphone'}"></i></button>` : ''}
      `;
      videos.appendChild(tile);
    }
    const vid = document.getElementById('meet-video-' + uid);
    if (vid && vid.srcObject !== info.stream) vid.srcObject = info.stream;
  }
  // إزالة البلاطات المنتهية
  videos.querySelectorAll('.meet-video-tile[id^="meet-tile-"]').forEach(t => {
    const uid = t.id.replace('meet-tile-', '');
    if (!meet.remoteStreams.has(uid)) t.remove();
  });
  // تحديث البلاط المحلي
  updateLocalTileBadges();
  // تحديث قائمة المنتسبين إن كانت مفتوحة
  if (meet.isParticipantsOpen) renderParticipantsList();
}

function updateMeetTileName(uid, name) {
  const el = document.getElementById('meet-name-' + uid);
  if (el) el.innerHTML = `<span class="dot"></span> ${escapeHtml(name || 'مشارك')}`;
}

function updateMeetTileMute(uid, audioMuted, videoMuted) {
  const el = document.getElementById('meet-name-' + uid);
  if (el) el.classList.toggle('muted', !!audioMuted);
  const tile = document.getElementById('meet-tile-' + uid);
  if (tile && videoMuted) {
    // أظهر "الكاميرا مغلقة" فوق الـ video
    let off = tile.querySelector('.tile-off');
    if (!off) {
      off = document.createElement('div');
      off.className = 'tile-off';
      off.innerHTML = '<i class="fa-solid fa-video-slash"></i><div style="font-size:13px;">الكاميرا مغلقة</div>';
      tile.appendChild(off);
    }
  } else if (tile) {
    const off = tile.querySelector('.tile-off');
    if (off) off.remove();
  }
}

function updateMeetScreenBorder(uid, isSharing) {
  const tile = document.getElementById('meet-tile-' + uid);
  if (tile) {
    tile.classList.toggle('screen-share', !!isSharing);
    const action = tile.querySelector('.tile-actions span');
    if (action) action.style.display = isSharing ? 'flex' : 'none';
  }
}

// 🙋 إضافة/إزالة شارة رفع اليد على البلاط البعيد
function updateMeetTileHand(uid, raised) {
  const tile = document.getElementById('meet-tile-' + uid);
  if (!tile) return;
  let badge = tile.querySelector('.hand-badge');
  if (raised) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'hand-badge';
      badge.title = 'طلب التدخل (رفع اليد)';
      badge.innerHTML = '<i class="fa-solid fa-hand"></i>';
      tile.appendChild(badge);
    }
  } else if (badge) {
    badge.remove();
  }
}

// 🙋 تحديث شارة رفع اليد على البلاط المحلي
function updateLocalTileBadges() {
  const tile = document.getElementById('meetLocalTile');
  if (!tile) return;
  // شارة اليد
  let badge = tile.querySelector('.hand-badge');
  if (meet.isHandRaised) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'hand-badge';
      badge.title = 'طلب التدخل';
      badge.innerHTML = '<i class="fa-solid fa-hand"></i>';
      tile.appendChild(badge);
    }
  } else if (badge) {
    badge.remove();
  }
  // 🚫 شارة قفل المايك (تظهر على بلاطي المحلي إذا قفلتني الإدارة)
  let lockBadge = tile.querySelector('.lock-badge');
  if (meet.isMicLockedByAdmin) {
    if (!lockBadge) {
      lockBadge = document.createElement('div');
      lockBadge.className = 'lock-badge';
      lockBadge.title = 'المايك مقفل من الإدارة';
      lockBadge.innerHTML = '<i class="fa-solid fa-lock"></i> مقفل';
      tile.appendChild(lockBadge);
    }
  } else if (lockBadge) {
    lockBadge.remove();
  }
}



// 🔌 إعداد RTCPeerConnection + ICE
function setupPeerConnection() {
  if (meet.peerConn) { try { meet.peerConn.close(); } catch(e){} }
  const pc = new RTCPeerConnection(meet.rtcConfig);
  meet.peerConn = pc;
  // إضافة الـ tracks المحلية (إن وُجدت)
  if (meet.localStream) {
    meet.localStream.getTracks().forEach(track => pc.addTrack(track, meet.localStream));
  } else {
    // 👁️ دخول كمراقب فقط (بدون كاميرا/مايك) — نضيف transceivers
    // فارغة لنستقبل الفيديو والصوت من الطرف البعيد
    try { pc.addTransceiver('video', { direction: 'recvonly' }); } catch(e) {}
    try { pc.addTransceiver('audio', { direction: 'recvonly' }); } catch(e) {}
  }
  // عند استلام track بعيد
  pc.ontrack = (event) => {
    const stream = event.streams[0];
    if (!stream) return;
    // استخرج userId من التعليق الذي وضعناه على الـ track
    let uid = stream.id || 'remote-' + Math.random().toString(36).slice(2, 8);
    // نستخدم sender بدل stream id إن أمكن — لكن userId يأتي عبر signaling
    // هنا نعتمد على البحث في remoteStreams بوقت لاحق؛ مؤقتاً نضيف entry إذا جديد
    if (!meet.remoteStreams.has(uid)) {
      meet.remoteStreams.set(uid, { stream, name: 'مشارك جديد', audioMuted: false, videoMuted: false, screenSharing: false });
    } else {
      meet.remoteStreams.get(uid).stream = stream;
    }
    renderAllRemoteTiles();
  };
  // عند استلام قناة بيانات (data channel) — سننشئها نحن لكل peer عبر offer
  pc.ondatachannel = (event) => {
    const channel = event.channel;
    wireDataChannel(channel);
  };
  // 🆕 تجميع ICE candidates وإرسالها دفعة واحدة (يقلل writes بشكل كبير: من ~30 إلى 1)
  let _iceBatch = [];
  let _iceBatchTimer = null;
  pc.onicecandidate = (event) => {
    if (event.candidate && meet.roomId) {
      _iceBatch.push(event.candidate.toJSON());
      // أرسل كل 200ms أو عند اكتمال التجميع (نهاية ICE gathering)
      if (_iceBatchTimer) clearTimeout(_iceBatchTimer);
      _iceBatchTimer = setTimeout(() => {
        if (_iceBatch.length > 0 && meet.roomId) {
          const batch = _iceBatch.splice(0);  // أفرغ المصفوفة
          // استخدم update لإرسال دفعة واحدة بدلاً من عدة writes
          const updates = {};
          batch.forEach((c, i) => {
            updates[Date.now() + '_' + i] = c;
          });
          database.ref('meet/' + meet.roomId + '/candidates/' + meet.userId + '/out')
            .update(updates)
            .catch(err => console.warn('[meet] ice batch send error:', err));
        }
      }, 200);
    } else if (!event.candidate && _iceBatch.length > 0) {
      // نهاية تجميع الـ ICE — أرسل البقية فوراً
      if (_iceBatchTimer) clearTimeout(_iceBatchTimer);
      const batch = _iceBatch.splice(0);
      const updates = {};
      batch.forEach((c, i) => {
        updates[Date.now() + '_final_' + i] = c;
      });
      if (Object.keys(updates).length > 0 && meet.roomId) {
        database.ref('meet/' + meet.roomId + '/candidates/' + meet.userId + '/out')
          .update(updates)
          .catch(err => console.warn('[meet] ice final send error:', err));
      }
    }
  };
  // عند تغيّر حالة الاتصال — نُعلم المستخدم + نحذف ICE candidates لتوفير مساحة
  pc.onconnectionstatechange = () => {
    console.log('[meet] connection state:', pc.connectionState);
    // 🆕 عند نجاح الاتصال — احذف ICE candidates من Firebase (لم نعد بحاجة إليها)
    if ((pc.connectionState === 'connected' || pc.connectionState === 'completed') && meet.roomId) {
      // نحذف فقط المرسلة من جهتي (out) — البعيد سيحذف هو أيضاً عند نجاح اتصاله
      setTimeout(() => {
        if (meet.roomId) {
          database.ref('meet/' + meet.roomId + '/candidates/' + meet.userId + '/out').remove()
            .catch(err => console.warn('[meet] ice cleanup error:', err));
        }
      }, 3000);  // نعطي 3 ثوانٍ للتأكد أن البعيد استلم كل شيء
    }
  };
}

function wireDataChannel(channel) {
  let uid = null;
  channel.onopen = () => { console.log('[meet] data channel open', channel.label); };
  channel.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'hello') {
        uid = msg.userId;
        meet.dataChannels.set(uid, channel);
        // أضف entry إذا لم تكن موجودة
        if (!meet.remoteStreams.has(uid)) {
          meet.remoteStreams.set(uid, { stream: null, name: msg.name || 'مشارك', audioMuted: false, videoMuted: false, screenSharing: false, handRaised: false, micLockedByAdmin: false });
        } else {
          meet.remoteStreams.get(uid).name = msg.name || meet.remoteStreams.get(uid).name;
        }
        renderAllRemoteTiles();
        // رسل رداً ليعرفني أنا أيضاً
        channel.send(JSON.stringify({ type: 'hello', userId: meet.userId, name: meet.userName }));
        // أرسل حالتي الكاملة
        channel.send(JSON.stringify({
          type: 'state',
          audioMuted: meet.isAudioMuted,
          videoMuted: meet.isVideoMuted,
          screenSharing: meet.isScreenSharing,
          handRaised: meet.isHandRaised,
          micLockedByAdmin: meet.isMicLockedByAdmin,
          name: meet.userName
        }));
      } else if (msg.type === 'state') {
        if (!uid) return;
        if (!meet.remoteStreams.has(uid)) {
          meet.remoteStreams.set(uid, { stream: null, name: 'مشارك', audioMuted: false, videoMuted: false, screenSharing: false, handRaised: false, micLockedByAdmin: false });
        }
        const info = meet.remoteStreams.get(uid);
        info.audioMuted = !!msg.audioMuted;
        info.videoMuted = !!msg.videoMuted;
        info.screenSharing = !!msg.screenSharing;
        info.handRaised = !!msg.handRaised;
        info.micLockedByAdmin = !!msg.micLockedByAdmin;
        info.name = msg.name || info.name;
        updateMeetTileMute(uid, info.audioMuted, info.videoMuted);
        updateMeetScreenBorder(uid, info.screenSharing);
        updateMeetTileName(uid, info.name);
        updateMeetTileHand(uid, info.handRaised);
        // 🆕 إذا الإدارة قفلت المايك، حدّث الزر على بلاطي
        if (currentRole === 'directorate') {
          const lockBtn = document.getElementById('meet-lock-btn-' + uid);
          if (lockBtn) {
            lockBtn.classList.toggle('locked', info.micLockedByAdmin);
            lockBtn.innerHTML = `<i class="fa-solid ${info.micLockedByAdmin ? 'fa-lock' : 'fa-microphone'}"></i>`;
            lockBtn.title = info.micLockedByAdmin ? 'إلغاء قفل المايك' : 'قفل المايك';
          }
        }
        // إعادة بناء قائمة المتدخلين (تتغيّر مع الأيدي المرفوعة)
        renderHandQueue();
      } else if (msg.type === 'chat') {
        appendMeetChatMessage(msg.name, msg.text, false);
      } else if (msg.type === 'hand') {
        // 🙋 إشارة رفع/خفض اليد من مشارك بعيد
        if (!uid) return;
        if (!meet.remoteStreams.has(uid)) {
          meet.remoteStreams.set(uid, { stream: null, name: msg.name || 'مشارك', handRaised: false, micLockedByAdmin: false });
        }
        const info = meet.remoteStreams.get(uid);
        info.handRaised = !!msg.raised;
        info.name = msg.name || info.name;
        updateMeetTileHand(uid, info.handRaised);
        if (info.handRaised) {
          meet.handRaisedList.set(uid, { name: info.name, time: msg.time || Date.now() });
          // 🆕 إشعار طلب تدخل + رنة هادئة متكررة (يظهر على نافذة المؤسسة + المديرية)
          playHandRaisedChime();
          // ❌ TTS معطّل
          // speakHandRaiseAnnouncement(info.name);
          showToast('🙋 طلب تدخل', `${info.name} يطلب الكلمة`);
          // حساب ترتيب اليد
          const sortedHands = Array.from(meet.handRaisedList.entries())
            .sort((a, b) => (a[1].time || 0) - (b[1].time || 0));
          const order = sortedHands.findIndex(([id]) => id === uid) + 1;
          // عرض الإشعار العائم (يظهر على كل الأدوار)
          showFloatingHandNotification(uid, info.name, order);
          if (currentRole === 'directorate') {
            // ✅ القبول التلقائي بعد 1.5 ثانية (للمديرية فقط)
            setTimeout(() => {
              if (meet.handRaisedList.has(uid)) {
                adminAcceptHand(uid);
              }
            }, 1500);
          }
        } else {
          meet.handRaisedList.delete(uid);
          // إذا انخفضت اليد، أغلق الإشعار العائم (إن كان يعرض هذه اليد)
          const notif = document.getElementById('meetHandNotification');
          if (notif) closeHandNotification();
        }
        renderHandQueue();
      } else if (msg.type === 'lock') {
        // 🔒 إشارة قفل/فتح المايك من الإدارة
        if (!uid) return;
        if (!meet.remoteStreams.has(uid)) {
          meet.remoteStreams.set(uid, { stream: null, name: msg.name || 'مشارك', micLockedByAdmin: false });
        }
        const info = meet.remoteStreams.get(uid);
        info.micLockedByAdmin = !!msg.locked;
        // إذا كانت الإشارة موجّهة لي شخصياً (أنا المقصود)
        if (msg.target === meet.userId) {
          meet.isMicLockedByAdmin = !!msg.locked;
          if (meet.isMicLockedByAdmin) {
            // إجبار إيقاف المايك
            if (meet.localStream) {
              meet.localStream.getAudioTracks().forEach(t => t.enabled = false);
            }
            meet.isAudioMuted = true;
            updateLocalAudioBtn();
            showToast('🔒 تم قفل المايك', 'قامت الإدارة بقفل المايك الخاص بك');
            // تشغيل صوت تنبيه
            playMicLockedChime();
          } else {
            // إعادة فتح المايك (لكن يبقى مكتوماً حتى يقوم المستخدم بفتحه يدوياً)
            showToast('🔓 تم فتح المايك', 'قامت الإدارة بفتح المايك — اضغط على زر المايك لتفعيله');
            playMicUnlockedChime();
          }
          updateLocalTileBadges();
        }
        // حدّث شارة "مقفل" على البلاط البعيد
        if (info.micLockedByAdmin) {
          // إضافة شارة على البلاط البعيد أيضاً
          const tile = document.getElementById('meet-tile-' + uid);
          if (tile) {
            let lockBadge = tile.querySelector('.lock-badge');
            if (!lockBadge) {
              lockBadge = document.createElement('div');
              lockBadge.className = 'lock-badge';
              lockBadge.innerHTML = '<i class="fa-solid fa-lock"></i> مقفل';
              tile.appendChild(lockBadge);
            }
          }
        } else {
          const tile = document.getElementById('meet-tile-' + uid);
          if (tile) {
            const lockBadge = tile.querySelector('.lock-badge');
            if (lockBadge) lockBadge.remove();
          }
        }
        // حدّث الزر على البلاط (للإدارة)
        const lockBtn = document.getElementById('meet-lock-btn-' + uid);
        if (lockBtn) {
          lockBtn.classList.toggle('locked', info.micLockedByAdmin);
          lockBtn.innerHTML = `<i class="fa-solid ${info.micLockedByAdmin ? 'fa-lock' : 'fa-microphone'}"></i>`;
          lockBtn.title = info.micLockedByAdmin ? 'إلغاء قفل المايك' : 'قفل المايك';
        }
        updateMeetTileMute(uid, info.audioMuted, info.videoMuted);
      } else if (msg.type === 'kicked') {
        // 🚪 الإدارة أنهت الاجتماع للجميع
        showToast('🛑 تم إنهاء الاجتماع', 'قامت الإدارة بإنهاء الاجتماع');
        setTimeout(() => { leaveMeetRoom(); }, 1200);
      } else if (msg.type === 'admin-lower-hand') {
        // الإدارة خففت يدي — أخفضها محلياً
        if (meet.isHandRaised) {
          meet.isHandRaised = false;
          const btn = document.getElementById('meetRaiseHand');
          if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-solid fa-hand"></i>';
            btn.title = 'رفع اليد لطلب الكلمة';
          }
          updateLocalTileBadges();
          showToast('✅ تم قبول طلبك', 'يمكنك الكلام الآن');
        }
      } else if (msg.type === 'hand-accepted') {
        // 🙋 الإدارة قبلت يدي تلقائياً أو يدوياً
        showToast('✅ تم قبول طلبك', `${msg.by || 'الإدارة'} قبلت طلبك للتدخل`);
        // اجعل زر المايك يضيء تلقائياً (افتح المايك إن لم يكن مقفلاً)
        if (!meet.isMicLockedByAdmin && meet.localStream) {
          // افتح الصوت تلقائياً
          meet.isAudioMuted = false;
          meet.localStream.getAudioTracks().forEach(t => t.enabled = true);
          updateLocalAudioBtn();
          const nameEl = document.getElementById('meetLocalName');
          if (nameEl) nameEl.classList.remove('muted');
          database.ref('meet/' + meet.roomId + '/participants/' + meet.userId + '/audioMuted').set(false);
          broadcastMeetState();
        }
        // أضف شارة "مقبول" على البلاطة
        showAcceptedBadgeOnLocalTile();
        playMicUnlockedChime();
      } else if (msg.type === 'dm') {
        // 💌 رسالة خاصة واردة
        handleIncomingDm(uid, msg);
      }
    } catch (e) { console.warn('[meet] bad data msg', e); }
  };
  channel.onclose = () => { if (uid) meet.dataChannels.delete(uid); };
}



// 👥 الاستماع للمشاركين الجدد (Firebase presence)
function listenToRoomParticipants() {
  if (!meet.roomId) return;
  // تنظيف المستمعين القدامى
  meet.firebaseListeners.forEach(off => { try { off(); } catch(e){} });
  meet.firebaseListeners = [];
  // استماع لحدث إضافة/إزالة مشارك
  const partRef = database.ref('meet/' + meet.roomId + '/participants');
  const partListener = partRef.on('child_added', (snapshot) => {
    const uid = snapshot.key;
    if (uid === meet.userId) return; // أنا
    const info = snapshot.val() || {};
    if (!meet.remoteStreams.has(uid)) {
      meet.remoteStreams.set(uid, { stream: null, name: info.name || 'مشارك', audioMuted: !!info.audioMuted, videoMuted: !!info.videoMuted, screenSharing: !!info.screenSharing, handRaised: !!info.handRaised, micLockedByAdmin: !!info.micLockedByAdmin });
      renderAllRemoteTiles();
    } else {
      // حدّث الاسم
      const cur = meet.remoteStreams.get(uid);
      cur.name = info.name || cur.name;
      cur.handRaised = !!info.handRaised;
      cur.micLockedByAdmin = !!info.micLockedByAdmin;
      updateMeetTileName(uid, cur.name);
      updateMeetTileHand(uid, cur.handRaised);
    }
    // ابدأ الاتصال: أنا المتصل الجديد، أنتظر عرض (offer) من الطرف الآخر
    // لكن الأفضل: الطرف الذي انضم لاحقاً هو من يبدأ الـ offer
    initiateCallTo(uid);
  });
  meet.firebaseListeners.push(() => partRef.off('child_added', partListener));
  // استماع لتغيير أي حقل في بيانات المشارك (مثل handRaised/micLocked)
  const partChangedListener = partRef.on('child_changed', (snapshot) => {
    const uid = snapshot.key;
    if (uid === meet.userId) return;
    const field = snapshot.key; // اسم الحقل المتغير
    // (لا حاجة لمعالجة هنا — التحديثات تأتي عبر data channel)
  });
  meet.firebaseListeners.push(() => partRef.off('child_changed', partChangedListener));
  const partRemovedListener = partRef.on('child_removed', (snapshot) => {
    const uid = snapshot.key;
    meet.remoteStreams.delete(uid);
    meet.dataChannels.delete(uid);
    meet.handRaisedList.delete(uid);
    renderAllRemoteTiles();
    renderHandQueue();
  });
  meet.firebaseListeners.push(() => partRef.off('child_removed', partRemovedListener));
  // الاستماع لرسائل signaling الموجهة لي
  listenToMeetSignaling();
}

function listenToMeetSignaling() {
  if (!meet.roomId) return;
  // 🆕 ICE candidates القادمة من البعيد — نحذفها فوراً بعد الاستخدام لتوفير مساحة
  const myInRef = database.ref('meet/' + meet.roomId + '/candidates/' + meet.userId + '/in');
  const iceListener = myInRef.on('child_added', (snapshot) => {
    const cand = snapshot.val();
    const candKey = snapshot.key;
    if (!cand || !meet.peerConn) return;
    try {
      meet.peerConn.addIceCandidate(new RTCIceCandidate(cand));
      // 🆕 احذف candidate من Firebase بعد معالجتها بنجاح (توفير مساحة)
      // نستخدم setTimeout صغير لتجنب race conditions
      setTimeout(() => {
        if (meet.roomId) {
          database.ref('meet/' + meet.roomId + '/candidates/' + meet.userId + '/in/' + candKey).remove()
            .catch(() => {});  // صامت - ليس خطأ حرجاً
        }
      }, 100);
    } catch(e) { console.warn(e); }
  });
  meet.firebaseListeners.push(() => myInRef.off('child_added', iceListener));
}



// 🤝 بدء اتصال مع مشارك جديد
async function initiateCallTo(remoteUid) {
  if (!meet.peerConn) setupPeerConnection();
  // تأكد من وجود data channel لكل peer
  const channel = meet.peerConn.createDataChannel('meet-' + remoteUid, { ordered: true });
  wireDataChannel(channel);
  meet.dataChannels.set(remoteUid, channel);
  // أنشئ عرض (offer) — الأحدث انضماماً يقدّم العرض
  const offer = await meet.peerConn.createOffer();
  await meet.peerConn.setLocalDescription(offer);
  // 🆕 أرسل الـ offer واحذفه بعد 5 ثوانٍ (بعد أن يستلمه البعيد)
  const offerRef = database.ref('meet/' + meet.roomId + '/offer/' + remoteUid);
  await offerRef.set({
    from: meet.userId,
    sdp: offer.sdp,
    type: offer.type,
    time: firebase.database.ServerValue.TIMESTAMP
  });
  setTimeout(() => {
    if (meet.roomId) offerRef.remove().catch(() => {});
  }, 5000);
}

function listenForIncomingOffers() {
  if (!meet.roomId) return;
  const offerRef = database.ref('meet/' + meet.roomId + '/offer/' + meet.userId);
  const offerListener = offerRef.on('child_added', async (snapshot) => {
    const data = snapshot.val();
    const offerKey = snapshot.key;
    if (!data || data.from === meet.userId) return;
    if (!meet.peerConn) setupPeerConnection();
    if (meet.peerConn.signalingState !== 'stable' && meet.peerConn.signalingState !== 'have-local-offer') return;
    try {
      await meet.peerConn.setRemoteDescription(new RTCSessionDescription({ type: data.type, sdp: data.sdp }));
      const answer = await meet.peerConn.createAnswer();
      await meet.peerConn.setLocalDescription(answer);
      // 🆕 أرسل الإجابة واحذفها بعد 5 ثوانٍ
      const ansRef = database.ref('meet/' + meet.roomId + '/answer/' + data.from);
      await ansRef.set({
        from: meet.userId,
        sdp: answer.sdp,
        type: answer.type,
        time: firebase.database.ServerValue.TIMESTAMP
      });
      setTimeout(() => {
        if (meet.roomId) ansRef.remove().catch(() => {});
      }, 5000);
      // 🆕 احذف الـ offer بعد معالجته
      setTimeout(() => {
        if (meet.roomId) offerRef.child(offerKey).remove().catch(() => {});
      }, 500);
    } catch (e) { console.error('[meet] offer handling error', e); }
  });
  meet.firebaseListeners.push(() => offerRef.off('child_added', offerListener));

  // استقبال الإجابات
  const ansRef = database.ref('meet/' + meet.roomId + '/answer/' + meet.userId);
  const ansListener = ansRef.on('child_added', async (snapshot) => {
    const data = snapshot.val();
    const ansKey = snapshot.key;
    if (!data || data.from === meet.userId) return;
    if (!meet.peerConn) return;
    try {
      await meet.peerConn.setRemoteDescription(new RTCSessionDescription({ type: data.type, sdp: data.sdp }));
      // 🆕 احذف الإجابة فوراً بعد معالجتها
      setTimeout(() => {
        if (meet.roomId) ansRef.child(ansKey).remove().catch(() => {});
      }, 500);
    } catch (e) { console.error('[meet] answer handling error', e); }
  });
  meet.firebaseListeners.push(() => ansRef.off('child_added', ansListener));
}
// نشغّلها عند الانضمام للغرفة
const _origJoinMeetRoom = joinMeetRoom;
joinMeetRoom = async function(roomId, displayName) {
  await _origJoinMeetRoom(roomId, displayName);
  listenForIncomingOffers();
};



// 🎛️ أزرار التحكم في المكالمة
function toggleMeetAudio() {
  if (!meet.localStream) return;
  // 🔒 إذا المايك مقفل من الإدارة، لا نسمح للمحاولة إلا بعد فك القفل
  if (meet.isMicLockedByAdmin && !meet.isAudioMuted) {
    showToast('🔒 المايك مقفل', 'لا يمكنك تشغيل المايك — الإدارة هي من تتحكم فيه حالياً');
    return;
  }
  meet.isAudioMuted = !meet.isAudioMuted;
  meet.localStream.getAudioTracks().forEach(t => t.enabled = !meet.isAudioMuted);
  updateLocalAudioBtn();
  const nameEl = document.getElementById('meetLocalName');
  if (nameEl) nameEl.classList.toggle('muted', meet.isAudioMuted);
  database.ref('meet/' + meet.roomId + '/participants/' + meet.userId + '/audioMuted').set(meet.isAudioMuted);
  broadcastMeetState();
}

function updateLocalAudioBtn() {
  const btn = document.getElementById('meetToggleAudio');
  if (!btn) return;
  const isLocked = meet.isMicLockedByAdmin;
  const isMuted = meet.isAudioMuted;
  btn.classList.toggle('active', isMuted || isLocked);
  if (isLocked) {
    btn.innerHTML = '<i class="fa-solid fa-lock"></i>';
    btn.title = 'المايك مقفل من الإدارة';
    btn.style.background = 'var(--grad-red)';
  } else {
    btn.innerHTML = isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
    btn.title = isMuted ? 'إلغاء كتم المايك' : 'كتم المايك';
    btn.style.background = '';
  }
}

function toggleMeetVideo() {
  if (!meet.localStream) return;
  meet.isVideoMuted = !meet.isVideoMuted;
  meet.localStream.getVideoTracks().forEach(t => t.enabled = !meet.isVideoMuted);
  const btn = document.getElementById('meetToggleVideo');
  if (btn) {
    btn.classList.toggle('active', meet.isVideoMuted);
    btn.innerHTML = meet.isVideoMuted ? '<i class="fa-solid fa-video-slash"></i>' : '<i class="fa-solid fa-video"></i>';
  }
  const tile = document.getElementById('meetLocalTile');
  if (tile) {
    let off = tile.querySelector('.tile-off');
    if (meet.isVideoMuted) {
      if (!off) {
        off = document.createElement('div');
        off.className = 'tile-off';
        off.innerHTML = '<i class="fa-solid fa-video-slash"></i><div style="font-size:13px;">الكاميرا مغلقة</div>';
        tile.appendChild(off);
      }
    } else if (off) off.remove();
  }
  database.ref('meet/' + meet.roomId + '/participants/' + meet.userId + '/videoMuted').set(meet.isVideoMuted);
  broadcastMeetState();
}

async function toggleMeetScreen() {
  if (meet.isScreenSharing) {
    // إيقاف المشاركة
    if (meet.screenStream) {
      meet.screenStream.getTracks().forEach(t => t.stop());
      meet.screenStream = null;
    }
    // أعد استبدال الـ screen track بكاميرا (إن وُجدت)
    const camTrack = meet.localStream ? meet.localStream.getVideoTracks()[0] : null;
    if (camTrack) {
      const sender = meet.peerConn?.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(camTrack);
    }
    meet.isScreenSharing = false;
    const tile = document.getElementById('meetLocalTile');
    if (tile) tile.classList.remove('screen-share');
    const btn = document.getElementById('meetToggleScreen');
    if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-desktop"></i>'; }
    database.ref('meet/' + meet.roomId + '/participants/' + meet.userId + '/screenSharing').set(false);
    broadcastMeetState();
    showToast('🖥️ تم إيقاف مشاركة الشاشة');
  } else {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showToast('⚠️ خطأ', 'متصفّحك لا يدعم مشاركة الشاشة');
      return;
    }
    try {
      meet.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      const screenTrack = meet.screenStream.getVideoTracks()[0];
      // استبدل الـ track في PeerConnection
      const sender = meet.peerConn?.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(screenTrack);
      // عند انتهاء المشاركة (يضغط المستخدم "إيقاف" من شريط المتصفح)
      screenTrack.onended = () => {
        if (meet.isScreenSharing) toggleMeetScreen();
      };
      meet.isScreenSharing = true;
      const tile = document.getElementById('meetLocalTile');
      if (tile) tile.classList.add('screen-share');
      const btn = document.getElementById('meetToggleScreen');
      if (btn) { btn.classList.add('active'); btn.innerHTML = '<i class="fa-solid fa-stop"></i>'; }
      database.ref('meet/' + meet.roomId + '/participants/' + meet.userId + '/screenSharing').set(true);
      broadcastMeetState();
      showToast('🖥️ بدأت مشاركة الشاشة');
    } catch (err) {
      console.error('screen share error', err);
      if (err.name !== 'NotAllowedError') {
        showToast('⚠️ خطأ', 'تعذّر بدء مشاركة الشاشة: ' + err.message);
      }
    }
  }
}

function toggleMeetChat() {
  // النظام الجديد: فتح اللوحة الجانبية الثابتة
  if (meetChat.isOpen) {
    closeMeetChatPanel();
  } else {
    openMeetChatPanel('group');
    loadMeetChatHistory();
  }
}

function updateChatBadge() {
  // ربط مع النظام الجديد
  updateMeetChatBadges();
}

function copyMeetRoomId() {
  if (!meet.roomId) return;
  const text = meet.roomId;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('✅ تم النسخ', 'تم نسخ رمز الغرفة. أرسله لزملائك.');
    }).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast('✅ تم النسخ', 'تم نسخ رمز الغرفة'); } catch(e){}
  document.body.removeChild(ta);
}

function broadcastMeetState() {
  // أرسل حالتي للجميع عبر data channels
  const msg = { type: 'state', audioMuted: meet.isAudioMuted, videoMuted: meet.isVideoMuted, screenSharing: meet.isScreenSharing, name: meet.userName };
  for (const [, ch] of meet.dataChannels) {
    try { if (ch.readyState === 'open') ch.send(JSON.stringify(msg)); } catch(e){}
  }
}

function sendMeetChat() {
  // النظام الجديد: يستدعي sendMeetGroupChat
  sendMeetGroupChat();
}

function appendMeetChatMessage(name, text, isMe) {
  // النظام الجديد: تخزين في meet.groupMessages + عرض في اللوحة الجانبية
  if (!meet.groupMessages) meet.groupMessages = [];
  meet.groupMessages.push({ name, text, time: Date.now() });
  // عرض في اللوحة الجانبية إذا كانت مفتوحة
  if (meetChat.isOpen && meetChat.mode === 'group') {
    renderMeetChatGroupMessages();
  }
  // تحديث الشارة إذا كانت الرسالة من غيري واللوحة مغلقة
  if (!isMe && !(meetChat.isOpen && meetChat.mode === 'group')) {
    meetChat.unreadGroup++;
    updateMeetChatBadges();
    // تشغيل صوت تنبيه خفيف
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 700;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.13);
    } catch(e) {}
  }
}



// 🙋 رفع اليد وطلب التدخل
function toggleRaiseHand() {
  if (!meet.roomId) return;
  meet.isHandRaised = !meet.isHandRaised;
  const btn = document.getElementById('meetRaiseHand');
  if (btn) {
    btn.classList.toggle('active', meet.isHandRaised);
    btn.innerHTML = meet.isHandRaised ? '<i class="fa-solid fa-hand-back-fist"></i>' : '<i class="fa-solid fa-hand"></i>';
    btn.title = meet.isHandRaised ? 'خفض اليد' : 'رفع اليد لطلب الكلمة';
  }
  updateLocalTileBadges();
  // بث الإشارة للجميع
  const msg = { type: 'hand', raised: meet.isHandRaised, name: meet.userName, time: Date.now() };
  for (const [, ch] of meet.dataChannels) {
    try { if (ch.readyState === 'open') ch.send(JSON.stringify(msg)); } catch(e){}
  }
  // تحديث في Firebase (للحفظ والمزامنة)
  database.ref('meet/' + meet.roomId + '/participants/' + meet.userId + '/handRaised').set(meet.isHandRaised);
  if (meet.isHandRaised) {
    playHandRaiseSound();
    // ❌ تم إزالة نطق TTS بناءً على طلب المستخدم (لا يرغبه للمديرية)
  }
}

// 🗣️ نطق اسم المتدخل — تم تعطيله بناءً على طلب المستخدم
// تم الإبقاء على الدالة كـ stub فارغ لتجنب أي أخطاء استدعاء قد تكون موجودة في الكود
function speakHandRaiseAnnouncement(speakerName) {
  // ❌ معطلة عمداً — لا نريد نطق صوتي
  return;
}

// ✅ عرض شارة "مقبول" على بلاطي المحلي (تختفي بعد 5 ثوان)
function showAcceptedBadgeOnLocalTile() {
  const tile = document.getElementById('meetLocalTile');
  if (!tile) return;
  let badge = tile.querySelector('.accepted-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'accepted-badge';
    badge.innerHTML = '<i class="fa-solid fa-microphone"></i> يمكنك الكلام';
    tile.appendChild(badge);
  }
  badge.classList.add('show');
  setTimeout(() => { badge.classList.remove('show'); }, 5000);
}

function renderHandQueue() {
  // قائمة المتدخلين (تظهر للمديرية فقط) — مرتبة حسب وقت رفع اليد
  const list = document.getElementById('meetHandQueueList');
  if (!list) return;
  // دمج يدي البعيدين + يدي المحلي
  const allHands = new Map(meet.handRaisedList);
  if (meet.isHandRaised) {
    allHands.set(meet.userId, { name: meet.userName + ' (أنت)', time: Date.now(), isMe: true });
  }
  if (allHands.size === 0) {
    list.innerHTML = '<div class="meet-hand-queue-empty">لا توجد طلبات حالياً</div>';
    return;
  }
  // رتب حسب الوقت (الأقدم أولاً)
  const sorted = Array.from(allHands.entries()).sort((a, b) => (a[1].time || 0) - (b[1].time || 0));
  list.innerHTML = sorted.map(([uid, info], index) => {
    const timeAgo = info.time ? getTimeAgo(info.time) : 'الآن';
    // إذا كنتُ المستخدم، لا أعرض زر "خفض اليد" للإدارة — لها زرها الخاص
    const canAccept = !info.isMe && currentRole === 'directorate';
    return `<div class="meet-hand-queue-item">
      <div class="hqi-info">
        <div class="hqi-name">
          <span class="hqi-order">${index + 1}</span>
          <i class="fa-solid fa-hand" style="color:var(--gold);"></i>
          ${escapeHtml(info.name || 'مشارك')}
        </div>
        <div class="hqi-time">رفع اليد ${timeAgo}</div>
      </div>
      <div class="hqi-actions">
        ${canAccept ? `<button class="btn-mini" onclick="adminAcceptHand('${escapeHtml(uid)}')" title="قبول طلبه" style="background:var(--algeria-green);color:#fff;border-color:transparent;"><i class="fa-solid fa-microphone"></i></button><button class="btn-mini" onclick="adminLowerHand('${escapeHtml(uid)}')" title="رفض"><i class="fa-solid fa-xmark"></i></button>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ✅ قبول يد متدخل (الإدارة تسمح له بالكلام)
function adminAcceptHand(uid) {
  if (currentRole !== 'directorate') return;
  // بث إشارة القبول للمستخدم المستهدف
  const ch = meet.dataChannels.get(uid);
  if (ch) {
    try {
      ch.send(JSON.stringify({ type: 'hand-accepted', by: meet.userName }));
    } catch(e){}
  }
  // أضف شارة "مقبول" على بلاط المستخدم
  showAcceptedBadgeOnRemoteTile(uid);
  // أخفض اليد تلقائياً
  setTimeout(() => adminLowerHand(uid), 3000);
  // عرض تأكيد للإدارة
  showToast('✅ تم القبول', 'تم السماح للمتحدث بالكلام');
}

function showAcceptedBadgeOnRemoteTile(uid) {
  const tile = document.getElementById('meet-tile-' + uid);
  if (!tile) return;
  let badge = tile.querySelector('.accepted-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'accepted-badge';
    badge.innerHTML = '<i class="fa-solid fa-microphone"></i> يتحدث الآن';
    tile.appendChild(badge);
  }
  badge.classList.add('show');
  setTimeout(() => { badge.classList.remove('show'); }, 5000);
}

function adminLowerHand(uid) {
  // المديرية تخفض يد مشارك معيّن
  if (currentRole !== 'directorate') return;
  // ابحث عن قناة البيانات لهذا المشارك
  const ch = meet.dataChannels.get(uid);
  if (ch) {
    try { ch.send(JSON.stringify({ type: 'admin-lower-hand' })); } catch(e){}
  }
  // احذف من القائمة المحلية
  meet.handRaisedList.delete(uid);
  if (meet.remoteStreams.has(uid)) meet.remoteStreams.get(uid).handRaised = false;
  // حدّث في Firebase
  database.ref('meet/' + meet.roomId + '/participants/' + uid + '/handRaised').set(false);
  updateMeetTileHand(uid, false);
  renderHandQueue();
  showToast('✅ تم خفض اليد', 'تم إبلاغ المشارك');
}

function toggleHandQueuePanel() {
  if (!meet.roomId) return;
  if (currentRole !== 'directorate') {
    showToast('⚠️ تنبيه', 'هذه اللوحة متاحة للمديرية فقط');
    return;
  }
  meet.isHandQueueOpen = !meet.isHandQueueOpen;
  const panel = document.getElementById('meetHandQueuePanel');
  if (panel) panel.classList.toggle('open', meet.isHandQueueOpen);
  const btn = document.getElementById('meetToggleHands');
  if (btn) btn.classList.toggle('active', meet.isHandQueueOpen);
  if (meet.isHandQueueOpen) renderHandQueue();
}



// 👥 نافذة قائمة المنتسبين للاجتماع (للمديرية)
function toggleParticipantsPanel() {
  if (!meet.roomId) return;
  if (currentRole !== 'directorate') {
    showToast('⚠️ تنبيه', 'هذه اللوحة متاحة للمديرية فقط');
    return;
  }
  meet.isParticipantsOpen = !meet.isParticipantsOpen;
  const panel = document.getElementById('meetParticipantsPanel');
  if (panel) panel.classList.toggle('open', meet.isParticipantsOpen);
  const btn = document.getElementById('meetToggleParticipants');
  if (btn) btn.classList.toggle('active', meet.isParticipantsOpen);
  if (meet.isParticipantsOpen) renderParticipantsList();
  // أغلق لوحة المتدخلين تلقائياً
  if (meet.isParticipantsOpen && meet.isHandQueueOpen) {
    meet.isHandQueueOpen = false;
    const hp = document.getElementById('meetHandQueuePanel');
    if (hp) hp.classList.remove('open');
    const hb = document.getElementById('meetToggleHands');
    if (hb) hb.classList.remove('active');
  }
}

function renderParticipantsList() {
  // قائمة كل المنتسبين للمديرية (بما فيهم المديرية نفسها) — مرتبة: المحلية أولاً
  const list = document.getElementById('meetParticipantsList');
  const countEl = document.getElementById('meetParticipantsCount');
  if (!list) return;
  const rows = [];
  // أضف المستخدم المحلي أولاً
  rows.push({
    uid: meet.userId,
    name: meet.userName,
    isMe: true,
    isDirectorate: currentRole === 'directorate',
    audioMuted: meet.isAudioMuted,
    videoMuted: meet.isVideoMuted,
    micLocked: meet.isMicLockedByAdmin
  });
  // أضف البعيدين
  for (const [uid, info] of meet.remoteStreams.entries()) {
    rows.push({
      uid,
      name: info.name || 'مشارك',
      isMe: false,
      isDirectorate: false,
      audioMuted: !!info.audioMuted,
      videoMuted: !!info.videoMuted,
      micLocked: !!info.micLockedByAdmin
    });
  }
  if (countEl) countEl.textContent = rows.length;
  if (rows.length === 0) {
    list.innerHTML = '<div class="participants-empty">لا يوجد منتسبون بعد</div>';
    return;
  }
  list.innerHTML = rows.map(p => {
    const initial = (p.name || '?').charAt(0).toUpperCase();
    const statusClass = p.micLocked ? 'locked' : (p.audioMuted ? 'muted' : '');
    const tags = [];
    if (p.isMe) tags.push('<span class="p-tag" style="color:var(--algeria-green);">أنت</span>');
    if (p.isDirectorate) tags.push('<span class="p-tag" style="color:var(--gold);">المديرية</span>');
    if (p.micLocked) tags.push('<span class="p-tag" style="color:var(--algeria-red);">🔒 مقفل</span>');
    else if (p.audioMuted) tags.push('<span class="p-tag" style="color:var(--text-dim);">صامت</span>');
    if (p.videoMuted) tags.push('<span class="p-tag" style="color:var(--text-dim);">كاميرا مغلقة</span>');
    const lockBtnClass = p.micLocked ? 'locked' : '';
    const lockBtnIcon = p.micLocked ? 'fa-lock' : 'fa-microphone';
    const lockTitle = p.micLocked ? 'إلغاء قفل المايك' : 'قفل المايك';
    // لا تعرض أزرار التحكم لمستخدم محلي (الإدارة تتحكم فيهم عبرهم)
    const adminActions = !p.isMe;
    return `<div class="participant-row">
      <div class="p-avatar">
        ${escapeHtml(initial)}
        <div class="p-status-dot ${statusClass}"></div>
      </div>
      <div class="p-info">
        <div class="p-name">${escapeHtml(p.name)}</div>
        <div class="p-meta">${tags.join(' ')}</div>
      </div>
      <div class="p-actions">
        ${adminActions ? `
          <button class="p-action-btn ${lockBtnClass}" onclick="toggleRemoteMicLock('${escapeHtml(p.uid)}')" title="${lockTitle}">
            <i class="fa-solid ${lockBtnIcon}"></i>
          </button>
          <button class="p-action-btn ${meet.dmUnread.get(p.uid) ? 'has-msg' : ''}" onclick="openDmWith('${escapeHtml(p.uid)}', '${escapeHtml(p.name)}')" title="دردشة خاصة">
            <i class="fa-solid fa-comment-dots"></i>
          </button>
        ` : ''}
      </div>
    </div>`;
  }).join('');
}



// 💌 نظام الدردشة الخاصة (DM) بين المشاركين
function openDmWith(peerUid, peerName) {
  if (peerUid === meet.userId) return;
  // النظام الجديد: فتح اللوحة الجانبية على وضع الخاص مع المحادثة المحددة
  openMeetChatPanel('dm');
  openMeetChatDm(peerUid, peerName);
}

function closeDmPanel() {
  meet.isDmOpen = false;
  meet.activeDmPeer = null;
  const panel = document.getElementById('meetDmPanel');
  if (panel) panel.classList.remove('open');
}

function sendMeetDm() {
  if (!meet.activeDmPeer || !meet.roomId) return;
  const input = document.getElementById('meetDmInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const peerUid = meet.activeDmPeer;
  const peerName = meet.remoteStreams.get(peerUid)?.name || 'مستخدم';
  const msg = {
    type: 'dm',
    from: meet.userId,
    fromName: meet.userName,
    to: peerUid,
    text,
    time: Date.now()
  };
  // بث عبر data channel للمستخدم المستهدف
  const ch = meet.dataChannels.get(peerUid);
  if (ch) {
    try { ch.send(JSON.stringify(msg)); } catch(e){}
  }
  // تخزين محلياً في سجل DM
  if (!meet.dmThreads.has(peerUid)) meet.dmThreads.set(peerUid, []);
  meet.dmThreads.get(peerUid).push({ from: 'me', text, time: Date.now() });
  // عرض الرسالة محلياً
  if (meet.isDmOpen && meet.activeDmPeer === peerUid) {
    renderDmMessages();
  }
}

function handleIncomingDm(fromUid, msg) {
  // إضافة الرسالة إلى السجل
  if (!meet.dmThreads.has(fromUid)) meet.dmThreads.set(fromUid, []);
  meet.dmThreads.get(fromUid).push({ from: 'them', text: msg.text, time: msg.time });
  // تحديث عدد الرسائل غير المقروءة
  const isActiveDm = (meetChat.isOpen && meetChat.mode === 'dm' && meetChat.activeDmUid === fromUid);
  if (!isActiveDm) {
    meet.dmUnread.set(fromUid, (meet.dmUnread.get(fromUid) || 0) + 1);
    // حساب المجموع
    meetChat.unreadDmTotal = 0;
    for (const n of meet.dmUnread.values()) meetChat.unreadDmTotal += n;
    updateMeetChatBadges();
    // تشغيل صوت تنبيه
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.frequency.value = 600;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.19);
    } catch(e) {}
    showToast('💌 رسالة خاصة', `${msg.fromName}: ${msg.text.substring(0, 40)}${msg.text.length > 40 ? '...' : ''}`);
  } else {
    // إذا كنا في المحادثة الخاصة معه، نعرض الرسالة
    renderMeetChatDmMessages();
  }
  // إذا كانت قائمة المحادثات معروضة، نحدّثها
  if (meetChat.isOpen && meetChat.mode === 'dm' && !meetChat.activeDmUid) {
    renderMeetChatDmList();
  }
  // تحديث زر الرسالة في لوحة المنتسبين
  document.querySelectorAll('.p-action-btn').forEach(b => {
    if (b.title === 'دردشة خاصة' && b.getAttribute('onclick')?.includes(fromUid)) {
      b.classList.add('has-msg');
    }
  });
}

function renderDmMessages() {
  const list = document.getElementById('meetDmMsgs');
  if (!list || !meet.activeDmPeer) return;
  const thread = meet.dmThreads.get(meet.activeDmPeer) || [];
  if (thread.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:30px 10px;font-size:13px;">لا توجد رسائل بعد — ابدأ المحادثة الآن 👋</div>';
    return;
  }
  list.innerHTML = thread.map(m => {
    const time = new Date(m.time).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
    return `<div class="dm-msg ${m.from === 'me' ? 'me' : ''}">
      <div>${escapeHtml(m.text)}</div>
      <div class="dm-time">${time}</div>
    </div>`;
  }).join('');
  // التمرير للأسفل
  list.scrollTop = list.scrollHeight;
}

function updateDmBadge() {
  const badge = document.getElementById('meetDmBadge');
  if (!badge) return;
  let totalUnread = 0;
  for (const n of meet.dmUnread.values()) totalUnread += n;
  if (totalUnread > 0) {
    badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

// فتح قائمة الرسائل الواردة (نافذة صغيرة فيها قائمة المحادثات)
function openDmInbox() {
  // النظام الجديد: فتح اللوحة الجانبية على وضع الخاص
  if (!meet.roomId) return;
  openMeetChatPanel('dm');
}



// 🔒 قفل / فتح المايك من الإدارة
function toggleRemoteMicLock(uid) {
  if (currentRole !== 'directorate') {
    showToast('⚠️ غير مسموح', 'هذه الخاصية متاحة للمديرية فقط');
    return;
  }
  if (!meet.roomId) return;
  const info = meet.remoteStreams.get(uid);
  if (!info) return;
  const newLockState = !info.micLockedByAdmin;
  // بث القفل عبر data channel للمستخدم المستهدف
  const ch = meet.dataChannels.get(uid);
  if (ch) {
    try {
      ch.send(JSON.stringify({
        type: 'lock',
        target: uid,
        locked: newLockState,
        by: meet.userName
      }));
    } catch(e){}
  }
  // بث للجميع حتى يروا شارة القفل
  const broadcastMsg = {
    type: 'lock',
    target: uid,
    locked: newLockState,
    name: info.name
  };
  for (const [otherUid, otherCh] of meet.dataChannels) {
    if (otherUid !== uid) {
      try { if (otherCh.readyState === 'open') otherCh.send(JSON.stringify(broadcastMsg)); } catch(e){}
    }
  }
  // تحديث الحالة محلياً
  info.micLockedByAdmin = newLockState;
  // تحديث Firebase
  database.ref('meet/' + meet.roomId + '/participants/' + uid + '/micLockedByAdmin').set(newLockState);
  // تحديث الواجهة
  const lockBtn = document.getElementById('meet-lock-btn-' + uid);
  if (lockBtn) {
    lockBtn.classList.toggle('locked', newLockState);
    lockBtn.innerHTML = `<i class="fa-solid ${newLockState ? 'fa-lock' : 'fa-microphone'}"></i>`;
    lockBtn.title = newLockState ? 'إلغاء قفل المايك' : 'قفل المايك';
  }
  if (newLockState) {
    showToast('🔒 تم قفل المايك', `تم قفل مايك ${info.name} بنجاح`);
  } else {
    showToast('🔓 تم فتح المايك', `تم السماح لـ ${info.name} باستخدام المايك`);
  }
}



// 🖥️ ملء الشاشة
function toggleMeetFullscreen() {
  const stage = document.getElementById('meetStage');
  if (!stage) return;
  if (!meet.isFullscreen) {
    // ادخل وضع ملء الشاشة
    if (stage.requestFullscreen) {
      stage.requestFullscreen().then(() => {
        meet.isFullscreen = true;
        stage.classList.add('fullscreen-mode');
        const btn = document.getElementById('meetFullscreen');
        if (btn) {
          btn.classList.add('fullscreen-active');
          btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
          btn.title = 'إنهاء ملء الشاشة';
        }
      }).catch(err => {
        console.warn('Fullscreen failed:', err);
        // ملء الشاشة بالمحاكاة (CSS فقط) إذا رفض المتصفح
        meet.isFullscreen = true;
        stage.classList.add('fullscreen-mode');
        const btn = document.getElementById('meetFullscreen');
        if (btn) {
          btn.classList.add('fullscreen-active');
          btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
          btn.title = 'إنهاء ملء الشاشة';
        }
      });
    } else {
      // المتصفحات التي لا تدعم Fullscreen API — نستخدم CSS فقط
      meet.isFullscreen = true;
      stage.classList.add('fullscreen-mode');
      const btn = document.getElementById('meetFullscreen');
      if (btn) {
        btn.classList.add('fullscreen-active');
        btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
        btn.title = 'إنهاء ملء الشاشة';
      }
    }
  } else {
    // اخرج من وضع ملء الشاشة
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch(e){} }
    meet.isFullscreen = false;
    stage.classList.remove('fullscreen-mode');
    const btn = document.getElementById('meetFullscreen');
    if (btn) {
      btn.classList.remove('fullscreen-active');
      btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
      btn.title = 'ملء الشاشة';
    }
  }
}

// الاستماع لتغيّر حالة ملء الشاشة (مثلاً عند الضغط على Esc)
document.addEventListener('fullscreenchange', () => {
  const stage = document.getElementById('meetStage');
  if (!document.fullscreenElement) {
    meet.isFullscreen = false;
    if (stage) stage.classList.remove('fullscreen-mode');
    const btn = document.getElementById('meetFullscreen');
    if (btn) {
      btn.classList.remove('fullscreen-active');
      btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
      btn.title = 'ملء الشاشة';
    }
  }
});



// 🆕 نظام الشات الجانبي الجديد (خانة مثبتة على اليمين)
const meetChat = {
  mode: 'group',           // 'group' أو 'dm'
  activeDmUid: null,        // المحادثة الخاصة النشطة
  unreadGroup: 0,           // رسائل غير مقروءة في الشات الجماعي
  unreadDmTotal: 0,         // مجموع الرسائل غير المقروءة في الخاص
  isOpen: false
};

function openMeetChatPanel(mode) {
  meetChat.isOpen = true;
  const panel = document.getElementById('meetChatPanel');
  if (panel) {
    panel.style.display = 'flex';
    requestAnimationFrame(() => panel.classList.add('open'));
  }
  if (mode) switchMeetChatMode(mode);
  else renderMeetChatPanel();
}

function closeMeetChatPanel() {
  meetChat.isOpen = false;
  const panel = document.getElementById('meetChatPanel');
  if (panel) {
    panel.classList.remove('open');
    setTimeout(() => { panel.style.display = 'none'; }, 320);
  }
}

function switchMeetChatMode(mode) {
  meetChat.mode = mode;
  // تحديث التابات
  document.querySelectorAll('.meet-chat-tab').forEach(t => t.classList.remove('active'));
  if (mode === 'group') {
    document.getElementById('meetChatTabGroup')?.classList.add('active');
  } else {
    document.getElementById('meetChatTabDm')?.classList.add('active');
  }
  renderMeetChatPanel();
}

function renderMeetChatPanel() {
  const groupMsgs = document.getElementById('meetChatGroupMsgs');
  const dmMsgs = document.getElementById('meetChatDmMsgs');
  const dmList = document.getElementById('meetChatDmList');
  const dmHeader = document.getElementById('meetChatDmHeader');
  const groupInput = document.getElementById('meetChatGroupInput');
  const dmInput = document.getElementById('meetChatDmInput');
  const titleEl = document.getElementById('mcpHeadTitle');
  const tagEl = document.getElementById('mcpModeTag');
  if (!groupMsgs) return;
  if (meetChat.mode === 'group') {
    titleEl.textContent = 'شات الاجتماع (جماعي)';
    tagEl.textContent = 'جماعي';
    groupMsgs.classList.add('active');
    dmMsgs.classList.remove('active');
    dmList.classList.remove('active');
    dmHeader.classList.remove('active');
    groupInput.style.display = 'flex';
    dmInput.style.display = 'none';
    // تصفير الشارة عند الفتح
    meetChat.unreadGroup = 0;
    updateMeetChatBadges();
  } else {
    titleEl.textContent = 'الرسائل الخاصة';
    tagEl.textContent = 'خاص';
    if (meetChat.activeDmUid) {
      // عرض المحادثة الخاصة النشطة
      dmList.classList.remove('active');
      dmMsgs.classList.add('active');
      dmHeader.classList.add('active');
      const peerName = meet.remoteStreams.get(meetChat.activeDmUid)?.name || 'مستخدم';
      document.getElementById('meetDmTargetName').textContent = peerName;
      document.getElementById('meetDmTargetAvatar').textContent = peerName.charAt(0).toUpperCase();
      renderMeetChatDmMessages();
      groupInput.style.display = 'none';
      dmInput.style.display = 'flex';
    } else {
      // عرض قائمة المحادثات
      dmList.classList.add('active');
      dmMsgs.classList.remove('active');
      dmHeader.classList.remove('active');
      groupInput.style.display = 'none';
      dmInput.style.display = 'none';
      renderMeetChatDmList();
    }
  }
  // تمرير لأسفل
  setTimeout(() => {
    if (meetChat.mode === 'group' && groupMsgs) groupMsgs.scrollTop = groupMsgs.scrollHeight;
    if (meetChat.mode === 'dm' && dmMsgs && meetChat.activeDmUid) dmMsgs.scrollTop = dmMsgs.scrollHeight;
  }, 50);
}

function renderMeetChatGroupMessages() {
  const list = document.getElementById('meetChatGroupMsgs');
  if (!list) return;
  // نستخدم نفس البنية (meet.groupMessages) — سنخزنها في meet الآن
  const msgs = meet.groupMessages || [];
  if (msgs.length === 0) {
    list.innerHTML = '<div class="mcp-empty">لا توجد رسائل جماعية بعد — ابدأ المحادثة 💬</div>';
    return;
  }
  list.innerHTML = msgs.map(m => {
    const isMe = m.name === meet.userName;
    const time = new Date(m.time).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
    return `<div class="mcp-msg ${isMe ? 'me' : ''}">
      <div class="mcp-sender"><span>${escapeHtml(m.name || 'مشارك')}</span><span class="mcp-time">${time}</span></div>
      <div class="mcp-text">${escapeHtml(m.text)}</div>
    </div>`;
  }).join('');
  // تمرير للأسفل إذا كان المستخدم قريباً من الأسفل
  const isAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  if (isAtBottom || meetChat.isOpen) list.scrollTop = list.scrollHeight;
}

function renderMeetChatDmList() {
  const list = document.getElementById('meetChatDmList');
  if (!list) return;
  const entries = [];
  for (const [uid, thread] of meet.dmThreads.entries()) {
    const last = thread[thread.length - 1];
    const name = meet.remoteStreams.get(uid)?.name || 'مستخدم';
    const unread = meet.dmUnread.get(uid) || 0;
    const time = last ? new Date(last.time).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }) : '';
    entries.push({ uid, name, last, unread, time });
  }
  // ترتيب: الأحدث أولاً (وقت آخر رسالة)
  entries.sort((a, b) => {
    const ta = a.last ? a.last.time : 0;
    const tb = b.last ? b.last.time : 0;
    return tb - ta;
  });
  if (entries.length === 0) {
    list.innerHTML = '<div class="dm-list-empty">لا توجد محادثات خاصة بعد.<br>اضغط على زر الرسالة 💬 بجانب أي مشارك لفتح محادثة.</div>';
    return;
  }
  list.innerHTML = entries.map(e => {
    const initial = (e.name || '?').charAt(0).toUpperCase();
    const previewText = e.last ? (e.last.from === 'me' ? 'أنت: ' : '') + e.last.text : '';
    return `<div class="dm-list-item ${e.unread > 0 ? 'unread' : ''}" onclick="openMeetChatDm('${escapeHtml(e.uid)}', '${escapeHtml(e.name)}')">
      <div class="dm-list-avatar">${escapeHtml(initial)}</div>
      <div class="dm-list-info">
        <div class="dm-list-name">${escapeHtml(e.name)}</div>
        <div class="dm-list-preview">${escapeHtml(previewText.substring(0, 50))}</div>
      </div>
      <div class="dm-list-meta">
        <span class="dm-list-time">${e.time}</span>
        <span class="dm-list-badge">${e.unread > 9 ? '9+' : e.unread}</span>
      </div>
    </div>`;
  }).join('');
}

function openMeetChatDm(uid, name) {
  meetChat.activeDmUid = uid;
  meet.dmUnread.set(uid, 0);
  updateMeetChatBadges();
  renderMeetChatPanel();
}

function backToDmList() {
  meetChat.activeDmUid = null;
  renderMeetChatPanel();
}

function renderMeetChatDmMessages() {
  const list = document.getElementById('meetChatDmMsgs');
  if (!list || !meetChat.activeDmUid) return;
  const thread = meet.dmThreads.get(meetChat.activeDmUid) || [];
  if (thread.length === 0) {
    list.innerHTML = '<div class="mcp-empty">لا توجد رسائل بعد — ابدأ المحادثة 👋</div>';
    return;
  }
  const peerName = meet.remoteStreams.get(meetChat.activeDmUid)?.name || 'مستخدم';
  list.innerHTML = thread.map(m => {
    const isMe = m.from === 'me';
    const time = new Date(m.time).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
    return `<div class="mcp-msg ${isMe ? 'me' : ''}">
      <div class="mcp-sender"><span>${isMe ? 'أنت' : escapeHtml(peerName)}</span><span class="mcp-time">${time}</span></div>
      <div class="mcp-text">${escapeHtml(m.text)}</div>
    </div>`;
  }).join('');
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 30);
}

function sendMeetGroupChat() {
  const input = document.getElementById('meetChatGroupInputField');
  if (!input) return;
  const text = input.value.trim();
  if (!text || !meet.roomId) return;
  input.value = '';
  if (!meet.groupMessages) meet.groupMessages = [];
  const msg = { name: meet.userName, text, time: Date.now() };
  meet.groupMessages.push(msg);
  // بث عبر data channels
  const wireMsg = { type: 'chat', name: meet.userName, text, time: msg.time };
  for (const [, ch] of meet.dataChannels) {
    try { if (ch.readyState === 'open') ch.send(JSON.stringify(wireMsg)); } catch(e){}
  }
  // تخزين في Firebase
  database.ref('meet/' + meet.roomId + '/chat').push({
    name: meet.userName, text, time: firebase.database.ServerValue.TIMESTAMP
  });
  // عرض فوري
  if (meetChat.mode === 'group' && meetChat.isOpen) {
    renderMeetChatGroupMessages();
  } else {
    // فتح اللوحة تلقائياً
    openMeetChatPanel('group');
    renderMeetChatGroupMessages();
  }
}

function sendMeetChatDmV2() {
  if (!meetChat.activeDmUid || !meet.roomId) return;
  const input = document.getElementById('meetChatDmInputField');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const peerUid = meetChat.activeDmUid;
  meet.activeDmPeer = peerUid;
  meet.isDmOpen = true;
  const msg = { type: 'dm', from: meet.userId, fromName: meet.userName, to: peerUid, text, time: Date.now() };
  const ch = meet.dataChannels.get(peerUid);
  if (ch) { try { ch.send(JSON.stringify(msg)); } catch(e){} }
  if (!meet.dmThreads.has(peerUid)) meet.dmThreads.set(peerUid, []);
  meet.dmThreads.get(peerUid).push({ from: 'me', text, time: Date.now() });
  renderMeetChatDmMessages();
}

function updateMeetChatBadges() {
  // شارة الشات الجماعي على الزر في شريط التحكم
  const groupBadge = document.getElementById('meetChatBadge');
  if (groupBadge) {
    if (meetChat.unreadGroup > 0 && !(meetChat.isOpen && meetChat.mode === 'group')) {
      groupBadge.textContent = meetChat.unreadGroup > 99 ? '99+' : String(meetChat.unreadGroup);
      groupBadge.classList.add('show');
    } else {
      groupBadge.classList.remove('show');
    }
  }
  // شارة الخاص على الزر + التاب
  const dmBtnBadge = document.getElementById('meetDmBadge');
  if (dmBtnBadge) {
    if (meetChat.unreadDmTotal > 0 && !(meetChat.isOpen && meetChat.mode === 'dm' && meetChat.activeDmUid)) {
      dmBtnBadge.textContent = meetChat.unreadDmTotal > 99 ? '99+' : String(meetChat.unreadDmTotal);
      dmBtnBadge.classList.add('show');
    } else {
      dmBtnBadge.classList.remove('show');
    }
  }
  // شارة على تاب الخاص
  const dmTabBadge = document.getElementById('meetChatDmBadgeTab');
  if (dmTabBadge) {
    if (meetChat.unreadDmTotal > 0) {
      dmTabBadge.textContent = meetChat.unreadDmTotal > 9 ? '9+' : String(meetChat.unreadDmTotal);
      dmTabBadge.classList.add('show');
    } else {
      dmTabBadge.classList.remove('show');
    }
  }
  // شارة على تاب الجماعي
  const groupTabBadge = document.getElementById('meetChatGroupBadge');
  if (groupTabBadge) {
    if (meetChat.unreadGroup > 0) {
      groupTabBadge.textContent = meetChat.unreadGroup > 9 ? '9+' : String(meetChat.unreadGroup);
      groupTabBadge.classList.add('show');
    } else {
      groupTabBadge.classList.remove('show');
    }
  }
}



// 🆕 نظام الرنة المتكررة (مثل رنة المسنجر) + إيقاف يدوي
let _meetRingtoneState = {
  active: false,
  intervalId: null,
  isHandNotif: false,    // true = تنبيه طلب تدخل (نغمة هادئة متكررة)
  isInviteNotif: false,  // true = تنبيه دعوة (نغمة قوية متكررة)
  audioCtx: null
};

function startHandNotifRingtone() {
  // رنة هادئة متكررة لطلب التدخل
  if (_meetRingtoneState.active && _meetRingtoneState.isHandNotif) return;
  stopAllMeetRingtones();
  _meetRingtoneState.active = true;
  _meetRingtoneState.isHandNotif = true;
  _meetRingtoneState.isInviteNotif = false;
  playHandNotifChime();
  _meetRingtoneState.intervalId = setInterval(playHandNotifChime, 2500);
}

function startInviteNotifRingtone() {
  // رنة متكررة للدعوة (مثل المسنجر)
  if (_meetRingtoneState.active && _meetRingtoneState.isInviteNotif) return;
  stopAllMeetRingtones();
  _meetRingtoneState.active = true;
  _meetRingtoneState.isHandNotif = false;
  _meetRingtoneState.isInviteNotif = true;
  playInviteNotifChime();
  _meetRingtoneState.intervalId = setInterval(playInviteNotifChime, 2200);
}

function playHandNotifChime() {
  // نغمة هادئة (نغمة واحدة متكررة) لطلب التدخل
  try {
    const audioCtx = _meetRingtoneState.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    _meetRingtoneState.audioCtx = audioCtx;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.55);
  } catch(e) {}
}

function playInviteNotifChime() {
  // نغمة قوية (نغمتان متتاليتان) مثل رنة المسنجر
  try {
    const audioCtx = _meetRingtoneState.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    _meetRingtoneState.audioCtx = audioCtx;
    const now = audioCtx.currentTime;
    [0, 0.2].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 1000 : 1300;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.28, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  } catch(e) {}
}

function stopAllMeetRingtones() {
  if (_meetRingtoneState.intervalId) {
    clearInterval(_meetRingtoneState.intervalId);
    _meetRingtoneState.intervalId = null;
  }
  _meetRingtoneState.active = false;
  _meetRingtoneState.isHandNotif = false;
  _meetRingtoneState.isInviteNotif = false;
}



// 🆕 إشعار طلب التدخل العائم (يظهر على نافذة المؤسسة)
function showFloatingHandNotification(uid, name, order) {
  // إزالة أي إشعار سابق
  const existing = document.getElementById('meetHandNotification');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'meetHandNotification';
  div.className = 'meet-hand-notification';
  div.innerHTML = `
    <div class="mhn-icon"><i class="fa-solid fa-hand"></i></div>
    <div class="mhn-body">
      <div class="mhn-title">
        <span class="mhn-order">${order}</span>
        طلب تدخل
      </div>
      <div class="mhn-sub">${escapeHtml(name)} يطلب الكلمة</div>
    </div>
    <div class="mhn-actions">
      <button class="mhn-btn" onclick="acceptHandFromNotif('${escapeHtml(uid)}')" title="قبول">
        <i class="fa-solid fa-microphone"></i> قبول
      </button>
      <button class="mhn-btn stop-sound" onclick="stopHandNotifRingtone()" title="إيقاف الصوت">
        <i class="fa-solid fa-volume-xmark"></i> كتم
      </button>
      <button class="mhn-btn stop-sound" onclick="closeHandNotification()" title="إغلاق">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  document.body.appendChild(div);
  // تشغيل الرنة المتكررة
  startHandNotifRingtone();
  // إزالة تلقائية بعد 60 ثانية
  setTimeout(() => { if (document.getElementById('meetHandNotification')) closeHandNotification(); }, 60000);
}

function stopHandNotifRingtone() {
  if (_meetRingtoneState.isHandNotif) {
    stopAllMeetRingtones();
    showToast('🔇 تم كتم الصوت', 'سيستمر التنبيه المرئي فقط');
  }
}

function closeHandNotification() {
  const el = document.getElementById('meetHandNotification');
  if (el) el.remove();
  stopAllMeetRingtones();
}

function acceptHandFromNotif(uid) {
  // قبول طلب التدخل من الإشعار العائم
  if (currentRole === 'directorate') {
    adminAcceptHand(uid);
  } else {
    // إذا كان غير المديرية، فقط أخفض يده محلياً
    if (meet.userId === uid) {
      meet.isHandRaised = false;
      const btn = document.getElementById('meetRaiseHand');
      if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-hand"></i>'; }
      updateLocalTileBadges();
    }
  }
  closeHandNotification();
}



// 🔊 المؤثرات الصوتية
function playHandRaiseSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [659, 880].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.18);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.2);
    });
  } catch(e) {}
}

function playHandRaisedChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.15);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.32);
  } catch(e) {}
}

function playMicLockedChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(220, now + 0.15);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.42);
  } catch(e) {}
}

function playMicUnlockedChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [440, 660].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.17);
    });
  } catch(e) {}
}

function loadMeetChatHistory() {
  if (!meet.roomId) return;
  database.ref('meet/' + meet.roomId + '/chat').orderByChild('time').limitToLast(50).once('value', snap => {
    const data = snap.val() || {};
    const sortedMsgs = Object.values(data).sort((a, b) => (a.time || 0) - (b.time || 0));
    // تخزين في meet.groupMessages (تحويل من server timestamp إلى رقم)
    meet.groupMessages = sortedMsgs.map(m => ({
      name: m.name,
      text: m.text,
      time: typeof m.time === 'number' ? m.time : Date.now()
    }));
    // عرض في اللوحة الجانبية
    renderMeetChatGroupMessages();
  });
}

// اشحن سجل الشات عند فتح لوحة الشات لأول مرة
const _origToggleMeetChat = toggleMeetChat;
toggleMeetChat = function() {
  _origToggleMeetChat();
  if (meet.isChatOpen) loadMeetChatHistory();
};



// 🚪 مغادرة غرفة الاجتماع
function leaveMeetRoom() {
  if (!meet.roomId) return;
  const roomToLeave = meet.roomId;
  // 🆕 إيقاف أي رنة متكررة + إغلاق لوحة الشات + الإشعار العائم
  stopAllMeetRingtones();
  closeMeetChatPanel();
  closeHandNotification();
  const floating = document.getElementById('meetFloatingInvite');
  if (floating) floating.remove();
  // إيقاف جميع الـ tracks
  if (meet.localStream) {
    meet.localStream.getTracks().forEach(t => t.stop());
    meet.localStream = null;
  }
  if (meet.screenStream) {
    meet.screenStream.getTracks().forEach(t => t.stop());
    meet.screenStream = null;
  }
  // إغلاق الـ peer connection
  if (meet.peerConn) { try { meet.peerConn.close(); } catch(e){} meet.peerConn = null; }
  // إزالة المستمعين
  meet.firebaseListeners.forEach(off => { try { off(); } catch(e){} });
  meet.firebaseListeners = [];
  if (meet._heartbeat) { clearInterval(meet._heartbeat); meet._heartbeat = null; }
  // الخروج من وضع ملء الشاشة إن كان مفعلاً
  if (document.fullscreenElement) { try { document.exitFullscreen(); } catch(e){} }
  meet.isFullscreen = false;
  meet.isHandRaised = false;
  meet.isMicLockedByAdmin = false;
  meet.handRaisedList.clear();
  // حذف وجودي من Firebase
  if (meet.userId) {
    database.ref('meet/' + roomToLeave + '/participants/' + meet.userId).remove();
    // تنظيف signaling الخاص بي
    database.ref('meet/' + roomToLeave + '/candidates/' + meet.userId).remove();
    database.ref('meet/' + roomToLeave + '/offer/' + meet.userId).remove();
    database.ref('meet/' + roomToLeave + '/answer/' + meet.userId).remove();
  }
  meet.remoteStreams.clear();
  meet.dataChannels.clear();
  meet.roomId = null;
  meet.userId = null;
  meet.isAudioMuted = false; meet.isVideoMuted = false; meet.isScreenSharing = false;
  // 🆕 تنظيف الشات الجديد
  meet.groupMessages = [];
  meetChat.unreadGroup = 0;
  meetChat.unreadDmTotal = 0;
  meetChat.activeDmUid = null;
  // 🔥 تفريغ الغرفة (محو كامل لها في Firebase) لتختفي من قائمة الغرف النشطة فوراً
  // هذا يطبق على الجميع — عند خروج آخر شخص، تختفي الغرفة
  // لكن للمديرية نوفر خيار "إنهاء الاجتماع للجميع" عبر forceEndMeetForAll
  setTimeout(() => {
    database.ref('meet/' + roomToLeave + '/participants').once('value', snap => {
      const remaining = snap.val() || {};
      const remainingCount = Object.keys(remaining).length;
      if (remainingCount === 0) {
        // لا أحد في الغرفة — نحذفها بالكامل
        database.ref('meet/' + roomToLeave).remove();
        console.log('[meet] room ' + roomToLeave + ' cleared (no participants)');
      }
    });
  }, 1500);
  // إعادة عرض الشاشة الافتراضية
  const stage = document.getElementById('meetStage');
  if (stage) {
    stage.innerHTML = `
      <div class="meet-empty-state" id="meetEmptyState">
        <div class="meet-icon-big"><i class="fa-solid fa-video"></i></div>
        <h3>مرحباً بك في قاعة الاجتماعات</h3>
        <p>أنشئ غرفة جديدة أو انضم إلى غرفة موجودة للتواصل بالصوت والصورة مع الزملاء في الوقت الفعلي. يمكنك أيضاً مشاركة شاشتك أثناء الاجتماع.</p>
      </div>
    `;
  }
  showToast('👋 تم إنهاء المكالمة', 'لقد غادرت الغرفة ' + roomToLeave);
}

// 🚪 المديرية فقط: إنهاء الاجتماع لكافة المشاركين (يطرد الجميع)
function forceEndMeetForAll() {
  if (!meet.roomId) return;
  if (currentRole !== 'directorate') {
    showToast('⚠️ غير مسموح', 'هذه الخاصية متاحة للمديرية فقط');
    return;
  }
  if (!confirm('هل تريد إنهاء الاجتماع وإخراج جميع المشاركين؟ سيتم حذف الغرفة بالكامل.')) return;
  const roomToEnd = meet.roomId;
  // بث إشعار لجميع المشاركين قبل الحذف (ليروا نافذة "تم إنهاء الاجتماع")
  for (const [, ch] of meet.dataChannels) {
    try { if (ch.readyState === 'open') ch.send(JSON.stringify({ type: 'kicked', roomId: roomToEnd, by: 'directorate' })); } catch(e){}
  }
  // حذف الغرفة بالكامل من Firebase — سيختفي الجميع تلقائياً لأن المستمعين سيرصدون الحذف
  setTimeout(() => {
    database.ref('meet/' + roomToEnd).remove();
    showToast('🛑 تم إنهاء الاجتماع', 'تم طرد جميع المشاركين وحذف الغرفة');
  }, 500);
}

// عند تسجيل الخروج، تأكد من مغادرة أي غرفة
const _origLogout = logout;
logout = function() {
  if (meet.roomId) leaveMeetRoom();
  _origLogout();
};

// 🆕 تنظيف تلقائي محسّن للغرف المهجورة:
//  - الغرف الفارغة (بدون مشاركين) تُحذف بعد دقيقتين من آخر نشاط
//  - الغرف التي لم يتجدد lastSeen منذ أكثر من 30 دقيقة تُحذف تلقائياً (حتى لو كانت "نشطة")
//    لتفادي تراكم غرف ميتة في قائمة "الغرف النشطة" عند فتح المنصة
setInterval(() => {
  const now = Date.now();
  const EMPTY_ROOM_TTL = 2 * 60 * 1000;      // دقيقتان للغرف الفارغة
  const ABANDONED_ROOM_TTL = 30 * 60 * 1000; // 30 دقيقة كحد أقصى لأي غرفة
  database.ref('meet').once('value', snap => {
    const all = snap.val() || {};
    const updates = {};
    Object.keys(all).forEach(roomId => {
      const room = all[roomId] || {};
      const lastSeen = room.lastSeen || 0;
      const partCount = Object.keys(room.participants || {}).length;
      if (partCount === 0 && now - lastSeen > EMPTY_ROOM_TTL) {
        // غرفة فارغة منذ أكثر من دقيقتين — احذفها
        updates['meet/' + roomId] = null;
      } else if (now - lastSeen > ABANDONED_ROOM_TTL) {
        // أي غرفة لم يتجدد نشاطها منذ 30 دقيقة — احذفها (حتى لو فيها مشاركون قُدامى)
        updates['meet/' + roomId] = null;
      }
    });
    if (Object.keys(updates).length > 0) {
      database.ref().update(updates).catch(err => console.warn('[meet] auto-cleanup error:', err));
    }
  });
}, 60 * 1000);

