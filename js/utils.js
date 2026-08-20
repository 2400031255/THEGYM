/* ============================================
   OG FITNESS — utils.js
   Shared UI Utilities
   ============================================ */

/* ---- TOAST ---- */
let toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

/* ---- MODAL ---- */
let modalConfirmCb = null;
function showModal(title, body, confirmText = 'Confirm', onConfirm = null) {
  const ov = document.getElementById('modal-overlay');
  const ti = document.getElementById('modal-title');
  const bo = document.getElementById('modal-body');
  const co = document.getElementById('modal-confirm');
  if (!ov) return;
  if (ti) ti.textContent = title;
  if (bo) bo.textContent = body;
  if (co) co.textContent = confirmText;
  ov.style.display = 'flex';
  modalConfirmCb = onConfirm;
}
function closeModal() {
  const ov = document.getElementById('modal-overlay');
  if (ov) ov.style.display = 'none';
  modalConfirmCb = null;
}

/* ---- NAVIGATION ---- */
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');

  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(el => el.classList.add('active'));

  const sb = document.getElementById('sidebar');
  const so = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.remove('open');
  if (so) so.classList.remove('open');

  if (typeof pageRenderers[pageId] === 'function') pageRenderers[pageId]();
}

/* page renderers registry */
const pageRenderers = {};

function triggerPageAction(page, action) {
  const map = {
    'workouts':    'btn-new-workout',
    'membership':  'btn-new-membership',
    'supplements': 'btn-new-supplement',
    'expenses':    'btn-new-expense',
    'progress':    'btn-new-progress'
  };
  if (map[page] && action === 'new') {
    document.getElementById(map[page])?.click();
  }
}

/* ---- NOTIFICATIONS ENGINE ---- */
function generateNotifications() {
  const data = loadData();
  const notifs = [];

  const activeMembership = data.membership.find(m => calculateMembershipDays(m.endDate) >= 0);
  if (activeMembership) {
    const days = calculateMembershipDays(activeMembership.endDate);
    if (days === 0)      notifs.push({ icon: '!', text: 'Your gym membership expires TODAY!', type: 'error' });
    else if (days <= 5)  notifs.push({ icon: '!', text: `Gym membership expires in ${days} day${days !== 1 ? 's' : ''}.`, type: 'warning' });
    else if (days <= 10) notifs.push({ icon: 'i', text: `Gym membership expires in ${days} days.`, type: 'info' });
  } else if (data.membership.length > 0) {
    notifs.push({ icon: '!', text: 'Your gym membership has expired. Renew now!', type: 'error' });
  }

  data.supplements.forEach(supp => {
    const remaining = calculateSupplementRemaining(supp.id);
    const status = getSupplementStatus(remaining, supp.servingSize);
    if (status.label === 'FINISHED')     notifs.push({ icon: 'x', text: `${supp.name} is finished. Time to restock!`, type: 'error' });
    else if (status.label === 'LAST SERVING') notifs.push({ icon: '!', text: `${supp.name} — only last serving remaining!`, type: 'error' });
    else if (status.label === 'VERY LOW') notifs.push({ icon: '!', text: `${supp.name} is very low (${remaining.toFixed(1)} ${supp.unit} left).`, type: 'warning' });
    else if (status.label === 'LOW')      notifs.push({ icon: '~', text: `${supp.name} is running low (${remaining.toFixed(1)} ${supp.unit} left).`, type: 'warning' });
  });

  const streak = calculateWorkoutStreak();
  if (streak.current >= 3) notifs.push({ icon: '+', text: `You're on a ${streak.current}-day workout streak. Keep it up!`, type: 'success' });

  data.expenses.forEach(exp => {
    if (exp.splits) exp.splits.forEach(s => {
      if (!s.paid) notifs.push({ icon: '$', text: `${s.name} has ₹${s.amount} pending for "${exp.description}".`, type: 'warning' });
    });
  });

  return notifs;
}

function updateNotifBadge() {
  const notifs = generateNotifications();
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = notifs.length > 0 ? 'block' : 'none';
}

/* ---- EMPTY STATE ---- */
function emptyState(icon, msg) {
  return `<div class="empty-state">${icon ? `<div class="empty-state-icon">${icon}</div>` : ''}<div>${msg}</div></div>`;
}

/* ---- FORMAT CURRENCY ---- */
function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

/* ---- CONFIRM DELETE ---- */
function confirmDelete(itemName, onConfirm) {
  showModal('Delete ' + itemName, `Are you sure you want to delete this? This cannot be undone.`, 'Delete', onConfirm);
}

/* ---- SET TODAY DATE ON INPUT ---- */
function setTodayDate(inputId) {
  const el = document.getElementById(inputId);
  if (el && !el.value) el.value = formatDateISO(new Date());
}

/* ---- ALL DOM LISTENERS — bound after DOM ready ---- */
document.addEventListener('DOMContentLoaded', () => {

  /* Modal buttons */
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-confirm')?.addEventListener('click', () => {
    if (modalConfirmCb) modalConfirmCb();
    closeModal();
  });
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  /* Sidebar toggle */
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('open');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
  });

  /* Nav click delegation */
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', function() {
      const action = this.dataset.action;
      const page   = this.dataset.page;
      if (!page) return;
      navigateTo(page);
      if (action) setTimeout(() => triggerPageAction(page, action), 50);
    });
  });

  /* Notifications page clear button */
  document.getElementById('btn-clear-notifs')?.addEventListener('click', () => {
    const el = document.getElementById('notifications-list');
    if (el) el.innerHTML = '<div class="notif-empty">No notifications.</div>';
  });

  /* Quick scoop button */
  document.getElementById('qa-scoop')?.addEventListener('click', () => {
    navigateTo('supplements');
  });

});
