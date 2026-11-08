/* ============================================================
   Liens de partage des annonces : https://www.timmo.sn/p/<référence>
   (Vercel redirige /p/... vers cette route, voir vercel.json).

   WhatsApp, Facebook, LinkedIn… n'exécutent pas le JavaScript des pages :
   pour afficher un VRAI aperçu, il faut une page HTML déjà remplie côté
   serveur. Cette page contient les balises Open Graph (titre, prix, chiffres
   clés, agence) et une image « carte » générée pour le bien (photo + prix +
   quartier + agence, voir lib/og-card.js), puis renvoie immédiatement le
   visiteur vers la fiche du bien.

   Vercel envoie aussi ici les robots d'aperçu qui ouvrent directement
   /property.html?id=… (lien copié depuis la barre d'adresse).

   Les annonces du site de démonstration (demo.timmo.sn) n'existent que dans
   le navigateur : leur aperçu vient de data/demo-listings.json et elles sont
   toujours signalées « Démo ».
   ============================================================ */
const router = require("express").Router();
const crypto = require("crypto");
const path = require("path");
const { Property, Agency } = require("../models/models");
const { renderPropertyCard, cardFromProperty, fcfa } = require("../lib/og-card");

const SITE = (process.env.FRONTEND_URL || "https://www.timmo.sn").replace(/\/+$/, "");
const DEMO_SITE = (process.env.DEMO_URL || "https://demo.timmo.sn").replace(/\/+$/, "");
const FALLBACK_IMAGE = `${SITE}/assets/brand/og-image.png`;
const DEMO_LISTINGS = require("../data/demo-listings.json");
const HOODS = require("../data/neighborhoods.json");
const DEMO_LOGO_DIR = path.join(__dirname, "..", "data", "demo-logos");

const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const TYPE_LABEL = { apartment: "Appartement", house: "Maison / Villa", office: "Bureau", land: "Terrain" };
const REF_RE = /^[A-Za-z0-9_-]{2,40}$/;

/* ---------- Sources des annonces ---------- */

/** Seules les annonces visibles publiquement ont un aperçu (jamais une annonce en attente ou retirée). */
async function tiFindPublicProperty(ref) {
  if (typeof ref !== "string" || !REF_RE.test(ref)) return null;
  const p = await Property.findOne({ $or: [{ reference: ref.toUpperCase() }, { id: ref }] }).lean();
  if (!p) return null;
  const visible = (!p.listingStatus || p.listingStatus === "active") && p.deletionStatus !== "pending";
  return visible ? p : null;
}
function tiPlaceName(p) {
  const id = p.neighborhood || "";
  if (HOODS[id]) return HOODS[id];
  const raw = p.neighborhoodName || p.communeName || p.commune || id;
  return String(raw).replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
async function tiRealListing(ref) {
  const p = await tiFindPublicProperty(ref);
  if (!p) return null;
  const agency = p.agencyId ? await Agency.findOne({ id: p.agencyId }).lean() : null;
  return {
    p, site: SITE, demo: false, place: tiPlaceName(p),
    agencyName: agency && agency.name, agencyLogo: agency && agency.logoDataUrl,
    version: `${p.updatedAt ? new Date(p.updatedAt).getTime() : ""}-${agency && agency.updatedAt ? new Date(agency.updatedAt).getTime() : ""}`,
  };
}
function tiDemoListing(ref) {
  if (typeof ref !== "string" || !REF_RE.test(ref)) return null;
  const p = DEMO_LISTINGS.find(x => x.id === ref || (x.reference && x.reference === ref.toUpperCase()));
  if (!p || p.listingStatus !== "active") return null;
  return {
    p, site: DEMO_SITE, demo: true, place: p.neighborhood,
    agencyName: p.agency && p.agency.name,
    agencyLogo: p.agencyId ? `file:${path.join(DEMO_LOGO_DIR, `${p.agencyId}.svg`)}` : null,
    version: "demo1",
  };
}

/* ---------- Textes de l'aperçu ---------- */

function tiOfferWord(p) { return p.forSale ? "À vendre" : (p.shortStay ? "Court séjour" : "À louer"); }
function tiPriceLine(p) { return `${fcfa(p.price)}${p.forSale ? "" : (p.shortStay ? " / nuit" : " / mois")}`; }
function tiFacts(p) {
  return [
    p.bedrooms ? `${p.bedrooms} chambre${p.bedrooms > 1 ? "s" : ""}` : (TYPE_LABEL[p.type] || ""),
    p.bathrooms ? `${p.bathrooms} sdb` : "",
    p.area ? `${p.area} m²` : "",
    p.furnished && p.type !== "land" ? "meublé" : "",
  ].filter(Boolean);
}

/* ---------- Image « carte » (mise en cache) ---------- */

const CARD_CACHE = new Map();                       // clé → Buffer JPEG (les 80 dernières)
async function tiCardBuffer(L) {
  const key = `${L.demo ? "d" : "r"}:${L.p.id}:${L.version}`;
  if (CARD_CACHE.has(key)) return CARD_CACHE.get(key);
  const buf = await renderPropertyCard(cardFromProperty(L.p, { place: L.place, agencyName: L.agencyName, agencyLogo: L.agencyLogo, demo: L.demo }));
  CARD_CACHE.set(key, buf);
  if (CARD_CACHE.size > 80) CARD_CACHE.delete(CARD_CACHE.keys().next().value);
  return buf;
}
/** Change quand le bien change : WhatsApp et Facebook reprennent alors la nouvelle image. */
function tiCardVersion(L) {
  return crypto.createHash("sha1").update(`${L.p.id}:${L.version}:${L.p.price}:${L.p.title}`).digest("hex").slice(0, 10);
}

/* ---------- Page d'aperçu ---------- */

function tiPreviewHtml(L, via) {
  const { p, site, demo } = L;
  const slug = demo ? p.id : (p.reference || p.id);
  const base = `${site}/p/${encodeURIComponent(slug)}`;
  const target = `${site}/property.html?id=${encodeURIComponent(p.id)}&utm_source=share&utm_medium=${encodeURIComponent(String(via || "link").slice(0, 20))}`;
  const image = `${base}/card.jpg?v=${tiCardVersion(L)}`;
  const title = `${demo ? "[Démo] " : ""}${tiOfferWord(p)} · ${p.title}`;
  const rating = p.rating ? ` · ★ ${String(p.rating).replace(".", ",")}` : "";
  const desc = `${tiPriceLine(p)} · ${tiFacts(p).join(" · ")}${L.agencyName ? ` · ${L.agencyName}` : ""}${rating}. `
    + (demo ? "Annonce fictive du site de démonstration Timmo." : `Photos, carte, visite et contact sur Timmo.${p.reference ? ` Réf. ${p.reference}` : ""}`);
  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Timmo</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(site)}/property.html?id=${esc(encodeURIComponent(p.id))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Timmo — Teranga Immobilière">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${esc(base)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(`${p.title} · ${tiPriceLine(p)}`)}">
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
</body></html>`;
}

function tiNotFound(res, site) {
  const target = `${site}/listings.html`;
  res.status(404).set("Cache-Control", "public, max-age=300");
  return res.send(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${esc(target)}"><title>Annonce indisponible — Timmo</title><meta property="og:title" content="Annonce indisponible — Timmo"><meta property="og:image" content="${esc(FALLBACK_IMAGE)}"><p>Cette annonce n'est plus disponible. <a href="${esc(target)}">Voir les autres biens</a></p>`);
}
function tiSendPage(res, L, site, via) {
  if (!L) return tiNotFound(res, site);
  res.set("Cache-Control", "public, max-age=600, s-maxage=600");
  res.send(tiPreviewHtml(L, via));
}
async function tiSendCard(res, L) {
  if (!L) return res.redirect(302, FALLBACK_IMAGE);
  try {
    const buf = await tiCardBuffer(L);
    res.set("Content-Type", "image/jpeg").set("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.send(buf);
  } catch (e) {
    console.error("[share] carte d'aperçu impossible :", e.message);
    res.redirect(302, FALLBACK_IMAGE);
  }
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/* ---------- Routes (démo d'abord : plus spécifiques) ---------- */

router.get("/demo/:ref/card.jpg", wrap((req, res) => tiSendCard(res, tiDemoListing(req.params.ref))));
router.get("/demo/:ref", wrap((req, res) => tiSendPage(res, tiDemoListing(req.params.ref), DEMO_SITE, req.query.via)));

router.get("/:ref/card.jpg", wrap(async (req, res) => tiSendCard(res, await tiRealListing(req.params.ref))));
router.get("/:ref", wrap(async (req, res) => tiSendPage(res, await tiRealListing(req.params.ref), SITE, req.query.via)));

// GET /api/share/:ref/image — photo de couverture brute (liens déjà partagés)
router.get("/:ref/image", wrap(async (req, res) => {
  const p = await tiFindPublicProperty(req.params.ref);
  const cover = p && (p.cover || (Array.isArray(p.photos) && p.photos[0]));
  if (!cover) return res.redirect(302, FALLBACK_IMAGE);
  if (/^https:\/\//.test(cover)) return res.redirect(302, cover);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(cover);
  if (!m) return res.redirect(302, FALLBACK_IMAGE);
  res.set("Content-Type", m[1]).set("Cache-Control", "public, max-age=86400");
  res.send(Buffer.from(m[2], "base64"));
}));

module.exports = router;
