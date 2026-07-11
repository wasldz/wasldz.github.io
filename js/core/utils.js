// ============================================
// 🛠️ دوال مساعدة عامة
// escape, format, timeAgo, etc.
// ============================================

// 🔧 UTILS
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// 🔗 تحويل الروابط في النص إلى روابط قابلة للضغط (مع الحماية من XSS)
function linkifyText(str) {
  if (str === undefined || str === null) return '';
  var escaped = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  var urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
  return escaped.replace(urlRegex, function(url) {
    var href = url.startsWith('www.') ? 'https://' + url : url;
    return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;word-break:break-all;" onclick="event.stopPropagation();">' + url + '</a>';
  });
}




// 📖 عرض المقولات الدينية
function displayRandomQuote() {
  const quote = religiousQuotes[Math.floor(Math.random() * religiousQuotes.length)];
  const footer = document.getElementById('appRoot');
  
  let quoteContainer = document.getElementById('quoteContainer');
  if (!quoteContainer) {
  quoteContainer = document.createElement('div');
  quoteContainer.id = 'quoteContainer';
  quoteContainer.style.cssText = `
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  background: linear-gradient(135deg, rgba(0, 122, 61, 0.95), rgba(0, 166, 81, 0.85));
  backdrop-filter: blur(10px);
  color: #fff;
  padding: 28px 40px;
  border-radius: 20px;
  max-width: 700px;
  text-align: center;
  font-size: 22px;
  font-weight: 500;
  line-height: 2;
  box-shadow: 0 16px 50px rgba(0, 122, 61, 0.35);
  border: 2px solid rgba(255, 255, 255, 0.3);
  animation: quoteSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
  `;
  footer.appendChild(quoteContainer);
  }
  
  quoteContainer.style.display = 'block';
  quoteContainer.textContent = quote;
  quoteContainer.style.animation = 'none';
  setTimeout(() => quoteContainer.style.animation = 'quoteSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)', 10);
  
  // إخفاء المقولة بعد 5 ثوان (نخفيها فعلياً بـ display:none حتى لا تبقى
  // طبقة شبحية غير مرئية فوق الواجهة تمنع الضغط على العناصر تحتها، كزر الإرسال)
  setTimeout(() => {
    quoteContainer.style.animation = 'quoteFadeOut 0.6s ease-in forwards';
    setTimeout(() => { quoteContainer.style.display = 'none'; }, 650);
  }, 5000);
}

