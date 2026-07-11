// ============================================
// 🔔 نظام الإشعارات
// Toast + Browser Notifications
// ============================================

// 🍞 TOAST
function showToastWithAction(title, text, action) {
  const area = document.getElementById('toast-area');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<div><div class="toast-title">${escapeHtml(title)}</div><div class="toast-text">${escapeHtml(text)}</div><div class="toast-action"><i class="fa-solid fa-hand-pointer"></i> اضغط لعرض الرسالة</div></div>`;
  toast.onclick = function() { toast.remove(); if (action) action(); };
  area.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 8000);
  return toast;
}

function showToast(title, text) {
  const area = document.getElementById('toast-area');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<div><div class="toast-title">${escapeHtml(title)}</div><div class="toast-text">${escapeHtml(text)}</div></div>`;
  toast.onclick = function() { toast.remove(); };
  area.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}



// 🔔 إشعارات المتصفح (Web Notifications API) — تحسين الديناميكية #6
// تظهر إشعارات النظام حتى عندما تكون الصفحة/التبويب في الخلفية أو مصغّرة
// (توست الصفحة الحالي لا يظهر إلا والصفحة مرئية في المقدّمة). نطلب الإذن
// مرة واحدة بعد تسجيل الدخول، ونعرض إشعار نظام موازٍ للـ toast عند وصول
// رسالة جديدة فقط إذا كان التبويب غير ظاهر حالياً (لتفادي إزعاج مضاعف).
function requestBrowserNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    // نطلب الإذن بهدوء دون حجب الواجهة؛ المتصفح سيتجاهل الطلب تلقائياً
    // إذا لم يكن ناتجاً عن تفاعل مستخدم حديث في بعض المتصفحات، وهذا مقبول.
    Notification.requestPermission().catch(() => {});
  }
}

function notifyBrowser(title, body, onClick) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    // لا داعي لإشعار نظام إضافي إذا كانت الصفحة ظاهرة فعلاً أمام المستخدم
    if (document.visibilityState === 'visible') return;
    if (isMuted) return;
    const n = new Notification(title, { body, tag: 'platform-msg-' + Date.now() });
    n.onclick = function() {
      window.focus();
      n.close();
      if (onClick) onClick();
    };
  } catch (e) { console.warn('[notify] فشل إظهار إشعار المتصفح:', e); }
}

