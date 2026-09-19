/* ============================================================
   Timmo — adaptateur Firebase (OPTIONNEL, désactivé par défaut)
   ------------------------------------------------------------
   Pour activer un vrai stockage Firebase à la place du localStorage :

   1. Ajoutez ces deux balises script dans le <head> de chaque page
      HTML, AVANT js/firebase-config.js et js/db.js :

      <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>

   2. Renseignez vos identifiants de projet ci-dessous (console
      Firebase -> Paramètres du projet -> Général -> Vos apps ->
      Configuration du SDK).

   3. Dans js/db.js, définissez :  const TI_BACKEND = "firebase";

   Tout le reste (toutes les pages, tout le code d'interface) continue
   de fonctionner sans changement, car il n'appelle jamais que les
   méthodes TiDB.* dans js/db.js.
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
