/* ============================================
   THE GYM RATS — firebase.js
   Firebase Initialization
   CDN compat mode — works on GitHub Pages
   No Node.js / bundler required
   ============================================ */

const firebaseConfig = {
  apiKey:            "AIzaSyBH8PCRdfvOpKsX934a_QFQsTEl-KBDoIA",
  authDomain:        "the-gym-rats.firebaseapp.com",
  projectId:         "the-gym-rats",
  storageBucket:     "the-gym-rats.firebasestorage.app",
  messagingSenderId: "561724636847",
  appId:             "1:561724636847:web:22d473556c71f666a69e5a",
  measurementId:     "G-Q8GRXKV0LZ"
};

/* Initialize Firebase app */
firebase.initializeApp(firebaseConfig);

/* Export shared instances — used across all modules */
const db   = firebase.firestore();
const auth = firebase.auth();

/* Enable Firestore offline persistence so app works without internet */
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition') {
      /* Multiple tabs open — persistence only works in one tab at a time */
      console.warn('Firestore persistence unavailable: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence not supported in this browser.');
    }
  });

/* Google Auth Provider */
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

console.log('[GymRats] Firebase initialized — project: the-gym-rats');
