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
  const { name, email, password, role, agencyId, agentRole, agencyName } = req.body;
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

  const user = await User.create({ name, email, passwordHash, role: finalRole, agencyId: finalAgencyId, agentRole: finalAgentRole });
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

// POST /auth/forgot-password — génère un mot de passe temporaire fort et
// l'envoie par e-mail si le compte existe. Renvoie systématiquement la
// même réponse générique, que le compte existe ou non, pour ne jamais
// laisser un visiteur découvrir quels e-mails sont inscrits sur la
// plateforme (protection contre l'énumération de comptes).
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

// POST /auth/change-password — changement de mot de passe par l'utilisateur
// connecté lui-même (utilisé après une connexion avec un mot de passe
// temporaire, mais aussi disponible pour un changement volontaire).
router.post("/auth/change-password", authenticate, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "password_too_short" });
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
    store: { name: "Timmo", tagline: "Plateforme immobilière — Sénégal", website_url: "https://timmo-six.vercel.app" },
    custom_data: { purpose: "subscription", invoiceId: inv.id, agencyId: inv.agencyId, userId: req.user.id },
    actions: { cancel_url: cancelUrl || "", return_url: returnUrl || "" },
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

// GET /payment-gateway/confirm/:token — vérifie le statut réel auprès de PayDunya
// puis, si le paiement est confirmé et que le montant correspond, marque la facture payée.
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
    if (custom.purpose === "subscription" && custom.invoiceId) {
      const inv = await Invoice.findOne({ id: custom.invoiceId });
      if (!inv) return res.status(404).json({ error: "not_found" });
      if (Number(data.invoice && data.invoice.total_amount) !== Number(inv.amount)) {
        console.error("Montant PayDunya différent de la facture", inv.id, data.invoice && data.invoice.total_amount, inv.amount);
        return res.json({ status: "amount_mismatch" });
      }
      await tiMarkInvoicePaid(inv, "paydunya", req.params.token);
    }
    res.json({ status: "completed" });
  } catch (err) {
    console.error("Erreur PayDunya (confirmation):", err.message);
    res.status(502).json({ error: "gateway_unreachable" });
  }
});

module.exports = router;
