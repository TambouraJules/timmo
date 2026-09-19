const router = require("express").Router();
const { Agency } = require("../models/models");

// GET /api/agencies
router.get("/", async (req, res) => {
  const agencies = await Agency.find().sort({ createdAt: -1 });
  res.json(agencies);
});

// POST /api/agencies  (create or update — upsert by business id)
router.post("/", async (req, res) => {
  const data = req.body;
  const saved = await Agency.findOneAndUpdate({ id: data.id }, data, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json(saved);
});

// DELETE /api/agencies/:id
router.delete("/:id", async (req, res) => {
  await Agency.deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
