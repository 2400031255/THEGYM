/* ============================================================
   THE GYM RATS — squadService.js
   Gym Squad Service Layer — Firestore Real-Time Backend

   All squad data is stored in Firestore.
   Real-time listeners update the UI automatically.
   LocalStorage is used only as offline cache.
   ============================================================ */

const SQUAD_PRIVACY_KEY = 'gymrats_squad_privacy';

const DEFAULT_PRIVACY = {
  showWorkoutActivity: true,
  showWorkoutStreak:   true,
  showCurrentWorkout:  true,
  showMembership:      false,
  showSupplements:     false,
  showProgress:        false,
  showPRs:             true,
  showOnlineStatus:    true
};

/* Active real-time listeners — stored so we can unsubscribe */
const _squadListeners = {};

/* ============================================================
   CREATE SQUAD
   ============================================================ */

async function squadService_createSquad(name) {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated — please log in again.');

  const ref   = db.collection('squads').doc();
  const code  = _generateSquadCode();
  const squad = {
    id:        ref.id,
    name:      name.trim(),
    code:      code,
    createdBy: uid,
    createdAt: new Date().toISOString(),
    members:   [uid]
  };

  /* Core write — must succeed */
  await ref.set(squad);

  /* Subcollection writes — best effort, don't block squad creation */
  await ref.collection('members').doc(uid).set({
    uid,
    joinedAt: new Date().toISOString(),
    role: 'creator'
  }).catch(e => console.warn('members subcollection write failed:', e));

  squadService_logActivity(squad.id, 'squad_created', `created the squad "${squad.name}"`)
    .catch(e => console.warn('activity log failed:', e));

  return squad;
}

/* ============================================================
   JOIN SQUAD
   ============================================================ */

async function squadService_joinSquad(code) {
  const uid  = getCurrentUid();
  const norm = code.toUpperCase().trim();

  /* Query by code field — avoids full collection scan */
  const snap = await db.collection('squads').where('code', '==', norm).limit(1).get();
  if (snap.empty) return { ok: false, msg: 'Squad not found. Check the code and try again.' };

  const squad = { id: snap.docs[0].id, ...snap.docs[0].data() };
  if (squad.members && squad.members.includes(uid)) return { ok: false, msg: 'You are already in this squad.' };

  /* Add uid to members array */
  await db.collection('squads').doc(squad.id).update({
    members: firebase.firestore.FieldValue.arrayUnion(uid)
  });

  /* Add member document */
  await db.collection('squads').doc(squad.id)
    .collection('members').doc(uid).set({
      uid,
      joinedAt: new Date().toISOString(),
      role: 'member'
    });

  await squadService_logActivity(squad.id, 'member_joined', `joined the squad`);
  return { ok: true, squad };
}

/* ============================================================
   LEAVE SQUAD
   ============================================================ */

async function squadService_leaveSquad(squadId) {
  const uid = getCurrentUid();
  await db.collection('squads').doc(squadId).update({
    members: firebase.firestore.FieldValue.arrayRemove(uid)
  });
  await db.collection('squads').doc(squadId)
    .collection('members').doc(uid).delete();
}

/* ============================================================
   GET MY SQUADS
   ============================================================ */

async function squadService_getMySquads() {
  const uid  = getCurrentUid();
  if (!uid) return [];
  try {
    const snap = await db.collection('squads')
      .where('members', 'array-contains', uid)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('squadService_getMySquads:', e);
    return [];
  }
}

/* ============================================================
   GET SQUAD MEMBERS — with full profiles
   ============================================================ */

async function squadService_getSquadMembers(squadId) {
  try {
    const squadSnap = await db.collection('squads').doc(squadId).get();
    if (!squadSnap.exists) return [];
    const squad   = squadSnap.data();
    const members = squad.members || [];

    const profiles = await Promise.all(members.map(uid => _buildMemberProfile(uid)));
    return profiles.filter(Boolean);
  } catch (e) {
    console.error('squadService_getSquadMembers:', e);
    return [];
  }
}

async function _buildMemberProfile(uid) {
  try {
    const myUid   = getCurrentUid();
    const isMe    = uid === myUid;
    const privacy = squadService_getPrivacy(uid);

    /* Get user profile from Firestore */
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const profile  = userData.profile || {};

    /* Get online status */
    const statusSnap = await db.collection('status').doc(uid).get();
    const statusData = statusSnap.exists ? statusSnap.data() : null;
    const onlineStatus = _parseOnlineStatus(statusData);

    const member = {
      uid,
      username:     uid,
      name:         profile.name || profile.email || uid,
      photoURL:     profile.photoURL || null,
      isMe,
      privacy,
      onlineStatus
    };

    /* Workout data */
    if (privacy.showWorkoutActivity || isMe) {
      let workouts = [];
      try {
        const wSnap = await db.collection('users').doc(uid).collection('workouts')
          .orderBy('date', 'desc').limit(20).get();
        workouts = wSnap.docs.map(d => d.data());
      } catch (e) {
        /* index may not exist yet — fetch without order */
        const wSnap = await db.collection('users').doc(uid).collection('workouts')
          .limit(20).get();
        workouts = wSnap.docs.map(d => d.data()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      }
      const thisMonth = new Date().toISOString().slice(0, 7);
      member.totalWorkouts  = workouts.length;
      member.monthWorkouts  = workouts.filter(w => w.date && w.date.startsWith(thisMonth)).length;
      member.recentWorkouts = workouts.slice(0, 5);
    }

    /* Streak */
    if (privacy.showWorkoutStreak || isMe) {
      if (isMe) {
        member.streak = calculateWorkoutStreak();
      } else {
        try {
          const wSnap2 = await db.collection('users').doc(uid).collection('workouts').get();
          const dates  = [...new Set(wSnap2.docs.map(d => d.data().date).filter(Boolean))].sort().reverse();
          member.streak = { current: _calcStreak(dates), longest: _calcStreak(dates) };
        } catch (e) {
          member.streak = { current: 0, longest: 0 };
        }
      }
    }

    /* Current workout from status */
    if (privacy.showCurrentWorkout || isMe) {
      if (statusData && statusData.status === 'training') {
        member.currentWorkout = { workoutName: statusData.workoutName, startedAt: statusData.ts?.toDate?.()?.toISOString() };
      }
    }

    /* Membership */
    if (privacy.showMembership || isMe) {
      const mSnap = await db.collection('users').doc(uid).collection('membership')
        .orderBy('createdAt', 'desc').limit(1).get();
      if (!mSnap.empty) {
        const m    = mSnap.docs[0].data();
        const days = calculateMembershipDays(m.endDate);
        member.membership = { gymName: m.gymName, daysLeft: Math.max(0, days), endDate: m.endDate };
      }
    }

    /* Supplements */
    if (privacy.showSupplements || isMe) {
      const sSnap = await db.collection('users').doc(uid).collection('supplements').get();
      const supps = sSnap.docs.map(d => d.data());
      if (supps.length) {
        const uSnap = await db.collection('users').doc(uid).collection('suppUsage').get();
        const usage = uSnap.docs.map(d => d.data());
        member.supplements = supps.map(s => {
          const used      = usage.filter(u => u.suppId === s.id).reduce((t, u) => t + (u.qty || 0), 0);
          const remaining = Math.max(0, (s.initialQty || 0) - used);
          const servings  = s.servingSize > 0 ? Math.floor(remaining / s.servingSize) : 0;
          return { name: s.name, unit: s.unit, remaining, servings, servingSize: s.servingSize };
        });
      }
    }

    /* PRs */
    if (privacy.showPRs || isMe) {
      const eSnap = await db.collection('users').doc(uid).collection('exercises').get();
      member.prCount = eSnap.size;
      const prs = {};
      eSnap.docs.forEach(d => { prs[d.id] = d.data(); });
      member.prs = prs;
    }

    /* Progress */
    if (privacy.showProgress || isMe) {
      const pSnap = await db.collection('users').doc(uid).collection('progress')
        .orderBy('date', 'desc').limit(1).get();
      if (!pSnap.empty) member.latestProgress = pSnap.docs[0].data();
    }

    return member;
  } catch (e) {
    console.error('_buildMemberProfile:', e, uid);
    return null;
  }
}

/* ============================================================
   ACTIVITY FEED
   ============================================================ */

async function squadService_logActivity(squadId, type, text, extra) {
  const uid = getCurrentUid();
  if (!uid || !squadId) return;
  try {
    const ref = db.collection('squads').doc(squadId).collection('activity').doc();
    await ref.set({
      id:      ref.id,
      type,
      text,
      uid,
      extra:   extra || null,
      ts:      firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('squadService_logActivity:', e);
  }
}

async function squadService_getSquadActivity(squadId) {
  try {
    const snap = await db.collection('squads').doc(squadId).collection('activity')
      .orderBy('ts', 'desc').limit(30).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('squadService_getSquadActivity:', e);
    return [];
  }
}

function squadService_listenActivity(squadId, callback) {
  return db.collection('squads').doc(squadId).collection('activity')
    .orderBy('ts', 'desc').limit(30)
    .onSnapshot(snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

/* ============================================================
   ONLINE / TRAINING STATUS
   ============================================================ */

async function squadService_updateStatus(status, workoutName) {
  const uid = getCurrentUid();
  if (!uid) return;
  await fs_updateStatus(uid, status, workoutName);
}

function _parseOnlineStatus(s) {
  if (!s) return { status: 'offline', label: 'Offline', dot: '⚫' };
  const ts     = s.ts?.toDate ? s.ts.toDate() : new Date(s.ts || 0);
  const minAgo = (Date.now() - ts.getTime()) / 60000;
  if (s.status === 'training') return { status: 'training', label: 'Training Today', dot: '🟢', workoutName: s.workoutName };
  if (minAgo < 15)  return { status: 'online',  label: 'Online',          dot: '🟢' };
  if (minAgo < 120) return { status: 'recent',  label: 'Recently Active', dot: '🟡' };
  return               { status: 'offline', label: 'Offline',         dot: '⚫' };
}

/* ============================================================
   SQUAD NOTIFICATIONS
   ============================================================ */

async function squadService_getSquadNotifications(squadId) {
  try {
    const snap = await db.collection('squads').doc(squadId).collection('notifications')
      .orderBy('ts', 'desc').limit(20).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
}

async function squadService_postNotification(squadId, text, type) {
  const uid = getCurrentUid();
  try {
    await db.collection('squads').doc(squadId).collection('notifications').add({
      text,
      type:  type || 'info',
      from:  uid,
      ts:    firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('squadService_postNotification:', e);
  }
}

/* ============================================================
   SQUAD CHALLENGES
   ============================================================ */

async function squadService_getSquadChallenges(squadId) {
  try {
    const snap = await db.collection('squads').doc(squadId).collection('challenges').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return getData('challenges').filter(c => c.squadId === squadId);
  }
}

async function squadService_createSquadChallenge(squadId, data) {
  const record = {
    ...data,
    squadId,
    current:   0,
    createdBy: getCurrentUid(),
    createdAt: new Date().toISOString()
  };
  const ref = db.collection('squads').doc(squadId).collection('challenges').doc();
  record.id = ref.id;
  await ref.set(record);
  return record;
}

/* ============================================================
   PRIVACY — stored per-user in localStorage
   (privacy prefs are personal, not synced to Firestore)
   ============================================================ */

function squadService_getPrivacy(uid) {
  try {
    const key = SQUAD_PRIVACY_KEY + '_' + (uid || getCurrentUid());
    const raw = localStorage.getItem(key);
    return Object.assign({}, DEFAULT_PRIVACY, raw ? JSON.parse(raw) : {});
  } catch { return Object.assign({}, DEFAULT_PRIVACY); }
}

function squadService_savePrivacy(settings) {
  const key = SQUAD_PRIVACY_KEY + '_' + getCurrentUid();
  localStorage.setItem(key, JSON.stringify(settings));
}

/* ============================================================
   SQUAD STATS
   ============================================================ */

async function squadService_getSquadStats(squadId) {
  const members = await squadService_getSquadMembers(squadId);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const stats   = { total: members.length, trainingToday: 0, activeThisWeek: 0, onTenPlusStreak: 0, membershipsExpiring: 0, supplementsLow: 0 };

  members.forEach(m => {
    if (m.onlineStatus.status === 'training') stats.trainingToday++;
    if (m.recentWorkouts && m.recentWorkouts.some(w => w.date >= weekAgo)) stats.activeThisWeek++;
    if (m.streak && m.streak.current >= 10) stats.onTenPlusStreak++;
    if (m.membership && m.membership.daysLeft <= 7) stats.membershipsExpiring++;
    if (m.supplements && m.supplements.some(s => s.remaining < s.servingSize * 10)) stats.supplementsLow++;
  });

  return stats;
}

/* ============================================================
   LEADERBOARD
   ============================================================ */

async function squadService_getLeaderboard(squadId, tab) {
  const members = await squadService_getSquadMembers(squadId);
  return members.map(m => {
    let value = 0, label = '';
    if (tab === 'workouts') { value = m.totalWorkouts || 0; label = value + ' Workouts'; }
    else if (tab === 'streak') { value = (m.streak && m.streak.current) || 0; label = value + ' Day Streak'; }
    else if (tab === 'prs') { value = m.prCount || 0; label = value + ' PRs'; }
    return { uid: m.uid, name: m.name, value, label, isMe: m.isMe };
  }).sort((a, b) => b.value - a.value);
}

/* ============================================================
   REAL-TIME LISTENERS — for squad page live updates
   ============================================================ */

function squadService_listenSquad(squadId, callback) {
  return db.collection('squads').doc(squadId).onSnapshot(snap => {
    if (snap.exists) callback({ id: snap.id, ...snap.data() });
  });
}

function squadService_listenMembers(squadId, callback) {
  return db.collection('squads').doc(squadId).collection('members')
    .onSnapshot(async () => {
      const members = await squadService_getSquadMembers(squadId);
      callback(members);
    });
}

/* ============================================================
   INTERNAL HELPERS
   ============================================================ */

async function _loadAllSquads() {
  try {
    const snap = await db.collection('squads').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}

function _generateSquadCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function _calcStreak(sortedDatesDesc) {
  if (!sortedDatesDesc.length) return 0;
  const today     = formatDateISO(new Date());
  const yesterday = formatDateISO(new Date(Date.now() - 86400000));
  let streak = 0, prev = null;
  for (const d of sortedDatesDesc) {
    if (!prev) { if (d === today || d === yesterday) streak = 1; else break; }
    else { if ((new Date(prev) - new Date(d)) / 86400000 === 1) streak++; else break; }
    prev = d;
  }
  return streak;
}

function getMembershipStatusLabel(days) {
  if (days < 0)   return { label: 'EXPIRED',      cls: 'ms-expired' };
  if (days === 0) return { label: 'EXPIRES TODAY', cls: 'ms-expired' };
  if (days <= 6)  return { label: 'EXPIRES SOON',  cls: 'ms-expires-soon' };
  if (days <= 14) return { label: 'ENDING SOON',   cls: 'ms-ending-soon' };
  if (days <= 30) return { label: 'NORMAL',        cls: 'ms-normal' };
  return               { label: 'GOOD',           cls: 'ms-good' };
}
