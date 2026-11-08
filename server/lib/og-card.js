/* ============================================================
   Timmo — carte d'aperçu des annonces (image Open Graph 1200 × 630)

   C'est l'image que WhatsApp, Facebook, LinkedIn, Telegram… affichent
   quand on partage le lien d'un bien : la photo du bien, le prix, le type
   d'offre, le quartier, les chiffres clés et l'agence, aux couleurs Timmo.

   Les informations importantes sont centrées : WhatsApp découpe parfois
   l'image en carré au centre (petit aperçu), elles restent alors lisibles.

   Rendu : satori (mise en page → SVG, textes vectorisés avec la police
   Inter fournie) puis sharp (SVG → JPEG léger, < 300 Ko, accepté partout).
   ============================================================ */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const W = 1200, H = 630;
const CLAY = "#BF6A3D", NAVY = "#0D1B2A", SUN = "#F3C64B", CREAM = "#F7F3EE";
const DATA_DIR = path.join(__dirname, "..", "data");

let satoriFn = null;
async function getSatori() {
  if (!satoriFn) { const m = require("satori"); satoriFn = m.default || m; }
  return satoriFn;
}

function fontFile(weight) {
  return fs.readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
}
let FONTS = null;
function getFonts() {
  if (!FONTS) FONTS = [400, 600, 800].map(weight => ({ name: "Inter", data: fontFile(weight), weight, style: "normal" }));
  return FONTS;
}

/** N'importe quelle image (SVG, PNG, JPEG, WebP) → PNG/JPEG en data URL, à la taille voulue. */
async function toDataUrl(input, width, height, fit = "cover", format = "png") {
  let img = sharp(input, { density: 300 }).resize(width, height, { fit, position: "attention", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const buf = format === "jpeg" ? await img.jpeg({ quality: 82 }).toBuffer() : await img.png().toBuffer();
  return `data:image/${format};base64,${buf.toString("base64")}`;
}

let LOGO_CACHE = null;
async function timmoLogo() {
  if (!LOGO_CACHE) LOGO_CACHE = await toDataUrl(fs.readFileSync(path.join(DATA_DIR, "timmo-logo-white.svg")), 230, 72, "contain");
  return LOGO_CACHE;
}

/** Récupère la photo de couverture : URL https (avec délai maximal) ou image stockée en base (data:). */
async function loadPhoto(cover) {
  if (!cover) return null;
  try {
    let buf;
    const m = /^data:image\/(?:jpeg|png|webp);base64,(.+)$/.exec(cover);
    if (m) buf = Buffer.from(m[1], "base64");
    else if (/^https:\/\//.test(cover)) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(cover, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 15 * 1024 * 1024) return null;
    } else return null;
    return await toDataUrl(buf, W, H, "cover", "jpeg");
  } catch (e) {
    return null;
  }
}

async function loadAgencyLogo(logo) {
  if (!logo) return null;
  try {
    let buf;
    const m = /^data:image\/[a-z+]+;base64,(.+)$/.exec(logo);
    if (m) buf = Buffer.from(m[1], "base64");
    else if (logo.startsWith("file:")) buf = fs.readFileSync(logo.slice(5));
    else return null;
    return await toDataUrl(buf, 88, 88, "contain");
  } catch (e) {
    return null;
  }
}

const fcfa = n => (Number(n) || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " FCFA";
const initials = name => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

/** Petit utilitaire pour décrire les éléments sans JSX. */
function h(type, style, children, extra) {
  return { type, props: { style: { display: "flex", ...style }, ...(extra || {}), children } };
}

/**
 * card = { offer: "À LOUER", price, priceSuffix: "/ mois", title, place, facts: ["2 ch.", …],
 *          agencyName, agencyLogo (data:… ou file:…), cover, has3d, demo }
 * Renvoie un Buffer JPEG 1200 × 630.
 */
async function renderPropertyCard(card) {
  const [satori, photo, logo, agencyLogo] = await Promise.all([
    getSatori(), loadPhoto(card.cover), timmoLogo(), loadAgencyLogo(card.agencyLogo),
  ]);

  const pill = (text, bg, color) => h("div", {
    backgroundColor: bg, color, fontSize: 22, fontWeight: 800, letterSpacing: 2,
    padding: "9px 20px", borderRadius: 999,
  }, text);

  const background = photo
    ? h("img", { position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" }, undefined, { src: photo, width: W, height: H })
    : h("div", { position: "absolute", left: 0, top: 0, width: W, height: H, backgroundImage: `linear-gradient(135deg, ${CLAY}, #8E4A28)` });

  const agencyBadge = card.agencyName ? h("div", {
    alignItems: "center", gap: 14, backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 999,
    padding: "7px 22px 7px 7px", marginTop: 18, textShadow: "none",
  }, [
    agencyLogo
      ? h("img", { width: 44, height: 44, borderRadius: 999, objectFit: "contain", backgroundColor: "#fff" }, undefined, { src: agencyLogo, width: 44, height: 44 })
      : h("div", { width: 44, height: 44, borderRadius: 999, backgroundColor: NAVY, color: "#fff", fontSize: 18, fontWeight: 800, alignItems: "center", justifyContent: "center" }, initials(card.agencyName)),
    h("div", { color: NAVY, fontSize: 22, fontWeight: 600 }, card.agencyName),
  ]) : null;

  const tree = h("div", { width: W, height: H, position: "relative", fontFamily: "Inter", backgroundColor: NAVY }, [
    background,
    // Voile sombre progressif pour que le texte reste lisible sur toutes les photos
    h("div", { position: "absolute", left: 0, top: 0, width: W, height: H,
      backgroundImage: "linear-gradient(180deg, rgba(13,27,42,0.6) 0%, rgba(13,27,42,0) 28%, rgba(13,27,42,0) 40%, rgba(13,27,42,0.75) 66%, rgba(13,27,42,0.95) 100%)" }),
    // Haut : logo Timmo et étiquettes, centrés
    h("div", { position: "absolute", top: 34, left: 0, width: W, flexDirection: "column", alignItems: "center", gap: 18 }, [
      h("img", { width: 230, height: 72 }, undefined, { src: logo, width: 230, height: 72 }),
      h("div", { gap: 12 }, [
        pill(card.offer, CLAY, "#fff"),
        card.has3d ? pill("VISITE 3D", "rgba(255,255,255,0.95)", NAVY) : null,
        card.demo ? pill("DÉMO", SUN, NAVY) : null,
      ].filter(Boolean)),
    ]),
    // Bas : prix, titre, lieu et chiffres clés, centrés
    h("div", { position: "absolute", left: 60, right: 60, bottom: 34, flexDirection: "column", alignItems: "center", textAlign: "center", textShadow: "0 2px 14px rgba(0,0,0,0.45)" }, [
      h("div", { alignItems: "baseline", gap: 12, color: "#fff" }, [
        h("div", { fontSize: 68, fontWeight: 800, letterSpacing: -2, color: "#fff" }, card.price),
        card.priceSuffix ? h("div", { fontSize: 34, fontWeight: 600, color: SUN }, card.priceSuffix) : null,
      ].filter(Boolean)),
      h("div", { fontSize: 32, fontWeight: 600, color: "#fff", marginTop: 2, maxWidth: 1040, justifyContent: "center", lineClamp: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }, card.title),
      h("div", { fontSize: 25, color: "rgba(255,255,255,0.92)", marginTop: 10, gap: 14, alignItems: "center" },
        [card.place, ...(card.facts || [])].filter(Boolean).map((txt, i) => h("div", { alignItems: "center", gap: 14 }, [
          i ? h("div", { width: 7, height: 7, borderRadius: 999, backgroundColor: SUN }) : null,
          h("div", {}, txt),
        ].filter(Boolean)))),
      agencyBadge,
    ].filter(Boolean)),
  ]);

  const svg = await satori(tree, { width: W, height: H, fonts: getFonts() });
  return sharp(Buffer.from(svg)).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

/** Données de carte communes aux annonces réelles et de démonstration. */
function cardFromProperty(p, { place, agencyName, agencyLogo, demo }) {
  const TYPE = { apartment: "Appartement", house: "Maison / Villa", office: "Bureau", land: "Terrain" };
  const facts = [];
  if (p.bedrooms) facts.push(`${p.bedrooms} ch.`);
  if (p.bathrooms) facts.push(`${p.bathrooms} sdb`);
  if (p.area) facts.push(`${p.area} m²`);
  if (!p.bedrooms && TYPE[p.type]) facts.unshift(TYPE[p.type]);
  return {
    offer: p.forSale ? "À VENDRE" : (p.shortStay ? "COURT SÉJOUR" : "À LOUER"),
    price: fcfa(p.price),
    priceSuffix: p.forSale ? "" : (p.shortStay ? "/ nuit" : "/ mois"),
    title: p.title || "",
    place, facts, agencyName, agencyLogo, demo,
    cover: p.cover || (Array.isArray(p.photos) && p.photos[0]) || "",
    has3d: !!(p.has3d || p.tourUrl || p.tour),
  };
}

module.exports = { renderPropertyCard, cardFromProperty, fcfa };
