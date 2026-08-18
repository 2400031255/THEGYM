/* ============================================
   OG FITNESS — gym-management.js
   Gym Owner + Receptionist Management System
   Integrates with existing Firebase setup
   ============================================ */

/* ---- Role helpers ---- */
function getGymRole() {
  return localStorage.getItem('ogf_role') || null;
}
function setGymRole(role) {
  localStorage.setItem('ogf_role', role);
}
function getGymId() {
  return localStorage.getItem('ogf_gymId') || 'default_gym';
}
function setGymId(id) {
  localStorage.setItem('ogf_gymId', id);
}
function isOwner()        { return getGymRole() === 'owner'; }
function isReceptionist() { return getGymRole() === 'receptionist'; }
function isGymStaff()     { return isOwner() || isReceptionist(); }

/* ---- Gym collection helpers ---- */
function gymCol(col) {
  return db.collection('gyms').doc(getGymId()).collection(col);
}
function gymDoc() {
  return db.collection('gyms').doc(getGymId());
}

/* ---- Date helpers ---- */
function todayStr()  { return new Date().toISOString().slice(0, 10); }
function monthStr()  { return new Date().toISOString().slice(0, 7); }
function yearStr()   { return String(new Date().getFullYear()); }
function calcDaysLeft(endDate) {
  const diff = new Date(endDate) - new Date(todayStr());
  return Math.ceil(diff / 86400000);
}
function membershipStatus(endDate) {
  const d = calcDaysLeft(endDate);
  if (d < 0)  return { label: 'EXPIRED',        cls: 'badge-red' };
  if (d <= 7) return { label: 'EXPIRING SOON',  cls: 'badge-orange' };
  return              { label: 'ACTIVE',         cls: 'badge-green' };
}

/* ---- Format INR ---- */
function fmtINR(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }

/* ---- Generate ID ---- */
function gmId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ============================================
   OWNER DASHBOARD
   ============================================ */

pageRenderers['owner-dashboard'] = renderOwnerDashboard;

async function renderOwnerDashboard() {
  const el = document.getElementById('page-owner-dashboard');
  if (!el) return;

  const now   = new Date();
  const today = todayStr();
  const month = monthStr();
  const hour  = now.getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  el.innerHTML = `
    <div class="gm-page-header">
      <div>
        <h1>${greet}, Owner</h1>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.2rem">
          ${now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem">
        <div class="brand-icon-og" style="width:36px;height:36px">
          <span class="brand-og" style="font-size:0.75rem">OG</span>
          <span class="brand-fit">FITNESS</span>
        </div>
      </div>
    </div>
    <div class="kpi-grid" id="owner-kpi-grid">
      <div class="kpi-card kpi-gold"><div class="kpi-value" id="kpi-today-rev">...</div><div class="kpi-label">Today's Revenue</div></div>
      <div class="kpi-card"><div class="kpi-value" id="kpi-today-mem">...</div><div class="kpi-label">Today's Memberships</div></div>
      <div class="kpi-card kpi-gold"><div class="kpi-value" id="kpi-month-rev">...</div><div class="kpi-label">Monthly Revenue</div></div>
      <div class="kpi-card"><div class="kpi-value" id="kpi-month-mem">...</div><div class="kpi-label">Memberships / Month</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-value" id="kpi-active">...</div><div class="kpi-label">Active Members</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-value" id="kpi-expiring">...</div><div class="kpi-label">Expiring Soon</div></div>
      <div class="kpi-card kpi-red"><div class="kpi-value" id="kpi-expired">...</div><div class="kpi-label">Expired</div></div>
      <div class="kpi-card"><div class="kpi-value" id="kpi-enquiries">...</div><div class="kpi-label">New Enquiries</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.25rem" id="owner-dash-grid">
      <div class="card">
        <div class="card-label">RECENT MEMBERSHIPS</div>
        <div id="owner-recent-memberships">Loading...</div>
      </div>
      <div class="card">
        <div class="card-label">RECENT ENQUIRIES</div>
        <div id="owner-recent-enquiries">Loading...</div>
      </div>
    </div>`;

  /* Load KPIs in parallel */
  _loadOwnerKPIs(today, month);
  _loadOwnerRecentMemberships();
  _loadOwnerRecentEnquiries();
}

async function _loadOwnerKPIs(today, month) {
  try {
    /* Revenue today */
    const todayRevSnap = await gymCol('revenueTransactions')
      .where('day', '==', today)
      .where('paymentStatus', '==', 'PAID')
      .get();
    let todayRev = 0, todayMem = 0;
    todayRevSnap.forEach(d => { todayRev += d.data().amount || 0; todayMem++; });
    _setKPI('kpi-today-rev', fmtINR(todayRev));
    _setKPI('kpi-today-mem', todayMem);

    /* Revenue this month */
    const monthRevSnap = await gymCol('revenueTransactions')
      .where('month', '==', month)
      .where('paymentStatus', '==', 'PAID')
      .get();
    let monthRev = 0, monthMem = 0;
    monthRevSnap.forEach(d => { monthRev += d.data().amount || 0; monthMem++; });
    _setKPI('kpi-month-rev', fmtINR(monthRev));
    _setKPI('kpi-month-mem', monthMem);

    /* Member counts */
    const clientsSnap = await gymCol('clients').get();
    let active = 0, expiring = 0, expired = 0;
    clientsSnap.forEach(d => {
      const c = d.data();
      if (!c.membershipEndDate) return;
      const days = calcDaysLeft(c.membershipEndDate);
      if (days < 0)       expired++;
      else if (days <= 7) expiring++;
      else                active++;
    });
    _setKPI('kpi-active',   active);
    _setKPI('kpi-expiring', expiring);
    _setKPI('kpi-expired',  expired);

    /* New enquiries */
    const enqSnap = await gymCol('enquiries').where('status', '==', 'NEW').get();
    _setKPI('kpi-enquiries', enqSnap.size);

  } catch (e) {
    console.error('_loadOwnerKPIs:', e);
  }
}

function _setKPI(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

async function _loadOwnerRecentMemberships() {
  const el = document.getElementById('owner-recent-memberships');
  if (!el) return;
  try {
    const snap = await gymCol('revenueTransactions')
      .orderBy('createdAt', 'desc').limit(5).get();
    if (snap.empty) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">No memberships yet.</div>'; return; }
    el.innerHTML = snap.docs.map(d => {
      const t = d.data();
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:700;font-size:0.88rem">${t.clientName || '—'}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${t.packageName || ''} · ${t.membershipType || ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;color:var(--accent)">${fmtINR(t.amount)}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">${(t.day || '').slice(0,10)}</div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Unable to load.</div>';
  }
}

async function _loadOwnerRecentEnquiries() {
  const el = document.getElementById('owner-recent-enquiries');
  if (!el) return;
  try {
    const snap = await db.collection('enquiries')
      .orderBy('createdAt', 'desc').limit(5).get();
    if (snap.empty) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">No enquiries yet.</div>'; return; }
    el.innerHTML = snap.docs.map(d => {
      const q = d.data();
      const statusCls = q.status === 'NEW' ? 'badge-blue' : q.status === 'CONTACTED' ? 'badge-orange' : 'badge-gray';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:700;font-size:0.88rem">${q.name}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${q.phone}</div>
        </div>
        <span class="badge ${statusCls}">${q.status}</span>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Unable to load.</div>';
  }
}

/* ============================================
   CLIENTS
   ============================================ */

pageRenderers['gm-clients'] = renderGMClients;

async function renderGMClients() {
  const el = document.getElementById('page-gm-clients');
  if (!el) return;
  el.innerHTML = `
    <div class="gm-page-header">
      <h1>Clients</h1>
      <button class="btn-primary" onclick="showCreateClientForm()">+ Add Client</button>
    </div>
    <div class="gm-search">
      <input type="text" id="client-search" placeholder="Search by name or phone..." oninput="filterClients(this.value)" />
    </div>
    <div class="card" id="create-client-card" style="display:none">
      <div class="form-section-title">NEW CLIENT</div>
      <form id="create-client-form" onsubmit="handleCreateClient(event)">
        <div class="form-row">
          <div class="form-group"><label>Full Name</label><input type="text" id="cc-name" placeholder="Client full name" required /></div>
          <div class="form-group"><label>Phone Number</label><input type="tel" id="cc-phone" placeholder="Phone number" required /></div>
        </div>
        <div class="form-group"><label>Address</label><input type="text" id="cc-address" placeholder="Address (optional)" /></div>
        <div style="border-top:1px solid var(--border);margin:1rem 0;padding-top:1rem">
          <div class="form-section-title">MEMBERSHIP</div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Membership Type</label>
            <select id="cc-mem-type">
              <option value="GENERAL">General Training</option>
              <option value="PT">Personal Training</option>
            </select>
          </div>
          <div class="form-group"><label>Package</label>
            <select id="cc-package" onchange="handlePackageChange()">
              <option value="1M">1 Month</option>
              <option value="3M">3 Months</option>
              <option value="6M">6 Months</option>
              <option value="1Y">1 Year</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
        </div>
        <div id="cc-custom-wrap" style="display:none">
          <div class="form-row">
            <div class="form-group"><label>Custom Days</label><input type="number" id="cc-custom-days" placeholder="e.g. 45" min="1" /></div>
            <div class="form-group"><label>Or Custom Months</label><input type="number" id="cc-custom-months" placeholder="e.g. 2" min="1" /></div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Amount (₹)</label><input type="number" id="cc-amount" placeholder="2000" min="0" required /></div>
          <div class="form-group"><label>Payment Status</label>
            <select id="cc-payment-status">
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Start Date</label><input type="date" id="cc-start" required onchange="autoCalcEndDate()" /></div>
          <div class="form-group"><label>End Date</label><input type="date" id="cc-end" required /></div>
        </div>
        <div id="cc-error" style="color:var(--accent);font-size:0.78rem;min-height:1rem;margin-bottom:0.5rem"></div>
        <div class="form-actions">
          <button type="button" class="btn-ghost" onclick="hideCreateClientForm()">Cancel</button>
          <button type="submit" class="btn-primary" id="btn-create-client">Create Client</button>
        </div>
      </form>
    </div>
    <div class="card">
      <div class="card-label">ALL CLIENTS</div>
      <div id="clients-list">Loading...</div>
    </div>`;

  _loadClients();
}

function showCreateClientForm() {
  const card = document.getElementById('create-client-card');
  if (card) { card.style.display = 'block'; card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  const today = todayStr();
  const startEl = document.getElementById('cc-start');
  if (startEl && !startEl.value) { startEl.value = today; autoCalcEndDate(); }
}
function hideCreateClientForm() {
  const card = document.getElementById('create-client-card');
  if (card) card.style.display = 'none';
  document.getElementById('create-client-form')?.reset();
}

function handlePackageChange() {
  const pkg  = document.getElementById('cc-package')?.value;
  const wrap = document.getElementById('cc-custom-wrap');
  if (wrap) wrap.style.display = pkg === 'CUSTOM' ? 'block' : 'none';
  autoCalcEndDate();
}

function autoCalcEndDate() {
  const start = document.getElementById('cc-start')?.value;
  const pkg   = document.getElementById('cc-package')?.value;
  if (!start || !pkg) return;
  const d = new Date(start);
  if (pkg === '1M')     d.setMonth(d.getMonth() + 1);
  else if (pkg === '3M') d.setMonth(d.getMonth() + 3);
  else if (pkg === '6M') d.setMonth(d.getMonth() + 6);
  else if (pkg === '1Y') d.setFullYear(d.getFullYear() + 1);
  else return; /* CUSTOM — user fills manually */
  const endEl = document.getElementById('cc-end');
  if (endEl) endEl.value = d.toISOString().slice(0, 10);
}

async function handleCreateClient(e) {
  e.preventDefault();
  const errEl = document.getElementById('cc-error');
  const btn   = document.getElementById('btn-create-client');
  errEl.textContent = '';

  const name    = document.getElementById('cc-name').value.trim();
  const phone   = document.getElementById('cc-phone').value.trim();
  const address = document.getElementById('cc-address').value.trim();
  const memType = document.getElementById('cc-mem-type').value;
  const pkg     = document.getElementById('cc-package').value;
  const amount  = parseFloat(document.getElementById('cc-amount').value) || 0;
  const payStatus = document.getElementById('cc-payment-status').value;
  const start   = document.getElementById('cc-start').value;
  const end     = document.getElementById('cc-end').value;

  if (!name || !phone || !start || !end) { errEl.textContent = 'Please fill all required fields.'; return; }
  if (new Date(end) <= new Date(start))  { errEl.textContent = 'End date must be after start date.'; return; }

  btn.disabled = true; btn.textContent = 'Creating...';

  try {
    const clientId = gmId();
    const now = new Date().toISOString();
    const gymId = getGymId();
    const uid = getCurrentUid();

    /* Save client doc */
    await gymCol('clients').doc(clientId).set({
      clientId, gymId, name, phone, address,
      membershipType: memType,
      package: pkg,
      membershipStartDate: start,
      membershipEndDate: end,
      createdAt: now,
      createdBy: uid
    });

    /* Save membership record */
    const memId = gmId();
    await gymCol('memberships').doc(memId).set({
      memId, clientId, gymId, clientName: name,
      membershipType: memType, package: pkg,
      amount, paymentStatus: payStatus,
      startDate: start, endDate: end,
      createdAt: now, createdBy: uid
    });

    /* Create revenue transaction if PAID */
    if (payStatus === 'PAID') {
      await _createRevenueTransaction({
        clientId, clientName: name, membershipId: memId,
        membershipType: memType, packageName: pkg,
        amount, paymentStatus: 'PAID',
        transactionType: 'NEW_MEMBERSHIP',
        date: start
      });
    }

    showToast('Client created successfully!', 'success');
    hideCreateClientForm();
    _loadClients();
  } catch (err) {
    console.error('handleCreateClient:', err);
    errEl.textContent = 'Unable to create client. Please try again.';
  }
  btn.disabled = false; btn.textContent = 'Create Client';
}

let _allClients = [];

async function _loadClients() {
  const el = document.getElementById('clients-list');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Loading clients...</div>';
  try {
    const snap = await gymCol('clients').orderBy('createdAt', 'desc').limit(50).get();
    _allClients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _renderClientsList(_allClients);
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Unable to load clients.</div>';
  }
}

function _renderClientsList(clients) {
  const el = document.getElementById('clients-list');
  if (!el) return;
  if (!clients.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">No clients found.</div>'; return; }
  el.innerHTML = `<div class="gm-table-wrap"><table class="gm-table">
    <thead><tr>
      <th>Name</th><th>Phone</th><th>Type</th><th>Package</th><th>End Date</th><th>Status</th><th>Actions</th>
    </tr></thead>
    <tbody>${clients.map(c => {
      const st = c.membershipEndDate ? membershipStatus(c.membershipEndDate) : { label: 'NO MEMBERSHIP', cls: 'badge-gray' };
      const days = c.membershipEndDate ? calcDaysLeft(c.membershipEndDate) : null;
      return `<tr>
        <td style="font-weight:700">${c.name}</td>
        <td>${c.phone}</td>
        <td>${c.membershipType || '—'}</td>
        <td>${c.package || '—'}</td>
        <td>${c.membershipEndDate || '—'}</td>
        <td><span class="badge ${st.cls}">${st.label}</span>${days !== null && days >= 0 ? `<span style="font-size:0.68rem;color:var(--text-muted);margin-left:0.4rem">${days}d</span>` : ''}</td>
        <td><div class="action-btns">
          <button class="btn-icon" onclick="viewClient('${c.id}')">View</button>
          ${isOwner() ? `<button class="btn-icon" style="color:var(--accent)" onclick="confirmDeleteClient('${c.id}','${c.name}')">Delete</button>` : ''}
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function filterClients(q) {
  const lower = q.toLowerCase();
  const filtered = _allClients.filter(c =>
    c.name.toLowerCase().includes(lower) || (c.phone || '').includes(lower)
  );
  _renderClientsList(filtered);
}

function confirmDeleteClient(id, name) {
  showModal('Delete Client', `Delete "${name}"? This will not delete their workout or supplement data.`, 'Delete', async () => {
    try {
      await gymCol('clients').doc(id).delete();
      showToast('Client deleted.', 'success');
      _loadClients();
    } catch (e) { showToast('Unable to delete client.', 'error'); }
  });
}

/* ---- View client (stub — expand as needed) ---- */
function viewClient(id) {
  const c = _allClients.find(x => x.id === id);
  if (!c) return;
  const st = c.membershipEndDate ? membershipStatus(c.membershipEndDate) : { label: 'NO MEMBERSHIP', cls: 'badge-gray' };
  const days = c.membershipEndDate ? calcDaysLeft(c.membershipEndDate) : null;
  showModal(
    c.name,
    `Phone: ${c.phone}\nType: ${c.membershipType || '—'}\nPackage: ${c.package || '—'}\nEnd: ${c.membershipEndDate || '—'}\nStatus: ${st.label}${days !== null && days >= 0 ? ' · ' + days + ' days left' : ''}`,
    'Close',
    null
  );
}

/* ============================================
   ENQUIRIES
   ============================================ */

pageRenderers['gm-enquiries'] = renderGMEnquiries;

async function renderGMEnquiries() {
  const el = document.getElementById('page-gm-enquiries');
  if (!el) return;
  el.innerHTML = `
    <div class="gm-page-header">
      <h1>Enquiries</h1>
    </div>
    <div class="gm-search">
      <input type="text" id="enq-search" placeholder="Search by name or phone..." oninput="filterEnquiries(this.value)" />
    </div>
    <div class="card">
      <div class="card-label">ALL ENQUIRIES</div>
      <div id="enquiries-list">Loading...</div>
    </div>`;
  _loadEnquiries();
}

let _allEnquiries = [];

async function _loadEnquiries() {
  const el = document.getElementById('enquiries-list');
  if (!el) return;
  try {
    const snap = await db.collection('enquiries').orderBy('createdAt', 'desc').limit(100).get();
    _allEnquiries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _renderEnquiriesList(_allEnquiries);
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Unable to load enquiries.</div>';
  }
}

function _renderEnquiriesList(list) {
  const el = document.getElementById('enquiries-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">No enquiries found.</div>'; return; }
  el.innerHTML = list.map(q => {
    const statusCls = q.status === 'NEW' ? 'badge-blue' : q.status === 'CONTACTED' ? 'badge-orange' : 'badge-gray';
    const date = q.date ? q.date.slice(0, 10) : '';
    return `<div style="padding:1rem 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem">
        <div>
          <div style="font-weight:800;font-size:0.95rem">${q.name}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${q.phone} · ${date}</div>
          ${q.message ? `<div style="font-size:0.82rem;color:var(--text-secondary);margin-top:0.3rem">${q.message}</div>` : ''}
        </div>
        <span class="badge ${statusCls}">${q.status}</span>
      </div>
      <div class="action-btns">
        <a class="btn-icon" href="tel:${q.phone}">📞 Call</a>
        <button class="btn-icon" onclick="copyPhone('${q.phone}')">📋 Copy</button>
        <a class="btn-icon" href="https://wa.me/91${q.phone.replace(/\D/g,'')}" target="_blank">💬 WhatsApp</a>
        ${q.status !== 'CONTACTED' ? `<button class="btn-icon" onclick="markEnquiryContacted('${q.id}')">✓ Contacted</button>` : ''}
        ${q.status !== 'CLOSED' ? `<button class="btn-icon" onclick="markEnquiryClosed('${q.id}')">✗ Close</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function filterEnquiries(q) {
  const lower = q.toLowerCase();
  _renderEnquiriesList(_allEnquiries.filter(e =>
    e.name.toLowerCase().includes(lower) || (e.phone || '').includes(lower)
  ));
}

function copyPhone(phone) {
  navigator.clipboard.writeText(phone).then(() => showToast('Phone number copied!', 'success'));
}

async function markEnquiryContacted(id) {
  try {
    await db.collection('enquiries').doc(id).update({ status: 'CONTACTED' });
    showToast('Marked as contacted.', 'success');
    _loadEnquiries();
  } catch (e) { showToast('Unable to update.', 'error'); }
}

async function markEnquiryClosed(id) {
  try {
    await db.collection('enquiries').doc(id).update({ status: 'CLOSED' });
    showToast('Enquiry closed.', 'success');
    _loadEnquiries();
  } catch (e) { showToast('Unable to update.', 'error'); }
}

/* ============================================
   TRAINERS
   ============================================ */

pageRenderers['gm-trainers'] = renderGMTrainers;

async function renderGMTrainers() {
  const el = document.getElementById('page-gm-trainers');
  if (!el) return;
  el.innerHTML = `
    <div class="gm-page-header">
      <h1>Trainers</h1>
      ${isOwner() ? '<button class="btn-primary" onclick="showTrainerForm()">+ Add Trainer</button>' : ''}
    </div>
    <div class="card" id="trainer-form-card" style="display:none">
      <div class="form-section-title">ADD TRAINER</div>
      <form id="trainer-form" onsubmit="handleSaveTrainer(event)">
        <div class="form-row">
          <div class="form-group"><label>Full Name</label><input type="text" id="tf-name" placeholder="Trainer name" required /></div>
          <div class="form-group"><label>Phone</label><input type="tel" id="tf-phone" placeholder="Phone number" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Email</label><input type="email" id="tf-email" placeholder="Email (optional)" /></div>
          <div class="form-group"><label>Joining Date</label><input type="date" id="tf-join" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Monthly Salary (₹)</label><input type="number" id="tf-salary" placeholder="30000" min="0" /></div>
          <div class="form-group"><label>Status</label>
            <select id="tf-status"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
          </div>
        </div>
        <div class="form-group"><label>Address</label><input type="text" id="tf-address" placeholder="Address (optional)" /></div>
        <div id="tf-error" style="color:var(--accent);font-size:0.78rem;min-height:1rem;margin-bottom:0.5rem"></div>
        <div class="form-actions">
          <button type="button" class="btn-ghost" onclick="hideTrainerForm()">Cancel</button>
          <button type="submit" class="btn-primary" id="btn-save-trainer">Save Trainer</button>
        </div>
      </form>
    </div>
    <div class="card">
      <div class="card-label">ALL TRAINERS</div>
      <div id="trainers-list">Loading...</div>
    </div>`;
  _loadTrainers();
}

function showTrainerForm() {
  const c = document.getElementById('trainer-form-card');
  if (c) { c.style.display = 'block'; c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
function hideTrainerForm() {
  const c = document.getElementById('trainer-form-card');
  if (c) c.style.display = 'none';
  document.getElementById('trainer-form')?.reset();
}

async function handleSaveTrainer(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-trainer');
  const errEl = document.getElementById('tf-error');
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const id = gmId();
    await gymCol('trainers').doc(id).set({
      id, gymId: getGymId(),
      name:       document.getElementById('tf-name').value.trim(),
      phone:      document.getElementById('tf-phone').value.trim(),
      email:      document.getElementById('tf-email').value.trim(),
      joiningDate:document.getElementById('tf-join').value,
      salary:     parseFloat(document.getElementById('tf-salary').value) || 0,
      status:     document.getElementById('tf-status').value,
      address:    document.getElementById('tf-address').value.trim(),
      createdAt:  new Date().toISOString(),
      createdBy:  getCurrentUid()
    });
    showToast('Trainer saved!', 'success');
    hideTrainerForm();
    _loadTrainers();
  } catch (err) {
    errEl.textContent = 'Unable to save trainer. Please try again.';
  }
  btn.disabled = false; btn.textContent = 'Save Trainer';
}

let _allTrainers = [];

async function _loadTrainers() {
  const el = document.getElementById('trainers-list');
  if (!el) return;
  try {
    const snap = await gymCol('trainers').orderBy('createdAt', 'desc').get();
    _allTrainers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!_allTrainers.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">No trainers added yet.</div>'; return; }
    el.innerHTML = `<div class="gm-table-wrap"><table class="gm-table">
      <thead><tr><th>Name</th><th>Phone</th><th>Joining Date</th><th>Salary</th><th>Status</th>${isOwner() ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${_allTrainers.map(t => `<tr>
        <td style="font-weight:700">${t.name}</td>
        <td>${t.phone}</td>
        <td>${t.joiningDate || '—'}</td>
        <td>${fmtINR(t.salary)}</td>
        <td><span class="badge ${t.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}">${t.status}</span></td>
        ${isOwner() ? `<td><button class="btn-icon" style="color:var(--accent)" onclick="confirmDeleteTrainer('${t.id}','${t.name}')">Delete</button></td>` : ''}
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Unable to load trainers.</div>';
  }
}

function confirmDeleteTrainer(id, name) {
  showModal('Delete Trainer', `Delete trainer "${name}"? This cannot be undone.`, 'Delete', async () => {
    try { await gymCol('trainers').doc(id).delete(); showToast('Trainer deleted.', 'success'); _loadTrainers(); }
    catch (e) { showToast('Unable to delete.', 'error'); }
  });
}

/* ============================================
   TRAINER ATTENDANCE
   ============================================ */

pageRenderers['gm-attendance'] = renderGMAttendance;

async function renderGMAttendance() {
  const el = document.getElementById('page-gm-attendance');
  if (!el) return;
  const today = todayStr();
  el.innerHTML = `
    <div class="gm-page-header">
      <h1>Trainer Attendance</h1>
    </div>
    <div class="card">
      <div class="card-label">MARK ATTENDANCE — ${today}</div>
      <div id="attendance-mark-list">Loading trainers...</div>
      <div style="margin-top:1rem">
        <button class="btn-primary" id="btn-save-attendance" onclick="saveAttendance('${today}')">Save Attendance</button>
      </div>
    </div>
    <div class="card">
      <div class="card-label">ATTENDANCE HISTORY</div>
      <div class="form-row" style="margin-bottom:1rem">
        <div class="form-group"><label>Select Date</label><input type="date" id="att-history-date" value="${today}" onchange="loadAttendanceHistory(this.value)" /></div>
      </div>
      <div id="attendance-history-list">Select a date to view.</div>
    </div>`;
  _loadAttendanceMarkList(today);
}

async function _loadAttendanceMarkList(date) {
  const el = document.getElementById('attendance-mark-list');
  if (!el) return;
  if (!_allTrainers.length) {
    const snap = await gymCol('trainers').where('status', '==', 'ACTIVE').get();
    _allTrainers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  /* Load existing attendance for today */
  let existing = {};
  try {
    const snap = await gymCol('attendance').where('date', '==', date).get();
    snap.forEach(d => { existing[d.data().trainerId] = d.data().status; });
  } catch (e) {}

  if (!_allTrainers.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">No active trainers.</div>'; return; }
  el.innerHTML = _allTrainers.map(t => {
    const cur = existing[t.id] || 'PRESENT';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--border)">
      <div style="font-weight:700">${t.name}</div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn-icon att-btn ${cur === 'PRESENT' ? 'att-present' : ''}" id="att-${t.id}-P"
          onclick="toggleAtt('${t.id}','PRESENT')"
          style="${cur === 'PRESENT' ? 'background:rgba(34,197,94,0.15);border-color:var(--success);color:var(--success)' : ''}">
          ✓ Present
        </button>
        <button class="btn-icon att-btn ${cur === 'ABSENT' ? 'att-absent' : ''}" id="att-${t.id}-A"
          onclick="toggleAtt('${t.id}','ABSENT')"
          style="${cur === 'ABSENT' ? 'background:rgba(224,28,28,0.15);border-color:var(--accent);color:var(--accent)' : ''}">
          ✗ Absent
        </button>
      </div>
    </div>`;
  }).join('');
}

const _attState = {};
function toggleAtt(trainerId, status) {
  _attState[trainerId] = status;
  const pBtn = document.getElementById(`att-${trainerId}-P`);
  const aBtn = document.getElementById(`att-${trainerId}-A`);
  if (pBtn) pBtn.style.cssText = status === 'PRESENT' ? 'background:rgba(34,197,94,0.15);border-color:var(--success);color:var(--success)' : '';
  if (aBtn) aBtn.style.cssText = status === 'ABSENT'  ? 'background:rgba(224,28,28,0.15);border-color:var(--accent);color:var(--accent)' : '';
}

async function saveAttendance(date) {
  const btn = document.getElementById('btn-save-attendance');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const batch = db.batch();
    for (const [trainerId, status] of Object.entries(_attState)) {
      const trainer = _allTrainers.find(t => t.id === trainerId);
      const docId = `${date}_${trainerId}`;
      batch.set(gymCol('attendance').doc(docId), {
        date, trainerId,
        trainerName: trainer?.name || '',
        status, gymId: getGymId(),
        markedBy: getCurrentUid(),
        markedAt: new Date().toISOString()
      });
    }
    await batch.commit();
    showToast('Attendance saved!', 'success');
  } catch (e) { showToast('Unable to save attendance.', 'error'); }
  btn.disabled = false; btn.textContent = 'Save Attendance';
}

async function loadAttendanceHistory(date) {
  const el = document.getElementById('attendance-history-list');
  if (!el) return;
  el.innerHTML = 'Loading...';
  try {
    const snap = await gymCol('attendance').where('date', '==', date).get();
    if (snap.empty) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">No attendance recorded for this date.</div>'; return; }
    el.innerHTML = snap.docs.map(d => {
      const a = d.data();
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:700">${a.trainerName}</span>
        <span class="badge ${a.status === 'PRESENT' ? 'badge-green' : 'badge-red'}">${a.status}</span>
      </div>`;
    }).join('');
  } catch (e) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Unable to load.</div>'; }
}

/* ============================================
   SALARY
   ============================================ */

pageRenderers['gm-salary'] = renderGMSalary;

async function renderGMSalary() {
  const el = document.getElementById('page-gm-salary');
  if (!el) return;
  if (!_allTrainers.length) {
    const snap = await gymCol('trainers').where('status', '==', 'ACTIVE').get();
    _allTrainers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  const trainerOptions = _allTrainers.map(t => `<option value="${t.id}" data-salary="${t.salary}">${t.name}</option>`).join('');
  el.innerHTML = `
    <div class="gm-page-header"><h1>Trainer Salary</h1></div>
    <div class="card">
      <div class="form-section-title">CALCULATE SALARY</div>
      <div class="form-row">
        <div class="form-group"><label>Trainer</label>
          <select id="sal-trainer" onchange="prefillSalary()">${trainerOptions}</select>
        </div>
        <div class="form-group"><label>Month</label>
          <input type="month" id="sal-month" value="${monthStr()}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Monthly Salary (₹)</label><input type="number" id="sal-base" placeholder="30000" min="0" oninput="calcSalary()" /></div>
        <div class="form-group"><label>Working Days</label><input type="number" id="sal-working" placeholder="30" min="1" oninput="calcSalary()" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Present Days</label><input type="number" id="sal-present" placeholder="29" min="0" oninput="calcSalary()" /></div>
        <div class="form-group"><label>Absent Days</label><input type="number" id="sal-absent" placeholder="1" min="0" oninput="calcSalary()" /></div>
      </div>
      <div class="card" style="background:var(--bg-secondary);margin-top:0.5rem">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1rem;text-align:center">
          <div><div class="kpi-value" id="sal-base-disp">₹0</div><div class="kpi-label">Base Salary</div></div>
          <div><div class="kpi-value" id="sal-working-disp">0</div><div class="kpi-label">Working Days</div></div>
          <div><div class="kpi-value" style="color:var(--success)" id="sal-present-disp">0</div><div class="kpi-label">Present</div></div>
          <div><div class="kpi-value" style="color:var(--accent)" id="sal-absent-disp">0</div><div class="kpi-label">Absent</div></div>
          <div><div class="kpi-value kpi-gold" id="sal-final-disp" style="color:#f5c842">₹0</div><div class="kpi-label">Final Salary</div></div>
        </div>
      </div>
      <div style="margin-top:1rem">
        <button class="btn-primary" onclick="saveSalaryRecord()">Save Salary Record</button>
      </div>
    </div>
    <div class="card">
      <div class="card-label">SALARY HISTORY</div>
      <div id="salary-history-list">Loading...</div>
    </div>`;
  prefillSalary();
  _loadSalaryHistory();
}

function prefillSalary() {
  const sel = document.getElementById('sal-trainer');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const salary = parseFloat(opt?.dataset?.salary) || 0;
  const baseEl = document.getElementById('sal-base');
  if (baseEl) baseEl.value = salary;
  calcSalary();
}

function calcSalary() {
  const base    = parseFloat(document.getElementById('sal-base')?.value)    || 0;
  const working = parseFloat(document.getElementById('sal-working')?.value) || 30;
  const present = parseFloat(document.getElementById('sal-present')?.value) || 0;
  const absent  = parseFloat(document.getElementById('sal-absent')?.value)  || 0;
  const final   = working > 0 ? (base / working) * present : 0;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('sal-base-disp',    fmtINR(base));
  set('sal-working-disp', working);
  set('sal-present-disp', present);
  set('sal-absent-disp',  absent);
  set('sal-final-disp',   fmtINR(Math.round(final)));
}

async function saveSalaryRecord() {
  const trainerId = document.getElementById('sal-trainer')?.value;
  const trainer   = _allTrainers.find(t => t.id === trainerId);
  const month     = document.getElementById('sal-month')?.value;
  const base      = parseFloat(document.getElementById('sal-base')?.value)    || 0;
  const working   = parseFloat(document.getElementById('sal-working')?.value) || 30;
  const present   = parseFloat(document.getElementById('sal-present')?.value) || 0;
  const absent    = parseFloat(document.getElementById('sal-absent')?.value)  || 0;
  const final     = working > 0 ? Math.round((base / working) * present) : 0;
  if (!trainerId || !month) { showToast('Select trainer and month.', 'error'); return; }
  try {
    await gymCol('salaryRecords').doc(`${month}_${trainerId}`).set({
      trainerId, trainerName: trainer?.name || '',
      month, baseSalary: base, workingDays: working,
      presentDays: present, absentDays: absent, finalSalary: final,
      gymId: getGymId(), createdAt: new Date().toISOString(), createdBy: getCurrentUid()
    });
    showToast('Salary record saved!', 'success');
    _loadSalaryHistory();
  } catch (e) { showToast('Unable to save salary record.', 'error'); }
}

async function _loadSalaryHistory() {
  const el = document.getElementById('salary-history-list');
  if (!el) return;
  try {
    const snap = await gymCol('salaryRecords').orderBy('createdAt', 'desc').limit(20).get();
    if (snap.empty) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">No salary records yet.</div>'; return; }
    el.innerHTML = `<div class="gm-table-wrap"><table class="gm-table">
      <thead><tr><th>Trainer</th><th>Month</th><th>Base</th><th>Present</th><th>Absent</th><th>Final Salary</th></tr></thead>
      <tbody>${snap.docs.map(d => { const s = d.data(); return `<tr>
        <td style="font-weight:700">${s.trainerName}</td>
        <td>${s.month}</td><td>${fmtINR(s.baseSalary)}</td>
        <td>${s.presentDays}</td><td>${s.absentDays}</td>
        <td style="font-weight:800;color:#f5c842">${fmtINR(s.finalSalary)}</td>
      </tr>`; }).join('')}</tbody>
    </table></div>`;
  } catch (e) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Unable to load.</div>'; }
}

/* ============================================
   REVENUE  (Owner only)
   ============================================ */

pageRenderers['gm-revenue'] = renderGMRevenue;

async function renderGMRevenue() {
  const el = document.getElementById('page-gm-revenue');
  if (!el) return;
  el.innerHTML = `
    <div class="gm-page-header"><h1>Revenue</h1></div>
    <div class="kpi-grid" id="rev-kpi-grid">
      <div class="kpi-card kpi-gold"><div class="kpi-value" id="rev-today">...</div><div class="kpi-label">Today's Revenue</div></div>
      <div class="kpi-card"><div class="kpi-value" id="rev-today-mem">...</div><div class="kpi-label">Today's Memberships</div></div>
      <div class="kpi-card kpi-gold"><div class="kpi-value" id="rev-week">...</div><div class="kpi-label">This Week</div></div>
      <div class="kpi-card kpi-gold"><div class="kpi-value" id="rev-month">...</div><div class="kpi-label">This Month</div></div>
      <div class="kpi-card kpi-gold"><div class="kpi-value" id="rev-year">...</div><div class="kpi-label">This Year</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-value" id="rev-pending">...</div><div class="kpi-label">Pending Amount</div></div>
    </div>
    <div class="card">
      <div class="card-label">RECENT TRANSACTIONS</div>
      <div id="rev-transactions">Loading...</div>
    </div>`;
  _loadRevenueKPIs();
  _loadRevenueTransactions();
}

async function _loadRevenueKPIs() {
  const today = todayStr();
  const month = monthStr();
  const year  = yearStr();
  const now   = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekStr = weekStart.toISOString().slice(0, 10);

  try {
    const snap = await gymCol('revenueTransactions').orderBy('day', 'desc').limit(500).get();
    let todayRev = 0, todayMem = 0, weekRev = 0, monthRev = 0, yearRev = 0, pending = 0;
    snap.forEach(d => {
      const t = d.data();
      if (t.paymentStatus === 'PAID') {
        if (t.day === today)          { todayRev += t.amount; todayMem++; }
        if (t.day >= weekStr)           weekRev  += t.amount;
        if ((t.month || t.day?.slice(0,7)) === month) monthRev += t.amount;
        if ((t.year  || t.day?.slice(0,4)) === year)  yearRev  += t.amount;
      } else if (t.paymentStatus === 'PENDING') {
        pending += t.amount;
      }
    });
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('rev-today',     fmtINR(todayRev));
    s('rev-today-mem', todayMem);
    s('rev-week',      fmtINR(weekRev));
    s('rev-month',     fmtINR(monthRev));
    s('rev-year',      fmtINR(yearRev));
    s('rev-pending',   fmtINR(pending));
  } catch (e) { console.error('_loadRevenueKPIs:', e); }
}

async function _loadRevenueTransactions() {
  const el = document.getElementById('rev-transactions');
  if (!el) return;
  try {
    const snap = await gymCol('revenueTransactions').orderBy('createdAt', 'desc').limit(50).get();
    if (snap.empty) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">No transactions yet.</div>'; return; }
    el.innerHTML = `<div class="gm-table-wrap"><table class="gm-table">
      <thead><tr><th>Date</th><th>Client</th><th>Membership</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>${snap.docs.map(d => { const t = d.data(); return `<tr>
        <td>${(t.day || t.date || '').slice(0,10)}</td>
        <td style="font-weight:700">${t.clientName}</td>
        <td>${t.packageName || ''}</td>
        <td>${t.membershipType || ''}</td>
        <td style="font-weight:800;color:var(--accent)">${fmtINR(t.amount)}</td>
        <td><span class="badge ${t.paymentStatus === 'PAID' ? 'badge-green' : 'badge-orange'}">${t.paymentStatus}</span></td>
      </tr>`; }).join('')}</tbody>
    </table></div>`;
  } catch (e) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Unable to load transactions.</div>'; }
}

async function _createRevenueTransaction(data) {
  const day = (data.date || todayStr()).slice(0, 10);
  await gymCol('revenueTransactions').add({
    gymId:          getGymId(),
    clientId:       data.clientId,
    clientName:     data.clientName,
    membershipId:   data.membershipId,
    membershipType: data.membershipType,
    packageName:    data.packageName,
    amount:         data.amount,
    paymentStatus:  data.paymentStatus,
    transactionType:data.transactionType,
    day,
    month: day.slice(0, 7),
    year:  day.slice(0, 4),
    date:  day,
    createdAt: new Date().toISOString(),
    createdBy: getCurrentUid()
  });
}

/* ============================================
   GYM PROFILE
   ============================================ */

pageRenderers['gm-profile'] = renderGMProfile;

async function renderGMProfile() {
  const el = document.getElementById('page-gm-profile');
  if (!el) return;
  let profile = {};
  try { const snap = await gymDoc().get(); if (snap.exists) profile = snap.data().profile || {}; } catch (e) {}
  el.innerHTML = `
    <div class="gm-page-header"><h1>Gym Profile</h1></div>
    <div class="card">
      <div class="form-section-title">GYM DETAILS</div>
      <form onsubmit="saveGymProfile(event)">
        <div class="form-row">
          <div class="form-group"><label>Gym Name</label><input type="text" id="gp-name" value="${profile.name || 'OG FITNESS'}" required /></div>
          <div class="form-group"><label>Phone</label><input type="tel" id="gp-phone" value="${profile.phone || ''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Email</label><input type="email" id="gp-email" value="${profile.email || ''}" /></div>
          <div class="form-group"><label>WhatsApp Number</label><input type="tel" id="gp-whatsapp" value="${profile.whatsapp || ''}" /></div>
        </div>
        <div class="form-group"><label>Address</label><input type="text" id="gp-address" value="${profile.address || ''}" /></div>
        <div class="form-row">
          <div class="form-group"><label>Opening Time</label><input type="time" id="gp-open" value="${profile.openTime || '06:00'}" /></div>
          <div class="form-group"><label>Closing Time</label><input type="time" id="gp-close" value="${profile.closeTime || '22:00'}" /></div>
        </div>
        <div class="form-group"><label>Instagram URL</label><input type="url" id="gp-instagram" value="${profile.instagram || ''}" placeholder="https://instagram.com/ogfitness" /></div>
        <div class="form-group"><label>Description</label><textarea id="gp-desc" rows="3">${profile.description || ''}</textarea></div>
        <div class="form-actions">
          <button type="submit" class="btn-primary">Save Profile</button>
        </div>
      </form>
    </div>`;
}

async function saveGymProfile(e) {
  e.preventDefault();
  try {
    await gymDoc().set({ profile: {
      name:        document.getElementById('gp-name').value.trim(),
      phone:       document.getElementById('gp-phone').value.trim(),
      email:       document.getElementById('gp-email').value.trim(),
      whatsapp:    document.getElementById('gp-whatsapp').value.trim(),
      address:     document.getElementById('gp-address').value.trim(),
      openTime:    document.getElementById('gp-open').value,
      closeTime:   document.getElementById('gp-close').value,
      instagram:   document.getElementById('gp-instagram').value.trim(),
      description: document.getElementById('gp-desc').value.trim(),
      updatedAt:   new Date().toISOString()
    }}, { merge: true });
    showToast('Gym profile saved!', 'success');
  } catch (err) { showToast('Unable to save profile.', 'error'); }
}

/* ============================================
   MAINTENANCE MODE (Owner only)
   ============================================ */

pageRenderers['gm-maintenance'] = renderGMMaintenance;

function renderGMMaintenance() {
  const el = document.getElementById('page-gm-maintenance');
  if (!el) return;
  const on = getMaintenanceMode();
  el.innerHTML = `
    <div class="gm-page-header"><h1>Maintenance Mode</h1></div>
    <div class="card">
      <div class="card-label">MAINTENANCE CONTROL</div>
      <div class="maintenance-toggle-row">
        <div>
          <div class="settings-action-title">Maintenance Mode is <span style="color:${on ? '#f59e0b' : 'var(--success)'}">${on ? 'ON' : 'OFF'}</span></div>
          <div class="settings-action-desc">When ON, clients and receptionists cannot access the app. Only the owner can log in.</div>
        </div>
        <button class="maintenance-toggle-btn ${on ? 'on' : 'off'}" onclick="handleToggleMaintenance()">
          ${on ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>`;
}

/* ============================================
   RECEPTIONIST DASHBOARD
   ============================================ */

pageRenderers['receptionist-dashboard'] = renderReceptionistDashboard;

async function renderReceptionistDashboard() {
  const el = document.getElementById('page-receptionist-dashboard');
  if (!el) return;
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  el.innerHTML = `
    <div class="gm-page-header">
      <h1>${greet}, Receptionist</h1>
      <div style="font-size:0.78rem;color:var(--text-muted)">${now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card kpi-green"><div class="kpi-value" id="rec-kpi-active">...</div><div class="kpi-label">Active Members</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-value" id="rec-kpi-expiring">...</div><div class="kpi-label">Expiring Soon</div></div>
      <div class="kpi-card"><div class="kpi-value" id="rec-kpi-enquiries">...</div><div class="kpi-label">New Enquiries</div></div>
    </div>
    <div class="card">
      <div class="card-label">QUICK ACTIONS</div>
      <div class="quick-actions">
        <button class="qa-btn" onclick="navigateTo('gm-clients')">+ ADD CLIENT</button>
        <button class="qa-btn" onclick="navigateTo('gm-enquiries')">VIEW ENQUIRIES</button>
        <button class="qa-btn" onclick="navigateTo('gm-attendance')">MARK ATTENDANCE</button>
        <button class="qa-btn" onclick="navigateTo('gm-trainers')">VIEW TRAINERS</button>
      </div>
    </div>`;
  /* Load KPIs */
  try {
    const snap = await gymCol('clients').get();
    let active = 0, expiring = 0;
    snap.forEach(d => {
      const days = calcDaysLeft(d.data().membershipEndDate || '2000-01-01');
      if (days >= 0 && days <= 7) expiring++;
      else if (days > 7) active++;
    });
    document.getElementById('rec-kpi-active')?.setAttribute('textContent', active) || (document.getElementById('rec-kpi-active').textContent = active);
    document.getElementById('rec-kpi-expiring').textContent = expiring;
    const enqSnap = await db.collection('enquiries').where('status', '==', 'NEW').get();
    document.getElementById('rec-kpi-enquiries').textContent = enqSnap.size;
  } catch (e) {}
}

/* ============================================
   BUILD GYM MANAGEMENT SIDEBAR
   ============================================ */

function buildGymSidebar(role) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  /* Remove existing client nav items */
  nav.innerHTML = '';

  if (role === 'owner') {
    nav.innerHTML = `
      ${_navItem('owner-dashboard','Dashboard','grid')}
      ${_navItem('gm-clients','Clients','users')}
      ${_navItem('gm-enquiries','Enquiries','mail')}
      ${_navItem('gm-trainers','Trainers','dumbbell')}
      ${_navItem('gm-attendance','Attendance','check')}
      ${_navItem('gm-salary','Salary','dollar')}
      ${_navItem('gm-revenue','Revenue','trending')}
      ${_navItem('gm-profile','Gym Profile','building')}
      ${_navItem('gm-maintenance','Maintenance','settings')}
      <a class="nav-item" onclick="handleLogout()" style="cursor:pointer;margin-top:auto">
        <span class="nav-icon">⏻</span><span>Logout</span>
      </a>`;
  } else if (role === 'receptionist') {
    nav.innerHTML = `
      ${_navItem('receptionist-dashboard','Dashboard','grid')}
      ${_navItem('gm-clients','Clients','users')}
      ${_navItem('gm-enquiries','Enquiries','mail')}
      ${_navItem('gm-trainers','Trainers','dumbbell')}
      ${_navItem('gm-attendance','Attendance','check')}
      <a class="nav-item" onclick="handleLogout()" style="cursor:pointer;margin-top:auto">
        <span class="nav-icon">⏻</span><span>Logout</span>
      </a>`;
  }

  /* Re-bind nav clicks */
  nav.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });
}

function _navItem(page, label, icon) {
  const icons = {
    grid:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    users:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    mail:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12"/></svg>`,
    check:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    dollar:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
    trending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
  };
  return `<a class="nav-item" data-page="${page}"><span class="nav-icon">${icons[icon] || ''}</span><span>${label}</span></a>`;
}

/* ============================================
   INJECT GYM MANAGEMENT PAGES INTO DOM
   Called once on app boot
   ============================================ */

function injectGymPages() {
  const main = document.getElementById('main-content');
  if (!main || document.getElementById('page-owner-dashboard')) return;

  const pages = [
    'owner-dashboard', 'receptionist-dashboard',
    'gm-clients', 'gm-enquiries', 'gm-trainers',
    'gm-attendance', 'gm-salary', 'gm-revenue',
    'gm-profile', 'gm-maintenance'
  ];
  pages.forEach(id => {
    const sec = document.createElement('section');
    sec.className = 'page';
    sec.id = 'page-' + id;
    main.appendChild(sec);
  });
}

/* ============================================
   ROLE-BASED LAUNCH
   Called from auth.js after sign-in
   ============================================ */

async function launchGymRole(user) {
  try {
    /* Check Firestore for gym role */
    const snap = await db.collection('users').doc(user.uid).get();
    const data = snap.exists ? snap.data() : {};
    const role = data.profile?.gymRole || data.gymRole || null;
    const gymId = data.profile?.gymId  || data.gymId  || null;

    if (role === 'owner' || role === 'receptionist') {
      setGymRole(role);
      if (gymId) setGymId(gymId);

      /* Inject pages and build sidebar */
      injectGymPages();
      buildGymSidebar(role);

      /* Update mobile brand */
      const mb = document.querySelector('.mobile-brand');
      if (mb) mb.innerHTML = '<span style="color:#e01c1c">OG</span> FITNESS';

      /* Hide bottom nav (not needed for staff) */
      const bn = document.querySelector('.bottom-nav');
      if (bn) bn.style.display = 'none';

      /* Navigate to correct dashboard */
      navigateTo(role === 'owner' ? 'owner-dashboard' : 'receptionist-dashboard');
      return true;
    }
  } catch (e) {
    console.error('launchGymRole:', e);
  }
  return false; /* Not a gym staff — proceed as normal client */
}
