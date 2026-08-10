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
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.88rem">✅ All good! No alerts.</div>`;
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

function renderAbout() { /* static page, no dynamic render needed */ }

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

  // Build creator sidebar if applicable
  buildCreatorSidebar();

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
  err.style.color = '';
  if (!user || !pass) { err.textContent = 'Please fill in all fields.'; return; }
  const users = getUsers();
  if (!users[user]) { err.textContent = 'Username not found.'; return; }
  if (users[user].password !== btoa(pass)) { err.textContent = 'Incorrect password.'; return; }

  // MAINTENANCE MODE CHECK
  // NOTE: This is a frontend-only check. LocalStorage can be modified via DevTools.
  // A real backend is required for production-grade access control.
  if (getMaintenanceMode() && !isCreator(user)) {
    err.style.color = '#f59e0b';
    err.textContent = 'THE GYM RATS is currently under maintenance. Please try again later.';
    return;
  }

  // Remember me
  if (document.getElementById('login-remember')?.checked) {
    localStorage.setItem('gymrats_remember', user);
  }
  setSession(user);
  const data = loadData();
  if (!data.profile.name) { data.profile.name = users[user].name || user; saveData(data); }
  // Loading animation on button
  const btn = document.getElementById('btn-login');
  btn.classList.add('loading');
  btn.textContent = 'LOADING...';
  setTimeout(launchApp, 600);
}

function handleSignup() {
  const name    = document.getElementById('signup-name').value.trim();
  const user    = document.getElementById('signup-user').value.trim();
  const pass    = document.getElementById('signup-pass').value;
  const confirm = document.getElementById('signup-confirm').value;
  const err     = document.getElementById('signup-error');
  err.style.color = '';
  if (!name || !user || !pass || !confirm) { err.textContent = 'Please fill in all fields.'; return; }
  if (pass.length < 4) { err.textContent = 'Password must be at least 4 characters.'; return; }
  if (pass !== confirm) { err.textContent = 'Passwords do not match.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(user)) { err.textContent = 'Username: letters, numbers, _ only.'; return; }
  const users = getUsers();
  if (users[user]) { err.textContent = 'Username already taken.'; return; }
  users[user] = { name, password: btoa(pass) };
  saveUsers(users);
  setSession(user);
  const data = loadData();
  data.profile.name = name;
  data.profile.avatar = 'GR';
  saveData(data);
  const btn = document.getElementById('btn-signup');
  btn.classList.add('loading');
  btn.textContent = 'CREATING...';
  setTimeout(launchApp, 600);
}

function launchApp() {
  // Close auth modal
  const overlay = document.getElementById('auth-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  // Fade out hero screen
  const screen = document.getElementById('auth-screen');
  if (screen) {
    screen.style.transition = 'opacity 0.5s ease';
    screen.style.opacity = '0';
    setTimeout(() => { screen.style.display = 'none'; init(); }, 500);
  } else {
    init();
  }
}

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

/* ============================================
   CANVAS BODYBUILDER ANIMATION
   ============================================ */

(function initAuthCanvas() {
  const canvas = document.getElementById('auth-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, raf;
  let t = 0;

  // Particles
  const PARTICLE_COUNT = 60;
  const particles = [];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.8 + 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(Math.random() * 0.4 + 0.1),
        alpha: Math.random() * 0.5 + 0.1,
        life: Math.random()
      });
    }
  }

  function drawBackground() {
    // Deep black base
    ctx.fillStyle = '#020202';
    ctx.fillRect(0, 0, W, H);

    // Animated red floor glow
    const glowY = H * 0.75 + Math.sin(t * 0.008) * 20;
    const grd = ctx.createRadialGradient(W * 0.5, glowY, 0, W * 0.5, glowY, W * 0.7);
    grd.addColorStop(0, 'rgba(224,28,28,0.18)');
    grd.addColorStop(0.5, 'rgba(180,10,10,0.06)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Top vignette
    const topGrd = ctx.createLinearGradient(0, 0, 0, H * 0.4);
    topGrd.addColorStop(0, 'rgba(2,2,2,0.7)');
    topGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = topGrd;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGrid() {
    // Perspective floor grid
    ctx.save();
    ctx.globalAlpha = 0.07 + Math.sin(t * 0.01) * 0.02;
    ctx.strokeStyle = '#e01c1c';
    ctx.lineWidth = 0.5;
    const horizon = H * 0.62;
    const vp = { x: W * 0.5, y: horizon };
    const cols = 14;
    for (let i = -cols; i <= cols; i++) {
      const bx = W * 0.5 + i * (W / cols);
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(bx, H + 20);
      ctx.stroke();
    }
    const rows = 10;
    for (let j = 0; j <= rows; j++) {
      const prog = j / rows;
      const y = horizon + (H - horizon + 20) * (prog * prog);
      const halfW = (W * 0.5 + 60) * prog;
      ctx.beginPath();
      ctx.moveTo(vp.x - halfW, y);
      ctx.lineTo(vp.x + halfW, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBodybuilder() {
    const cx = W * 0.5;
    const cy = H * 0.5;
    const scale = Math.min(W, H) / 520;

    // Breathing: subtle scale pulse
    const breathe = 1 + Math.sin(t * 0.025) * 0.012;
    // Subtle sway
    const sway = Math.sin(t * 0.018) * 3;

    ctx.save();
    ctx.translate(cx + sway, cy);
    ctx.scale(scale * breathe, scale * breathe);

    // --- RIM LIGHT (back glow) ---
    const rimAlpha = 0.55 + Math.sin(t * 0.02) * 0.15;
    const rimGrd = ctx.createRadialGradient(0, -60, 20, 0, -60, 200);
    rimGrd.addColorStop(0, `rgba(224,28,28,${rimAlpha})`);
    rimGrd.addColorStop(0.4, `rgba(180,10,10,${rimAlpha * 0.3})`);
    rimGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = rimGrd;
    ctx.beginPath();
    ctx.ellipse(0, -60, 160, 220, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shadow on floor
    ctx.save();
    ctx.globalAlpha = 0.35;
    const shadowGrd = ctx.createRadialGradient(0, 200, 0, 0, 200, 120);
    shadowGrd.addColorStop(0, 'rgba(0,0,0,0.8)');
    shadowGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = shadowGrd;
    ctx.beginPath();
    ctx.ellipse(0, 200, 100, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ---- FIGURE DRAWING ----
    const bodyColor = '#1a1a1a';
    const muscleColor = '#2a2a2a';
    const rimColor = `rgba(224,28,28,${0.7 + Math.sin(t * 0.02) * 0.2})`;
    const rimW = 2.5;

    function rimStroke(color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    // LEGS
    // Left leg
    ctx.beginPath();
    ctx.moveTo(-28, 80);
    ctx.bezierCurveTo(-45, 120, -50, 160, -42, 200);
    ctx.bezierCurveTo(-38, 210, -20, 212, -18, 200);
    ctx.bezierCurveTo(-16, 160, -18, 120, -10, 80);
    ctx.closePath();
    ctx.fillStyle = muscleColor;
    ctx.fill();
    rimStroke(rimColor, rimW);

    // Right leg
    ctx.beginPath();
    ctx.moveTo(28, 80);
    ctx.bezierCurveTo(45, 120, 50, 160, 42, 200);
    ctx.bezierCurveTo(38, 210, 20, 212, 18, 200);
    ctx.bezierCurveTo(16, 160, 18, 120, 10, 80);
    ctx.closePath();
    ctx.fillStyle = muscleColor;
    ctx.fill();
    rimStroke(rimColor, rimW);

    // TORSO
    ctx.beginPath();
    ctx.moveTo(-55, -40);
    ctx.bezierCurveTo(-65, 0, -60, 50, -30, 80);
    ctx.lineTo(30, 80);
    ctx.bezierCurveTo(60, 50, 65, 0, 55, -40);
    ctx.bezierCurveTo(40, -60, -40, -60, -55, -40);
    ctx.closePath();
    ctx.fillStyle = bodyColor;
    ctx.fill();
    rimStroke(rimColor, rimW);

    // Chest definition
    ctx.beginPath();
    ctx.moveTo(-40, -30);
    ctx.bezierCurveTo(-50, -10, -45, 10, -20, 20);
    ctx.bezierCurveTo(-5, 25, 5, 25, 20, 20);
    ctx.bezierCurveTo(45, 10, 50, -10, 40, -30);
    ctx.strokeStyle = `rgba(224,28,28,${0.25 + Math.sin(t * 0.02) * 0.08})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Abs lines
    for (let i = 0; i < 3; i++) {
      const ay = 10 + i * 22;
      ctx.beginPath();
      ctx.moveTo(-18, ay);
      ctx.lineTo(18, ay);
      ctx.strokeStyle = `rgba(224,28,28,${0.2 - i * 0.04})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(0, 75);
    ctx.strokeStyle = 'rgba(224,28,28,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // LEFT ARM (raised pose)
    const armAngle = Math.sin(t * 0.018) * 0.06;
    ctx.save();
    ctx.translate(-55, -30);
    ctx.rotate(-0.3 + armAngle);
    // Upper arm
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-25, 10, -35, 40, -30, 70);
    ctx.bezierCurveTo(-25, 80, -5, 80, 0, 70);
    ctx.bezierCurveTo(5, 40, 5, 10, 0, 0);
    ctx.closePath();
    ctx.fillStyle = muscleColor;
    ctx.fill();
    rimStroke(rimColor, rimW);
    // Bicep peak
    ctx.beginPath();
    ctx.moveTo(-20, 20);
    ctx.bezierCurveTo(-30, 30, -32, 50, -20, 55);
    ctx.strokeStyle = `rgba(224,28,28,${0.3 + Math.sin(t * 0.02) * 0.1})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Forearm
    ctx.translate(-28, 72);
    ctx.rotate(0.4);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-15, 5, -18, 35, -12, 60);
    ctx.bezierCurveTo(-8, 68, 8, 68, 10, 60);
    ctx.bezierCurveTo(14, 35, 12, 5, 0, 0);
    ctx.closePath();
    ctx.fillStyle = muscleColor;
    ctx.fill();
    rimStroke(rimColor, rimW);
    ctx.restore();

    // RIGHT ARM
    ctx.save();
    ctx.translate(55, -30);
    ctx.rotate(0.3 - armAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(25, 10, 35, 40, 30, 70);
    ctx.bezierCurveTo(25, 80, 5, 80, 0, 70);
    ctx.bezierCurveTo(-5, 40, -5, 10, 0, 0);
    ctx.closePath();
    ctx.fillStyle = muscleColor;
    ctx.fill();
    rimStroke(rimColor, rimW);
    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.bezierCurveTo(30, 30, 32, 50, 20, 55);
    ctx.strokeStyle = `rgba(224,28,28,${0.3 + Math.sin(t * 0.02) * 0.1})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.translate(28, 72);
    ctx.rotate(-0.4);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(15, 5, 18, 35, 12, 60);
    ctx.bezierCurveTo(8, 68, -8, 68, -10, 60);
    ctx.bezierCurveTo(-14, 35, -12, 5, 0, 0);
    ctx.closePath();
    ctx.fillStyle = muscleColor;
    ctx.fill();
    rimStroke(rimColor, rimW);
    ctx.restore();

    // NECK
    ctx.beginPath();
    ctx.moveTo(-14, -60);
    ctx.bezierCurveTo(-16, -50, -16, -44, -14, -40);
    ctx.lineTo(14, -40);
    ctx.bezierCurveTo(16, -44, 16, -50, 14, -60);
    ctx.closePath();
    ctx.fillStyle = bodyColor;
    ctx.fill();
    rimStroke(rimColor, 1.5);

    // HEAD
    const headBob = Math.sin(t * 0.025) * 2;
    ctx.beginPath();
    ctx.ellipse(0, -90 + headBob, 28, 32, 0, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    rimStroke(rimColor, rimW);

    // SHOULDERS
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.ellipse(side * 58, -38, 18, 14, side * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = muscleColor;
      ctx.fill();
      rimStroke(rimColor, rimW);
    });

    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life += 0.003;
      if (p.y < -10 || p.life > 1) {
        p.x = Math.random() * W;
        p.y = H + 10;
        p.life = 0;
        p.alpha = Math.random() * 0.4 + 0.1;
      }
      const fade = Math.sin(p.life * Math.PI);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(224,28,28,${p.alpha * fade})`;
      ctx.fill();
    });
  }

  function drawScanlines() {
    ctx.save();
    ctx.globalAlpha = 0.025;
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();
  }

  function drawVignette() {
    const vgrd = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.85);
    vgrd.addColorStop(0, 'transparent');
    vgrd.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vgrd;
    ctx.fillRect(0, 0, W, H);
  }

  function loop() {
    t++;
    drawBackground();
    drawGrid();
    drawBodybuilder();
    drawParticles();
    drawScanlines();
    drawVignette();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    resize();
    initParticles();
    loop();
  }

  window.addEventListener('resize', () => {
    resize();
    initParticles();
  });

  // Stop animation when auth screen is hidden
  const observer = new MutationObserver(() => {
    const screen = document.getElementById('auth-screen');
    if (screen && screen.style.display === 'none') {
      cancelAnimationFrame(raf);
      observer.disconnect();
    }
  });
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) observer.observe(authScreen, { attributes: true, attributeFilter: ['style'] });

  start();
})();

// Boot — check session
if (getSession()) {
  launchApp();
} else {
  // Show maintenance overlay on login screen if maintenance is ON
  applyMaintenanceToLoginScreen();
}
