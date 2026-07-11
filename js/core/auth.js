// ============================================
// 🔐 المصادقة وتسجيل الدخول
// شاشة الدخول + إدارة الجلسات
// ============================================

// 🔐 تسجيل الدخول
let selectedLoginRole = 'directorate';

function selectLoginRole(role) {
  selectedLoginRole = role;
  document.querySelectorAll('.role-selector button').forEach(b => b.classList.remove('active'));
  document.getElementById('loginRole' + role.charAt(0).toUpperCase() + role.slice(1)).classList.add('active');
  
  document.getElementById('directorateFields').style.display = 'none';
  document.getElementById('departmentFields').style.display = 'none';
  document.getElementById('centerFields').style.display = 'none';
  document.getElementById('centerHint').style.display = 'none';
  
  if (role === 'directorate') {
    document.getElementById('directorateFields').style.display = 'block';
  } else if (role === 'department') {
    document.getElementById('departmentFields').style.display = 'block';
    // لا نقوم بتعبئة كلمة السر تلقائياً
  } else {
    document.getElementById('centerFields').style.display = 'block';
    document.getElementById('centerHint').style.display = 'block';
    populateCenterSelect();
  }
}

function populateCenterSelect() {
  const select = document.getElementById('loginCenterSelect');
  select.innerHTML = '<option value="">-- اختر المؤسسة --</option>';
  INSTITUTIONS_DATA.forEach(inst => {
    select.innerHTML += `<option value="${inst.name}">${inst.name}</option>`;
  });
  filterCenterSelect();
}

function filterCenterSelect() {
  const search = document.getElementById('loginCenterSearch').value.trim().toLowerCase();
  const select = document.getElementById('loginCenterSelect');
  const options = select.querySelectorAll('option');
  for (let i = 1; i < options.length; i++) {
    options[i].style.display = options[i].textContent.toLowerCase().includes(search) ? '' : 'none';
  }
  let visibleCount = 0, visibleValue = '';
  for (let i = 1; i < options.length; i++) {
    if (options[i].style.display !== 'none') { visibleCount++; visibleValue = options[i].value; }
  }
  if (visibleCount === 1 && search.length > 0) select.value = visibleValue;
}



// 🔄 جلسة الدخول (تبقى محفوظة عند تحديث الصفحة يدوياً)
function saveSession() {
  try {
    sessionStorage.setItem(LS_KEYS.session, JSON.stringify({ role: currentRole, department: currentDepartment }));
  } catch(e) {}
}

function clearSession() {
  try { sessionStorage.removeItem(LS_KEYS.session); } catch(e) {}
}

function restoreSession() {
  let data;
  try { data = sessionStorage.getItem(LS_KEYS.session); } catch(e) { data = null; }
  if (!data) return false;
  try {
    const parsed = JSON.parse(data);
    if (!parsed || !parsed.role) return false;
    currentRole = parsed.role;
    currentDepartment = parsed.department || null;
    initApp();
    return true;
  } catch(e) { return false; }
}

// زر إعادة التحميل اليدوي: يعيد تحميل الصفحة بالكامل دون العودة لشاشة الدخول
function reloadPage() {
  location.reload();
}

function handleLogin() {
  const err = document.getElementById('loginError');
  err.style.display = 'none';
  
  if (selectedLoginRole === 'directorate') {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    if (pass === MASTER_PASSWORD || (user === 'hassan' && pass === '102030')) {
      currentRole = 'directorate';
      document.getElementById('loginUser').value = 'hassan';
      saveSession();
      initApp();
    } else {
      err.style.display = 'block';
      err.textContent = '⚠️ بيانات الدخول غير صحيحة!';
    }
  } else if (selectedLoginRole === 'department') {
    const username = document.getElementById('loginDeptSelect').value;
    const pass = document.getElementById('loginDeptPass').value.trim();
    
    if (!username) {
      err.style.display = 'block';
      err.textContent = '⚠️ يرجى اختيار المصلحة من القائمة!';
      return;
    }
    
    const cred = DEPARTMENT_CREDENTIALS[username];
    if (cred && cred.password === pass) {
      // البحث عن المصلحة في قائمة المصالح
      let dept = departments.find(d => d.id === cred.departmentId);
      if (!dept) {
        // إذا لم توجد، نضيفها من البيانات الأساسية
        const baseDept = DEPARTMENTS_BASE.find(d => d.id === cred.departmentId);
        if (baseDept) {
          departments.push({...baseDept});
          dept = departments.find(d => d.id === cred.departmentId);
        }
      }
      if (dept) {
        currentRole = 'department';
        currentDepartment = dept.id;
        saveSession();
        initApp();
      } else {
        err.style.display = 'block';
        err.textContent = '⚠️ المصلحة غير موجودة في النظام! يرجى الاتصال بالمديرية.';
      }
    } else {
      err.style.display = 'block';
      err.textContent = '⚠️ كلمة المرور غير صحيحة! يرجى الاتصال بالمديرية.';
    }
  } else {
    const center = document.getElementById('loginCenterSelect').value;
    const pass = document.getElementById('loginCenterPass').value.trim();
    if (!center) { err.style.display = 'block'; err.textContent = '⚠️ يرجى اختيار المؤسسة!'; return; }
    const inst = INSTITUTIONS_DATA.find(i => i.name === center);
    if (inst && inst.password === pass) {
      currentRole = 'center';
      setCenterName(center);
      saveSession();
      initApp();
    } else {
      err.style.display = 'block';
      err.textContent = '⚠️ كلمة السر غير صحيحة! يرجى الاتصال بالمديرية.';
    }
  }
}

function toggleRemember() {
  const checked = document.getElementById('rememberMe').checked;
  if (checked) {
    const role = selectedLoginRole;
    if (role === 'directorate') {
      const user = document.getElementById('loginUser').value;
      const pass = document.getElementById('loginPass').value;
      if (user && pass) localStorage.setItem(LS_KEYS.remember, JSON.stringify({ role, user, pass }));
    } else if (role === 'department') {
      const dept = document.getElementById('loginDeptSelect').value;
      const pass = document.getElementById('loginDeptPass').value;
      if (dept && pass) localStorage.setItem(LS_KEYS.remember, JSON.stringify({ role, dept, pass }));
    } else {
      const center = document.getElementById('loginCenterSelect').value;
      const pass = document.getElementById('loginCenterPass').value;
      if (center && pass) localStorage.setItem(LS_KEYS.remember, JSON.stringify({ role, center, pass }));
    }
  } else { localStorage.removeItem(LS_KEYS.remember); }
}

function loadRemembered() {
  const data = localStorage.getItem(LS_KEYS.remember);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.role === 'directorate') {
        selectLoginRole('directorate');
        document.getElementById('loginUser').value = parsed.user || '';
        document.getElementById('loginPass').value = parsed.pass || '';
        document.getElementById('rememberMe').checked = true;
      } else if (parsed.role === 'department') {
        selectLoginRole('department');
        document.getElementById('loginDeptSelect').value = parsed.dept || '';
        document.getElementById('loginDeptPass').value = parsed.pass || '';
        document.getElementById('rememberMe').checked = true;
      } else if (parsed.role === 'center') {
        selectLoginRole('center');
        document.getElementById('loginCenterSelect').value = parsed.center || '';
        document.getElementById('loginCenterPass').value = parsed.pass || '';
        document.getElementById('rememberMe').checked = true;
        document.getElementById('loginCenterSearch').value = parsed.center || '';
        filterCenterSelect();
      }
    } catch(e) {}
  }
}



// 🔑 تغيير كلمة السر
function openChangePassword() {
  document.getElementById('currentPass').value = '';
  document.getElementById('newPass').value = '';
  document.getElementById('confirmPass').value = '';
  document.getElementById('changePassModal').classList.add('open');
}

function closeChangePassword() {
  document.getElementById('changePassModal').classList.remove('open');
}

function changePassword() {
  const current = document.getElementById('currentPass').value.trim();
  const newPass = document.getElementById('newPass').value.trim();
  const confirm = document.getElementById('confirmPass').value.trim();
  if (current !== MASTER_PASSWORD) { alert("⚠️ كلمة السر الحالية غير صحيحة!"); return; }
  if (newPass.length < 4) { alert("⚠️ كلمة السر الجديدة يجب أن تكون 4 أحرف على الأقل."); return; }
  if (newPass !== confirm) { alert("⚠️ كلمة السر الجديدة وتأكيدها غير متطابقين."); return; }
  MASTER_PASSWORD = newPass;
  localStorage.setItem(LS_KEYS.masterPass, newPass);
  closeChangePassword();
  showToast("✅ تم التغيير", "تم تغيير كلمة السر بنجاح!");
}




// 🔑 طلب كلمة السر من المديرية (Firebase Realtime)
let _passwordRequestRef = null;
let _passwordDirectorateRef = null;
const _passwordNotified = new Set();
let _passwordRevealTimer = null;

function requestCenterPassword() {
  const centerName = document.getElementById('loginCenterSelect')?.value || '';
  const status = document.getElementById('passwordRequestStatus');
  const btn = document.getElementById('requestPasswordBtn');
  if (!centerName) {
    const err = document.getElementById('loginError');
    err.style.display = 'block';
    err.textContent = '⚠️ اختر المؤسسة أولاً ثم اضغط على طلب كلمة السر.';
    return;
  }
  const inst = INSTITUTIONS_DATA.find(i => i.name === centerName);
  if (!inst) return;
  if (btn) btn.disabled = true;
  if (status) { status.style.display = 'block'; status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ إرسال الطلب...'; }
  const ref = database.ref('passwordRequests').push();
  const request = {
    centerName: inst.name,
    centerCode: inst.code,
    centerType: inst.type || 'center',
    status: 'pending',
    requestedAt: firebase.database.ServerValue.TIMESTAMP
  };
  ref.set(request).then(() => {
    localStorage.setItem('pending_password_request', ref.key);
    listenForPasswordResponse(ref.key);
    if (status) status.innerHTML = '<i class="fa-solid fa-clock"></i> تم إرسال الطلب، في انتظار رد المديرية...';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate"></i> إعادة إرسال الطلب'; }
    showToast('✅ تم إرسال الطلب', 'ستظهر كلمة السر هنا فور إرسالها من المديرية.');
  }).catch(err => {
    if (btn) btn.disabled = false;
    if (status) status.textContent = 'تعذر إرسال الطلب. تحقق من الاتصال.';
    console.error('password request error', err);
  });
}

function listenForPasswordResponse(requestId) {
  if (!requestId) return;
  if (_passwordRequestRef) _passwordRequestRef.off();
  _passwordRequestRef = database.ref('passwordRequests/' + requestId);
  _passwordRequestRef.on('value', snap => {
    const req = snap.val();
    if (!req) return;
    const status = document.getElementById('passwordRequestStatus');
    if (req.status === 'sent' && req.password) {
      _passwordRequestRef.off();
      showPasswordFor40Seconds(req.password, req.centerName, requestId);
    } else if (status) {
      status.style.display = 'block';
      status.innerHTML = '<i class="fa-solid fa-clock"></i> الطلب قيد الانتظار لدى المديرية...';
    }
  });
}

function resumePendingPasswordRequest() {
  const id = localStorage.getItem('pending_password_request');
  if (id) listenForPasswordResponse(id);
}

function listenToPasswordRequestsForDirectorate() {
  if (_passwordDirectorateRef) _passwordDirectorateRef.off();
  _passwordDirectorateRef = database.ref('passwordRequests');
  _passwordDirectorateRef.on('child_added', snap => {
    const req = snap.val();
    if (!req || req.status !== 'pending' || _passwordNotified.has(snap.key)) return;
    _passwordNotified.add(snap.key);
    showPasswordRequestNotice(snap.key, req);
    playPasswordRequestChime();
  });
  _passwordDirectorateRef.on('child_changed', snap => {
    const req = snap.val();
    if (req && req.status !== 'pending') document.getElementById('passwordNotice_' + snap.key)?.remove();
  });
}

function showPasswordRequestNotice(id, req) {
  const old = document.getElementById('passwordNotice_' + id);
  if (old) return;
  let stack = document.getElementById('passwordRequestStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'passwordRequestStack';
    stack.className = 'password-request-stack';
    document.body.appendChild(stack);
  }
  const box = document.createElement('div');
  box.id = 'passwordNotice_' + id;
  box.className = 'password-request-notice';
  box.innerHTML = `<div class="prn-head"><span class="prn-icon"><i class="fa-solid fa-key"></i></span><div>طلب كلمة سر جديد</div></div>
    <div style="font-weight:800;line-height:1.8;">${escapeHtml(req.centerName || 'مؤسسة')}</div>
    <div style="font-size:14px;color:var(--text-dim);">الرمز: ${escapeHtml(req.centerCode || '—')} · ${req.centerType === 'private' ? 'مدرسة خاصة' : 'مركز/معهد'}</div>
    <div class="prn-actions">
      <button class="btn-mini success" onclick="sendRequestedPassword('${escapeHtml(id)}')"><i class="fa-solid fa-paper-plane"></i> إرسال كلمة السر</button>
      <button class="btn-mini" onclick="document.getElementById('passwordNotice_${escapeHtml(id)}')?.remove()"><i class="fa-solid fa-xmark"></i> لاحقاً</button>
    </div>`;
  stack.appendChild(box);
}

function sendRequestedPassword(requestId) {
  database.ref('passwordRequests/' + requestId).once('value').then(snap => {
    const req = snap.val();
    if (!req) return;
    const inst = INSTITUTIONS_DATA.find(i => i.code === req.centerCode || i.name === req.centerName);
    if (!inst) { showToast('⚠️ خطأ', 'لم يتم العثور على كلمة سر المؤسسة'); return; }
    return database.ref('passwordRequests/' + requestId).update({
      status: 'sent', password: inst.password, sentAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
      document.getElementById('passwordNotice_' + requestId)?.remove();
      showToast('✅ تم الإرسال', 'تم إرسال كلمة السر إلى ' + inst.name + ' وستظهر لمدة 40 ثانية.');
    });
  }).catch(err => showToast('⚠️ خطأ', 'تعذر إرسال كلمة السر: ' + err.message));
}

function showPasswordFor40Seconds(password, centerName, requestId) {
  document.getElementById('passwordRevealOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'passwordRevealOverlay';
  overlay.className = 'password-reveal-overlay';
  overlay.style.cursor = 'pointer';
  overlay.onclick = function(e) { if (e.target === overlay) closePasswordRevealEarly(); };
  overlay.innerHTML = `<div class="password-reveal-card" style="cursor:default;" onclick="event.stopPropagation();">
    <div style="font-size:42px;color:var(--algeria-green);"><i class="fa-solid fa-unlock-keyhole"></i></div>
    <h2 style="margin-top:8px;">وصلت كلمة السر</h2>
    <div style="color:var(--text-dim);font-size:15px;">${escapeHtml(centerName || '')}</div>
    <div class="password-reveal-code">${escapeHtml(password)}</div>
    <div class="password-countdown">تختفي بعد <span id="passwordCountdown">40</span> ثانية</div>
    <div style="margin-top:10px;font-size:13px;color:var(--text-dim);"><i class="fa-solid fa-shield-halved"></i> لا تشارك كلمة السر مع أي جهة غير مخولة</div>
    <button onclick="closePasswordRevealEarly()" style="margin-top:16px;padding:12px 28px;border-radius:14px;border:2px solid var(--algeria-red);background:transparent;color:var(--algeria-red);font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;transition:all 0.2s ease;" onmouseover="this.style.background='var(--grad-red)';this.style.color='#fff';this.style.borderColor='transparent';" onmouseout="this.style.background='transparent';this.style.color='var(--algeria-red)';this.style.borderColor='var(--algeria-red)';"><i class="fa-solid fa-xmark"></i> إغلاق الآن</button>
  </div>`;
  document.body.appendChild(overlay);
  const passInput = document.getElementById('loginCenterPass');
  if (passInput) passInput.value = password;
  let remaining = 40;
  clearInterval(_passwordRevealTimer);
  _passwordRevealTimer = setInterval(() => {
    remaining--;
    const el = document.getElementById('passwordCountdown');
    if (el) el.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(_passwordRevealTimer);
      overlay.remove();
      if (passInput) passInput.value = '';
      localStorage.removeItem('pending_password_request');
      database.ref('passwordRequests/' + requestId).remove();
      const status = document.getElementById('passwordRequestStatus');
      if (status) status.style.display = 'none';
    }
  }, 1000);
}

// 🔑 إغلاق نافذة كلمة السر يدوياً قبل انتهاء 40 ثانية
function closePasswordRevealEarly() {
  clearInterval(_passwordRevealTimer);
  var overlay = document.getElementById('passwordRevealOverlay');
  if (overlay) overlay.remove();
  var passInput = document.getElementById('loginCenterPass');
  // نحتفظ بكلمة السر في الحقل حتى يتمكن المستخدم من استخدامها
  localStorage.removeItem('pending_password_request');
  var status = document.getElementById('passwordRequestStatus');
  if (status) status.style.display = 'none';
  showToast('✅ تم الإغلاق', 'تم إغلاق نافذة كلمة السر. يمكنك الآن استخدامها.');
}

function playPasswordRequestChime() {
  if (typeof isMuted !== 'undefined' && isMuted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [740, 980].forEach((f,i) => {
      const o=ctx.createOscillator(), g=ctx.createGain(); o.connect(g);g.connect(ctx.destination);o.frequency.value=f;
      g.gain.setValueAtTime(.001,now+i*.16);g.gain.linearRampToValueAtTime(.18,now+i*.16+.02);g.gain.exponentialRampToValueAtTime(.001,now+i*.16+.22);
      o.start(now+i*.16);o.stop(now+i*.16+.24);
    });
  } catch(e) {}
}



// 🚪 LOGOUT
function logout() {
  if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
    if (_passwordDirectorateRef) { _passwordDirectorateRef.off(); _passwordDirectorateRef = null; }
    document.getElementById('passwordRequestStack')?.remove();
    document.getElementById('incomingIssueChat')?.remove();
    _incomingIssueQueue.length = 0; _incomingIssueOpenCode = null; _incomingCurrentIssue = null;
    document.getElementById('appRoot').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginError').style.display = 'none';
    currentRole = null;
    currentDepartment = null;
    localStorage.removeItem(LS_KEYS.remember);
    clearSession();
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginCenterSelect').value = '';
    document.getElementById('loginCenterPass').value = '';
    document.getElementById('loginCenterSearch').value = '';
    document.getElementById('loginDeptSelect').value = '';
    document.getElementById('loginDeptPass').value = '';
    notifiedMessages.clear();
    ['activeIssues','archivedIssues','centerIssues','centerArchived','fileTypes','departments','auditLog']
      .forEach(key => database.ref('data/' + key).off());
    database.ref('chats').off();
    database.ref('interChatRoom').off();
  }
}

