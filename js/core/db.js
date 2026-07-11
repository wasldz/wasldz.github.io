// ============================================
// 🗄️ عمليات قاعدة البيانات Firebase
// كل عمليات القراءة والكتابة
// ============================================

// 🕵️ سجل التدقيق (Audit Log)
function addAuditLog(action, code, details) {
  auditLog.unshift({
    action,
    code: code || '-',
    details: details || '',
    actor: (currentRole === 'directorate') ? 'المديرية' : (currentRole === 'department' ? (getDepartmentName(currentDepartment) || 'مصلحة') : (getCenterName() || 'مركز')),
    time: Date.now()
  });
  if (auditLog.length > 500) auditLog = auditLog.slice(0, 500);
  // لا حفظ محلي هنا؛ الاستدعاء المرافق لـ saveToFirebase() في مكان الاستدعاء
  // هو من يبثّ سجل التدقيق إلى Firebase.
}

function renderAuditLog() {
  const tbody = document.getElementById('auditLogTableBody');
  if (!tbody) return;
  if (auditLog.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">لا توجد إجراءات مسجلة بعد.</td></tr>`; return; }
  tbody.innerHTML = auditLog.map(entry => `<tr>
    <td style="font-size:15px;">${getTimeAgo(entry.time)}</td>
    <td style="font-size:15px; font-weight:700;">${escapeHtml(entry.action)}</td>
    <td style="font-size:15px;">${escapeHtml(entry.code)}</td>
    <td style="font-size:15px; color:var(--text-dim);">${escapeHtml(entry.details)} — ${escapeHtml(entry.actor)}</td>
  </tr>`).join('');
}



// 📤 تصدير البيانات إلى CSV
function exportToCSV(rows, headers, filename) {
  if (!rows || rows.length === 0) { showToast('⚠️ تنبيه', 'لا توجد بيانات لتصديرها'); return; }
  const escapeCsv = (val) => {
    const s = (val === null || val === undefined) ? '' : String(val);
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [headers.map(escapeCsv).join(',')];
  rows.forEach(row => { lines.push(row.map(escapeCsv).join(',')); });
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('✅ تم التصدير', `تم تصدير الملف ${filename}`);
}

function exportListToCSV() {
  const headers = ['الرمز', 'المؤسسة', 'التصنيف', 'المصلحة', 'الأولوية', 'المحرر', 'المصدر', 'الحالة', 'التاريخ'];
  const rows = activeIssues.map(i => [i.code, i.center, i.type, getDepartmentName(i.department), i.priority, i.author, i.source, i.status, new Date(i.createdAt).toLocaleString('ar-DZ')]);
  exportToCSV(rows, headers, `الانشغالات_النشطة_${Date.now()}.csv`);
}

function exportArchiveToCSV() {
  const headers = ['الرمز', 'المؤسسة', 'التصنيف', 'المصلحة', 'الأولوية', 'المحرر', 'المصدر', 'التاريخ'];
  const rows = archivedIssues.map(i => [i.code, i.center, i.type, getDepartmentName(i.department), i.priority, i.author, i.source, new Date(i.createdAt).toLocaleString('ar-DZ')]);
  exportToCSV(rows, headers, `أرشيف_الانشغالات_${Date.now()}.csv`);
}

// المقولات الدينية (100 مقولة)
const religiousQuotes = [
  "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
  "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "الحمد لله رب العالمين", "سبحان الله وبحمده، سبحان الله العظيم",
  "لا حول ولا قوة إلا بالله العلي العظيم", "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
  "إلَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ", "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ", "وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ",
  "إِنَّ مَعَ الْعُسْرِ يُسْرًا", "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا", "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
  "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ", "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الشَّرِّ كُلِّهِ", "سَلَامٌ عَلَيْكُم وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ",
  "يا كافي يا غني يا ذا القوة المتين", "يا ذا الجلال والإكرام", "يا عزيز يا حكيم", "يا رحمن يا رحيم", "يا قهار يا جبار",
  "وَقُلْ رَبِّ زِدْنِي عِلْمًا", "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا", "رَبَّنَا اغْفِرْ لَنَا وَلِإِخْوَانِنَا الَّذِينَ سَبَقُونَا بِالْإِيمَانِ",
  "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً", "سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلَا إِلَٰهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ",
  "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير", "أشهد أن لا إله إلا الله وأشهد أن محمداً رسول الله",
  "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم استجب دعاءنا وتقبل منا", "اللهم اهدنا إلى صراطك المستقيم",
  "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمدً",
  "اللهم اشرح لنا صدورنا ويسر لنا أمرنا", "رب اشرح لي صدري ويسر لي أمري واحلل عقدة من لساني",
  "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمدُ",
  "وَإِن تَعُدُّوا نِعْمَةَ اللَّهِ لَا تُحْصُوهَا", "اللهم صل وسلم وبارك على سيدنا محمد", "فَاذْكُرُونِ أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ",
  "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد",
  "وَاصْبِرْ وَمَا صَبْرُكَ إِلَّا بِاللَّهِ", "إِنَّ اللَّهَ مَعَ الَّذِينَ اتَّقَوا وَالَّذِينَ هُم مُّحْسِنُونَ", "اللهم صل وسلم وبارك على سيدنا محمد",
  "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد",
  "إاللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد", "الكلمة الطيبة صدقة",
  "تبسمك في وجه أخيك لك صدقة", "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد",
  "اللهم صل وسلم وبارك على سيدنا محمد", "يا حي يا قيوم برحمتك أستغيث", "ما شاء الله لا قوة إلا بالله",
  "اللهم صل وسلم وبارك على سيدنا محمد", "وما بكم من نعمة فمن الله", "والله يرزق من يشاء بغير حساب", "اللهم صل وسلم وبارك على سيدنا محمد",
  "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد", "فاتقوا الله ما استطعتم",
  "الله لطيف بعباده", "اللهم صل وسلم وبارك على سيدنا محمد", "إن الله لا يخيب رجاء من دعاه",
  "ويرفع الله الذين آمنوا منكم والذين أوتوا العلم درجات", "اللهم علمنا ما ينفعنا وانفعنا بما علمتنا",
  "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد",
  "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم اغفر للمؤمنين والمؤمنات", "اللهم صل وسلم وبارك على سيدنا محمد",
  "اللهم اجعلنا ممن يستمعون القول فيتبعون أحسنه", "اللهم صل وسلم وبارك على سيدنا محمد",
  "اللهم وفقنا لما فيه الخير والصلاح", "سبحانك اللهم وبحمدك أستغفرك وأتوب إليك",
  "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد", "اللهم صل وسلم وبارك على سيدنا محمد"
];

// دالة لتشغيل صوت الإشعار
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch(e) {
    console.log('[v0] Could not play notification sound:', e);
  }
}

// ⚠️ ملاحظة: تم عمداً حذف مفاتيح البيانات الضخمة (الانشغالات، الأرشيف، المصالح،
// التصنيفات، سجل التدقيق...) من localStorage. هذه البيانات أصبحت تُدار بالكامل
// عبر Firebase (متغيرات في الذاكرة + مستمعون Realtime)، لتفادي تضخم localStorage
// مع نمو الأرشيف وتفادي أي التباس بين نسخة محلية قديمة ونسخة الخادم.
const LS_KEYS = {
  notes: "hassan_notes",
  centerName: "center_app_name",
  remember: "hassan_remember",
  theme: "hassan_theme",
  masterPass: "hassan_master_pass",
  lastSync: "hassan_last_sync",
  session: "hassan_session",
  mute: "hassan_mute_notifications"
};

const DEFAULT_FILE_TYPES = ["منظومة الرقمنة والأرضية الرقمية","مصلحة المتابعة البيداغوجية والبرامج","الهياكل والشبكات وتكنولوجيا المعلومات","الموارد البشرية والتكوين","الصيانة والتجهيزات"];

const INSTITUTIONS_DATA = [
  { name: "المعهد الوطني المتخصص في التكوين المهني ب .ب.ع 01", code: "INSFP001", password: "789012", type: "center" },
  { name: "المعهد الوطني المتخصص في التكوين المهني ب .ب.ع 02", code: "INSFP002", password: "456789", type: "center" },
  { name: "المعهد الوطني المتخصص في التكوين المهني رأس الوادي", code: "INSFP003", password: "123456", type: "center" },
  { name: "مركز التكوين المهني و التمهين برج بوعريريج03", code: "CFPA001", password: "654321", type: "center" },
  { name: "مركز التكوين المهني و التمهين العش", code: "CFPA002", password: "987654", type: "center" },
  { name: "مركز التكوين المهني و التمهين برج بوعريريج04", code: "CFPA003", password: "321987", type: "center" },
  { name: "مركز التكوين المهني و التمهين حسناوة", code: "CFPA004", password: "159753", type: "center" },
  { name: "مركز التكوين المهني و التمهين الياشير", code: "CFPA005", password: "753951", type: "center" },
  { name: "مركز التكوين المهني و التمهين بليمور", code: "CFPA006", password: "852456", type: "center" },
  { name: "مركز التكوين المهني و التمهين الجعافرة", code: "CFPA007", password: "951753", type: "center" },
  { name: "مركز التكوين المهني و التمهين خليل", code: "CFPA008", password: "357159", type: "center" },
  { name: "مركز التكوين المهني والتمهين المهير", code: "CFPA009", password: "246813", type: "center" },
  { name: "مركز التكوين المهني و التمهين الحمادية", code: "CFPA010", password: "579123", type: "center" },
  { name: "مركز التكوين المهني و التمهين برج الغدير", code: "CFPA011", password: "864209", type: "center" },
  { name: "مركز التكوين المهني و التمهين عين تاغروت", code: "CFPA012", password: "135790", type: "center" },
  { name: "مركز التكوين المهني و التمهين العناصر", code: "CFPA013", password: "246801", type: "center" },
  { name: "مركز التكوين المهني و التمهين راس الوادي", code: "CFPA014", password: "802468", type: "center" },
  { name: "مركز التكوين المهني و التمهين مجانة", code: "CFPA015", password: "951357", type: "center" },
  { name: "مركز التكوين المهني و التمهين المنصورة", code: "CFPA016", password: "123789", type: "center" },
  { name: "مركز التكوين المهني و التمهين برج زمورة", code: "CFPA017", password: "456123", type: "center" },
  { name: "مركز التكوين المهني والتمهين ذكور", code: "CFPA018", password: "789456", type: "center" },
  { name: "احمد للتكوين", code: "PRV001", password: "321654", type: "private" },
  { name: "وشن سكول", code: "PRV002", password: "654987", type: "private" },
  { name: "لكبير للتكوين المهني", code: "PRV003", password: "987123", type: "private" },
  { name: "ايكول صخراوي", code: "PRV004", password: "123987", type: "private" },
  { name: "سعاد ماضوي لتكوين", code: "PRV005", password: "456789", type: "private" },
  { name: "براح سكول", code: "PRV006", password: "789123", type: "private" },
  { name: "الأنامل الذهبية", code: "PRV007", password: "147258", type: "private" },
  { name: "يد الأمل", code: "PRV008", password: "258369", type: "private" },
  { name: "لبرايجيه", code: "PRV009", password: "369147", type: "private" },
  { name: "شامل سكول", code: "PRV010", password: "471258", type: "private" },
  { name: "ملحقة المؤسسة الخاصة للتكوين المهني ايكول صخراوي", code: "PRV011", password: "582369", type: "private" },
  { name: "المؤسسة الخاصة للتكوين المهني خطوط المستقبل", code: "PRV012", password: "693147", type: "private" },
  { name: "نوران", code: "PRV013", password: "714258", type: "private" },
  { name: "داماس", code: "PRV014", password: "825369", type: "private" },
  { name: "المؤسسة الخاصة للتكوين المهني البصير برو", code: "PRV015", password: "936147", type: "private" },
  { name: "بلانيت وصال", code: "PRV016", password: "147369", type: "private" },
  { name: "الأميرة الصغيرة", code: "PRV017", password: "258147", type: "private" },
  { name: "الملكة الماسية", code: "PRV018", password: "369258", type: "private" },
  { name: "البيروني", code: "PRV019", password: "471369", type: "private" },
  { name: "المقراني سكول", code: "PRV020", password: "582147", type: "private" },
  { name: "المؤسسة الخاصة للتكوين المهني السليل", code: "PRV021", password: "693258", type: "private" },
  { name: "كوندور اكاديمي", code: "PRV022", password: "714369", type: "private" },
  { name: "ولد اعمر", code: "PRV023", password: "825147", type: "private" },
  { name: "المؤسسة الخاصة للتكوين المهني عقباش", code: "PRV024", password: "936258", type: "private" }
];



// 💾 STORAGE HELPERS
function loadDB() {
  // 🔥 لا نقرأ البيانات الضخمة من localStorage إطلاقاً.
  // نبدأ بقيم فارغة/افتراضية مؤقتة، وسرعان ما يملأها Firebase عبر
  // listenToFirebase() و القراءة الفورية once('value') في initApp().
  activeIssues = [];
  archivedIssues = [];
  fileTypes = DEFAULT_FILE_TYPES.slice();
  centerIssues = [];
  centerArchived = [];
  interChatMessages = [];
  auditLog = [];
  departments = DEPARTMENTS_BASE.slice();

  const savedPass = localStorage.getItem(LS_KEYS.masterPass);
  if (savedPass) MASTER_PASSWORD = savedPass;
  lastSyncTimestamp = parseInt(localStorage.getItem(LS_KEYS.lastSync) || "0");
  isMuted = localStorage.getItem(LS_KEYS.mute) === "1";
}

// 🔥 نتذكر آخر نسخة (JSON) تم إرسالها فعلياً لكل حقل، حتى لا نعيد كتابة/بث
// حقل لم يتغير (مثل الأرشيف) في كل مرة يتغير فيها حقل آخر فقط (كنشغال جديد
// أو رسالة شات). هذا هو سبب "الثقل" الحقيقي: كل استدعاء لـ saveToFirebase()
// كان يرسل الأرشيف الكامل من جديد حتى لو لم يتغيّر شيء فيه، مما يجعل Firebase
// يعيد بثّه لكل المستخدمين المتصلين عبر مستمع data/archivedIssues.
let _lastPushedJSON = {};

function _pushToFirebaseNow() {
  // 🔥 ملاحظة: interChatMessages لم يعد ضمن هذه الدفعة المُجمّعة؛ محادثة
  // المؤسسات تُرسَل الآن فوراً رسالة برسالة عبر appendInterChatMessage()
  // (push مستقل)، بنفس منطق الشات الفردي — راجع تعليق التوضيح أعلى الدالة.
  const candidates = {
    activeIssues: activeIssues,
    archivedIssues: archivedIssues,
    centerIssues: centerIssues,
    centerArchived: centerArchived,
    fileTypes: fileTypes,
    departments: departments,
    auditLog: auditLog
  };

  const toSend = {};
  let hasChanges = false;
  for (const key in candidates) {
    const json = JSON.stringify(candidates[key]);
    if (_lastPushedJSON[key] !== json) {
      toSend[key] = candidates[key];
      _lastPushedJSON[key] = json;
      hasChanges = true;
    }
  }

  if (!hasChanges) return; // لا شيء تغيّر فعلياً، لا داعي لأي طلب شبكي

  toSend.timestamp = Date.now();

  // 🔥 استخدام update() بدل set(): لا يحذف أي مفتاح غير مذكور، وأكثر أمانًا
  database.ref('data').update(toSend).catch(err => {
    console.log('[v0] خطأ في الحفظ على Firebase:', err);
    showToast('⚠️ تحذير', 'فشل الحفظ على الخادم، حاول تحديث الصفحة أو التحقق من الاتصال');
  });
}

// ⚡ تأخير (debounce) الكتابة الفعلية على الشبكة فقط: يجمع الاستدعاءات المتتالية
// السريعة في طلب شبكي واحد بدل إرسال كل البيانات مع كل تغيير صغير
const _debouncedPushToFirebase = debounce(_pushToFirebaseNow, 400);

function saveToFirebase() {
  // 🔥 لا يوجد أي حفظ في localStorage هنا. Firebase وحده هو مصدر الحقيقة،
  // ودالة _pushToFirebaseNow أعلاه تتكفّل بإرسال الحقول المتغيّرة فقط.
  _debouncedPushToFirebase();
}

// عند إغلاق الصفحة بسرعة قد يضيع تغيير لم يُرسل بعد بسبب الـ debounce (400ms).
// هذا يضمن إرسال أي تغيير معلّق فوراً قبل مغادرة الصفحة.
window.addEventListener('beforeunload', () => {
  _pushToFirebaseNow();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') _pushToFirebaseNow();
});

// 🔥 استماع مُجزّأ: كل حقل من البيانات له مستمع مستقل تحت data/*
// الفائدة: أي تغيير صغير (مثلاً تصنيف واحد) لا يجرّ معه بقية البيانات الضخمة
// (الانشغالات، الأرشيف...) عبر الشبكة لكل المستخدمين المتصلين — كما كان يحدث
// سابقاً مع مستمع واحد على عقدة data الكاملة.
// 🔧 مساعد صغير: كل مرة نستقبل فيها قيمة حقل من Firebase، نسجّلها في
// _lastPushedJSON أيضاً. هكذا لا يظن الجهاز أن الحقل "تغيّر محلياً" ويعيد
// بثّه من جديد لبقية المستخدمين في أول saveToFirebase() تالية لسبب آخر تماماً.
function _markSynced(key, val) {
  _lastPushedJSON[key] = JSON.stringify(val);
}

// 🎨 نبضة بصرية قصيرة على شارة التزامن لتأكيد وصول بيانات جديدة فعلياً
function pulseSyncBadge() {
  const badge = document.getElementById('syncBadge');
  if (!badge) return;
  badge.classList.remove('pulse');
  void badge.offsetWidth; // إعادة تشغيل الأنيميشن حتى لو تكررت النبضات بسرعة
  badge.classList.add('pulse');
}

function listenToFirebase() {
  database.ref('data/activeIssues').on('value', (snapshot) => {
    const val = snapshot.val();
    if (!val) return;
    const oldCount = activeIssues.length;
    activeIssues = val;
    if (currentRole === 'center') detectIncomingDirectorateIssues(val);
    _markSynced('activeIssues', val);
    pulseSyncBadge();
    if (activeIssues.length > oldCount) {
      if (!isMuted) playNotificationSound();
      showToast('📩 إنشغال جديد', 'تم استلام إنشغال جديد من أحد المراكز!');
    }
    updateUI();
  });

  database.ref('data/archivedIssues').on('value', (snapshot) => {
    const val = snapshot.val();
    if (!val) return;
    archivedIssues = val;
    _markSynced('archivedIssues', val);
    pulseSyncBadge();
    updateUI();
  });

  database.ref('data/centerIssues').on('value', (snapshot) => {
    const val = snapshot.val();
    if (!val) return;
    const oldCount = centerIssues.length;
    centerIssues = val;
    _markSynced('centerIssues', val);
    pulseSyncBadge();
    if (centerIssues.length > oldCount) {
      if (!isMuted) playNotificationSound();
      showToast('📩 إنشغال جديد', 'تم استلام إنشغال جديد من أحد المراكز!');
    }
    updateUI();
  });

  database.ref('data/centerArchived').on('value', (snapshot) => {
    const val = snapshot.val();
    if (!val) return;
    centerArchived = val;
    _markSynced('centerArchived', val);
    pulseSyncBadge();
    updateUI();
  });

  // 🔥 ملاحظة: محادثة المؤسسات (interChat) لم تعد تُقرأ من data/interChat هنا؛
  // أصبحت تُدار بشكل مستقل عبر listenToInterChat() (انظر أسفل) بنمط push()
  // لكل رسالة بدل الكتابة فوق مصفوفة كاملة — انظر تعليق appendInterChatMessage.

  database.ref('data/fileTypes').on('value', (snapshot) => {
    const val = snapshot.val();
    if (!val) return;
    fileTypes = val;
    _markSynced('fileTypes', val);
    console.log('[v0] تم تحديث التصنيفات من Firebase:', fileTypes.length);
    updateUI();
  });

  database.ref('data/departments').on('value', (snapshot) => {
    const val = snapshot.val();
    if (!val) return;
    departments = val;
    // التأكد من وجود جميع المصالح الأساسية
    DEPARTMENTS_BASE.forEach(base => {
      if (!departments.find(d => d.id === base.id)) {
        departments.push({...base});
      }
    });
    _markSynced('departments', departments);
    updateUI();
  });

  database.ref('data/auditLog').on('value', (snapshot) => {
    const val = snapshot.val();
    if (!val) return;
    auditLog = val;
    _markSynced('auditLog', val);
    updateUI();
  });
}

function forceSync() {
  const badge = document.getElementById('syncBadge');
  if (!badge) return;
  const originalHtml = badge.innerHTML;
  badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحديث...';
  badge.style.opacity = '0.7';
  
  database.ref('data').once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      if (data.activeIssues) activeIssues = data.activeIssues;
      if (data.archivedIssues) archivedIssues = data.archivedIssues;
      if (data.centerIssues) centerIssues = data.centerIssues;
      if (data.centerArchived) centerArchived = data.centerArchived;
      if (data.fileTypes) {
        fileTypes = data.fileTypes;
        console.log('[v0] تم تحديث التصنيفات من خادم Firebase:', fileTypes.length);
      }
      if (data.departments) {
        departments = data.departments;
        DEPARTMENTS_BASE.forEach(base => {
          if (!departments.find(d => d.id === base.id)) {
            departments.push({...base});
          }
        });
      }
      if (data.auditLog) auditLog = data.auditLog;
      _markSynced('fileTypes', fileTypes);
      _markSynced('auditLog', auditLog);
      updateUI();
      showToast('✅ تم التحديث', 'تم جلب أحدث البيانات بنجاح');
    }
    badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم التحديث ✅';
    badge.style.opacity = '1';
    setTimeout(() => { badge.innerHTML = originalHtml; }, 2000);
  }).catch(() => {
    showToast('❌ خطأ', 'فشل جلب البيانات من الخادم');
    badge.innerHTML = originalHtml;
    badge.style.opacity = '1';
  });
}

function updateUI() {
  updateNavBadges();
  if (currentRole === 'directorate') {
    renderKPIs();
    updateChart();
    renderList();
    renderArchive();
    renderTokensGrid();
    renderFileTypesManageList();
    renderDepartmentsList();
    renderDeptDashboard();
    populateDeptFilters();
    populateCenterTargetDepts();
    populateDropdowns();
  } else if (currentRole === 'department') {
    renderDepartmentIssues();
    renderDeptKPIs();
    populateDropdowns();
  } else {
    renderChatHub();
    refreshCenterUI();
    populateCenterTargetDepts();
    populateDropdowns();
  }
}

// 🎨 شارة عدد صغيرة على أزرار التنقل توضح عدد الانشغالات قيد المعالجة دون
// الحاجة لفتح القسم — تُحدَّث تلقائياً مع كل updateUI()
function updateNavBadges() {
  if (currentRole === 'directorate') {
    const pendingCount = activeIssues.filter(i => !(i.status && i.status.indexOf('تم الحل') !== -1)).length;
    const badge = document.getElementById('navBadgeList');
    if (badge) {
      if (pendingCount > 0) { badge.textContent = pendingCount; badge.style.display = 'inline-flex'; }
      else { badge.style.display = 'none'; }
    }
  } else if (currentRole === 'department') {
    const pendingCount = activeIssues.filter(i => i.department === currentDepartment && !(i.status && i.status.indexOf('تم الحل') !== -1)).length;
    const badge = document.getElementById('navBadgeDeptIssues');
    if (badge) {
      if (pendingCount > 0) { badge.textContent = pendingCount; badge.style.display = 'inline-flex'; }
      else { badge.style.display = 'none'; }
    }
  }
}

