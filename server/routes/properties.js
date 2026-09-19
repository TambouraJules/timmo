const router = require("express").Router();
const { Property } = require("../models/models");

// GET /api/properties
router.get("/", async (req, res) => {
  const properties = await Property.find().sort({ createdAt: -1 });
  res.json(properties);
});

// GET /api/properties/:id
router.get("/:id", async (req, res) => {
  const property = await Property.findOne({ id: req.params.id });
  if (!property) return res.status(404).json({ error: "not_found" });
  res.json(property);
});

// POST /api/properties  (create or update — upsert by business id)
router.post("/", async (req, res) => {
  const data = req.body;
  const saved = await Property.findOneAndUpdate({ id: data.id }, data, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json(saved);
});

// DELETE /api/properties/:id
router.delete("/:id", async (req, res) => {
  await Property.deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
