// ============================================
// 🌓 إدارة الثيم (Light/Dark)
// تبديل الوضع الليلي/النهاري
// ============================================

// 🌓 THEME
function toggleTheme() {
  const html = document.getElementById('htmlRoot');
  const icon = document.getElementById('themeIcon');
  if (html.getAttribute('data-theme') === 'dark') {
    html.removeAttribute('data-theme');
    icon.className = 'fa-solid fa-moon';
    localStorage.setItem(LS_KEYS.theme, 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    icon.className = 'fa-solid fa-sun';
    localStorage.setItem(LS_KEYS.theme, 'dark');
  }
}

function loadTheme() {
  const theme = localStorage.getItem(LS_KEYS.theme);
  const html = document.getElementById('htmlRoot');
  const icon = document.getElementById('themeIcon');
  if (theme === 'dark') { html.setAttribute('data-theme', 'dark'); icon.className = 'fa-solid fa-sun'; }
}



// 🔇 كتم/تشغيل إشعارات الصوت
function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem(LS_KEYS.mute, isMuted ? "1" : "0");
  updateMuteIcon();
  showToast(isMuted ? '🔇 تم كتم الإشعارات' : '🔔 تم تفعيل الإشعارات', isMuted ? 'لن يصدر صوت عند الإشعارات الجديدة' : 'سيصدر صوت عند الإشعارات الجديدة');
}

function updateMuteIcon() {
  const icon = document.getElementById('muteIcon');
  if (icon) icon.className = isMuted ? 'fa-solid fa-bell-slash' : 'fa-solid fa-bell';
}

