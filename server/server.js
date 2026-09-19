/* ============================================================
   Timmo API — Node.js / Express / MongoDB
   Optional real backend. See ../README.md for setup steps.
   ============================================================ */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const propertiesRoutes = require("./routes/properties");
const miscRoutes = require("./routes/misc");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/properties", propertiesRoutes);
app.use("/api", miscRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, service: "timmo-api" }));

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/timmo";

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Timmo API listening on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    console.error("Check MONGODB_URI in server/.env — see server/.env.example");
    process.exit(1);
  });
