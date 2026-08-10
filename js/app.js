/* ============================================
   THE GYM RATS — app.js
   Dashboard, Settings & App Init
   ============================================ */

pageRenderers['dashboard'] = renderDashboard;
pageRenderers['settings']  = renderSettings;

/* ============================================
   DASHBOARD
   ============================================ */

function renderDashboard() {
  // Date
  const now = new Date();
  document.getElementById('dash-date').textContent =
    now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Stats
  const workouts    = getData('workouts');
  const streak      = calculateWorkoutStreak();
  const supplements = getData('supplements');
  const expenses    = getData('expenses');
  const thisMonth   = now.toISOString().slice(0, 7);
  const monthlyExp  = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0);
  const monthlyWo   = workouts.filter(w => w.date.startsWith(thisMonth)).length;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${streak.current}🔥</div><div class="stat-label">Streak</div></div>
    <div class="stat-card"><div class="stat-value">${monthlyWo}</div><div class="stat-label">Workouts / Month</div></div>
    <div class="stat-card"><div class="stat-value">${supplements.length}</div><div class="stat-label">Supplements</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:1.2rem">${formatINR(monthlyExp)}</div><div class="stat-label">Spent / Month</div></div>`;

  // Membership card
  renderDashMembership();

  // Streak card
  document.getElementById('dash-streak-content').innerHTML = `
    <div class="big-number">${streak.current}</div>
    <div class="big-label">DAY STREAK 🔥</div>
    <div style="margin-top:0.75rem;font-size:0.78rem;color:var(--text-muted)">Longest: ${streak.longest} days</div>`;

  // Supplements overview
  renderDashSupplements();

  // Notifications
  renderDashNotifications();
}

function renderDashMembership() {
  const memberships = getData('membership').sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  const el = document.getElementById('dash-membership-content');
  if (!memberships.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.88rem">No membership added. <a data-page="membership" data-action="new" style="color:var(--accent);cursor:pointer">Add one →</a></div>`;
    el.querySelector('a')?.addEventListener('click', () => { navigateTo('membership'); setTimeout(() => document.getElementById('btn-new-membership').click(), 50); });
    return;
  }
  const m    = memberships[0];
  const days = calculateMembershipDays(m.endDate);
  let daysClass = 'good', daysText = '';
  if (days < 0)      { daysClass = 'expired'; daysText = '🔴 EXPIRED'; }
  else if (days === 0) { daysClass = 'warning'; daysText = '⚠️ EXPIRES TODAY'; }
  else if (days <= 7)  { daysClass = 'warning'; daysText = `⚠️ ${days} DAYS LEFT`; }
  else                 { daysClass = 'good';    daysText = `✅ ${days} DAYS LEFT`; }

  const progress = calculateMembershipProgress(m.startDate, m.endDate);
  const barClass = days < 0 ? 'danger' : days <= 7 ? 'warning' : 'success';

  el.innerHTML = `
    <div style="font-weight:800;font-size:0.95rem;margin-bottom:0.25rem">${m.gymName}</div>
    <div style="color:var(--success);font-size:1.1rem;font-weight:900;margin-bottom:0.5rem">${formatINR(m.fee)} PAID ✓</div>
    <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.5rem">
      ${formatDateDisplay(m.startDate)} → ${formatDateDisplay(m.endDate)}
    </div>
    <div class="membership-days ${daysClass}" style="font-size:1.4rem;margin-bottom:0.25rem">${daysText}</div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-fill ${barClass}" style="width:${Math.max(0, 100 - progress)}%"></div>
    </div>`;
}

function renderDashSupplements() {
  const supplements = getData('supplements');
  const el = document.getElementById('dash-supplements-content');
  if (!supplements.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.88rem">No supplements added.</div>`;
    return;
  }
  el.innerHTML = supplements.map(s => {
    const remaining = calculateSupplementRemaining(s.id);
    const status    = getSupplementStatus(remaining, s.servingSize);
    const pct       = Math.max(0, (remaining / s.initialQty) * 100).toFixed(1);
    const barClass  = getBarClass(remaining, s.initialQty);
    return `
      <div style="margin-bottom:0.85rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem">
          <span style="font-weight:700;font-size:0.88rem">${s.name}</span>
          <span class="supp-status ${status.cls}" style="font-size:0.65rem">${status.icon} ${status.label}</span>
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.3rem">
          ${formatQty(remaining)} ${s.unit} remaining · ~${calculateEstimatedDays(s.id)} days
        </div>
        <div class="progress-bar-wrap" style="height:5px">
          <div class="progress-bar-fill ${barClass}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

function renderDashNotifications() {
  const notifs = generateNotifications();
  const el = document.getElementById('dash-notifications-content');
  if (!notifs.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.88rem">✅ All good! No alerts.</div>`;
    return;
  }
  el.innerHTML = notifs.slice(0, 5).map(n => `
    <div class="notif-item" style="padding:0.6rem 0">
      <div class="notif-icon">${n.icon}</div>
      <div class="notif-text">${n.text}</div>
    </div>`).join('');
}

/* ============================================
   SETTINGS
   ============================================ */

function renderSettings() {
  const profile = getData('profile');
  document.getElementById('profile-name').value   = profile.name   || '';
  document.getElementById('profile-avatar').value = profile.avatar || '💪';
  document.getElementById('profile-goal').value   = profile.goal   || 'Muscle Gain';
}

document.getElementById('profile-form').addEventListener('submit', function(e) {
  e.preventDefault();
  setData('profile', {
    name:   document.getElementById('profile-name').value.trim(),
    avatar: document.getElementById('profile-avatar').value.trim() || '💪',
    goal:   document.getElementById('profile-goal').value
  });
  showToast('Profile saved!', 'success');
});

document.getElementById('btn-export').addEventListener('click', () => {
  exportData();
  showToast('Data exported!', 'success');
});

document.getElementById('btn-import-trigger').addEventListener('click', () => {
  document.getElementById('btn-import').click();
});

document.getElementById('btn-import').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const ok = importData(e.target.result);
    if (ok) {
      showToast('Data imported successfully!', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showToast('Invalid backup file.', 'error');
    }
  };
  reader.readAsText(file);
  this.value = '';
});

document.getElementById('btn-clear-data').addEventListener('click', () => {
  showModal(
    'Clear All Data',
    'This will permanently delete ALL your data including workouts, supplements, membership, and expenses. This cannot be undone.',
    '🗑 Delete Everything',
    () => {
      clearAllData();
      showToast('All data cleared.', 'success');
      setTimeout(() => location.reload(), 800);
    }
  );
});

document.getElementById('btn-logout').addEventListener('click', () => {
  showModal('Logout', 'Are you sure you want to logout?', 'Logout', () => {
    clearSession();
    location.reload();
  });
});

/* ============================================
   APP INIT
   ============================================ */

function init() {
  // Set default dates on forms
  const today = formatDateISO(new Date());
  ['wf-date', 'ef-date', 'pf-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  // Render dashboard
  renderDashboard();
  updateNotifBadge();

  // Ensure dashboard is active
  navigateTo('dashboard');
}

/* ============================================
   AUTH — Login / Signup
   ============================================ */

function switchAuthTab(tab) {
  document.getElementById('form-login').classList.toggle('active', tab === 'login');
  document.getElementById('form-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('login-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem('gymrats_users') || '{}'); } catch { return {}; }
}
function saveUsers(u) { localStorage.setItem('gymrats_users', JSON.stringify(u)); }
function getSession() { return localStorage.getItem('gymrats_session'); }
function setSession(u) { localStorage.setItem('gymrats_session', u); }
function clearSession() { localStorage.removeItem('gymrats_session'); }

function handleLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err  = document.getElementById('login-error');
  if (!user || !pass) { err.textContent = 'Please fill in all fields.'; return; }
  const users = getUsers();
  if (!users[user]) { err.textContent = 'Username not found. Sign up first.'; return; }
  if (users[user].password !== btoa(pass)) { err.textContent = 'Incorrect password.'; return; }
  setSession(user);
  // restore this user's profile name
  const data = loadData();
  if (!data.profile.name) { data.profile.name = users[user].name || user; saveData(data); }
  launchApp();
}

function handleSignup() {
  const name    = document.getElementById('signup-name').value.trim();
  const user    = document.getElementById('signup-user').value.trim();
  const pass    = document.getElementById('signup-pass').value;
  const confirm = document.getElementById('signup-confirm').value;
  const err     = document.getElementById('signup-error');
  if (!name || !user || !pass || !confirm) { err.textContent = 'Please fill in all fields.'; return; }
  if (pass.length < 4) { err.textContent = 'Password must be at least 4 characters.'; return; }
  if (pass !== confirm) { err.textContent = 'Passwords do not match.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(user)) { err.textContent = 'Username: letters, numbers, _ only.'; return; }
  const users = getUsers();
  if (users[user]) { err.textContent = 'Username already taken.'; return; }
  users[user] = { name, password: btoa(pass) };
  saveUsers(users);
  setSession(user);
  // save name to profile
  const data = loadData();
  data.profile.name = name;
  data.profile.avatar = '💪';
  saveData(data);
  launchApp();
}

function launchApp() {
  document.getElementById('auth-screen').style.display = 'none';
  init();
}

// Enter key support on auth inputs
['login-user','login-pass'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
});
['signup-name','signup-user','signup-pass','signup-confirm'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') handleSignup(); });
});

// Boot — check session
if (getSession()) {
  launchApp();
} else {
  // show auth screen (already visible by default)
}
