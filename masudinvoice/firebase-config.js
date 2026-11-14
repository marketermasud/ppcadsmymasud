/* =========================================================
   firebase-config.js
   ---------------------------------------------------------
   Same Firebase project as before (masudppcinvoice). This is
   the public client-side config — it is not a secret.

   Sign-in uses Firebase Authentication (Email/Password).
   Create your own user once in Firebase Console →
   Authentication → Users → Add user. See README.md.
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCWtobSJBiUXmdgQli0Ve1oM-h1myl4ObE",
  authDomain: "masudppcinvoice.firebaseapp.com",
  projectId: "masudppcinvoice",
  storageBucket: "masudppcinvoice.firebasestorage.app",
  messagingSenderId: "88902990829",
  appId: "1:88902990829:web:c4a284fa28544f5bfe85e4"
};

let db = null;
let fbAuth = null;
let firebaseEnabled = false;
try {
  if (typeof firebase !== "undefined" && firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf("YOUR_") !== 0) {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    fbAuth = firebase.auth();
    firebaseEnabled = true;
  }
} catch (e) { console.warn("Firebase not initialized:", e); firebaseEnabled = false; }
