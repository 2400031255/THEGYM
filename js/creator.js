/* ============================================================
   THE GYM RATS — creator.js
   Creator Identity, Badge, Maintenance Mode & Controls

   SECURITY NOTICE (Developer):
   ─────────────────────────────────────────────────────────
   Frontend-only authentication and LocalStorage role checks
   are NOT secure authentication. Users can modify LocalStorage
   using browser developer tools. A backend authentication
   system is required for production security.
   ─────────────────────────────────────────────────────────

   Creator account is identified by username stored in
   CREATOR_USERNAME constant below. Role is set at signup/login
   and stored in gymrats_users LocalStorage key.
   ============================================================ */

const CREATOR_USERNAME = 'nikhil';
/* seedCreator() is called from app.js boot after all helpers are defined */

/* ---- Maintenance helpers ---- */
function getMaintenanceMode() {
  return localStorage.getItem('gymrats_maintenance') === 'on';
}
function setMaintenanceMode(on) {
  localStorage.setItem('gymrats_maintenance', on ? 'on' : 'off');
}

/* isCreator() is defined in auth.js (Firebase-based) — do not redefine here */

/* ---- Inject creator badge HTML ---- */
function creatorBadgeHTML() {
  return `<span class="creator-badge"><span class="creator-badge-star">&#9733;</span> CREATOR</span>`;
}

/* ---- Build creator sidebar section ---- */
function buildCreatorSidebar() {
  if (!isCreator()) return;
  const nav = document.querySelector('.sidebar-nav');
  if (!nav || document.getElementById('creator-nav-section')) return;

  const section = document.createElement('div');
  section.id = 'creator-nav-section';
  section.innerHTML = `
    <div class="creator-nav-divider">
      <span>CREATOR</span>
    </div>
    <a class="nav-item creator-nav-item" data-page="creator-controls">
      <span class="nav-icon">&#9733;</span><span>Creator Controls</span>
    </a>
    <a class="nav-item creator-nav-item" data-page="creator-users">
      <span class="nav-icon">&#9671;</span><span>Users</span>
    </a>
    <a class="nav-item creator-nav-item" data-page="creator-maintenance">
      <span class="nav-icon">&#9881;</span><span>Maintenance Mode</span>
    </a>`;
  nav.appendChild(section);

  /* bind nav clicks for creator pages */
  section.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.page);
    });
  });
}

/* ---- Maintenance indicator bar (shown to creator when ON) ---- */
function updateMaintenanceBar() {
  let bar = document.getElementById('maintenance-bar');
  if (getMaintenanceMode() && isCreator()) {
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'maintenance-bar';
      bar.className = 'maintenance-bar';
      bar.innerHTML = `<span class="creator-badge" style="margin-right:0.5rem"><span class="creator-badge-star">&#9733;</span> CREATOR</span><span class="maintenance-active-badge">MAINTENANCE ACTIVE</span><span style="flex:1"></span><button onclick="toggleMaintenanceQuick()" class="maintenance-bar-off-btn">Turn OFF</button>`;
      const main = document.getElementById('main-content');
      main.insertBefore(bar, main.firstChild);
    }
    bar.style.display = 'flex';
  } else if (bar) {
    bar.style.display = 'none';
  }
}

function toggleMaintenanceQuick() {
  fs_setMaintenanceMode(false).catch(e => console.error('toggleMaintenanceQuick:', e));
  updateMaintenanceBar();
  renderCreatorMaintenance();
  showToast('Maintenance mode turned OFF.', 'success');
}

/* ---- Render: Creator Controls page ---- */
pageRenderers['creator-controls'] = async function renderCreatorControls() {
  const el = document.getElementById('page-creator-controls');
  if (!el) return;
  const maintOn = getMaintenanceMode();

  /* Show loading state first */
  el.innerHTML = `
    <div class="page-header">
      <h1>Creator Controls</h1>
      <span class="creator-badge" style="font-size:0.8rem;padding:0.35rem 0.9rem"><span class="creator-badge-star">&#9733;</span> CREATOR</span>
    </div>
    <div class="creator-identity-card card">
      <div class="creator-id-left">
        <div class="creator-avatar-ring">NK</div>
        <div>
          <div class="creator-id-name">Nikhil Karthik</div>
          <div class="creator-id-role">${creatorBadgeHTML()}</div>
          <div class="creator-id-sub">Application Creator &amp; Developer</div>
        </div>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:1.25rem">
      <div class="stat-card"><div class="stat-value" id="creator-user-count">...</div><div class="stat-label">Total Users</div></div>
      <div class="stat-card"><div class="stat-value" style="color:${maintOn ? '#f59e0b' : 'var(--success)'}">${maintOn ? 'ON' : 'OFF'}</div><div class="stat-label">Maintenance</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--success)">LIVE</div><div class="stat-label">App Status</div></div>
    </div>
    <div class="card">
      <div class="card-label">MAINTENANCE MODE</div>
      <div class="maintenance-toggle-row">
        <div>
          <div class="settings-action-title">Maintenance Mode</div>
          <div class="settings-action-desc">When ON, only you can log in. Normal users see a maintenance message.</div>
        </div>
        <button class="maintenance-toggle-btn ${maintOn ? 'on' : 'off'}" id="btn-toggle-maintenance" onclick="handleToggleMaintenance()">
          ${maintOn ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
    <div class="card" id="creator-users-card">
      <div class="card-label">REGISTERED USERS</div>
      <div style="color:var(--text-muted);font-size:0.88rem">Loading users...</div>
    </div>`;

  /* Load users from Firestore */
  try {
    const snap = await db.collection('users').get();
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const countEl = document.getElementById('creator-user-count');
    if (countEl) countEl.textContent = users.length;
    const usersCard = document.getElementById('creator-users-card');
    if (usersCard) {
      usersCard.innerHTML = `
        <div class="card-label">REGISTERED USERS</div>
        ${!users.length
          ? '<div style="color:var(--text-muted);font-size:0.88rem">No users registered yet.</div>'
          : users.map(u => {
              const p    = u.profile || {};
              const name = p.name || p.email || u.uid;
              const role = p.role || 'user';
              const isC  = role === 'creator' || isCreatorEmail(p.email);
              return `
                <div class="creator-user-row">
                  <div class="creator-user-avatar">${name.charAt(0).toUpperCase()}</div>
                  <div class="creator-user-info">
                    <div class="creator-user-name">${name} ${isC ? creatorBadgeHTML() : ''}</div>
                    <div class="creator-user-uname">${p.email || u.uid}</div>
                  </div>
                  <div class="creator-user-role ${isC ? 'role-creator' : 'role-user'}">${isC ? 'CREATOR' : 'USER'}</div>
                </div>`;
            }).join('')
        }`;
    }
  } catch (e) {
    console.error('renderCreatorControls users:', e);
    const usersCard = document.getElementById('creator-users-card');
    if (usersCard) usersCard.innerHTML = '<div class="card-label">REGISTERED USERS</div><div style="color:var(--text-muted);font-size:0.88rem">Could not load users.</div>';
  }
};

/* ---- Render: Users page ---- */
pageRenderers['creator-users'] = async function renderCreatorUsers() {
  const el = document.getElementById('page-creator-users');
  if (!el) return;
  el.innerHTML = `<div class="page-header"><h1>Users</h1></div><div class="card"><div class="card-label">ALL REGISTERED USERS</div><div style="color:var(--text-muted);font-size:0.88rem">Loading...</div></div>`;
  try {
    const snap  = await db.collection('users').get();
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    el.innerHTML = `
      <div class="page-header"><h1>Users</h1></div>
      <div class="card">
        <div class="card-label">ALL REGISTERED USERS (${users.length})</div>
        ${!users.length
          ? '<div style="color:var(--text-muted);font-size:0.88rem">No users registered yet.</div>'
          : users.map(u => {
              const p    = u.profile || {};
              const name = p.name || p.email || u.uid;
              const isC  = (p.role === 'creator') || isCreatorEmail(p.email);
              return `
                <div class="creator-user-row">
                  <div class="creator-user-avatar">${name.charAt(0).toUpperCase()}</div>
                  <div class="creator-user-info">
                    <div class="creator-user-name">${name} ${isC ? creatorBadgeHTML() : ''}</div>
                    <div class="creator-user-uname">${p.email || u.uid}</div>
                  </div>
                  <div class="creator-user-role ${isC ? 'role-creator' : 'role-user'}">${isC ? 'CREATOR' : 'USER'}</div>
                </div>`;
            }).join('')
        }
      </div>`;
  } catch (e) {
    console.error('renderCreatorUsers:', e);
    el.innerHTML = `<div class="page-header"><h1>Users</h1></div><div class="card"><div class="card-label">ALL REGISTERED USERS</div><div style="color:var(--text-muted)">Could not load users.</div></div>`;
  }
};

/* ---- Render: Maintenance page ---- */
pageRenderers['creator-maintenance'] = renderCreatorMaintenance;
function renderCreatorMaintenance() {
  const el = document.getElementById('page-creator-maintenance');
  if (!el) return;
  const maintOn = getMaintenanceMode();
  el.innerHTML = `
    <div class="page-header"><h1>Maintenance Mode</h1></div>
    <div class="card">
      <div class="card-label">MAINTENANCE CONTROL</div>
      <div class="maintenance-toggle-row">
        <div>
          <div class="settings-action-title">Maintenance Mode is currently <span style="color:${maintOn ? '#f59e0b' : 'var(--success)'}">${maintOn ? 'ON' : 'OFF'}</span></div>
          <div class="settings-action-desc">When ON, only the creator account can log in. Normal users will see a maintenance screen.</div>
        </div>
        <button class="maintenance-toggle-btn ${maintOn ? 'on' : 'off'}" id="btn-toggle-maintenance2" onclick="handleToggleMaintenance()">
          ${maintOn ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
    <div class="card">
      <div class="card-label">WHAT USERS SEE</div>
      <div class="maintenance-preview">
        <div class="mp-title">THE GYM RATS</div>
        <div class="mp-icon">&#9881;</div>
        <div class="mp-heading">MAINTENANCE MODE</div>
        <div class="mp-text">We're currently making improvements.<br>The application is temporarily unavailable for normal users.</div>
        <div class="mp-badge">CREATOR ACCESS ONLY</div>
      </div>
    </div>`;
}

function handleToggleMaintenance() {
  const current = getMaintenanceMode();
  const next = !current;
  /* Update Firestore so all devices see the change */
  fs_setMaintenanceMode(next).catch(e => console.error('handleToggleMaintenance:', e));
  updateMaintenanceBar();
  if (typeof pageRenderers['creator-controls'] === 'function') pageRenderers['creator-controls']();
  renderCreatorMaintenance();
  showToast(`Maintenance mode ${next ? 'enabled' : 'disabled'}.`, next ? 'warning' : 'success');
}

/* ---- Show maintenance overlay on login screen ---- */
function applyMaintenanceToLoginScreen() {
  if (!getMaintenanceMode()) return;
  const existing = document.getElementById('maintenance-login-overlay');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'maintenance-login-overlay';
  overlay.className = 'maintenance-login-overlay';
  overlay.innerHTML = `
    <div class="mlo-box">
      <div class="mlo-brand">THE GYM RATS</div>
      <div class="mlo-icon">&#9881;</div>
      <div class="mlo-title">MAINTENANCE MODE</div>
      <div class="mlo-text">We're currently making improvements.<br>The application is temporarily unavailable for normal users.</div>
      <div class="mlo-badge">CREATOR ACCESS ONLY</div>
      <button class="mlo-login-btn" onclick="openAuthModal()">CREATOR LOGIN</button>
    </div>`;

  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.appendChild(overlay);
}
