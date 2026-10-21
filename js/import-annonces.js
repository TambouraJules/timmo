/* ============================================================
   Timmo — import rapide d'annonces (réservé à l'administration)
   ------------------------------------------------------------
   L'admin met en ligne les annonces d'une agence à sa place :
   coller le texte reçu (WhatsApp, Facebook…) → remplissage
   automatique des champs → photos → vérification → publication.
   Chaque fiche est enregistrée via TiDB.saveProperty, exactement
   comme une annonce créée depuis l'espace agence.
   ============================================================ */

const TI_IMP_TYPES = [
  { id: "apartment", label: "Appartement" },
  { id: "house", label: "Maison / Villa" },
  { id: "office", label: "Bureau / Local" },
  { id: "land", label: "Terrain" },
];
const TI_IMP_KINDS = [
  { id: "rent", label: "Location" },
  { id: "sale", label: "Vente" },
  { id: "short", label: "Courte durée" },
];
const TI_IMP_MAX_PHOTOS = 10; // même limite que le formulaire agence et l'API

let TI_IMP_CARDS = [];      // [{ uid, photos: [dataUrl|url], status: "draft"|"done"|"error", error }]
let TI_IMP_AGENCIES = [];
let TI_IMP_PROPS = [];
let TI_IMP_UID = 0;

/* ---------- Démarrage ---------- */
(async function tiImpInit() {
  tiRenderHeader();
  tiRenderFooter();
  const session = tiGetSession();
  if (!session || session.role !== "admin") {
    window.location.href = "login.html?role=admin";
    return;
  }
  try {
    [TI_IMP_AGENCIES, TI_IMP_PROPS] = await Promise.all([TiDB.getAgencies(), TiDB.getProperties()]);
  } catch (e) {
    tiToast("Impossible de charger les agences — vérifiez la connexion.");
  }
  const sel = document.getElementById("imp-agency");
  sel.innerHTML = `<option value="">— Choisir l'agence —</option>` + TI_IMP_AGENCIES
    .filter(a => a.status !== "suspended")
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map(a => `<option value="${tiEscapeHtml(a.id)}">${tiEscapeHtml(a.name || a.id)}</option>`).join("");
  sel.addEventListener("change", tiImpUpdateQuota);
  tiImpAddCard();
})();

function tiImpUpdateQuota() {
  const id = document.getElementById("imp-agency").value;
  const out = document.getElementById("imp-agency-quota");
  if (!id) { out.textContent = ""; return; }
  const agency = TI_IMP_AGENCIES.find(a => a.id === id) || {};
  const tier = (typeof TI_AGENCY_TIERS !== "undefined" ? TI_AGENCY_TIERS : []).find(t => t.id === agency.tier);
  const max = agency.maxListings || (tier && tier.maxListings) || null;
  const count = TI_IMP_PROPS.filter(p => p.agencyId === id && p.deletionStatus !== "pending").length;
  out.textContent = max ? `${count} annonce(s) existante(s) · limite du forfait : ${max}` : `${count} annonce(s) existante(s)`;
  tiImpRefreshSummary();
}

/* ---------- Fiches ---------- */
function tiImpAddCard(values) {
  const uid = ++TI_IMP_UID;
  TI_IMP_CARDS.push({ uid, photos: [], status: "draft", error: null });
  const wrap = document.createElement("article");
  wrap.className = "ti-imp-card";
  wrap.id = `imp-card-${uid}`;
  const opts = (list) => list.map(o => `<option value="${o.id}">${o.label}</option>`).join("");
  const hoods = TI_NEIGHBORHOODS.map(n => `<option value="${n.id}">${tiEscapeHtml(n.name)}</option>`).join("");
  wrap.innerHTML = `
    <div class="ti-imp-card-head">
      <h3>Annonce n° <span class="ti-imp-num"></span></h3>
      <div style="display:flex;gap:12px;align-items:center;">
        <span class="ti-imp-pill" data-role="pill">À compléter</span>
        <button type="button" class="ti-imp-remove" onclick="tiImpRemoveCard(${uid})">Retirer</button>
      </div>
    </div>
    <div class="ti-imp-paste">
      <textarea data-f="raw" placeholder="Collez ici le texte de l'annonce reçu sur WhatsApp ou Facebook…"></textarea>
      <button type="button" class="btn btn-outline btn-sm" onclick="tiImpAutofill(${uid})">Remplir automatiquement</button>
    </div>
    <div class="ti-imp-grid">
      <div class="field span-4"><label>Titre</label><input type="text" data-f="title" maxlength="90" placeholder="Ex. Appartement 3 chambres vue mer — Almadies"></div>
      <div class="field"><label>Type</label><select data-f="type">${opts(TI_IMP_TYPES)}</select></div>
      <div class="field"><label>Offre</label><select data-f="kind">${opts(TI_IMP_KINDS)}</select></div>
      <div class="field"><label>Quartier</label><select data-f="hood"><option value="">—</option>${hoods}</select></div>
      <div class="field"><label>Prix (FCFA)</label><input type="number" min="0" step="1000" data-f="price" placeholder="450000"></div>
      <div class="field"><label>Chambres</label><input type="number" min="0" data-f="beds"></div>
      <div class="field"><label>Salles de bain</label><input type="number" min="0" data-f="baths"></div>
      <div class="field"><label>Surface (m²)</label><input type="number" min="0" data-f="area"></div>
      <label class="ti-imp-check"><input type="checkbox" data-f="furnished"> Meublé</label>
      <div class="field span-4"><label>Description</label><textarea data-f="desc" rows="3"></textarea></div>
      <div class="field span-4"><label>Lien de visite 3D ou vidéo (facultatif)</label><input type="url" data-f="tour" placeholder="Matterport, Kuula, CloudPano, YouTube ou Vimeo"></div>
      <div class="field span-4">
        <label>Photos (la première sert de couverture)</label>
        <div class="ti-imp-drop" data-role="drop">Glissez les photos ici ou <u>cliquez pour choisir</u> — ${TI_IMP_MAX_PHOTOS} max.</div>
        <input type="file" accept="image/*" multiple hidden data-role="file">
        <div class="ti-imp-thumbs" data-role="thumbs"></div>
      </div>
    </div>`;
  document.getElementById("imp-cards").appendChild(wrap);

  const drop = wrap.querySelector('[data-role="drop"]');
  const file = wrap.querySelector('[data-role="file"]');
  drop.addEventListener("click", () => file.click());
  file.addEventListener("change", () => { tiImpAddPhotos(uid, file.files); file.value = ""; });
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("is-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("is-over"); tiImpAddPhotos(uid, e.dataTransfer.files); });
  wrap.querySelectorAll("[data-f]").forEach(el => el.addEventListener("input", () => tiImpRefreshCard(uid)));
  wrap.querySelectorAll("select[data-f], input[type=checkbox][data-f]").forEach(el => el.addEventListener("change", () => tiImpRefreshCard(uid)));

  if (values) tiImpSetValues(uid, values);
  tiImpRenumber();
  tiImpRefreshCard(uid);
  return uid;
}

function tiImpRemoveCard(uid) {
  TI_IMP_CARDS = TI_IMP_CARDS.filter(c => c.uid !== uid);
  const el = document.getElementById(`imp-card-${uid}`);
  if (el) el.remove();
  tiImpRenumber();
  tiImpRefreshSummary();
}

function tiImpRenumber() {
  document.querySelectorAll(".ti-imp-card .ti-imp-num").forEach((el, i) => { el.textContent = i + 1; });
}

function tiImpField(uid, name) {
  return document.querySelector(`#imp-card-${uid} [data-f="${name}"]`);
}
function tiImpSetValues(uid, v) {
  const set = (name, val) => {
    const el = tiImpField(uid, name);
    if (!el || val === undefined || val === null || val === "") return;
    if (el.type === "checkbox") el.checked = !!val; else el.value = val;
  };
  ["title", "type", "kind", "hood", "price", "beds", "baths", "area", "furnished", "desc", "tour"].forEach(k => set(k, v[k]));
  if (Array.isArray(v.photos) && v.photos.length) {
    const card = TI_IMP_CARDS.find(c => c.uid === uid);
    card.photos.push(...v.photos.slice(0, TI_IMP_MAX_PHOTOS));
    tiImpRenderThumbs(uid);
  }
}
function tiImpGetValues(uid) {
  const v = name => { const el = tiImpField(uid, name); return el ? (el.type === "checkbox" ? el.checked : el.value.trim()) : ""; };
  return {
    title: v("title"), type: v("type"), kind: v("kind"), hood: v("hood"),
    price: parseFloat(v("price")), beds: parseInt(v("beds"), 10), baths: parseInt(v("baths"), 10),
    area: parseFloat(v("area")), furnished: v("furnished"), desc: v("desc"), tour: v("tour"),
  };
}

/** Une fiche est « prête » si l'essentiel est là — dont au moins une vraie photo
 *  (jamais de photo d'illustration générique sur une annonce réelle). */
function tiImpMissing(uid) {
  const v = tiImpGetValues(uid);
  const card = TI_IMP_CARDS.find(c => c.uid === uid);
  const miss = [];
  if (!v.title) miss.push("titre");
  if (!v.hood) miss.push("quartier");
  if (!(v.price > 0)) miss.push("prix");
  if (!card || !card.photos.length) miss.push("photo");
  if (v.tour && !tiTourEmbed(v.tour)) miss.push("lien de visite valide");
  return miss;
}

function tiImpRefreshCard(uid) {
  const card = TI_IMP_CARDS.find(c => c.uid === uid);
  const el = document.getElementById(`imp-card-${uid}`);
  if (!card || !el) return;
  const pill = el.querySelector('[data-role="pill"]');
  el.classList.toggle("is-done", card.status === "done");
  if (card.status === "done") { pill.className = "ti-imp-pill ok"; pill.textContent = "Publiée ✓"; }
  else if (card.status === "error") { pill.className = "ti-imp-pill err"; pill.textContent = "Erreur : " + (card.error || "réessayez"); }
  else {
    const miss = tiImpMissing(uid);
    el.classList.toggle("is-ready", !miss.length);
    pill.className = "ti-imp-pill" + (miss.length ? "" : " ok");
    pill.textContent = miss.length ? "Manque : " + miss.join(", ") : "Prête";
  }
  tiImpRefreshSummary();
}

function tiImpRefreshSummary() {
  const ready = TI_IMP_CARDS.filter(c => c.status !== "done" && !tiImpMissing(c.uid).length).length;
  const done = TI_IMP_CARDS.filter(c => c.status === "done").length;
  document.getElementById("imp-summary").textContent =
    `${ready} prête(s) à publier` + (done ? ` · ${done} déjà publiée(s)` : "");
  document.getElementById("imp-publish").disabled = !ready;
}

/* ---------- Photos ---------- */
async function tiImpAddPhotos(uid, fileList) {
  const card = TI_IMP_CARDS.find(c => c.uid === uid);
  if (!card) return;
  const files = [...fileList].filter(f => f.type.startsWith("image/"));
  for (const f of files) {
    if (card.photos.length >= TI_IMP_MAX_PHOTOS) { tiToast(`${TI_IMP_MAX_PHOTOS} photos maximum par annonce`); break; }
    try { card.photos.push(await tiCompressImageFile(f, 1280, 0.72)); }
    catch (e) { tiToast(`Image illisible : ${f.name}`); }
  }
  tiImpRenderThumbs(uid);
  tiImpRefreshCard(uid);
}
function tiImpRenderThumbs(uid) {
  const card = TI_IMP_CARDS.find(c => c.uid === uid);
  const box = document.querySelector(`#imp-card-${uid} [data-role="thumbs"]`);
  if (!card || !box) return;
  box.innerHTML = "";
  card.photos.forEach((src, i) => {
    const d = document.createElement("div");
    d.className = "ti-imp-thumb";
    const img = document.createElement("img");
    img.src = src; img.alt = "";
    const del = document.createElement("button");
    del.type = "button"; del.textContent = "×"; del.title = "Retirer";
    del.onclick = () => { card.photos.splice(i, 1); tiImpRenderThumbs(uid); tiImpRefreshCard(uid); };
    d.append(img, del);
    if (i === 0) { const c = document.createElement("span"); c.className = "cover"; c.textContent = "Couverture"; d.append(c); }
    else { img.style.cursor = "pointer"; img.title = "Mettre en couverture"; img.onclick = () => { card.photos.unshift(card.photos.splice(i, 1)[0]); tiImpRenderThumbs(uid); }; }
    box.appendChild(d);
  });
}

/* ---------- Remplissage automatique depuis un texte libre ---------- */
function tiImpNorm(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
/** Analyse une annonce rédigée librement (WhatsApp, Facebook…) en français. */
function tiImpParse(raw) {
  const text = (raw || "").replace(/\r/g, "");
  const n = tiImpNorm(text);
  const out = {};

  // Type
  if (/\bterrain|\bparcelle|\blot\b/.test(n)) out.type = "land";
  else if (/\bbureau|local commercial|\bmagasin|\bboutique|\bentrepot|plateau de bureaux/.test(n)) out.type = "office";
  else if (/\bvilla|\bmaison|\bduplex|\btriplex/.test(n)) out.type = "house";
  else if (/\bappart|\bstudio|\bchambre salon|\bf[1-7]\b|\bt[1-7]\b|\bpieces?\b/.test(n)) out.type = "apartment";

  // Offre
  if (/\ba vendre|\bvente\b|\bvends?\b|\bprix de vente/.test(n)) out.kind = "sale";
  else if (/\bpar (jour|nuit)|\b\/ ?(jour|nuit)\b|\bcourt sejour|\bjournaliere?|\bnuitee/.test(n)) out.kind = "short";
  else if (/\ba louer|\blocation|\bloyer|\/ ?mois|\bpar mois|\bmensuel/.test(n)) out.kind = "rent";

  // Meublé
  if (/\bmeuble/.test(n) && !/\bnon[- ]meuble/.test(n)) out.furnished = true;

  // Quartier
  const hood = TI_NEIGHBORHOODS.find(h => n.includes(tiImpNorm(h.name)) || n.includes(h.id));
  if (hood) out.hood = hood.id;

  // Chambres / pièces
  let m = n.match(/(\d+)\s*(chambres?|chbr?s?|ch\b|cbr)/);
  if (m) out.beds = parseInt(m[1], 10);
  else if ((m = n.match(/\b[ft]\s?([1-7])\b/))) out.beds = Math.max(parseInt(m[1], 10) - 1, 0);
  else if ((m = n.match(/(\d+)\s*pieces?/))) out.beds = Math.max(parseInt(m[1], 10) - 1, 0);
  else if (/\bstudio/.test(n)) out.beds = 1;

  // Salles de bain
  m = n.match(/(\d+)\s*(salles? de bains?|salles? d'eau|sdb|toilettes|douches?|wc)/);
  if (m) out.baths = parseInt(m[1], 10);

  // Surface
  m = n.match(/(\d[\d\s.,]*)\s*(m2|m²|metres? carres?|mcarre)/);
  if (m) out.area = Math.round(parseFloat(m[1].replace(/\s/g, "").replace(",", ".")));

  // Prix : « 450 000 F », « 450.000 FCFA », « 1,5 million », « 45 millions », « 350k »
  // Nombre isolé (pas collé à une lettre, ex. « m2 ») : « 850 000 », « 850.000 », « 1,5 », « 350 »
  const priceRe = /(?<![\w,.])(\d{1,3}(?:[ .\u00a0]\d{3})+|\d+(?:[.,]\d+)?)\s*(milliards?|millions?|mio|m\b|k\b)?\s*(f\s?cfa|fcfa|cfa|francs?|xof|f\b)?/g;
  let best = 0;
  for (const pm of n.matchAll(priceRe)) {
    const unit = pm[2] || "", cur = pm[3] || "";
    if (!unit && !cur) continue;          // un nombre seul (téléphone, surface…) n'est pas un prix
    let num = parseFloat(pm[1].replace(/[\s\u00a0]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    if (!isFinite(num)) continue;
    if (/^milliard/.test(unit)) num *= 1e9;
    else if (/^(million|mio|m$)/.test(unit)) num *= 1e6;
    else if (unit === "k") num *= 1e3;
    if (num >= 1000 && num > best) best = num;
  }
  if (best) out.price = Math.round(best);

  // Lien de visite (YouTube, Matterport…) souvent présent dans les messages WhatsApp
  for (const m of text.matchAll(/https:\/\/[^\s<>"']+/g)) {
    if (tiTourEmbed(m[0])) { out.tour = m[0]; break; }
  }

  // Description : texte d'origine sans les numéros de téléphone (les contacts passent par la plateforme)
  out.desc = text
    .replace(out.tour ? out.tour : /$^/, "")
    .replace(/(\+?221[\s.-]?)?\b(7[05678]|33)[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, "")
    .replace(/\b(contacts?|contactez|appel(ez|er)?|tel|tél|whatsapp|vid[ée]o|visite( 3d| virtuelle)?|lien)\s*:?\s*(?=[\n.,;]|$)/gim, "")
    .replace(/\b(contacts?|contactez|appel(ez|er)?|tel|tél|whatsapp|vid[ée]o|visite( 3d| virtuelle)?|lien)\s*:?\s*(?=[\n.,;]|$)/gim, "")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  // Titre : première ligne utile, sinon titre construit
  const firstLine = text.split("\n").map(l => l.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}*_~]/gu, "").trim()).find(l => l.length > 6);
  const isStudio = /\bstudio/.test(n) && out.type === "apartment";
  const typeLabel = isStudio ? "Studio" : { apartment: "Appartement", house: "Villa", office: "Bureau", land: "Terrain" }[out.type || "apartment"];
  const built = `${typeLabel}${out.beds && !isStudio && out.type !== "land" && out.type !== "office" ? ` ${out.beds} chambre${out.beds > 1 ? "s" : ""}` : ""}${out.furnished ? " meublé" : ""}${hood ? " — " + hood.name : ""}`;
  // Titre construit dès qu'on a reconnu le bien (plus propre qu'un texte WhatsApp), sinon 1re ligne
  out.title = (out.type && (hood || out.beds) ? built : (firstLine && firstLine.length <= 90 ? firstLine : built)).slice(0, 90);
  return out;
}

function tiImpAutofill(uid) {
  const raw = tiImpField(uid, "raw").value;
  if (!raw.trim()) { tiToast("Collez d'abord le texte de l'annonce"); return; }
  const parsed = tiImpParse(raw);
  // On ne remplace que les champs vides, pour ne pas écraser une correction manuelle
  ["title", "type", "kind", "hood", "price", "beds", "baths", "area", "desc", "tour"].forEach(k => {
    const el = tiImpField(uid, k);
    if (parsed[k] === undefined || !el) return;
    const isDefaultSelect = el.tagName === "SELECT" && (k === "type" || k === "kind");
    if (!el.value || isDefaultSelect) el.value = parsed[k];
  });
  if (parsed.furnished) tiImpField(uid, "furnished").checked = true;
  tiImpRefreshCard(uid);
  tiToast("Champs remplis — vérifiez puis ajoutez les photos");
}

/* ---------- Import depuis un tableau ---------- */
const TI_IMP_COLS = ["titre", "type", "offre", "quartier", "prix", "chambres", "sdb", "surface", "meuble", "description", "photos", "visite"];

function tiImpFromTable() {
  const raw = document.getElementById("imp-csv").value.trim();
  if (!raw) { tiToast("Collez d'abord les lignes du tableau"); return; }
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const sep = lines[0].includes("\t") ? "\t" : (lines[0].split(";").length > lines[0].split(",").length ? ";" : ",");
  const split = l => l.split(sep).map(c => c.trim().replace(/^"(.*)"$/, "$1"));
  const header = split(lines[0]).map(h => tiImpNorm(h).replace(/[^a-z]/g, ""));
  const idx = name => header.indexOf(name);
  if (idx("titre") < 0 && idx("prix") < 0) { tiToast("En-têtes non reconnus — utilisez le modèle"); return; }
  const typeOf = s => { const x = tiImpNorm(s); return /villa|maison/.test(x) ? "house" : /bureau|local|magasin/.test(x) ? "office" : /terrain|parcelle/.test(x) ? "land" : "apartment"; };
  const kindOf = s => { const x = tiImpNorm(s); return /vente|vendre/.test(x) ? "sale" : /court|jour|nuit/.test(x) ? "short" : "rent"; };
  const hoodOf = s => { const x = tiImpNorm(s); const h = TI_NEIGHBORHOODS.find(h => x && (x.includes(tiImpNorm(h.name)) || x === h.id)); return h ? h.id : ""; };
  // Retire la fiche vide de départ si personne ne l'a remplie
  TI_IMP_CARDS.filter(c => !tiImpGetValues(c.uid).title && !c.photos.length).forEach(c => tiImpRemoveCard(c.uid));
  let created = 0;
  lines.slice(1).forEach(l => {
    const c = split(l);
    const get = name => (idx(name) >= 0 ? c[idx(name)] || "" : "");
    const parsedPrice = tiImpParse(get("prix") + " FCFA").price;
    tiImpAddCard({
      title: get("titre"), type: typeOf(get("type")), kind: kindOf(get("offre")), hood: hoodOf(get("quartier")),
      price: parsedPrice || parseFloat(get("prix").replace(/\s/g, "")) || "",
      beds: get("chambres"), baths: get("sdb"), area: get("surface"),
      furnished: /^(oui|yes|1|x|vrai|true)$/i.test(get("meuble")), desc: get("description"),
      photos: get("photos").split(/\s+/).filter(u => /^https:\/\//.test(u)),
      tour: get("visite").trim(),
    });
    created++;
  });
  tiToast(`${created} fiche(s) créée(s) — ajoutez les photos manquantes puis publiez`);
}

function tiImpDownloadTemplate() {
  const rows = [
    TI_IMP_COLS.join(";"),
    "Appartement 3 chambres vue mer;appartement;location;Almadies;450000;3;2;120;oui;Résidence sécurisée avec gardien et groupe électrogène;",
    "Villa avec piscine;villa;vente;Ngor;250000000;5;4;400;non;Grande villa R+1 sur 500 m² de terrain;",
  ];
  const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "modele-import-annonces-timmo.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Publication ---------- */
async function tiImpPublishAll() {
  const agencyId = document.getElementById("imp-agency").value;
  if (!agencyId) { tiToast("Choisissez d'abord l'agence"); document.getElementById("imp-agency").focus(); return; }
  const status = document.getElementById("imp-status").value;
  const ready = TI_IMP_CARDS.filter(c => c.status !== "done" && !tiImpMissing(c.uid).length);
  if (!ready.length) return;
  const agency = TI_IMP_AGENCIES.find(a => a.id === agencyId);
  if (!confirm(`Publier ${ready.length} annonce(s) pour « ${agency ? agency.name : agencyId} » ?`)) return;

  const btn = document.getElementById("imp-publish");
  tiSetBtnLoading(btn, true);
  let ok = 0;
  for (const card of ready) {
    const v = tiImpGetValues(card.uid);
    const nb = TI_NEIGHBORHOODS.find(n => n.id === v.hood) || { lat: 14.7167, lng: -17.4677 };
    const prop = {
      id: "p_" + Date.now() + "_" + card.uid,
      agencyId, rating: 0, reviews: 0, views: 0,
      listingStatus: status, createdAt: new Date().toISOString(),
      reference: await TiDB.nextPropertyReference(agencyId),
      type: v.type, forSale: v.kind === "sale", shortStay: v.kind === "short",
      title: v.title, titleEn: v.title,
      neighborhood: v.hood, price: v.price,
      bedrooms: isFinite(v.beds) ? v.beds : 0, bathrooms: isFinite(v.baths) ? v.baths : 1,
      area: isFinite(v.area) ? v.area : null, furnished: !!v.furnished,
      desc: v.desc, descEn: v.desc,
      photos: card.photos.slice(), cover: card.photos[0],
      tourUrl: v.tour && tiTourEmbed(v.tour) ? v.tour : "",
      amenities: [], availableFrom: null, blockedDates: [],
      lat: nb.lat + (Math.random() - 0.5) * 0.01, lng: nb.lng + (Math.random() - 0.5) * 0.01,
      importedByAdmin: true,
    };
    try {
      await TiDB.saveProperty(prop);
      card.status = "done"; card.error = null; ok++;
      TI_IMP_PROPS.push(prop);
    } catch (e) {
      card.status = "error";
      card.error = e && e.status === 413 ? "photos trop lourdes" : "échec d'enregistrement";
    }
    tiImpRefreshCard(card.uid);
  }
  tiSetBtnLoading(btn, false);
  tiImpUpdateQuota();
  tiToast(`${ok} annonce(s) publiée(s)` + (ok < ready.length ? ` · ${ready.length - ok} en erreur` : ""));
}
