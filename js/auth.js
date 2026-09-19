/* ============================================================
   Timmo — authentification (couche de session pour démo, peut être
   remplacée par Firebase Auth en branchant tiAuth depuis firebase-config.js)
   ============================================================ */

const TI_SESSION_KEY = "ti_session";

/* ---------- Hachage des mots de passe ----------
   SHA-256 avec un sel aléatoire par utilisateur, via l'API Web Crypto
   native du navigateur — aucun serveur disponible dans cette démo pour
   exécuter un vrai hachage de mot de passe.
   IMPORTANT : c'est une vraie amélioration par rapport au texte en clair,
   mais ce n'est PAS un substitut à bcrypt/argon2. Ces algorithmes sont
   volontairement lents et côté serveur, conçus pour résister aux attaques
   par force brute à grande échelle ; un hachage rapide et généraliste
   comme SHA-256 ne l'est pas. Un vrai backend doit hacher avec
   bcrypt/argon2 côté serveur — ceci protège seulement contre une
   exposition directe/occasionnelle des données de démo, par exemple
   quelqu'un lisant le localStorage. */
async function tiHashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + ":" + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function tiGenerateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}
/** Modifie l'objet utilisateur donné en place : remplace tout mot de passe
 *  en clair par un hachage salé. L'appelant est responsable de sauvegarder l'utilisateur. */
async function tiSetUserPassword(user, plainPassword) {
  user.passwordSalt = tiGenerateSalt();
  user.passwordHash = await tiHashPassword(plainPassword, user.passwordSalt);
  delete user.password;
}
/** Vérifie une tentative de connexion par rapport à un enregistrement utilisateur,
 *  en migrant discrètement les comptes en texte clair hérités (ex. données de
 *  démo initiales) vers un hachage salé dès leur première connexion réussie —
 *  un schéma classique de migration paresseuse, pour n'avoir besoin d'aucun
 *  script de migration ponctuel et ne jamais bloquer un compte à cause de
 *  cette mise à niveau. */
async function tiVerifyUserPassword(user, plainPassword) {
  if (user.password !== undefined) {
    const matches = user.password === plainPassword;
    if (matches) {
      await tiSetUserPassword(user, plainPassword);
      const all = tiLoad("ti_users", []);
      const idx = all.findIndex(u => u.id === user.id);
      if (idx !== -1) { all[idx] = user; tiSave("ti_users", all); }
    }
    return matches;
  }
  if (!user.passwordHash || !user.passwordSalt) return false;
  return (await tiHashPassword(plainPassword, user.passwordSalt)) === user.passwordHash;
}

/* ---------- Limitation du taux de connexion ----------
   Blocage progressif côté client par e-mail — arrête les tentatives
   occasionnelles/automatisées via l'interface. Ce n'est PAS un substitut
   à une vraie limitation côté serveur (un vrai backend doit toujours
   limiter au niveau réseau/API, par exemple via un WAF), puisqu'un
   attaquant déterminé peut simplement effacer le stockage local ; cela
   relève néanmoins le niveau pour le cas courant et donne un retour
   honnête à l'utilisateur en attendant. */
const TI_LOGIN_ATTEMPTS_KEY = "ti_login_attempts";
const TI_LOGIN_LOCKOUT_STEPS = [0, 0, 0, 15, 30, 60, 120, 300]; // secondes, selon le nombre de tentatives
function tiGetLoginAttemptState(email) {
  const all = tiLoad(TI_LOGIN_ATTEMPTS_KEY, {});
  return all[email.toLowerCase()] || { count: 0, lockedUntil: 0 };
}
function tiRegisterFailedLogin(email) {
  const all = tiLoad(TI_LOGIN_ATTEMPTS_KEY, {});
  const key = email.toLowerCase();
  const state = all[key] || { count: 0, lockedUntil: 0 };
  state.count += 1;
  const waitSeconds = TI_LOGIN_LOCKOUT_STEPS[Math.min(state.count, TI_LOGIN_LOCKOUT_STEPS.length - 1)];
  state.lockedUntil = waitSeconds > 0 ? Date.now() + waitSeconds * 1000 : 0;
  all[key] = state;
  tiSave(TI_LOGIN_ATTEMPTS_KEY, all);
  return state;
}
function tiClearLoginAttempts(email) {
  const all = tiLoad(TI_LOGIN_ATTEMPTS_KEY, {});
  delete all[email.toLowerCase()];
  tiSave(TI_LOGIN_ATTEMPTS_KEY, all);
}
/** Secondes restantes avant que cet e-mail puisse retenter une connexion, ou 0
 *  s'il n'est pas actuellement bloqué. */
function tiLoginLockoutRemaining(email) {
  const state = tiGetLoginAttemptState(email);
  const remaining = Math.ceil((state.lockedUntil - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

function tiGetSession() {
  return tiLoad("ti_session", null);
}
function tiSetSession(user) {
  tiSave("ti_session", user);
}
function tiLogout() {
  localStorage.removeItem("ti_session");
  window.location.href = "index.html";
}

async function tiImpersonateUser(userId) {
  const target = (await TiDB.getUsers()).find(u => u.id === userId);
  if (!target) return { ok: false };
  const current = tiGetSession();
  if (current && !tiLoad("ti_impersonator_session", null)) {
    tiSave("ti_impersonator_session", current);
  }
  tiSetSession({ id: target.id, name: target.name, email: target.email, role: target.role, agencyId: target.agencyId || null, agentRole: target.agentRole || null });
  window.location.href = `dashboard-${target.role}.html`;
  return { ok: true };
}
function tiStopImpersonation() {
  const original = tiLoad("ti_impersonator_session", null);
  if (!original) return;
  tiSetSession(original);
  localStorage.removeItem("ti_impersonator_session");
  window.location.href = "dashboard-admin.html";
}

async function tiLogin(email, password, expectedRole) {
  const lockedFor = tiLoginLockoutRemaining(email);
  if (lockedFor > 0) {
    return { ok: false, error: "locked_out", lockedFor };
  }
  const user = await TiDB.findUserByEmail(email);
  if (!user || !(await tiVerifyUserPassword(user, password))) {
    tiRegisterFailedLogin(email);
    return { ok: false, error: "invalid" };
  }
  if (expectedRole && user.role !== expectedRole) {
    return { ok: false, error: "wrong_role" };
  }
  if (user.role === "agency" && user.status === "suspended") {
    return { ok: false, error: "account_frozen" };
  }
  if (user.role === "agency" && user.agencyId) {
    const agency = await TiDB.getAgency(user.agencyId);
    if (agency && agency.status === "suspended") {
      return { ok: false, error: "suspended" };
    }
  }
  tiClearLoginAttempts(email);
  tiSetSession({ id: user.id, name: user.name, email: user.email, role: user.role, agencyId: user.agencyId || null, agentRole: user.agentRole || null });
  TiDB.recordLogin(user.id).catch(() => {});
  return { ok: true, user };
}

async function tiRegisterClient({ name, email, password }) {
  const existing = await TiDB.findUserByEmail(email);
  if (existing) return { ok: false, error: "exists" };
  const user = { id: "u_" + Date.now(), role: "client", name, email };
  await tiSetUserPassword(user, password);
  await TiDB.createUser(user);
  tiSetSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  return { ok: true, user };
}

async function tiRegisterAgency({ name, agencyName, email, password }) {
  const existing = await TiDB.findUserByEmail(email);
  if (existing) return { ok: false, error: "exists" };
  const agencyId = "ag_" + Date.now();
  await TiDB.saveAgency({ id: agencyId, name: agencyName, email, phone: "", verified: false, status: "active" });
  const user = { id: "u_" + Date.now(), role: "agency", agentRole: "supervisor", name, agencyId, email };
  await tiSetUserPassword(user, password);
  await TiDB.createUser(user);
  tiSetSession({ id: user.id, name: user.name, email: user.email, role: user.role, agencyId, agentRole: "supervisor" });
  return { ok: true, user };
}

/** Protège une page de tableau de bord : redirige vers la connexion si
 *  l'utilisateur n'est pas authentifié avec le rôle requis. À appeler en
 *  haut de chaque page de tableau de bord. */
function tiRequireRole(role) {
  const s = tiGetSession();
  if (!s || s.role !== role) {
    window.location.href = "login.html?role=" + role;
    return null;
  }
  return s;
}
