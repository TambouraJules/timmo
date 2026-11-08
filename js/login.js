/* ============================================================
   Timmo — connexion, partagée par les trois portails :
     login.html        → particuliers (clients)            data-portal="client"
     pro.html          → Espace Pro (agences et agents)     data-portal="pro"
     admin-login.html  → administration (non référencé)     data-portal="admin"
   Le portail fixe le rôle attendu : un compte agence ne se connecte pas
   depuis la page des particuliers, et inversement. Les comptes agence et
   admin reçoivent un code par e-mail (2e étape) — voir auth.js.
   ============================================================ */

const TI_PORTAL = document.body.dataset.portal || "client";
const TI_PORTAL_ROLE = { client: "client", pro: "agency", admin: "admin" }[TI_PORTAL];
const TI_PORTAL_DEMO = {
  client: [["role_client", "client@demo.sn"]],
  pro: [["role_agency", "agence@demo.sn"], ["role_agent", "agent@demo.sn"]],
  admin: [["role_admin", "admin@demo.sn"]],
}[TI_PORTAL];

function tiRenderLoginForm() {
  const slot = document.getElementById("ti-login-slot");
  if (!slot) return;
  slot.innerHTML = `
    <div id="login-error"></div>
    <div class="ti-demo-box" id="demo-box" style="display:none;margin:0 0 16px;"></div>
    <form id="form-login" onsubmit="return tiHandleLogin(event)">
      <div class="field"><label for="login-email" data-i18n="email"></label><input type="email" id="login-email" autocomplete="username" required></div>
      <div class="field"><label for="login-password" data-i18n="password"></label><input type="password" id="login-password" autocomplete="current-password" required></div>
      <p style="text-align:right;margin:-10px 0 16px;"><a href="forgot-password.html" class="ti-auth-link" data-i18n="forgot_password_link"></a></p>
      <button type="submit" class="btn btn-primary btn-block" data-i18n="login_btn"></button>
    </form>
    <form id="form-otp" onsubmit="return tiHandleOtp(event)" style="display:none;">
      <h3 style="margin:0 0 6px;" data-i18n="otp_title"></h3>
      <p style="color:var(--ink-soft);margin:0 0 16px;"><span data-i18n="otp_sub"></span> <strong id="otp-email"></strong></p>
      <div class="field">
        <label for="otp-code" data-i18n="otp_code_label"></label>
        <input type="text" id="otp-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required
               style="font-size:1.6rem;letter-spacing:10px;text-align:center;font-weight:700;" placeholder="••••••">
      </div>
      <button type="submit" class="btn btn-primary btn-block" data-i18n="otp_verify_btn"></button>
      <p style="display:flex;justify-content:space-between;gap:10px;margin:14px 0 0;font-size:.85rem;">
        <a href="#" onclick="return tiOtpBack()" style="color:var(--ink-soft);" data-i18n="otp_back"></a>
        <a href="#" id="otp-resend" onclick="return tiOtpResend()" class="ti-auth-link" data-i18n="otp_resend"></a>
      </p>
    </form>`;
  if (typeof tiApplyLang === "function") tiApplyLang();
}

/* Site de démonstration uniquement : comptes fictifs du portail, en un clic. */
function tiRenderDemoBox() {
  if (typeof TI_BACKEND === "undefined" || TI_BACKEND !== "local") return;
  const box = document.getElementById("demo-box");
  if (!box) return;
  box.style.display = "";
  box.innerHTML = `<strong>${t("login_demo_title")}</strong><br>` + TI_PORTAL_DEMO.map(([roleKey, email]) =>
    `<a href="#" onclick="document.getElementById('login-email').value='${email}';document.getElementById('login-password').value='demo1234';return false;" style="color:inherit;">${t(roleKey)} : <code>${email}</code></a>`).join("<br>");
}

function tiLoginNotices() {
  const q = new URLSearchParams(location.search);
  const box = document.getElementById("login-error");
  if (q.get("expired") === "1") box.innerHTML = `<div class="ti-success">${t("login_expired")}</div>`;
  if (q.get("reason") === "fav") box.innerHTML = `<div class="ti-success">${t("login_reason_fav")}</div>`;
  if (q.get("reset") === "1") {
    box.innerHTML = `<div class="ti-success">${t("login_after_reset")}</div>`;
    try {
      const resetEmail = sessionStorage.getItem("ti_reset_email");
      if (resetEmail) { document.getElementById("login-email").value = resetEmail; sessionStorage.removeItem("ti_reset_email"); }
    } catch (e) { /* stockage indisponible : l'utilisateur saisit son e-mail */ }
    setTimeout(() => document.getElementById("login-password").focus(), 50);
  }
}

/** Message quand le compte n'appartient pas à ce portail — on oriente sans
 *  jamais révéler l'existence de la page d'administration. */
function tiWrongPortalMsg() {
  if (TI_PORTAL === "client") return t("login_wrong_portal_client");
  if (TI_PORTAL === "pro") return t("login_wrong_portal_pro");
  return t("login_wrong_portal_admin");
}

async function tiHandleLogin(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  tiSetBtnLoading(btn, true);
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  await new Promise(r => setTimeout(r, 350));
  const res = await tiLogin(email, password, TI_PORTAL_ROLE);
  const errBox = document.getElementById("login-error");
  if (!res.ok) {
    tiSetBtnLoading(btn, false);
    const errMsg = res.error === "wrong_role" ? tiWrongPortalMsg()
      : res.error === "suspended" ? t("login_err_suspended")
      : res.error === "account_frozen" ? t("login_err_frozen")
      : res.error === "otp_send_failed" ? t("login_err_otp_send")
      : res.error === "locked_out" ? t("login_err_locked").replace("{s}", res.lockedFor)
      : t("login_err_invalid");
    errBox.innerHTML = `<div class="ti-error">${errMsg}</div>`;
    return false;
  }
  if (res.otp) { tiShowOtpStep(res.otp); tiSetBtnLoading(btn, false); return false; }
  tiGoAfterLogin(res.user);
  return false;
}

function tiGoAfterLogin(user) {
  const next = new URLSearchParams(location.search).get("next");
  const safeNext = next && /^[a-z0-9-]+\.html(\?[\w=&%.+-]*)?$/i.test(next) ? next : null; // jamais de redirection vers un autre site
  if (user.mustChangePassword) {
    location.href = `reset-password.html?next=dashboard-${user.role}.html`;
    return;
  }
  // Particulier : retour à l'accueil (ou à la page d'où il venait) — son espace reste
  // accessible depuis le menu du compte. Agences et admin : directement leur espace.
  location.href = safeNext || (user.role === "client" ? "index.html" : `dashboard-${user.role}.html`);
}

/* ---------- Étape 2 : code de connexion reçu par e-mail ---------- */
let TI_OTP = null;
function tiOtpMsg(html, ok) {
  document.getElementById("login-error").innerHTML = html ? `<div class="${ok ? "ti-success" : "ti-error"}">${html}</div>` : "";
}
function tiShowOtpStep(otp) {
  TI_OTP = otp;
  document.getElementById("form-login").style.display = "none";
  document.getElementById("form-otp").style.display = "";
  document.getElementById("otp-email").textContent = otp.email;
  tiOtpMsg("");
  const input = document.getElementById("otp-code");
  input.value = ""; input.focus();
}
function tiOtpBack() {
  TI_OTP = null;
  document.getElementById("form-otp").style.display = "none";
  document.getElementById("form-login").style.display = "";
  document.getElementById("login-password").value = "";
  tiOtpMsg("");
  return false;
}
async function tiHandleOtp(e) {
  e.preventDefault();
  if (!TI_OTP) return false;
  const btn = e.target.querySelector("button[type=submit]");
  tiSetBtnLoading(btn, true);
  const res = await tiVerifyLoginOtp(TI_OTP.challenge, document.getElementById("otp-code").value);
  if (res.ok) { tiGoAfterLogin(res.user); return false; }
  tiSetBtnLoading(btn, false);
  if (res.error === "otp_invalid") {
    tiOtpMsg(t("otp_err_invalid").replace("{n}", res.triesLeft));
    document.getElementById("otp-code").select();
  } else if (res.error === "otp_too_many" || res.error === "otp_expired") {
    tiOtpBack();
    tiOtpMsg(t(res.error === "otp_too_many" ? "otp_err_too_many" : "otp_err_expired"));
  } else if (res.error === "account_frozen") {
    tiOtpBack();
    tiOtpMsg(t("login_err_frozen"));
  } else {
    tiOtpMsg(t("otp_err_generic"));
  }
  return false;
}
async function tiOtpResend() {
  if (!TI_OTP) return false;
  const res = await tiResendLoginOtp(TI_OTP.challenge);
  if (res.ok) tiOtpMsg(t("otp_resent").replace("{email}", TI_OTP.email), true);
  else if (res.error === "otp_wait") tiOtpMsg(t("otp_err_wait").replace("{s}", res.retryIn));
  else if (res.error === "otp_resend_limit") tiOtpMsg(t("otp_err_resend_limit"));
  else if (res.error === "otp_expired") { tiOtpBack(); tiOtpMsg(t("otp_err_expired")); }
  else tiOtpMsg(t("otp_err_generic"));
  return false;
}

/* ---------- Démarrage ---------- */
tiRenderLoginForm();
tiRenderDemoBox();
tiLoginNotices();
document.addEventListener("ti:langchange", () => { tiRenderDemoBox(); });
// Déjà connecté avec le bon rôle : directement vers son espace.
(function () {
  const s = typeof tiGetSession === "function" ? tiGetSession() : null;
  if (s && s.role === TI_PORTAL_ROLE && !new URLSearchParams(location.search).get("expired")) location.replace(s.role === "client" ? "index.html" : `dashboard-${s.role}.html`);
})();
