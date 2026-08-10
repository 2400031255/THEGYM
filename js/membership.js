/* ============================================
   THE GYM RATS — membership.js
   Gym Membership Tracker
   ============================================ */

pageRenderers['membership'] = renderMembership;

document.getElementById('btn-new-membership').addEventListener('click', () => {
  document.getElementById('membership-form-card').style.display = 'block';
  setTodayDate('mf-start');
  document.getElementById('mf-start').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.getElementById('btn-cancel-membership').addEventListener('click', () => {
  document.getElementById('membership-form-card').style.display = 'none';
  document.getElementById('membership-form').reset();
});

document.getElementById('membership-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const start = document.getElementById('mf-start').value;
  const end   = document.getElementById('mf-end').value;
  if (new Date(end) <= new Date(start)) {
    showToast('End date must be after start date.', 'error');
    return;
  }
  const record = {
    gymName:       document.getElementById('mf-gym').value.trim(),
    type:          document.getElementById('mf-type').value,
    fee:           parseFloat(document.getElementById('mf-fee').value),
    startDate:     start,
    endDate:       end,
    paymentMethod: document.getElementById('mf-payment').value,
    notes:         document.getElementById('mf-notes').value.trim(),
    paidAt:        new Date().toISOString()
  };
  addRecord('membership', record);
  this.reset();
  document.getElementById('membership-form-card').style.display = 'none';
  showToast('Membership saved!', 'success');
  renderMembership();
  updateNotifBadge();
});

function renderMembership() {
  const memberships = getData('membership').sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  const display = document.getElementById('membership-display');
  const history = document.getElementById('membership-history');

  if (!memberships.length) {
    display.innerHTML = `<div class="card">${emptyState('', 'No membership added yet.')}</div>`;
    history.innerHTML = emptyState('', 'No history yet.');
    return;
  }

  // Active = latest membership
  const active = memberships[0];
  const days = calculateMembershipDays(active.endDate);
  const progress = calculateMembershipProgress(active.startDate, active.endDate);

  let daysClass = 'good', daysText = '', statusBadge = '';
  if (days < 0) {
    daysClass = 'expired';
    daysText = 'MEMBERSHIP EXPIRED';
    statusBadge = '<span class="tag tag-red">EXPIRED</span>';
  } else if (days === 0) {
    daysClass = 'warning';
    daysText = 'EXPIRES TODAY';
    statusBadge = '<span class="tag tag-orange">EXPIRES TODAY</span>';
  } else if (days <= 7) {
    daysClass = 'warning';
    daysText = `${days} DAYS LEFT`;
    statusBadge = '<span class="tag tag-orange">EXPIRING SOON</span>';
  } else {
    daysClass = 'good';
    daysText = `${days} DAYS LEFT`;
    statusBadge = '<span class="tag tag-green">ACTIVE</span>';
  }

  const barClass = days < 0 ? 'danger' : days <= 7 ? 'warning' : 'success';
  const barWidth = days < 0 ? 100 : (100 - progress);

  display.innerHTML = `
    <div class="card">
      <div class="membership-card">
        <div class="membership-gym-name">${active.gymName}</div>
        <div style="margin-bottom:0.5rem">${statusBadge} <span class="tag">${active.type}</span></div>
        <div class="membership-fee">${formatINR(active.fee)} PAID ✓</div>
        <div class="membership-dates">
          <span>${formatDateDisplay(active.startDate)}</span>
          <span class="arrow">→</span>
          <span>${formatDateDisplay(active.endDate)}</span>
        </div>
        <div class="membership-days ${daysClass}">${daysText}</div>
        <div class="membership-days-label">${days >= 0 ? 'Remaining' : ''}</div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill ${barClass}" style="width:${barWidth}%"></div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem">${progress}% elapsed</div>
        ${active.notes ? `<div style="margin-top:0.75rem;font-size:0.8rem;color:var(--text-muted)">${active.notes}</div>` : ''}
        <div style="margin-top:1rem;display:flex;gap:0.5rem;justify-content:center">
          <button class="btn-secondary" onclick="editMembership('${active.id}')">Edit</button>
          <button class="btn-ghost" onclick="deleteMembership('${active.id}')">Delete</button>
        </div>
      </div>
    </div>`;

  // History (all except active)
  const past = memberships.slice(1);
  if (!past.length) {
    history.innerHTML = emptyState('', 'No previous memberships.');
    return;
  }
  history.innerHTML = past.map(m => {
    const d = calculateMembershipDays(m.endDate);
    return `
      <div class="expense-item">
        <div class="expense-item-left">
          <div class="expense-item-desc">${m.gymName} — ${m.type}</div>
          <div class="expense-item-meta">${formatDateDisplay(m.startDate)} → ${formatDateDisplay(m.endDate)}</div>
        </div>
        <div>
          <div class="expense-item-amount">${formatINR(m.fee)}</div>
          <div style="text-align:right;margin-top:4px"><span class="tag ${d < 0 ? 'tag-red' : 'tag-green'}">${d < 0 ? 'EXPIRED' : 'ACTIVE'}</span></div>
        </div>
        <button class="btn-icon" onclick="deleteMembership('${m.id}')">Delete</button>
      </div>`;
  }).join('');
}

function deleteMembership(id) {
  confirmDelete('Membership', () => {
    deleteRecord('membership', id);
    showToast('Membership deleted.', 'success');
    renderMembership();
    updateNotifBadge();
    renderDashboard();
  });
}

function editMembership(id) {
  const m = getData('membership').find(x => x.id === id);
  if (!m) return;
  document.getElementById('mf-gym').value     = m.gymName;
  document.getElementById('mf-type').value    = m.type;
  document.getElementById('mf-fee').value     = m.fee;
  document.getElementById('mf-start').value   = m.startDate;
  document.getElementById('mf-end').value     = m.endDate;
  document.getElementById('mf-payment').value = m.paymentMethod;
  document.getElementById('mf-notes').value   = m.notes || '';
  deleteRecord('membership', id);
  document.getElementById('membership-form-card').style.display = 'block';
  document.getElementById('membership-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Auto-refresh countdown every minute
setInterval(() => {
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-membership') renderMembership();
  renderDashboard();
  updateNotifBadge();
}, 60000);
