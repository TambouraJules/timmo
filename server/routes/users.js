const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { User } = require("../models/models");

function serialize(u) {
  const obj = u.toObject ? u.toObject() : u;
  const { passwordHash, ...rest } = obj;
  return { ...rest, id: obj._id };
}

// GET /api/users
router.get("/", async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users.map(serialize));
});

// PATCH /api/users/:id — arbitrary field updates (status, name, deletion workflow
// fields, etc.) except passwordHash, which only /reset-password may touch.
router.patch("/:id", async (req, res) => {
  const { passwordHash, ...patch } = req.body;
  const saved = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
  res.json(saved ? serialize(saved) : null);
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// POST /api/users/:id/reset-password — generates a new temporary password and
// hashes it server-side with bcrypt, so it stays compatible with /auth/login
// (a client-side SHA-256 hash, as used in local/demo mode, would not be).
router.post("/:id/reset-password", async (req, res) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  const passwordHash = await bcrypt.hash(pwd, 10);
  const user = await User.findByIdAndUpdate(req.params.id, { passwordHash, mustChangePassword: true }, { new: true });
  if (!user) return res.status(404).json({ ok: false });
  res.json({ ok: true, password: pwd });
});

module.exports = router;
