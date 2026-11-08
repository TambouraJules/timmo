/* ============================================================
   Timmo — « Mes documents » côté serveur
   - POST /api/documents/notify        : e-mail au client quand un document
                                         lui est remis (contrat, reçu, état des
                                         lieux, kit de bienvenue, autre).
   - POST /api/documents/sign/request  : envoie un code à 6 chiffres par e-mail
                                         pour signer un contrat.
   - POST /api/documents/sign/verify   : vérifie le code et enregistre la
                                         signature (date, e-mail, empreinte du
                                         document, référence).
   - Relance automatique : contrat non signé 3 jours après l'envoi.

   Les documents eux-mêmes ne sont jamais joints aux e-mails (confidentialité) :
   l'e-mail contient un bouton vers l'espace du client.
   ============================================================ */
const router = require("express").Router();
const crypto = require("crypto");
const { Booking, User, Agency, SignCode } = require("../models/models");
const { authenticate } = require("../middleware/auth");
const { tiSendEmail, tiMaskEmail } = require("./misc");

const SITE = (process.env.FRONTEND_URL || "https://www.timmo.sn").replace(/\/+$/, "");
const DOCS_URL = `${SITE}/dashboard-client.html?panel=documents`;
const SIGN_TTL_MS = 10 * 60 * 1000, SIGN_MAX_TRIES = 5, SIGN_GAP_MS = 60 * 1000, SIGN_MAX_PER_HOUR = 5;
const REMIND_AFTER_MS = 3 * 24 * 3600 * 1000;

const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const sha256 = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const clean = (s, max = 120) => String(s || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

/* ---------- Gabarit d'e-mail ---------- */
function tiDocEmail({ greeting, lines, cta, ctaUrl, footnote }) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0D1B2A;">
    <p style="margin:0 0 18px;"><img src="${SITE}/assets/brand/timmo-logo-email.png" alt="Timmo — Teranga Immobilière" width="200" height="63" style="display:block;border:0;"></p>
    <p>${greeting}</p>
    ${lines.map(l => `<p style="line-height:1.55;">${l}</p>`).join("")}
    ${cta ? `<p style="margin:26px 0;"><a href="${ctaUrl}" style="background:#BF6A3D;color:#fff;text-decoration:none;font-weight:bold;padding:13px 24px;border-radius:999px;display:inline-block;">${cta}</a></p>` : ""}
    <p style="color:#8a8a8a;font-size:.82rem;line-height:1.5;">${footnote || "Pour votre sécurité, les documents ne sont jamais joints aux e-mails : ils restent dans votre espace Timmo, protégé par votre mot de passe."}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="color:#8a8a8a;font-size:.78rem;">Timmo — Teranga Immobilière · www.timmo.sn</p>
  </div>`;
}

async function tiBookingContext(bookingId) {
  if (typeof bookingId !== "string" || bookingId.length > 80) return null;
  const booking = await Booking.findOne({ id: bookingId });
  if (!booking) return null;
  let client = null;
  try { client = booking.userId ? await User.findById(booking.userId) : null; } catch (e) { client = null; }
  const agency = booking.agencyId ? await Agency.findOne({ id: booking.agencyId }).lean() : null;
  return { booking, client, agency, clientEmail: (client && client.email) || booking.email, clientName: (client && client.name) || booking.name || "" };
}
const ownsAsAgency = (user, booking) => user.role === "admin" || !!(user.agencyId && user.agencyId === booking.agencyId);
const ownsAsClient = (user, booking) => booking.userId && String(booking.userId) === String(user.id);

/* ---------- Limite simple d'envois par réservation (mémoire) ---------- */
const NOTIFY_LOG = new Map();
function tiNotifyAllowed(bookingId) {
  const day = new Date().toISOString().slice(0, 10);
  const entry = NOTIFY_LOG.get(bookingId);
  if (!entry || entry.day !== day) { NOTIFY_LOG.set(bookingId, { day, n: 1 }); return true; }
  if (entry.n >= 20) return false;
  entry.n += 1;
  return true;
}

// POST /api/documents/notify { bookingId, kind, title }
router.post("/notify", authenticate, async (req, res) => {
  const { bookingId, kind } = req.body || {};
  const title = clean(req.body && req.body.title);
  const ctx = await tiBookingContext(bookingId);
  if (!ctx) return res.status(404).json({ error: "not_found" });
  if (!ownsAsAgency(req.user, ctx.booking) && !ownsAsClient(req.user, ctx.booking)) return res.status(403).json({ error: "forbidden" });
  if (!ctx.clientEmail) return res.json({ ok: true, sent: false });
  if (!tiNotifyAllowed(bookingId)) return res.status(429).json({ error: "too_many" });

  const agencyName = esc((ctx.agency && ctx.agency.name) || "Votre agence");
  const property = esc(ctx.booking.propertyTitle || "");
  const first = esc(String(ctx.clientName).split(" ")[0] || "");
  const t = esc(title || "Nouveau document");
  const subjects = {
    contract: `Document à signer : ${title || "contrat"} — ${(ctx.agency && ctx.agency.name) || "Timmo"}`,
    receipt: `Votre reçu est disponible : ${title || "paiement"}`,
    info: `Votre kit de bienvenue — ${(ctx.agency && ctx.agency.name) || "Timmo"}`,
  };
  const intros = {
    contract: `<strong>${agencyName}</strong> vous a envoyé un document à signer : <strong>${t}</strong>${property ? ` (${property})` : ""}. Lisez-le dans votre espace, puis signez-le avec le code que nous vous enverrons par e-mail.`,
    receipt: `Votre paiement a bien été enregistré par <strong>${agencyName}</strong>. Votre reçu <strong>${t}</strong>${property ? ` (${property})` : ""} est disponible dans votre espace, à lire ou à télécharger en PDF.`,
    info: `<strong>${agencyName}</strong> vous souhaite la bienvenue ! Votre kit de bienvenue${property ? ` pour ${property}` : ""} (règlement, contacts utiles…) vous attend dans votre espace.`,
  };
  const sent = await tiSendEmail({
    to: ctx.clientEmail,
    subject: subjects[kind] || `${(ctx.agency && ctx.agency.name) || "Votre agence"} vous a envoyé un document : ${title || "nouveau document"}`,
    html: tiDocEmail({
      greeting: `Bonjour ${first},`,
      lines: [intros[kind] || `<strong>${agencyName}</strong> vous a envoyé un document : <strong>${t}</strong>${property ? ` (${property})` : ""}.`],
      cta: kind === "contract" ? "Lire et signer" : "Voir mes documents", ctaUrl: DOCS_URL,
    }),
  });
  res.json({ ok: true, sent });
});

/* ---------- Signature par code e-mail ---------- */

// POST /api/documents/sign/request { bookingId, contractId }
router.post("/sign/request", authenticate, async (req, res) => {
  const { bookingId, contractId } = req.body || {};
  const ctx = await tiBookingContext(bookingId);
  if (!ctx) return res.status(404).json({ error: "not_found" });
  if (!ownsAsClient(req.user, ctx.booking)) return res.status(403).json({ error: "forbidden" });
  const contract = (ctx.booking.contracts || []).find(c => c.id === contractId);
  if (!contract) return res.status(404).json({ error: "not_found" });
  if (contract.signed) return res.status(409).json({ error: "already_signed" });
  const user = await User.findById(req.user.id);
  if (!user || !user.email) return res.status(400).json({ error: "no_email" });

  const recent = await SignCode.find({ userId: String(req.user.id), contractId, createdAt: { $gt: new Date(Date.now() - 3600 * 1000) } }).sort({ createdAt: -1 });
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < SIGN_GAP_MS) return res.status(429).json({ error: "wait", retryIn: 60 });
  if (recent.length >= SIGN_MAX_PER_HOUR) return res.status(429).json({ error: "too_many" });

  const challenge = crypto.randomBytes(32).toString("hex");
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await SignCode.create({
    challengeHash: sha256(`sign:${challenge}`), codeHash: sha256(`${challenge}:${code}`),
    bookingId, contractId, userId: String(req.user.id), expiresAt: new Date(Date.now() + SIGN_TTL_MS),
  });
  const title = esc(contract.title || "Contrat");
  const sent = await tiSendEmail({
    to: user.email,
    subject: `${code} — votre code de signature Timmo`,
    html: tiDocEmail({
      greeting: `Bonjour ${esc(String(user.name || "").split(" ")[0])},`,
      lines: [
        `Voici votre code pour signer électroniquement <strong>${title}</strong>${ctx.booking.propertyTitle ? ` (${esc(ctx.booking.propertyTitle)})` : ""} :`,
        `<span style="font-size:2rem;font-weight:800;letter-spacing:8px;color:#0D1B2A;">${code}</span>`,
        `Ce code est valable <strong>10 minutes</strong>. En le saisissant, vous confirmez avoir lu et approuvé le document. Ne le communiquez à personne.`,
      ],
      footnote: "Si vous n'avez pas demandé ce code, ignorez cet e-mail : rien ne sera signé.",
    }),
  });
  if (!sent) return res.status(503).json({ error: "send_failed" });
  res.json({ challenge, email: tiMaskEmail(user.email), expiresIn: SIGN_TTL_MS / 1000 });
});

// POST /api/documents/sign/verify { challenge, code }
router.post("/sign/verify", authenticate, async (req, res) => {
  const { challenge, code } = req.body || {};
  if (typeof challenge !== "string" || !/^[a-f0-9]{64}$/.test(challenge) || !/^\d{6}$/.test(String(code || ""))) return res.status(400).json({ error: "invalid_code" });
  const entry = await SignCode.findOne({ challengeHash: sha256(`sign:${challenge}`), userId: String(req.user.id), expiresAt: { $gt: new Date() } });
  if (!entry) return res.status(410).json({ error: "expired" });
  if (entry.tries >= SIGN_MAX_TRIES) { await entry.deleteOne(); return res.status(429).json({ error: "too_many" }); }
  const expected = Buffer.from(entry.codeHash, "hex");
  const given = Buffer.from(sha256(`${challenge}:${code}`), "hex");
  if (!crypto.timingSafeEqual(expected, given)) {
    entry.tries += 1; await entry.save();
    return res.status(400).json({ error: "invalid_code", triesLeft: Math.max(0, SIGN_MAX_TRIES - entry.tries) });
  }
  await entry.deleteOne();

  const ctx = await tiBookingContext(entry.bookingId);
  if (!ctx || !ownsAsClient(req.user, ctx.booking)) return res.status(404).json({ error: "not_found" });
  const contract = (ctx.booking.contracts || []).find(c => c.id === entry.contractId);
  if (!contract) return res.status(404).json({ error: "not_found" });
  if (contract.signed) return res.json({ ok: true, signature: contract.signature });

  const user = await User.findById(req.user.id);
  const signedAt = new Date().toISOString();
  const signature = {
    method: "email_code",
    signerName: (user && user.name) || ctx.clientName,
    email: tiMaskEmail((user && user.email) || ctx.clientEmail || ""),
    signedAt,
    ip: String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim().slice(0, 64),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
    docHash: sha256(contract.fileData || contract.fileName || contract.id),
    ref: "SIG-" + crypto.randomBytes(5).toString("hex").toUpperCase(),
  };
  await Booking.updateOne({ id: ctx.booking.id, "contracts.id": contract.id }, {
    $set: { "contracts.$.signed": true, "contracts.$.signedAt": signedAt, "contracts.$.signature": signature },
  });

  const title = esc(contract.title || "Contrat");
  const property = ctx.booking.propertyTitle ? ` (${esc(ctx.booking.propertyTitle)})` : "";
  if (user && user.email) {
    tiSendEmail({
      to: user.email, subject: `Document signé : ${contract.title || "contrat"}`,
      html: tiDocEmail({
        greeting: `Bonjour ${esc(String(user.name || "").split(" ")[0])},`,
        lines: [`Vous avez signé <strong>${title}</strong>${property} le ${new Date(signedAt).toLocaleString("fr-FR", { timeZone: "Africa/Dakar" })}.`,
          `Référence de signature : <strong>${signature.ref}</strong>. Le PDF signé, avec son certificat de signature, est disponible dans votre espace.`],
        cta: "Voir mes documents", ctaUrl: DOCS_URL,
      }),
    }).catch(() => {});
  }
  if (ctx.agency && ctx.agency.email) {
    tiSendEmail({
      to: ctx.agency.email, subject: `${signature.signerName} a signé : ${contract.title || "contrat"}`,
      html: tiDocEmail({
        greeting: "Bonjour,",
        lines: [`<strong>${esc(signature.signerName)}</strong> a signé électroniquement <strong>${title}</strong>${property} le ${new Date(signedAt).toLocaleString("fr-FR", { timeZone: "Africa/Dakar" })}.`,
          `Référence : <strong>${signature.ref}</strong>.`],
        cta: "Ouvrir l'Espace Pro", ctaUrl: `${SITE}/dashboard-agency.html?panel=documents`,
        footnote: "Vous recevez cet e-mail car votre agence a envoyé ce document via Timmo.",
      }),
    }).catch(() => {});
  }
  res.json({ ok: true, signature });
});

/* ---------- Relance : contrat non signé après 3 jours ---------- */
async function tiRemindUnsignedContracts() {
  try {
    const cutoff = new Date(Date.now() - REMIND_AFTER_MS).toISOString();
    const bookings = await Booking.find({
      contracts: { $elemMatch: { signed: { $ne: true }, sentAt: { $lt: cutoff }, reminderSentAt: { $exists: false } } },
    }).limit(50);
    for (const b of bookings) {
      for (const c of (b.contracts || []).filter(x => !x.signed && x.sentAt < cutoff && !x.reminderSentAt)) {
        const ctx = await tiBookingContext(b.id);
        if (ctx && ctx.clientEmail) {
          await tiSendEmail({
            to: ctx.clientEmail,
            subject: `Rappel : document en attente de signature — ${c.title || "contrat"}`,
            html: tiDocEmail({
              greeting: `Bonjour ${esc(String(ctx.clientName).split(" ")[0])},`,
              lines: [`<strong>${esc((ctx.agency && ctx.agency.name) || "Votre agence")}</strong> attend votre signature sur <strong>${esc(c.title || "le contrat")}</strong>${b.propertyTitle ? ` (${esc(b.propertyTitle)})` : ""}, envoyé le ${new Date(c.sentAt).toLocaleDateString("fr-FR")}.`],
              cta: "Lire et signer", ctaUrl: DOCS_URL,
            }),
          });
        }
        await Booking.updateOne({ id: b.id, "contracts.id": c.id }, { $set: { "contracts.$.reminderSentAt": new Date().toISOString() } });
      }
    }
  } catch (err) {
    console.error("[documents] relances :", err.message);
  }
}
if (process.env.NODE_ENV !== "test") {
  setTimeout(tiRemindUnsignedContracts, 2 * 60 * 1000).unref();
  setInterval(tiRemindUnsignedContracts, 6 * 3600 * 1000).unref();
}

module.exports = router;
module.exports.tiRemindUnsignedContracts = tiRemindUnsignedContracts;
