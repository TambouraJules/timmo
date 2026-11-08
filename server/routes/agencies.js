const router = require("express").Router();
const { Agency } = require("../models/models");
const { authenticate, requireRole } = require("../middleware/auth");

// GET /api/agencies — public (agency profile pages, sub-sites, listings).
// Les pièces de vérification des propriétaires (identité, justificatif de
// propriété) ne sont JAMAIS renvoyées ici : seulement leur statut.
const PRIVATE_FIELDS = "-verification.idDoc -verification.proofDoc";
router.get("/", async (req, res) => {
  const agencies = await Agency.find().select(PRIVATE_FIELDS).sort({ createdAt: -1 });
  res.json(agencies);
});

// GET /api/agencies/:id/verification — pièces de vérification : le titulaire du compte ou l'administration.
router.get("/:id/verification", authenticate, async (req, res) => {
  const isAdmin = req.user.role === "admin";
  if (!isAdmin && req.user.agencyId !== req.params.id) return res.status(403).json({ error: "forbidden" });
  const a = await Agency.findOne({ id: req.params.id }).select("verification").lean();
  if (!a) return res.status(404).json({ error: "not_found" });
  res.json(a.verification || null);
});

// Pièces de vérification : PDF ou image en base64, 4 Mo maximum chacune.
const DOC_RE = /^data:(application\/pdf|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/;
const DOC_MAX = Math.ceil(4 * 1024 * 1024 * 1.37);
const PROOF_TYPES = ["titre_foncier", "deliberation", "acte_vente", "facture", "autre"];
function tiCleanVerificationDoc(d) {
  if (!d || typeof d !== "object") return null;
  if (typeof d.fileData !== "string" || d.fileData.length > DOC_MAX || !DOC_RE.test(d.fileData)) return null;
  return { fileName: String(d.fileName || "document").slice(0, 120), fileData: d.fileData };
}

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
    // Demande de vérification (propriétaire) : le statut part toujours en « en attente »,
    // seule l'administration valide ou refuse.
    if (data.verification !== undefined) {
      if (req.user.agentRole !== "supervisor") return res.status(403).json({ error: "supervisor_only" });
      const v = data.verification || {};
      const idDoc = tiCleanVerificationDoc(v.idDoc), proofDoc = tiCleanVerificationDoc(v.proofDoc);
      if (!idDoc || !proofDoc) return res.status(400).json({ error: "invalid_documents" });
      update.verification = {
        status: "pending", idDoc, proofDoc,
        proofType: PROOF_TYPES.includes(v.proofType) ? v.proofType : "autre",
        phone: String(v.phone || "").slice(0, 30),
        submittedAt: new Date().toISOString(),
      };
      update.verified = false;
    }
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
  const saved = await Agency.findOneAndUpdate({ id: data.id }, update, { upsert: isAdmin, new: true, setDefaultsOnInsert: true }).select(PRIVATE_FIELDS);
  res.json(saved);
});

// DELETE /api/agencies/:id — admin only (final step of the deletion-request workflow)
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  await Agency.deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
