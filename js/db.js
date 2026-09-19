/* ============================================================
   Timmo — data access layer (TiDB)
   ------------------------------------------------------------
   Every read/write in the app goes through the TiDB object below
   instead of touching localStorage directly. That means swapping
   the storage backend for a real database is a matter of
   rewriting the function bodies in ONE of the two adapters below
   — no changes needed in any page's UI code.

   ADAPTER 1 (active by default): localStorage
     Works fully offline, no setup. Good for demoing the product.

   ADAPTER 2 (ready to activate): Firebase Firestore
     1. Create a project at https://console.firebase.google.com
     2. Enable Firestore + Authentication (Email/Password).
     3. Paste your web app config into js/firebase-config.js
     4. Include the Firebase SDK script tags (see comment at the
        top of firebase-config.js) in every HTML page, BEFORE
        js/db.js.
     5. Set TI_BACKEND = "firebase" below.

   ADAPTER 3 (ready to activate): Node.js / Express + MongoDB API
     A working scaffold is provided in /server (server.js,
     routes/*.js). Run it with `npm install && npm start` inside
     /server, then set TI_BACKEND = "api" below and TI_API_BASE
     to the server's URL (defaults to http://localhost:4000/api).
   ============================================================ */

const TI_BACKEND = "local"; // "local" | "firebase" | "api"
const TI_API_BASE = "http://localhost:4000/api";

function tiLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function tiSave(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---- one-time seed of the local "database" ----
   TI_SCHEMA_VERSION bumps whenever the shape of TI_PROPERTIES or
   TI_AGENCIES changes (new fields, etc.). On a version mismatch we
   refresh the demo data from the current seed so a browser that
   visited an older build never gets stuck with records missing a
   field the UI now expects — while leaving the user's own bookings,
   messages, reviews, payments and favorites untouched. */
const TI_SCHEMA_VERSION = "7";

(function tiSeedLocalDb() {
  const seededVersion = localStorage.getItem("ti_seeded");
  if (seededVersion === TI_SCHEMA_VERSION) {
    tiSyncAgenciesFromStorage();
    return;
  }

  if (!seededVersion) {
    // brand new browser: seed everything
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
    // returning browser on an older schema: refresh only the demo
    // catalogs (agency-published listings / admin-added agencies from
    // TiDB already carry the current shape, so merge those back in) —
    // bookings/messages/reviews/payments/favorites are left as-is.
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

    // Retrofit the supervisor/agent hierarchy onto existing installs:
    // give every pre-existing agency login "supervisor" rank (they were
    // full-access agency owners before agents existed) and add the demo
    // agent account so the feature is visible right away.
    const existingUsers = tiLoad("ti_users", []);
    let usersChanged = false;
    existingUsers.forEach(u => {
      if (u.role === "agency" && !u.agentRole) { u.agentRole = "supervisor"; usersChanged = true; }
    });
    if (!existingUsers.some(u => u.email === "agent@demo.sn")) {
      existingUsers.push({ id: "u_agent1", role: "agency", agentRole: "agent", name: "Moussa Fall", agencyId: "ag001", email: "agent@demo.sn", password: "demo1234" });
      usersChanged = true;
    }
    if (usersChanged) tiSave("ti_users", existingUsers);
  }

  localStorage.setItem("ti_seeded", TI_SCHEMA_VERSION);
  tiSyncAgenciesFromStorage();
})();

/* TI_AGENCIES stays a plain in-memory array (many synchronous helpers
   like tiAgencyName() read it directly), but its contents are kept in
   sync with the persisted copy so admin edits survive a reload. */
function tiSyncAgenciesFromStorage() {
  const stored = tiLoad("ti_agencies", null);
  if (!stored) return;
  TI_AGENCIES.length = 0;
  TI_AGENCIES.push(...stored);
}

/**
 * TiDB — unified async data access API.
 * Every method returns a Promise so callers already read correctly
 * regardless of which backend adapter is active.
 */
/** Mirrors the agency dashboard's client-pipeline staging logic, so the
 *  welcome sequence fires from any code path that can complete a booking
 *  (confirmation, dossier approval, or contract signature). */
function tiComputeBookingStage(b) {
  if (b.status === "pending") return "requests";
  if (b.status !== "confirmed") return null;
  if (["awaiting_documents", "under_review", "changes_needed"].includes(b.dossierStatus)) return "validation";
  if (b.contracts && b.contracts.length && !b.contracts.every(c => c.signed)) return "signature";
  return "active";
}

/** Baseline screening documents automatically requested when an agency confirms
 *  a booking that never had a dossier started — every booking request must go
 *  through document verification before becoming an active client. */
/** Default welcome-kit documents — auto-attached to every tenant's dossier
 *  once their booking goes active, unless the agency has customized or
 *  disabled them. Snapshotted per-booking at activation time so later
 *  edits don't retroactively change documents already issued to a tenant. */
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
    if (TI_BACKEND === "api") return (await fetch(`${TI_API_BASE}/properties`)).json();
    if (TI_BACKEND === "firebase") return tiFirestoreGetAll("properties");
    return tiLoad("ti_properties", TI_PROPERTIES);
  },
  async getProperty(id) {
    const all = await this.getProperties();
    return all.find(p => p.id === id);
  },
  async saveProperty(prop) {
    if (TI_BACKEND === "api") return (await fetch(`${TI_API_BASE}/properties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prop) })).json();
    if (TI_BACKEND === "firebase") return tiFirestoreAdd("properties", prop);
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const idx = all.findIndex(p => p.id === prop.id);
    if (idx >= 0) all[idx] = prop; else all.push(prop);
    tiSave("ti_properties", all);
    return prop;
  },
  async nextPropertyReference(agencyId) {
    // A realistic, professional listing reference (e.g. SH-2026-00038) — the prefix
    // is the owning agency's code, so references are visibly distinct from one
    // agency to another and never collide across agencies.
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
  /* ---- Deletion review workflow ----
     Agencies never delete a property or an agent account outright — the
     action is recorded as a pending request with a reason, the item is
     hidden from normal use, and only a platform administrator can turn it
     into a real, permanent deletion after reviewing it (or reject it,
     restoring the item). Either outcome notifies the requesting agency. */
  async requestPropertyDeletion(id, reason, requestedByName) {
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === id);
    if (!p) return null;
    p.deletionStatus = "pending";
    p.deletionReason = reason;
    p.deletionRequestedAt = new Date().toISOString();
    p.deletionRequestedBy = requestedByName;
    tiSave("ti_properties", all);
    return p;
  },
  async cancelPropertyDeletion(id) {
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === id);
    if (p) { delete p.deletionStatus; delete p.deletionReason; delete p.deletionRequestedAt; delete p.deletionRequestedBy; tiSave("ti_properties", all); }
    return p;
  },
  async getPendingPropertyDeletions() {
    return tiLoad("ti_properties", TI_PROPERTIES).filter(p => p.deletionStatus === "pending");
  },
  async approvePropertyDeletion(id, adminName) {
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === id);
    if (!p) return null;
    tiSave("ti_properties", all.filter(pr => pr.id !== id));
    await this.broadcastNotification({
      title: "Suppression définitive validée",
      message: `L'annonce « ${p.title} » a été définitivement supprimée après validation par l'administration.`,
      audience: "agency:" + p.agencyId, adminId: null, adminName,
    });
    return true;
  },
  async rejectPropertyDeletion(id, adminName) {
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === id);
    if (!p) return null;
    delete p.deletionStatus; delete p.deletionReason; delete p.deletionRequestedAt; delete p.deletionRequestedBy;
    tiSave("ti_properties", all);
    await this.broadcastNotification({
      title: "Demande de suppression refusée",
      message: `La suppression de l'annonce « ${p.title} » a été refusée par l'administration ; elle reste active.`,
      audience: "agency:" + p.agencyId, adminId: null, adminName,
    });
    return true;
  },
  async requestAgentDeletion(id, reason, requestedByName) {
    const users = tiLoad("ti_users", []);
    const u = users.find(u => u.id === id);
    if (!u) return null;
    u.deletionStatus = "pending";
    u.deletionReason = reason;
    u.deletionRequestedAt = new Date().toISOString();
    u.deletionRequestedBy = requestedByName;
    tiSave("ti_users", users);
    return u;
  },
  async cancelAgentDeletion(id) {
    const users = tiLoad("ti_users", []);
    const u = users.find(u => u.id === id);
    if (u) { delete u.deletionStatus; delete u.deletionReason; delete u.deletionRequestedAt; delete u.deletionRequestedBy; tiSave("ti_users", users); }
    return u;
  },
  async getPendingAgentDeletions() {
    return tiLoad("ti_users", []).filter(u => u.deletionStatus === "pending");
  },
  async approveAgentDeletion(id, adminName) {
    const users = tiLoad("ti_users", []);
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
    const users = tiLoad("ti_users", []);
    const u = users.find(u => u.id === id);
    if (!u) return null;
    delete u.deletionStatus; delete u.deletionReason; delete u.deletionRequestedAt; delete u.deletionRequestedBy;
    tiSave("ti_users", users);
    await this.broadcastNotification({
      title: "Demande de suppression de compte refusée",
      message: `La suppression du compte de ${u.name} a été refusée par l'administration ; le compte reste actif.`,
      audience: "agency:" + u.agencyId, adminId: null, adminName,
    });
    return true;
  },

  async deleteProperty(id) {
    if (TI_BACKEND === "api") return fetch(`${TI_API_BASE}/properties/${id}`, { method: "DELETE" });
    if (TI_BACKEND === "firebase") return tiFirestoreDelete("properties", id);
    tiSave("ti_properties", tiLoad("ti_properties", TI_PROPERTIES).filter(p => p.id !== id));
  },
  async recordView(id) {
    if (TI_BACKEND === "api") return fetch(`${TI_API_BASE}/properties/${id}/view`, { method: "POST" });
    if (TI_BACKEND === "firebase") return; // best-effort only in the local demo backend
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === id);
    if (p) { p.views = (p.views || 0) + 1; tiSave("ti_properties", all); }
    return p;
  },
  async setListingStatus(id, status) {
    if (TI_BACKEND === "api") return (await fetch(`${TI_API_BASE}/properties/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })).json();
    if (TI_BACKEND === "firebase") return tiFirestoreAdd("properties", { id, listingStatus: status });
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === id);
    if (p) { p.listingStatus = status; tiSave("ti_properties", all); }
    if (p && ["under_contract", "sold", "rented"].includes(status)) await this.notifyFavoritesOfStatusChange(p);
    return p;
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
    if (TI_BACKEND === "api") return (await fetch(`${TI_API_BASE}/agencies`)).json();
    if (TI_BACKEND === "firebase") return tiFirestoreGetAll("agencies");
    return tiLoad("ti_agencies", TI_AGENCIES);
  },
  async getAgency(id) {
    return (await this.getAgencies()).find(a => a.id === id);
  },
  async getAgencyBySlug(slug) {
    const all = tiLoad("ti_agencies", TI_AGENCIES);
    return all.find(a => a.subsiteSlug === slug && a.subsiteEnabled) || null;
  },
  async toggleAgencySubsite(agencyId) {
    const all = tiLoad("ti_agencies", TI_AGENCIES);
    const agency = all.find(a => a.id === agencyId);
    if (!agency) return null;
    agency.subsiteEnabled = !agency.subsiteEnabled;
    if (agency.subsiteEnabled && !agency.subsiteSlug) {
      agency.subsiteSlug = tiSlugify(agency.name) + "-" + agencyId.slice(-4);
    }
    tiSave("ti_agencies", all);
    return agency;
  },
  async updateAgencyLogo(agencyId, dataUrl) {
    const all = tiLoad("ti_agencies", TI_AGENCIES);
    const agency = all.find(a => a.id === agencyId);
    if (!agency) return null;
    agency.logoDataUrl = dataUrl;
    tiSave("ti_agencies", all);
    return agency;
  },
  async getWelcomeKit(agencyId) {
    const all = tiLoad("ti_agencies", TI_AGENCIES);
    const agency = all.find(a => a.id === agencyId);
    if (!agency) return [];
    if (!agency.welcomeKit) { agency.welcomeKit = tiDefaultWelcomeKit(); tiSave("ti_agencies", all); }
    return agency.welcomeKit;
  },
  async saveWelcomeKitItem(agencyId, item) {
    const all = tiLoad("ti_agencies", TI_AGENCIES);
    const agency = all.find(a => a.id === agencyId);
    if (!agency) return null;
    if (!agency.welcomeKit) agency.welcomeKit = tiDefaultWelcomeKit();
    if (item.id) {
      const idx = agency.welcomeKit.findIndex(d => d.id === item.id);
      if (idx !== -1) agency.welcomeKit[idx] = item;
    } else {
      item.id = "wk_" + Date.now();
      item.enabled = true;
      agency.welcomeKit.push(item);
    }
    tiSave("ti_agencies", all);
    return agency.welcomeKit;
  },
  async deleteWelcomeKitItem(agencyId, itemId) {
    const all = tiLoad("ti_agencies", TI_AGENCIES);
    const agency = all.find(a => a.id === agencyId);
    if (!agency || !agency.welcomeKit) return null;
    agency.welcomeKit = agency.welcomeKit.filter(d => d.id !== itemId);
    tiSave("ti_agencies", all);
    return agency.welcomeKit;
  },
  async toggleWelcomeKitItem(agencyId, itemId) {
    const all = tiLoad("ti_agencies", TI_AGENCIES);
    const agency = all.find(a => a.id === agencyId);
    if (!agency || !agency.welcomeKit) return null;
    const item = agency.welcomeKit.find(d => d.id === itemId);
    if (item) item.enabled = !item.enabled;
    tiSave("ti_agencies", all);
    return agency.welcomeKit;
  },
  async saveAgency(agency) {
    let saved;
    if (TI_BACKEND === "api") {
      saved = await (await fetch(`${TI_API_BASE}/agencies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(agency) })).json();
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
    if (TI_BACKEND === "api") { await fetch(`${TI_API_BASE}/agencies/${id}`, { method: "DELETE" }); }
    else if (TI_BACKEND === "firebase") { await tiFirestoreDelete("agencies", id); }
    else { tiSave("ti_agencies", tiLoad("ti_agencies", TI_AGENCIES).filter(a => a.id !== id)); }
    tiSyncAgenciesFromStorage();
    if (cascade) {
      const props = await this.getProperties();
      for (const p of props.filter(p => p.agencyId === id)) await this.deleteProperty(p.id);
    }
  },

  async getUsers() { return tiLoad("ti_users", []); },
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
    const users = tiLoad("ti_users", []);
    const u = users.find(u => u.id === id);
    if (!u) return null;
    Object.assign(u, patch);
    tiSave("ti_users", users);
    return u;
  },

  async getAgents(agencyId) {
    const users = await this.getUsers();
    return users.filter(u => u.role === "agency" && u.agencyId === agencyId && u.agentRole === "agent");
  },
  async setUserStatus(id, status) {
    const users = tiLoad("ti_users", []);
    const u = users.find(u => u.id === id);
    if (u) u.status = status;
    tiSave("ti_users", users);
    return u;
  },
  async recordLogin(id) {
    const users = tiLoad("ti_users", []);
    const u = users.find(u => u.id === id);
    if (u) u.lastLoginAt = new Date().toISOString();
    tiSave("ti_users", users);
  },
  async regenerateTempPassword(id) {
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
    const existing = await this.findUserByEmail(email);
    if (existing) return { ok: false, error: "exists" };
    const agent = { id: "u_" + Date.now(), role: "agency", agentRole: "agent", name, email, agencyId, createdAt: new Date().toISOString() };
    await tiSetUserPassword(agent, password);
    await this.createUser(agent);
    return { ok: true, agent };
  },
  async createAgencySupervisor({ name, email, phone, password, agencyId }) {
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
    const users = tiLoad("ti_users", []);
    tiSave("ti_users", users.filter(u => u.id !== id));
    // unassign any properties that were this agent's responsibility
    const props = tiLoad("ti_properties", TI_PROPERTIES);
    let changed = false;
    props.forEach(p => { if (p.assignedAgentId === id) { p.assignedAgentId = null; changed = true; } });
    if (changed) tiSave("ti_properties", props);
  },
  async assignProperty(propertyId, agentId) {
    const all = tiLoad("ti_properties", TI_PROPERTIES);
    const p = all.find(p => p.id === propertyId);
    if (p) { p.assignedAgentId = agentId || null; tiSave("ti_properties", all); }
    return p;
  },

  async getBookings(filter = {}) {
    let all = tiLoad("ti_bookings", []);
    if (filter.userId) all = all.filter(b => b.userId === filter.userId);
    if (filter.agencyId) all = all.filter(b => b.agencyId === filter.agencyId);
    if (filter.propertyId) all = all.filter(b => b.propertyId === filter.propertyId);
    return all;
  },
  async createBooking(booking) {
    const all = tiLoad("ti_bookings", []);
    booking.id = "bk_" + Date.now();
    booking.status = "pending";
    booking.createdAt = new Date().toISOString();
    all.unshift(booking);
    tiSave("ti_bookings", all);
    return booking;
  },
  async updateBookingStatus(id, status) {
    const all = tiLoad("ti_bookings", []);
    const b = all.find(b => b.id === id);
    if (b) b.status = status;
    tiSave("ti_bookings", all);
    if (status === "confirmed") {
      if (b && !b.dossierStatus) await this.requestDocuments(id, TI_DEFAULT_SCREENING_DOCS);
      await this.maybeSendWelcome(id);
    }
    return b;
  },
  async updateBooking(id, patch) {
    const all = tiLoad("ti_bookings", []);
    const b = all.find(b => b.id === id);
    if (b) Object.assign(b, patch);
    tiSave("ti_bookings", all);
    return b;
  },

  /* ---- Dossier workflow: agency requests documents, client submits, agency reviews ---- */
  async requestDocuments(bookingId, docs) {
    // docs: [{ key, label, labelEn }]
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
    const all = tiLoad("ti_bookings", []);
    const b = all.find(b => b.id === bookingId);
    if (!b) return null;
    b.contracts = b.contracts || [];
    b.contracts.push({ id: "ctr_" + Date.now(), fileName, fileData: fileData || null, sentAt: new Date().toISOString() });
    try {
      tiSave("ti_bookings", all);
    } catch (err) {
      // Storage quota exceeded — keep the metadata (filename/date), drop the preview data.
      b.contracts[b.contracts.length - 1].fileData = null;
      tiSave("ti_bookings", all);
      return { ...b, _storageFallback: true };
    }
    return b;
  },
  async signContract(bookingId, contractId) {
    const all = tiLoad("ti_bookings", []);
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.contracts) return null;
    const ctr = b.contracts.find(c => c.id === contractId);
    if (ctr) { ctr.signed = true; ctr.signedAt = new Date().toISOString(); }
    tiSave("ti_bookings", all);
    await this.maybeSendWelcome(bookingId);
    return b;
  },
  async submitDocument(bookingId, docKey, fileName, fileData) {
    const all = tiLoad("ti_bookings", []);
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.documentRequests) return null;
    const doc = b.documentRequests.find(d => d.key === docKey);
    if (doc) { doc.status = "submitted"; doc.fileName = fileName; doc.fileData = fileData || null; doc.submittedAt = new Date().toISOString(); doc.note = null; }
    const allSubmitted = b.documentRequests.every(d => d.status === "submitted" || d.status === "approved");
    if (allSubmitted) b.dossierStatus = "under_review";
    b.dossierUpdatedAt = new Date().toISOString();
    try {
      tiSave("ti_bookings", all);
    } catch (err) {
      // Storage quota exceeded (large file as base64) — keep the metadata, drop the preview data.
      if (doc) doc.fileData = null;
      tiSave("ti_bookings", all);
      return { ...b, _storageFallback: true };
    }
    return b;
  },
  async reviewDocument(bookingId, docKey, status, note) {
    // status: "approved" | "rejected"
    const all = tiLoad("ti_bookings", []);
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
      tiSave("ti_bookings", all);
      await this.sendMessage({
        propertyId: b.propertyId, propertyTitle: b.propertyTitle, agencyId: b.agencyId,
        userId: b.userId, userName: b.name, from: "agency",
        text: `Un document de votre dossier nécessite une correction${note ? ` : ${note}` : ""}. Merci de le renvoyer avant le ${new Date(b.dossierDueAt).toLocaleDateString("fr-FR")} — rendez-vous dans "Mes réservations".`,
      });
    } else {
      tiSave("ti_bookings", all);
    }
    await this.maybeSendWelcome(bookingId);
    return b;
  },

  /* ---- Rental ledger: deposit, monthly rent schedule, utility charges ----
     Generated once a monthly-rental booking is confirmed. Charges (water,
     electricity, internet...) start disabled — the agency turns on the ones
     that apply to this lease and sets their monthly amount. */
  async ensureRentalLedger(bookingId) {
    const all = tiLoad("ti_bookings", []);
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
    tiSave("ti_bookings", all);
    return b;
  },
  async setRentalCharges(bookingId, charges) {
    const all = tiLoad("ti_bookings", []);
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.rental) return null;
    b.rental.charges = charges;
    const chargesTotal = charges.filter(c => c.enabled).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    b.rental.schedule.forEach(item => {
      if (item.status !== "paid") item.chargesAmount = chargesTotal;
    });
    tiSave("ti_bookings", all);
    return b;
  },
  async payRentalDeposit(bookingId, method) {
    const all = tiLoad("ti_bookings", []);
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.rental) return null;
    b.rental.deposit.status = "paid";
    b.rental.deposit.paidAt = new Date().toISOString();
    b.rental.deposit.method = method;
    tiSave("ti_bookings", all);
    return b;
  },
  async payRentalScheduleItem(bookingId, scheduleId, method) {
    const all = tiLoad("ti_bookings", []);
    const b = all.find(b => b.id === bookingId);
    if (!b || !b.rental) return null;
    const item = b.rental.schedule.find(s => s.id === scheduleId);
    if (item) { item.status = "paid"; item.paidAt = new Date().toISOString(); item.method = method; }
    tiSave("ti_bookings", all);
    return b;
  },

  async getMessages(filter = {}) {
    let all = tiLoad("ti_messages", []);
    if (filter.propertyId) all = all.filter(m => m.propertyId === filter.propertyId);
    if (filter.userId) all = all.filter(m => m.userId === filter.userId);
    if (filter.agencyId) all = all.filter(m => m.agencyId === filter.agencyId);
    return all;
  },
  async sendMessage(msg) {
    const all = tiLoad("ti_messages", []);
    msg.id = "msg_" + Date.now();
    msg.createdAt = new Date().toISOString();
    all.push(msg);
    tiSave("ti_messages", all);
    return msg;
  },
  async maybeSendWelcome(bookingId) {
    const all = tiLoad("ti_bookings", []);
    const b = all.find(b => b.id === bookingId);
    if (!b || b.welcomed) return;
    if (tiComputeBookingStage(b) !== "active") return;
    b.welcomed = true;

    // The client is now fully onboarded — the property is no longer
    // available. Reflect that automatically instead of relying on the
    // agency to remember a manual "mark as sold/rented" click; this also
    // triggers the existing favorited-listing notification. Short-stay
    // properties stay bookable by future guests, so they're excluded.
    const property = await this.getProperty(b.propertyId);
    if (property && !property.shortStay) {
      await this.setListingStatus(b.propertyId, property.forSale ? "sold" : "rented");
    }
    const agency = await this.getAgency(b.agencyId);
    const agencyName = agency ? agency.name : "";

    // Snapshot the agency's currently-enabled welcome-kit documents onto
    // this booking's dossier, with merge variables substituted for this
    // specific tenant — later edits to the agency's kit template won't
    // retroactively change documents already issued to this tenant.
    const kit = await this.getWelcomeKit(b.agencyId);
    const mergeVars = { client_name: (b.name || "").split(" ")[0], property_title: b.propertyTitle, agency_name: agencyName };
    b.documents = kit.filter(d => d.enabled).map(d => ({
      id: "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      title: d.title, titleEn: d.titleEn,
      content: tiSubstituteVars(d.content, mergeVars), contentEn: tiSubstituteVars(d.contentEn, mergeVars),
      createdAt: new Date().toISOString(),
    }));
    tiSave("ti_bookings", all);
    await this.sendMessage({
      propertyId: b.propertyId, propertyTitle: b.propertyTitle, agencyId: b.agencyId,
      userId: b.userId, userName: b.name, from: "agency",
      text: `Bienvenue chez ${agencyName} ! Votre dossier a été validé et votre installation est confirmée. Retrouvez votre kit de bienvenue dans "Mes documents".`,
    });
  },

  async getAnnouncements({ agencyId, userId } = {}) {
    let list = tiLoad("ti_announcements", []);
    if (agencyId) list = list.filter(a => a.agencyId === agencyId);
    if (userId) {
      const bookings = tiLoad("ti_bookings", []).filter(b => b.userId === userId && b.status === "confirmed");
      const myAgencyIds = new Set(bookings.map(b => b.agencyId));
      const myPropertyIds = new Set(bookings.map(b => b.propertyId));
      list = list.filter(a => myAgencyIds.has(a.agencyId) && (!a.propertyId || myPropertyIds.has(a.propertyId)));
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  async createAnnouncement({ agencyId, propertyId, title, text }) {
    const all = tiLoad("ti_announcements", []);
    const announcement = { id: "an_" + Date.now(), agencyId, propertyId: propertyId || null, title, text, createdAt: new Date().toISOString() };
    all.push(announcement);
    tiSave("ti_announcements", all);
    return announcement;
  },
  async deleteAnnouncement(id) {
    const all = tiLoad("ti_announcements", []);
    tiSave("ti_announcements", all.filter(a => a.id !== id));
  },

  async getReviews(propertyId) {
    return tiLoad("ti_reviews", []).filter(r => r.propertyId === propertyId);
  },
  async addReview(review) {
    const all = tiLoad("ti_reviews", []);
    review.id = "rv_" + Date.now();
    review.createdAt = new Date().toISOString();
    review.approved = true;
    all.unshift(review);
    tiSave("ti_reviews", all);
    return review;
  },
  async getAllReviews() { return tiLoad("ti_reviews", []); },
  async moderateReview(id, approved) {
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
    // Cap the log so localStorage doesn't grow unbounded in this client-side demo.
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
    // Generate a realistic invoice history on first access (deterministic per
    // agency, persisted afterward so it stays stable across reloads).
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
    const all = tiLoad("ti_payments", []);
    payment.id = "pay_" + Date.now();
    payment.createdAt = new Date().toISOString();
    all.unshift(payment);
    tiSave("ti_payments", all);
    return payment;
  },

  async getFavorites(userId) {
    return tiLoad("ti_favorites", []).filter(f => f.userId === userId);
  },
  async toggleFavorite(userId, propertyId) {
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
    if (TI_BACKEND === "api") return (await fetch(`${TI_API_BASE}/newsletter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })).json();
    if (TI_BACKEND === "firebase") return tiFirestoreAdd("newsletter", { email, createdAt: new Date().toISOString() });
    const all = tiLoad("ti_newsletter", []);
    if (!all.includes(email)) all.push(email);
    tiSave("ti_newsletter", all);
    return { ok: true };
  },
};
