/* ============================================
   THE GYM RATS — supplements.js
   Supplement Inventory & Tracking
   ============================================ */

pageRenderers['supplements'] = renderSupplements;

document.getElementById('btn-new-supplement').addEventListener('click', () => {
  document.getElementById('supplement-form-card').style.display = 'block';
  setTodayDate('sf-date');
  document.getElementById('supplement-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('btn-cancel-supplement').addEventListener('click', () => {
  document.getElementById('supplement-form-card').style.display = 'none';
  document.getElementById('supplement-form').reset();
});

document.getElementById('supplement-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const qty     = parseFloat(document.getElementById('sf-qty').value);
  const serving = parseFloat(document.getElementById('sf-serving').value);
  const spd     = parseFloat(document.getElementById('sf-spd').value);
  if (serving <= 0 || spd <= 0) { showToast('Serving size and servings/day must be > 0', 'error'); return; }
  const record = {
    name:          document.getElementById('sf-name').value.trim(),
    brand:         document.getElementById('sf-brand').value.trim(),
    initialQty:    qty,
    unit:          document.getElementById('sf-unit').value,
    servingSize:   serving,
    servingsPerDay: spd,
    purchaseDate:  document.getElementById('sf-date').value,
    price:         parseFloat(document.getElementById('sf-price').value) || 0,
    notes:         document.getElementById('sf-notes').value.trim()
  };
  addRecord('supplements', record);
  this.reset();
  document.getElementById('supplement-form-card').style.display = 'none';
  showToast(`${record.name} added!`, 'success');
  renderSupplements();
  updateNotifBadge();
});

function renderSupplements() {
  const supplements = getData('supplements');
  const grid = document.getElementById('supplements-grid');
  if (!supplements.length) {
    grid.innerHTML = `<div class="card">${emptyState('', 'No supplements added yet. Click "+ Add Supplement" to start.')}</div>`;
    return;
  }
  grid.innerHTML = `<div class="supplements-grid">${supplements.map(s => buildSuppCard(s)).join('')}</div>`;
}

function buildSuppCard(supp) {
  const remaining  = calculateSupplementRemaining(supp.id);
  const servings   = calculateEstimatedServings(supp.id);
  const days       = calculateEstimatedDays(supp.id);
  const status     = getSupplementStatus(remaining, supp.servingSize);
  const takenToday = hasTakenTodayScoop(supp.id);
  const canScoop   = remaining >= supp.servingSize;

  const usages = getData('suppUsage').filter(u => u.suppId === supp.id).slice(-5).reverse();

  const scoopDisabled = takenToday || !canScoop;
  const scoopLabel    = !canScoop
    ? 'Not enough for a full serving'
    : takenToday
    ? 'TAKEN TODAY'
    : `TAKE TODAY'S ${supp.name.toUpperCase()} SCOOP`;

  return `
    <div class="supplement-card" id="supp-card-${supp.id}">
      <div class="supp-header">
        <div>
          <div class="supp-name">${supp.name}</div>
          ${supp.brand ? `<div class="supp-brand">${supp.brand}</div>` : ''}
        </div>
        <span class="supp-status ${status.cls}">${status.icon} ${status.label}</span>
      </div>

      <div class="supp-qty-display">
        <span class="supp-qty-number">${formatQty(remaining)}</span>
        <span class="supp-qty-unit">${supp.unit}</span>
        <div class="supp-qty-label">REMAINING</div>
      </div>

      <div class="progress-bar-wrap">
        <div class="progress-bar-fill ${getBarClass(remaining, supp.initialQty)}"
             style="width:${Math.max(0, (remaining / supp.initialQty) * 100).toFixed(1)}%"></div>
      </div>

      <div class="supp-meta">
        <div class="supp-meta-item">
          <div class="supp-meta-val">${servings}</div>
          <div class="supp-meta-key">Servings Left</div>
        </div>
        <div class="supp-meta-item">
          <div class="supp-meta-val">${days}</div>
          <div class="supp-meta-key">Days Left</div>
        </div>
        <div class="supp-meta-item">
          <div class="supp-meta-val">${supp.servingSize}${supp.unit}</div>
          <div class="supp-meta-key">Per Serving</div>
        </div>
        <div class="supp-meta-item">
          <div class="supp-meta-val">${supp.servingsPerDay}x</div>
          <div class="supp-meta-key">Per Day</div>
        </div>
      </div>

      <button class="btn-scoop" ${scoopDisabled ? 'disabled' : ''}
        onclick="takeScoop('${supp.id}', false)">${scoopLabel}</button>

      ${takenToday && canScoop ? `
        <button class="btn-extra-scoop" onclick="takeScoop('${supp.id}', true)">
          + ADD EXTRA SERVING
        </button>` : ''}

      ${usages.length ? `
        <div class="card-label" style="margin-top:1rem">RECENT USAGE</div>
        <div class="usage-log">
          ${usages.map(u => `
            <div class="usage-log-item">
              <span class="usage-log-date">${formatDateTime(u.createdAt)}${u.extra ? ' <span class="tag tag-orange">extra</span>' : ''}</span>
              <span class="usage-log-qty">-${u.qty}${supp.unit}</span>
              <span class="usage-log-rem">${formatQty(u.remaining)}${supp.unit}</span>
            </div>`).join('')}
        </div>` : ''}

      <div class="supp-card-actions" style="margin-top:0.75rem">
        <button class="btn-icon" onclick="editSupplement('${supp.id}')">Edit</button>
        <button class="btn-icon" onclick="deleteSupplement('${supp.id}')">Delete</button>
        ${supp.price ? `<span style="margin-left:auto;font-size:0.78rem;color:var(--text-muted)">${formatINR(supp.price)}</span>` : ''}
      </div>
    </div>`;
}

function takeScoop(suppId, isExtra) {
  const supp      = getData('supplements').find(s => s.id === suppId);
  if (!supp) return;
  const remaining = calculateSupplementRemaining(suppId);
  if (remaining < supp.servingSize) {
    showToast('Not enough quantity for a full serving.', 'error');
    return;
  }
  const newRemaining = Math.max(0, remaining - supp.servingSize);
  const usage = {
    suppId,
    date:      formatDateISO(new Date()),
    qty:       supp.servingSize,
    remaining: newRemaining,
    extra:     isExtra
  };
  addRecord('suppUsage', usage);
  showToast(`${supp.name}: ${formatQty(remaining)}${supp.unit} → ${formatQty(newRemaining)}${supp.unit}`, 'success');
  renderSupplements();
  updateNotifBadge();
}

function deleteSupplement(id) {
  const supp = getData('supplements').find(s => s.id === id);
  confirmDelete(supp ? supp.name : 'Supplement', () => {
    deleteRecord('supplements', id);
    // also remove usage records
    const data = loadData();
    data.suppUsage = data.suppUsage.filter(u => u.suppId !== id);
    saveData(data);
    showToast('Supplement deleted.', 'success');
    renderSupplements();
    updateNotifBadge();
  });
}

function editSupplement(id) {
  const s = getData('supplements').find(x => x.id === id);
  if (!s) return;
  document.getElementById('sf-name').value    = s.name;
  document.getElementById('sf-brand').value   = s.brand || '';
  document.getElementById('sf-qty').value     = s.initialQty;
  document.getElementById('sf-unit').value    = s.unit;
  document.getElementById('sf-serving').value = s.servingSize;
  document.getElementById('sf-spd').value     = s.servingsPerDay;
  document.getElementById('sf-date').value    = s.purchaseDate || '';
  document.getElementById('sf-price').value   = s.price || '';
  document.getElementById('sf-notes').value   = s.notes || '';
  deleteRecord('supplements', id);
  document.getElementById('supplement-form-card').style.display = 'block';
  document.getElementById('supplement-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getBarClass(remaining, initial) {
  const pct = remaining / initial;
  if (pct > 0.5) return 'success';
  if (pct > 0.2) return 'warning';
  return 'danger';
}

function formatQty(n) {
  return Number.isInteger(n) ? n : parseFloat(n.toFixed(1));
}

// Quick scoop from dashboard
document.getElementById('qa-scoop').addEventListener('click', () => {
  const supps = getData('supplements');
  if (!supps.length) { showToast('No supplements added yet.', 'error'); return; }
  navigateTo('supplements');
});
