// ============================================
// 🏢 إدارة المصالح
// الإضافة، التعديل، كلمات السر
// ============================================

// 🏢 DEPARTMENT FUNCTIONS
function renderDepartmentsList() {
  const container = document.getElementById('departmentsListContainer');
  if (!container) return;
  
  if (departments.length === 0) {
    container.innerHTML = '<div class="empty-msg">لا توجد مصالح مسجلة</div>';
    return;
  }
  
  container.innerHTML = `<div class="dept-stats-grid">${departments.map(dept => {
    const deptIssues = activeIssues.filter(i => i.department === dept.id);
    const totalIssues = deptIssues.length;
    const pendingIssues = deptIssues.filter(i => i.status && i.status.indexOf('تم الحل') === -1).length;
    const resolvedIssues = deptIssues.filter(i => i.status && i.status.indexOf('تم الحل') !== -1).length;
    const efficiency = totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0;
    
    // البحث عن اسم المستخدم
    let username = '';
    for (const [user, cred] of Object.entries(DEPARTMENT_CREDENTIALS)) {
      if (cred.departmentId === dept.id) {
        username = user;
        break;
      }
    }
    
    const cred = DEPARTMENT_CREDENTIALS[username];
    
    return `<div class="dept-stat-card" style="border-right:4px solid var(--algeria-green);">
      <div class="dept-name">${dept.name}</div>
      <div style="font-size:14px; color:var(--text-dim); margin-bottom:6px;">المكلف: ${dept.manager}</div>
      <div style="font-size:13px; color:var(--algeria-green); background:var(--bg-card-2); padding:4px 12px; border-radius:8px; display:inline-block; margin-bottom:8px;">
        <i class="fa-solid fa-user"></i> اسم المستخدم: ${username}
      </div>
      <div class="dept-stats">
        <div class="stat-item"><div class="num">${totalIssues}</div><div class="label">الكل</div></div>
        <div class="stat-item"><div class="num">${pendingIssues}</div><div class="label">قيد المعالجة</div></div>
        <div class="stat-item"><div class="num">${resolvedIssues}</div><div class="label">تم الحل</div></div>
        <div class="stat-item"><div class="num">${efficiency}%</div><div class="label">الكفاءة</div></div>
      </div>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn-mini" onclick="editDepartmentInfo('${dept.id}')"><i class="fa-solid fa-pen"></i> تعديل الاسم والمكلف</button>
        <span style="font-size:13px; color:var(--text-dim);"><i class="fa-solid fa-key"></i> كلمة السر: ${cred?.password || 'غير محدد'}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
  
  // تحديث جميع القوائم المنسدلة بعد تحديث المصالح
  refreshAllDropdowns();
}

// دالة جديدة لتحديث جميع القوائم المنسدلة التي تعتمد على المصالح
function refreshAllDropdowns() {
  // 1. تحديث قائمة المصالح في فلتر المتابعة
  const listFilter = document.getElementById('list-dept-filter');
  if (listFilter) {
    const currentVal = listFilter.value;
    listFilter.innerHTML = '<option value="">كل المصالح</option>' + 
      departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (currentVal && departments.some(d => d.id === currentVal)) {
      listFilter.value = currentVal;
    }
  }
  
  // 2. تحديث قائمة المصالح في فلتر الأرشيف
  const archiveFilter = document.getElementById('archive-dept-filter');
  if (archiveFilter) {
    const currentVal = archiveFilter.value;
    archiveFilter.innerHTML = '<option value="">كل المصالح</option>' + 
      departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (currentVal && departments.some(d => d.id === currentVal)) {
      archiveFilter.value = currentVal;
    }
  }
  
  // 3. تحديث قائمة المصالح المستهدفة في صفحة إرسال الإنشغال من المركز
  const targetDept = document.getElementById('form-target-dept');
  if (targetDept) {
    const currentVal = targetDept.value;
    targetDept.innerHTML = '<option value="">-- اختر المصلحة المستهدفة --</option>' + 
      departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (currentVal && departments.some(d => d.id === currentVal)) {
      targetDept.value = currentVal;
    }
  }
  
  // 4. تحديث قائمة المصالح في نافذة تحويل الإنشغال
  const transferSelect = document.getElementById('transferDeptSelect');
  if (transferSelect) {
    const currentVal = transferSelect.value;
    transferSelect.innerHTML = departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (currentVal && departments.some(d => d.id === currentVal)) {
      transferSelect.value = currentVal;
    }
  }
  
  // 5. تحديث قائمة المصالح في شات المؤسسات
  const interChatSelect = document.getElementById('interChatRecipient');
  if (interChatSelect) {
    const currentVal = interChatSelect.value;
    const deptOptions = departments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    interChatSelect.innerHTML = `<option value="all">الجميع</option><option value="directorate">المديرية</option>${deptOptions}`;
    if (currentVal && (currentVal === 'all' || currentVal === 'directorate' || departments.some(d => d.name === currentVal))) {
      interChatSelect.value = currentVal;
    }
    // تحديث الـ badge
    if (interChatSelect.value) {
      const badge = document.getElementById('recipientBadge');
      if (interChatSelect.value === 'all') { badge.textContent = 'الجميع'; badge.style.background = 'var(--algeria-green)'; }
      else if (interChatSelect.value === 'directorate') { badge.textContent = 'المديرية'; badge.style.background = 'var(--algeria-red)'; }
      else { badge.textContent = interChatSelect.value.length > 20 ? interChatSelect.value.substring(0, 20) + '...' : interChatSelect.value; badge.style.background = 'var(--algeria-green)'; }
    }
  }
  
  // 6. تحديث حقل اقتراح المصلحة في صفحة إضافة إنشغال
  updateDepartmentSuggestion();
}

function editDepartmentInfo(id) {
  const dept = departments.find(d => d.id === id);
  if (!dept) return;
  
  const newName = prompt('تعديل اسم المصلحة:', dept.name);
  if (newName && newName.trim()) {
    dept.name = newName.trim();
  }
  
  const newManager = prompt('تعديل اسم المكلف بتسيير المصلحة:', dept.manager);
  if (newManager && newManager.trim()) {
    dept.manager = newManager.trim();
  }
  
  saveToFirebase();
  renderDepartmentsList();
  renderDeptDashboard();
  refreshAllDropdowns(); // تحديث القوائم المنسدلة
  
  // تحديث اسم المصلحة والمكلف في الـ sidebar إذا كانت المصلحة الحالية
  if (currentRole === 'department' && currentDepartment === id) {
    document.getElementById('profileName').textContent = dept.name;
    document.getElementById('profileTitle').textContent = dept.manager;
  }
  showToast('✅ تم التعديل', 'تم تعديل بيانات المصلحة بنجاح');
}

function renderDeptDashboard() {
  const container = document.getElementById('deptStatsContainer');
  if (!container) return;
  
  container.innerHTML = `<div class="dept-stats-grid">${departments.map(dept => {
    const deptIssues = activeIssues.filter(i => i.department === dept.id);
    const totalIssues = deptIssues.length;
    const pendingIssues = deptIssues.filter(i => i.status && i.status.indexOf('تم الحل') === -1).length;
    const resolvedIssues = deptIssues.filter(i => i.status && i.status.indexOf('تم الحل') !== -1).length;
    const efficiency = totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0;
    
    let username = '';
    for (const [user, cred] of Object.entries(DEPARTMENT_CREDENTIALS)) {
      if (cred.departmentId === dept.id) {
        username = user;
        break;
      }
    }
    
    return `<div class="dept-stat-card" style="border-right:4px solid var(--algeria-green);">
      <div class="dept-name">${dept.name}</div>
      <div style="font-size:14px; color:var(--text-dim); margin-bottom:6px;">المكلف: ${dept.manager}</div>
      <div style="font-size:13px; color:var(--algeria-green); background:var(--bg-card-2); padding:4px 12px; border-radius:8px; display:inline-block; margin-bottom:8px;">
        <i class="fa-solid fa-user"></i> اسم المستخدم: ${username}
      </div>
      <div class="dept-stats">
        <div class="stat-item"><div class="num">${totalIssues}</div><div class="label">الكل</div></div>
        <div class="stat-item"><div class="num">${pendingIssues}</div><div class="label">قيد المعالجة</div></div>
        <div class="stat-item"><div class="num">${resolvedIssues}</div><div class="label">تم الحل</div></div>
        <div class="stat-item"><div class="num">${efficiency}%</div><div class="label">الكفاءة</div></div>
      </div>
    </div>`;
  }).join('')}</div>`;
  
  updateDeptChart();
}

function updateDeptChart() {
  const ctx = document.getElementById('deptChart');
  if (!ctx) return;
  const canvas = ctx.getContext('2d');
  
  const labels = departments.map(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name);
  const data = departments.map(dept => {
    return activeIssues.filter(i => i.department === dept.id).length;
  });
  
  if (deptChartInstance) {
    deptChartInstance.destroy();
  }
  
  deptChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'عدد الإنشغالات',
        data: data,
        backgroundColor: '#006633',
        borderRadius: 8,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'توزيع الإنشغالات حسب المصلحة', color: '#6c757d', font: { family: 'Cairo', size: 16 } }
      },
      scales: {
        x: { ticks: { color: '#6c757d', font: { family: 'Cairo', weight: '700', size: 12 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { beginAtZero: true, ticks: { color: '#6c757d', font: { family: 'Cairo', size: 12 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
      }
    }
  });
}

function populateDeptFilters() {
  // تم دمج هذه الوظيفة في refreshAllDropdowns
  refreshAllDropdowns();
}

function populateCenterTargetDepts() {
  // تم دمج هذه الوظيفة في refreshAllDropdowns
  refreshAllDropdowns();
}

function updateDepartmentSuggestion() {
  const type = document.getElementById('add-form-type').value;
  const dept = departments.find(d => d.type === type);
  const suggestedField = document.getElementById('add-form-suggested-dept');
  if (dept) {
    suggestedField.value = dept.name + ' (تلقائي)';
    suggestedField.style.color = 'var(--algeria-green)';
  } else {
    suggestedField.value = 'لا توجد مصلحة مختصة حالياً';
    suggestedField.style.color = 'var(--text-dim)';
  }
}

function getDepartmentForType(type) {
  return departments.find(d => d.type === type);
}



// 🏢 DEPARTMENT SPECIFIC FUNCTIONS
function renderDeptIssuesForDepartment() {
  const mainWorkspace = document.getElementById('mainWorkspace');
  
  // تحديث اسم المصلحة في الـ header
  const dept = departments.find(d => d.id === currentDepartment);
  const deptNameSpan = document.getElementById('deptNameHeader');
  if (deptNameSpan && dept) {
    deptNameSpan.textContent = dept.name;
  }
  
  let deptPage = document.getElementById('page-dept-issues');
  if (!deptPage) {
    deptPage = document.createElement('section');
    deptPage.id = 'page-dept-issues';
    deptPage.className = 'page hidden';
    deptPage.innerHTML = `
      <div class="page-header"><h2><i class="fa-solid fa-list-check"></i> إنشغالات <span id="deptNameHeader"></span></h2></div>
      <div class="filter-bar">
        <input type="text" id="dept-issues-search" placeholder="بحث..." onkeyup="renderDeptIssuesForDepartment()">
        <select id="dept-issues-priority" onchange="renderDeptIssuesForDepartment()"><option value="">كل الأولويات</option><option value="عادي">عادي 🟢</option><option value="متوسط">متوسط 🟡</option><option value="مستعجل جداً">مستعجل جداً 🔴</option></select>
        <select id="dept-issues-status" onchange="renderDeptIssuesForDepartment()"><option value="">كل الحالات</option><option value="pending">قيد المعالجة</option><option value="resolved">تم الحل</option></select>
      </div>
      <div class="table-wrap">
        <div class="table-scroll"><table><thead><tr><th>الرمز</th><th>المؤسسة</th><th>التصنيف</th><th>الأولوية</th><th>المصدر</th><th>التفاصيل</th><th>المرفقات</th><th>الحالة</th><th>الشات</th></tr></thead><tbody id="deptIssuesTableBody"></tbody></table></div>
      </div>
    `;
    mainWorkspace.appendChild(deptPage);
  }
  
  renderDeptIssuesTable();
}

function renderDeptIssuesTable() {
  const tbody = document.getElementById('deptIssuesTableBody');
  if (!tbody) return;
  
  const search = (document.getElementById('dept-issues-search')?.value || '').trim().toLowerCase();
  const priorityFilter = document.getElementById('dept-issues-priority')?.value || '';
  const statusFilter = document.getElementById('dept-issues-status')?.value || '';
  
  let deptIssues = activeIssues.filter(i => i.department === currentDepartment);
  
  if (search) {
    deptIssues = deptIssues.filter(i => i.code.toLowerCase().includes(search) || i.center.toLowerCase().includes(search) || i.type.toLowerCase().includes(search));
  }
  if (priorityFilter) {
    deptIssues = deptIssues.filter(i => i.priority === priorityFilter);
  }
  if (statusFilter) {
    if (statusFilter === 'pending') deptIssues = deptIssues.filter(i => i.status && i.status.indexOf('تم الحل') === -1);
    if (statusFilter === 'resolved') deptIssues = deptIssues.filter(i => i.status && i.status.indexOf('تم الحل') !== -1);
  }
  
  if (deptIssues.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-msg">لا توجد إنشغالات لهذه المصلحة</td></tr>`;
    return;
  }
  
  tbody.innerHTML = deptIssues.map(issue => {
    const unread = hasUnreadMessages(issue.code);
    const hasAttach = hasAttachment(issue);
    const timeAgo = getTimeAgo(issue.createdAt);
    const isResolved = issue.status && issue.status.indexOf('تم الحل') !== -1;
    return `<tr class="${unread ? 'row-unread' : ''}">
      <td><strong style="font-size:16px;">${escapeHtml(issue.code)}</strong><br><span style="font-size:13px; color:var(--text-dim);">${timeAgo}</span></td>
      <td style="font-size:16px;">${escapeHtml(issue.center)}</td>
      <td style="font-size:16px;">${escapeHtml(issue.type)}</td>
      <td>${priorityPillHtml(issue.priority)}</td>
      <td>${sourceBadgeHtml(issue.source)}</td>
      <td><button class="btn-mini view-btn" onclick="openDetails('${issue.code}', false)"><i class="fa-solid fa-eye"></i></button></td>
      <td>${hasAttach ? '<span style="color:var(--algeria-green);"><i class="fa-solid fa-paperclip"></i></span>' : '<span style="color:var(--text-dim);">-</span>'}</td>
      <td>${isResolved ? '<span class="status-resolved">تم الحل ✅</span>' : '<span class="status-pending">قيد المعالجة 🔄</span>'}</td>
      <td><button class="btn-mini ${isResolved ? 'success' : 'primary'}" onclick="toggleDeptIssueStatus('${issue.code}')" title="${isResolved ? 'إعادة فتح' : 'تحديد كمحل'}"><i class="fa-solid fa-${isResolved ? 'rotate-left' : 'check'}"></i></button></td>
      <td><button class="btn-chat ${unread ? 'new-msg' : ''}" onclick="openChat('${issue.code}', 'department')">${unread ? '<i class="fa-solid fa-bell"></i>' : '<i class="fa-solid fa-comments"></i>'}</button></td>
    </tr>`;
  }).join('');
}

// دالة تبديل حالة الإنشغال في المصلحة
function toggleDeptIssueStatus(code) {
  const issue = activeIssues.find(i => i.code === code);
  if (!issue) { showToast('⚠️ خطأ', 'لم يتم العثور على الإنشغال'); return; }
  
  const isResolved = issue.status && issue.status.indexOf('تم الحل') !== -1;
  if (isResolved) {
    issue.status = 'قيد المعالجة 🔄';
    addAuditLog('إعادة فتح إنشغال', code, issue.center || '');
    showToast('✅ تم إعادة الفتح', `تم إعادة فتح الإنشغال ${code}`);
  } else {
    issue.status = 'تم الحل ✅';
    addAuditLog('تسوية إنشغال (من المصلحة)', code, issue.center || '');
    if (!isMuted) playNotificationSound();
    showToast('✅ تم التحديث', `تم تحديد الإنشغال ${code} كمحلول`);
  }
  
  saveToFirebase();
  renderDeptIssuesForDepartment();
  renderDeptKPIs();
}

function renderDeptKPIs() {
  const deptIssues = activeIssues.filter(i => i.department === currentDepartment);
  const total = deptIssues.length;
  const pending = deptIssues.filter(i => i.status && i.status.indexOf('تم الحل') === -1).length;
  const resolved = deptIssues.filter(i => i.status && i.status.indexOf('تم الحل') !== -1).length;
  const efficiency = total > 0 ? Math.round((resolved / total) * 100) : 0;
  
  const container = document.getElementById('deptStatsContainer');
  if (container && currentRole === 'department') {
    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card kpi-total"><div class="kpi-icon"><i class="fa-solid fa-layer-group"></i></div><div class="kpi-label">إجمالي الإنشغالات</div><div class="kpi-value">${total}</div></div>
        <div class="kpi-card kpi-pending"><div class="kpi-icon"><i class="fa-solid fa-hourglass-half"></i></div><div class="kpi-label">قيد المعالجة</div><div class="kpi-value">${pending}</div></div>
        <div class="kpi-card kpi-done"><div class="kpi-icon"><i class="fa-solid fa-circle-check"></i></div><div class="kpi-label">تم الحل</div><div class="kpi-value">${resolved}</div></div>
        <div class="kpi-card kpi-efficiency"><div class="kpi-icon"><i class="fa-solid fa-chart-line"></i></div><div class="kpi-label">معدل الكفاءة</div><div class="kpi-value">${efficiency}%</div></div>
      </div>
    `;
  }
}



// 📌 CENTER UTILITIES
function getCenterName() { return localStorage.getItem(LS_KEYS.centerName) || "مركز تكويني"; }
function setCenterName(name) { localStorage.setItem(LS_KEYS.centerName, name); }

function refreshCenterUI() {
  const name = getCenterName();
  document.getElementById('centerBadgeName').textContent = name;
  const sidebarName = document.getElementById('profileName');
  if (sidebarName) sidebarName.textContent = name;
}



// 📋 DROPDOWNS
function populateDropdowns() {
  const centerSel = document.getElementById('add-form-center');
  const typeSel = document.getElementById('add-form-type');
  const formType = document.getElementById('form-type');
  
  if (centerSel) centerSel.innerHTML = INSTITUTIONS_DATA.map(i => `<option value="${escapeHtml(i.name)}">${escapeHtml(i.name)}</option>`).join('');
  
  // بناء خيارات التصنيفات مع إزالة التكرار
  const uniqueFileTypes = [...new Set(fileTypes.filter(t => t && t.trim()))];
  const typeOptions = uniqueFileTypes.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  
  if (typeSel) {
    typeSel.innerHTML = typeOptions;
    console.log('[v0] تحديث قائمة التصنيفات للمديرية:', uniqueFileTypes.length);
  }
  
  if (formType) {
    formType.innerHTML = typeOptions;
    console.log('[v0] تحديث قائمة التصنيفات للمراكز:', uniqueFileTypes.length);
  }
}



// 📋 INSTITUTIONS & FILE TYPES
function renderInstitutionsList() {
  const ul = document.getElementById('institutionsList');
  if (!ul) return;
  ul.innerHTML = INSTITUTIONS_DATA.map((inst, idx) => `<li><span>${escapeHtml(inst.name)}</span><span style="font-size:13px; color:var(--text-dim);">${escapeHtml(inst.code)}</span></li>`).join('');
}

function renderFileTypesManageList() {
  const ul = document.getElementById('fileTypesList');
  if (!ul) return;
  ul.innerHTML = fileTypes.map((name, idx) => {
    const role = currentRole;
    const actions = (role === 'directorate') ? 
      `<div class="item-actions"><button class="btn-mini" onclick="editFileType(${idx})"><i class="fa-solid fa-pen"></i></button><button class="btn-mini danger" onclick="deleteFileType(${idx})"><i class="fa-solid fa-trash"></i></button></div>` :
      `<div class="item-actions"><span style="color:var(--text-dim); font-size:13px;">للإدارة فقط</span></div>`;
    return `<li><span>${escapeHtml(name)}</span>${actions}</li>`;
  }).join('') || '<li style="color:var(--text-dim); text-align:center; padding:12px;">لا توجد تصنيفات مسجلة</li>';
}

function addFileType() {
  if (currentRole !== 'directorate') { showToast("⚠️ غير مسموح", "هذه الخاصية متاحة للمديرية فقط"); return; }
  const input = document.getElementById('newFileTypeInput');
  const val = input.value.trim();
  if (!val) { showToast("⚠️ تنبيه", "يرجى إدخال اسم التصنيف"); return; }
  
  // التحقق من عدم تكرار التصنيف
  if (fileTypes.includes(val)) { showToast("⚠️ تنبيه", "هذا التصنيف موجود بالفعل"); return; }
  
  fileTypes.push(val);
  saveToFirebase();
  input.value = '';
  input.focus();
  renderFileTypesManageList();
  populateDropdowns();
  
  // تحديث واجهة المراكز
  updateUI();
  showToast("✅ تم الإضافة", `تم إضافة التصنيف "${val}" بنجاح`);
}

function editFileType(idx) {
  if (currentRole !== 'directorate') { showToast("⚠️ غير مسموح", "هذه الخاصية متاحة للمديرية فقط"); return; }
  const newVal = prompt("تعديل التصنيف:", fileTypes[idx]);
  if (newVal !== null && newVal.trim() !== '') { fileTypes[idx] = newVal.trim(); saveToFirebase(); renderFileTypesManageList(); populateDropdowns(); }
}

function deleteFileType(idx) {
  if (currentRole !== 'directorate') { showToast("⚠️ غير مسموح", "هذه الخاصية متاحة للمديرية فقط"); return; }
  if (confirm("هل أنت متأكد من حذف هذا التصنيف؟")) { fileTypes.splice(idx, 1); saveToFirebase(); renderFileTypesManageList(); populateDropdowns(); }
}

function saveNotes() { 
  localStorage.setItem(LS_KEYS.notes, document.getElementById('strategicNotes').value);
  database.ref('notes').set(document.getElementById('strategicNotes').value);
}



// 🔑 TOKENS
function filterTokens() { renderTokensGrid(); }

function renderTokensGrid() {
  const grid = document.getElementById('tokensGrid');
  const search = (document.getElementById('tokenSearchInput')?.value || '').trim().toLowerCase();
  let filtered = INSTITUTIONS_DATA;
  if (search) filtered = INSTITUTIONS_DATA.filter(inst => inst.name.toLowerCase().includes(search) || inst.code.toLowerCase().includes(search) || inst.password.includes(search));
  if (filtered.length === 0) { grid.innerHTML = '<div style="color:var(--text-dim); padding:40px; text-align:center; font-size:18px;">لا توجد مؤسسات تطابق البحث.</div>'; return; }
  grid.innerHTML = filtered.map(inst => `
    <div class="token-item">
      <div class="token-code">${escapeHtml(inst.password)}</div>
      <div class="token-name">${escapeHtml(inst.name)}</div>
      <div class="token-code-id">${escapeHtml(inst.code)} ${inst.type === 'private' ? '🏫' : '🏛️'}</div>
      <div class="token-actions"><button class="btn-mini" onclick="copyToken('${inst.password}')"><i class="fa-regular fa-copy"></i> نسخ</button></div>
    </div>
  `).join('');
}

function copyToken(token) { navigator.clipboard.writeText(token).then(() => showToast("✅ تم النسخ", "تم نسخ كلمة السر إلى الحافظة.")); }


