/* ============================================
   THE GYM RATS — challenges.js
   Group Challenges & Notifications
   ============================================ */

pageRenderers['challenges']    = renderChallenges;
pageRenderers['notifications'] = renderNotifications;

/* ============================================
   CHALLENGES
   ============================================ */

document.getElementById('btn-new-challenge').addEventListener('click', () => {
  document.getElementById('challenge-form-card').style.display = 'block';
  document.getElementById('challenge-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('btn-cancel-challenge').addEventListener('click', () => {
  document.getElementById('challenge-form-card').style.display = 'none';
  document.getElementById('challenge-form').reset();
});

document.getElementById('challenge-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const record = {
    name:    document.getElementById('cf-name').value.trim(),
    type:    document.getElementById('cf-type').value,
    goal:    parseFloat(document.getElementById('cf-goal').value),
    endDate: document.getElementById('cf-end').value,
    desc:    document.getElementById('cf-desc').value.trim(),
    current: 0
  };
  addRecord('challenges', record);
  this.reset();
  document.getElementById('challenge-form-card').style.display = 'none';
  showToast('Challenge created!', 'success');
  renderChallenges();
});

function renderChallenges() {
  const challenges = getData('challenges');
  const grid = document.getElementById('challenges-grid');
  if (!challenges.length) {
    grid.innerHTML = `<div class="card">${emptyState('🏆', 'No challenges yet. Create one!')}</div>`;
    return;
  }

  grid.innerHTML = `<div class="challenges-grid">${challenges.map(c => {
    const current  = getChallengeProgress(c);
    const pct      = Math.min(100, Math.round((current / c.goal) * 100));
    const daysLeft = calculateMembershipDays(c.endDate);
    const done     = pct >= 100;
    const expired  = daysLeft < 0 && !done;

    return `
      <div class="challenge-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem">
          <div class="challenge-name">${done ? '✅ ' : ''}${c.name}</div>
          <span class="tag ${done ? 'tag-green' : expired ? 'tag-red' : ''}">${done ? 'DONE' : expired ? 'ENDED' : 'ACTIVE'}</span>
        </div>
        ${c.desc ? `<div class="challenge-desc">${c.desc}</div>` : ''}
        <div class="challenge-progress-text">
          <span>${getChallengeLabel(c.type)}: ${current} / ${c.goal}</span>
          <span>${pct}%</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill ${done ? 'success' : expired ? 'danger' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="challenge-end">Ends ${formatDateDisplay(c.endDate)} · ${daysLeft >= 0 ? daysLeft + ' days left' : 'Ended'}</div>
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;align-items:center">
          <input type="number" id="ch-prog-${c.id}" placeholder="Update progress" min="0" max="${c.goal}"
            style="flex:1;font-size:0.82rem;padding:0.45rem 0.65rem" value="${current}" />
          <button class="btn-secondary" style="padding:0.45rem 0.75rem;font-size:0.78rem"
            onclick="updateChallengeProgress('${c.id}')">Update</button>
          <button class="btn-icon" onclick="deleteChallenge('${c.id}')">🗑</button>
        </div>
      </div>`;
  }).join('')}</div>`;
}

function getChallengeProgress(c) {
  if (c.type === 'workouts') {
    const workouts = getData('workouts');
    const start = c.createdAt ? c.createdAt.split('T')[0] : '2000-01-01';
    return workouts.filter(w => w.date >= start && w.date <= c.endDate).length;
  }
  if (c.type === 'streak') return calculateWorkoutStreak().current;
  return c.current || 0;
}

function getChallengeLabel(type) {
  const map = { workouts: 'Workouts', streak: 'Streak Days', weight: 'kg', custom: 'Progress' };
  return map[type] || 'Progress';
}

function updateChallengeProgress(id) {
  const val = parseFloat(document.getElementById(`ch-prog-${id}`)?.value);
  if (isNaN(val)) return;
  updateRecord('challenges', id, { current: val });
  showToast('Progress updated!', 'success');
  renderChallenges();
}

function deleteChallenge(id) {
  confirmDelete('Challenge', () => {
    deleteRecord('challenges', id);
    showToast('Challenge deleted.', 'success');
    renderChallenges();
  });
}

/* ============================================
   NOTIFICATIONS PAGE
   ============================================ */

function renderNotifications() {
  const notifs = generateNotifications();
  const el = document.getElementById('notifications-list');
  if (!notifs.length) {
    el.innerHTML = `<div class="card">${emptyState('🔔', 'No notifications right now. All clear!')}</div>`;
    return;
  }
  el.innerHTML = `<div class="card">${notifs.map(n => `
    <div class="notif-item">
      <div class="notif-icon notif-type-${n.type}">${n.icon}</div>
      <div class="notif-text">${n.text}</div>
    </div>`).join('')}</div>`;
}

document.getElementById('btn-clear-notifs').addEventListener('click', () => {
  document.getElementById('notifications-list').innerHTML =
    `<div class="card">${emptyState('🔔', 'No notifications.')}</div>`;
});
