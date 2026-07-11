// ============================================
// 💡 معرض الصور (Lightbox)
// عرض الصور بحجم كامل
// ============================================

// 💡 LIGHTBOX
function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightboxOverlay').classList.add('open'); }
function closeLightbox() { document.getElementById('lightboxOverlay').classList.remove('open'); document.getElementById('lightboxImg').src = ''; }



// 📜 SCROLL DRAG
// مزامنة تمرير جدول "متابعة الإنشغالات": كل صف له شريط تمرير خاص به (حتى لا نضطر
// للنزول لآخر الصفحة للوصول لشريط واحد)، لكن يجب أن تبقى كل الصفوف ورأس الجدول
// متوافقة مع بعضها البعض دائماً، فنعيد نسخ موضع التمرير إلى البقية فور تحريك أي واحد منها.
// نستخدم useCapture=true لأن حدث scroll لا "يفقاعي" (bubble) عادة، فنلتقطه أثناء مرحلة الالتقاط.
(function setupListRowScrollSync() {
  document.addEventListener('scroll', function(e) {
    const el = e.target;
    if (!el || !el.classList || (!el.classList.contains('list-row-scroll') && el.id !== 'listHeaderScroll')) return;
    const container = document.getElementById('listTableBody');
    const header = document.getElementById('listHeaderScroll');
    const left = el.scrollLeft;
    if (header && header !== el) header.scrollLeft = left;
    if (container) {
      container.querySelectorAll('.list-row-scroll').forEach(row => {
        if (row !== el) row.scrollLeft = left;
      });
    }
  }, true);
})();

function initScrollDrag(scrollId, trackId, thumbId) {
  const scrollEl = document.getElementById(scrollId);
  const track = document.getElementById(trackId);
  const thumb = document.getElementById(thumbId);
  if (!scrollEl || !track || !thumb) return;
  function updateThumbSize() {
    const ratio = scrollEl.clientWidth / scrollEl.scrollWidth;
    thumb.style.width = Math.max(ratio * track.clientWidth, 40) + 'px';
    updateThumbPosition();
  }
  function updateThumbPosition() {
    const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
    const maxThumbLeft = track.clientWidth - thumb.offsetWidth;
    if (maxScrollLeft <= 0) { thumb.style.right = '0px'; return; }
    const ratio = scrollEl.scrollLeft / maxScrollLeft;
    thumb.style.right = (ratio * maxThumbLeft) + 'px';
  }
  let dragging = false, startX = 0, startRight = 0;
  thumb.addEventListener('mousedown', (e) => { dragging = true; startX = e.clientX; startRight = parseFloat(thumb.style.right || '0'); e.preventDefault(); });
  thumb.addEventListener('touchstart', (e) => { dragging = true; startX = e.touches[0].clientX; startRight = parseFloat(thumb.style.right || '0'); });
  function onMove(clientX) {
    if (!dragging) return;
    const delta = startX - clientX;
    let newRight = startRight - delta;
    const maxThumbLeft = track.clientWidth - thumb.offsetWidth;
    newRight = Math.max(0, Math.min(maxThumbLeft, newRight));
    thumb.style.right = newRight + 'px';
    const ratio = maxThumbLeft > 0 ? newRight / maxThumbLeft : 0;
    const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
    scrollEl.scrollLeft = ratio * maxScrollLeft;
  }
  document.addEventListener('mousemove', (e) => onMove(e.clientX));
  document.addEventListener('touchmove', (e) => { if (dragging) onMove(e.touches[0].clientX); });
  document.addEventListener('mouseup', () => dragging = false);
  document.addEventListener('touchend', () => dragging = false);
  scrollEl.addEventListener('scroll', updateThumbPosition);
  window.addEventListener('resize', updateThumbSize);
  track.addEventListener('click', (e) => {
    if (e.target === thumb) return;
    const rect = track.getBoundingClientRect();
    const clickRatio = 1 - ((e.clientX - rect.left) / rect.width);
    const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
    scrollEl.scrollLeft = clickRatio * maxScrollLeft;
  });
  setTimeout(updateThumbSize, 200);
}



// 📋 DETAILS MODAL
function openDetails(code, fromArchive) {
  let source = fromArchive ? archivedIssues : activeIssues;
  let issue = source.find(i => i.code === code);
  if (!issue) { issue = centerArchived.find(i => i.code === code); if (!issue) return; }
  document.getElementById('detailsTitle').textContent = `📋 تفاصيل الإنشغال - ${issue.code}`;
  const timeStr = new Date(issue.createdAt).toLocaleString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const deptName = getDepartmentName(issue.department);
  let transferHistoryHtml = '';
  if (issue.transferHistory && issue.transferHistory.length > 0) {
    transferHistoryHtml = '<div class="detail-section"><span class="label">📋 سجل التحويلات</span><div class="value" style="font-size:15px;">';
    issue.transferHistory.forEach(h => {
      transferHistoryHtml += `<div>🔄 من ${h.from} → إلى ${h.to} ${h.reason ? ' (سبب: ' + h.reason + ')' : ''}</div>`;
    });
    transferHistoryHtml += '</div></div>';
  }
  let html = `<div class="detail-section"><span class="label">📌 المؤسسة المعنية</span><div class="value">${escapeHtml(issue.center)}</div></div>
    <div class="detail-section"><span class="label">📂 تصنيف الإنشغال</span><div class="value">${escapeHtml(issue.type)}</div></div>
    <div class="detail-section"><span class="label">🏢 المصلحة المسؤولة</span><div class="value">${escapeHtml(deptName)}</div></div>
    <div class="detail-section"><span class="label">⚡ درجة الأولوية</span><div class="value">${escapeHtml(issue.priority)}</div></div>
    <div class="detail-section"><span class="label">✍️ المحرر</span><div class="value">${escapeHtml(issue.author)}</div></div>
    <div class="detail-section"><span class="label">📅 تاريخ الإنشاء</span><div class="value">${timeStr}</div></div>
    ${transferHistoryHtml}
    <div class="detail-section"><span class="label">📝 التفاصيل الكاملة</span><div class="value" style="white-space:pre-wrap;">${linkifyText(issue.details)}</div></div>`;
  document.getElementById('detailsContent').innerHTML = html;
  const attachDiv = document.getElementById('detailsAttachment');
  if (issue.attachments && issue.attachments.length > 0) {
    attachDiv.style.display = 'block';
    const attach = issue.attachments[0];
    if (attach.type && attach.type.startsWith('image/')) {
      attachDiv.innerHTML = `<p style="color:var(--text-dim); font-size:15px; margin-bottom:6px;">📎 المرفق:</p><img src="${attach.data}" onclick="openLightbox('${attach.data}')" style="max-width:100%; max-height:320px; border-radius:12px; cursor:pointer; border:2px solid var(--border);">`;
    } else {
      attachDiv.innerHTML = `<p style="color:var(--text-dim); font-size:15px; margin-bottom:6px;">📎 المرفق:</p><a href="${attach.data}" download="${escapeHtml(attach.name)}" style="display:inline-block; padding:12px 24px; background:var(--algeria-green); color:#fff; border-radius:12px; text-decoration:none; font-weight:700; font-size:17px;"><i class="fa-solid fa-download"></i> تحميل المرفق: ${escapeHtml(attach.name)}</a>`;
    }
  } else { attachDiv.style.display = 'none'; }
  document.getElementById('detailsModal').classList.add('open');
}

function closeDetails() { document.getElementById('detailsModal').classList.remove('open'); }

