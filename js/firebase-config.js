/* ============================================================
   Timmo — Firebase adapter (OPTIONAL, disabled by default)
   ------------------------------------------------------------
   To activate real Firebase storage instead of localStorage:

   1. Add these two script tags to the <head> of every HTML page,
      BEFORE js/firebase-config.js and js/db.js:

      <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>

   2. Fill in your project credentials below (Firebase console ->
      Project settings -> General -> Your apps -> SDK setup).

   3. In js/db.js, set:  const TI_BACKEND = "firebase";

   Everything else (all pages, all UI code) keeps working unchanged
   because they only ever call the TiDB.* methods in js/db.js.
   ============================================================ */

const TI_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx",
};

let tiFirestore = null;
let tiAuth = null;

if (typeof firebase !== "undefined" && TI_FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
  firebase.initializeApp(TI_FIREBASE_CONFIG);
  tiFirestore = firebase.firestore();
  tiAuth = firebase.auth();
}

async function tiFirestoreGetAll(collection) {
  const snap = await tiFirestore.collection(collection).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function tiFirestoreAdd(collection, obj) {
  if (obj.id) {
    await tiFirestore.collection(collection).doc(obj.id).set(obj, { merge: true });
    return obj;
  }
  const ref = await tiFirestore.collection(collection).add(obj);
  return { id: ref.id, ...obj };
}
async function tiFirestoreDelete(collection, id) {
  await tiFirestore.collection(collection).doc(id).delete();
}
