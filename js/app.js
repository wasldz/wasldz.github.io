// ============================================
// 🚀 نقطة الدخول الرئيسية
// Window.onload + Initialization
// ============================================

// 🌐 WINDOW ONLOAD
window.onload = function() {
  loadTheme();
  selectLoginRole('directorate');
  loadRemembered();
  listenToChats();
  isMuted = localStorage.getItem(LS_KEYS.mute) === "1";
  updateMuteIcon();
  resumePendingPasswordRequest();
  // إذا كانت هناك جلسة دخول محفوظة، نعيد فتح التطبيق مباشرة دون العودة لشاشة الدخول
  restoreSession();
};

// ⚠️ تم حذف مستمع 'storage' الخاص بمزامنة التبويبات عبر localStorage: لم يعد
// له أي فائدة الآن لأن كل البيانات تُزامَن مباشرة عبر مستمعي Firebase أعلاه،
// وهي تعمل بنفس الكفاءة بين التبويبات وبين الأجهزة المختلفة.

console.log('🚀 منصة التنسيق الرقمي - تعمل مع Firebase');
console.log('📡 تحديث فوري بين جميع الأجهزة!');
console.log('🏢 نظام المصالح (المكاتب) مفعل مع قائمة منسدلة!');
console.log('🔐 كلمات السر ثابتة لكل مصلحة - يتم إدخالها يدوياً');
console.log('✏️ يمكن تعديل اسم المصلحة والمكلف بها فقط من المديرية');
console.log('🏛️ المراكز يمكنها اختيار المصلحة المستهدفة عند الإرسال');
console.log('🔥 Firebase متصل: ' + firebaseConfig.databaseURL);


(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'a197fa9bde48b6bf',t:'MTc4Mzc3NDY5OA=='};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();

(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'a1986f17ddb4336f',t:'MTc4Mzc3OTQ3MA=='};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();

(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'a19911b3a86bb6c7',t:'MTc4Mzc4NjEzMA=='};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();