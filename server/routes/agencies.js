const router = require("express").Router();
const { Agency } = require("../models/models");
const { authenticate, requireRole } = require("../middleware/auth");

// GET /api/agencies — public (agency profile pages, sub-sites, listings)
router.get("/", async (req, res) => {
  const agencies = await Agency.find().sort({ createdAt: -1 });
  res.json(agencies);
});

// POST /api/agencies (create or update — upsert by business id) — the
// owning agency editing its own record (welcome kit, logo, sub-site...) or
// an admin. New agencies are normally created via /auth/register, but an
// admin may also create one directly from the admin panel.
router.post("/", authenticate, async (req, res) => {
  const data = req.body;
  const owns = req.user.role === "admin" || (req.user.agencyId && req.user.agencyId === data.id);
  if (!owns) return res.status(403).json({ error: "forbidden" });
  const saved = await Agency.findOneAndUpdate({ id: data.id }, data, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json(saved);
});

// DELETE /api/agencies/:id — admin only (final step of the deletion-request workflow)
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  await Agency.deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
