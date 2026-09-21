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
/* ============================================================
   Hiérarchie administrative du Sénégal — Région → Département →
   Arrondissement → Commune.
   Couverture : les 14 régions et les 46 départements sont complets
   et exacts. Le niveau détaillé (arrondissements + plusieurs
   communes) est fourni pour la région de Dakar, où se concentre
   l'essentiel des annonces de la plateforme. Pour les autres
   départements, chaque arrondissement contient au moins la commune
   chef-lieu (le département porte presque toujours le nom de sa
   ville principale au Sénégal) — le champ libre "quartier / rue"
   permet de préciser au-delà de cette commune. Cette liste pourra
   être enrichie avec d'autres communes au fil du temps.
   ============================================================ */
const TI_ADMIN_REGIONS = [
  { id: "dakar", name: "Dakar", lat: 14.7167, lng: -17.4677 },
  { id: "thies", name: "Thiès", lat: 14.7910, lng: -16.9359 },
  { id: "diourbel", name: "Diourbel", lat: 14.6559, lng: -16.2333 },
  { id: "fatick", name: "Fatick", lat: 14.3390, lng: -16.4111 },
  { id: "kaolack", name: "Kaolack", lat: 14.1517, lng: -16.0728 },
  { id: "kaffrine", name: "Kaffrine", lat: 14.1059, lng: -15.5508 },
  { id: "kolda", name: "Kolda", lat: 12.8939, lng: -14.9412 },
  { id: "kedougou", name: "Kédougou", lat: 12.5556, lng: -12.1747 },
  { id: "louga", name: "Louga", lat: 15.6173, lng: -16.2242 },
  { id: "matam", name: "Matam", lat: 15.6559, lng: -13.2554 },
  { id: "saint-louis", name: "Saint-Louis", lat: 16.0326, lng: -16.4818 },
  { id: "sedhiou", name: "Sédhiou", lat: 12.7081, lng: -15.5569 },
  { id: "tambacounda", name: "Tambacounda", lat: 13.7707, lng: -13.6673 },
  { id: "ziguinchor", name: "Ziguinchor", lat: 12.5833, lng: -16.2719 },
];

const TI_ADMIN_DEPARTMENTS = {
  dakar: [
    { id: "dakar-dept", name: "Dakar" },
    { id: "guediawaye", name: "Guédiawaye" },
    { id: "pikine", name: "Pikine" },
    { id: "rufisque", name: "Rufisque" },
    { id: "keur-massar", name: "Keur Massar" },
  ],
  thies: [
    { id: "thies-dept", name: "Thiès" },
    { id: "mbour", name: "Mbour" },
    { id: "tivaouane", name: "Tivaouane" },
  ],
  diourbel: [
    { id: "diourbel-dept", name: "Diourbel" },
    { id: "bambey", name: "Bambey" },
    { id: "mbacke", name: "Mbacké" },
  ],
  fatick: [
    { id: "fatick-dept", name: "Fatick" },
    { id: "foundiougne", name: "Foundiougne" },
    { id: "gossas", name: "Gossas" },
  ],
  kaolack: [
    { id: "kaolack-dept", name: "Kaolack" },
    { id: "guinguineo", name: "Guinguinéo" },
    { id: "nioro-du-rip", name: "Nioro du Rip" },
  ],
  kaffrine: [
    { id: "kaffrine-dept", name: "Kaffrine" },
    { id: "birkilane", name: "Birkilane" },
    { id: "koungheul", name: "Koungheul" },
    { id: "malem-hodar", name: "Malem Hodar" },
  ],
  kolda: [
    { id: "kolda-dept", name: "Kolda" },
    { id: "medina-yoro-foulah", name: "Médina Yoro Foulah" },
    { id: "velingara", name: "Vélingara" },
  ],
  kedougou: [
    { id: "kedougou-dept", name: "Kédougou" },
    { id: "salemata", name: "Salémata" },
    { id: "saraya", name: "Saraya" },
  ],
  louga: [
    { id: "louga-dept", name: "Louga" },
    { id: "kebemer", name: "Kébémer" },
    { id: "linguere", name: "Linguère" },
  ],
  matam: [
    { id: "matam-dept", name: "Matam" },
    { id: "kanel", name: "Kanel" },
    { id: "ranerou-ferlo", name: "Ranérou Ferlo" },
  ],
  "saint-louis": [
    { id: "saint-louis-dept", name: "Saint-Louis" },
    { id: "dagana", name: "Dagana" },
    { id: "podor", name: "Podor" },
  ],
  sedhiou: [
    { id: "sedhiou-dept", name: "Sédhiou" },
    { id: "bounkiling", name: "Bounkiling" },
    { id: "goudomp", name: "Goudomp" },
  ],
  tambacounda: [
    { id: "tambacounda-dept", name: "Tambacounda" },
    { id: "bakel", name: "Bakel" },
    { id: "goudiry", name: "Goudiry" },
    { id: "koumpentoum", name: "Koumpentoum" },
  ],
  ziguinchor: [
    { id: "ziguinchor-dept", name: "Ziguinchor" },
    { id: "bignona", name: "Bignona" },
    { id: "oussouye", name: "Oussouye" },
  ],
};

/* Arrondissements par département. Pour Dakar (détail riche), les
   communes vivent sous l'arrondissement. Pour les autres départements,
   un arrondissement unique porte le nom du département et regroupe
   ses communes connues. */
const TI_ADMIN_ARRONDISSEMENTS = {
  "dakar-dept": [
    { id: "plateau-goree", name: "Plateau / Gorée" },
    { id: "grand-dakar", name: "Grand Dakar" },
    { id: "parcelles-assainies-arr", name: "Parcelles Assainies" },
    { id: "almadies-arr", name: "Almadies" },
  ],
  guediawaye: [{ id: "guediawaye-arr", name: "Guédiawaye" }],
  pikine: [
    { id: "pikine-dagoudane", name: "Pikine Dagoudane" },
    { id: "thiaroye-arr", name: "Thiaroye" },
  ],
  rufisque: [
    { id: "rufisque-arr", name: "Rufisque" },
    { id: "sangalkam-arr", name: "Sangalkam" },
  ],
  "keur-massar": [{ id: "keur-massar-arr", name: "Keur Massar" }],
};
function tiDefaultArrondissement(deptId, deptName) {
  return [{ id: deptId + "-arr", name: deptName }];
}

const TI_ADMIN_COMMUNES = {
  "plateau-goree": [
    { id: "plateau", name: "Plateau", hoodId: "plateau" },
    { id: "goree", name: "Gorée", hoodId: null },
    { id: "fann-point-e-amitie", name: "Fann-Point E-Amitié", hoodId: null },
    { id: "medina", name: "Médina", hoodId: null },
    { id: "gueule-tapee-fass-colobane", name: "Gueule Tapée-Fass-Colobane", hoodId: null },
  ],
  "grand-dakar": [
    { id: "grand-dakar", name: "Grand Dakar", hoodId: null },
    { id: "biscuiterie", name: "Biscuiterie", hoodId: null },
    { id: "hlm", name: "HLM", hoodId: null },
    { id: "sicap-liberte", name: "Sicap-Liberté", hoodId: null },
    { id: "dieuppeul-derkle", name: "Dieuppeul-Derklé", hoodId: null },
    { id: "hann-bel-air", name: "Hann Bel-Air", hoodId: null },
  ],
  "parcelles-assainies-arr": [
    { id: "parcelles-assainies", name: "Parcelles Assainies", hoodId: null },
    { id: "camberene", name: "Camberène", hoodId: null },
    { id: "patte-d-oie", name: "Patte d'Oie", hoodId: null },
    { id: "grand-yoff", name: "Grand Yoff", hoodId: null },
  ],
  "almadies-arr": [
    { id: "ngor", name: "Ngor", hoodId: "ngor" },
    { id: "ouakam", name: "Ouakam", hoodId: "ouakam" },
    { id: "yoff", name: "Yoff", hoodId: "yoff" },
    { id: "mermoz-sacre-coeur", name: "Mermoz-Sacré-Cœur", hoodId: "mermoz" },
  ],
  "guediawaye-arr": [
    { id: "golf-sud", name: "Golf Sud", hoodId: null },
    { id: "medina-gounass", name: "Médina Gounass", hoodId: null },
    { id: "ndiareme", name: "Ndiarème", hoodId: null },
    { id: "sam", name: "Sam", hoodId: null },
    { id: "wakhinane-nimzatt", name: "Wakhinane Nimzatt", hoodId: null },
  ],
  "pikine-dagoudane": [
    { id: "dalifort", name: "Dalifort", hoodId: null },
    { id: "pikine-nord", name: "Pikine Nord", hoodId: null },
    { id: "pikine-est", name: "Pikine Est", hoodId: null },
    { id: "pikine-ouest", name: "Pikine Ouest", hoodId: null },
    { id: "guinaw-rail-nord", name: "Guinaw Rail Nord", hoodId: null },
    { id: "guinaw-rail-sud", name: "Guinaw Rail Sud", hoodId: null },
    { id: "tivaouane-diacksao", name: "Tivaouane Diacksao", hoodId: null },
  ],
  "thiaroye-arr": [
    { id: "diamaguene-sicap-mbao", name: "Diamaguène Sicap Mbao", hoodId: null },
    { id: "djiddah-thiaroye-kaw", name: "Djiddah Thiaroye Kaw", hoodId: null },
    { id: "mbao", name: "Mbao", hoodId: null },
    { id: "thiaroye-gare", name: "Thiaroye Gare", hoodId: null },
    { id: "thiaroye-sur-mer", name: "Thiaroye-sur-Mer", hoodId: null },
    { id: "yeumbeul-nord", name: "Yeumbeul Nord", hoodId: null },
    { id: "yeumbeul-sud", name: "Yeumbeul Sud", hoodId: null },
  ],
  "rufisque-arr": [
    { id: "rufisque-est", name: "Rufisque Est", hoodId: null },
    { id: "rufisque-centre-nord", name: "Rufisque Centre (Nord)", hoodId: null },
    { id: "rufisque-ouest", name: "Rufisque Ouest", hoodId: null },
    { id: "bargny", name: "Bargny", hoodId: null },
  ],
  "sangalkam-arr": [
    { id: "sangalkam", name: "Sangalkam", hoodId: null },
    { id: "sebikotane", name: "Sébikotane", hoodId: null },
    { id: "diamniadio", name: "Diamniadio", hoodId: null },
    { id: "jaxaay-parcelles-niakoul-rap", name: "Jaxaay-Parcelles-Niakoul Rap", hoodId: null },
    { id: "bambylor", name: "Bambylor", hoodId: null },
    { id: "sendou", name: "Sendou", hoodId: null },
    { id: "tivaouane-peulh-niaga", name: "Tivaouane Peulh-Niaga", hoodId: null },
    { id: "yene", name: "Yene", hoodId: null },
  ],
  "keur-massar-arr": [
    { id: "keur-massar", name: "Keur Massar", hoodId: null },
    { id: "malika", name: "Malika", hoodId: null },
  ],
  "bakel-arr": [
    { id: "bakel", name: "Bakel", hoodId: null },
    { id: "ballou", name: "Ballou", hoodId: null },
    { id: "bele", name: "Bele", hoodId: null },
    { id: "diawara", name: "Diawara", hoodId: null },
    { id: "gabou", name: "Gabou", hoodId: null },
    { id: "gathiari", name: "Gathiari", hoodId: null },
    { id: "kidira", name: "Kidira", hoodId: null },
    { id: "madina-foulbe", name: "Madina Foulbe", hoodId: null },
    { id: "mouderi", name: "Mouderi", hoodId: null },
    { id: "sadatou", name: "Sadatou", hoodId: null },
    { id: "sinthiou-fissa", name: "Sinthiou Fissa", hoodId: null },
    { id: "toumboura", name: "Toumboura", hoodId: null },
  ],
  "bambey-arr": [
    { id: "baba-garage", name: "Baba Garage", hoodId: null },
    { id: "bambey", name: "Bambey", hoodId: null },
    { id: "dangalma", name: "Dangalma", hoodId: null },
    { id: "dinguiraye-bambey", name: "Dinguiraye(Bambey)", hoodId: null },
    { id: "gawane", name: "Gawane", hoodId: null },
    { id: "keur-samba-kane", name: "Keur Samba Kane", hoodId: null },
    { id: "lambaye", name: "Lambaye", hoodId: null },
    { id: "ndondol", name: "Ndondol", hoodId: null },
    { id: "ngogom", name: "Ngogom", hoodId: null },
    { id: "ngoye", name: "Ngoye", hoodId: null },
    { id: "refane", name: "Refane", hoodId: null },
    { id: "thiakhar", name: "Thiakhar", hoodId: null },
  ],
  "bignona-arr": [
    { id: "balingore", name: "Balingore", hoodId: null },
    { id: "bignona", name: "Bignona", hoodId: null },
    { id: "coubalan", name: "Coubalan", hoodId: null },
    { id: "diegoune", name: "Diegoune", hoodId: null },
    { id: "diouloulou", name: "Diouloulou", hoodId: null },
    { id: "djibidione", name: "Djibidione", hoodId: null },
    { id: "djinaki", name: "Djinaki", hoodId: null },
    { id: "kafountine", name: "Kafountine", hoodId: null },
    { id: "kartiack", name: "Kartiack", hoodId: null },
    { id: "kataba-1", name: "Kataba 1", hoodId: null },
    { id: "mangagoulack", name: "Mangagoulack", hoodId: null },
    { id: "mlomp-bignona", name: "Mlomp (Bignona)", hoodId: null },
    { id: "niamone", name: "Niamone", hoodId: null },
    { id: "oulampane", name: "Oulampane", hoodId: null },
    { id: "ouonck", name: "Ouonck", hoodId: null },
    { id: "sindian", name: "Sindian", hoodId: null },
    { id: "suel", name: "Suel", hoodId: null },
    { id: "tenghori", name: "Tenghori", hoodId: null },
    { id: "thionck-essyl", name: "Thionck Essyl", hoodId: null },
  ],
  "birkilane-arr": [
    { id: "mbikilane", name: "Mbikilane", hoodId: null },
    { id: "diamal", name: "Diamal", hoodId: null },
    { id: "keur-mboucki", name: "Keur Mboucki", hoodId: null },
    { id: "mabo", name: "Mabo", hoodId: null },
    { id: "mbeuleup", name: "Mbeuleup", hoodId: null },
    { id: "ndiognick", name: "Ndiognick", hoodId: null },
    { id: "segre-gatta", name: "Segre Gatta", hoodId: null },
    { id: "touba-mbella", name: "Touba Mbella", hoodId: null },
  ],
  "bounkiling-arr": [
    { id: "boghal", name: "Boghal", hoodId: null },
    { id: "bona", name: "Bona", hoodId: null },
    { id: "bounkiling", name: "Bounkiling", hoodId: null },
    { id: "diacounda", name: "Diacounda", hoodId: null },
    { id: "diambaty", name: "Diambaty", hoodId: null },
    { id: "diaroume", name: "Diaroume", hoodId: null },
    { id: "djinany", name: "Djinany", hoodId: null },
    { id: "faoune", name: "Faoune", hoodId: null },
    { id: "inor", name: "Inor", hoodId: null },
    { id: "kandion-mangana", name: "Kandion Mangana", hoodId: null },
    { id: "medina-wandifa", name: "Medina Wandifa", hoodId: null },
    { id: "ndiamacouta", name: "Ndiamacouta", hoodId: null },
    { id: "ndiamalathiel", name: "Ndiamalathiel", hoodId: null },
    { id: "tankon", name: "Tankon", hoodId: null },
  ],
  "dagana-arr": [
    { id: "bokhol", name: "Bokhol", hoodId: null },
    { id: "dagana", name: "Dagana", hoodId: null },
    { id: "diama", name: "Diama", hoodId: null },
    { id: "gae", name: "Gae", hoodId: null },
    { id: "gnith", name: "Gnith", hoodId: null },
    { id: "mbane", name: "Mbane", hoodId: null },
    { id: "ndombo-sandjiry", name: "Ndombo Sandjiry", hoodId: null },
    { id: "richard-toll", name: "Richard Toll", hoodId: null },
    { id: "ronkh", name: "Ronkh", hoodId: null },
    { id: "ross-bethio", name: "Ross Bethio", hoodId: null },
    { id: "rosso-senegal", name: "Rosso Senegal", hoodId: null },
  ],
  "diourbel-dept-arr": [
    { id: "dankh-sene", name: "Dankh Sene", hoodId: null },
    { id: "diourbel", name: "Diourbel", hoodId: null },
    { id: "gade-escale", name: "Gade Escale", hoodId: null },
    { id: "keur-ngalgou", name: "Keur Ngalgou", hoodId: null },
    { id: "ndindy", name: "Ndindy", hoodId: null },
    { id: "ndoulo", name: "Ndoulo", hoodId: null },
    { id: "ngohe", name: "Ngohe", hoodId: null },
    { id: "pattar", name: "Pattar", hoodId: null },
    { id: "taiba-moutoupha", name: "Taiba Moutoupha", hoodId: null },
    { id: "tocky-gare", name: "Tocky Gare", hoodId: null },
    { id: "touba-lappe", name: "Touba Lappe", hoodId: null },
    { id: "toure-mbonde", name: "Toure Mbonde", hoodId: null },
  ],
  "fatick-dept-arr": [
    { id: "diakhao", name: "Diakhao", hoodId: null },
    { id: "diaoule", name: "Diaoule", hoodId: null },
    { id: "diarrere", name: "Diarrere", hoodId: null },
    { id: "diofior", name: "Diofior", hoodId: null },
    { id: "diouroup", name: "Diouroup", hoodId: null },
    { id: "djilass", name: "Djilass", hoodId: null },
    { id: "fatick", name: "Fatick", hoodId: null },
    { id: "fimela", name: "Fimela", hoodId: null },
    { id: "loul-sessene", name: "Loul sessene", hoodId: null },
    { id: "mbellacadiao", name: "Mbellacadiao", hoodId: null },
    { id: "ndiob", name: "Ndiob", hoodId: null },
    { id: "ngayokheme", name: "Ngayokheme", hoodId: null },
    { id: "niakhar", name: "Niakhar", hoodId: null },
    { id: "palmarin-facao", name: "Palmarin Facao", hoodId: null },
    { id: "patar", name: "Patar", hoodId: null },
    { id: "tattaguine", name: "Tattaguine", hoodId: null },
    { id: "thiare-ndialgui", name: "Thiare Ndialgui", hoodId: null },
  ],
  "foundiougne-arr": [
    { id: "bassoul", name: "Bassoul", hoodId: null },
    { id: "diagane-barka", name: "Diagane Barka", hoodId: null },
    { id: "dionewar", name: "Dionewar", hoodId: null },
    { id: "diossong", name: "Diossong", hoodId: null },
    { id: "djilor", name: "Djilor", hoodId: null },
    { id: "djirnda", name: "Djirnda", hoodId: null },
    { id: "foundiougne", name: "Foundiougne", hoodId: null },
    { id: "karang-poste", name: "Karang Poste", hoodId: null },
    { id: "keur-saloum-diane", name: "Keur Saloum Diane", hoodId: null },
    { id: "keur-samba-gueye", name: "Keur Samba Gueye", hoodId: null },
    { id: "mbam", name: "Mbam", hoodId: null },
    { id: "niassene", name: "Niassene", hoodId: null },
    { id: "nioro-alassane-tall", name: "Nioro Alassane Tall", hoodId: null },
    { id: "passi", name: "Passi", hoodId: null },
    { id: "sokone", name: "Sokone", hoodId: null },
    { id: "soum", name: "Soum", hoodId: null },
    { id: "toubacouta", name: "Toubacouta", hoodId: null },
  ],
  "gossas-arr": [
    { id: "colobane", name: "Colobane", hoodId: null },
    { id: "gossas", name: "Gossas", hoodId: null },
    { id: "mbar", name: "Mbar", hoodId: null },
    { id: "ndiene-lagane", name: "Ndiene Lagane", hoodId: null },
    { id: "ouadiour", name: "Ouadiour", hoodId: null },
    { id: "patar-lia", name: "Patar Lia", hoodId: null },
  ],
  "goudiry-arr": [
    { id: "bala", name: "Bala", hoodId: null },
    { id: "bani-isreal", name: "Bani Isreal", hoodId: null },
    { id: "boutoucoufara", name: "Boutoucoufara", hoodId: null },
    { id: "boyngel-bamba", name: "Boyngel Bamba", hoodId: null },
    { id: "dianke-makha", name: "Dianke Makha", hoodId: null },
    { id: "dougue", name: "Dougue", hoodId: null },
    { id: "goudiry", name: "Goudiry", hoodId: null },
    { id: "goumbayel", name: "Goumbayel", hoodId: null },
    { id: "koar", name: "Koar", hoodId: null },
    { id: "komoti", name: "Komoti", hoodId: null },
    { id: "kothiary", name: "Kothiary", hoodId: null },
    { id: "koulor", name: "Koulor", hoodId: null },
    { id: "koussan", name: "Koussan", hoodId: null },
    { id: "sinthiou-bocar-aly", name: "Sinthiou Bocar Aly", hoodId: null },
    { id: "sinthiou-mamadou-boubou", name: "Sinthiou Mamadou Boubou", hoodId: null },
  ],
  "goudomp-arr": [
    { id: "baghere", name: "Baghere", hoodId: null },
    { id: "diattacounda", name: "Diattacounda", hoodId: null },
    { id: "dioudoubou", name: "Dioudoubou", hoodId: null },
    { id: "djibanar", name: "Djibanar", hoodId: null },
    { id: "kaour", name: "Kaour", hoodId: null },
    { id: "karantaba", name: "Karantaba", hoodId: null },
    { id: "kolibantang", name: "Kolibantang", hoodId: null },
    { id: "mangaroungou-santo", name: "Mangaroungou Santo", hoodId: null },
    { id: "niagha", name: "Niagha", hoodId: null },
    { id: "samine", name: "Samine", hoodId: null },
    { id: "simbandi-balante", name: "Simbandi Balante", hoodId: null },
    { id: "simbadi-brassou", name: "Simbadi Brassou", hoodId: null },
    { id: "tanaff", name: "Tanaff", hoodId: null },
    { id: "yarang-balante", name: "Yarang Balante", hoodId: null },
  ],
  "guinguineo-arr": [
    { id: "dara-mboss", name: "Dara Mboss", hoodId: null },
    { id: "fass", name: "Fass", hoodId: null },
    { id: "guinguineo", name: "Guinguineo", hoodId: null },
    { id: "khelcom-birame", name: "Khelcom Birame", hoodId: null },
    { id: "mbadakhoune", name: "Mbadakhoune", hoodId: null },
    { id: "mboss", name: "Mboss", hoodId: null },
    { id: "ndiago", name: "Ndiago", hoodId: null },
    { id: "ngagnick", name: "Ngagnick", hoodId: null },
    { id: "ngathie-naoude", name: "Ngathie Naoude", hoodId: null },
    { id: "ngellou", name: "Ngellou", hoodId: null },
    { id: "ourour", name: "Ourour", hoodId: null },
    { id: "panal-wolof", name: "Panal Wolof", hoodId: null },
  ],
  "kaffrine-dept-arr": [
    { id: "boulel", name: "Boulel", hoodId: null },
    { id: "diamagadio", name: "Diamagadio", hoodId: null },
    { id: "diokoul-mbelbouck", name: "Diokoul Mbelbouck", hoodId: null },
    { id: "gniby", name: "Gniby", hoodId: null },
    { id: "kaffrine", name: "Kaffrine", hoodId: null },
    { id: "kahi", name: "Kahi", hoodId: null },
    { id: "kathiote", name: "Kathiote", hoodId: null },
    { id: "medinatoul-salam-2", name: "Medinatoul Salam 2", hoodId: null },
    { id: "nganda", name: "Nganda", hoodId: null },
  ],
  "kanel-arr": [
    { id: "aoure", name: "Aoure", hoodId: null },
    { id: "bokiladji", name: "Bokiladji", hoodId: null },
    { id: "dembancane", name: "Dembancane", hoodId: null },
    { id: "hamadi-hounare", name: "Hamadi Hounare", hoodId: null },
    { id: "kanel", name: "Kanel", hoodId: null },
    { id: "ndendory", name: "Ndendory", hoodId: null },
    { id: "odobere", name: "Odobere", hoodId: null },
    { id: "orkadiere", name: "Orkadiere", hoodId: null },
    { id: "ouaounde", name: "Ouaounde", hoodId: null },
    { id: "semme", name: "Semme", hoodId: null },
    { id: "sinthiou-bamambe-banadji", name: "Sinthiou Bamambe Banadji", hoodId: null },
    { id: "wouro-sidy", name: "Wouro Sidy", hoodId: null },
  ],
  "kaolack-dept-arr": [
    { id: "dya", name: "Dya", hoodId: null },
    { id: "gandiaye", name: "Gandiaye", hoodId: null },
    { id: "kahone", name: "Kahone", hoodId: null },
    { id: "kaolack", name: "Kaolack", hoodId: null },
    { id: "keur-baka", name: "Keur Baka", hoodId: null },
    { id: "keur-soce", name: "Keur Soce", hoodId: null },
    { id: "latmingue", name: "Latmingue", hoodId: null },
    { id: "ndiaffate", name: "Ndiaffate", hoodId: null },
    { id: "ndiebel", name: "Ndiebel", hoodId: null },
    { id: "ndiedieng", name: "Ndiedieng", hoodId: null },
    { id: "ndoffane", name: "Ndoffane", hoodId: null },
    { id: "sibassor", name: "Sibassor", hoodId: null },
    { id: "thiare", name: "Thiare", hoodId: null },
    { id: "thiomby", name: "Thiomby", hoodId: null },
  ],
  "kebemer-arr": [
    { id: "bandegne-ouolof", name: "Bandegne Ouolof", hoodId: null },
    { id: "darou-marnane", name: "Darou Marnane", hoodId: null },
    { id: "darou-mousti", name: "Darou Mousti", hoodId: null },
    { id: "djokoul-ndiawrigne", name: "Djokoul Ndiawrigne", hoodId: null },
    { id: "gueoul", name: "Gueoul", hoodId: null },
    { id: "kab-gaye", name: "Kab Gaye", hoodId: null },
    { id: "kanene-ndiob", name: "Kanene Ndiob", hoodId: null },
    { id: "kebemer", name: "Kebemer", hoodId: null },
    { id: "loro", name: "Loro", hoodId: null },
    { id: "mbacke-cajor", name: "Mbacke Cajor", hoodId: null },
    { id: "mbadiane", name: "Mbadiane", hoodId: null },
    { id: "ndande", name: "Ndande", hoodId: null },
    { id: "ndoyene", name: "Ndoyene", hoodId: null },
    { id: "ngourane-ouolof", name: "Ngourane Ouolof", hoodId: null },
    { id: "sagata-gueth", name: "Sagata Gueth", hoodId: null },
    { id: "sam-yabal", name: "Sam Yabal", hoodId: null },
    { id: "thiep", name: "Thiep", hoodId: null },
    { id: "thiolom-fall", name: "Thiolom Fall", hoodId: null },
    { id: "touba-merina", name: "Touba Merina", hoodId: null },
  ],
  "kedougou-dept-arr": [
    { id: "bandafassi", name: "Bandafassi", hoodId: null },
    { id: "dimboli", name: "Dimboli", hoodId: null },
    { id: "dindefelo", name: "Dindefelo", hoodId: null },
    { id: "fongolimbi", name: "Fongolimbi", hoodId: null },
    { id: "kedougou", name: "Kedougou", hoodId: null },
    { id: "ninefecha", name: "Ninefecha", hoodId: null },
    { id: "tomboronkoto", name: "Tomboronkoto", hoodId: null },
  ],
  "kolda-dept-arr": [
    { id: "bagadaji", name: "Bagadaji", hoodId: null },
    { id: "coumbacara", name: "Coumbacara", hoodId: null },
    { id: "dabo", name: "Dabo", hoodId: null },
    { id: "dialambere", name: "Dialambere", hoodId: null },
    { id: "dioulacolon", name: "Dioulacolon", hoodId: null },
    { id: "guiro-yero-bocar", name: "Guiro Yero Bocar", hoodId: null },
    { id: "kolda", name: "Kolda", hoodId: null },
    { id: "mampatim", name: "Mampatim", hoodId: null },
    { id: "medina-cherif", name: "Medina Cherif", hoodId: null },
    { id: "salikegne", name: "Salikegne", hoodId: null },
    { id: "sare-bidji", name: "Sare Bidji", hoodId: null },
    { id: "sare-yoba-diega", name: "Sare Yoba Diega", hoodId: null },
    { id: "tankanto-escale", name: "Tankanto Escale", hoodId: null },
    { id: "thietty", name: "Thietty", hoodId: null },
  ],
  "koumpentoum-arr": [
    { id: "bamba-thialene", name: "Bamba Thialene", hoodId: null },
    { id: "kahene", name: "Kahene", hoodId: null },
    { id: "koumpentoum", name: "Koumpentoum", hoodId: null },
    { id: "kouthia-gaydi", name: "Kouthia Gaydi", hoodId: null },
    { id: "kouthiaba-wolof", name: "Kouthiaba Wolof", hoodId: null },
    { id: "maleme-niani", name: "Maleme Niani", hoodId: null },
    { id: "mereto", name: "Mereto", hoodId: null },
    { id: "ndam", name: "Ndam", hoodId: null },
    { id: "pass-koto", name: "Pass Koto", hoodId: null },
    { id: "payar", name: "Payar", hoodId: null },
  ],
  "koungheul-arr": [
    { id: "fass-thiekene", name: "Fass Thiekene", hoodId: null },
    { id: "ida-mouride", name: "Ida Mouride", hoodId: null },
    { id: "koungheul", name: "Koungheul", hoodId: null },
    { id: "lour-escale", name: "Lour Escale", hoodId: null },
    { id: "maka-yop", name: "Maka Yop", hoodId: null },
    { id: "missirah-wadene", name: "Missirah Wadene", hoodId: null },
    { id: "ngainthe-pate", name: "Ngainthe Pate", hoodId: null },
    { id: "ribot-escale", name: "Ribot Escale", hoodId: null },
    { id: "saly-escale", name: "Saly Escale", hoodId: null },
  ],
  "linguere-arr": [
    { id: "affe-djolof", name: "Affe Djolof", hoodId: null },
    { id: "boulal", name: "Boulal", hoodId: null },
    { id: "dahra", name: "Dahra", hoodId: null },
    { id: "dealy", name: "Dealy", hoodId: null },
    { id: "dodji", name: "Dodji", hoodId: null },
    { id: "gassane", name: "Gassane", hoodId: null },
    { id: "kambe", name: "Kambe", hoodId: null },
    { id: "labgar", name: "Labgar", hoodId: null },
    { id: "linguere", name: "Linguere", hoodId: null },
    { id: "mbeuleukhe", name: "Mbeuleukhe", hoodId: null },
    { id: "mboula", name: "Mboula", hoodId: null },
    { id: "ouarkhokh", name: "Ouarkhokh", hoodId: null },
    { id: "sagatta-djolof", name: "Sagatta Djolof", hoodId: null },
    { id: "tessekere-forage", name: "Tessekere Forage", hoodId: null },
    { id: "thiamene-passe", name: "Thiamene Passe", hoodId: null },
    { id: "thiargny", name: "Thiargny", hoodId: null },
    { id: "thiel", name: "Thiel", hoodId: null },
    { id: "yang-yang", name: "Yang Yang", hoodId: null },
  ],
  "louga-dept-arr": [
    { id: "gande", name: "Gande", hoodId: null },
    { id: "guet-ardo", name: "Guet Ardo", hoodId: null },
    { id: "kelle-gueye", name: "Kelle Gueye", hoodId: null },
    { id: "keur-momar-sarr", name: "Keur Momar Sarr", hoodId: null },
    { id: "koki", name: "Koki", hoodId: null },
    { id: "leona", name: "Leona", hoodId: null },
    { id: "louga", name: "Louga", hoodId: null },
    { id: "ndiagne", name: "Ndiagne", hoodId: null },
    { id: "nguer-malal", name: "Nguer Malal", hoodId: null },
    { id: "ngueune-sarr", name: "Ngueune Sarr", hoodId: null },
    { id: "nguidile", name: "Nguidile", hoodId: null },
    { id: "niomre", name: "Niomre", hoodId: null },
    { id: "pete-ouarack", name: "Pete Ouarack", hoodId: null },
    { id: "sakal", name: "Sakal", hoodId: null },
    { id: "syer", name: "Syer", hoodId: null },
    { id: "thiamene-cayor", name: "Thiamene Cayor", hoodId: null },
  ],
  "malem-hodar-arr": [
    { id: "darou-minam", name: "Darou Minam", hoodId: null },
    { id: "djanke-souf", name: "Djanke Souf", hoodId: null },
    { id: "khelcom", name: "Khelcom", hoodId: null },
    { id: "malem-hodar", name: "Malem Hodar", hoodId: null },
    { id: "ndiobene-samba-lamo", name: "Ndiobene Samba Lamo", hoodId: null },
    { id: "ndioum-ngainthe", name: "Ndioum Ngainthe", hoodId: null },
    { id: "sagna", name: "Sagna", hoodId: null },
  ],
  "matam-dept-arr": [
    { id: "bokidiave", name: "Bokidiave", hoodId: null },
    { id: "dabia", name: "Dabia", hoodId: null },
    { id: "des-agnam-agnam-civol", name: "Des Agnam (Agnam CIVOL)", hoodId: null },
    { id: "matam", name: "Matam", hoodId: null },
    { id: "nabadji-civol", name: "Nabadji Civol", hoodId: null },
    { id: "nguidjilone", name: "Nguidjilone", hoodId: null },
    { id: "ogo", name: "Ogo", hoodId: null },
    { id: "orefonde", name: "Orefonde", hoodId: null },
    { id: "ourossogui", name: "Ourossogui", hoodId: null },
    { id: "thilogne", name: "Thilogne", hoodId: null },
  ],
  "mbacke-arr": [
    { id: "dalla-ngabou", name: "Dalla Ngabou", hoodId: null },
    { id: "dandeye-gouygui", name: "Dandeye Gouygui", hoodId: null },
    { id: "darou-nahim", name: "Darou Nahim", hoodId: null },
    { id: "darou-salam-typ", name: "Darou Salam TYP", hoodId: null },
    { id: "kael", name: "Kael", hoodId: null },
    { id: "madina", name: "Madina", hoodId: null },
    { id: "mbacke", name: "Mbacke", hoodId: null },
    { id: "missirah-mbacke", name: "Missirah(Mbacke)", hoodId: null },
    { id: "ndioumane", name: "Ndioumane", hoodId: null },
    { id: "nghaye", name: "Nghaye", hoodId: null },
    { id: "sadio", name: "Sadio", hoodId: null },
    { id: "taiba-thiekene", name: "Taiba Thiekene", hoodId: null },
    { id: "taif", name: "Taif", hoodId: null },
    { id: "touba-fall", name: "Touba Fall", hoodId: null },
    { id: "touba-mboul", name: "Touba Mboul", hoodId: null },
    { id: "touba-mosque", name: "Touba Mosque", hoodId: null },
  ],
  "mbour-arr": [
    { id: "diass", name: "Diass", hoodId: null },
    { id: "fissel", name: "Fissel", hoodId: null },
    { id: "joal-fadiouth", name: "Joal Fadiouth", hoodId: null },
    { id: "malicounda", name: "Malicounda", hoodId: null },
    { id: "mbour", name: "Mbour", hoodId: null },
    { id: "ndiaganiao", name: "Ndiaganiao", hoodId: null },
    { id: "ngaparou", name: "Ngaparou", hoodId: null },
    { id: "nguekhokh", name: "Nguekhokh", hoodId: null },
    { id: "ngueniene", name: "Ngueniene", hoodId: null },
    { id: "popenguine", name: "Popenguine", hoodId: null },
    { id: "saly-portudal", name: "Saly Portudal", hoodId: null },
    { id: "sandiara", name: "Sandiara", hoodId: null },
    { id: "sessene", name: "Sessene", hoodId: null },
    { id: "sindia", name: "Sindia", hoodId: null },
    { id: "somone", name: "Somone", hoodId: null },
    { id: "thiadiaye", name: "Thiadiaye", hoodId: null },
  ],
  "medina-yoro-foulah-arr": [
    { id: "badion", name: "Badion", hoodId: null },
    { id: "bignareba", name: "Bignareba", hoodId: null },
    { id: "bourouco", name: "Bourouco", hoodId: null },
    { id: "dinguiraye-m-y-f", name: "Dinguiraye(M.Y.F)", hoodId: null },
    { id: "fafacourou", name: "Fafacourou", hoodId: null },
    { id: "kerewane", name: "Kerewane", hoodId: null },
    { id: "koulinto", name: "Koulinto", hoodId: null },
    { id: "medina-yoro-foulah", name: "Medina Yoro Foulah", hoodId: null },
    { id: "ndorna", name: "Ndorna", hoodId: null },
    { id: "niaming", name: "Niaming", hoodId: null },
    { id: "pata", name: "Pata", hoodId: null },
  ],
  "nioro-du-rip-arr": [
    { id: "dabaly", name: "Dabaly", hoodId: null },
    { id: "darou-salam", name: "Darou Salam", hoodId: null },
    { id: "gainte-kaye", name: "Gainte Kaye", hoodId: null },
    { id: "kayemor", name: "Kayemor", hoodId: null },
    { id: "keur-maba-diakhou", name: "Keur Maba Diakhou", hoodId: null },
    { id: "keur-madiabel", name: "Keur Madiabel", hoodId: null },
    { id: "keur-madongo", name: "Keur Madongo", hoodId: null },
    { id: "medina-sabakh", name: "Medina Sabakh", hoodId: null },
    { id: "ndrame-escale", name: "Ndrame Escale", hoodId: null },
    { id: "ngayene", name: "Ngayene", hoodId: null },
    { id: "nioro-du-rip", name: "Nioro du Rip", hoodId: null },
    { id: "paoskoto", name: "Paoskoto", hoodId: null },
    { id: "porokhane", name: "Porokhane", hoodId: null },
    { id: "taiba-niassene", name: "Taiba Niassene", hoodId: null },
    { id: "wack-ngouna", name: "Wack Ngouna", hoodId: null },
  ],
  "oussouye-arr": [
    { id: "diembering", name: "Diembering", hoodId: null },
    { id: "mlomp-oussouye", name: "Mlomp (Oussouye)", hoodId: null },
    { id: "oukout", name: "Oukout", hoodId: null },
    { id: "oussouye", name: "Oussouye", hoodId: null },
    { id: "santhiaba-manjaque", name: "Santhiaba Manjaque", hoodId: null },
  ],
  "podor-arr": [
    { id: "aere-lao", name: "Aere Lao", hoodId: null },
    { id: "bode-lao", name: "Bode Lao", hoodId: null },
    { id: "boke-dialloube", name: "Boke Dialloube", hoodId: null },
    { id: "demette", name: "Demette", hoodId: null },
    { id: "dodel", name: "Dodel", hoodId: null },
    { id: "doumga-lao", name: "Doumga Lao", hoodId: null },
    { id: "fanaye", name: "Fanaye", hoodId: null },
    { id: "galoya-toucouleur", name: "Galoya Toucouleur", hoodId: null },
    { id: "gamadji-sare", name: "Gamadji Sare", hoodId: null },
    { id: "gollere", name: "Gollere", hoodId: null },
    { id: "guede-chantier", name: "Guede Chantier", hoodId: null },
    { id: "guede-village", name: "Guede Village", hoodId: null },
    { id: "medina-ndiathbe", name: "Medina Ndiathbe", hoodId: null },
    { id: "mbolo-birane", name: "Mbolo Birane", hoodId: null },
    { id: "mboumba", name: "Mboumba", hoodId: null },
    { id: "meri", name: "Meri", hoodId: null },
    { id: "ndiayene-peindao", name: "Ndiayene Peindao", hoodId: null },
    { id: "ndioum", name: "Ndioum", hoodId: null },
    { id: "niandane", name: "Niandane", hoodId: null },
    { id: "pete", name: "Pete", hoodId: null },
    { id: "podor", name: "Podor", hoodId: null },
    { id: "walalde", name: "Walalde", hoodId: null },
  ],
  "ranerou-ferlo-arr": [
    { id: "lougre-thioly", name: "Lougre Thioly", hoodId: null },
    { id: "oudalaye", name: "Oudalaye", hoodId: null },
    { id: "ranerou", name: "Ranerou", hoodId: null },
    { id: "velingara-ranerou", name: "Velingara(Ranerou)", hoodId: null },
  ],
  "saint-louis-dept-arr": [
    { id: "fass-ngom", name: "Fass Ngom", hoodId: null },
    { id: "gandon", name: "Gandon", hoodId: null },
    { id: "mpal", name: "Mpal", hoodId: null },
    { id: "ndiebene-gandiole", name: "Ndiebene Gandiole", hoodId: null },
    { id: "saint-louis", name: "Saint Louis", hoodId: null },
  ],
  "salemata-arr": [
    { id: "dakately", name: "Dakately", hoodId: null },
    { id: "dar-salam", name: "Dar Salam", hoodId: null },
    { id: "ethiolo", name: "Ethiolo", hoodId: null },
    { id: "kevoye", name: "Kevoye", hoodId: null },
    { id: "oubadji", name: "Oubadji", hoodId: null },
    { id: "salemata", name: "Salemata", hoodId: null },
  ],
  "saraya-arr": [
    { id: "bembou", name: "Bembou", hoodId: null },
    { id: "khossanto", name: "Khossanto", hoodId: null },
    { id: "medina-baffe", name: "Medina Baffe", hoodId: null },
    { id: "missirah-sirimana", name: "Missirah Sirimana", hoodId: null },
    { id: "sabadola", name: "Sabadola", hoodId: null },
    { id: "saraya", name: "Saraya", hoodId: null },
  ],
  "sedhiou-dept-arr": [
    { id: "bambali", name: "Bambali", hoodId: null },
    { id: "bemet-bidjini", name: "Bemet Bidjini", hoodId: null },
    { id: "dianah-malary", name: "Dianah Malary", hoodId: null },
    { id: "diannah-ba", name: "Diannah Ba", hoodId: null },
    { id: "diende", name: "Diende", hoodId: null },
    { id: "djibabouya", name: "Djibabouya", hoodId: null },
    { id: "djiredji", name: "Djiredji", hoodId: null },
    { id: "koussy", name: "Koussy", hoodId: null },
    { id: "marssassoum", name: "Marssassoum", hoodId: null },
    { id: "oudoucar", name: "Oudoucar", hoodId: null },
    { id: "sakar", name: "Sakar", hoodId: null },
    { id: "same-kanta-peulh", name: "Same Kanta Peulh", hoodId: null },
    { id: "sansamba", name: "Sansamba", hoodId: null },
    { id: "sedhiou", name: "Sedhiou", hoodId: null },
  ],
  "tambacounda-dept-arr": [
    { id: "dialokoto", name: "Dialokoto", hoodId: null },
    { id: "koussanar", name: "Koussanar", hoodId: null },
    { id: "makacolibantang", name: "Makacolibantang", hoodId: null },
    { id: "missirah-tamba", name: "Missirah(Tamba)", hoodId: null },
    { id: "ndoga-babacar", name: "Ndoga Babacar", hoodId: null },
    { id: "netteboulou", name: "Netteboulou", hoodId: null },
    { id: "niani-toucouleur", name: "Niani Toucouleur", hoodId: null },
    { id: "sinthiou-maleme", name: "Sinthiou Maleme", hoodId: null },
    { id: "tambacounda", name: "Tambacounda", hoodId: null },
  ],
  "thies-dept-arr": [
    { id: "diender-guedji", name: "Diender Guedji", hoodId: null },
    { id: "fandene", name: "Fandene", hoodId: null },
    { id: "kayar", name: "Kayar", hoodId: null },
    { id: "keur-moussa", name: "Keur Moussa", hoodId: null },
    { id: "khombole", name: "Khombole", hoodId: null },
    { id: "ndieyene-sirakh", name: "Ndieyene Sirakh", hoodId: null },
    { id: "ngoundiane", name: "Ngoundiane", hoodId: null },
    { id: "notto", name: "Notto", hoodId: null },
    { id: "pout", name: "Pout", hoodId: null },
    { id: "tassette", name: "Tassette", hoodId: null },
    { id: "thienaba", name: "Thienaba", hoodId: null },
    { id: "thies-est", name: "Thies Est", hoodId: null },
    { id: "thies-nord", name: "Thies Nord", hoodId: null },
    { id: "thies-ouest", name: "Thies Ouest", hoodId: null },
    { id: "touba-toul", name: "Touba Toul", hoodId: null },
  ],
  "tivaouane-arr": [
    { id: "cherif-lo", name: "Cherif Lo", hoodId: null },
    { id: "darou-khoudoss", name: "Darou Khoudoss", hoodId: null },
    { id: "koul", name: "Koul", hoodId: null },
    { id: "mbayene", name: "Mbayene", hoodId: null },
    { id: "mboro", name: "Mboro", hoodId: null },
    { id: "meckhe", name: "Meckhe", hoodId: null },
    { id: "meouane", name: "Meouane", hoodId: null },
    { id: "merina-dakhar", name: "Merina Dakhar", hoodId: null },
    { id: "mont-rolland", name: "Mont Rolland", hoodId: null },
    { id: "ngandiouf", name: "Ngandiouf", hoodId: null },
    { id: "niakhene", name: "Niakhene", hoodId: null },
    { id: "notto-gouye-diama", name: "Notto Gouye Diama", hoodId: null },
    { id: "pambal", name: "Pambal", hoodId: null },
    { id: "pekesse", name: "Pekesse", hoodId: null },
    { id: "pire-goureye", name: "Pire Goureye", hoodId: null },
    { id: "taiba-ndiaye", name: "Taiba Ndiaye", hoodId: null },
    { id: "thilmakha", name: "Thilmakha", hoodId: null },
    { id: "tivaouane", name: "Tivaouane", hoodId: null },
  ],
  "velingara-arr": [
    { id: "bonconto", name: "Bonconto", hoodId: null },
    { id: "diaobe-kabendou", name: "Diaobe Kabendou", hoodId: null },
    { id: "kandia", name: "Kandia", hoodId: null },
    { id: "kandiaye", name: "Kandiaye", hoodId: null },
    { id: "kounkane", name: "Kounkane", hoodId: null },
    { id: "linkering", name: "Linkering", hoodId: null },
    { id: "medina-gounasse", name: "Medina Gounasse", hoodId: null },
    { id: "nemataba", name: "Nemataba", hoodId: null },
    { id: "ouassadou", name: "Ouassadou", hoodId: null },
    { id: "pakour", name: "Pakour", hoodId: null },
    { id: "paroumba", name: "Paroumba", hoodId: null },
    { id: "sare-coli-salle", name: "Sare Coli Salle", hoodId: null },
    { id: "sinthiang-koundara", name: "Sinthiang Koundara", hoodId: null },
    { id: "velingara", name: "Velingara", hoodId: null },
  ],
  "ziguinchor-dept-arr": [
    { id: "adeane", name: "Adeane", hoodId: null },
    { id: "boutoupa-camaracounda", name: "Boutoupa Camaracounda", hoodId: null },
    { id: "enampor", name: "Enampor", hoodId: null },
    { id: "niaguis", name: "Niaguis", hoodId: null },
    { id: "niassia", name: "Niassia", hoodId: null },
    { id: "ziguinchor", name: "Ziguinchor", hoodId: null },
  ],
};
/** Renvoie les arrondissements d'un département, en générant à la volée
 *  l'arrondissement par défaut (nom = département) pour ceux qui n'ont
 *  pas d'entrée détaillée dans TI_ADMIN_ARRONDISSEMENTS. */
function tiGetArrondissements(deptId) {
  if (TI_ADMIN_ARRONDISSEMENTS[deptId]) return TI_ADMIN_ARRONDISSEMENTS[deptId];
  for (const depts of Object.values(TI_ADMIN_DEPARTMENTS)) {
    const dept = depts.find(d => d.id === deptId);
    if (dept) return tiDefaultArrondissement(deptId, dept.name);
  }
  return [];
}

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
