const router = require("express").Router();
const { Property } = require("../models/models");
const { authenticate, requireRole } = require("../middleware/auth");

// GET /api/properties — public (listings pages, search, browsing)
router.get("/", async (req, res) => {
  const properties = await Property.find().sort({ createdAt: -1 });
  res.json(properties);
});

// GET /api/properties/:id — public (property detail page)
router.get("/:id", async (req, res) => {
  const property = await Property.findOne({ id: req.params.id });
  if (!property) return res.status(404).json({ error: "not_found" });
  res.json(property);
});

// POST /api/properties/:id/view — public: anonymous visitors browsing a
// property page increment its view count. Was called by the frontend's
// recordView() but never actually existed as a route.
router.post("/:id/view", async (req, res) => {
  await Property.findOneAndUpdate({ id: req.params.id }, { $inc: { views: 1 } });
  res.json({ ok: true });
});

// POST /api/properties (create or update — upsert by business id) —
// requires the owning agency (checked against the existing record when
// updating, or the submitted agencyId when creating) or an admin.
router.post("/", authenticate, async (req, res) => {
  const data = req.body;
  const existing = data.id ? await Property.findOne({ id: data.id }) : null;
  const targetAgencyId = existing ? existing.agencyId : data.agencyId;
  const owns = req.user.role === "admin" || (req.user.agencyId && req.user.agencyId === targetAgencyId);
  if (!owns) return res.status(403).json({ error: "forbidden" });
  const saved = await Property.findOneAndUpdate({ id: data.id }, data, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json(saved);
});

// PATCH /api/properties/:id/status — was missing entirely even though the
// frontend's setListingStatus() already called it (admin moderation and
// agency "mark as rented/sold" were both silently broken in API mode).
router.patch("/:id/status", authenticate, async (req, res) => {
  const existing = await Property.findOne({ id: req.params.id });
  if (!existing) return res.status(404).json({ error: "not_found" });
  const owns = req.user.role === "admin" || (req.user.agencyId && req.user.agencyId === existing.agencyId);
  if (!owns) return res.status(403).json({ error: "forbidden" });
  const saved = await Property.findOneAndUpdate({ id: req.params.id }, { listingStatus: req.body.status }, { new: true });
  res.json(saved);
});

// DELETE /api/properties/:id — admin only: agencies go through the
// soft-delete request workflow (requestPropertyDeletion), never a direct
// delete; only an admin's approval ever reaches this route.
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  await Property.deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
