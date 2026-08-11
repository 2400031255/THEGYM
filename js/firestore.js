/* ============================================
   THE GYM RATS — firestore.js
   Firestore Data Layer
   Replaces localStorage for all user data.
   LocalStorage is kept as offline cache only.
   ============================================

   COLLECTIONS STRUCTURE:
   ─────────────────────────────────────────
   users/{uid}                    — profile
   users/{uid}/workouts/{id}      — workouts
   users/{uid}/exercises/{name}   — PRs
   users/{uid}/supplements/{id}   — supplements
   users/{uid}/suppUsage/{id}     — supplement usage log
   users/{uid}/membership/{id}    — memberships
   users/{uid}/expenses/{id}      — expenses
   users/{uid}/progress/{id}      — body progress
   users/{uid}/challenges/{id}    — personal challenges
   users/{uid}/notifications/{id} — notifications

   squads/{squadId}               — squad document
   squads/{squadId}/members/{uid} — member presence
   squads/{squadId}/activity/{id} — activity feed
   squads/{squadId}/notifications/{id} — squad notifications
   squads/{squadId}/challenges/{id}    — squad challenges

   status/{uid}                   — online/training status (real-time)
   maintenance/config             — global maintenance mode
   ─────────────────────────────────────────
   ============================================ */

/* ============================================
   CURRENT USER UID
   ============================================ */

function getCurrentUid() {
  const user = auth.currentUser;
  return user ? user.uid : null;
}

function userCol(sub) {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated');
  return db.collection('users').doc(uid).collection(sub);
}

function userDoc() {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated');
  return db.collection('users').doc(uid);
}

/* ============================================
   USER PROFILE
   ============================================ */

async function fs_getProfile() {
  try {
    const snap = await userDoc().get();
    return snap.exists ? snap.data().profile || {} : {};
  } catch (e) {
    console.error('fs_getProfile:', e);
    return getData('profile'); // fallback
  }
}

async function fs_saveProfile(profile) {
  try {
    await userDoc().set({ profile }, { merge: true });
    setData('profile', profile); // keep local cache
  } catch (e) {
    console.error('fs_saveProfile:', e);
    setData('profile', profile);
  }
}

/* ============================================
   GENERIC COLLECTION HELPERS
   ============================================ */

async function fs_getCollection(colName) {
  try {
    const snap = await userCol(colName).orderBy('createdAt', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(`fs_getCollection(${colName}):`, e);
    return getData(colName) || [];
  }
}

async function fs_addRecord(colName, record) {
  try {
    record.id        = record.id        || generateId();
    record.createdAt = record.createdAt || new Date().toISOString();
    await userCol(colName).doc(record.id).set(record);
    return record;
  } catch (e) {
    console.error(`fs_addRecord(${colName}):`, e);
    return addRecord(colName, record); // fallback to localStorage
  }
}

async function fs_updateRecord(colName, id, updates) {
  try {
    await userCol(colName).doc(id).update(updates);
    return true;
  } catch (e) {
    console.error(`fs_updateRecord(${colName}):`, e);
    return updateRecord(colName, id, updates);
  }
}

async function fs_deleteRecord(colName, id) {
  try {
    await userCol(colName).doc(id).delete();
  } catch (e) {
    console.error(`fs_deleteRecord(${colName}):`, e);
    deleteRecord(colName, id);
  }
}

/* ============================================
   REAL-TIME LISTENER — subscribe to a user collection
   Returns unsubscribe function.
   ============================================ */

function fs_listen(colName, callback) {
  const uid = getCurrentUid();
  if (!uid) return () => {};
  return db.collection('users').doc(uid).collection(colName)
    .onSnapshot(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(docs);
    }, err => console.error(`fs_listen(${colName}):`, err));
}

/* ============================================
   EXERCISES / PRs
   ============================================ */

async function fs_getExercises() {
  try {
    const snap = await userCol('exercises').get();
    const result = {};
    snap.docs.forEach(d => { result[d.id] = d.data(); });
    return result;
  } catch (e) {
    return getData('exercises') || {};
  }
}

async function fs_saveExercise(name, data) {
  try {
    const safeKey = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    await userCol('exercises').doc(safeKey).set(data, { merge: true });
  } catch (e) {
    console.error('fs_saveExercise:', e);
  }
}

/* ============================================
   SUPPLEMENT USAGE
   ============================================ */

async function fs_getSuppUsage() {
  return fs_getCollection('suppUsage');
}

async function fs_addSuppUsage(record) {
  return fs_addRecord('suppUsage', record);
}

/* ============================================
   MAINTENANCE MODE — Global via Firestore
   ============================================ */

async function fs_getMaintenanceMode() {
  try {
    const snap = await db.collection('maintenance').doc('config').get();
    return snap.exists ? snap.data().enabled === true : false;
  } catch (e) {
    return getMaintenanceMode(); // fallback to localStorage
  }
}

async function fs_setMaintenanceMode(enabled) {
  try {
    await db.collection('maintenance').doc('config').set({
      enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: getCurrentUid()
    });
    setMaintenanceMode(enabled); // keep local in sync
  } catch (e) {
    console.error('fs_setMaintenanceMode:', e);
    setMaintenanceMode(enabled);
  }
}

function fs_listenMaintenanceMode(callback) {
  return db.collection('maintenance').doc('config')
    .onSnapshot(snap => {
      callback(snap.exists ? snap.data().enabled === true : false);
    }, err => console.error('fs_listenMaintenanceMode:', err));
}

/* ============================================
   ONLINE / TRAINING STATUS — Real-time
   ============================================ */

async function fs_updateStatus(uid, status, workoutName) {
  try {
    await db.collection('status').doc(uid).set({
      status,
      workoutName: workoutName || null,
      ts: firebase.firestore.FieldValue.serverTimestamp(),
      uid
    });
  } catch (e) {
    console.error('fs_updateStatus:', e);
  }
}

function fs_listenSquadStatuses(uids, callback) {
  if (!uids || !uids.length) return () => {};
  /* Firestore 'in' query supports max 10 items */
  const chunks = [];
  for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));

  const results = {};
  const unsubs  = chunks.map(chunk =>
    db.collection('status').where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
      .onSnapshot(snap => {
        snap.docs.forEach(d => { results[d.id] = d.data(); });
        callback({ ...results });
      })
  );
  return () => unsubs.forEach(u => u());
}

/* ============================================
   SYNC — Push all localStorage data to Firestore
   Called once after first Firebase login.
   ============================================ */

async function fs_syncLocalToFirestore() {
  const uid = getCurrentUid();
  if (!uid) return;

  const data = loadData();
  const batch = db.batch();

  /* Profile */
  if (data.profile && data.profile.name) {
    batch.set(db.collection('users').doc(uid), { profile: data.profile }, { merge: true });
  }

  /* Collections to migrate */
  const cols = ['workouts','supplements','suppUsage','membership','expenses','progress','challenges','notifications'];
  for (const col of cols) {
    const records = data[col] || [];
    for (const rec of records) {
      if (!rec.id) continue;
      batch.set(db.collection('users').doc(uid).collection(col).doc(rec.id), rec);
    }
  }

  /* Exercises object */
  const exercises = data.exercises || {};
  for (const [name, exData] of Object.entries(exercises)) {
    const safeKey = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    batch.set(db.collection('users').doc(uid).collection('exercises').doc(safeKey), exData);
  }

  try {
    await batch.commit();
    console.log('[GymRats] Local data synced to Firestore.');
    localStorage.setItem('gymrats_synced_' + uid, 'true');
  } catch (e) {
    console.error('fs_syncLocalToFirestore:', e);
  }
}

async function fs_hasSynced() {
  const uid = getCurrentUid();
  if (!uid) return false;
  return localStorage.getItem('gymrats_synced_' + uid) === 'true';
}
