/* ============================================
   THE GYM RATS — auth.js
   Firebase Authentication
   Email/Password + Google Sign-In
   Replaces the localStorage username/password system
   ============================================ */

/* ============================================
   AUTH STATE OBSERVER
   Runs once on every page load.
   Decides whether to show login or app.
   ============================================ */

/* ============================================
   CREATOR DETECTION — by UID or email
   (declared first so _onSignedIn can use them)
   ============================================ */

const CREATOR_EMAIL = 'nikhilkarthik@gmail.com'; /* creator identity */
const CREATOR_UID_KEY = 'gymrats_creator_uid';

function isCreatorEmail(email) {
  return email && email.toLowerCase() === CREATOR_EMAIL.toLowerCase();
}

function isCreatorUid(uid) {
  const stored = localStorage.getItem(CREATOR_UID_KEY);
  if (stored && stored === uid) return true;
  const email = localStorage.getItem('gymrats_email') || '';
  return isCreatorEmail(email);
}

function isCreator() {
  const user = auth.currentUser;
  if (!user) return false;
  return isCreatorEmail(user.email) || isCreatorUid(user.uid);
}

/* ============================================
   AUTH STATE OBSERVER
   ============================================ */

auth.onAuthStateChanged(async user => {
  if (user) {
    await _onSignedIn(user);
  } else {
    _onSignedOut();
  }
});

async function _onSignedIn(user) {
  /* 1. Store uid as session — MUST happen before loadData() is called */
  localStorage.setItem('gymrats_session', user.uid);
  localStorage.setItem('gymrats_uid',     user.uid);
  localStorage.setItem('gymrats_email',   user.email || '');

  /* Store creator UID so isCreatorUid() works immediately */
  if (isCreatorEmail(user.email)) {
    localStorage.setItem(CREATOR_UID_KEY, user.uid);
  }

  /* 2. Ensure user document exists in Firestore */
  await _ensureUserDoc(user);

  /* 3. Check maintenance mode from Firestore */
  const maintOn = await fs_getMaintenanceMode();
  const creator  = isCreatorUid(user.uid);

  if (maintOn && !creator) {
    auth.signOut();
    _showMaintenanceScreen();
    return;
  }

  /* 4. Sync local data to Firestore only if there is meaningful local data
        AND this user has never synced before — prevents overwriting Firestore
        with another user's stale localStorage data */
  if (!(await fs_hasSynced())) {
    const localData = loadData();
    const hasLocalData = (localData.workouts && localData.workouts.length > 0) ||
                         (localData.membership && localData.membership.length > 0) ||
                         (localData.supplements && localData.supplements.length > 0);
    if (hasLocalData) {
      await fs_syncLocalToFirestore();
    } else {
      /* Mark as synced so we don't attempt again */
      localStorage.setItem('gymrats_synced_' + user.uid, 'true');
    }
  }

  /* 5. Set online status */
  await fs_updateStatus(user.uid, 'online', null);

  /* 6. Launch app */
  _hideAuthScreen();

  /* Check if gym staff (owner/receptionist) — if so, launch gym dashboard */
  if (typeof launchGymRole === 'function') {
    const isStaff = await launchGymRole(user);
    if (isStaff) return;
  }

  init();
}

function _onSignedOut() {
  /* Always clear session keys so the next user gets a clean state */
  localStorage.removeItem('gymrats_session');
  localStorage.removeItem('gymrats_uid');
  localStorage.removeItem('gymrats_email');
  localStorage.removeItem('gymrats_explicit_logout');
  /* Show hero/login screen */
  const screen = document.getElementById('auth-screen');
  if (screen) screen.style.display = '';
  if (typeof applyMaintenanceToLoginScreen === 'function') applyMaintenanceToLoginScreen();
}

/* ============================================
   ENSURE USER DOCUMENT IN FIRESTORE
   ============================================ */

async function _ensureUserDoc(user) {
  try {
    const ref  = db.collection('users').doc(user.uid);
    const snap = await ref.get();

    if (!snap.exists) {
      /* New user — create document */
      const profile = {
        uid:       user.uid,
        name:      user.displayName || user.email.split('@')[0],
        email:     user.email,
        photoURL:  user.photoURL || null,
        role:      isCreatorEmail(user.email) ? 'creator' : 'user',
        createdAt: new Date().toISOString()
      };
      await ref.set({ profile });
      /* Also save to local cache */
      setData('profile', { name: profile.name, avatar: 'GR', goal: 'Muscle Gain' });
    } else {
      /* Existing user — load profile to local cache */
      const data = snap.data();
      if (data.profile) {
        const local = loadData();
        if (!local.profile.name) {
          local.profile.name = data.profile.name || '';
          saveData(local);
        }
      }
    }
  } catch (e) {
    console.error('_ensureUserDoc:', e);
  }
}

/* isCreator, isCreatorEmail, isCreatorUid, CREATOR_EMAIL, CREATOR_UID_KEY
   are declared at the top of this file */

/* ============================================
   EMAIL / PASSWORD LOGIN
   ============================================ */

async function handleLogin() {
  const emailOrUser = document.getElementById('login-user').value.trim();
  const pass        = document.getElementById('login-pass').value;
  const err         = document.getElementById('login-error');
  err.style.color   = '';
  err.textContent   = '';

  if (!emailOrUser || !pass) {
    err.textContent = 'Please fill in all fields.';
    return;
  }

  /* Accept email or username — if no @ treat as email prefix */
  const email = emailOrUser.includes('@') ? emailOrUser : emailOrUser + '@gymrats.app';

  const btn = document.getElementById('btn-login');
  btn.classList.add('loading');
  btn.textContent = 'SIGNING IN...';

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    /* onAuthStateChanged handles the rest */
  } catch (e) {
    btn.classList.remove('loading');
    btn.innerHTML = '<span class="auth-btn-shine"></span>LOGIN &rarr;';
    err.textContent = _friendlyAuthError(e.code);
  }
}

/* ============================================
   EMAIL / PASSWORD SIGNUP
   ============================================ */

async function handleSignup() {
  const name    = document.getElementById('signup-name').value.trim();
  const user    = document.getElementById('signup-user').value.trim();
  const pass    = document.getElementById('signup-pass').value;
  const confirm = document.getElementById('signup-confirm').value;
  const err     = document.getElementById('signup-error');
  err.style.color = '';
  err.textContent = '';

  if (!name || !user || !pass || !confirm) { err.textContent = 'Please fill in all fields.'; return; }
  if (pass.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  if (pass !== confirm) { err.textContent = 'Passwords do not match.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(user)) { err.textContent = 'Username: letters, numbers, _ only.'; return; }

  /* Use username@gymrats.app as the Firebase email */
  const email = user + '@gymrats.app';

  const btn = document.getElementById('btn-signup');
  btn.classList.add('loading');
  btn.textContent = 'CREATING...';

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    /* Update display name */
    await cred.user.updateProfile({ displayName: name });
    /* onAuthStateChanged handles the rest */
  } catch (e) {
    btn.classList.remove('loading');
    btn.innerHTML = '<span class="auth-btn-shine"></span>CREATE ACCOUNT &rarr;';
    err.textContent = _friendlyAuthError(e.code);
  }
}

/* ============================================
   GOOGLE SIGN-IN
   ============================================ */

async function handleGoogleLogin() {
  const btn = document.getElementById('btn-google-login');
  if (btn) {
    btn.disabled     = true;
    btn.textContent  = 'Signing in with Google...';
  }

  try {
    await auth.signInWithPopup(googleProvider);
    /* onAuthStateChanged handles the rest */
  } catch (e) {
    console.error('Google sign-in error:', e.code, e.message);
    if (btn) {
      btn.disabled = false;
      /* Restore the full branded button content */
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>Continue with Google</span>`;
    }
    const err = document.getElementById('login-error');
    if (err) {
      if (e.code === 'auth/unauthorized-domain') {
        err.textContent = 'Domain not authorized. Contact the app admin.';
      } else if (e.code === 'auth/popup-blocked') {
        err.textContent = 'Popup was blocked. Please allow popups for this site.';
      } else {
        err.textContent = _friendlyAuthError(e.code);
      }
    }
  }
}

/* ============================================
   LOGOUT
   ============================================ */

async function handleLogout() {
  const uid = getCurrentUid();
  if (uid) await fs_updateStatus(uid, 'offline', null).catch(() => {});
  localStorage.setItem('gymrats_explicit_logout', 'true');
  await auth.signOut();
  localStorage.removeItem('gymrats_session');
  localStorage.removeItem('gymrats_uid');
  location.reload();
}

/* ============================================
   FORGOT PASSWORD
   ============================================ */

async function handleForgot() {
  const emailOrUser = document.getElementById('login-user').value.trim();
  const err = document.getElementById('login-error');

  if (!emailOrUser) {
    err.textContent = 'Enter your email or username first.';
    return;
  }

  const email = emailOrUser.includes('@') ? emailOrUser : emailOrUser + '@gymrats.app';

  try {
    await auth.sendPasswordResetEmail(email);
    err.style.color   = '#22c55e';
    err.textContent   = 'Password reset email sent! Check your inbox.';
    setTimeout(() => { err.style.color = ''; err.textContent = ''; }, 5000);
  } catch (e) {
    err.textContent = _friendlyAuthError(e.code);
  }
}

/* ============================================
   CHANGE PASSWORD (from Settings)
   ============================================ */

async function handleChangePassword(current, newPw) {
  const user = auth.currentUser;
  if (!user) return { ok: false, msg: 'Not signed in.' };

  try {
    /* Re-authenticate first */
    const email = user.email;
    const cred  = firebase.auth.EmailAuthProvider.credential(email, current);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(newPw);
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: _friendlyAuthError(e.code) };
  }
}

/* ============================================
   SESSION HELPERS — keep compatible with old code
   ============================================ */

function getSession() {
  const user = auth.currentUser;
  return user ? user.uid : localStorage.getItem('gymrats_session');
}

function getSessionName() {
  const user = auth.currentUser;
  if (user) return user.displayName || user.email.split('@')[0];
  return localStorage.getItem('gymrats_session') || 'Athlete';
}

function clearSession() {
  handleLogout();
}

/* ============================================
   UI HELPERS
   ============================================ */

function _hideAuthScreen() {
  /* Close auth modal overlay */
  const overlay = document.getElementById('auth-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  /* Fade out hero screen */
  const screen = document.getElementById('auth-screen');
  if (screen) {
    screen.style.transition = 'opacity 0.5s ease';
    screen.style.opacity    = '0';
    setTimeout(() => {
      screen.style.display    = 'none';
      screen.style.opacity    = '';
      screen.style.transition = '';
    }, 500);
  }
}

function _showMaintenanceScreen() {
  applyMaintenanceToLoginScreen();
}

/* ============================================
   FRIENDLY ERROR MESSAGES
   ============================================ */

function _friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':       'Account not found. Check your username.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'Username already taken.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/invalid-email':        'Invalid email format.',
    'auth/too-many-requests':    'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/popup-closed-by-user': 'Sign-in cancelled.',
    'auth/cancelled-popup-request': 'Sign-in cancelled.',
    'auth/requires-recent-login': 'Please log in again to change your password.'
  };
  return map[code] || 'Something went wrong. Please try again.';
}

/* ============================================
   OVERRIDE btn-logout to use Firebase signOut
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      showModal('Logout', 'Are you sure you want to logout?', 'Logout', handleLogout);
    };
  }

  /* Override pw-change-form to use Firebase */
  const pwForm = document.getElementById('pw-change-form');
  if (pwForm) {
    pwForm.onsubmit = async function(e) {
      e.preventDefault();
      const current = document.getElementById('pw-current').value;
      const newPw   = document.getElementById('pw-new').value;
      const confirm = document.getElementById('pw-confirm').value;
      const errEl   = document.getElementById('pw-change-error');
      errEl.textContent = '';
      if (newPw.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
      if (newPw !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }
      const result = await handleChangePassword(current, newPw);
      if (result.ok) {
        showToast('Password updated!', 'success');
        this.reset();
      } else {
        errEl.textContent = result.msg;
      }
    };
  }
});
