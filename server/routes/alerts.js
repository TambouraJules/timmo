/* ============================================================
   Alertes « nouveaux biens »
   - POST /api/alerts              crée une alerte (critères + e-mail, WhatsApp facultatif)
                                   et envoie un e-mail de confirmation (double opt-in).
   - POST /api/alerts/confirm      { token } active l'alerte.
   - POST /api/alerts/unsubscribe  { token } désactive l'alerte (lien dans chaque e-mail).
   - tiNotifyAlertsForProperty(p)  appelé quand une annonce devient visible : envoie
                                   le bien aux alertes correspondantes.
   Garde-fous : rien n'est envoyé avant confirmation, 5 envois maximum par alerte et
   par jour, 3 alertes maximum par adresse, lien de désinscription dans chaque message.
   ============================================================ */
const router = require("express").Router();
const crypto = require("crypto");
const { Alert, Agency } = require("../models/models");

const SITE = () => (process.env.FRONTEND_URL || "https://www.timmo.sn").replace(/\/+$/, "");
const hash = token => crypto.createHash("sha256").update(`alert:${token}`).digest("hex");
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fcfa = n => (Number(n) || 0).toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA";
const TYPES = ["apartment", "house", "office", "land"];
const KINDS = ["rent", "sale", "short"];
const MAX_PER_EMAIL = 3, MAX_PER_DAY = 5;

function tiSendEmail(args) { return require("./misc").tiSendEmail(args); }

/** Lien de désinscription signé (HMAC) : fonctionne dans chaque e-mail sans
 *  stocker de jeton en clair, et ne peut pas être fabriqué pour une autre alerte. */
function tiStopToken(alertId) {
  const sig = crypto.createHmac("sha256", process.env.JWT_SECRET || "timmo").update(`stop:${alertId}`).digest("hex").slice(0, 32);
  return `${alertId}.${sig}`;
}
async function tiAlertFromStopToken(tok) {
  if (typeof tok !== "string" || !/^al_[a-f0-9]{16}\.[a-f0-9]{32}$/.test(tok)) return null;
  const id = tok.split(".")[0];
  const expected = Buffer.from(tiStopToken(id)), given = Buffer.from(tok);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return Alert.findOne({ id });
}

/* ---------- Limitation simple des créations (anti-abus) ---------- */
const tiAlertHits = new Map(); // ip -> { n, t }
function tiTooMany(ip) {
  const now = Date.now(), r = tiAlertHits.get(ip);
  if (!r || now - r.t > 60 * 60 * 1000) { tiAlertHits.set(ip, { n: 1, t: now }); return false; }
  r.n++; return r.n > 10;
}

function tiCleanCriteria(c = {}) {
  const out = {};
  if (KINDS.includes(c.kind)) out.kind = c.kind;
  if (TYPES.includes(c.type)) out.type = c.type;
  if (typeof c.hood === "string" && /^[a-z0-9_-]{2,40}$/i.test(c.hood)) {
    out.hood = c.hood;
    if (typeof c.hoodLabel === "string") out.hoodLabel = c.hoodLabel.replace(/[<>"&]/g, "").slice(0, 40);
  }
  const beds = parseInt(c.minBeds, 10); if (beds > 0 && beds < 20) out.minBeds = beds;
  const price = Number(c.maxPrice); if (price > 0 && price < 1e12) out.maxPrice = Math.round(price);
  return out;
}
function tiCleanPhone(p) {
  if (!p) return "";
  let d = String(p).replace(/[^\d+]/g, "");
  if (/^(7[05678]|33)\d{7}$/.test(d)) d = "+221" + d;          // numéro sénégalais saisi sans indicatif
  if (/^00\d{8,15}$/.test(d)) d = "+" + d.slice(2);
  return /^\+\d{8,15}$/.test(d) ? d : null;
}
function tiCriteriaLabel(c) {
  const kind = { rent: "location", sale: "vente", short: "court séjour" }[c.kind] || "location ou vente";
  const type = { apartment: "appartement", house: "maison / villa", office: "bureau", land: "terrain" }[c.type] || "tous types de biens";
  return [type, kind, c.hood ? `quartier : ${c.hoodLabel || c.hood}` : "", c.minBeds ? `${c.minBeds}+ chambres` : "", c.maxPrice ? `jusqu'à ${fcfa(c.maxPrice)}` : ""].filter(Boolean).join(" · ");
}

// POST /api/alerts
router.post("/", async (req, res) => {
  if (tiTooMany(req.ip)) return res.status(429).json({ error: "too_many" });
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "invalid_email" });
  if (req.body.consent !== true) return res.status(400).json({ error: "consent_required" });
  const phone = tiCleanPhone(req.body.phone);
  if (phone === null) return res.status(400).json({ error: "invalid_phone" });
  const criteria = tiCleanCriteria(req.body.criteria);
  if ((await Alert.countDocuments({ email, active: true })) >= MAX_PER_EMAIL) return res.status(409).json({ error: "limit_reached" });

  const token = crypto.randomBytes(24).toString("hex");
  const id = "al_" + crypto.randomBytes(8).toString("hex");
  await Alert.create({ id, email, phone, criteria, lang: req.body.lang === "en" ? "en" : "fr", tokenHash: hash(token) });
  const confirm = `${SITE()}/alerte.html?confirm=${token}`;
  const stop = `${SITE()}/alerte.html?stop=${tiStopToken(id)}`;
  await tiSendEmail({
    to: email,
    subject: "Confirmez votre alerte Timmo",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <p style="margin:0 0 18px;"><img src="https://www.timmo.sn/assets/brand/timmo-logo-email.png" alt="Timmo — Teranga Immobilière" width="200" height="63" style="display:block;border:0;"></p>
      <h2 style="color:#BF6A3D;">Confirmez votre alerte</h2>
      <p>Vous recevrez les nouveaux biens correspondant à :<br><strong>${esc(tiCriteriaLabel(criteria))}</strong></p>
      <p style="margin:24px 0;"><a href="${confirm}" style="background:#BF6A3D;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block;">Activer mon alerte</a></p>
      <p style="color:#8a8a8a;font-size:.85rem;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : rien ne vous sera envoyé.</p>
      <p style="color:#8a8a8a;font-size:.8rem;"><a href="${stop}" style="color:#8a8a8a;">Annuler cette alerte</a></p>
    </div>`,
  });
  res.json({ ok: true });
});

async function tiAlertFromToken(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{48}$/.test(token)) return null;
  return Alert.findOne({ tokenHash: hash(token) });
}
router.post("/confirm", async (req, res) => {
  const a = await tiAlertFromToken(req.body.token);
  if (!a) return res.status(404).json({ error: "not_found" });
  a.confirmed = true; a.active = true; await a.save();
  res.json({ ok: true, criteria: tiCriteriaLabel(a.criteria || {}) });
});
router.post("/unsubscribe", async (req, res) => {
  const a = (await tiAlertFromStopToken(req.body.token)) || (await tiAlertFromToken(req.body.token));
  if (!a) return res.status(404).json({ error: "not_found" });
  a.active = false; await a.save();
  res.json({ ok: true });
});

/* ---------- Correspondance et envoi ---------- */
function tiMatches(c = {}, p) {
  const kind = p.forSale ? "sale" : (p.shortStay ? "short" : "rent");
  if (c.kind && c.kind !== kind && !(c.kind === "rent" && kind === "short")) return false;
  if (c.type && c.type !== p.type) return false;
  if (c.hood && c.hood !== p.neighborhood) return false;
  if (c.minBeds && (p.bedrooms || 0) < c.minBeds) return false;
  if (c.maxPrice && (p.price || 0) > c.maxPrice) return false;
  return true;
}

async function tiSendWhatsApp(phone, p, link) {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_ID } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID || !phone) return false;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: phone.replace(/^\+/, ""), type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE || "nouveau_bien",
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "fr" },
          components: [{ type: "body", parameters: [
            { type: "text", text: String(p.title).slice(0, 120) },
            { type: "text", text: fcfa(p.price) },
            { type: "text", text: link },
          ] }],
        },
      }),
    });
    return r.ok;
  } catch (e) { console.error("WhatsApp:", e.message); return false; }
}

/** À appeler quand une annonce devient visible (validée par l'admin ou remise en ligne). */
async function tiNotifyAlertsForProperty(p) {
  try {
    if (!p || p.listingStatus !== "active") return;
    const alerts = await Alert.find({ confirmed: true, active: true }).limit(5000);
    const today = new Date().toISOString().slice(0, 10);
    const agency = p.agencyId ? await Agency.findOne({ id: p.agencyId }).lean() : null;
    const link = `${SITE()}/p/${encodeURIComponent(p.reference || p.id)}?via=alerte`;
    const cover = typeof p.cover === "string" && /^https:\/\//.test(p.cover) ? p.cover : `${SITE()}/p/${encodeURIComponent(p.reference || p.id)}/image`;
    for (const a of alerts) {
      if (!tiMatches(a.criteria || {}, p)) continue;
      if (a.sentDay !== today) { a.sentDay = today; a.sentToday = 0; }
      if (a.sentToday >= MAX_PER_DAY) continue;
      const stop = `${SITE()}/alerte.html?stop=${tiStopToken(a.id)}`;
      await tiSendEmail({
        to: a.email,
        subject: `Nouveau bien : ${String(p.title).slice(0, 70)} — ${fcfa(p.price)}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
          <p style="margin:0 0 16px;"><img src="https://www.timmo.sn/assets/brand/timmo-logo-email.png" alt="Timmo" width="160" height="50" style="display:block;border:0;"></p>
          <p style="color:#5d6773;margin:0 0 12px;">Un nouveau bien correspond à votre alerte (${esc(tiCriteriaLabel(a.criteria || {}))}) :</p>
          <a href="${link}" style="text-decoration:none;color:#0D1B2A;display:block;border:1px solid #e7e1d8;border-radius:12px;overflow:hidden;">
            <img src="${esc(cover)}" alt="" width="520" style="display:block;width:100%;max-height:300px;object-fit:cover;border:0;">
            <div style="padding:14px 16px;">
              <div style="font-weight:800;font-size:17px;">${esc(p.title)}</div>
              <div style="color:#BF6A3D;font-weight:800;font-size:18px;margin-top:4px;">${fcfa(p.price)}${p.forSale ? "" : (p.shortStay ? " / nuit" : " / mois")}</div>
              ${agency && agency.name ? `<div style="color:#5d6773;font-size:13px;margin-top:4px;">Proposé par ${esc(agency.name)}</div>` : ""}
            </div>
          </a>
          <p style="margin:20px 0;"><a href="${link}" style="background:#BF6A3D;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block;">Voir le bien</a></p>
          <p style="color:#8a8a8a;font-size:.8rem;">Vous recevez cet e-mail car vous avez créé une alerte sur timmo.sn.
            <a href="${stop}" style="color:#8a8a8a;">Ne plus recevoir cette alerte</a>.</p>
        </div>`,
      });
      if (a.phone) await tiSendWhatsApp(a.phone, p, link);
      a.sentToday += 1; a.lastSentAt = new Date();
      await a.save();
    }
  } catch (e) {
    console.error("Alertes : envoi impossible —", e.message);
  }
}

module.exports = router;
module.exports.tiNotifyAlertsForProperty = tiNotifyAlertsForProperty;
module.exports.tiMatches = tiMatches;
