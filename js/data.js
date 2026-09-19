/* ============================================================
   Timmo — données de démonstration
   C'est le jeu de données PAR DÉFAUT utilisé quand aucune vraie base
   de données n'est connectée. Voir js/db.js pour savoir comment
   remplacer ceci par Firebase ou l'API Node.js sans toucher au code
   de l'interface.
   ============================================================ */

const TI_NEIGHBORHOODS = [
  { id: "almadies", name: "Almadies", lat: 14.7447, lng: -17.5133, img: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=60" },
  { id: "ngor", name: "Ngor", lat: 14.7469, lng: -17.5203, img: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=60" },
  { id: "plateau", name: "Plateau", lat: 14.6708, lng: -17.4313, img: "https://images.unsplash.com/photo-1470723710355-95304d8aece4?auto=format&fit=crop&w=800&q=60" },
  { id: "mermoz", name: "Mermoz", lat: 14.7089, lng: -17.4747, img: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=60" },
  { id: "pointe", name: "Point E", lat: 14.6945, lng: -17.4633, img: "https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=800&q=60" },
  { id: "sacrecoeur", name: "Sacré-Cœur", lat: 14.7161, lng: -17.4694, img: "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&w=800&q=60" },
  { id: "yoff", name: "Yoff", lat: 14.7500, lng: -17.4900, img: "https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=800&q=60" },
  { id: "ouakam", name: "Ouakam", lat: 14.7233, lng: -17.4919, img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=60" },
];

/* ---------- Hiérarchie administrative (Région > Département > Commune) ----------
   Utilisée pour guider le placement d'une annonce dans l'assistant de
   publication. Seuls la région/le département de Dakar ont aujourd'hui des
   communes avec un quartier correspondant dans l'application (hoodId) —
   les autres régions/départements sont inclus pour un sélecteur réaliste,
   mais en choisir un actuellement hors de Dakar laisse simplement le champ
   quartier en saisie manuelle, faute de données de quartier initiales là-bas. */
const TI_ADMIN_REGIONS = [
  { id: "dakar", name: "Dakar" },
  { id: "thies", name: "Thiès" },
  { id: "saint-louis", name: "Saint-Louis" },
  { id: "diourbel", name: "Diourbel" },
  { id: "kaolack", name: "Kaolack" },
  { id: "ziguinchor", name: "Ziguinchor" },
];
const TI_ADMIN_DEPARTMENTS = {
  dakar: [
    { id: "dakar-dept", name: "Dakar" },
    { id: "pikine", name: "Pikine" },
    { id: "guediawaye", name: "Guédiawaye" },
    { id: "rufisque", name: "Rufisque" },
  ],
  thies: [
    { id: "thies-dept", name: "Thiès" },
    { id: "mbour", name: "Mbour" },
    { id: "tivaouane", name: "Tivaouane" },
  ],
  "saint-louis": [{ id: "saint-louis-dept", name: "Saint-Louis" }, { id: "dagana", name: "Dagana" }],
  diourbel: [{ id: "diourbel-dept", name: "Diourbel" }, { id: "mbacke", name: "Mbacké" }],
  kaolack: [{ id: "kaolack-dept", name: "Kaolack" }],
  ziguinchor: [{ id: "ziguinchor-dept", name: "Ziguinchor" }],
};
const TI_ADMIN_COMMUNES = {
  "dakar-dept": [
    { id: "almadies", name: "Almadies", hoodId: "almadies" },
    { id: "ngor", name: "Ngor", hoodId: "ngor" },
    { id: "yoff", name: "Yoff", hoodId: "yoff" },
    { id: "ouakam", name: "Ouakam", hoodId: "ouakam" },
    { id: "mermoz-sacre-coeur", name: "Mermoz-Sacré-Cœur", hoodId: "mermoz" },
    { id: "fann-pointe-amitie", name: "Fann-Point E-Amitié", hoodId: "pointe" },
    { id: "plateau", name: "Plateau", hoodId: "plateau" },
    { id: "grand-dakar", name: "Grand Dakar", hoodId: null },
    { id: "medina", name: "Médina", hoodId: null },
    { id: "parcelles-assainies", name: "Parcelles Assainies", hoodId: null },
  ],
  pikine: [
    { id: "pikine-nord", name: "Pikine Nord", hoodId: null },
    { id: "pikine-est", name: "Pikine Est", hoodId: null },
    { id: "guinaw-rail", name: "Guinaw Rail", hoodId: null },
  ],
  guediawaye: [
    { id: "sam-notaire", name: "Sam Notaire", hoodId: null },
    { id: "golf-sud", name: "Golf Sud", hoodId: null },
  ],
  rufisque: [
    { id: "rufisque-centre", name: "Rufisque Centre", hoodId: null },
    { id: "bargny", name: "Bargny", hoodId: null },
  ],
};

const TI_PHOTO_SETS = {
  apartment: [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=70",
  ],
  house: [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=70",
  ],
  office: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?auto=format&fit=crop&w=1200&q=70",
  ],
  land: [
    "https://images.unsplash.com/photo-1697627903173-e22b6e04734d?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1626834478854-9b5aefd826fd?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1663436296541-f1958f6d3b59?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1624856472328-bfcf71c34741?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1586803555480-d98e84e39cf2?auto=format&fit=crop&w=1200&q=70",
  ]
};

/* Icônes pour la section des caractéristiques du bien (basées sur des emojis,
   fonctionne entièrement hors ligne, sans police d'icônes ni ressource supplémentaire). */
const TI_AMENITY_ICONS = {
  security: "🛡️", elevator: "🛗", balcony: "🌇", ac: "❄️", kitchen: "🍳",
  wifi: "📶", garden: "🌳", parking: "🅿️", generator: "🔌", meeting: "🗣️",
  reception: "🛎️", furnished: "🛋️", pool: "🏊", view: "🏞️",
  fence: "🚧", deed: "📜", road: "🛣️", water: "🚰",
};

/* Ensemble de base des caractéristiques par type de bien. « Meublé/Furnished »
   est ajouté automatiquement pour les annonces où furnished === true. */
const TI_AMENITIES_BY_TYPE = {
  apartment: [
    { icon: "security", label: "Sécurité 24h/24", labelEn: "24/7 security" },
    { icon: "elevator", label: "Ascenseur", labelEn: "Elevator" },
    { icon: "balcony", label: "Balcon", labelEn: "Balcony" },
    { icon: "ac", label: "Climatisation", labelEn: "Air conditioning" },
    { icon: "kitchen", label: "Cuisine équipée", labelEn: "Equipped kitchen" },
    { icon: "wifi", label: "Internet fibre", labelEn: "Fiber internet" },
  ],
  house: [
    { icon: "garden", label: "Jardin", labelEn: "Garden" },
    { icon: "parking", label: "Garage 2 voitures", labelEn: "2-car garage" },
    { icon: "security", label: "Sécurité", labelEn: "Security" },
    { icon: "generator", label: "Groupe électrogène", labelEn: "Backup generator" },
    { icon: "kitchen", label: "Cuisine équipée", labelEn: "Equipped kitchen" },
    { icon: "ac", label: "Climatisation", labelEn: "Air conditioning" },
  ],
  office: [
    { icon: "meeting", label: "Salle de réunion", labelEn: "Meeting room" },
    { icon: "wifi", label: "Internet fibre", labelEn: "Fiber internet" },
    { icon: "parking", label: "Parking sécurisé", labelEn: "Secure parking" },
    { icon: "generator", label: "Groupe électrogène", labelEn: "Backup generator" },
    { icon: "elevator", label: "Ascenseur", labelEn: "Elevator" },
    { icon: "reception", label: "Réception", labelEn: "Reception desk" },
  ],
  land: [
    { icon: "deed", label: "Titre foncier", labelEn: "Land title" },
    { icon: "fence", label: "Clôturé", labelEn: "Fenced" },
    { icon: "water", label: "Viabilisé (eau/électricité)", labelEn: "Serviced (water/electricity)" },
    { icon: "road", label: "Bord de route", labelEn: "Roadside access" },
    { icon: "view", label: "Vue dégagée", labelEn: "Open view" },
  ],
};

function tiBuildAmenities(type, furnished) {
  const list = [...TI_AMENITIES_BY_TYPE[type]];
  if (furnished) list.push({ icon: "furnished", label: "Meublé", labelEn: "Furnished" });
  return list;
}

/* ---------- Catalogue de caractéristiques géré par l'admin ----------
   Données initiales pour la liste, valable pour toute la plateforme, des
   caractéristiques de bien sélectionnables, modifiable par l'administrateur
   (panneau Caractéristiques). Le champ `icon` de chaque élément est un
   caractère emoji brut (pas une clé de correspondance), donc une modification
   ou suppression par l'admin n'affecte jamais le libellé déjà publié sur une
   annonce existante. `types` liste le(s) type(s) de bien pour lesquels cet
   élément est proposé par défaut dans l'assistant de publication de l'agence. */
/* ---------- Tags d'avis ----------
   Un vocabulaire sélectionné et pré-classifié que les clients choisissent en
   laissant un avis, plutôt que de s'appuyer uniquement sur du texte libre.
   Deux avantages réels par rapport au texte libre : (1) rien ici ne peut
   porter une charge d'injection — c'est un ensemble fermé de chaînes fixes
   — et (2) comme chaque tag est déjà classé positif/négatif, les agréger
   sur de nombreux avis donne un signal structuré et réel pour les résumés
   de sentiment ci-dessous, sans avoir besoin de vrai NLP sur des commentaires
   en texte libre. Le texte libre reste disponible pour qui veut ajouter des
   détails, mais ce sont les tags qui portent le signal réel. */
const TI_REVIEW_TAGS = [
  { id: "rt_fast_comm", label: "Communication rapide", labelEn: "Fast communication", sentiment: "positive" },
  { id: "rt_as_described", label: "Bien tel que décrit", labelEn: "Property as described", sentiment: "positive" },
  { id: "rt_professional", label: "Agence professionnelle", labelEn: "Professional agency", sentiment: "positive" },
  { id: "rt_good_value", label: "Bon rapport qualité-prix", labelEn: "Good value for money", sentiment: "positive" },
  { id: "rt_great_location", label: "Emplacement idéal", labelEn: "Great location", sentiment: "positive" },
  { id: "rt_clean", label: "Propreté impeccable", labelEn: "Impeccably clean", sentiment: "positive" },
  { id: "rt_smooth_process", label: "Démarches simples", labelEn: "Smooth process", sentiment: "positive" },
  { id: "rt_responsive_agent", label: "Agent à l'écoute", labelEn: "Attentive agent", sentiment: "positive" },
  { id: "rt_slow_comm", label: "Communication difficile", labelEn: "Difficult communication", sentiment: "negative" },
  { id: "rt_delays", label: "Retards dans le processus", labelEn: "Delays in the process", sentiment: "negative" },
  { id: "rt_not_as_described", label: "Différent des photos", labelEn: "Different from the photos", sentiment: "negative" },
  { id: "rt_overpriced", label: "Prix trop élevé", labelEn: "Overpriced", sentiment: "negative" },
  { id: "rt_poor_location", label: "Emplacement décevant", labelEn: "Disappointing location", sentiment: "negative" },
  { id: "rt_unresolved", label: "Problème non résolu", labelEn: "Unresolved issue", sentiment: "negative" },
  { id: "rt_maintenance", label: "Entretien à améliorer", labelEn: "Maintenance needs work", sentiment: "negative" },
  { id: "rt_paperwork", label: "Démarches compliquées", labelEn: "Complicated paperwork", sentiment: "negative" },
];

const TI_AMENITY_CATALOG_SEED = [
  { id: "am_security", icon: "🛡️", label: "Sécurité 24h/24", labelEn: "24/7 security", types: ["apartment", "house", "office"] },
  { id: "am_cctv", icon: "📹", label: "Vidéosurveillance", labelEn: "CCTV", types: ["apartment", "house", "office"] },
  { id: "am_intercom", icon: "🔔", label: "Interphone", labelEn: "Intercom", types: ["apartment", "house"] },
  { id: "am_gated", icon: "🚪", label: "Résidence fermée", labelEn: "Gated community", types: ["apartment", "house"] },
  { id: "am_guard", icon: "🧑‍✈️", label: "Gardien", labelEn: "On-site guard", types: ["apartment", "house", "office"] },
  { id: "am_elevator", icon: "🛗", label: "Ascenseur", labelEn: "Elevator", types: ["apartment", "office"] },
  { id: "am_balcony", icon: "🌇", label: "Balcon", labelEn: "Balcony", types: ["apartment"] },
  { id: "am_terrace", icon: "🏙️", label: "Terrasse", labelEn: "Terrace", types: ["apartment", "house"] },
  { id: "am_rooftop", icon: "🌆", label: "Rooftop", labelEn: "Rooftop access", types: ["apartment"] },
  { id: "am_garden", icon: "🌳", label: "Jardin", labelEn: "Garden", types: ["house"] },
  { id: "am_pool", icon: "🏊", label: "Piscine", labelEn: "Swimming pool", types: ["house", "apartment"] },
  { id: "am_bbq", icon: "🍖", label: "Espace barbecue", labelEn: "BBQ area", types: ["house"] },
  { id: "am_ac", icon: "❄️", label: "Climatisation", labelEn: "Air conditioning", types: ["apartment", "house", "office"] },
  { id: "am_heating", icon: "🔥", label: "Chauffage", labelEn: "Heating", types: ["apartment", "house"] },
  { id: "am_furnished", icon: "🛋️", label: "Meublé", labelEn: "Furnished", types: ["apartment", "house", "office"] },
  { id: "am_walkin", icon: "👔", label: "Dressing", labelEn: "Walk-in closet", types: ["apartment", "house"] },
  { id: "am_bathtub", icon: "🛁", label: "Baignoire", labelEn: "Bathtub", types: ["apartment", "house"] },
  { id: "am_kitchen", icon: "🍳", label: "Cuisine équipée", labelEn: "Equipped kitchen", types: ["apartment", "house"] },
  { id: "am_dishwasher", icon: "🍽️", label: "Lave-vaisselle", labelEn: "Dishwasher", types: ["apartment", "house"] },
  { id: "am_oven", icon: "🔥", label: "Four", labelEn: "Oven", types: ["apartment", "house"] },
  { id: "am_parking", icon: "🅿️", label: "Parking", labelEn: "Parking", types: ["apartment", "house", "office"] },
  { id: "am_garage", icon: "🚗", label: "Garage", labelEn: "Garage", types: ["house"] },
  { id: "am_generator", icon: "🔌", label: "Groupe électrogène", labelEn: "Backup generator", types: ["apartment", "house", "office"] },
  { id: "am_wifi", icon: "📶", label: "Internet fibre", labelEn: "Fiber internet", types: ["apartment", "house", "office"] },
  { id: "am_solar", icon: "☀️", label: "Panneaux solaires", labelEn: "Solar panels", types: ["house", "office"] },
  { id: "am_borehole", icon: "🚰", label: "Forage / accès eau", labelEn: "Borehole / water access", types: ["house", "land"] },
  { id: "am_gym", icon: "🏋️", label: "Salle de sport", labelEn: "Gym", types: ["apartment"] },
  { id: "am_playground", icon: "🛝", label: "Aire de jeux", labelEn: "Playground", types: ["apartment", "house"] },
  { id: "am_laundry", icon: "🧺", label: "Buanderie", labelEn: "Laundry room", types: ["apartment", "house"] },
  { id: "am_storage", icon: "📦", label: "Local de stockage", labelEn: "Storage room", types: ["apartment", "house", "office"] },
  { id: "am_view", icon: "🏞️", label: "Vue dégagée", labelEn: "Open view", types: ["apartment", "house", "land"] },
  { id: "am_seaview", icon: "🌊", label: "Vue mer", labelEn: "Sea view", types: ["apartment", "house"] },
  { id: "am_meeting", icon: "🗣️", label: "Salle de réunion", labelEn: "Meeting room", types: ["office"] },
  { id: "am_reception", icon: "🛎️", label: "Réception", labelEn: "Reception desk", types: ["office"] },
  { id: "am_openspace", icon: "🏢", label: "Open space", labelEn: "Open space", types: ["office"] },
  { id: "am_serverroom", icon: "🖥️", label: "Salle serveur", labelEn: "Server room", types: ["office"] },
  { id: "am_deed", icon: "📜", label: "Titre foncier", labelEn: "Land title", types: ["land"] },
  { id: "am_fence", icon: "🚧", label: "Clôturé", labelEn: "Fenced", types: ["land"] },
  { id: "am_road", icon: "🛣️", label: "Bord de route", labelEn: "Roadside access", types: ["land"] },
  { id: "am_serviced", icon: "💡", label: "Viabilisé (eau/électricité)", labelEn: "Serviced (water/electricity)", types: ["land"] },
];

const TI_PROPERTIES = [
  {
    id: "p001", createdAt: "2026-05-12T10:00:00.000Z", reference: "SH-2026-00034", type: "apartment", forSale: false, shortStay: false, availableFrom: null,
    title: "Appartement 3 pièces vue mer — Almadies",
    titleEn: "3-room sea-view apartment — Almadies",
    neighborhood: "almadies", price: 450000, bedrooms: 2, bathrooms: 2, area: 95,
    agencyId: "ag001", furnished: true, rating: 4.7, reviews: 12,
    desc: "Bel appartement lumineux à deux pas de la plage des Almadies, résidence sécurisée avec gardien, cuisine équipée et grand balcon face à l'océan.",
    descEn: "Bright apartment steps from Almadies beach, gated residence with guard, equipped kitchen and a large ocean-facing balcony.",
  },
  {
    id: "p002", createdAt: "2026-05-28T10:00:00.000Z", reference: "DP-2026-00061", type: "apartment", forSale: false, shortStay: true, blockedDates: ["2026-08-25", "2026-08-26", "2026-09-02"],
    title: "Studio meublé court séjour — Ngor",
    titleEn: "Furnished short-stay studio — Ngor",
    neighborhood: "ngor", price: 35000, bedrooms: 1, bathrooms: 1, area: 40,
    agencyId: "ag002", furnished: true, rating: 4.5, reviews: 27,
    desc: "Studio cosy idéal pour un séjour de courte durée, à 5 minutes à pied du village de pêcheurs de Ngor et de l'embarcadère pour l'île.",
    descEn: "Cosy studio perfect for a short stay, a 5-minute walk from the Ngor fishing village and the boat dock to the island.",
  },
  {
    id: "p003", createdAt: "2026-06-04T10:00:00.000Z", reference: "SH-2026-00035", type: "house", forSale: true, shortStay: false,
    title: "Villa 5 chambres avec piscine — Ouakam",
    titleEn: "5-bedroom villa with pool — Ouakam",
    neighborhood: "ouakam", price: 185000000, bedrooms: 5, bathrooms: 4, area: 320,
    agencyId: "ag001", furnished: false, rating: 4.9, reviews: 8,
    desc: "Villa familiale de standing avec piscine, jardin arboré et vue dégagée sur la mosquée de la Divinité, proche des écoles internationales.",
    descEn: "Upscale family villa with pool, landscaped garden and open views toward the Mosque of the Divinity, near international schools.",
  },
  {
    id: "p004", createdAt: "2026-06-15T10:00:00.000Z", reference: "TF-2026-00019", type: "house", forSale: false, shortStay: false, availableFrom: "2026-09-15",
    title: "Maison 4 chambres avec cour — Mermoz",
    titleEn: "4-bedroom house with courtyard — Mermoz",
    neighborhood: "mermoz", price: 650000, bedrooms: 4, bathrooms: 3, area: 210,
    agencyId: "ag003", furnished: false, rating: 4.3, reviews: 15,
    desc: "Maison familiale avec cour intérieure ombragée, garage deux voitures et quartier calme et arboré à deux pas de la Corniche.",
    descEn: "Family home with a shaded inner courtyard, two-car garage, quiet leafy neighborhood a short walk from the Corniche.",
  },
  {
    id: "p005", createdAt: "2026-06-22T10:00:00.000Z", reference: "DP-2026-00062", type: "office", forSale: false, shortStay: false, availableFrom: null,
    title: "Bureau open-space 180m² — Plateau",
    titleEn: "180sqm open-space office — Plateau",
    neighborhood: "plateau", price: 1200000, bedrooms: 0, bathrooms: 2, area: 180,
    agencyId: "ag002", furnished: true, rating: 4.6, reviews: 6,
    desc: "Plateau de bureaux climatisé au cœur du quartier des affaires, fibre optique, salle de réunion équipée et parking sécurisé.",
    descEn: "Air-conditioned office floor in the heart of the business district, fiber internet, equipped meeting room and secure parking.",
  },
  {
    id: "p006", createdAt: "2026-07-01T10:00:00.000Z", reference: "TF-2026-00020", type: "office", forSale: true, shortStay: false,
    title: "Immeuble de bureaux 4 niveaux — Point E",
    titleEn: "4-floor office building — Point E",
    neighborhood: "pointe", price: 420000000, bedrooms: 0, bathrooms: 6, area: 640,
    agencyId: "ag003", furnished: false, rating: 4.4, reviews: 4,
    desc: "Immeuble entier à usage de bureaux, ascenseur, groupe électrogène, idéal siège social ou investissement locatif professionnel.",
    descEn: "Entire office building, elevator, backup generator — ideal as a headquarters or a professional rental investment.",
  },
  {
    id: "p007", createdAt: "2026-07-10T10:00:00.000Z", reference: "DP-2026-00063", type: "apartment", forSale: false, shortStay: false, availableFrom: "2026-10-01",
    title: "Appartement 2 pièces — Sacré-Cœur",
    titleEn: "2-room apartment — Sacré-Cœur",
    neighborhood: "sacrecoeur", price: 280000, bedrooms: 1, bathrooms: 1, area: 60,
    agencyId: "ag002", furnished: true, rating: 4.2, reviews: 19,
    desc: "Appartement fonctionnel dans une résidence calme, proche des commerces, écoles et de la VDN.",
    descEn: "Functional apartment in a quiet residence, close to shops, schools and the VDN highway.",
  },
  {
    id: "p008", createdAt: "2026-07-18T10:00:00.000Z", reference: "SH-2026-00036", type: "apartment", forSale: true, shortStay: false,
    title: "Duplex 4 pièces avec terrasse — Yoff",
    titleEn: "4-room duplex with terrace — Yoff",
    neighborhood: "yoff", price: 95000000, bedrooms: 3, bathrooms: 2, area: 140,
    agencyId: "ag001", furnished: false, rating: 4.8, reviews: 10,
    desc: "Duplex neuf avec grande terrasse et vue sur l'aéroport LSS reconverti, quartier en plein essor proche de l'océan.",
    descEn: "Newly built duplex with a large terrace overlooking the redeveloped LSS airport area, a fast-growing neighborhood near the ocean.",
  },
  {
    id: "p009", createdAt: "2026-07-25T10:00:00.000Z", reference: "TF-2026-00021", type: "house", forSale: false, shortStay: true, blockedDates: ["2026-09-10", "2026-09-11", "2026-09-12"],
    title: "Villa de vacances avec jardin — Almadies",
    titleEn: "Vacation villa with garden — Almadies",
    neighborhood: "almadies", price: 120000, bedrooms: 3, bathrooms: 3, area: 180,
    agencyId: "ag003", furnished: true, rating: 4.9, reviews: 21,
    desc: "Villa de standing pour séjours courts, jardin tropical, personnel de maison disponible sur demande, à 10 min de la plage.",
    descEn: "Upscale villa for short stays, tropical garden, household staff available on request, 10 minutes from the beach.",
  },
  {
    id: "p010", createdAt: "2026-08-05T10:00:00.000Z", reference: "DP-2026-00064", type: "office", forSale: false, shortStay: false, availableFrom: null,
    title: "Bureau privé 45m² — Sacré-Cœur",
    titleEn: "45sqm private office — Sacré-Cœur",
    neighborhood: "sacrecoeur", price: 380000, bedrooms: 0, bathrooms: 1, area: 45,
    agencyId: "ag002", furnished: true, rating: 4.1, reviews: 5,
    desc: "Petit bureau indépendant idéal pour freelance ou petite structure, accès sécurisé 24h/24.",
    descEn: "Small independent office ideal for freelancers or a small team, 24/7 secure access.",
  },
  {
    id: "p011", createdAt: "2026-08-14T10:00:00.000Z", reference: "SH-2026-00037", type: "land", forSale: true, shortStay: false,
    title: "Terrain viabilisé 500m² — Yoff",
    titleEn: "500sqm serviced plot — Yoff",
    neighborhood: "yoff", price: 65000000, bedrooms: 0, bathrooms: 0, area: 500,
    agencyId: "ag001", furnished: false, rating: 4.5, reviews: 7,
    desc: "Terrain plat et viabilisé avec titre foncier, idéal pour construction résidentielle, à 10 minutes de la plage de Yoff.",
    descEn: "Flat, serviced plot with land title, ideal for residential construction, 10 minutes from Yoff beach.",
  },
  {
    id: "p012", createdAt: "2026-08-22T10:00:00.000Z", reference: "TF-2026-00022", type: "land", forSale: true, shortStay: false,
    title: "Terrain clôturé 800m² — Sacré-Cœur",
    titleEn: "800sqm fenced plot — Sacré-Cœur",
    neighborhood: "sacrecoeur", price: 95000000, bedrooms: 0, bathrooms: 0, area: 800,
    agencyId: "ag003", furnished: false, rating: 4.3, reviews: 3,
    desc: "Grand terrain clôturé en bord de route, vue dégagée, proche des commerces et des grands axes.",
    descEn: "Large fenced plot on a roadside, open view, close to shops and major roads.",
  },
];

const TI_AGENCY_TIERS = [
  { id: "standard", label: "Standard", labelEn: "Standard", maxAgents: 2, maxListings: 10, monthlyFee: 15000 },
  { id: "pro", label: "Pro", labelEn: "Pro", maxAgents: 5, maxListings: 30, monthlyFee: 35000 },
  { id: "premium", label: "Premium", labelEn: "Premium", maxAgents: 15, maxListings: 100, monthlyFee: 75000 },
];

const TI_AGENCIES = [
  { id: "ag001", name: "Sahel Habitat", code: "SH", email: "contact@sahelhabitat.sn", phone: "+221 77 123 45 67", address: "Rue 12, Almadies, Dakar", tier: "pro", maxAgents: 5, maxListings: 30, verified: true, subscriptionStatus: "active", subscribedSince: "2026-03-01" },
  { id: "ag002", name: "Dakar Prestige Immobilier", code: "DP", email: "contact@dakarprestige.sn", phone: "+221 76 234 56 78", address: "Avenue Cheikh Anta Diop, Fann, Dakar", tier: "premium", maxAgents: 15, maxListings: 100, verified: true, subscriptionStatus: "active", subscribedSince: "2026-01-15" },
  { id: "ag003", name: "Teranga Foncier", code: "TF", email: "contact@terangafoncier.sn", phone: "+221 78 345 67 89", address: "Route de Ouakam, Dakar", tier: "standard", maxAgents: 2, maxListings: 10, verified: false, subscriptionStatus: "past_due", subscribedSince: "2026-04-01" },
];

/* Ajoute les champs calculés (photos, panoramas de visite, coordonnées) au
   chargement, pour que les données initiales restent compactes et que chaque
   type garde une galerie distincte. */
(function tiEnrichProperties() {
  // Valeurs de démo réalistes pour les fonctionnalités de modération/analytique —
  // une ligne par bien dans l'ordre initial (p001..p012) : statut de validation
  // et nombre de vues.
  const TI_SEED_STATUS = ["active", "active", "active", "rented", "active", "pending", "active", "sold", "active", "pending", "active", "active"];
  const TI_SEED_VIEWS =  [145, 89, 210, 67, 34, 3, 52, 178, 95, 1, 40, 120];
  TI_PROPERTIES.forEach((p, i) => {
    const set = TI_PHOTO_SETS[p.type];
    p.photos = set;
    p.cover = set[0];
    p.amenities = tiBuildAmenities(p.type, p.furnished);
    p.listingStatus = TI_SEED_STATUS[i] || "active";
    p.views = TI_SEED_VIEWS[i] ?? 0;
    const nb = TI_NEIGHBORHOODS.find(n => n.id === p.neighborhood);
    // léger décalage aléatoire pour que les repères ne se superposent pas exactement
    p.lat = nb.lat + (((i * 37) % 10) - 5) * 0.0018;
    p.lng = nb.lng + (((i * 53) % 10) - 5) * 0.0018;
  });
})();

function tiPropertyTitle(p) {
  return tiGetLang() === "en" && p.titleEn ? p.titleEn : p.title;
}
function tiPropertyDesc(p) {
  return tiGetLang() === "en" && p.descEn ? p.descEn : p.desc;
}
function tiNeighborhoodName(id) {
  const n = TI_NEIGHBORHOODS.find(n => n.id === id);
  return n ? n.name : id;
}
function tiAgencyName(id) {
  const a = TI_AGENCIES.find(a => a.id === id);
  return a ? a.name : id;
}
