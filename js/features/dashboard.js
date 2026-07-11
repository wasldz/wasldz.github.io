// ============================================
// 📊 لوحة التحكم والإحصائيات
// Dashboard + KPIs + Charts
// ============================================

// 📊 DASHBOARD FUNCTIONS
function renderKPIs() {
  const total = activeIssues.length + archivedIssues.length;
  const pending = activeIssues.length;
  const done = archivedIssues.length;
  const efficiency = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-pending').textContent = pending;
  document.getElementById('kpi-done').textContent = done;
  document.getElementById('kpi-efficiency').textContent = efficiency + '%';
}

function initChart() {
  const ctx = document.getElementById('analyticsChart').getContext('2d');
  analyticsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['الإجمالي', 'قيد المعالجة', 'المسواة'], datasets: [{ label: 'عدد الإنشغالات', data: [activeIssues.length + archivedIssues.length, activeIssues.length, archivedIssues.length], backgroundColor: ['#006633', '#ffc107', '#28a745'], borderRadius: 8, maxBarThickness: 50 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#6c757d', font: { family: 'Cairo', weight: '700', size: 14 } }, grid: { color: 'rgba(0,0,0,0.04)' } }, y: { beginAtZero: true, ticks: { color: '#6c757d', font: { family: 'Cairo', size: 14 } }, grid: { color: 'rgba(0,0,0,0.04)' } } } }
  });
}

function updateChart() {
  if (!analyticsChartInstance) return;
  const total = activeIssues.length + archivedIssues.length;
  analyticsChartInstance.data.datasets[0].data = [total, activeIssues.length, archivedIssues.length];
  analyticsChartInstance.update();
  updateTrendChart();
}

function getTrendData() {
  const days = 14;
  const labels = [];
  const counts = [];
  const all = [...activeIssues, ...archivedIssues];
  const dayKeys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayKeys.push(key);
    labels.push(d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' }));
  }
  const byDay = {};
  dayKeys.forEach(k => byDay[k] = 0);
  all.forEach(issue => {
    if (!issue.createdAt) return;
    const key = new Date(issue.createdAt).toISOString().slice(0, 10);
    if (byDay.hasOwnProperty(key)) byDay[key]++;
  });
  dayKeys.forEach(k => counts.push(byDay[k]));
  return { labels, counts };
}

function initTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const { labels, counts } = getTrendData();
  trendChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'إنشغالات جديدة', data: counts, borderColor: '#007A3D', backgroundColor: 'rgba(0,122,61,0.12)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#C8963E' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#6c757d', font: { family: 'Cairo', size: 12 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6c757d', font: { family: 'Cairo', size: 12 } }, grid: { color: 'rgba(0,0,0,0.04)' } } } }
  });
}

function updateTrendChart() {
  if (!trendChartInstance) { initTrendChart(); return; }
  const { labels, counts } = getTrendData();
  trendChartInstance.data.labels = labels;
  trendChartInstance.data.datasets[0].data = counts;
  trendChartInstance.update();
}



// 📋 SIDEBAR
function setupSidebar() {
  const navList = document.getElementById('navList');
  const avatar = document.getElementById('profileAvatar');
  const name = document.getElementById('profileName');
  const title = document.getElementById('profileTitle');
  const badge = document.getElementById('profileRoleBadge');

  if (currentRole === 'directorate') {
    avatar.innerHTML = '<i class="fa-solid fa-user-tie"></i>';
    name.textContent = 'المديرية';
    title.textContent = 'المسؤول عن الرقمنة: بلحاج';
    badge.textContent = 'المديرية';
    badge.className = 'role-badge directorate';
    navList.innerHTML = `
      <li><button class="nav-btn active" data-tab="dashboard" onclick="switchTab('dashboard')"><i class="fa-solid fa-gauge-high"></i> لوحة التحكم</button></li>
      <li><button class="nav-btn" data-tab="dept-dashboard" onclick="switchTab('dept-dashboard')"><i class="fa-solid fa-chart-simple"></i> أداء المصالح</button></li>
      <li><button class="nav-btn" data-tab="departments" onclick="switchTab('departments')"><i class="fa-solid fa-users-gear"></i> إدارة المصالح</button></li>
      <li><button class="nav-btn" data-tab="add" onclick="switchTab('add')"><i class="fa-solid fa-pen-to-square"></i> تدوين إنشغال</button></li>
      <li><button class="nav-btn" data-tab="broadcast" onclick="switchTab('broadcast')"><i class="fa-solid fa-bullhorn"></i> إرسال إنشغال</button></li>
      <li><button class="nav-btn" data-tab="list" onclick="switchTab('list')"><i class="fa-solid fa-list-check"></i> متابعة الإنشغالات <span class="nav-badge" id="navBadgeList" style="display:none;"></span></button></li>
      <li><button class="nav-btn" data-tab="archive" onclick="switchTab('archive')"><i class="fa-solid fa-box-archive"></i> الأرشيف</button></li>
      <li><button class="nav-btn" data-tab="tokens" onclick="switchTab('tokens')"><i class="fa-solid fa-key"></i> كلمات السر</button></li>
      <li><button class="nav-btn" data-tab="audit-log" onclick="switchTab('audit-log')"><i class="fa-solid fa-shield-halved"></i> سجل التدقيق</button></li>
      <li><button class="nav-btn" data-tab="meet" onclick="switchTab('meet')"><i class="fa-solid fa-video"></i> قاعة الاجتماعات</button></li>
      <li><button class="nav-btn" data-tab="notes" onclick="switchTab('notes')"><i class="fa-solid fa-note-sticky"></i> المفكرة</button></li>
    `;
  } else if (currentRole === 'department') {
    const dept = departments.find(d => d.id === currentDepartment);
    avatar.innerHTML = '<i class="fa-solid fa-users-gear"></i>';
    name.textContent = dept ? dept.name : 'مصلحة';
    title.textContent = dept ? dept.manager : 'مسؤول المصلحة';
    badge.textContent = 'مصلحة';
    badge.className = 'role-badge department';
    navList.innerHTML = `
      <li><button class="nav-btn active" data-tab="dept-dashboard" onclick="switchTab('dept-dashboard')"><i class="fa-solid fa-gauge-high"></i> لوحة المصلحة</button></li>
      <li><button class="nav-btn" data-tab="dept-issues" onclick="switchTab('dept-issues')"><i class="fa-solid fa-list-check"></i> الإنشغالات <span class="nav-badge" id="navBadgeDeptIssues" style="display:none;"></span></button></li>
      <li><button class="nav-btn" data-tab="meet" onclick="switchTab('meet')"><i class="fa-solid fa-video"></i> قاعة الاجتماعات</button></li>
      <li><button class="nav-btn" data-tab="notes" onclick="switchTab('notes')"><i class="fa-solid fa-note-sticky"></i> المفكرة</button></li>
    `;
  } else {
    const centerName = getCenterName();
    avatar.innerHTML = '<i class="fa-solid fa-school"></i>';
    name.textContent = centerName;
    title.textContent = 'مركز تكويني مهني';
    badge.textContent = 'مركز / معهد';
    badge.className = 'role-badge center';
    navList.innerHTML = `
      <li><button class="nav-btn active" data-tab="send-panel" onclick="switchTab('send-panel')"><i class="fa-solid fa-paper-plane"></i> إرسال إنشغال</button></li>
      <li><button class="nav-btn" data-tab="chat-hub" onclick="switchTab('chat-hub')"><i class="fa-solid fa-comments"></i> متابعة الردود</button></li>
      <li><button class="nav-btn" data-tab="meet" onclick="switchTab('meet')"><i class="fa-solid fa-video"></i> قاعة الاجتماعات</button></li>
      <li><button class="nav-btn" data-tab="notes" onclick="switchTab('notes')"><i class="fa-solid fa-note-sticky"></i> المفكرة</button></li>
    `;
  }
}

function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + tab);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  if (navBtn) navBtn.classList.add('active');
  if (tab === 'chat-hub' && currentRole === 'center') renderChatHub();
  if (tab === 'tokens' && currentRole === 'directorate') renderTokensGrid();
  if (tab === 'broadcast') updateBroadcastCount();
  if (tab === 'departments' && currentRole === 'directorate') renderDepartmentsList();
  if (tab === 'dept-dashboard' && currentRole === 'directorate') renderDeptDashboard();
  if (tab === 'dept-issues' && currentRole === 'department') renderDeptIssuesForDepartment();
  if (tab === 'audit-log' && currentRole === 'directorate') renderAuditLog();
  if (tab === 'meet') {
    if (typeof initMeetPage === 'function') initMeetPage();
  }
}



// 🚀 INIT APP
function initApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
  loadDB();
  // 🔔 اطلب إذن إشعارات المتصفح بعد الدخول مباشرة (تُستخدم لاحقاً في الرسائل الجديدة)
  requestBrowserNotificationPermission();
  
  listenToFirebase();
  // 📣 بدء الاستماع الفوري لدعوات الاجتماع (حتى قبل فتح صفحة قاعة الاجتماعات)
  // هذا يضمن ظهور الإشعار الصوتي والمرئي العائم فور وصول دعوة من المديرية
  if (typeof listenToMeetInvitations === 'function' && currentRole !== 'directorate') {
    listenToMeetInvitations();
  }
  if (currentRole === 'directorate') listenToPasswordRequestsForDirectorate();
  // 💬 محادثة المؤسسات: نظام مستقل بالكامل الآن (push لكل رسالة) — راجع appendInterChatMessage
  listenToInterChat();
  
  database.ref('data').once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      if (data.activeIssues) activeIssues = data.activeIssues;
      if (data.archivedIssues) archivedIssues = data.archivedIssues;
      if (data.centerIssues) centerIssues = data.centerIssues;
      if (data.centerArchived) centerArchived = data.centerArchived;
      if (data.fileTypes) {
        fileTypes = data.fileTypes;
        console.log('[v0] تم تحميل التصنيفات من Firebase:', fileTypes);
      }
      if (data.departments) {
        departments = data.departments;
        DEPARTMENTS_BASE.forEach(base => {
          if (!departments.find(d => d.id === base.id)) {
            departments.push({...base});
          }
        });
      }
      // 🔥 تسجيل كل الحقول كـ "متزامنة" حتى لا تُعاد كتابتها لاحقاً بلا داعٍ
      _markSynced('activeIssues', activeIssues);
      _markSynced('archivedIssues', archivedIssues);
      _markSynced('centerIssues', centerIssues);
      _markSynced('centerArchived', centerArchived);
      _markSynced('fileTypes', fileTypes);
      _markSynced('departments', departments);
      _markSynced('auditLog', auditLog);
    }
    setupInterface();
  });
}

function setupInterface() {
  // عرض مقولة دينية عشوائية
  displayRandomQuote();
  
  setupSidebar();
  populateDropdowns();
  renderInstitutionsList();
  renderFileTypesManageList();
  renderTokensGrid();
  updateBroadcastCount();
  populateInterChatRecipients();
  populateCenterTargetDepts();
  updateNavBadges();
  document.getElementById('strategicNotes').value = localStorage.getItem(LS_KEYS.notes) || "";
  
  if (currentRole === 'directorate') {
    document.getElementById('institutionsPanel').style.display = 'block';
    document.getElementById('fileTypesPanel').style.display = 'block';
    document.getElementById('centerInfoPanel').style.display = 'none';
    document.getElementById('fileTypeManageRow').style.display = 'flex';
    renderKPIs();
    initChart();
    initTrendChart();
    renderList();
    renderArchive();
    renderDepartmentsList();
    renderDeptDashboard();
    renderAuditLog();
    populateDeptFilters();
    document.getElementById('page-dashboard').classList.remove('hidden');
    switchTab('dashboard');
    initScrollDrag('archiveTableScroll','archiveScrollTrack','archiveScrollThumb');
  } else if (currentRole === 'department') {
    document.getElementById('institutionsPanel').style.display = 'none';
    document.getElementById('fileTypesPanel').style.display = 'none';
    document.getElementById('centerInfoPanel').style.display = 'none';
    document.getElementById('page-dept-dashboard').classList.remove('hidden');
    renderDeptIssuesForDepartment();
    switchTab('dept-dashboard');
  } else {
    document.getElementById('institutionsPanel').style.display = 'none';
    document.getElementById('fileTypesPanel').style.display = 'block';
    document.getElementById('centerInfoPanel').style.display = 'block';
    document.getElementById('fileTypeManageRow').style.display = 'none';
    refreshCenterUI();
    renderChatHub();
    document.getElementById('page-send-panel').classList.remove('hidden');
    switchTab('send-panel');
    setupPasteFeature();
  }
  
  setInterval(checkForNewMessages, 3000);
}

