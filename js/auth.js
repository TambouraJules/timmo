/* ============================================================
   Timmo — auth (demo session layer, swappable for
   Firebase Auth by wiring tiAuth from firebase-config.js)
   ============================================================ */

const TI_SESSION_KEY = "ti_session";

/* ---------- Password hashing ----------
   SHA-256 with a per-user random salt, via the browser's native Web Crypto
   API — no server available in this demo to run a real password hasher.
   IMPORTANT: this is a real improvement over plain text, but it is NOT a
   substitute for bcrypt/argon2. Those are deliberately slow, server-side
   algorithms built to resist large-scale brute-force guessing; a fast
   general-purpose hash like SHA-256 is not. A real backend must hash with
   bcrypt/argon2 server-side — this only protects against casual/direct
   exposure of the demo data, e.g. someone reading localStorage. */
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
/** Mutates the given user object in place: replaces any plaintext password
 *  with a salted hash. Caller is responsible for persisting the user. */
async function tiSetUserPassword(user, plainPassword) {
  user.passwordSalt = tiGenerateSalt();
  user.passwordHash = await tiHashPassword(plainPassword, user.passwordSalt);
  delete user.password;
}
/** Verifies a login attempt against a user record, transparently upgrading
 *  legacy plaintext accounts (e.g. seed demo data) to a salted hash the
 *  first time they successfully log in — a standard lazy-migration pattern,
 *  so nothing needs a one-off migration script and no account is ever
 *  locked out by the upgrade. */
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

/* ---------- Login rate limiting ----------
   Client-side progressive lockout by email — stops casual/automated
   guessing through the UI. This is NOT a substitute for server-side rate
   limiting (a real backend should still throttle at the network/API layer,
   e.g. via a WAF) since a determined attacker can simply clear local
   storage; it does raise the bar for the common case and gives honest
   feedback while doing it. */
const TI_LOGIN_ATTEMPTS_KEY = "ti_login_attempts";
const TI_LOGIN_LOCKOUT_STEPS = [0, 0, 0, 15, 30, 60, 120, 300]; // seconds, by attempt count
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
/** Seconds remaining before this email may attempt to log in again, or 0
 *  if it isn't currently locked out. */
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

/** Guard a dashboard page: redirect to login if not authenticated
 *  with the required role. Call at top of each dashboard page. */
function tiRequireRole(role) {
  const s = tiGetSession();
  if (!s || s.role !== role) {
    window.location.href = "login.html?role=" + role;
    return null;
  }
  return s;
}
