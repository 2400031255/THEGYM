/* ============================================
   THE GYM RATS — squad.js
   Gym Squad System — Full Page Renderer (Async/Firestore)
   ============================================ */

pageRenderers['squad'] = renderSquad;

let _activeSquadId = null;
let _lbTab         = 'workouts';

/* ============================================
   MAIN RENDER
   ============================================ */

async function renderSquad() {
  const page   = document.getElementById('page-squad');
  page.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted)">Loading squad...</div>`;

  const squads = await squadService_getMySquads();

  if (!squads.length) {
    renderSquadEmpty();
    return;
  }

  if (!_activeSquadId || !squads.find(s => s.id === _activeSquadId)) {
    _activeSquadId = squads[0].id;
  }

  const squad   = squads.find(s => s.id === _activeSquadId);
  const members = await squadService_getSquadMembers(_activeSquadId);
  const stats   = await squadService_getSquadStats(_activeSquadId);

  page.innerHTML = `
    ${renderSquadHeader(squad, stats, squads)}
    ${renderSquadOverviewStats(stats)}
    ${renderWhoIsTraining(members)}
    ${renderMemberCards(members)}
    ${await renderActivityFeed(_activeSquadId)}
    ${await renderLeaderboardSection(_activeSquadId)}
    ${await renderSquadChallengesSection(_activeSquadId)}
    ${renderSquadExpenses()}
    ${await renderSquadNotifications(_activeSquadId)}
  `;

  bindSquadEvents();
}

/* ============================================
   EMPTY STATE
   ============================================ */

function renderSquadEmpty() {
  const page = document.getElementById('page-squad');
  page.innerHTML = `
    <div class="page-header"><h1>👥 Gym Squad</h1></div>
    <div class="squad-empty-hero card">
      <div class="squad-empty-icon">👥</div>
      <div class="squad-empty-title">YOUR GYM SQUAD</div>
      <div class="squad-empty-sub">Train together. Track together. Get stronger together.</div>
      <div class="squad-empty-actions">
        <button class="btn-primary" onclick="openCreateSquadModal()">+ CREATE SQUAD</button>
        <button class="btn-secondary" onclick="openJoinSquadModal()">+ JOIN SQUAD</button>
      </div>
    </div>
    ${renderCreateSquadModal()}
    ${renderJoinSquadModal()}
  `;
}

/* ============================================
   SQUAD HEADER
   ============================================ */

function renderSquadHeader(squad, stats, squads) {
  const squadTabs = squads.length > 1
    ? `<div class="squad-tabs">${squads.map(s => `
        <button class="squad-tab ${s.id === _activeSquadId ? 'active' : ''}"
          onclick="switchSquad('${s.id}')">${s.name}</button>`).join('')}
      </div>` : '';

  return `
    <div class="page-header">
      <div>
        <h1>👥 Gym Squad</h1>
        <div class="squad-subtitle">Train together. Track together. Get stronger together.</div>
      </div>
      <div class="squad-header-actions">
        <button class="btn-ghost squad-btn-sm" onclick="openInviteModal('${squad.code}')">📤 Invite</button>
        <button class="btn-ghost squad-btn-sm" onclick="openJoinSquadModal()">+ Join</button>
        <button class="btn-primary squad-btn-sm" onclick="openCreateSquadModal()">+ Create</button>
      </div>
    </div>
    ${squadTabs}
    <div class="squad-identity-card card">
      <div class="squad-identity-left">
        <div class="squad-identity-icon">👥</div>
        <div>
          <div class="squad-identity-name">${squad.name}</div>
          <div class="squad-identity-meta">${stats.total} Members &nbsp;·&nbsp; Code: <span class="squad-code-inline">${squad.code}</span></div>
        </div>
      </div>
      <div class="squad-identity-right">
        <button class="btn-ghost squad-btn-sm" onclick="copySquadCode('${squad.code}')">📋 Copy Code</button>
        <button class="btn-danger squad-btn-sm" onclick="confirmLeaveSquad('${squad.id}')">Leave</button>
      </div>
    </div>
    ${renderCreateSquadModal()}
    ${renderJoinSquadModal()}
    ${renderInviteModal(squad.code)}
    ${renderMemberProfileModal()}
  `;
}

/* ============================================
   SQUAD OVERVIEW STATS
   ============================================ */

function renderSquadOverviewStats(stats) {
  return `
    <div class="squad-stats-grid">
      <div class="squad-stat-card">
        <div class="squad-stat-icon">🟢</div>
        <div class="squad-stat-val">${stats.trainingToday}</div>
        <div class="squad-stat-label">Training Today</div>
      </div>
      <div class="squad-stat-card">
        <div class="squad-stat-icon">🏋️</div>
        <div class="squad-stat-val">${stats.activeThisWeek}</div>
        <div class="squad-stat-label">Active This Week</div>
      </div>
      <div class="squad-stat-card">
        <div class="squad-stat-icon">🔥</div>
        <div class="squad-stat-val">${stats.onTenPlusStreak}</div>
        <div class="squad-stat-label">10+ Day Streak</div>
      </div>
      <div class="squad-stat-card">
        <div class="squad-stat-icon">💳</div>
        <div class="squad-stat-val">${stats.membershipsExpiring}</div>
        <div class="squad-stat-label">Expiring Soon</div>
      </div>
      <div class="squad-stat-card">
        <div class="squad-stat-icon">🥤</div>
        <div class="squad-stat-val">${stats.supplementsLow}</div>
        <div class="squad-stat-label">Supps Low</div>
      </div>
    </div>
  `;
}

/* ============================================
   WHO'S TRAINING TODAY
   ============================================ */

function renderWhoIsTraining(members) {
  const uid        = getSession();
  const me         = members.find(m => m.uid === uid);
  const isTraining = me && me.onlineStatus && me.onlineStatus.status === 'training';

  const rows = members.map(m => {
    const os      = m.onlineStatus;
    const privacy = m.privacy;
    if (!privacy.showOnlineStatus && !m.isMe) return '';
    const workout = os.workoutName
      ? `<span class="squad-training-workout">${os.workoutName}</span>` : '';
    return `
      <div class="squad-training-row">
        <div class="squad-training-dot">${os.dot}</div>
        <div class="squad-training-info">
          <span class="squad-training-name">${m.name}${m.isMe ? ' <span class="tag tag-red">YOU</span>' : ''}</span>
          ${workout}
        </div>
        <div class="squad-training-status">${os.label}</div>
      </div>`;
  }).filter(Boolean).join('');

  return `
    <div class="card">
      <div class="card-label">🔥 WHO'S TRAINING TODAY?</div>
      <div class="squad-my-status-row">
        <div>
          <div class="squad-my-status-label">Your Status</div>
          <div class="squad-my-status-val ${isTraining ? 'training' : ''}">${isTraining ? '🟢 TRAINING NOW' : '⚫ NOT TRAINING'}</div>
        </div>
        <button class="btn-primary squad-btn-sm" onclick="toggleTrainingStatus()">
          ${isTraining ? 'End Training' : "I'm Training"}
        </button>
      </div>
      <div class="squad-training-list">${rows || '<div class="squad-empty-row">No status shared yet.</div>'}</div>
    </div>
  `;
}

/* ============================================
   MEMBER CARDS
   ============================================ */

function renderMemberCards(members) {
  if (!members.length) return `<div class="card">${emptyState('👥', 'No members yet.')}</div>`;
  return `
    <div class="card">
      <div class="card-label">SQUAD MEMBERS</div>
      <div class="squad-members-grid">${members.map(m => renderSingleMemberCard(m)).join('')}</div>
    </div>
  `;
}

function renderSingleMemberCard(m) {
  const os       = m.onlineStatus;
  const privacy  = m.privacy;
  const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  let membershipHTML = '';
  if (m.membership && privacy.showMembership) {
    const ms = getMembershipStatusLabel(m.membership.daysLeft);
    membershipHTML = `
      <div class="squad-card-row">
        <span class="squad-card-icon">💳</span>
        <span class="squad-card-text">${m.membership.daysLeft} Days Left</span>
        <span class="squad-ms-badge ${ms.cls}">${ms.label}</span>
      </div>`;
  }

  let suppHTML = '';
  if (m.supplements && m.supplements.length && privacy.showSupplements) {
    suppHTML = m.supplements.slice(0, 2).map(s => `
      <div class="squad-card-row">
        <span class="squad-card-icon">🥤</span>
        <span class="squad-card-text">${s.name} — ${formatQty(s.remaining)} ${s.unit}</span>
      </div>`).join('');
  }

  return `
    <div class="squad-member-card">
      <div class="squad-member-card-top">
        <div class="squad-member-avatar">${initials}</div>
        <div class="squad-member-info">
          <div class="squad-member-name">${m.name}${m.isMe ? ' <span class="tag tag-red" style="font-size:0.55rem">YOU</span>' : ''}</div>
          <div class="squad-member-status">${os.dot} ${os.label}</div>
        </div>
      </div>
      <div class="squad-card-divider"></div>
      ${privacy.showWorkoutStreak && m.streak ? `
        <div class="squad-card-row">
          <span class="squad-card-icon">🔥</span>
          <span class="squad-card-text">${m.streak.current} Day Streak</span>
        </div>` : ''}
      ${privacy.showWorkoutActivity && m.totalWorkouts !== undefined ? `
        <div class="squad-card-row">
          <span class="squad-card-icon">🏋️</span>
          <span class="squad-card-text">${m.totalWorkouts} Workouts</span>
        </div>` : ''}
      ${membershipHTML}
      ${suppHTML}
      <button class="btn-secondary squad-view-profile-btn" onclick="openMemberProfile('${m.uid}')">VIEW PROFILE</button>
    </div>
  `;
}

/* ============================================
   ACTIVITY FEED
   ============================================ */

async function renderActivityFeed(squadId) {
  const activities = await squadService_getSquadActivity(squadId);
  if (!activities.length) return `
    <div class="card">
      <div class="card-label">RECENT SQUAD ACTIVITY</div>
      <div class="squad-empty-row">No activity yet. Start training!</div>
    </div>`;

  const icons = {
    workout_done:   '🔥',
    pr_achieved:    '🏆',
    streak_reached: '🔥',
    supp_low:       '🥤',
    squad_created:  '👥',
    member_joined:  '👋',
    challenge_done: '🎯'
  };

  const rows = activities.map(a => {
    const icon = icons[a.type] || '📢';
    const time = _timeAgo(a.ts?.toDate ? a.ts.toDate().toISOString() : a.ts);
    return `
      <div class="squad-activity-row">
        <div class="squad-activity-icon">${icon}</div>
        <div class="squad-activity-body">
          <div class="squad-activity-text"><strong>${a.uid || 'Someone'}</strong> ${a.text}</div>
          <div class="squad-activity-time">${time}</div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-label">RECENT SQUAD ACTIVITY</div>
      <div class="squad-activity-list">${rows}</div>
    </div>`;
}

/* ============================================
   LEADERBOARD
   ============================================ */

async function renderLeaderboardSection(squadId) {
  const medals = ['🥇', '🥈', '🥉'];
  const board  = await squadService_getLeaderboard(squadId, _lbTab);

  const rows = board.map((entry, i) => `
    <div class="squad-lb-row ${entry.isMe ? 'squad-lb-me' : ''}">
      <div class="squad-lb-rank">${medals[i] || (i + 1) + '️⃣'}</div>
      <div class="squad-lb-name">${entry.name}${entry.isMe ? ' <span class="tag tag-red" style="font-size:0.55rem">YOU</span>' : ''}</div>
      <div class="squad-lb-val">${entry.label}</div>
    </div>`).join('');

  return `
    <div class="card">
      <div class="card-label">🏆 SQUAD LEADERBOARD</div>
      <div class="squad-lb-tabs">
        ${['workouts', 'streak', 'prs'].map(t => `
          <button class="squad-lb-tab ${_lbTab === t ? 'active' : ''}" onclick="switchLbTab('${t}')">
            ${t === 'workouts' ? 'WORKOUTS' : t === 'streak' ? 'STREAK' : 'PRs'}
          </button>`).join('')}
      </div>
      <div class="squad-lb-list">${rows || '<div class="squad-empty-row">No data yet.</div>'}</div>
    </div>`;
}

/* ============================================
   SQUAD CHALLENGES
   ============================================ */

async function renderSquadChallengesSection(squadId) {
  const challenges = await squadService_getSquadChallenges(squadId);
  const members    = await squadService_getSquadMembers(squadId);

  const cards = challenges.map(c => {
    const pct  = Math.min(100, Math.round(((c.current || 0) / c.goal) * 100));
    const days = calculateMembershipDays(c.endDate);

    const memberRows = members.map(m => {
      const mVal = c.type === 'workouts' ? (m.totalWorkouts || 0)
                 : c.type === 'streak'   ? ((m.streak && m.streak.current) || 0)
                 : (c.current || 0);
      const mPct = Math.min(100, Math.round((Math.min(mVal, c.goal) / c.goal) * 100));
      return `
        <div class="squad-challenge-member-row">
          <span class="squad-challenge-member-name">${m.name}</span>
          <div class="squad-challenge-member-bar-wrap">
            <div class="squad-challenge-member-bar" style="width:${mPct}%"></div>
          </div>
          <span class="squad-challenge-member-val">${mVal} / ${c.goal}</span>
        </div>`;
    }).join('');

    return `
      <div class="squad-challenge-card">
        <div class="squad-challenge-name">${c.name}</div>
        <div class="squad-challenge-goal">Goal: ${c.goal} ${c.type === 'workouts' ? 'Workouts' : c.type === 'streak' ? 'Days' : 'kg'}</div>
        <div class="squad-challenge-progress-text">
          <span>Overall: ${c.current || 0} / ${c.goal}</span>
          <span>${pct}%</span>
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill ${pct >= 100 ? 'success' : ''}" style="width:${pct}%"></div></div>
        <div class="squad-challenge-members">${memberRows}</div>
        <div class="squad-challenge-end">Ends ${formatDateDisplay(c.endDate)} · ${days >= 0 ? days + ' days left' : 'Ended'}</div>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-label-row">
        <div class="card-label">🎯 SQUAD CHALLENGES</div>
        <button class="btn-ghost squad-btn-sm" onclick="openSquadChallengeForm('${squadId}')">+ New Challenge</button>
      </div>
      ${cards || '<div class="squad-empty-row">No squad challenges yet.</div>'}
      <div class="squad-challenge-form" id="squad-challenge-form" style="display:none">
        <div class="form-row">
          <div class="form-group"><label>Name</label><input type="text" id="sc-name" placeholder="30 Day Grind" /></div>
          <div class="form-group"><label>Type</label>
            <select id="sc-type"><option value="workouts">Workouts</option><option value="streak">Streak</option><option value="custom">Custom</option></select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Goal</label><input type="number" id="sc-goal" placeholder="20" min="1" /></div>
          <div class="form-group"><label>End Date</label><input type="date" id="sc-end" /></div>
        </div>
        <div class="form-actions">
          <button class="btn-ghost" onclick="closeSquadChallengeForm()">Cancel</button>
          <button class="btn-primary" onclick="saveSquadChallenge('${squadId}')">Create</button>
        </div>
      </div>
    </div>`;
}

/* ============================================
   SQUAD EXPENSES
   ============================================ */

function renderSquadExpenses() {
  const expenses = getData('expenses').filter(e => e.splits && e.splits.length > 1);
  if (!expenses.length) return '';

  const rows = expenses.slice(0, 5).map(e => {
    const perHead = e.splits.length ? (e.amount / e.splits.length).toFixed(0) : e.amount;
    return `
      <div class="squad-expense-row">
        <div class="squad-expense-left">
          <div class="squad-expense-desc">${e.description}</div>
          <div class="squad-expense-meta">${e.splits.length} Members · ₹${perHead} each</div>
        </div>
        <div class="squad-expense-amount">₹${e.amount.toLocaleString('en-IN')}</div>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-label">💰 GROUP EXPENSES</div>
      ${rows}
    </div>`;
}

/* ============================================
   SQUAD NOTIFICATIONS
   ============================================ */

async function renderSquadNotifications(squadId) {
  const notifs = await squadService_getSquadNotifications(squadId);

  const rows = notifs.map(n => {
    const icons = { info: '📢', warning: '⚠️', success: '🏆', membership: '💳' };
    const time  = _timeAgo(n.ts?.toDate ? n.ts.toDate().toISOString() : n.ts);
    return `
      <div class="squad-notif-row">
        <div class="squad-notif-icon">${icons[n.type] || '📢'}</div>
        <div class="squad-notif-body">
          <div class="squad-notif-text"><strong>${n.from || 'Squad'}</strong>: ${n.text}</div>
          <div class="squad-notif-time">${time}</div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-label-row">
        <div class="card-label">🔔 SQUAD NOTIFICATIONS</div>
        <button class="btn-ghost squad-btn-sm" onclick="openPostNotifModal()">+ Post</button>
      </div>
      ${rows || '<div class="squad-empty-row">No notifications yet.</div>'}
      <div id="squad-notif-form" style="display:none;margin-top:1rem">
        <div class="form-group">
          <label>Message</label>
          <textarea id="squad-notif-text" rows="2" placeholder="e.g. Tomorrow's workout starts at 6 AM."></textarea>
        </div>
        <div class="form-actions">
          <button class="btn-ghost" onclick="closePostNotifModal()">Cancel</button>
          <button class="btn-primary" onclick="postSquadNotif('${squadId}')">Post</button>
        </div>
      </div>
    </div>`;
}

/* ============================================
   MODALS — HTML Templates
   ============================================ */

function renderCreateSquadModal() {
  return `
    <div class="squad-modal-overlay" id="modal-create-squad" style="display:none">
      <div class="squad-modal">
        <div class="squad-modal-header">
          <div class="squad-modal-title">CREATE SQUAD</div>
          <button class="squad-modal-close" onclick="closeCreateSquadModal()">&times;</button>
        </div>
        <div class="form-group">
          <label>Squad Name</label>
          <input type="text" id="create-squad-name" placeholder="e.g. THE GYM RATS" maxlength="30" />
        </div>
        <div class="squad-modal-error" id="create-squad-error"></div>
        <div class="form-actions">
          <button class="btn-ghost" onclick="closeCreateSquadModal()">Cancel</button>
          <button class="btn-primary" onclick="handleCreateSquad()">CREATE SQUAD</button>
        </div>
      </div>
    </div>`;
}

function renderJoinSquadModal() {
  return `
    <div class="squad-modal-overlay" id="modal-join-squad" style="display:none">
      <div class="squad-modal">
        <div class="squad-modal-header">
          <div class="squad-modal-title">JOIN SQUAD</div>
          <button class="squad-modal-close" onclick="closeJoinSquadModal()">&times;</button>
        </div>
        <div class="form-group">
          <label>Enter Squad Code</label>
          <input type="text" id="join-squad-code" placeholder="e.g. GR8X92" maxlength="6"
            style="text-transform:uppercase;letter-spacing:0.2em;font-size:1.2rem;text-align:center;font-weight:800" />
        </div>
        <div class="squad-modal-error" id="join-squad-error"></div>
        <div class="form-actions">
          <button class="btn-ghost" onclick="closeJoinSquadModal()">Cancel</button>
          <button class="btn-primary" onclick="handleJoinSquad()">JOIN SQUAD</button>
        </div>
      </div>
    </div>`;
}

function renderInviteModal(code) {
  const shareText = `Join my Gym Squad on THE GYM RATS! Use code: ${code}`;
  return `
    <div class="squad-modal-overlay" id="modal-invite" style="display:none">
      <div class="squad-modal">
        <div class="squad-modal-header">
          <div class="squad-modal-title">INVITE FRIEND</div>
          <button class="squad-modal-close" onclick="closeInviteModal()">&times;</button>
        </div>
        <div class="squad-invite-code-display">
          <div class="squad-invite-label">SQUAD CODE</div>
          <div class="squad-invite-code">${code}</div>
        </div>
        <div class="form-actions" style="flex-direction:column;gap:0.6rem">
          <button class="btn-primary" style="width:100%" onclick="copySquadCode('${code}')">📋 Copy Invite Code</button>
          <button class="btn-secondary" style="width:100%" onclick="shareInvite('${shareText}')">📤 Share Invite</button>
        </div>
        <div class="squad-invite-note">Share the code with your friends to invite them.</div>
      </div>
    </div>`;
}

function renderMemberProfileModal() {
  return `
    <div class="squad-modal-overlay" id="modal-member-profile" style="display:none">
      <div class="squad-modal squad-modal-wide">
        <div class="squad-modal-header">
          <div class="squad-modal-title" id="profile-modal-title">MEMBER PROFILE</div>
          <button class="squad-modal-close" onclick="closeMemberProfile()">&times;</button>
        </div>
        <div id="profile-modal-body"></div>
      </div>
    </div>`;
}

/* ============================================
   MEMBER PROFILE — Full Detail View
   ============================================ */

async function openMemberProfile(uid) {
  const squads = await squadService_getMySquads();
  if (!squads.length) return;
  const members = await squadService_getSquadMembers(squads[0].id);
  const m       = members.find(x => x.uid === uid);
  if (!m) return;

  const privacy  = m.privacy;
  const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const os       = m.onlineStatus;

  let html = `
    <div class="profile-modal-hero">
      <div class="profile-modal-avatar">${initials}</div>
      <div class="profile-modal-name">${m.name}</div>
      <div class="profile-modal-status">${os.dot} ${os.label}</div>
    </div>
    <div class="profile-modal-stats">`;

  if (privacy.showWorkoutStreak && m.streak) {
    html += `<div class="profile-modal-stat"><div class="profile-modal-stat-val">🔥 ${m.streak.current}</div><div class="profile-modal-stat-key">Day Streak</div></div>`;
  }
  if (privacy.showWorkoutActivity && m.totalWorkouts !== undefined) {
    html += `<div class="profile-modal-stat"><div class="profile-modal-stat-val">🏋️ ${m.totalWorkouts}</div><div class="profile-modal-stat-key">Workouts</div></div>`;
  }
  if (privacy.showPRs && m.prCount !== undefined) {
    html += `<div class="profile-modal-stat"><div class="profile-modal-stat-val">🏆 ${m.prCount}</div><div class="profile-modal-stat-key">PRs</div></div>`;
  }
  html += `</div>`;

  if (privacy.showWorkoutActivity && m.recentWorkouts && m.recentWorkouts.length) {
    html += `<div class="profile-modal-section"><div class="card-label">RECENT ACTIVITY</div>`;
    html += m.recentWorkouts.slice(0, 4).map(w => `
      <div class="profile-modal-activity-row">
        <span class="profile-modal-activity-icon">🔥</span>
        <span>${w.name || w.muscle || 'Workout'}</span>
        <span class="profile-modal-activity-date">${formatDateDisplay(w.date)}</span>
      </div>`).join('');
    html += `</div>`;
  }

  if (privacy.showMembership && m.membership) {
    const ms = getMembershipStatusLabel(m.membership.daysLeft);
    html += `
      <div class="profile-modal-section">
        <div class="card-label">MEMBERSHIP</div>
        <div class="profile-modal-info-row">
          <span>💳 ${m.membership.gymName}</span>
          <span class="squad-ms-badge ${ms.cls}">${m.membership.daysLeft} DAYS LEFT</span>
        </div>
      </div>`;
  }

  if (privacy.showSupplements && m.supplements && m.supplements.length) {
    html += `<div class="profile-modal-section"><div class="card-label">SUPPLEMENTS</div>`;
    html += m.supplements.map(s => `
      <div class="profile-modal-info-row">
        <span>🥤 ${s.name}</span>
        <span>${formatQty(s.remaining)} ${s.unit} · ~${s.servings} servings</span>
      </div>`).join('');
    html += `</div>`;
  }

  if (privacy.showProgress && m.latestProgress) {
    const lp = m.latestProgress;
    html += `
      <div class="profile-modal-section">
        <div class="card-label">LATEST PROGRESS</div>
        <div class="profile-modal-info-row">
          ${lp.weight ? `<span>⚖️ ${lp.weight} kg</span>` : ''}
          ${lp.fat    ? `<span>🔥 ${lp.fat}% fat</span>`  : ''}
        </div>
      </div>`;
  }

  document.getElementById('profile-modal-title').textContent = m.name.toUpperCase();
  document.getElementById('profile-modal-body').innerHTML    = html;
  document.getElementById('modal-member-profile').style.display = 'flex';
}

function closeMemberProfile() {
  document.getElementById('modal-member-profile').style.display = 'none';
}

/* ============================================
   EVENT HANDLERS & ACTIONS
   ============================================ */

function bindSquadEvents() {
  const joinInput = document.getElementById('join-squad-code');
  if (joinInput) {
    joinInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleJoinSquad(); });
    joinInput.addEventListener('input', function() { this.value = this.value.toUpperCase(); });
  }
}

function openCreateSquadModal() {
  const el = document.getElementById('modal-create-squad');
  if (el) { el.style.display = 'flex'; setTimeout(() => document.getElementById('create-squad-name')?.focus(), 100); }
}
function closeCreateSquadModal() {
  const el = document.getElementById('modal-create-squad');
  if (el) el.style.display = 'none';
}

function openJoinSquadModal() {
  const el = document.getElementById('modal-join-squad');
  if (el) { el.style.display = 'flex'; setTimeout(() => document.getElementById('join-squad-code')?.focus(), 100); }
}
function closeJoinSquadModal() {
  const el = document.getElementById('modal-join-squad');
  if (el) el.style.display = 'none';
}

function openInviteModal() {
  const el = document.getElementById('modal-invite');
  if (el) el.style.display = 'flex';
}
function closeInviteModal() {
  const el = document.getElementById('modal-invite');
  if (el) el.style.display = 'none';
}

async function handleCreateSquad() {
  const name = document.getElementById('create-squad-name')?.value.trim();
  const err  = document.getElementById('create-squad-error');
  if (!name) { if (err) err.textContent = 'Please enter a squad name.'; return; }
  const btn = document.querySelector('#modal-create-squad .btn-primary');
  if (btn) { btn.textContent = 'Creating...'; btn.disabled = true; }
  try {
    const squad = await squadService_createSquad(name);
    closeCreateSquadModal();
    _activeSquadId = squad.id;
    showToast(`Squad "${squad.name}" created! Code: ${squad.code}`, 'success');
    renderSquad();
  } catch (e) {
    if (err) err.textContent = 'Failed to create squad. Please try again.';
    console.error('handleCreateSquad:', e);
  } finally {
    if (btn) { btn.textContent = 'CREATE SQUAD'; btn.disabled = false; }
  }
}

async function handleJoinSquad() {
  const code = document.getElementById('join-squad-code')?.value.trim();
  const err  = document.getElementById('join-squad-error');
  if (!code || code.length < 4) { if (err) err.textContent = 'Enter a valid squad code.'; return; }
  const result = await squadService_joinSquad(code);
  if (!result.ok) { if (err) err.textContent = result.msg; return; }
  closeJoinSquadModal();
  _activeSquadId = result.squad.id;
  showToast(`Welcome to ${result.squad.name}!`, 'success');
  renderSquad();
}

/* ============================================
   SWITCH / LEAVE / COPY / SHARE
   ============================================ */

function switchSquad(squadId) {
  _activeSquadId = squadId;
  renderSquad();
}

async function switchLbTab(tab) {
  _lbTab = tab;
  renderSquad();
}

function copySquadCode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => showToast('Code copied: ' + code, 'success'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = code;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Code copied: ' + code, 'success');
  }
}

function shareInvite(text) {
  if (navigator.share) {
    navigator.share({ title: 'THE GYM RATS', text }).catch(() => {});
  } else {
    copySquadCode(text);
  }
}

async function confirmLeaveSquad(squadId) {
  showModal('Leave Squad', 'Are you sure you want to leave this squad?', 'Leave', async () => {
    await squadService_leaveSquad(squadId);
    _activeSquadId = null;
    showToast('You left the squad.', 'success');
    renderSquad();
  });
}

/* ============================================
   TRAINING STATUS TOGGLE
   ============================================ */

async function toggleTrainingStatus() {
  const squads = await squadService_getMySquads();
  const squadId = _activeSquadId || (squads[0] && squads[0].id);

  const uid        = getSession();
  const statusSnap = await db.collection('status').doc(uid).get();
  const statusData = statusSnap.exists ? statusSnap.data() : null;
  const isTraining = statusData && statusData.status === 'training';

  if (isTraining) {
    await squadService_updateStatus('online', null);
    if (squadId) await squadService_logActivity(squadId, 'workout_done', 'ended a training session');
    showToast('Training ended.', 'success');
  } else {
    const workouts  = getData('workouts').sort((a, b) => new Date(b.date) - new Date(a.date));
    const wName     = workouts[0] ? workouts[0].name : 'Workout';
    await squadService_updateStatus('training', wName);
    if (squadId) await squadService_logActivity(squadId, 'workout_done', `is training — ${wName}`);
    showToast("You're now Training! 🔥", 'success');
  }
  renderSquad();
}

/* ============================================
   SQUAD CHALLENGES FORM
   ============================================ */

function openSquadChallengeForm() {
  const el = document.getElementById('squad-challenge-form');
  if (el) { el.style.display = 'block'; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
function closeSquadChallengeForm() {
  const el = document.getElementById('squad-challenge-form');
  if (el) el.style.display = 'none';
}

async function saveSquadChallenge(squadId) {
  const name = document.getElementById('sc-name')?.value.trim();
  const type = document.getElementById('sc-type')?.value;
  const goal = parseFloat(document.getElementById('sc-goal')?.value);
  const end  = document.getElementById('sc-end')?.value;
  if (!name || !goal || !end) { showToast('Fill in all fields.', 'error'); return; }
  await squadService_createSquadChallenge(squadId, { name, type, goal, endDate: end });
  await squadService_logActivity(squadId, 'challenge_done', `created a new challenge: "${name}"`);
  showToast('Squad challenge created!', 'success');
  renderSquad();
}

/* ============================================
   SQUAD NOTIFICATIONS FORM
   ============================================ */

function openPostNotifModal() {
  const el = document.getElementById('squad-notif-form');
  if (el) { el.style.display = 'block'; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
function closePostNotifModal() {
  const el = document.getElementById('squad-notif-form');
  if (el) el.style.display = 'none';
}

async function postSquadNotif(squadId) {
  const text = document.getElementById('squad-notif-text')?.value.trim();
  if (!text) { showToast('Enter a message.', 'error'); return; }
  await squadService_postNotification(squadId, text, 'info');
  document.getElementById('squad-notif-text').value = '';
  closePostNotifModal();
  showToast('Notification posted!', 'success');
  renderSquad();
}

/* ============================================
   PRIVACY SETTINGS RENDERER
   ============================================ */

function renderPrivacySettings() {
  const p  = squadService_getPrivacy();
  const el = document.getElementById('squad-privacy-settings');
  if (!el) return;

  const options = [
    { key: 'showWorkoutActivity', label: 'Show workout activity' },
    { key: 'showWorkoutStreak',   label: 'Show workout streak' },
    { key: 'showCurrentWorkout',  label: 'Show current workout' },
    { key: 'showMembership',      label: 'Show membership status' },
    { key: 'showSupplements',     label: 'Show supplement status' },
    { key: 'showProgress',        label: 'Show progress' },
    { key: 'showPRs',             label: 'Show personal records' },
    { key: 'showOnlineStatus',    label: 'Show online/training status' }
  ];

  el.innerHTML = `
    <div class="card-label">SQUAD VISIBILITY</div>
    <div class="privacy-options-list">
      ${options.map(o => `
        <label class="privacy-toggle-row">
          <div class="privacy-toggle-label">${o.label}</div>
          <div class="privacy-toggle-switch ${p[o.key] ? 'on' : 'off'}" onclick="togglePrivacy('${o.key}', this)">
            <div class="privacy-toggle-knob"></div>
          </div>
        </label>`).join('')}
    </div>
    <button class="btn-primary" style="margin-top:1rem;width:100%" onclick="savePrivacySettings()">Save Privacy Settings</button>
  `;
}

function togglePrivacy(key, el) {
  el.classList.toggle('on');
  el.classList.toggle('off');
}

function savePrivacySettings() {
  const p    = squadService_getPrivacy();
  const keys = ['showWorkoutActivity','showWorkoutStreak','showCurrentWorkout','showMembership',
                 'showSupplements','showProgress','showPRs','showOnlineStatus'];
  keys.forEach(k => {
    const el = document.querySelector(`.privacy-toggle-switch[onclick*="${k}"]`);
    if (el) p[k] = el.classList.contains('on');
  });
  squadService_savePrivacy(p);
  showToast('Privacy settings saved!', 'success');
}

/* ============================================
   DASHBOARD SQUAD WIDGET
   ============================================ */

async function renderSquadDashWidget() {
  const el = document.getElementById('dash-squad-widget');
  if (!el) return;

  const squads = await squadService_getMySquads();
  if (!squads.length) {
    el.innerHTML = `
      <div class="card-label">GYM SQUAD</div>
      <div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.75rem">You haven't joined a squad yet.</div>
      <button class="btn-secondary" style="width:100%" onclick="navigateTo('squad')">JOIN A SQUAD →</button>`;
    return;
  }

  const squad      = squads[0];
  const members    = await squadService_getSquadMembers(squad.id);
  const training   = members.filter(m => m.onlineStatus.status === 'training');
  const challenges = await squadService_getSquadChallenges(squad.id);
  const top        = challenges[0];

  el.innerHTML = `
    <div class="card-label">GYM SQUAD</div>
    <div class="dash-squad-name">${squad.name}</div>
    ${training.length ? `<div class="dash-squad-training">🟢 ${training.length} Friend${training.length > 1 ? 's' : ''} Training</div>` : ''}
    <div class="dash-squad-members">
      ${members.slice(0, 4).map(m => `<span class="dash-squad-member-chip">${m.name.split(' ')[0]}</span>`).join('')}
      ${members.length > 4 ? `<span class="dash-squad-member-chip">+${members.length - 4}</span>` : ''}
    </div>
    ${top ? `
      <div class="dash-squad-challenge">
        🔥 ${top.name}
        <span>${top.current || 0} / ${top.goal}</span>
      </div>` : ''}
    <button class="btn-secondary" style="width:100%;margin-top:0.75rem" onclick="navigateTo('squad')">VIEW SQUAD →</button>`;
}

/* ============================================
   UTILITY
   ============================================ */

function _timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const min  = Math.floor(diff / 60000);
  const hr   = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (hr  < 24) return `${hr}h ago`;
  return `${day}d ago`;
}

function formatQty(val) {
  if (val === undefined || val === null) return '0';
  return Number(val).toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

/* getCurrentUid() is defined in firestore.js — do not redefine here */
