const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Booking, Message, Review, Payment, Favorite, User } = require("../models/models");

/* ---------- Auth ---------- */
router.post("/auth/register", async (req, res) => {
  const { name, email, password, role, agencyId } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: "exists" });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: role || "client", agencyId });
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user._id, name, email, role: user.role, agencyId } });
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "invalid" });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "invalid" });
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user._id, name: user.name, email, role: user.role, agencyId: user.agencyId } });
});

/* ---------- Bookings ---------- */
router.get("/bookings", async (req, res) => {
  const filter = {};
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.agencyId) filter.agencyId = req.query.agencyId;
  res.json(await Booking.find(filter).sort({ createdAt: -1 }));
});
router.post("/bookings", async (req, res) => res.json(await Booking.create(req.body)));
router.patch("/bookings/:id", async (req, res) => {
  res.json(await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }));
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
  res.json(await Review.findByIdAndUpdate(req.params.id, { approved: req.body.approved }, { new: true }));
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
