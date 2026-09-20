const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { User } = require("../models/models");
const { authenticate } = require("../middleware/auth");

function serialize(u) {
  const obj = u.toObject ? u.toObject() : u;
  const { passwordHash, ...rest } = obj;
  return { ...rest, id: obj._id };
}

/** Un admin gère tout le monde ; un superviseur d'agence ne gère que les
 *  comptes de sa propre agence (voir/geler/réinitialiser ses agents) ; un
 *  client n'a jamais accès à cette collection. */
function canManage(reqUser, targetAgencyId) {
  if (reqUser.role === "admin") return true;
  return reqUser.role === "agency" && reqUser.agentRole === "supervisor" && reqUser.agencyId && reqUser.agencyId === targetAgencyId;
}

// GET /api/users — admin sees everyone; an agency supervisor sees only
// their own agency's accounts (mirrors the frontend's getAgents()).
router.get("/", authenticate, async (req, res) => {
  if (req.user.role === "admin") {
    const users = await User.find().sort({ createdAt: -1 });
    return res.json(users.map(serialize));
  }
  if (req.user.role === "agency" && req.user.agentRole === "supervisor") {
    const users = await User.find({ agencyId: req.user.agencyId }).sort({ createdAt: -1 });
    return res.json(users.map(serialize));
  }
  return res.status(403).json({ error: "forbidden" });
});

// PATCH /api/users/:id — arbitrary field updates (status, name, deletion workflow
// fields, etc.) except passwordHash, which only /reset-password may touch.
router.patch("/:id", authenticate, async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: "not_found" });
  if (!canManage(req.user, target.agencyId)) return res.status(403).json({ error: "forbidden" });
  const { passwordHash, ...patch } = req.body;
  const saved = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
  res.json(saved ? serialize(saved) : null);
});

// DELETE /api/users/:id — admin only in practice (the final step of the
// deletion-request workflow an admin approves), but a supervisor removing
// their own agent is allowed by the same rule as PATCH for consistency.
router.delete("/:id", authenticate, async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: "not_found" });
  if (!canManage(req.user, target.agencyId)) return res.status(403).json({ error: "forbidden" });
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// POST /api/users/:id/reset-password — generates a new temporary password and
// hashes it server-side with bcrypt, so it stays compatible with /auth/login
// (a client-side SHA-256 hash, as used in local/demo mode, would not be).
router.post("/:id/reset-password", authenticate, async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ ok: false });
  if (!canManage(req.user, target.agencyId)) return res.status(403).json({ error: "forbidden" });
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  const passwordHash = await bcrypt.hash(pwd, 10);
  await User.findByIdAndUpdate(req.params.id, { passwordHash, mustChangePassword: true });
  res.json({ ok: true, password: pwd });
});

module.exports = router;
