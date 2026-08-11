/* ============================================
   THE GYM RATS — app.js
   Dashboard, Settings & App Init
   ============================================ */

pageRenderers['dashboard'] = renderDashboard;
pageRenderers['settings']  = renderSettings;
pageRenderers['about']     = renderAbout;

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

  // Greeting with creator badge
  const profile = getData('profile');
  const userName = profile.name || getSession() || 'Athlete';
  const greetEl = document.getElementById('dash-greeting');
  if (greetEl) {
    greetEl.innerHTML = `
      <div class="dash-greeting-left">
        <div class="dash-greeting-name">
          Welcome back, ${userName}
          ${isCreator() ? creatorBadgeHTML() : ''}
        </div>
        <div class="dash-greeting-sub">${now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      ${getMaintenanceMode() && isCreator() ? '<span class="maintenance-active-badge">MAINTENANCE ACTIVE</span>' : ''}`;
  }

  // Date (keep for compatibility)
  const dateEl = document.getElementById('dash-date');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${streak.current}</div><div class="stat-label">Streak</div></div>
    <div class="stat-card"><div class="stat-value">${monthlyWo}</div><div class="stat-label">Workouts / Month</div></div>
    <div class="stat-card"><div class="stat-value">${supplements.length}</div><div class="stat-label">Supplements</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:1.2rem">${formatINR(monthlyExp)}</div><div class="stat-label">Spent / Month</div></div>`;

  // Membership card
  renderDashMembership();

  // Streak card
  document.getElementById('dash-streak-content').innerHTML = `
    <div class="big-number">${streak.current}</div>
    <div class="big-label">DAY STREAK</div>
    <div style="margin-top:0.75rem;font-size:0.78rem;color:var(--text-muted)">Longest: ${streak.longest} days</div>`;

  // Supplements overview
  renderDashSupplements();

  // Notifications
  renderDashNotifications();

  // Squad widget
  if (typeof renderSquadDashWidget === 'function') renderSquadDashWidget().catch(() => {});
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
  if (days < 0)      { daysClass = 'expired'; daysText = 'EXPIRED'; }
  else if (days === 0) { daysClass = 'warning'; daysText = 'EXPIRES TODAY'; }
  else if (days <= 7)  { daysClass = 'warning'; daysText = `${days} DAYS LEFT`; }
  else                 { daysClass = 'good';    daysText = `${days} DAYS LEFT`; }

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
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.88rem">All good! No alerts.</div>`;
    return;
  }
  el.innerHTML = notifs.slice(0, 5).map(n => `
    <div class="notif-item" style="padding:0.6rem 0">
      <div class="notif-icon notif-type-${n.type}">${n.icon}</div>
      <div class="notif-text">${n.text}</div>
    </div>`).join('');
}

/* ============================================
   SETTINGS
   ============================================ */

function renderSettings() {
  const profile = getData('profile');
  document.getElementById('profile-name').value   = profile.name   || '';
  document.getElementById('profile-avatar').value = profile.avatar || 'GR';
  document.getElementById('profile-goal').value   = profile.goal   || 'Muscle Gain';
  // Clear password fields
  ['pw-current','pw-new','pw-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const errEl = document.getElementById('pw-change-error');
  if (errEl) errEl.textContent = '';
  const fill = document.getElementById('pw-strength-fill');
  if (fill) { fill.style.width = '0%'; fill.style.background = ''; }

  // Privacy settings
  if (typeof renderPrivacySettings === 'function') renderPrivacySettings();
}

function updatePwStrength(val) {
  const fill = document.getElementById('pw-strength-fill');
  if (!fill) return;
  let score = 0;
  if (val.length >= 4) score++;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const pct = (score / 5) * 100;
  const colors = ['#e01c1c','#f97316','#f59e0b','#22c55e','#22c55e'];
  fill.style.width = pct + '%';
  fill.style.background = colors[Math.max(0, score - 1)] || '#e01c1c';
}

document.getElementById('pw-change-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const current = document.getElementById('pw-current').value;
  const newPw   = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  const errEl   = document.getElementById('pw-change-error');
  errEl.textContent = '';
  const username = getSession();
  const users = getUsers();
  if (!users[username]) { errEl.textContent = 'Session error. Please log in again.'; return; }
  if (users[username].password !== btoa(current)) { errEl.textContent = 'Current password is incorrect.'; return; }
  if (newPw.length < 4) { errEl.textContent = 'New password must be at least 4 characters.'; return; }
  if (newPw !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }
  users[username].password = btoa(newPw);
  saveUsers(users);
  showToast('Password updated successfully!', 'success');
  this.reset();
  const fill = document.getElementById('pw-strength-fill');
  if (fill) { fill.style.width = '0%'; }
});

function renderAbout() {
  const canvas = document.getElementById('about-canvas');
  if (!canvas || canvas._initialized) return;
  canvas._initialized = true;
  const ctx = canvas.getContext('2d');
  let W, H, raf, t = 0;
  const pts = [];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function initPts() {
    pts.length = 0;
    for (let i = 0; i < 55; i++) {
      pts.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.6 + 0.3,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(Math.random() * 0.3 + 0.05),
        a: Math.random() * 0.5 + 0.1,
        life: Math.random()
      });
    }
  }

  function draw() {
    t++;
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, W, H);
    const gy = H * 0.8 + Math.sin(t * 0.01) * 15;
    const g = ctx.createRadialGradient(W/2, gy, 0, W/2, gy, W * 0.65);
    g.addColorStop(0, 'rgba(224,28,28,0.22)');
    g.addColorStop(0.5, 'rgba(180,10,10,0.07)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.06 + Math.sin(t * 0.012) * 0.02;
    ctx.strokeStyle = '#e01c1c';
    ctx.lineWidth = 0.5;
    const hz = H * 0.55, vp = W / 2;
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo(vp, hz); ctx.lineTo(vp + i * (W / 10), H + 10); ctx.stroke();
    }
    for (let j = 0; j <= 8; j++) {
      const p = j / 8, y = hz + (H - hz + 10) * (p * p), hw = (W / 2 + 40) * p;
      ctx.beginPath(); ctx.moveTo(vp - hw, y); ctx.lineTo(vp + hw, y); ctx.stroke();
    }
    ctx.restore();
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life += 0.004;
      if (p.y < -5 || p.life > 1) { p.x = Math.random() * W; p.y = H + 5; p.life = 0; p.a = Math.random() * 0.4 + 0.1; }
      const fade = Math.sin(p.life * Math.PI);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(224,28,28,${p.a * fade})`; ctx.fill();
    });
    const tv = ctx.createLinearGradient(0, 0, 0, H * 0.35);
    tv.addColorStop(0, 'rgba(8,8,8,0.8)'); tv.addColorStop(1, 'transparent');
    ctx.fillStyle = tv; ctx.fillRect(0, 0, W, H);
    raf = requestAnimationFrame(draw);
  }

  resize(); initPts(); draw();
  window.addEventListener('resize', () => { resize(); initPts(); });
  const obs = new MutationObserver(() => {
    const pg = document.getElementById('page-about');
    if (pg && !pg.classList.contains('active')) {
      cancelAnimationFrame(raf); canvas._initialized = false; obs.disconnect();
    }
  });
  const pg = document.getElementById('page-about');
  if (pg) obs.observe(pg, { attributes: true, attributeFilter: ['class'] });
}

document.getElementById('profile-form').addEventListener('submit', function(e) {
  e.preventDefault();
  setData('profile', {
    name:   document.getElementById('profile-name').value.trim(),
    avatar: document.getElementById('profile-avatar').value.trim() || 'GR',
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
    'Delete Everything',
    () => {
      clearAllData();
      showToast('All data cleared.', 'success');
      setTimeout(() => location.reload(), 800);
    }
  );
});

/* btn-logout is handled by auth.js */

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

  // Build creator sidebar if applicable
  buildCreatorSidebar();

  // Set online status
  if (typeof squadService_updateStatus === 'function') squadService_updateStatus('online', null).catch(() => {});

  // Show maintenance bar if creator + maintenance on
  updateMaintenanceBar();

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


function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isHidden = inp.type === 'password';
  inp.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? 'HIDE' : 'SHOW';
}

function handleForgot() {
  const user = document.getElementById('login-user').value.trim();
  const users = getUsers();
  if (!user) { document.getElementById('login-error').textContent = 'Enter your username first.'; return; }
  if (!users[user]) { document.getElementById('login-error').textContent = 'Username not found.'; return; }
  document.getElementById('login-error').style.color = '#22c55e';
  document.getElementById('login-error').textContent = 'Hint: passwords are stored locally. Check your notes!';
  setTimeout(() => {
    const el = document.getElementById('login-error');
    if (el) { el.style.color = ''; el.textContent = ''; }
  }, 4000);
}

/* getSession / setSession kept for compatibility with other parts of the app */
function getSession() { return auth.currentUser ? auth.currentUser.uid : localStorage.getItem('gymrats_uid'); }
function setSession(u) { localStorage.setItem('gymrats_session', u); }
function clearSession() { handleLogout(); }

// Enter key support
['login-user','login-pass'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
});
['signup-name','signup-user','signup-pass','signup-confirm'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') handleSignup(); });
});

// Pre-fill remembered username
const remembered = localStorage.getItem('gymrats_remember');
if (remembered) {
  const el = document.getElementById('login-user');
  if (el) { el.value = remembered; }
  const cb = document.getElementById('login-remember');
  if (cb) cb.checked = true;
}

// Boot — Firebase auth.js handles session via onAuthStateChanged
// Legacy local session fallback (for offline/non-Firebase users)
if (!window.firebase && getSession()) {
  launchApp();
} else if (!window.firebase) {
  applyMaintenanceToLoginScreen();
}
