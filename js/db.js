/* ============================================================
   Timmo — couche d'accès aux données (TiDB)
   ------------------------------------------------------------
   Toute lecture/écriture dans l'application passe par l'objet TiDB
   ci-dessous plutôt que de toucher directement au localStorage. Cela
   signifie que changer de backend de stockage pour une vraie base de
   données consiste à réécrire le corps des fonctions dans UN des deux
   adaptateurs ci-dessous — aucun changement nécessaire dans le code
   d'interface d'une quelconque page.

   ADAPTATEUR 1 (actif par défaut) : localStorage
     Fonctionne entièrement hors ligne, sans configuration. Idéal pour
     faire une démonstration du produit.

   ADAPTATEUR 2 (prêt à activer) : Firebase Firestore
     1. Créez un projet sur https://console.firebase.google.com
     2. Activez Firestore + Authentication (E-mail/Mot de passe).
     3. Collez la configuration de votre application web dans
        js/firebase-config.js
     4. Incluez les balises script du SDK Firebase (voir le
        commentaire en haut de firebase-config.js) dans chaque page
        HTML, AVANT js/db.js.
     5. Définissez TI_BACKEND = "firebase" ci-dessous.

   ADAPTATEUR 3 (prêt à activer) : API Node.js / Express + MongoDB
     Une base fonctionnelle est fournie dans /server (server.js,
     routes/*.js). Lancez-la avec `npm install && npm start` dans
     /server, puis définissez TI_BACKEND = "api" ci-dessous et
     TI_API_BASE avec l'URL du serveur (par défaut
     http://localhost:4000/api).
   ============================================================ */

const TI_BACKEND = "api"; // "local" | "firebase" | "api"
const TI_API_BASE = "https://timmo-api.onrender.com/api";

/** Un seul point de passage pour tout appel à l'API : ajoute automatiquement
 *  le jeton d'authentification stocké (s'il existe) à l'en-tête
 *  Authorization — pour que chacun des appels fetch() ci-dessous n'ait pas
 *  à le répéter individuellement. */
function tiApiFetch(url, options = {}) {
  const token = localStorage.getItem("ti_api_token");
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;
  return fetch(url, { ...options, headers });
}

function tiLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function tiSave(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---- initialisation ponctuelle de la « base de données » locale ----
   TI_SCHEMA_VERSION augmente chaque fois que la structure de
   TI_PROPERTIES ou TI_AGENCIES change (nouveaux champs, etc.). En cas de
   différence de version, on régénère les données de démo depuis les
   données initiales actuelles, pour qu'un navigateur ayant visité une
   version antérieure ne se retrouve jamais bloqué avec des enregistrements
   auxquels il manque un champ désormais attendu par l'interface — tout en
   laissant intacts les réservations, messages, avis, paiements et favoris
   propres à l'utilisateur. */
const TI_SCHEMA_VERSION = "8";

(function tiSeedLocalDb() {
  const seededVersion = localStorage.getItem("ti_seeded");
  if (seededVersion === TI_SCHEMA_VERSION) {
    tiSyncAgenciesFromStorage();
    return;
  }

  if (!seededVersion) {
    // tout nouveau navigateur : on initialise tout
    tiSave("ti_users", [
      { id: "u_client", role: "client", name: "Awa Diop", email: "client@demo.sn", password: "demo1234" },
      { id: "u_agency", role: "agency", agentRole: "supervisor", name: "Sahel Habitat", agencyId: "ag001", email: "agence@demo.sn", password: "demo1234" },
      { id: "u_agent1", role: "agency", agentRole: "agent", name: "Moussa Fall", agencyId: "ag001", email: "agent@demo.sn", password: "demo1234" },
      { id: "u_admin", role: "admin", name: "Admin Timmo", email: "admin@demo.sn", password: "demo1234" },
    ]);
    tiSave("ti_bookings", []);
    tiSave("ti_messages", []);
    tiSave("ti_reviews", []);
    tiSave("ti_payments", []);
    tiSave("ti_favorites", []);
    tiSave("ti_newsletter", []);
    tiSave("ti_audit_log", []);
    tiSave("ti_properties", TI_PROPERTIES);
    tiSave("ti_agencies", TI_AGENCIES.map(a => ({ status: "active", ...a })));
  } else {
    // navigateur déjà utilisé, sur un schéma plus ancien : on ne
    // rafraîchit que les catalogues de démo (les annonces publiées par les
    // agences / agences ajoutées par l'admin ont déjà la structure actuelle
    // via TiDB, donc on les réintègre) — réservations/messages/avis/
    // paiements/favoris restent inchangés.
    const existingProps = tiLoad("ti_properties", []);
    const seedPropIds = new Set(TI_PROPERTIES.map(p => p.id));
    const agencyAddedProps = existingProps.filter(p => !seedPropIds.has(p.id))
      .map(p => ({ listingStatus: "active", views: 0, ...p }));
    tiSave("ti_properties", [...TI_PROPERTIES, ...agencyAddedProps]);

    const existingAgencies = tiLoad("ti_agencies", []);
    const seedAgencyIds = new Set(TI_AGENCIES.map(a => a.id));
    const adminAddedAgencies = existingAgencies.filter(a => !seedAgencyIds.has(a.id));
    const mergedSeedAgencies = TI_AGENCIES.map(a => {
      const prior = existingAgencies.find(e => e.id === a.id);
      return prior ? { ...a, ...prior } : { status: "active", ...a };
    });
    tiSave("ti_agencies", [...mergedSeedAgencies, ...adminAddedAgencies]);

    // Comptes de démo toujours réinitialisés sur les données initiales
    // actuelles lors d'un changement de version — plus simple et plus sûr
    // qu'une retouche en place (garantit qu'aucun format de hachage de mot
    // de passe obsolète ne survit à un changement de schéma comme celui-ci),
    // et les comptes de démo ne contiennent aucune donnée réelle à préserver.
    tiSave("ti_users", [
      { id: "u_client", role: "client", name: "Awa Diop", email: "client@demo.sn", password: "demo1234" },
      { id: "u_agency", role: "agency", agentRole: "supervisor", name: "Sahel Habitat", agencyId: "ag001", email: "agence@demo.sn", password: "demo1234" },
      { id: "u_agent1", role: "agency", agentRole: "agent", name: "Moussa Fall", agencyId: "ag001", email: "agent@demo.sn", password: "demo1234" },
      { id: "u_admin", role: "admin", name: "Admin Timmo", email: "admin@demo.sn", password: "demo1234" },
    ]);
  }

  localStorage.setItem("ti_seeded", TI_SCHEMA_VERSION);
  tiSyncAgenciesFromStorage();
})();

/* TI_AGENCIES reste un simple tableau en mémoire (de nombreux utilitaires
   synchrones comme tiAgencyName() le lisent directement), mais son contenu
   est maintenu synchronisé avec la copie persistée pour que les modifications
   de l'admin survivent à un rechargement. */
function tiSyncAgenciesFromStorage() {
  const stored = tiLoad("ti_agencies", null);
  if (!stored) return;
  TI_AGENCIES.length = 0;
  TI_AGENCIES.push(...stored);
}

/**
 * TiDB — API unifiée d'accès asynchrone aux données.
 * Chaque méthode renvoie une Promise pour que les appelants soient déjà
 * corrects quel que soit l'adaptateur de backend actif.
 */
/** Reflète la logique de progression du pipeline clients du tableau de bord
 *  agence, pour que la séquence de bienvenue se déclenche depuis n'importe
 *  quel chemin de code menant à finaliser une réservation (confirmation,
 *  validation du dossier, ou signature du contrat). */
function tiComputeBookingStage(b) {
  if (b.status === "pending") return "requests";
  if (b.status !== "confirmed") return null;
  if (["awaiting_documents", "under_review", "changes_needed"].includes(b.dossierStatus)) return "validation";
  if (b.contracts && b.contracts.length && !b.contracts.every(c => c.signed)) return "signature";
  return "active";
}

/** Documents de vérification de base demandés automatiquement quand une
 *  agence confirme une réservation sans dossier déjà entamé — toute demande
 *  de réservation doit passer par la vérification de documents avant de
 *  devenir un client actif. */
/** Documents du kit de bienvenue par défaut — attachés automatiquement au
 *  dossier de chaque locataire dès que sa réservation devient active, sauf
 *  si l'agence les a personnalisés ou désactivés. Figés par réservation au
 *  moment de l'activation, pour que des modifications ultérieures
 *  n'affectent pas rétroactivement les documents déjà remis à un locataire. */
function tiDefaultWelcomeKit() {
  return [
    {
      id: "wk_welcome", enabled: true,
      title: "Message de bienvenue", titleEn: "Welcome message",
      content: "Bienvenue dans votre nouveau logement ! Nous sommes ravis de vous compter parmi nos locataires. N'hésitez pas à nous contacter pour toute question.",
      contentEn: "Welcome to your new home! We're delighted to have you as a tenant. Feel free to reach out with any question.",
    },
    {
      id: "wk_rules", enabled: true,
      title: "Règlement intérieur", titleEn: "House rules",
      content: "Merci de respecter le voisinage, de signaler rapidement toute anomalie à l'agence, et de prendre soin du bien comme s'il était le vôtre.",
      contentEn: "Please be respectful of neighbors, report any issue to the agency promptly, and take care of the property as if it were your own.",
    },
  ];
}

const TI_DEFAULT_SCREENING_DOCS = [
  { key: "id_card", label: "Pièce d'identité", labelEn: "ID document" },
  { key: "income_proof", label: "Justificatif de revenus", labelEn: "Proof of income" },
];

const TiDB = {
  async getAmenityCatalog() {
    return tiLoad("ti_amenity_catalog", TI_AMENITY_CATALOG_SEED);
  },
  async saveAmenityCatalogItem(item) {
    const all = tiLoad("ti_amenity_catalog", TI_AMENITY_CATALOG_SEED);
    if (item.id) {
      const existing = all.find(a => a.id === item.id);
      if (existing) Object.assign(existing, item);
      else all.push(item);
    } else {
      item.id = "am_custom_" + Date.now();
      all.push(item);
    }
    tiSave("ti_amenity_catalog", all);
    return item;
  },
  async deleteAmenityCatalogItem(id) {
    const all = tiLoad("ti_amenity_catalog", TI_AMENITY_CATALOG_SEED);
    tiSave("ti_amenity_catalog", all.filter(a => a.id !== id));
  },

  async getProperties() {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/properties`)).json();
    if (TI_BACKEND === "firebase") return tiFirestoreGetAll("properties");
    return tiLoad("ti_properties", TI_PROPERTIES);
  },
  async getProperty(id) {
    const all = await this.getProperties();
    return all.find(p => p.id === id);
  },
  async saveProperty(prop) {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/properties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prop) })).json();
    if (TI_BACKEND === "firebase") return tiFirestoreAdd("properties", prop);
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const idx = all.findIndex(p => p.id === prop.id);
    if (idx >= 0) all[idx] = prop; else all.push(prop);
    tiSave("ti_properties", all);
    return prop;
  },
  async nextPropertyReference(agencyId) {
    // Une référence d'annonce réaliste et professionnelle (ex. SH-2026-00038) —
    // le préfixe est le code de l'agence propriétaire, pour que les références
    // soient visiblement distinctes d'une agence à l'autre et ne se
    // chevauchent jamais entre agences.
    const agency = await this.getAgency(agencyId);
    const code = (agency && agency.code) || tiDeriveAgencyCode(agency ? agency.name : agencyId);
    const year = new Date().getFullYear();
    const counters = tiLoad("ti_ref_counters", {});
    const key = `${agencyId}_${year}`;
    const seededMax = TI_PROPERTIES.reduce((max, p) => {
      if (p.agencyId !== agencyId) return max;
      const m = new RegExp(`^${code}-\\d{4}-(\\d+)$`).exec(p.reference || "");
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const next = Math.max(counters[key] || 0, seededMax) + 1;
    counters[key] = next;
    tiSave("ti_ref_counters", counters);
    return `${code}-${year}-${String(next).padStart(5, "0")}`;
  },
  /* ---- Circuit de validation des suppressions ----
     Les agences ne suppriment jamais directement un bien ou un compte
     agent — l'action est enregistrée comme une demande en attente avec un
     motif, l'élément est masqué de l'usage normal, et seul un administrateur
     de la plateforme peut la transformer en suppression réelle et définitive
     après examen (ou la refuser, ce qui restaure l'élément). Dans les deux
     cas, l'agence demandeuse est notifiée. */
  async requestPropertyDeletion(id, reason, requestedByName) {
    const p = await this.getProperty(id);
    if (!p) return null;
    p.deletionStatus = "pending";
    p.deletionReason = reason;
    p.deletionRequestedAt = new Date().toISOString();
    p.deletionRequestedBy = requestedByName;
    await this.saveProperty(p);
    return p;
  },
  async cancelPropertyDeletion(id) {
    const p = await this.getProperty(id);
    if (p) {
      p.deletionStatus = null; p.deletionReason = null; p.deletionRequestedAt = null; p.deletionRequestedBy = null;
      await this.saveProperty(p);
    }
    return p;
  },
  async getPendingPropertyDeletions() {
    return (await this.getProperties()).filter(p => p.deletionStatus === "pending");
  },
  async approvePropertyDeletion(id, adminName) {
    const p = await this.getProperty(id);
    if (!p) return null;
    await this.deleteProperty(id);
    await this.broadcastNotification({
      title: "Suppression définitive validée",
      message: `L'annonce « ${p.title} » a été définitivement supprimée après validation par l'administration.`,
      audience: "agency:" + p.agencyId, adminId: null, adminName,
    });
    return true;
  },
  async rejectPropertyDeletion(id, adminName) {
    const p = await this.getProperty(id);
    if (!p) return null;
    p.deletionStatus = null; p.deletionReason = null; p.deletionRequestedAt = null; p.deletionRequestedBy = null;
    await this.saveProperty(p);
    await this.broadcastNotification({
      title: "Demande de suppression refusée",
      message: `La suppression de l'annonce « ${p.title} » a été refusée par l'administration ; elle reste active.`,
      audience: "agency:" + p.agencyId, adminId: null, adminName,
    });
    return true;
  },
  async requestAgentDeletion(id, reason, requestedByName) {
    const users = await this._usersAll();
    const u = users.find(u => u.id === id);
    if (!u) return null;
    u.deletionStatus = "pending";
    u.deletionReason = reason;
    u.deletionRequestedAt = new Date().toISOString();
    u.deletionRequestedBy = requestedByName;
    await this._userSave(u);
    return u;
  },
  async cancelAgentDeletion(id) {
    const users = await this._usersAll();
    const u = users.find(u => u.id === id);
    if (u) {
      u.deletionStatus = null; u.deletionReason = null; u.deletionRequestedAt = null; u.deletionRequestedBy = null;
      await this._userSave(u);
    }
    return u;
  },
  async getPendingAgentDeletions() {
    return (await this._usersAll()).filter(u => u.deletionStatus === "pending");
  },
  async approveAgentDeletion(id, adminName) {
    const users = await this._usersAll();
    const u = users.find(u => u.id === id);
    if (!u) return null;
    await this.deleteAgent(id);
    await this.broadcastNotification({
      title: "Suppression de compte validée",
      message: `Le compte de ${u.name} a été définitivement supprimé après validation par l'administration.`,
      audience: "agency:" + u.agencyId, adminId: null, adminName,
    });
    return true;
  },
  async rejectAgentDeletion(id, adminName) {
    const users = await this._usersAll();
    const u = users.find(u => u.id === id);
    if (!u) return null;
    u.deletionStatus = null; u.deletionReason = null; u.deletionRequestedAt = null; u.deletionRequestedBy = null;
    await this._userSave(u);
    await this.broadcastNotification({
      title: "Demande de suppression de compte refusée",
      message: `La suppression du compte de ${u.name} a été refusée par l'administration ; le compte reste actif.`,
      audience: "agency:" + u.agencyId, adminId: null, adminName,
    });
    return true;
  },

  async deleteProperty(id) {
    if (TI_BACKEND === "api") return tiApiFetch(`${TI_API_BASE}/properties/${id}`, { method: "DELETE" });
    if (TI_BACKEND === "firebase") return tiFirestoreDelete("properties", id);
    tiSave("ti_properties", tiLoad("ti_properties", TI_PROPERTIES).filter(p => p.id !== id));
  },
  async recordView(id) {
    if (TI_BACKEND === "api") return tiApiFetch(`${TI_API_BASE}/properties/${id}/view`, { method: "POST" });
    if (TI_BACKEND === "firebase") return; // best-effort only in the local demo backend
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === id);
    if (p) { p.views = (p.views || 0) + 1; tiSave("ti_properties", all); }
    return p;
  },
  async setListingStatus(id, status) {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/properties/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })).json();
    if (TI_BACKEND === "firebase") return tiFirestoreAdd("properties", { id, listingStatus: status });
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === id);
    if (p) { p.listingStatus = status; tiSave("ti_properties", all); }
    if (p && ["under_contract", "sold", "rented"].includes(status)) await this.notifyFavoritesOfStatusChange(p);
    return p;
  },
  async setTitleVerificationStatus(id, status, rejectionNote) {
    const prop = await this.getProperty(id);
    if (!prop || !prop.titleVerification) return null;
    prop.titleVerification.status = status;
    prop.titleVerification.rejectionNote = status === "rejected" ? (rejectionNote || null) : null;
    prop.titleVerification.verifiedAt = new Date().toISOString();
    await this.saveProperty(prop);
    return prop;
  },
  async notifyFavoritesOfStatusChange(property) {
    const favoriters = tiLoad("ti_favorites", []).filter(f => f.propertyId === property.id);
    if (!favoriters.length) return;
    const notifications = tiLoad("ti_notifications", []);
    favoriters.forEach(f => {
      notifications.push({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        type: "favorite_status", userId: f.userId, propertyId: property.id, propertyTitle: property.title,
        propertyCover: property.cover, status: property.listingStatus,
        createdAt: new Date().toISOString(), read: false,
      });
    });
    tiSave("ti_notifications", notifications);
  },
  async broadcastNotification({ title, message, audience, adminId, adminName }) {
    const users = await this.getUsers();
    let recipients;
    if (audience === "all") recipients = users;
    else if (audience === "clients") recipients = users.filter(u => u.role === "client");
    else if (audience === "agencies") recipients = users.filter(u => u.role === "agency");
    else if (audience === "admins") recipients = users.filter(u => u.role === "admin");
    else if (audience && audience.startsWith("agency:")) {
      const targetAgencyId = audience.slice("agency:".length);
      recipients = users.filter(u => u.role === "agency" && u.agencyId === targetAgencyId);
    } else recipients = [];

    const broadcastId = "bcast_" + Date.now();
    const now = new Date().toISOString();
    const notifications = tiLoad("ti_notifications", []);
    recipients.forEach(u => {
      notifications.push({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        type: "broadcast", broadcastId, userId: u.id, title, message,
        createdAt: now, read: false,
      });
    });
    tiSave("ti_notifications", notifications);

    const broadcasts = tiLoad("ti_broadcasts", []);
    broadcasts.push({ id: broadcastId, title, message, audience, recipientCount: recipients.length, createdAt: now, adminId, adminName });
    tiSave("ti_broadcasts", broadcasts);
    return { id: broadcastId, recipientCount: recipients.length };
  },
  async getBroadcasts() {
    return tiLoad("ti_broadcasts", []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  async editBroadcast(broadcastId, { title, message }) {
    const broadcasts = tiLoad("ti_broadcasts", []);
    const b = broadcasts.find(b => b.id === broadcastId);
    if (b) { b.title = title; b.message = message; b.editedAt = new Date().toISOString(); }
    tiSave("ti_broadcasts", broadcasts);
    const notifications = tiLoad("ti_notifications", []);
    notifications.forEach(n => { if (n.broadcastId === broadcastId) { n.title = title; n.message = message; } });
    tiSave("ti_notifications", notifications);
    return b;
  },
  async deleteBroadcast(broadcastId) {
    tiSave("ti_broadcasts", tiLoad("ti_broadcasts", []).filter(b => b.id !== broadcastId));
    tiSave("ti_notifications", tiLoad("ti_notifications", []).filter(n => n.broadcastId !== broadcastId));
  },
  async getNotifications(userId) {
    return tiLoad("ti_notifications", []).filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  async markNotificationsRead(userId) {
    const all = tiLoad("ti_notifications", []);
    all.forEach(n => { if (n.userId === userId) n.read = true; });
    tiSave("ti_notifications", all);
  },

  async getAgencies() {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/agencies`)).json();
    if (TI_BACKEND === "firebase") return tiFirestoreGetAll("agencies");
    return tiLoad("ti_agencies", TI_AGENCIES);
  },
  async getAgency(id) {
    return (await this.getAgencies()).find(a => a.id === id);
  },
  async getAgencyBySlug(slug) {
    const all = await this.getAgencies();
    return all.find(a => a.subsiteSlug === slug && a.subsiteEnabled) || null;
  },
  async toggleAgencySubsite(agencyId) {
    const agency = await this.getAgency(agencyId);
    if (!agency) return null;
    const subsiteEnabled = !agency.subsiteEnabled;
    const subsiteSlug = subsiteEnabled && !agency.subsiteSlug ? tiSlugify(agency.name) + "-" + agencyId.slice(-4) : agency.subsiteSlug;
    await this.saveAgency({ id: agencyId, subsiteEnabled, subsiteSlug });
    return { ...agency, subsiteEnabled, subsiteSlug };
  },
  async updateAgencyLogo(agencyId, dataUrl) {
    const agency = await this.getAgency(agencyId);
    if (!agency) return null;
    await this.saveAgency({ id: agencyId, logoDataUrl: dataUrl });
    return { ...agency, logoDataUrl: dataUrl };
  },
  async getWelcomeKit(agencyId) {
    const agency = await this.getAgency(agencyId);
    if (!agency) return [];
    if (!agency.welcomeKit) {
      agency.welcomeKit = tiDefaultWelcomeKit();
      await this.saveAgency({ id: agencyId, welcomeKit: agency.welcomeKit });
    }
    return agency.welcomeKit;
  },
  async saveWelcomeKitItem(agencyId, item) {
    const agency = await this.getAgency(agencyId);
    if (!agency) return null;
    const welcomeKit = agency.welcomeKit || tiDefaultWelcomeKit();
    if (item.id) {
      const idx = welcomeKit.findIndex(d => d.id === item.id);
      if (idx !== -1) welcomeKit[idx] = item;
    } else {
      item.id = "wk_" + Date.now();
      item.enabled = true;
      welcomeKit.push(item);
    }
    await this.saveAgency({ id: agencyId, welcomeKit });
    return welcomeKit;
  },
  async deleteWelcomeKitItem(agencyId, itemId) {
    const agency = await this.getAgency(agencyId);
    if (!agency || !agency.welcomeKit) return null;
    const welcomeKit = agency.welcomeKit.filter(d => d.id !== itemId);
    await this.saveAgency({ id: agencyId, welcomeKit });
    return welcomeKit;
  },
  async toggleWelcomeKitItem(agencyId, itemId) {
    const agency = await this.getAgency(agencyId);
    if (!agency || !agency.welcomeKit) return null;
    const item = agency.welcomeKit.find(d => d.id === itemId);
    if (item) item.enabled = !item.enabled;
    await this.saveAgency({ id: agencyId, welcomeKit: agency.welcomeKit });
    return agency.welcomeKit;
  },
  async saveAgency(agency) {
    let saved;
    if (TI_BACKEND === "api") {
      saved = await (await tiApiFetch(`${TI_API_BASE}/agencies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(agency) })).json();
    } else if (TI_BACKEND === "firebase") {
      saved = await tiFirestoreAdd("agencies", agency);
    } else {
      const all = tiLoad("ti_agencies", TI_AGENCIES);
      const idx = all.findIndex(a => a.id === agency.id);
      if (idx >= 0) all[idx] = { ...all[idx], ...agency }; else all.push({ status: "active", ...agency });
      tiSave("ti_agencies", all);
      saved = agency;
    }
    tiSyncAgenciesFromStorage();
    return saved;
  },
  async deleteAgency(id, cascade = true) {
    if (TI_BACKEND === "api") { await tiApiFetch(`${TI_API_BASE}/agencies/${id}`, { method: "DELETE" }); }
    else if (TI_BACKEND === "firebase") { await tiFirestoreDelete("agencies", id); }
    else { tiSave("ti_agencies", tiLoad("ti_agencies", TI_AGENCIES).filter(a => a.id !== id)); }
    tiSyncAgenciesFromStorage();
    if (cascade) {
      const props = await this.getProperties();
      for (const p of props.filter(p => p.agencyId === id)) await this.deleteProperty(p.id);
    }
  },

  /** Point de passage unique pour lire/sauvegarder les utilisateurs — même
   *  logique que _bookingsAll/_bookingSave, pour que toutes les méthodes de
   *  gestion des utilisateurs (panneau admin, agents d'agence, etc.)
   *  fonctionnent avec l'API sans dupliquer la logique partout. */
  async _usersAll() {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/users`)).json();
    return tiLoad("ti_users", []);
  },
  async _userSave(user) {
    if (TI_BACKEND === "api") {
      return (await tiApiFetch(`${TI_API_BASE}/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(user) })).json();
    }
    const users = tiLoad("ti_users", []);
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user;
    tiSave("ti_users", users);
    return user;
  },
  async getUsers() { return this._usersAll(); },
  async findUserByEmail(email) {
    return (await this.getUsers()).find(u => u.email.toLowerCase() === email.toLowerCase());
  },
  async createUser(user) {
    const users = tiLoad("ti_users", []);
    users.push(user);
    tiSave("ti_users", users);
    return user;
  },
  async updateUser(id, patch) {
    const users = await this._usersAll();
    const u = users.find(u => u.id === id);
    if (!u) return null;
    Object.assign(u, patch);
    await this._userSave(u);
    return u;
  },

  async getAgents(agencyId) {
    const users = await this.getUsers();
    return users.filter(u => u.role === "agency" && u.agencyId === agencyId && u.agentRole === "agent");
  },
  async setUserStatus(id, status) {
    const users = await this._usersAll();
    const u = users.find(u => u.id === id);
    if (u) { u.status = status; await this._userSave(u); }
    return u;
  },
  async recordLogin(id) {
    const users = await this._usersAll();
    const u = users.find(u => u.id === id);
    if (u) { u.lastLoginAt = new Date().toISOString(); await this._userSave(u); }
  },
  async regenerateTempPassword(id) {
    if (TI_BACKEND === "api") {
      const res = await tiApiFetch(`${TI_API_BASE}/users/${id}/reset-password`, { method: "POST" });
      return res.json();
    }
    const users = tiLoad("ti_users", []);
    const u = users.find(u => u.id === id);
    if (!u) return { ok: false };
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    await tiSetUserPassword(u, pwd);
    u.mustChangePassword = true;
    tiSave("ti_users", users);
    return { ok: true, password: pwd };
  },
  async createAgent({ name, email, password, agencyId }) {
    if (TI_BACKEND === "api") {
      const res = await tiApiFetch(`${TI_API_BASE}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, role: "agency", agentRole: "agent", agencyId }) });
      if (!res.ok) { const body = await res.json().catch(() => ({})); return { ok: false, error: body.error || "exists" }; }
      const data = await res.json();
      return { ok: true, agent: data.user };
    }
    const existing = await this.findUserByEmail(email);
    if (existing) return { ok: false, error: "exists" };
    const agent = { id: "u_" + Date.now(), role: "agency", agentRole: "agent", name, email, agencyId, createdAt: new Date().toISOString() };
    await tiSetUserPassword(agent, password);
    await this.createUser(agent);
    return { ok: true, agent };
  },
  async createAgencySupervisor({ name, email, phone, password, agencyId }) {
    if (TI_BACKEND === "api") {
      const res = await tiApiFetch(`${TI_API_BASE}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, role: "agency", agentRole: "supervisor", agencyId, phone }) });
      if (!res.ok) { const body = await res.json().catch(() => ({})); return { ok: false, error: body.error || "exists" }; }
      const data = await res.json();
      return { ok: true, supervisor: data.user };
    }
    const existing = await this.findUserByEmail(email);
    if (existing) return { ok: false, error: "exists" };
    const supervisor = { id: "u_" + Date.now(), role: "agency", agentRole: "supervisor", name, email, phone, agencyId, createdAt: new Date().toISOString() };
    await tiSetUserPassword(supervisor, password);
    await this.createUser(supervisor);
    return { ok: true, supervisor };
  },
  async getAgencySupervisor(agencyId) {
    const users = await this.getUsers();
    return users.find(u => u.role === "agency" && u.agencyId === agencyId && u.agentRole === "supervisor") || null;
  },
  async canAddAgent(agencyId) {
    const agency = await this.getAgency(agencyId);
    if (!agency || agency.maxAgents == null) return true;
    const agents = await this.getAgents(agencyId);
    return agents.length < agency.maxAgents;
  },
  async canAddListing(agencyId) {
    const agency = await this.getAgency(agencyId);
    if (!agency || agency.maxListings == null) return true;
    const props = await this.getProperties();
    return props.filter(p => p.agencyId === agencyId).length < agency.maxListings;
  },
  async deleteAgent(id) {
    if (TI_BACKEND === "api") { await tiApiFetch(`${TI_API_BASE}/users/${id}`, { method: "DELETE" }); }
    else { tiSave("ti_users", tiLoad("ti_users", []).filter(u => u.id !== id)); }
    // désassocie tous les biens qui relevaient de cet agent
    const props = await this.getProperties();
    for (const p of props.filter(p => p.assignedAgentId === id)) {
      p.assignedAgentId = null;
      await this.saveProperty(p);
    }
  },
  async assignProperty(propertyId, agentId) {
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === propertyId);
    if (p) { p.assignedAgentId = agentId || null; tiSave("ti_properties", all); }
    return p;
  },

  /** Point de passage unique pour lire les réservations, utilisé par toutes
   *  les méthodes ci-dessous plutôt que chacune faisant son propre
   *  tiLoad("ti_bookings") — un seul endroit à rendre compatible API. */
  async _bookingsAll(filter = {}) {
    if (TI_BACKEND === "api") {
      const params = new URLSearchParams(filter).toString();
      return (await tiApiFetch(`${TI_API_BASE}/bookings${params ? "?" + params : ""}`)).json();
    }
    let all = tiLoad("ti_bookings", []);
    if (filter.userId) all = all.filter(b => b.userId === filter.userId);
    if (filter.agencyId) all = all.filter(b => b.agencyId === filter.agencyId);
    if (filter.propertyId) all = all.filter(b => b.propertyId === filter.propertyId);
    return all;
  },
  /** Point de passage unique pour créer/sauvegarder une réservation —
   *  upsert par id métier, aussi bien en local qu'à travers l'API. */
  async _bookingSave(booking) {
    if (TI_BACKEND === "api") {
      return (await tiApiFetch(`${TI_API_BASE}/bookings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(booking) })).json();
    }
    const all = tiLoad("ti_bookings", []);
    const idx = all.findIndex(b => b.id === booking.id);
    if (idx >= 0) all[idx] = booking; else all.unshift(booking);
    tiSave("ti_bookings", all);
    return booking;
  },
  async getBookings(filter = {}) {
    return this._bookingsAll(filter);
  },
  async createBooking(booking) {
    booking.id = "bk_" + Date.now();
    booking.status = "pending";
    booking.createdAt = new Date().toISOString();
    return this._bookingSave(booking);
  },
  async updateBookingStatus(id, status) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === id);
    if (b) { b.status = status; await this._bookingSave(b); }
    if (status === "confirmed") {
      if (b && !b.dossierStatus) await this.requestDocuments(id, TI_DEFAULT_SCREENING_DOCS);
      await this.maybeSendWelcome(id);
    }
    return b;
  },
  async updateBooking(id, patch) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === id);
    if (b) { Object.assign(b, patch); await this._bookingSave(b); }
    return b;
  },

  /* ---- Circuit du dossier : l'agence demande des documents, le client les soumet, l'agence les examine ---- */
  async requestDocuments(bookingId, docs) {
    // docs : [{ key, label, labelEn }]
    const dueAt = new Date(Date.now() + 5 * 86400000).toISOString(); // 5 days to submit
    const b = await this.updateBooking(bookingId, {
      documentRequests: docs.map(d => ({ ...d, status: "pending", fileName: null, note: null, submittedAt: null })),
      dossierStatus: "awaiting_documents",
      dossierUpdatedAt: new Date().toISOString(),
      dossierDueAt: dueAt,
    });
    if (b) {
      await this.sendMessage({
        propertyId: b.propertyId, propertyTitle: b.propertyTitle, agencyId: b.agencyId,
        userId: b.userId, userName: b.name, from: "agency",
        text: `Merci de transmettre les documents demandés pour votre dossier avant le ${new Date(dueAt).toLocaleDateString("fr-FR")} — rendez-vous dans "Mes réservations".`,
      });
    }
    return b;
  },
  async sendContract(bookingId, fileName, fileData) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === bookingId);
    if (!b) return null;
    b.contracts = b.contracts || [];
    b.contracts.push({ id: "ctr_" + Date.now(), fileName, fileData: fileData || null, sentAt: new Date().toISOString() });
    try {
      await this._bookingSave(b);
    } catch (err) {
      // Quota de stockage dépassé (local) ou charge utile trop grande (API) — on garde les métadonnées, on jette l'aperçu.
      b.contracts[b.contracts.length - 1].fileData = null;
      await this._bookingSave(b);
      return { ...b, _storageFallback: true };
    }
    return b;
  },
  async signContract(bookingId, contractId) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.contracts) return null;
    const ctr = b.contracts.find(c => c.id === contractId);
    if (ctr) { ctr.signed = true; ctr.signedAt = new Date().toISOString(); }
    await this._bookingSave(b);
    await this.maybeSendWelcome(bookingId);
    return b;
  },
  async submitDocument(bookingId, docKey, fileName, fileData) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.documentRequests) return null;
    const doc = b.documentRequests.find(d => d.key === docKey);
    if (doc) { doc.status = "submitted"; doc.fileName = fileName; doc.fileData = fileData || null; doc.submittedAt = new Date().toISOString(); doc.note = null; }
    const allSubmitted = b.documentRequests.every(d => d.status === "submitted" || d.status === "approved");
    if (allSubmitted) b.dossierStatus = "under_review";
    b.dossierUpdatedAt = new Date().toISOString();
    try {
      await this._bookingSave(b);
    } catch (err) {
      // Quota de stockage dépassé (fichier volumineux en base64) — on garde les métadonnées, on jette l'aperçu.
      if (doc) doc.fileData = null;
      await this._bookingSave(b);
      return { ...b, _storageFallback: true };
    }
    return b;
  },
  async reviewDocument(bookingId, docKey, status, note) {
    // status : "approved" | "rejected"
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.documentRequests) return null;
    const doc = b.documentRequests.find(d => d.key === docKey);
    if (doc) { doc.status = status; doc.note = note || null; }
    if (b.documentRequests.some(d => d.status === "rejected")) b.dossierStatus = "changes_needed";
    else if (b.documentRequests.every(d => d.status === "approved")) b.dossierStatus = "approved";
    else b.dossierStatus = "under_review";
    b.dossierUpdatedAt = new Date().toISOString();
    if (status === "rejected") {
      b.dossierDueAt = new Date(Date.now() + 3 * 86400000).toISOString(); // 3 days to resubmit
      await this._bookingSave(b);
      await this.sendMessage({
        propertyId: b.propertyId, propertyTitle: b.propertyTitle, agencyId: b.agencyId,
        userId: b.userId, userName: b.name, from: "agency",
        text: `Un document de votre dossier nécessite une correction${note ? ` : ${note}` : ""}. Merci de le renvoyer avant le ${new Date(b.dossierDueAt).toLocaleDateString("fr-FR")} — rendez-vous dans "Mes réservations".`,
      });
    } else {
      await this._bookingSave(b);
    }
    await this.maybeSendWelcome(bookingId);
    return b;
  },

  /* ---- Grand livre locatif : dépôt de garantie, échéancier mensuel, charges ----
     Généré dès qu'une réservation de location mensuelle est confirmée. Les
     charges (eau, électricité, internet...) démarrent désactivées — l'agence
     active celles qui s'appliquent à ce bail et fixe leur montant mensuel. */
  async ensureRentalLedger(bookingId) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === bookingId);
    if (!b || b.rental) return b;
    const start = b.checkin ? new Date(b.checkin) : new Date();
    const schedule = [];
    for (let i = 0; i < 6; i++) {
      const due = new Date(start.getFullYear(), start.getMonth() + i, start.getDate() || 5);
      schedule.push({
        id: `sch_${b.id}_${i}`,
        dueDate: due.toISOString().slice(0, 10),
        rent: b.price,
        chargesAmount: 0,
        status: "pending",
        paidAt: null,
        method: null,
      });
    }
    b.rental = {
      deposit: { amount: b.price, status: "pending", paidAt: null, method: null },
      charges: [
        { key: "water", label: "Eau", labelEn: "Water", amount: 5000, enabled: false },
        { key: "electricity", label: "Électricité", labelEn: "Electricity", amount: 15000, enabled: false },
        { key: "internet", label: "Internet", labelEn: "Internet", amount: 12000, enabled: false },
        { key: "other", label: "Charges de copropriété", labelEn: "Condo fees", amount: 0, enabled: false },
      ],
      schedule,
    };
    await this._bookingSave(b);
    return b;
  },
  async setRentalCharges(bookingId, charges) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.rental) return null;
    b.rental.charges = charges;
    const chargesTotal = charges.filter(c => c.enabled).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    b.rental.schedule.forEach(item => {
      if (item.status !== "paid") item.chargesAmount = chargesTotal;
    });
    await this._bookingSave(b);
    return b;
  },
  async payRentalDeposit(bookingId, method) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.rental) return null;
    b.rental.deposit.status = "paid";
    b.rental.deposit.paidAt = new Date().toISOString();
    b.rental.deposit.method = method;
    await this._bookingSave(b);
    return b;
  },
  async payRentalScheduleItem(bookingId, scheduleId, method) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.rental) return null;
    const item = b.rental.schedule.find(s => s.id === scheduleId);
    if (item) { item.status = "paid"; item.paidAt = new Date().toISOString(); item.method = method; }
    await this._bookingSave(b);
    return b;
  },

  async getMessages(filter = {}) {
    if (TI_BACKEND === "api") {
      const params = new URLSearchParams(filter).toString();
      return (await tiApiFetch(`${TI_API_BASE}/messages${params ? "?" + params : ""}`)).json();
    }
    let all = tiLoad("ti_messages", []);
    if (filter.propertyId) all = all.filter(m => m.propertyId === filter.propertyId);
    if (filter.userId) all = all.filter(m => m.userId === filter.userId);
    if (filter.agencyId) all = all.filter(m => m.agencyId === filter.agencyId);
    return all;
  },
  async sendMessage(msg) {
    msg.id = "msg_" + Date.now();
    msg.createdAt = new Date().toISOString();
    if (TI_BACKEND === "api") {
      return (await tiApiFetch(`${TI_API_BASE}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg) })).json();
    }
    const all = tiLoad("ti_messages", []);
    all.push(msg);
    tiSave("ti_messages", all);
    return msg;
  },
  async maybeSendWelcome(bookingId) {
    const all = await this._bookingsAll();
    const b = all.find(b => b.id === bookingId);
    if (!b || b.welcomed) return;
    if (tiComputeBookingStage(b) !== "active") return;
    b.welcomed = true;

    // Le client est maintenant pleinement intégré — le bien n'est plus
    // disponible. On le reflète automatiquement plutôt que de compter sur
    // l'agence pour se rappeler de cliquer manuellement sur « marquer vendu/
    // loué » ; cela déclenche aussi la notification existante pour les
    // annonces mises en favori. Les biens en séjour court restent
    // réservables par de futurs voyageurs, donc ils sont exclus.
    const property = await this.getProperty(b.propertyId);
    if (property && !property.shortStay) {
      await this.setListingStatus(b.propertyId, property.forSale ? "sold" : "rented");
    }
    const agency = await this.getAgency(b.agencyId);
    const agencyName = agency ? agency.name : "";

    // Fige les documents du kit de bienvenue actuellement activés par
    // l'agence sur le dossier de cette réservation, avec les variables de
    // fusion substituées pour ce locataire précis — des modifications
    // ultérieures du modèle de kit de l'agence n'affecteront pas
    // rétroactivement les documents déjà remis à ce locataire.
    const kit = await this.getWelcomeKit(b.agencyId);
    const mergeVars = { client_name: (b.name || "").split(" ")[0], property_title: b.propertyTitle, agency_name: agencyName };
    b.documents = kit.filter(d => d.enabled).map(d => ({
      id: "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      title: d.title, titleEn: d.titleEn,
      content: tiSubstituteVars(d.content, mergeVars), contentEn: tiSubstituteVars(d.contentEn, mergeVars),
      createdAt: new Date().toISOString(),
    }));
    await this._bookingSave(b);
    await this.sendMessage({
      propertyId: b.propertyId, propertyTitle: b.propertyTitle, agencyId: b.agencyId,
      userId: b.userId, userName: b.name, from: "agency",
      text: `Bienvenue chez ${agencyName} ! Votre dossier a été validé et votre installation est confirmée. Retrouvez votre kit de bienvenue dans "Mes documents".`,
    });
  },

  async getAnnouncements({ agencyId, userId } = {}) {
    let list;
    if (TI_BACKEND === "api") {
      const params = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
      list = await (await tiApiFetch(`${TI_API_BASE}/announcements${params}`)).json();
    } else {
      list = tiLoad("ti_announcements", []);
      if (agencyId) list = list.filter(a => a.agencyId === agencyId);
    }
    if (userId) {
      const bookings = (await this._bookingsAll({ userId })).filter(b => b.status === "confirmed");
      const myAgencyIds = new Set(bookings.map(b => b.agencyId));
      const myPropertyIds = new Set(bookings.map(b => b.propertyId));
      list = list.filter(a => myAgencyIds.has(a.agencyId) && (!a.propertyId || myPropertyIds.has(a.propertyId)));
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  async createAnnouncement({ agencyId, propertyId, title, text }) {
    const announcement = { id: "an_" + Date.now(), agencyId, propertyId: propertyId || null, title, text, createdAt: new Date().toISOString() };
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/announcements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(announcement) })).json();
    const all = tiLoad("ti_announcements", []);
    all.push(announcement);
    tiSave("ti_announcements", all);
    return announcement;
  },
  async deleteAnnouncement(id) {
    if (TI_BACKEND === "api") { await tiApiFetch(`${TI_API_BASE}/announcements/${id}`, { method: "DELETE" }); return; }
    const all = tiLoad("ti_announcements", []);
    tiSave("ti_announcements", all.filter(a => a.id !== id));
  },

  async getReviews(propertyId) {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/reviews?propertyId=${encodeURIComponent(propertyId)}`)).json();
    return tiLoad("ti_reviews", []).filter(r => r.propertyId === propertyId);
  },
  async addReview(review) {
    review.id = "rv_" + Date.now();
    review.createdAt = new Date().toISOString();
    review.approved = true;
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(review) })).json();
    const all = tiLoad("ti_reviews", []);
    all.unshift(review);
    tiSave("ti_reviews", all);
    return review;
  },
  async getAllReviews() {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/reviews`)).json();
    return tiLoad("ti_reviews", []);
  },
  async moderateReview(id, approved) {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved }) })).json();
    const all = tiLoad("ti_reviews", []);
    const r = all.find(r => r.id === id);
    if (r) r.approved = approved;
    tiSave("ti_reviews", all);
    return r;
  },

  async logAction(entry) {
    const log = tiLoad("ti_audit_log", []);
    log.push({
      id: "log_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      ...entry,
    });
    // Plafonne le journal pour que le localStorage ne grossisse pas indéfiniment dans cette démo côté client.
    const MAX_LOG_ENTRIES = 500;
    if (log.length > MAX_LOG_ENTRIES) log.splice(0, log.length - MAX_LOG_ENTRIES);
    tiSave("ti_audit_log", log);
  },
  async getAuditLog(filter = {}) {
    let all = tiLoad("ti_audit_log", []);
    if (filter.agencyId) all = all.filter(l => l.agencyId === filter.agencyId);
    if (filter.actorId) all = all.filter(l => l.actorId === filter.actorId);
    if (filter.actorRole) all = all.filter(l => l.actorRole === filter.actorRole);
    return all.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  async getPayments(filter = {}) {
    if (TI_BACKEND === "api") {
      const params = new URLSearchParams(filter).toString();
      return (await tiApiFetch(`${TI_API_BASE}/payments${params ? "?" + params : ""}`)).json();
    }
    let all = tiLoad("ti_payments", []);
    if (filter.userId) all = all.filter(p => p.userId === filter.userId);
    return all;
  },

  async getAgencySubscription(agencyId) {
    const agency = await this.getAgency(agencyId);
    if (!agency) return null;
    const tier = TI_AGENCY_TIERS.find(t2 => t2.id === agency.tier) || TI_AGENCY_TIERS[0];
    return {
      agencyId, tierId: tier.id, monthlyFee: tier.monthlyFee,
      status: agency.subscriptionStatus || "active",
      subscribedSince: agency.subscribedSince || null,
    };
  },
  async getAgencyInvoices(agencyId) {
    const agency = await this.getAgency(agencyId);
    if (!agency) return [];
    const stored = tiLoad("ti_agency_invoices", {});
    if (stored[agencyId]) return stored[agencyId];
    // Génère un historique de facturation réaliste au premier accès
    // (déterministe par agence, puis persisté pour rester stable entre rechargements).
    const tier = TI_AGENCY_TIERS.find(t2 => t2.id === agency.tier) || TI_AGENCY_TIERS[0];
    const methods = ["wave", "om", "card"];
    const months = 6;
    const now = new Date();
    const invoices = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const isCurrent = i === 0;
      const overdue = isCurrent && agency.subscriptionStatus === "past_due";
      const trial = isCurrent && agency.subscriptionStatus === "trial";
      invoices.push({
        id: `inv_${agencyId}_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`,
        period: d.toISOString().slice(0, 7),
        amount: tier.monthlyFee,
        status: trial ? "trial" : overdue ? "overdue" : "paid",
        method: trial || overdue ? null : methods[(i + agencyId.length) % methods.length],
        paidAt: trial || overdue ? null : new Date(d.getFullYear(), d.getMonth(), 3 + (i % 5)).toISOString(),
      });
    }
    stored[agencyId] = invoices;
    tiSave("ti_agency_invoices", stored);
    return invoices;
  },
  async markInvoicePaid(agencyId, invoiceId, method) {
    const stored = tiLoad("ti_agency_invoices", {});
    const list = stored[agencyId] || [];
    const inv = list.find(i => i.id === invoiceId);
    if (inv) { inv.status = "paid"; inv.method = method; inv.paidAt = new Date().toISOString(); }
    tiSave("ti_agency_invoices", stored);
    const agency = await this.getAgency(agencyId);
    if (agency && (agency.subscriptionStatus === "past_due" || agency.subscriptionStatus === "trial")) {
      await this.saveAgency({ id: agencyId, subscriptionStatus: "active" });
    }
    return inv;
  },
  async createPayment(payment) {
    payment.id = "pay_" + Date.now();
    payment.createdAt = new Date().toISOString();
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payment) })).json();
    const all = tiLoad("ti_payments", []);
    all.unshift(payment);
    tiSave("ti_payments", all);
    return payment;
  },

  async getFavorites(userId) {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/favorites?userId=${encodeURIComponent(userId)}`)).json();
    return tiLoad("ti_favorites", []).filter(f => f.userId === userId);
  },
  async toggleFavorite(userId, propertyId) {
    if (TI_BACKEND === "api") {
      const data = await (await tiApiFetch(`${TI_API_BASE}/favorites/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, propertyId }) })).json();
      return data.favorited;
    }
    let all = tiLoad("ti_favorites", []);
    const exists = all.find(f => f.userId === userId && f.propertyId === propertyId);
    if (exists) {
      all = all.filter(f => f !== exists);
    } else {
      all.push({ userId, propertyId });
    }
    tiSave("ti_favorites", all);
    return !exists;
  },

  async subscribeNewsletter(email) {
    if (TI_BACKEND === "api") return (await tiApiFetch(`${TI_API_BASE}/newsletter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })).json();
    if (TI_BACKEND === "firebase") return tiFirestoreAdd("newsletter", { email, createdAt: new Date().toISOString() });
    const all = tiLoad("ti_newsletter", []);
    if (!all.includes(email)) all.push(email);
    tiSave("ti_newsletter", all);
    return { ok: true };
  },
};
