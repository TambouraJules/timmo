/* ============================================================
   Liens de partage des annonces : https://www.timmo.sn/p/<référence>
   (Vercel redirige /p/... vers cette route, voir vercel.json).

   WhatsApp, Facebook, LinkedIn… n'exécutent pas le JavaScript des pages :
   pour afficher un VRAI aperçu (photo du bien, prix, quartier), il faut
   une page HTML déjà remplie côté serveur. Cette page contient les balises
   Open Graph, puis renvoie immédiatement le visiteur vers la fiche du bien.
   ============================================================ */
const router = require("express").Router();
const { Property, Agency } = require("../models/models");

const SITE = (process.env.FRONTEND_URL || "https://www.timmo.sn").replace(/\/+$/, "");
const FALLBACK_IMAGE = `${SITE}/assets/brand/og-image.png`;

const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fcfa = n => (Number(n) || 0).toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA";
const TYPE_LABEL = { apartment: "Appartement", house: "Maison / Villa", office: "Bureau", land: "Terrain" };

/** Seules les annonces visibles publiquement ont un aperçu (jamais une annonce en attente ou retirée). */
async function tiFindPublicProperty(ref) {
  if (typeof ref !== "string" || !/^[A-Za-z0-9_-]{2,40}$/.test(ref)) return null;
  const p = await Property.findOne({ $or: [{ reference: ref.toUpperCase() }, { id: ref }] }).lean();
  if (!p) return null;
  const visible = (!p.listingStatus || p.listingStatus === "active") && p.deletionStatus !== "pending";
  return visible ? p : null;
}

function tiPriceLine(p) {
  if (p.forSale) return `${fcfa(p.price)} · à vendre`;
  return `${fcfa(p.price)} / ${p.shortStay ? "nuit" : "mois"}`;
}

// GET /api/share/:ref — page d'aperçu + redirection vers la fiche
router.get("/:ref", async (req, res) => {
  const p = await tiFindPublicProperty(req.params.ref);
  const target = p
    ? `${SITE}/property.html?id=${encodeURIComponent(p.id)}&utm_source=share&utm_medium=${encodeURIComponent(String(req.query.via || "link").slice(0, 20))}`
    : `${SITE}/listings.html`;
  if (!p) {
    res.status(404).set("Cache-Control", "public, max-age=300");
    return res.send(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${esc(target)}"><title>Annonce indisponible — Timmo</title><p>Cette annonce n'est plus disponible. <a href="${esc(target)}">Voir les autres biens</a></p>`);
  }
  const agency = p.agencyId ? await Agency.findOne({ id: p.agencyId }).lean() : null;
  const ref = p.reference || p.id;
  const shareUrl = `${SITE}/p/${encodeURIComponent(ref)}`;
  const title = `${p.title} · ${tiPriceLine(p)}`;
  const facts = [
    TYPE_LABEL[p.type],
    p.bedrooms ? `${p.bedrooms} chambre${p.bedrooms > 1 ? "s" : ""}` : "",
    p.area ? `${p.area} m²` : "",
    p.furnished ? "meublé" : "",
  ].filter(Boolean).join(" · ");
  const desc = `${facts}${agency && agency.name ? ` — proposé par ${agency.name}` : ""}. Photos, carte et contact sur Timmo, Teranga Immobilière.`;
  const cover = p.cover || (Array.isArray(p.photos) && p.photos[0]) || "";
  // Les photos envoyées par les agences sont stockées en base (data:…) : on les sert via /p/<ref>/image.
  const image = /^https:\/\//.test(cover) ? cover : (cover ? `${shareUrl}/image` : FALLBACK_IMAGE);

  res.set("Cache-Control", "public, max-age=600");
  res.send(`<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Timmo</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(SITE)}/property.html?id=${esc(encodeURIComponent(p.id))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Timmo — Teranga Immobilière">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${esc(shareUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(p.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<style>body{font-family:sans-serif;background:#F7F3EE;color:#0D1B2A;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:20px}a{color:#BF6A3D;font-weight:700}</style>
</head><body>
<p>Ouverture de l'annonce…<br><a href="${esc(target)}">${esc(p.title)}</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`);
});

// GET /api/share/:ref/image — photo de couverture (quand elle est stockée en base)
router.get("/:ref/image", async (req, res) => {
  const p = await tiFindPublicProperty(req.params.ref);
  const cover = p && (p.cover || (Array.isArray(p.photos) && p.photos[0]));
  if (!cover) return res.redirect(302, FALLBACK_IMAGE);
  if (/^https:\/\//.test(cover)) return res.redirect(302, cover);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(cover);
  if (!m) return res.redirect(302, FALLBACK_IMAGE);
  res.set("Content-Type", m[1]).set("Cache-Control", "public, max-age=86400");
  res.send(Buffer.from(m[2], "base64"));
});

module.exports = router;
