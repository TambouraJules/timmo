const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Booking, Message, Review, Payment, Favorite, User, Agency, Announcement } = require("../models/models");
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
    // Agency self-registration: create the agency record and make this
    // first account its supervisor — mirrors the local-mode behavior in
    // js/auth.js's tiRegisterAgency.
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

module.exports = router;
