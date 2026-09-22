const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Booking, Message, Review, Payment, Favorite, User, Agency, Announcement, Property } = require("../models/models");
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
router.post("/auth/register", async (req, res) => {
  const { name, email, password, role, agencyId, agentRole, agencyName } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: "exists" });
  const passwordHash = await bcrypt.hash(password, 10);

  let finalAgencyId = agencyId;
  let finalAgentRole = agentRole;
  if (role === "agency" && !agencyId && agencyName) {
    finalAgencyId = "ag_" + Date.now();
    await Agency.create({ id: finalAgencyId, name: agencyName, email, phone: "", verified: false, status: "active" });
    finalAgentRole = "supervisor";
  }

  const user = await User.create({ name, email, passwordHash, role: role || "client", agencyId: finalAgencyId, agentRole: finalAgentRole });
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
  const token = jwt.sign({ id: user._id, role: user.role, agencyId: user.agencyId, agentRole: user.agentRole }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user._id, name: user.name, email, role: user.role, agencyId: user.agencyId, agentRole: user.agentRole, status: user.status, mustChangePassword: !!user.mustChangePassword } });
});

router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = email ? await User.findOne({ email }) : null;
  if (user) {
    const tempPassword = tiGenerateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await User.findByIdAndUpdate(user._id, { passwordHash, mustChangePassword: true });
    await tiSendEmail({
      to: email,
      subject: "Votre mot de passe temporaire Timmo",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#C47A4A;">Réinitialisation de mot de passe</h2>
        <p>Bonjour ${user.name || ""},</p>
        <p>Voici votre mot de passe temporaire pour vous reconnecter à Timmo :</p>
        <p style="font-size:1.3rem;font-weight:800;letter-spacing:.05em;background:#F7F2E7;padding:12px 18px;border-radius:8px;display:inline-block;">${tempPassword}</p>
        <p>Pour votre sécurité, il vous sera demandé de choisir un nouveau mot de passe dès votre prochaine connexion.</p>
        <p style="color:#8a8a8a;font-size:.85rem;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail — votre mot de passe actuel reste inchangé jusqu'à ce que quelqu'un se connecte avec ce mot de passe temporaire.</p>
      </div>`,
    });
  }
  res.json({ ok: true });
});

router.post("/auth/change-password", authenticate, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "password_too_short" });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(req.user.id, { passwordHash, mustChangePassword: false });
  res.json({ ok: true });
});

/* ---------- Bookings ---------- */
router.get("/bookings", async (req, res, next) => {
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
  const target = existing || data;
  const owns = req.user.role === "admin" || req.user.id === target.userId || (req.user.agencyId && req.user.agencyId === target.agencyId);
  if (!owns) return res.status(403).json({ error: "forbidden" });
  const saved = await Booking.findOneAndUpdate({ id: data.id }, data, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json(saved);
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

/* ---------- Passerelle de paiement (PayDunya) ----------
   Couvre Wave, Orange Money et carte bancaire via une seule intégration
   en libre-service — contrairement à l'API directe d'Orange Money qui
   exige un agrément marchand long (KYA) via l'opérateur local, PayDunya
   permet une inscription immédiate. Le client est redirigé vers une
   page de paiement hébergée où il choisit son moyen de paiement.
   Nécessite PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN
   (voir .env.example) — sans ces variables, la création de session
   échoue proprement avec un message clair plutôt que de simuler un
   faux paiement. */
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

// POST /payment-gateway/checkout — crée une session de paiement PayDunya
// (Wave, Orange Money, carte...) et renvoie l'URL hébergée vers laquelle
// rediriger le client pour compléter le règlement.
router.post("/payment-gateway/checkout", authenticate, async (req, res) => {
  if (!tiPaydunyaConfigured()) return res.status(503).json({ error: "gateway_not_configured" });
  const { amount, description, purpose, bookingId, scheduleId, propertyId, agencyId, returnUrl, cancelUrl } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "invalid_amount" });

  let store = { name: "Timmo", website_url: "https://timmo-six.vercel.app" };
  if (agencyId) {
    const agency = await Agency.findOne({ id: agencyId });
    if (agency) store = { name: agency.name, phone: agency.phone || "", website_url: "https://timmo-six.vercel.app" };
  }

  const payload = {
    invoice: { total_amount: Math.round(amount), description: description || "Paiement Timmo" },
    store,
    custom_data: {
      purpose: purpose || "rent", bookingId: bookingId || "", scheduleId: scheduleId || "",
      propertyId: propertyId || "", userId: req.user.id, agencyId: agencyId || "",
    },
    actions: { cancel_url: cancelUrl || "", return_url: returnUrl || "" },
  };

  try {
    const pdRes = await fetch(`${tiPaydunyaBaseUrl()}/checkout-invoice/create`, {
      method: "POST", headers: tiPaydunyaHeaders(), body: JSON.stringify(payload),
    });
    const data = await pdRes.json();
    if (data.response_code !== "00") return res.status(502).json({ error: "gateway_error", detail: data.response_text || data.message });
    // PayDunya renvoie l'URL de paiement dans response_text (pas dans un
    // champ "url") lorsque response_code === "00" — cf. leur documentation.
    res.json({ checkoutUrl: data.response_text, token: data.token });
  } catch (err) {
    console.error("Erreur PayDunya (création):", err.message);
    res.status(502).json({ error: "gateway_unreachable" });
  }
});

// Finalise un paiement PayDunya confirmé (statut "completed") : met à jour
// le dépôt, l'échéance de loyer, ou enregistre le paiement autonome
// correspondant. Partagée par la confirmation déclenchée par le client (au
// retour sur le site) et par l'IPN ci-dessous — dans les deux cas, `data`
// vient d'un vrai appel à l'API de confirmation PayDunya, jamais d'une
// valeur envoyée telle quelle par le client ou par le corps du callback.
async function tiFinalizePaydunyaPayment(data) {
  const custom = data.custom_data || {};
  const method = "paydunya";
  if (custom.purpose === "deposit" && custom.bookingId) {
    const booking = await Booking.findOne({ id: custom.bookingId });
    if (booking && booking.rental) {
      await Booking.findOneAndUpdate({ id: custom.bookingId }, {
        "rental.deposit.status": "paid", "rental.deposit.paidAt": new Date().toISOString(), "rental.deposit.method": method,
      });
    }
  } else if (custom.purpose === "schedule" && custom.bookingId && custom.scheduleId) {
    const booking = await Booking.findOne({ id: custom.bookingId });
    if (booking && booking.rental) {
      const schedule = booking.rental.schedule.map(item =>
        item.id === custom.scheduleId ? { ...item.toObject ? item.toObject() : item, status: "paid", paidAt: new Date().toISOString(), method } : item
      );
      await Booking.findOneAndUpdate({ id: custom.bookingId }, { "rental.schedule": schedule });
    }
            } else if (custom.purpose === "rent" && data.token) {
    const property = custom.propertyId ? await Property.findOne({ id: custom.propertyId }) : null;
    // agencyId permet de distinguer, dans le dashboard admin, deux biens
    // qui portent le même titre mais appartiennent à des agences différentes.
    await Payment.findOneAndUpdate(
      { paydunyaToken: data.token },
      { $setOnInsert: {
          id: "pay_" + Date.now(), propertyId: custom.propertyId, propertyTitle: property?.title || "",
          agencyId: property?.agencyId || "",
          userId: custom.userId, amount: data.invoice?.total_amount, method, status: "paid",
          createdAt: new Date().toISOString(), paydunyaToken: data.token,
        } },
      { upsert: true }
    );
  }
}

// GET /payment-gateway/confirm/:token — vérifie le statut réel du paiement
// auprès de PayDunya puis, si confirmé, finalise l'échéance (loyer, dépôt
// ou paiement autonome) correspondante. Ne fait jamais confiance à un
// paramètre de retour côté client : le statut ne vient que de PayDunya.
router.get("/payment-gateway/confirm/:token", authenticate, async (req, res) => {
  if (!tiPaydunyaConfigured()) return res.status(503).json({ error: "gateway_not_configured" });
  try {
    const pdRes = await fetch(`${tiPaydunyaBaseUrl()}/checkout-invoice/confirm/${req.params.token}`, { headers: tiPaydunyaHeaders() });
    const data = await pdRes.json();
    if (data.status !== "completed") return res.json({ status: data.status || "pending" });

    const custom = data.custom_data || {};
    if (custom.userId && custom.userId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }
    await tiFinalizePaydunyaPayment(data);
    res.json({ status: "completed" });
  } catch (err) {
    console.error("Erreur PayDunya (confirmation):", err.message);
    res.status(502).json({ error: "gateway_unreachable" });
  }
});

// POST /payment-gateway/ipn — callback serveur-à-serveur appelé directement
// par PayDunya dès qu'un paiement est confirmé, indépendamment du retour du
// client sur le site (utile s'il ferme l'onglet avant de revenir : sans ce
// callback, son paiement resterait marqué "en attente" côté Timmo). Aucune
// authentification n'est possible ici (PayDunya n'a pas de session Timmo) :
// la sécurité vient de la re-vérification du token auprès de l'API PayDunya
// elle-même, jamais du contenu brut envoyé par le callback.
router.post("/payment-gateway/ipn", async (req, res) => {
  if (!tiPaydunyaConfigured()) return res.sendStatus(503);
  try {
    const payload = req.body.data || req.body;
    const token = payload.token || payload.invoice_token || (payload.invoice && payload.invoice.token);
    if (!token) return res.sendStatus(400);
    const pdRes = await fetch(`${tiPaydunyaBaseUrl()}/checkout-invoice/confirm/${token}`, { headers: tiPaydunyaHeaders() });
    const data = await pdRes.json();
    if (data.status === "completed") await tiFinalizePaydunyaPayment(data);
    res.sendStatus(200);
  } catch (err) {
    console.error("Erreur PayDunya (IPN):", err.message);
    res.sendStatus(500);
  }
});

/* ---------- Rappels de loyer par SMS (Twilio) ---------- */
function tiTwilioConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

// Met un numéro local sénégalais ("77 123 45 67", "771234567"...) au format
// international E.164 (+221771234567) requis par Twilio. Laisse tel quel un
// numéro déjà au format international (commence par "+").
function tiFormatPhoneSenegal(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const local = digits.replace(/^221/, ""); // au cas où le "221" a été tapé sans le "+"
  return "+221" + local;
}

async function tiSendSms({ to, body }) {
  if (!tiTwilioConfigured()) { console.warn("Twilio non configuré — SMS non envoyé:", body); return false; }
  const phone = tiFormatPhoneSenegal(to);
  if (!phone) return false;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
      },
      body: new URLSearchParams({ To: phone, From: process.env.TWILIO_PHONE_NUMBER, Body: body }),
    });
    if (!res.ok) { console.error("Échec d'envoi SMS Twilio:", res.status, await res.text()); return false; }
    return true;
  } catch (err) {
    console.error("Échec d'envoi SMS:", err.message);
    return false;
  }
}

// Parcourt toutes les réservations avec un échéancier de loyer et envoie un
// rappel SMS 3 jours avant chaque échéance impayée, puis un rappel de
// retard si elle reste impayée après sa date d'échéance — chaque rappel
// n'est envoyé qu'une seule fois par échéance (marqué sur l'échéance
// elle-même, comme les autres champs de rental.schedule). Conçue pour
// tourner une fois par jour (voir server.js) ; peut aussi être déclenchée
// manuellement par un admin via POST /admin/rent-reminders/run.
async function tiCheckRentReminders() {
  if (!tiTwilioConfigured()) return { sent: 0, skipped: "not_configured" };
  const todayIso = new Date().toISOString().slice(0, 10);
  const in3days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const bookings = await Booking.find({ "rental.schedule": { $exists: true } });
  let sent = 0;
  for (const booking of bookings) {
    if (!booking.phone || !booking.rental || !Array.isArray(booking.rental.schedule)) continue;
    const schedule = booking.rental.schedule.map(item => (item.toObject ? item.toObject() : item));
    let changed = false;
    for (const item of schedule) {
      if (item.status !== "pending") continue;
      const total = item.rent + (item.chargesAmount || 0);
      if (item.dueDate === in3days && !item.reminderSentAt) {
        const ok = await tiSendSms({
          to: booking.phone,
          body: `Timmo: votre loyer de ${total} FCFA pour "${booking.propertyTitle}" est dû le ${item.dueDate}. Merci de régulariser votre paiement sur timmo-six.vercel.app`,
        });
        if (ok) { item.reminderSentAt = new Date().toISOString(); changed = true; sent++; }
      } else if (item.dueDate < todayIso && !item.overdueReminderSentAt) {
        const ok = await tiSendSms({
          to: booking.phone,
          body: `Timmo: votre loyer de ${total} FCFA pour "${booking.propertyTitle}" est en retard (échéance du ${item.dueDate}). Merci de régulariser rapidement sur timmo-six.vercel.app`,
        });
        if (ok) { item.overdueReminderSentAt = new Date().toISOString(); changed = true; sent++; }
      }
    }
    if (changed) await Booking.findOneAndUpdate({ id: booking.id }, { "rental.schedule": schedule });
  }
  return { sent };
}

// POST /admin/rent-reminders/run — déclenche manuellement une passe de
// rappels de loyer par SMS, pour tester sans attendre le cycle automatique
// quotidien lancé depuis server.js.
router.post("/admin/rent-reminders/run", authenticate, requireRole("admin"), async (req, res) => {
  if (!tiTwilioConfigured()) return res.status(503).json({ error: "sms_not_configured" });
  try {
    res.json({ ok: true, ...(await tiCheckRentReminders()) });
  } catch (err) {
    console.error("Erreur rappels de loyer:", err.message);
    res.status(500).json({ error: "failed" });
  }
});

module.exports = router;
module.exports.tiCheckRentReminders = tiCheckRentReminders;
