const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Booking, Message, Review, Payment, Favorite, User, Agency, Announcement, Invoice } = require("../models/models");
const { authenticate, requireRole } = require("../middleware/auth");

/** Envoie un e-mail via l'API Resend (https://resend.com). Nécessite la
 *  variable d'environnement RESEND_API_KEY sur Render ; sans elle, la
 *  fonction se contente de logger et renvoie false, pour que le reste du
 *  flux (mot de passe régénéré, etc.) continue de fonctionner même si
 *  l'envoi d'e-mail n'est pas encore configuré. */
async function tiSendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("RESEND_API_KEY non configurée — e-mail non envoyé:", subject, "->", to); return false; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({ from: process.env.RESEND_FROM || "Timmo <onboarding@resend.dev>", to, subject, html }),
    });
    return res.ok;
  } catch (err) {
    console.error("Échec d'envoi d'e-mail:", err.message);
    return false;
  }
}
function tiGenerateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

/* ---------- Auth ---------- */
// Lit le jeton s'il est présent (sans l'exiger) : l'inscription publique reste
// ouverte, mais rattacher un compte à une agence existante exige d'être connecté.
function tiOptionalUser(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), process.env.JWT_SECRET); } catch (e) { return null; }
}

router.post("/auth/register", async (req, res) => {
  const { name, email, password, role, agencyId, agentRole, agencyName, acceptTerms } = req.body;
  const caller = tiOptionalUser(req);

  // Le rôle n'est jamais pris tel quel dans la requête :
  //  - client : inscription publique ;
  //  - nouvelle agence (agencyName, sans agencyId) : inscription publique, devient superviseur ;
  //  - compte rattaché à une agence EXISTANTE : réservé à l'administration (agent ou
  //    superviseur) ou au superviseur de cette agence (agent uniquement) ;
  //  - tout autre rôle (admin...) : refusé — les administrateurs se créent hors API.
  let finalRole = "client", finalAgencyId, finalAgentRole, newAgency = null;
  if (role === "agency" && agencyId) {
    const adminOk = caller && caller.role === "admin";
    const supervisorOk = caller && caller.role === "agency" && caller.agentRole === "supervisor"
      && caller.agencyId === agencyId && agentRole === "agent";
    if (!adminOk && !supervisorOk) return res.status(403).json({ error: "forbidden" });
    finalRole = "agency"; finalAgencyId = agencyId; finalAgentRole = agentRole === "supervisor" ? "supervisor" : "agent";
  } else if (role === "agency") {
    if (!agencyName) return res.status(400).json({ error: "agency_name_required" });
    finalRole = "agency"; finalAgentRole = "supervisor";
    finalAgencyId = "ag_" + Date.now();
    newAgency = {
      id: finalAgencyId, name: agencyName, email, phone: "", verified: false, status: "active",
      subscriptionStatus: "trial", subscribedSince: new Date().toISOString().slice(0, 10), // comme les agences créées par l'admin
    };
  } else if (role && role !== "client") {
    return res.status(403).json({ error: "forbidden" });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: "exists" });
  const passwordHash = await bcrypt.hash(password, 10);
  if (newAgency) await Agency.create(newAgency);

  // Trace de l'acceptation des CGU / politique de confidentialité (case cochée à l'inscription)
  const termsAcceptedAt = acceptTerms === true ? new Date() : undefined;
  const user = await User.create({ name, email, passwordHash, role: finalRole, agencyId: finalAgencyId, agentRole: finalAgentRole, termsAcceptedAt });
  const token = jwt.sign({ id: user._id, role: user.role, agencyId: finalAgencyId, agentRole: finalAgentRole }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user._id, name, email, role: user.role, agencyId: finalAgencyId, agentRole: finalAgentRole, status: user.status } });
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "invalid" });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "invalid" });
  if (user.status === "suspended") return res.status(403).json({ error: "account_frozen" });
  if (user.agencyId) {
    const agency = await Agency.findOne({ id: user.agencyId });
    if (agency && agency.status === "suspended") return res.status(403).json({ error: "suspended" });
  }
  // Comptes admin et agence : le mot de passe ne suffit pas, un code est envoyé par e-mail.
  if (tiOtpRequiredFor(user)) return tiStartOtpChallenge(user, res);
  tiSendLoginSuccess(user, res);
});

function tiSendLoginSuccess(user, res) {
  const token = jwt.sign({ id: user._id, role: user.role, agencyId: user.agencyId, agentRole: user.agentRole }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, agencyId: user.agencyId, agentRole: user.agentRole, status: user.status, mustChangePassword: !!user.mustChangePassword } });
}

// ---------- Connexion en deux étapes : code à usage unique par e-mail ----------
// Après un mot de passe correct, les comptes admin et agence reçoivent un code à
// 6 chiffres valable 10 minutes. Seules des empreintes SHA-256 sont stockées.
//  - « challenge » : identifiant aléatoire de la tentative, renvoyé au navigateur ;
//  - 5 essais de code au maximum, puis il faut recommencer avec le mot de passe ;
//  - renvoi du code limité à 1 par minute et 3 par tentative.
// Secours : la variable OTP_LOGIN=off sur Render désactive le code (si l'envoi
// d'e-mails tombe en panne et que l'admin ne peut plus se connecter).
const TI_OTP_TTL_MS = 10 * 60 * 1000, TI_OTP_MAX_TRIES = 5, TI_OTP_MAX_RESENDS = 3, TI_OTP_RESEND_GAP_MS = 60 * 1000;
const tiOtpHash = (challenge, code) => require("crypto").createHash("sha256").update(`${challenge}:${code}`).digest("hex");
const tiOtpChallengeHash = challenge => require("crypto").createHash("sha256").update(`otp:${challenge}`).digest("hex");

function tiOtpRequiredFor(user) {
  if (String(process.env.OTP_LOGIN || "").toLowerCase() === "off") return false;
  return user.role === "admin" || user.role === "agency";
}
function tiMaskEmail(email) {
  const [name, domain] = String(email).split("@");
  if (!domain) return email;
  return (name.length <= 2 ? name[0] + "*" : name.slice(0, 2) + "*".repeat(Math.min(name.length - 2, 6))) + "@" + domain;
}
async function tiSendOtpEmail(user, code) {
  return tiSendEmail({
    to: user.email,
    subject: `${code} — votre code de connexion Timmo`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#C47A4A;">Code de connexion</h2>
      <p>Bonjour ${user.name || ""},</p>
      <p>Voici votre code pour terminer la connexion à votre espace Timmo :</p>
      <p style="font-size:2rem;font-weight:800;letter-spacing:8px;margin:20px 0;color:#0D1B2A;">${code}</p>
      <p style="font-size:.85rem;">Ce code est valable <strong>10 minutes</strong> et ne peut servir qu'une seule fois. Ne le communiquez à personne : l'équipe Timmo ne vous le demandera jamais.</p>
      <p style="color:#8a8a8a;font-size:.85rem;">Si vous n'essayez pas de vous connecter, quelqu'un connaît peut-être votre mot de passe : changez-le dès que possible.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
      <p style="color:#8a8a8a;font-size:.8rem;"><em>Your Timmo sign-in code is ${code}. It expires in 10 minutes. Never share it.</em></p>
    </div>`,
  });
}
async function tiStartOtpChallenge(user, res) {
  const crypto = require("crypto");
  const challenge = crypto.randomBytes(32).toString("hex");
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await User.findByIdAndUpdate(user._id, {
    otpChallengeHash: tiOtpChallengeHash(challenge), otpCodeHash: tiOtpHash(challenge, code),
    otpExpires: new Date(Date.now() + TI_OTP_TTL_MS), otpTries: 0, otpResends: 0, otpSentAt: new Date(),
  });
  const sent = await tiSendOtpEmail(user, code);
  if (!sent) return res.status(503).json({ error: "otp_send_failed" });
  res.json({ otpRequired: true, challenge, email: tiMaskEmail(user.email), role: user.role, expiresIn: TI_OTP_TTL_MS / 1000 });
}
async function tiUserFromChallenge(challenge) {
  if (typeof challenge !== "string" || !/^[a-f0-9]{64}$/.test(challenge)) return null;
  return User.findOne({ otpChallengeHash: tiOtpChallengeHash(challenge), otpExpires: { $gt: new Date() } });
}
const TI_OTP_CLEAR = { $unset: { otpChallengeHash: 1, otpCodeHash: 1, otpExpires: 1, otpTries: 1, otpResends: 1, otpSentAt: 1 } };

// POST /auth/login/verify — { challenge, code }
router.post("/auth/login/verify", async (req, res) => {
  const { challenge } = req.body;
  const code = String(req.body.code || "").replace(/\D/g, "");
  const user = await tiUserFromChallenge(challenge);
  if (!user) return res.status(400).json({ error: "otp_expired" });
  if ((user.otpTries || 0) >= TI_OTP_MAX_TRIES) {
    await User.findByIdAndUpdate(user._id, TI_OTP_CLEAR);
    return res.status(429).json({ error: "otp_too_many" });
  }
  const expected = Buffer.from(user.otpCodeHash || "", "hex");
  const given = Buffer.from(tiOtpHash(challenge, code), "hex");
  const ok = code.length === 6 && expected.length === given.length && require("crypto").timingSafeEqual(expected, given);
  if (!ok) {
    const tries = (user.otpTries || 0) + 1;
    if (tries >= TI_OTP_MAX_TRIES) {
      await User.findByIdAndUpdate(user._id, TI_OTP_CLEAR);
      return res.status(429).json({ error: "otp_too_many" });
    }
    await User.findByIdAndUpdate(user._id, { otpTries: tries });
    return res.status(400).json({ error: "otp_invalid", triesLeft: TI_OTP_MAX_TRIES - tries });
  }
  await User.findByIdAndUpdate(user._id, TI_OTP_CLEAR);
  // Le compte a pu être suspendu entre-temps.
  if (user.status === "suspended") return res.status(403).json({ error: "account_frozen" });
  tiSendLoginSuccess(user, res);
});

// POST /auth/login/resend — { challenge } : nouveau code pour la même tentative.
router.post("/auth/login/resend", async (req, res) => {
  const user = await tiUserFromChallenge(req.body.challenge);
  if (!user) return res.status(400).json({ error: "otp_expired" });
  const wait = TI_OTP_RESEND_GAP_MS - (Date.now() - new Date(user.otpSentAt || 0).getTime());
  if (wait > 0) return res.status(429).json({ error: "otp_wait", retryIn: Math.ceil(wait / 1000) });
  if ((user.otpResends || 0) >= TI_OTP_MAX_RESENDS) return res.status(429).json({ error: "otp_resend_limit" });
  const code = String(require("crypto").randomInt(0, 1000000)).padStart(6, "0");
  await User.findByIdAndUpdate(user._id, {
    otpCodeHash: tiOtpHash(req.body.challenge, code), otpExpires: new Date(Date.now() + TI_OTP_TTL_MS),
    otpResends: (user.otpResends || 0) + 1, otpSentAt: new Date(),
  });
  const sent = await tiSendOtpEmail(user, code);
  if (!sent) return res.status(503).json({ error: "otp_send_failed" });
  res.json({ ok: true, expiresIn: TI_OTP_TTL_MS / 1000 });
});

// ---------- Réinitialisation du mot de passe par lien sécurisé ----------
// POST /auth/forgot-password — si le compte existe, envoie par e-mail un lien
// « Réinitialiser mon mot de passe » valable 30 minutes et utilisable une seule fois.
//  - Le mot de passe actuel n'est PAS modifié à ce stade : quelqu'un qui saisit
//    l'e-mail d'un autre ne peut ni bloquer ni modifier son compte.
//  - Seule l'empreinte SHA-256 du jeton est stockée en base : une fuite de la base
//    ne permet pas d'utiliser les liens en cours.
//  - La réponse est toujours la même, que le compte existe ou non (pas
//    d'énumération des e-mails inscrits), et les demandes sont limitées
//    (3 par tranche de 15 min et par adresse) pour éviter de spammer quelqu'un.
const crypto = require("crypto");
const TI_RESET_TTL_MS = 30 * 60 * 1000;
const tiResetRequests = new Map(); // email -> { count, first }
const TI_RESET_MAX = 3, TI_RESET_WINDOW_MS = 15 * 60 * 1000;
const tiHashToken = token => crypto.createHash("sha256").update(String(token)).digest("hex");

/** Adresse du site (Vercel) utilisée dans le lien de l'e-mail. FRONTEND_URL est
 *  fortement recommandée sur Render ; à défaut on prend l'origine de la requête
 *  seulement si c'est un domaine Vercel ou localhost (jamais une origine arbitraire,
 *  sinon un attaquant pourrait faire pointer le lien vers son propre site). */
function tiFrontendUrl(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, "");
  const origin = req.get("origin") || "";
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return null;
}

router.post("/auth/forgot-password", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
  if (!email) return res.json({ ok: true });

  const key = email.toLowerCase(), now = Date.now();
  let rec = tiResetRequests.get(key);
  if (rec && now - rec.first > TI_RESET_WINDOW_MS) { tiResetRequests.delete(key); rec = null; }
  if (rec && rec.count >= TI_RESET_MAX) return res.json({ ok: true }); // même réponse, rien n'est envoyé
  tiResetRequests.set(key, { count: (rec ? rec.count : 0) + 1, first: rec ? rec.first : now });

  const user = await User.findOne({ email: new RegExp("^" + email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") });
  if (user) {
    const base = tiFrontendUrl(req);
    if (!base) {
      console.warn("FRONTEND_URL non configurée sur Render — lien de réinitialisation non envoyé à", email);
      return res.json({ ok: true });
    }
    const token = crypto.randomBytes(32).toString("hex");
    await User.findByIdAndUpdate(user._id, { resetTokenHash: tiHashToken(token), resetTokenExpires: new Date(now + TI_RESET_TTL_MS) });
    const link = `${base}/reset-password.html?token=${token}`;
    await tiSendEmail({
      to: user.email,
      subject: "Réinitialisez votre mot de passe Timmo",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#C47A4A;">Réinitialisation de mot de passe</h2>
        <p>Bonjour ${user.name || ""},</p>
        <p>Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Timmo. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
        <p style="margin:24px 0;"><a href="${link}" style="background:#C47A4A;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block;">Réinitialiser mon mot de passe</a></p>
        <p style="font-size:.85rem;">Ce lien est valable <strong>30 minutes</strong> et ne peut servir qu'une seule fois.</p>
        <p style="font-size:.8rem;color:#8a8a8a;word-break:break-all;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${link}</p>
        <p style="color:#8a8a8a;font-size:.85rem;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste inchangé.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#8a8a8a;font-size:.8rem;"><em>Reset your Timmo password: open the link above within 30 minutes. If you didn't ask for this, just ignore this email.</em></p>
      </div>`,
    });
  }
  res.json({ ok: true });
});

/** Retrouve l'utilisateur correspondant à un jeton de réinitialisation encore valide. */
async function tiUserFromResetToken(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  return User.findOne({ resetTokenHash: tiHashToken(token), resetTokenExpires: { $gt: new Date() } });
}

// GET /auth/reset-password/verify?token=… — la page vérifie le lien avant
// d'afficher le formulaire (lien expiré ou déjà utilisé → message clair).
router.get("/auth/reset-password/verify", async (req, res) => {
  const user = await tiUserFromResetToken(req.query.token);
  res.json({ valid: !!user });
});

// POST /auth/reset-password — { token, newPassword } : enregistre le nouveau
// mot de passe et invalide le lien (usage unique).
router.post("/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "password_too_short" });
  const user = await tiUserFromResetToken(token);
  if (!user) return res.status(400).json({ error: "invalid_or_expired" });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(user._id, {
    passwordHash, mustChangePassword: false,
    $unset: { resetTokenHash: 1, resetTokenExpires: 1 },
  });
  res.json({ ok: true, email: user.email });
});

// POST /auth/change-password — changement de mot de passe par l'utilisateur connecté.
//  - Après une connexion avec un mot de passe temporaire (mustChangePassword), il vient
//    d'être saisi : aucun mot de passe actuel n'est redemandé.
//  - Sinon (changement volontaire), le mot de passe ACTUEL est exigé : une session laissée
//    ouverte ne suffit pas pour prendre le contrôle du compte. Les essais ratés sont limités
//    (5 par tranche de 15 min et par compte, comptés en mémoire du serveur).
const tiPwAttempts = new Map(); // idUtilisateur -> { count, first }
const TI_PW_MAX_FAILS = 5, TI_PW_WINDOW_MS = 15 * 60 * 1000;
router.post("/auth/change-password", authenticate, async (req, res) => {
  const { newPassword, currentPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "password_too_short" });
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "not_found" });

  if (!user.mustChangePassword) {
    const key = String(req.user.id), now = Date.now();
    let rec = tiPwAttempts.get(key);
    if (rec && now - rec.first > TI_PW_WINDOW_MS) { tiPwAttempts.delete(key); rec = null; }
    if (rec && rec.count >= TI_PW_MAX_FAILS) return res.status(429).json({ error: "too_many_attempts" });
    const valid = typeof currentPassword === "string" && currentPassword.length > 0
      && await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      tiPwAttempts.set(key, { count: (rec ? rec.count : 0) + 1, first: rec ? rec.first : now });
      return res.status(403).json({ error: "wrong_current_password" });
    }
    tiPwAttempts.delete(key);
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) return res.status(400).json({ error: "same_password" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(req.user.id, { passwordHash, mustChangePassword: false });
  res.json({ ok: true });
});

/* ---------- Bookings ---------- */
router.get("/bookings", async (req, res, next) => {
  // Property-only filter (no userId/agencyId) is the public short-stay
  // availability calendar on the property page — stays unauthenticated,
  // but strips personal fields (name/phone/email/price/etc.) so it only
  // ever reveals which dates are taken, never who booked them.
  if (req.query.propertyId && !req.query.userId && !req.query.agencyId) {
    const bookings = await Booking.find({ propertyId: req.query.propertyId }).sort({ createdAt: -1 });
    return res.json(bookings.map(b => ({ id: b.id, propertyId: b.propertyId, checkin: b.checkin, checkout: b.checkout, status: b.status })));
  }
  return authenticate(req, res, next);
}, async (req, res) => {
  const filter = {};
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.agencyId) filter.agencyId = req.query.agencyId;
  if (req.query.propertyId) filter.propertyId = req.query.propertyId;
  const isOwnUser = filter.userId && filter.userId === req.user.id;
  const isOwnAgency = filter.agencyId && filter.agencyId === req.user.agencyId;
  if (req.user.role !== "admin" && !isOwnUser && !isOwnAgency) {
    return res.status(403).json({ error: "forbidden" });
  }
  res.json(await Booking.find(filter).sort({ createdAt: -1 }));
});
router.post("/bookings", authenticate, async (req, res) => {
  const data = req.body;
  const existing = data.id ? await Booking.findOne({ id: data.id }) : null;
  const target = existing || data; // ownership check against the existing record when updating, else the new data
  const owns = req.user.role === "admin" || req.user.id === target.userId || (req.user.agencyId && req.user.agencyId === target.agencyId);
  if (!owns) return res.status(403).json({ error: "forbidden" });
  const saved = await Booking.findOneAndUpdate({ id: data.id }, data, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json(saved);
});
// Lecture d'une seule réservation par identifiant : le client concerné, l'agence
// propriétaire ou l'administration. Évite de charger toutes les réservations
// (réservé à l'administration) pour agir sur une seule.
router.get("/bookings/:id", authenticate, async (req, res) => {
  const booking = await Booking.findOne({ id: req.params.id });
  if (!booking) return res.status(404).json({ error: "not_found" });
  const owns = req.user.role === "admin" || booking.userId === req.user.id
    || (req.user.agencyId && booking.agencyId === req.user.agencyId);
  if (!owns) return res.status(403).json({ error: "forbidden" });
  res.json(booking);
});
router.patch("/bookings/:id", authenticate, async (req, res) => {
  const existing = await Booking.findOne({ id: req.params.id });
  if (!existing) return res.status(404).json({ error: "not_found" });
  const owns = req.user.role === "admin" || req.user.id === existing.userId || (req.user.agencyId && req.user.agencyId === existing.agencyId);
  if (!owns) return res.status(403).json({ error: "forbidden" });
  const saved = await Booking.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
  res.json(saved);
});

/* ---------- Messages ---------- */
router.get("/messages", authenticate, async (req, res) => {
  const filter = {};
  if (req.query.propertyId) filter.propertyId = req.query.propertyId;
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.agencyId) filter.agencyId = req.query.agencyId;
  const isOwnUser = filter.userId && filter.userId === req.user.id;
  const isOwnAgency = filter.agencyId && filter.agencyId === req.user.agencyId;
  if (req.user.role !== "admin" && !isOwnUser && !isOwnAgency) {
    return res.status(403).json({ error: "forbidden" });
  }
  res.json(await Message.find(filter).sort({ createdAt: 1 }));
});
router.post("/messages", authenticate, async (req, res) => {
  const { from, userId, agencyId } = req.body;
  const isSenderClient = from === "client" && userId === req.user.id;
  const isSenderAgency = from === "agency" && agencyId && agencyId === req.user.agencyId;
  if (req.user.role !== "admin" && !isSenderClient && !isSenderAgency) {
    return res.status(403).json({ error: "forbidden" });
  }
  res.json(await Message.create(req.body));
});

/* ---------- Reviews ---------- */
router.get("/reviews", async (req, res) => {
  const filter = {};
  if (req.query.propertyId) filter.propertyId = req.query.propertyId;
  // Full, unfiltered access (every review regardless of approval — used for
  // admin moderation) requires a valid admin session. Anyone else — logged
  // in or not — only ever sees approved reviews, which is what a property
  // page's public review section should show.
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  let isAdmin = false;
  if (token) {
    try { isAdmin = jwt.verify(token, process.env.JWT_SECRET).role === "admin"; } catch (err) { /* not admin */ }
  }
  if (!isAdmin) filter.approved = true;
  res.json(await Review.find(filter).sort({ createdAt: -1 }));
});
router.post("/reviews", authenticate, async (req, res) => {
  if (req.user.role !== "admin" && req.body.userId !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  res.json(await Review.create(req.body));
});
router.patch("/reviews/:id", authenticate, requireRole("admin"), async (req, res) => {
  const saved = await Review.findOneAndUpdate({ id: req.params.id }, { approved: req.body.approved }, { new: true });
  res.json(saved);
});

/* ---------- Payments ---------- */
router.get("/payments", authenticate, async (req, res) => {
  const filter = {};
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.user.role !== "admin" && filter.userId !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  res.json(await Payment.find(filter).sort({ createdAt: -1 }));
});
router.post("/payments", authenticate, async (req, res) => {
  if (req.user.role !== "admin" && req.body.userId !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  res.json(await Payment.create({ ...req.body, status: "paid" }));
});

/* ---------- Favorites ---------- */
router.get("/favorites", authenticate, async (req, res) => {
  if (req.user.role !== "admin" && req.query.userId !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  res.json(await Favorite.find({ userId: req.query.userId }));
});
router.post("/favorites/toggle", authenticate, async (req, res) => {
  const { userId, propertyId } = req.body;
  if (req.user.role !== "admin" && userId !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  const existing = await Favorite.findOne({ userId, propertyId });
  if (existing) { await existing.deleteOne(); return res.json({ favorited: false }); }
  await Favorite.create({ userId, propertyId });
  res.json({ favorited: true });
});

/* ---------- Announcements ---------- */
router.get("/announcements", authenticate, async (req, res) => {
  const filter = {};
  if (req.query.agencyId) filter.agencyId = req.query.agencyId;
  res.json(await Announcement.find(filter).sort({ createdAt: -1 }));
});
router.post("/announcements", authenticate, async (req, res) => {
  if (req.user.role !== "admin" && req.body.agencyId !== req.user.agencyId) {
    return res.status(403).json({ error: "forbidden" });
  }
  res.json(await Announcement.create(req.body));
});
router.delete("/announcements/:id", authenticate, async (req, res) => {
  const existing = await Announcement.findOne({ id: req.params.id });
  if (!existing) return res.status(404).json({ error: "not_found" });
  if (req.user.role !== "admin" && existing.agencyId !== req.user.agencyId) {
    return res.status(403).json({ error: "forbidden" });
  }
  await Announcement.deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

/* ---------- Abonnements des agences (factures + paiement mobile money) ----------
   Les agences paient leur abonnement mensuel à la plateforme ; l'administration
   voit les factures et les encaissements dans son tableau de bord. Le paiement
   en ligne passe par PayDunya (Wave, Orange Money, carte) : le client est
   redirigé vers une page hébergée, puis le statut est vérifié auprès de
   PayDunya — jamais déduit d'un simple retour sur le site.
   Les loyers et dépôts des locataires ne transitent PAS par la plateforme. */

// Barème des forfaits (FCFA / mois). À garder aligné avec TI_AGENCY_TIERS (js/data.js).
const TI_TIER_FEES = { standard: 15000, pro: 35000, premium: 75000 };
const TI_INVOICE_DUE_DAY = 5; // une facture non payée est « en retard » après le 5 du mois

function tiCurrentPeriod() { return new Date().toISOString().slice(0, 7); }
function tiInvoiceDueDate(period) { return `${period}-${String(TI_INVOICE_DUE_DAY).padStart(2, "0")}`; }
function tiInvoiceView(inv) {
  const o = inv.toObject ? inv.toObject() : { ...inv };
  const dueDate = tiInvoiceDueDate(o.period);
  const overdue = o.status === "pending" && new Date().toISOString().slice(0, 10) > dueDate;
  return {
    id: o.id, agencyId: o.agencyId, period: o.period, amount: o.amount,
    status: overdue ? "overdue" : o.status, method: o.method || null, paidAt: o.paidAt || null, dueDate,
  };
}
// Crée au besoin la facture du mois en cours (aucun historique n'est inventé) et
// aligne son montant sur le forfait actuel tant qu'elle n'est pas payée.
async function tiEnsureCurrentInvoice(agency) {
  const period = tiCurrentPeriod();
  const id = `inv_${agency.id}_${period.replace("-", "")}`;
  const fee = TI_TIER_FEES[agency.tier] || TI_TIER_FEES.standard;
  let inv = await Invoice.findOne({ id });
  if (!inv) {
    inv = await Invoice.create({
      id, agencyId: agency.id, period, amount: fee,
      status: agency.subscriptionStatus === "trial" ? "trial" : "pending", method: null, paidAt: null,
    });
  } else if (inv.status !== "paid" && inv.amount !== fee) {
    await Invoice.findOneAndUpdate({ id }, { amount: fee });
    inv.amount = fee;
  }
  return inv;
}
async function tiMarkInvoicePaid(inv, method, gatewayToken) {
  if (inv.status === "paid") return; // idempotent : un 2e appel ne change rien
  await Invoice.findOneAndUpdate({ id: inv.id }, {
    status: "paid", method, paidAt: new Date().toISOString(), ...(gatewayToken ? { gatewayToken } : {}),
  });
  const agency = await Agency.findOne({ id: inv.agencyId });
  if (agency) {
    await Agency.findOneAndUpdate({ id: agency.id }, {
      subscriptionStatus: "active",
      ...(agency.subscribedSince ? {} : { subscribedSince: new Date().toISOString().slice(0, 10) }),
    });
  }
}
function tiCanBillAgency(user, agencyId) {
  return user.role === "admin" || (user.role === "agency" && user.agentRole === "supervisor" && user.agencyId === agencyId);
}

// GET /invoices?agencyId=… — factures d'une agence (son superviseur ou l'admin).
// GET /invoices            — toutes les factures (administration uniquement).
router.get("/invoices", authenticate, async (req, res) => {
  const { agencyId } = req.query;
  if (agencyId) {
    if (!tiCanBillAgency(req.user, agencyId)) return res.status(403).json({ error: "forbidden" });
    const agency = await Agency.findOne({ id: agencyId });
    if (!agency) return res.status(404).json({ error: "not_found" });
    await tiEnsureCurrentInvoice(agency);
    return res.json((await Invoice.find({ agencyId }).sort({ period: 1 })).map(tiInvoiceView));
  }
  if (req.user.role !== "admin") return res.status(403).json({ error: "forbidden" });
  for (const agency of await Agency.find({})) await tiEnsureCurrentInvoice(agency);
  res.json((await Invoice.find({}).sort({ period: 1 })).map(tiInvoiceView));
});
// Enregistrement manuel d'un règlement reçu hors plateforme (espèces, virement) — administration.
router.post("/invoices/:id/mark-paid", authenticate, requireRole("admin"), async (req, res) => {
  const inv = await Invoice.findOne({ id: req.params.id });
  if (!inv) return res.status(404).json({ error: "not_found" });
  await tiMarkInvoicePaid(inv, req.body.method || "manual", null);
  res.json({ ok: true });
});

/* ---------- Passerelle de paiement (PayDunya) ----------
   Une seule intégration en libre-service couvre Wave, Orange Money et carte
   (l'API directe d'Orange Money exige un agrément marchand long). Nécessite
   PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN (voir .env.example) ;
   sans elles, la création de session échoue avec un message clair plutôt que
   de simuler un faux paiement. */
function tiPaydunyaConfigured() {
  return !!(process.env.PAYDUNYA_MASTER_KEY && process.env.PAYDUNYA_PRIVATE_KEY && process.env.PAYDUNYA_TOKEN);
}
function tiPaydunyaBaseUrl() {
  return process.env.PAYDUNYA_MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";
}
function tiPaydunyaHeaders() {
  return {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY,
    "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY,
    "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN,
  };
}

// POST /payment-gateway/checkout — session de paiement d'une facture d'abonnement.
// Le montant n'est JAMAIS lu dans la requête : il vient de la facture enregistrée.
router.post("/payment-gateway/checkout", authenticate, async (req, res) => {
  if (!tiPaydunyaConfigured()) return res.status(503).json({ error: "gateway_not_configured" });
  const { purpose, invoiceId, returnUrl, cancelUrl } = req.body;
  if (purpose !== "subscription") return res.status(400).json({ error: "unsupported_purpose" });
  const inv = await Invoice.findOne({ id: invoiceId });
  if (!inv) return res.status(404).json({ error: "not_found" });
  if (!tiCanBillAgency(req.user, inv.agencyId)) return res.status(403).json({ error: "forbidden" });
  if (inv.status === "paid") return res.status(409).json({ error: "already_paid" });
  const agency = await Agency.findOne({ id: inv.agencyId });

  const payload = {
    invoice: {
      total_amount: Math.round(inv.amount),
      description: `Abonnement Timmo ${agency ? agency.tier || "" : ""} — ${inv.period}`.replace(/\s+/g, " "),
    },
    store: { name: "Timmo", tagline: "Plateforme immobilière — Sénégal", website_url: process.env.FRONTEND_URL || "https://www.timmo.sn" },
    custom_data: { purpose: "subscription", invoiceId: inv.id, agencyId: inv.agencyId, userId: req.user.id },
    // callback_url : PayDunya prévient directement le serveur (IPN) quand le paiement est
    // validé — la facture est marquée payée même si l'agence ferme la page avant le retour.
    actions: { cancel_url: cancelUrl || "", return_url: returnUrl || "", callback_url: `${tiApiPublicUrl(req)}/api/payment-gateway/ipn` },
  };
  try {
    const pdRes = await fetch(`${tiPaydunyaBaseUrl()}/checkout-invoice/create`, {
      method: "POST", headers: tiPaydunyaHeaders(), body: JSON.stringify(payload),
    });
    const data = await pdRes.json();
    if (data.response_code !== "00") return res.status(502).json({ error: "gateway_error", detail: data.response_text || data.message });
    // D'après la documentation PayDunya, l'adresse de la page de paiement
    // hébergée est renvoyée dans response_text (pas dans un champ « url »).
    const checkoutUrl = /^https?:\/\//.test(data.response_text || "") ? data.response_text : data.url;
    if (!checkoutUrl) return res.status(502).json({ error: "gateway_error", detail: "no_checkout_url" });
    res.json({ checkoutUrl, token: data.token });
  } catch (err) {
    console.error("Erreur PayDunya (création):", err.message);
    res.status(502).json({ error: "gateway_unreachable" });
  }
});

/** Adresse publique de l'API (pour l'IPN). API_PUBLIC_URL si définie, sinon l'hôte de la requête en https. */
function tiApiPublicUrl(req) {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/+$/, "");
  return `https://${req.get("host")}`;
}

/** Interroge PayDunya pour connaître le statut RÉEL d'un paiement puis, s'il est
 *  terminé et que le montant correspond à la facture, marque celle-ci payée.
 *  Renvoie { status, custom } — utilisé par le retour de l'agence ET par l'IPN. */
async function tiVerifyPaydunyaToken(token) {
  const pdRes = await fetch(`${tiPaydunyaBaseUrl()}/checkout-invoice/confirm/${encodeURIComponent(token)}`, { headers: tiPaydunyaHeaders() });
  const data = await pdRes.json();
  const custom = data.custom_data || {};
  if (data.status !== "completed") return { status: data.status || "pending", custom };
  if (custom.purpose === "subscription" && custom.invoiceId) {
    const inv = await Invoice.findOne({ id: custom.invoiceId });
    if (!inv) return { status: "not_found", custom };
    if (Number(data.invoice && data.invoice.total_amount) !== Number(inv.amount)) {
      console.error("Montant PayDunya différent de la facture", inv.id, data.invoice && data.invoice.total_amount, inv.amount);
      return { status: "amount_mismatch", custom };
    }
    await tiMarkInvoicePaid(inv, "paydunya", token);
  }
  return { status: "completed", custom };
}

// GET /payment-gateway/confirm/:token — appelé au retour de l'agence sur le site.
router.get("/payment-gateway/confirm/:token", authenticate, async (req, res) => {
  if (!tiPaydunyaConfigured()) return res.status(503).json({ error: "gateway_not_configured" });
  try {
    const { status, custom } = await tiVerifyPaydunyaToken(req.params.token);
    if (custom.userId && custom.userId !== req.user.id && req.user.role !== "admin" && !(req.user.agencyId && req.user.agencyId === custom.agencyId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (status === "not_found") return res.status(404).json({ error: "not_found" });
    res.json({ status });
  } catch (err) {
    console.error("Erreur PayDunya (confirmation):", err.message);
    res.status(502).json({ error: "gateway_unreachable" });
  }
});

// POST /payment-gateway/ipn — notification serveur à serveur envoyée par PayDunya
// (format formulaire : data[hash], data[status], data[invoice][token]...).
// On vérifie la signature (SHA-512 de la clé principale), puis on NE FAIT PAS confiance
// au contenu : le statut est revérifié directement auprès de PayDunya avec le jeton.
router.post("/payment-gateway/ipn", require("express").urlencoded({ extended: true }), async (req, res) => {
  try {
    if (!tiPaydunyaConfigured()) return res.status(503).end();
    const data = req.body && req.body.data ? req.body.data : {};
    const expected = crypto.createHash("sha512").update(process.env.PAYDUNYA_MASTER_KEY).digest("hex");
    if (!data.hash || String(data.hash).toLowerCase() !== expected) {
      console.warn("IPN PayDunya rejetée : signature invalide");
      return res.status(401).end();
    }
    const token = data.invoice && data.invoice.token;
    if (!token) return res.status(400).end();
    const { status } = await tiVerifyPaydunyaToken(token);
    console.log("IPN PayDunya", token, status);
    res.status(200).end();
  } catch (err) {
    console.error("Erreur IPN PayDunya:", err.message);
    res.status(500).end();
  }
});

module.exports = router;
