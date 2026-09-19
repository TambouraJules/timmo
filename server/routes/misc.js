const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Booking, Message, Review, Payment, Favorite, User, Agency } = require("../models/models");

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
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
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
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user._id, name: user.name, email, role: user.role, agencyId: user.agencyId, agentRole: user.agentRole, status: user.status } });
});

/* ---------- Bookings ---------- */
router.get("/bookings", async (req, res) => {
  const filter = {};
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.agencyId) filter.agencyId = req.query.agencyId;
  if (req.query.propertyId) filter.propertyId = req.query.propertyId;
  res.json(await Booking.find(filter).sort({ createdAt: -1 }));
});
router.post("/bookings", async (req, res) => {
  const data = req.body;
  const saved = await Booking.findOneAndUpdate({ id: data.id }, data, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json(saved);
});
router.patch("/bookings/:id", async (req, res) => {
  const saved = await Booking.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
  res.json(saved);
});

/* ---------- Messages ---------- */
router.get("/messages", async (req, res) => {
  const filter = {};
  if (req.query.propertyId) filter.propertyId = req.query.propertyId;
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.agencyId) filter.agencyId = req.query.agencyId;
  res.json(await Message.find(filter).sort({ createdAt: 1 }));
});
router.post("/messages", async (req, res) => res.json(await Message.create(req.body)));

/* ---------- Reviews ---------- */
router.get("/reviews", async (req, res) => {
  const filter = {};
  if (req.query.propertyId) filter.propertyId = req.query.propertyId;
  res.json(await Review.find(filter).sort({ createdAt: -1 }));
});
router.post("/reviews", async (req, res) => res.json(await Review.create(req.body)));
router.patch("/reviews/:id", async (req, res) => {
  const saved = await Review.findOneAndUpdate({ id: req.params.id }, { approved: req.body.approved }, { new: true });
  res.json(saved);
});

/* ---------- Payments ---------- */
router.get("/payments", async (req, res) => {
  const filter = {};
  if (req.query.userId) filter.userId = req.query.userId;
  res.json(await Payment.find(filter).sort({ createdAt: -1 }));
});
router.post("/payments", async (req, res) => res.json(await Payment.create({ ...req.body, status: "paid" })));

/* ---------- Favorites ---------- */
router.get("/favorites", async (req, res) => res.json(await Favorite.find({ userId: req.query.userId })));
router.post("/favorites/toggle", async (req, res) => {
  const { userId, propertyId } = req.body;
  const existing = await Favorite.findOne({ userId, propertyId });
  if (existing) { await existing.deleteOne(); return res.json({ favorited: false }); }
  await Favorite.create({ userId, propertyId });
  res.json({ favorited: true });
});

module.exports = router;
