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
// Logo : image PNG, JPEG ou WebP encodée en base64, 300 Ko maximum.
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const LOGO_MAX = 300 * 1024;

router.post("/", authenticate, async (req, res) => {
  const data = req.body || {};
  if (!data.id || typeof data.id !== "string") return res.status(400).json({ error: "invalid_id" });
  const isAdmin = req.user.role === "admin";
  const owns = isAdmin || (req.user.agencyId && req.user.agencyId === data.id);
  if (!owns) return res.status(403).json({ error: "forbidden" });

  let update = data;
  if (!isAdmin) {
    // Une agence ne modifie que ses propres réglages : jamais son statut,
    // sa vérification, son abonnement ni l'activation de son site dédié.
    update = { id: data.id };
    if (Array.isArray(data.welcomeKit)) update.welcomeKit = data.welcomeKit;
    if (data.logoDataUrl !== undefined) {
      if (req.user.agentRole !== "supervisor") return res.status(403).json({ error: "supervisor_only" });
      update.logoDataUrl = data.logoDataUrl;
    }
    // Une agence existe déjà (créée à l'inscription) : pas de création ici.
    const exists = await Agency.exists({ id: data.id });
    if (!exists) return res.status(404).json({ error: "not_found" });
  }
  if (update.logoDataUrl !== undefined && update.logoDataUrl !== null && update.logoDataUrl !== "") {
    if (typeof update.logoDataUrl !== "string" || update.logoDataUrl.length > LOGO_MAX || !LOGO_RE.test(update.logoDataUrl)) {
      return res.status(400).json({ error: "invalid_logo" });
    }
  }
  const saved = await Agency.findOneAndUpdate({ id: data.id }, update, { upsert: isAdmin, new: true, setDefaultsOnInsert: true });
  res.json(saved);
});

// DELETE /api/agencies/:id — admin only (final step of the deletion-request workflow)
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  await Agency.deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
