/* ============================================================
   Timmo — authentification (couche de session pour démo, peut être
   remplacée par Firebase Auth en branchant tiAuth depuis firebase-config.js)
   ============================================================ */

const TI_SESSION_KEY = "ti_session";

/* ---------- Hachage des mots de passe ----------
   bcrypt (via la bibliothèque bcryptjs, chargée depuis un CDN, la même que
   celle utilisée côté serveur) — un seul schéma de hachage pour toute
   l'application, que le compte vive en local (démo) ou dans la vraie base
   via l'API. bcrypt gère son propre sel en interne (intégré au hash),
   donc aucun champ passwordSalt séparé n'est nécessaire. */
/** Modifie l'objet utilisateur donné en place : remplace tout mot de passe
 *  en clair par un hachage bcrypt. L'appelant est responsable de sauvegarder l'utilisateur. */
async function tiSetUserPassword(user, plainPassword) {
  user.passwordHash = await dcodeIO.bcrypt.hash(plainPassword, 10);
  delete user.passwordSalt;
  delete user.password;
}
/** Vérifie une tentative de connexion par rapport à un enregistrement utilisateur,
 *  en migrant discrètement les comptes en texte clair hérités (ex. données de
 *  démo initiales) vers un hachage bcrypt dès leur première connexion réussie —
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
  if (!user.passwordHash) return false;
  return dcodeIO.bcrypt.compare(plainPassword, user.passwordHash);
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

function tiFinishApiLogin(data, expectedRole, email) {
  const user = data.user;
  if (expectedRole && user.role !== expectedRole) return { ok: false, error: "wrong_role" };
  if (email) tiClearLoginAttempts(email);
  localStorage.setItem("ti_api_token", data.token);
  tiSetSession({ id: user.id, name: user.name, email: user.email, role: user.role, agencyId: user.agencyId || null, agentRole: user.agentRole || null });
  return { ok: true, user };
}

/** 2e étape de connexion (admin / agence) : vérifie le code reçu par e-mail. */
async function tiVerifyLoginOtp(challenge, code) {
  try {
    const res = await fetch(`${TI_API_BASE}/auth/login/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "otp_invalid", triesLeft: data.triesLeft };
    return tiFinishApiLogin(data, null, null);
  } catch (err) {
    return { ok: false, error: "network" };
  }
}

/** Demande un nouveau code pour la même tentative de connexion. */
async function tiResendLoginOtp(challenge) {
  try {
    const res = await fetch(`${TI_API_BASE}/auth/login/resend`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error, retryIn: data.retryIn };
  } catch (err) {
    return { ok: false, error: "network" };
  }
}

async function tiLogin(email, password, expectedRole) {
  const lockedFor = tiLoginLockoutRemaining(email);
  if (lockedFor > 0) {
    return { ok: false, error: "locked_out", lockedFor };
  }
  if (TI_BACKEND === "api") {
    try {
      const res = await fetch(`${TI_API_BASE}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "account_frozen" || body.error === "suspended" || body.error === "otp_send_failed") return { ok: false, error: body.error };
        tiRegisterFailedLogin(email);
        return { ok: false, error: "invalid" };
      }
      const data = await res.json();
      if (data.otpRequired) {
        // Mot de passe correct, mais un code envoyé par e-mail est encore demandé.
        if (expectedRole && data.role !== expectedRole) return { ok: false, error: "wrong_role" };
        tiClearLoginAttempts(email);
        return { ok: true, otp: { challenge: data.challenge, email: data.email, expiresIn: data.expiresIn } };
      }
      return tiFinishApiLogin(data, expectedRole, email);
    } catch (err) {
      return { ok: false, error: "invalid" };
    }
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

/** Demande un lien de réinitialisation par e-mail. Renvoie toujours { ok: true }
 *  côté API que le compte existe ou non — protection contre l'énumération
 *  de comptes, jamais de message différent selon que l'e-mail est inscrit. */
async function tiRequestPasswordReset(email) {
  if (TI_BACKEND === "api") {
    try {
      const res = await fetch(`${TI_API_BASE}/auth/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return res.ok;
    } catch (err) { return false; }
  }
  // Mode local (démo) : pas de vrai envoi d'e-mail — le lien de réinitialisation
  // est simplement journalisé dans la console pour rester utilisable en test.
  const users = tiLoad("ti_users", []);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user) {
    const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
    const token = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    user.resetToken = token;
    user.resetTokenExpires = Date.now() + 30 * 60 * 1000;
    tiSave("ti_users", users);
    const base = window.location.href.replace(/[^/]*$/, "");
    console.log("[Mode démo] Lien de réinitialisation pour " + email + " : " + base + "reset-password.html?token=" + token);
  }
  return true;
}
/** Vérifie qu'un lien de réinitialisation est encore valide (non expiré, non utilisé). */
async function tiVerifyResetToken(token) {
  if (!token) return false;
  if (TI_BACKEND === "api") {
    try {
      const res = await fetch(`${TI_API_BASE}/auth/reset-password/verify?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      return res.ok && !!(await res.json()).valid;
    } catch (err) { return false; }
  }
  const users = tiLoad("ti_users", []);
  return users.some(u => u.resetToken === token && u.resetTokenExpires > Date.now());
}
/** Enregistre un nouveau mot de passe à partir du lien reçu par e-mail.
 *  Renvoie { ok: true, email } ou { ok: false, error } avec error parmi :
 *  invalid_or_expired, password_too_short, failed. */
async function tiResetPasswordWithToken(token, newPassword) {
  if (TI_BACKEND === "api") {
    try {
      const res = await fetch(`${TI_API_BASE}/auth/reset-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, email: body.email };
      return { ok: false, error: ["invalid_or_expired", "password_too_short"].includes(body.error) ? body.error : "failed" };
    } catch (err) { return { ok: false, error: "failed" }; }
  }
  if (!newPassword || newPassword.length < 8) return { ok: false, error: "password_too_short" };
  const users = tiLoad("ti_users", []);
  const user = users.find(u => u.resetToken === token && u.resetTokenExpires > Date.now());
  if (!user) return { ok: false, error: "invalid_or_expired" };
  await tiSetUserPassword(user, newPassword);
  user.mustChangePassword = false;
  delete user.resetToken; delete user.resetTokenExpires;
  tiSave("ti_users", users);
  return { ok: true, email: user.email };
}
/** Change le mot de passe de l'utilisateur actuellement connecté. Renvoie
 *  { ok: true } ou { ok: false, error } avec error parmi : wrong_current_password,
 *  too_many_attempts, same_password, password_too_short, failed.
 *  currentPassword est exigé pour un changement volontaire ; il ne l'est pas juste
 *  après une connexion avec un mot de passe temporaire (mustChangePassword). */
async function tiChangePassword(newPassword, currentPassword) {
  if (TI_BACKEND === "api") {
    try {
      await tiApiFetch(`${TI_API_BASE}/auth/change-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, currentPassword }),
      });
      return { ok: true };
    } catch (err) {
      const known = ["wrong_current_password", "too_many_attempts", "same_password", "password_too_short"];
      return { ok: false, error: known.includes(err.code) ? err.code : "failed" };
    }
  }
  const session = tiGetSession();
  const users = tiLoad("ti_users", []);
  const user = users.find(u => u.id === session.id);
  if (!user) return { ok: false, error: "failed" };
  if (newPassword.length < 8) return { ok: false, error: "password_too_short" };
  if (!user.mustChangePassword) {
    if (!currentPassword || !(await tiVerifyUserPassword(user, currentPassword))) return { ok: false, error: "wrong_current_password" };
  }
  if (user.passwordHash && await dcodeIO.bcrypt.compare(newPassword, user.passwordHash)) return { ok: false, error: "same_password" };
  await tiSetUserPassword(user, newPassword);
  user.mustChangePassword = false;
  tiSave("ti_users", users);
  return { ok: true };
}

async function tiRegisterClient({ name, email, password, acceptTerms }) {
  if (TI_BACKEND === "api") {
    const res = await fetch(`${TI_API_BASE}/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: "client", acceptTerms: !!acceptTerms }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || "exists" };
    }
    const data = await res.json();
    localStorage.setItem("ti_api_token", data.token);
    tiSetSession({ id: data.user.id, name: data.user.name, email: data.user.email, role: data.user.role });
    return { ok: true, user: data.user };
  }
  const existing = await TiDB.findUserByEmail(email);
  if (existing) return { ok: false, error: "exists" };
  const user = { id: "u_" + Date.now(), role: "client", name, email };
  await tiSetUserPassword(user, password);
  await TiDB.createUser(user);
  tiSetSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  return { ok: true, user };
}

async function tiRegisterAgency({ name, agencyName, email, password, acceptTerms }) {
  if (TI_BACKEND === "api") {
    const res = await fetch(`${TI_API_BASE}/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: "agency", agencyName, acceptTerms: !!acceptTerms }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || "exists" };
    }
    const data = await res.json();
    localStorage.setItem("ti_api_token", data.token);
    tiSetSession({ id: data.user.id, name: data.user.name, email: data.user.email, role: data.user.role, agencyId: data.user.agencyId, agentRole: data.user.agentRole });
    return { ok: true, user: data.user };
  }
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
