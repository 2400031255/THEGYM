/* ============================================
   THE GYM RATS — expenses.js
   Expense Tracker & Split Calculator
   ============================================ */

pageRenderers['expenses'] = renderExpenses;

document.getElementById('btn-new-expense').addEventListener('click', () => {
  document.getElementById('expense-form-card').style.display = 'block';
  setTodayDate('ef-date');
  renderSplitMembersCheckboxes();
  document.getElementById('expense-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('btn-cancel-expense').addEventListener('click', () => {
  document.getElementById('expense-form-card').style.display = 'none';
  document.getElementById('expense-form').reset();
});

function renderSplitMembersCheckboxes() {
  const friends = getData('friends');
  const profile = getData('profile');
  const container = document.getElementById('ef-split-members');
  const all = [{ id: 'me', name: profile.name || 'Me' }, ...friends];
  container.innerHTML = all.map(f => `
    <label class="split-member-check">
      <input type="checkbox" value="${f.id}" data-name="${f.name || f.id}" />
      ${f.name || f.id}
    </label>`).join('');
}

document.getElementById('expense-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('ef-amount').value);
  const checked = [...document.querySelectorAll('#ef-split-members input:checked')];
  let splits = null;
  if (checked.length > 0) {
    const perPerson = calculateExpenseSplit(amount, checked.length);
    splits = checked.map(c => ({ id: c.value, name: c.dataset.name, amount: perPerson, paid: false }));
  }
  const record = {
    description: document.getElementById('ef-desc').value.trim(),
    category:    document.getElementById('ef-cat').value,
    amount,
    date:        document.getElementById('ef-date').value,
    splits
  };
  addRecord('expenses', record);
  this.reset();
  document.getElementById('expense-form-card').style.display = 'none';
  showToast('Expense saved!', 'success');
  renderExpenses();
  updateNotifBadge();
});

function renderExpenses() {
  const expenses = getData('expenses').sort((a, b) => new Date(b.date) - new Date(a.date));
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const thisYear  = now.getFullYear().toString();

  const total      = expenses.reduce((s, e) => s + e.amount, 0);
  const monthly    = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0);
  const yearly     = expenses.filter(e => e.date.startsWith(thisYear)).reduce((s, e) => s + e.amount, 0);
  const pending    = expenses.flatMap(e => e.splits || []).filter(s => !s.paid).reduce((s, x) => s + x.amount, 0);

  document.getElementById('expense-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value" style="font-size:1.3rem">${formatINR(total)}</div><div class="stat-label">Total Spent</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:1.3rem">${formatINR(monthly)}</div><div class="stat-label">This Month</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:1.3rem">${formatINR(yearly)}</div><div class="stat-label">This Year</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:1.3rem;color:var(--warning)">${formatINR(pending)}</div><div class="stat-label">Pending</div></div>`;

  const container = document.getElementById('expenses-list-container');
  if (!expenses.length) {
    container.innerHTML = `<div class="card">${emptyState('💰', 'No expenses logged yet.')}</div>`;
    return;
  }

  container.innerHTML = expenses.map(exp => `
    <div class="card" style="margin-bottom:1rem">
      <div class="expense-item" style="border-bottom:${exp.splits ? '1px solid var(--border)' : 'none'}">
        <div class="expense-item-left">
          <div class="expense-item-desc">${exp.description}</div>
          <div class="expense-item-meta">${formatDateDisplay(exp.date)} · <span class="expense-cat-badge">${exp.category}</span></div>
        </div>
        <div style="text-align:right">
          <div class="expense-item-amount">${formatINR(exp.amount)}</div>
          <button class="btn-icon" style="margin-top:4px" onclick="deleteExpense('${exp.id}')">🗑</button>
        </div>
      </div>
      ${exp.splits ? buildSplitDetail(exp) : ''}
    </div>`).join('');
}

function buildSplitDetail(exp) {
  const perPerson = calculateExpenseSplit(exp.amount, exp.splits.length);
  return `
    <div class="split-detail">
      <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.5rem">
        SPLIT — ${formatINR(perPerson)} EACH (${exp.splits.length} people)
      </div>
      ${exp.splits.map((s, i) => `
        <div class="split-detail-row">
          <span>${s.name}</span>
          <span>${formatINR(s.amount)}</span>
          <button class="btn-icon" onclick="toggleSplitPaid('${exp.id}', ${i})"
            style="color:${s.paid ? 'var(--success)' : 'var(--warning)'}">
            ${s.paid ? '✅ PAID' : '⏳ PENDING'}
          </button>
        </div>`).join('')}
    </div>`;
}

function toggleSplitPaid(expId, splitIndex) {
  const data = loadData();
  const exp  = data.expenses.find(e => e.id === expId);
  if (!exp || !exp.splits) return;
  exp.splits[splitIndex].paid = !exp.splits[splitIndex].paid;
  saveData(data);
  renderExpenses();
  updateNotifBadge();
}

function deleteExpense(id) {
  confirmDelete('Expense', () => {
    deleteRecord('expenses', id);
    showToast('Expense deleted.', 'success');
    renderExpenses();
    updateNotifBadge();
  });
}
