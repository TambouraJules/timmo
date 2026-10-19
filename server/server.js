/* ============================================================
   API Timmo — Node.js / Express / MongoDB
   Backend réel optionnel. Voir ../README.md pour les étapes d'installation.
   ============================================================ */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const propertiesRoutes = require("./routes/properties");
const agenciesRoutes = require("./routes/agencies");
const usersRoutes = require("./routes/users");
const miscRoutes = require("./routes/misc");

const app = express();
app.set("etag", false); // les données changent en continu (annonces, statuts...) ; jamais de 304 basé sur un cache potentiellement périmé
// CORS : seuls les sites Timmo peuvent appeler l'API depuis un navigateur.
// Les appels sans en-tête Origin (serveur à serveur, ex. notifications PayDunya,
// applications mobiles, outils comme curl) ne sont pas concernés par CORS.
// Pour ajouter un domaine sans toucher au code : variable CORS_ORIGINS sur Render,
// liste séparée par des virgules (ex. "https://admin.timmo.sn,https://autre.app").
const TI_ALLOWED_ORIGINS = [
  "https://www.timmo.sn",
  "https://timmo.sn",
  "https://timmo-six.vercel.app",
  ...(process.env.CORS_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean),
];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (TI_ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true); // développement local
    return cb(null, false); // origine inconnue : pas d'en-têtes CORS, le navigateur bloque
  },
}));
app.use(express.json({ limit: "12mb" }));

app.use("/api/properties", propertiesRoutes);
app.use("/api/agencies", agenciesRoutes);
app.use("/api/users", usersRoutes);
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
