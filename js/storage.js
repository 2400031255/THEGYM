/* ============================================
   THE GYM RATS — storage.js
   LocalStorage Data Engine
   ============================================ */

const DB_KEY = 'gymrats_v1';

const DEFAULT_DATA = {
  profile: { name: '', avatar: 'GR', goal: 'Muscle Gain' },
  membership: [],
  workouts: [],
  exercises: {},       // { exerciseName: { bestWeight, bestReps, history[] } }
  supplements: [],
  suppUsage: [],       // { suppId, date, qty, remaining, extra }
  expenses: [],
  friends: [],
  challenges: [],
  progress: [],        // body metrics log
  notifications: []
};

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
    const parsed = JSON.parse(raw);
    // merge missing keys from default
    return Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_DATA)), parsed);
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData(data) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Storage save failed:', e);
    return false;
  }
}

function getData(key) {
  return loadData()[key];
}

function setData(key, value) {
  const data = loadData();
  data[key] = value;
  saveData(data);
}

function addRecord(key, record) {
  const data = loadData();
  record.id = record.id || generateId();
  record.createdAt = record.createdAt || new Date().toISOString();
  data[key].push(record);
  saveData(data);
  return record;
}

function updateRecord(key, id, updates) {
  const data = loadData();
  const idx = data[key].findIndex(r => r.id === id);
  if (idx === -1) return false;
  data[key][idx] = Object.assign({}, data[key][idx], updates);
  saveData(data);
  return true;
}

function deleteRecord(key, id) {
  const data = loadData();
  data[key] = data[key].filter(r => r.id !== id);
  saveData(data);
}

function clearAllData() {
  localStorage.removeItem(DB_KEY);
}

function exportData() {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gymrats-backup-${formatDateFile(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object') throw new Error('Invalid format');
    saveData(parsed);
    return true;
  } catch (e) {
    return false;
  }
}

/* ============================================
   CALCULATED HELPERS
   ============================================ */

function calculateMembershipDays(endDate) {
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const now = new Date();
  const diff = Math.floor((end - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function calculateMembershipProgress(startDate, endDate) {
  const start = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();
  const now   = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

function calculateSupplementRemaining(suppId) {
  const data = loadData();
  const supp = data.supplements.find(s => s.id === suppId);
  if (!supp) return 0;
  const usages = data.suppUsage.filter(u => u.suppId === suppId);
  const totalConsumed = usages.reduce((sum, u) => sum + u.qty, 0);
  return Math.max(0, supp.initialQty - totalConsumed);
}

function calculateEstimatedServings(suppId) {
  const remaining = calculateSupplementRemaining(suppId);
  const data = loadData();
  const supp = data.supplements.find(s => s.id === suppId);
  if (!supp || supp.servingSize <= 0) return 0;
  return Math.floor(remaining / supp.servingSize);
}

function calculateEstimatedDays(suppId) {
  const remaining = calculateSupplementRemaining(suppId);
  const data = loadData();
  const supp = data.supplements.find(s => s.id === suppId);
  if (!supp || supp.servingSize <= 0 || supp.servingsPerDay <= 0) return 0;
  return Math.floor(remaining / (supp.servingSize * supp.servingsPerDay));
}

function getSupplementStatus(remaining, servingSize) {
  if (remaining <= 0)                        return { label: 'FINISHED',     cls: 'status-finished', icon: '&#10005;' };
  if (remaining < servingSize)               return { label: 'LAST SERVING', cls: 'status-last',     icon: '&#9679;' };
  if (remaining <= servingSize * 3)          return { label: 'VERY LOW',     cls: 'status-verylow',  icon: '&#9679;' };
  if (remaining <= servingSize * 10)         return { label: 'LOW',          cls: 'status-low',      icon: '&#9679;' };
  return                                            { label: 'GOOD',         cls: 'status-good',     icon: '&#9679;' };
}

function hasTakenTodayScoop(suppId) {
  const today = formatDateISO(new Date());
  const data = loadData();
  return data.suppUsage.some(u => u.suppId === suppId && u.date === today && !u.extra);
}

function calculateWorkoutStreak() {
  const workouts = getData('workouts');
  if (!workouts.length) return { current: 0, longest: 0 };
  const dates = [...new Set(workouts.map(w => w.date))].sort().reverse();
  let current = 0, longest = 0, streak = 0;
  const today = formatDateISO(new Date());
  const yesterday = formatDateISO(new Date(Date.now() - 86400000));
  let prev = null;
  for (const d of dates) {
    if (!prev) {
      if (d === today || d === yesterday) { streak = 1; }
      else break;
    } else {
      const diff = (new Date(prev) - new Date(d)) / 86400000;
      if (diff === 1) streak++;
      else break;
    }
    prev = d;
  }
  current = streak;
  // longest streak
  let ls = 1, lsCur = 1;
  const allDates = [...new Set(workouts.map(w => w.date))].sort();
  for (let i = 1; i < allDates.length; i++) {
    const diff = (new Date(allDates[i]) - new Date(allDates[i-1])) / 86400000;
    if (diff === 1) { lsCur++; ls = Math.max(ls, lsCur); }
    else lsCur = 1;
  }
  longest = Math.max(ls, current);
  return { current, longest };
}

function calculateExpenseSplit(amount, memberCount) {
  if (!memberCount || memberCount <= 0) return 0;
  return Math.round((amount / memberCount) * 100) / 100;
}

/* ============================================
   UTILITIES
   ============================================ */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDateISO(date) {
  return date.toISOString().split('T')[0];
}

function formatDateFile(date) {
  return formatDateISO(date).replace(/-/g, '');
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
