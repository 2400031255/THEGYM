/* ============================================
   THE GYM RATS — utils.js
   Shared UI Utilities
   ============================================ */

/* ---- TOAST ---- */
let toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

/* ---- MODAL ---- */
let modalConfirmCb = null;
function showModal(title, body, confirmText = 'Confirm', onConfirm = null) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  document.getElementById('modal-confirm').textContent = confirmText;
  document.getElementById('modal-overlay').style.display = 'flex';
  modalConfirmCb = onConfirm;
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  modalConfirmCb = null;
}
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-confirm').addEventListener('click', () => {
  if (modalConfirmCb) modalConfirmCb();
  closeModal();
});
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

/* ---- NAVIGATION ---- */
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');

  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(el => el.classList.add('active'));

  // close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');

  // refresh page content
  if (typeof pageRenderers[pageId] === 'function') pageRenderers[pageId]();
}

// page renderers registry — filled by each module
const pageRenderers = {};

/* ---- SIDEBAR TOGGLE ---- */
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
});
document.getElementById('sidebar-overlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
});

/* ---- NAV CLICK DELEGATION ---- */
document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', function(e) {
    const action = this.dataset.action;
    const page   = this.dataset.page;
    if (!page) return;
    navigateTo(page);
    if (action) {
      setTimeout(() => triggerPageAction(page, action), 50);
    }
  });
});

function triggerPageAction(page, action) {
  if (page === 'workouts' && action === 'new') {
    const btn = document.getElementById('btn-new-workout');
    if (btn) btn.click();
  }
  if (page === 'membership' && action === 'new') {
    const btn = document.getElementById('btn-new-membership');
    if (btn) btn.click();
  }
  if (page === 'supplements' && action === 'new') {
    const btn = document.getElementById('btn-new-supplement');
    if (btn) btn.click();
  }
  if (page === 'expenses' && action === 'new') {
    const btn = document.getElementById('btn-new-expense');
    if (btn) btn.click();
  }
  if (page === 'progress' && action === 'new') {
    const btn = document.getElementById('btn-new-progress');
    if (btn) btn.click();
  }
}

/* ---- NOTIFICATIONS ENGINE ---- */
function generateNotifications() {
  const data = loadData();
  const notifs = [];

  // Membership expiry
  const activeMembership = data.membership.find(m => calculateMembershipDays(m.endDate) >= 0);
  if (activeMembership) {
    const days = calculateMembershipDays(activeMembership.endDate);
    if (days === 0) notifs.push({ icon: '🔴', text: `Your gym membership expires TODAY!`, type: 'error' });
    else if (days <= 5) notifs.push({ icon: '⚠️', text: `Gym membership expires in ${days} day${days !== 1 ? 's' : ''}.`, type: 'warning' });
    else if (days <= 10) notifs.push({ icon: '💳', text: `Gym membership expires in ${days} days.`, type: 'info' });
  } else if (data.membership.length > 0) {
    notifs.push({ icon: '🔴', text: 'Your gym membership has expired. Renew now!', type: 'error' });
  }

  // Supplement alerts
  data.supplements.forEach(supp => {
    const remaining = calculateSupplementRemaining(supp.id);
    const status = getSupplementStatus(remaining, supp.servingSize);
    if (status.label === 'FINISHED') {
      notifs.push({ icon: '❌', text: `${supp.name} is finished. Time to restock!`, type: 'error' });
    } else if (status.label === 'LAST SERVING') {
      notifs.push({ icon: '🔴', text: `${supp.name} — only last serving remaining!`, type: 'error' });
    } else if (status.label === 'VERY LOW') {
      notifs.push({ icon: '🟠', text: `${supp.name} is very low (${remaining.toFixed(1)} ${supp.unit} left).`, type: 'warning' });
    } else if (status.label === 'LOW') {
      notifs.push({ icon: '🟡', text: `${supp.name} is running low (${remaining.toFixed(1)} ${supp.unit} left).`, type: 'warning' });
    }
  });

  // Workout streak
  const streak = calculateWorkoutStreak();
  if (streak.current >= 3) {
    notifs.push({ icon: '🔥', text: `You're on a ${streak.current}-day workout streak. Keep it up!`, type: 'success' });
  }

  // Pending expenses
  data.expenses.forEach(exp => {
    if (exp.splits) {
      exp.splits.forEach(s => {
        if (!s.paid) {
          notifs.push({ icon: '💰', text: `${s.name} has ₹${s.amount} pending for "${exp.description}".`, type: 'warning' });
        }
      });
    }
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
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div>${msg}</div>`;
}

/* ---- FORMAT CURRENCY ---- */
function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

/* ---- CONFIRM DELETE ---- */
function confirmDelete(itemName, onConfirm) {
  showModal('Delete ' + itemName, `Are you sure you want to delete "${itemName}"? This cannot be undone.`, 'Delete', onConfirm);
}

/* ---- SET TODAY DATE ON INPUT ---- */
function setTodayDate(inputId) {
  const el = document.getElementById(inputId);
  if (el && !el.value) el.value = formatDateISO(new Date());
}
