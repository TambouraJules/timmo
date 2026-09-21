/* ============================================================
   Timmo — tableau de bord administrateur
   ============================================================ */

const TI_SESSION = tiRequireRole("admin");

function tiShowPanel(name) {
  document.querySelectorAll(".ti-dash-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".ti-dash-nav a").forEach(a => a.classList.remove("active"));
  const panel = document.getElementById("panel-" + name);
  if (panel) panel.classList.add("active");
  const navLink = document.querySelector(`.ti-dash-nav a[data-panel="${name}"]`);
  if (navLink) navLink.classList.add("active");
  const url = new URL(window.location.href);
  url.searchParams.set("panel", name);
  history.replaceState(null, "", url);
}

/** Rafraîchit uniquement les données/le balisage dont un panneau donné a
 *  besoin, sur place — pas de navigation, pas de flash blanc, pas de perte
 *  de position de défilement. Remplace l'ancien mécanisme
 *  tiReloadDashboard() qui rechargeait toute la page. */
async function tiRefreshPanel(panelName) {
  const tasksByPanel = {
    overview: tiRenderOverview,
    users: tiRenderUsers,
    agencies: tiRenderAgencies,
    listings: tiRenderAdminListings,
    amenities: tiRenderAmenityCatalog,
    payments: async () => { await Promise.all([tiRenderAdminPayments(), tiRenderDepositDisputes()]); },
    moderation: tiRenderModeration,
    deletions: tiRenderDeletionRequests,
    audit: tiRenderAdminAudit,
    broadcasts: tiRenderBroadcastLog,
    favorites: tiRenderFavorites,
  };
  const fn = tasksByPanel[panelName];
  if (fn) await fn();
}

const TI_TREND_PERIODS = {
  "7d": { key: "7d", labelKey: "period_week", count: 7, unit: "day" },
  "30d": { key: "30d", labelKey: "period_month", count: 30, unit: "day" },
  "6m": { key: "6m", labelKey: "period_semester", count: 6, unit: "month" },
  "12m": { key: "12m", labelKey: "period_year", count: 12, unit: "month" },
};
let TI_PLATFORM_TOTAL_VIEWS = 0;
let TI_PLATFORM_TREND_PERIOD = "7d";

function tiRenderPlatformTrendChart() {
  const cfg = TI_TREND_PERIODS[TI_PLATFORM_TREND_PERIOD];
  document.getElementById("platform-trend-title").textContent = `${t('chart_platform_views_trend_title')} — ${t(cfg.labelKey)}`;
  document.getElementById("platform-period-tabs").innerHTML = Object.values(TI_TREND_PERIODS).map(p => `
    <button class="ti-period-tab ${p.key === TI_PLATFORM_TREND_PERIOD ? 'active' : ''}" onclick="tiSwitchPlatformTrendPeriod('${p.key}')">${t(p.labelKey)}</button>`).join("");

  const labels = Array.from({ length: cfg.count }, (_, i) => {
    const d = new Date();
    if (cfg.unit === "day") d.setDate(d.getDate() - (cfg.count - 1 - i));
    else d.setMonth(d.getMonth() - (cfg.count - 1 - i));
    return d.toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", cfg.unit === "day" ? { day: "2-digit", month: "2-digit" } : { month: "short" });
  });
  const seedBase = "platform-" + TI_PLATFORM_TREND_PERIOD;
  const current = tiSyntheticDailySeries(TI_PLATFORM_TOTAL_VIEWS, cfg.count, seedBase);
  const prevRatioPct = tiSeededDeltaPct(seedBase + "prevratio", 22);
  const prevTotal = Math.max(Math.round(TI_PLATFORM_TOTAL_VIEWS * (1 - prevRatioPct / 100)), 0);
  const previous = tiSyntheticDailySeries(prevTotal, cfg.count, seedBase + "prev");

  document.getElementById("platform-trend-chart-mount").innerHTML = tiLineChartSvg(labels, current, v => v, previous);
}
function tiSwitchPlatformTrendPeriod(period) {
  TI_PLATFORM_TREND_PERIOD = period;
  tiRenderPlatformTrendChart();
}

/* Évolution réelle et cumulée des inscriptions d'agences — basée sur les vraies dates subscribedSince. */
let TI_AGENCIES_FOR_TREND = [];
let TI_AGENCIES_TREND_PERIOD = "6m";
function tiRenderAgenciesTrendChart() {
  const cfg = TI_TREND_PERIODS[TI_AGENCIES_TREND_PERIOD];
  document.getElementById("agencies-trend-title").textContent = `${t('chart_agencies_trend_title')} — ${t(cfg.labelKey)}`;
  document.getElementById("agencies-period-tabs").innerHTML = Object.values(TI_TREND_PERIODS).map(p => `
    <button class="ti-period-tab ${p.key === TI_AGENCIES_TREND_PERIOD ? 'active' : ''}" onclick="tiSwitchAgenciesTrendPeriod('${p.key}')">${t(p.labelKey)}</button>`).join("");

  const signupDates = TI_AGENCIES_FOR_TREND.map(a => a.subscribedSince ? new Date(a.subscribedSince) : null).filter(Boolean);
  const labels = [];
  const current = [];
  for (let i = 0; i < cfg.count; i++) {
    const d = new Date();
    if (cfg.unit === "day") d.setDate(d.getDate() - (cfg.count - 1 - i));
    else d.setMonth(d.getMonth() - (cfg.count - 1 - i));
    labels.push(d.toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", cfg.unit === "day" ? { day: "2-digit", month: "2-digit" } : { month: "short" }));
    current.push(signupDates.filter(dt => dt <= d).length);
  }
  document.getElementById("agencies-trend-chart-mount").innerHTML = tiLineChartSvg(labels, current, v => v);
}
function tiSwitchAgenciesTrendPeriod(period) {
  TI_AGENCIES_TREND_PERIOD = period;
  tiRenderAgenciesTrendChart();
}

/* Biens par localité — basé sur les vraies données de quartier/commune. */
function tiRenderLocalitiesChart(props) {
  const counts = {};
  props.forEach(p => { if (p.neighborhood) counts[p.neighborhood] = (counts[p.neighborhood] || 0) + 1; });
  const items = Object.entries(counts)
    .map(([id, value]) => ({ label: tiNeighborhoodName(id), value, color: "var(--clay)" }))
    .sort((a, b) => b.value - a.value);
  document.getElementById("localities-chart-mount").innerHTML = tiBarChartHtml(t("chart_localities_title"), items);
}

async function tiRenderOverview() {
  const users = await TiDB.getUsers();
  const props = await TiDB.getProperties();
  const agencies = await TiDB.getAgencies();
  const bookings = await TiDB.getBookings();
  const pendingListingsCount = props.filter(p => p.listingStatus === "pending").length;
  const totalViews = props.reduce((s, p) => s + (p.views || 0), 0);
  TI_PLATFORM_TOTAL_VIEWS = totalViews;
  document.getElementById("overview-mount").innerHTML = `
    <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.user}</span><b>${users.length}</b>${tiTrendBadgeHtml(tiSeededDeltaPct('platform-users', 15))}<span data-i18n="dash_admin_users">${t('dash_admin_users')}</span></div>
    <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.grid}</span><b>${agencies.length}</b>${tiTrendBadgeHtml(tiSeededDeltaPct('platform-agencies', 10))}<span data-i18n="dash_admin_agencies">${t('dash_admin_agencies')}</span></div>
    <div class="ti-stat-card ti-stat-card-featured"><span class="ti-stat-icon">${TI_ICONS.home}</span><b>${props.length}</b>${tiTrendBadgeHtml(tiSeededDeltaPct('platform-listings', 18))}<span data-i18n="dash_admin_listings">${t('dash_admin_listings')}</span></div>
    <div class="ti-stat-card ti-stat-card-alert" onclick="tiShowPanel('listings');document.getElementById('al-status').value='pending';tiApplyAdminListingsFilter();" style="cursor:pointer;">
      <span class="ti-stat-icon">${TI_ICONS.document}</span><b>${pendingListingsCount}</b><span>${t('stat_pending_validation')}</span>
    </div>
  `;
  tiRenderPlatformTrendChart();
  TI_AGENCIES_FOR_TREND = agencies;
  tiRenderAgenciesTrendChart();
  tiRenderLocalitiesChart(props);

  const byType = {
    apartment: props.filter(p => p.type === "apartment").length,
    house: props.filter(p => p.type === "house").length,
    office: props.filter(p => p.type === "office").length,
  };
  const byStatus = {
    pending: bookings.filter(b => b.status === "pending").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
  };
  document.getElementById("overview-charts-mount").innerHTML =
    tiPieChartHtml(t("chart_by_type"), [
      { label: t("type_apartment"), value: byType.apartment, color: "var(--clay)" },
      { label: t("type_house"), value: byType.house, color: "var(--deep)" },
      { label: t("type_office"), value: byType.office, color: "var(--gold)" },
    ]) +
    tiPieChartHtml(t("chart_by_status"), [
      { label: t("status_pending"), value: byStatus.pending, color: "var(--gold)" },
      { label: t("status_confirmed"), value: byStatus.confirmed, color: "var(--ok)" },
      { label: t("status_cancelled"), value: byStatus.cancelled, color: "var(--danger)" },
    ]);
}

let TI_ADMIN_ALL_USERS = [];
function tiRenderUsersFilterBar() {
  const mount = document.getElementById("users-filters");
  mount.innerHTML = `
    <div class="ti-admin-filter-bar">
      <div class="ti-filter-search">
        <span class="ti-filter-search-icon">${TI_ICONS.search}</span>
        <input type="text" id="us-search" placeholder="${t('filter_search_users')}">
      </div>
      <select id="us-role-filter">
        <option value="">${t('all_roles')}</option>
        <option value="client">${t('role_client')}</option>
        <option value="agent">${t('role_agent')}</option>
        <option value="supervisor">${t('role_supervisor')}</option>
        <option value="admin">${t('role_admin_label')}</option>
      </select>
      <button class="ti-filter-reset" onclick="document.getElementById('us-search').value='';document.getElementById('us-role-filter').value='';tiApplyUsersFilter();">${t('filter_reset')}</button>
    </div>`;
  document.getElementById("us-search").addEventListener("input", tiApplyUsersFilter);
  document.getElementById("us-role-filter").addEventListener("change", tiApplyUsersFilter);
}
function tiUserRoleKey(u) {
  if (u.role === "admin") return "admin";
  if (u.role === "agency") return u.agentRole === "supervisor" ? "supervisor" : "agent";
  return "client";
}
function tiUserRoleBadgeLabel(u) {
  const key = tiUserRoleKey(u);
  if (key === "admin") return t("role_admin_label");
  if (key === "supervisor") return t("role_supervisor");
  if (key === "agent") return t("role_agent");
  return t("role_client");
}
async function tiApplyUsersFilter() {
  const q = document.getElementById("us-search").value.trim().toLowerCase();
  const roleFilter = document.getElementById("us-role-filter").value;
  let list = TI_ADMIN_ALL_USERS;
  if (q) list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  if (roleFilter) list = list.filter(u => tiUserRoleKey(u) === roleFilter);

  const agencies = await TiDB.getAgencies();
  const agencyName = id => agencies.find(a => a.id === id)?.name || "—";

  document.getElementById("users-mount").innerHTML = list.length ? list.map(u => {
    const roleKey = tiUserRoleKey(u);
    const isAgencyStaff = roleKey === "agent" || roleKey === "supervisor";
    const canModerate = roleKey !== "admin";
    const frozen = u.status === "suspended";
    return `
    <div class="ti-list-row ${frozen ? 'ti-row-frozen' : ''}">
      <span class="ti-agency-avatar">${tiEscapeHtml(u.name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</span>
      <div class="ti-list-row-body">
        <strong>${tiEscapeHtml(u.name)}</strong>
        <span class="badge ${roleKey === 'admin' ? 'badge-confirmed' : roleKey === 'supervisor' ? 'badge-paid' : roleKey === 'agent' ? 'badge-pending' : 'badge-review'}" style="margin-left:6px;">${tiUserRoleBadgeLabel(u)}</span>
        ${canModerate ? `<span class="badge ${frozen ? 'badge-cancelled' : 'badge-confirmed'}" style="margin-left:4px;">${frozen ? t('status_frozen') : t('status_active')}</span>` : ''}
        <br>
        <span style="color:var(--ink-soft);font-size:.85rem;">${tiEscapeHtml(u.email)}${isAgencyStaff ? ' · ' + tiEscapeHtml(agencyName(u.agencyId)) : ''}</span>
      </div>
      ${canModerate ? `
      <div class="ti-list-row-actions">
        ${tiRowMenuHtml(`
          <button type="button" onclick="tiAdminToggleAgentFrozen('${u.id}')">${frozen ? TI_ICONS.check : TI_ICONS.alertTriangle} ${frozen ? t('action_reactivate') : t('action_freeze')}</button>
          ${roleKey === 'agent' ? `<div class="ti-row-menu-divider"></div><button type="button" class="ti-row-menu-danger" onclick="tiAdminDeleteAgentUser('${u.id}')">${TI_ICONS.trash} ${t('action_delete')}</button>` : ''}
        `)}
      </div>` : ''}
    </div>`;
  }).join('') : `<p style="color:var(--ink-soft)">${t('filter_no_results')}</p>`;
}
async function tiAdminToggleAgentFrozen(id) {
  const user = TI_ADMIN_ALL_USERS.find(u => u.id === id);
  if (!user) return;
  const nowFrozen = user.status !== "suspended";
  await TiDB.setUserStatus(id, nowFrozen ? "suspended" : "active");
  tiToast((nowFrozen ? t("action_freeze") : t("action_reactivate")) + " ✓");
  tiLogAdminAction(nowFrozen ? "user_frozen" : "user_reactivated", tiUserRoleKey(user), id, user.name, "", user.agencyId);
  await tiRefreshPanel("users");
}
async function tiAdminDeleteAgentUser(id) {
  const user = TI_ADMIN_ALL_USERS.find(u => u.id === id);
  if (!confirm(t("confirm_delete_agent"))) return;
  await TiDB.deleteAgent(id);
  tiToast(t("agent_removed") + " ✓");
  tiLogAdminAction("agent_removed", "agent", id, user ? user.name : id, "", user ? user.agencyId : null);
  await tiRefreshPanel("users");
}
async function tiRenderUsers() {
  TI_ADMIN_ALL_USERS = await TiDB.getUsers();
  tiRenderUsersFilterBar();
  tiApplyUsersFilter();
}

/* ---------- Agences : CRUD complet côté admin ---------- */
let TI_ADMIN_ALL_AGENCIES = [];
let TI_ADMIN_ALL_AGENCY_PROPS = [];
function tiRenderAgenciesFilterBar() {
  const mount = document.getElementById("agencies-filters");
  mount.innerHTML = `
    <div class="ti-admin-filter-bar">
      <div class="ti-filter-search">
        <span class="ti-filter-search-icon">${TI_ICONS.search}</span>
        <input type="text" id="ag-search" placeholder="${t('filter_search_agencies')}">
      </div>
      <button class="ti-filter-reset" onclick="document.getElementById('ag-search').value='';tiApplyAgenciesFilter();">${t('filter_reset')}</button>
    </div>`;
  document.getElementById("ag-search").addEventListener("input", tiApplyAgenciesFilter);
}
function tiApplyAgenciesFilter() {
  const q = document.getElementById("ag-search").value.trim().toLowerCase();
  const agencies = q ? TI_ADMIN_ALL_AGENCIES.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) : TI_ADMIN_ALL_AGENCIES;
  const props = TI_ADMIN_ALL_AGENCY_PROPS;
  const mount = document.getElementById("agencies-mount");
  mount.innerHTML = agencies.length ? agencies.map(a => {
    const listingCount = props.filter(p => p.agencyId === a.id).length;
    const suspended = a.status === "suspended";
    const tier = TI_AGENCY_TIERS.find(t2 => t2.id === a.tier);
    return `
    <div class="ti-list-row" style="flex-wrap:wrap;">
      <div class="ti-agency-avatar" style="flex-shrink:0;cursor:pointer;" onclick="tiOpenAgencyDetail('${a.id}')">${a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
      <div class="ti-list-row-body" style="cursor:pointer;" onclick="tiOpenAgencyDetail('${a.id}')">
        <strong>${tiEscapeHtml(a.name)}</strong>
        <span class="badge ${a.verified ? 'badge-confirmed' : 'badge-pending'}" style="margin-left:8px;">${a.verified ? '✓ ' + t('verified_label') : t('status_pending')}</span>
        <span class="badge ${suspended ? 'badge-cancelled' : 'badge-confirmed'}" style="margin-left:4px;">${suspended ? t('status_suspended') : t('status_active')}</span>
        ${tier ? `<span class="badge badge-paid" style="margin-left:4px;">${tiGetLang() === 'en' ? tier.labelEn : tier.label}</span>` : ''}
        <br>
        <span style="color:var(--ink-soft);font-size:.85rem;">${tiEscapeHtml(a.email)} · ${tiEscapeHtml(a.phone || '—')} · ${listingCount}${a.maxListings ? '/' + a.maxListings : ''} ${t('listings_count_label')}</span>
      </div>
      <div class="ti-list-row-actions">
        <button class="btn btn-outline btn-sm" onclick="tiOpenAgencyDetail('${a.id}')">${t('view_details')}</button>
        ${tiRowMenuHtml(`
          <button type="button" onclick="tiToggleAgencyVerified('${a.id}')">${TI_ICONS.check} ${a.verified ? t('action_unverify') : t('action_verify')}</button>
          <button type="button" onclick="tiToggleAgencySuspended('${a.id}')">${TI_ICONS.alertTriangle} ${suspended ? t('action_activate') : t('action_suspend')}</button>
          <button type="button" onclick="tiOpenAgencyModal('${a.id}')">${TI_ICONS.editPencil} ${t('action_edit')}</button>
          <div class="ti-row-menu-divider"></div>
          <button type="button" class="ti-row-menu-danger" onclick="tiDeleteAgency('${a.id}')">${TI_ICONS.trash} ${t('action_delete')}</button>
        `)}
      </div>
    </div>`;
  }).join('') : `<p style="color:var(--ink-soft)">${t('filter_no_results')}</p>`;
}
/* ---------- Sous-tableau de bord détail agence ---------- */
let TI_AGENCY_DETAIL_ID = null;
let TI_AGENCY_DETAIL_AGENTS = [];

/* ---------- Gestion du sous-site agence (marque blanche) ---------- */
function tiSubsiteDetailsHtml(agency) {
  if (!agency.subsiteEnabled) {
    return `<p style="color:var(--ink-soft);font-size:.85rem;margin-top:14px;">${t('subsite_disabled_note')}</p>`;
  }
  const url = window.location.origin + "/listings.html?agency=" + agency.subsiteSlug;
  return `
    <div class="ti-subsite-details">
      <div>
        <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:6px;">${t('subsite_url_label')}</label>
        <div class="ti-subsite-url-row">
          <input type="text" readonly value="${url}" id="subsite-url-input">
          <button type="button" class="btn btn-outline btn-sm" onclick="tiCopySubsiteLink()">${t('subsite_copy_link')}</button>
          <a class="btn btn-outline btn-sm" href="${url}" target="_blank" rel="noopener">${t('subsite_open_link')}</a>
        </div>
        <label style="font-size:.8rem;font-weight:700;display:block;margin:16px 0 6px;">${t('subsite_logo_label')}</label>
        <div style="display:flex;align-items:center;gap:12px;">
          ${agency.logoDataUrl
            ? `<img src="${agency.logoDataUrl}" class="ti-subsite-logo-preview" alt="">`
            : `<div class="ti-subsite-logo-preview" style="display:flex;align-items:center;justify-content:center;color:var(--ink-soft);font-size:.7rem;">—</div>`}
          <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('subsite-logo-input').click()">${t('subsite_upload_logo')}</button>
          <input type="file" id="subsite-logo-input" accept="image/*" style="display:none;" onchange="tiHandleSubsiteLogoUpload(this,'${agency.id}')">
        </div>
      </div>
      <div class="ti-subsite-qr">
        <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:6px;">${t('subsite_qr_label')}</label>
        <img src="${tiQrCodeUrl(url, 180)}" width="180" height="180" alt="QR code">
      </div>
    </div>`;
}
async function tiToggleSubsite(agencyId) {
  const agency = await TiDB.toggleAgencySubsite(agencyId);
  if (!agency) return;
  tiToast(t("save_changes") + " ✓");
  tiLogAdminAction(agency.subsiteEnabled ? "subsite_enabled" : "subsite_disabled", "agency", agencyId, agency.name);
  document.getElementById("subsite-details-mount").innerHTML = tiSubsiteDetailsHtml(agency);
}
function tiCopySubsiteLink() {
  const input = document.getElementById("subsite-url-input");
  input.select();
  navigator.clipboard?.writeText(input.value);
  tiToast(t("subsite_link_copied"));
}
async function tiHandleSubsiteLogoUpload(input, agencyId) {
  const file = input.files[0];
  input.value = "";
  if (!file || !file.type.startsWith("image/")) return;
  try {
    const dataUrl = await tiCompressImageFile(file, 400, 0.85);
    const agency = await TiDB.updateAgencyLogo(agencyId, dataUrl);
    tiToast(t("save_changes") + " ✓");
    tiLogAdminAction("agency_logo_updated", "agency", agencyId, agency.name);
    document.getElementById("subsite-details-mount").innerHTML = tiSubsiteDetailsHtml(agency);
  } catch (err) { /* ignore decode failure */ }
}

async function tiOpenAgencyDetail(id) {
  TI_AGENCY_DETAIL_ID = id;
  const [agency, supervisor, agents, allProps, bookings, auditLog] = await Promise.all([
    TiDB.getAgency(id),
    TiDB.getAgencySupervisor(id),
    TiDB.getAgents(id),
    TiDB.getProperties(),
    TiDB.getBookings({ agencyId: id }),
    TiDB.getAuditLog({ agencyId: id }),
  ]);
  if (!agency) return;
  const props = allProps.filter(p => p.agencyId === id);
  TI_AGENCY_DETAIL_AGENTS = agents;
  const tier = TI_AGENCY_TIERS.find(t2 => t2.id === agency.tier);
  const stateCount = state => props.filter(p => tiPropertyStateValue(p) === state).length;
  const ratedProps = props.filter(p => p.rating);
  const avgRating = ratedProps.length ? (ratedProps.reduce((s, p) => s + p.rating, 0) / ratedProps.length).toFixed(1) : "—";
  const suspended = agency.status === "suspended";

  document.getElementById("agency-detail-mount").innerHTML = `
    <button class="btn btn-outline btn-sm" style="margin-bottom:18px;" onclick="tiShowPanel('agencies')">&larr; ${t('back_to_agencies')}</button>

    <div class="ti-dash-head" style="margin-bottom:18px;align-items:flex-start;">
      <div>
        <h3 style="margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${tiEscapeHtml(agency.name)}
          <span class="badge ${agency.verified ? 'badge-confirmed' : 'badge-pending'}">${agency.verified ? '✓ ' + t('verified_label') : t('status_pending')}</span>
          <span class="badge ${suspended ? 'badge-cancelled' : 'badge-confirmed'}">${suspended ? t('status_suspended') : t('status_active')}</span>
          ${tier ? `<span class="badge badge-paid">${tiGetLang() === 'en' ? tier.labelEn : tier.label}</span>` : ''}
        </h3>
        <p style="color:var(--ink-soft);font-size:.85rem;margin:6px 0 0;">${t('reference_label')} ${agency.code || '—'} · ${agency.email} · ${agency.phone || '—'}</p>
        ${agency.address ? `<p style="color:var(--ink-soft);font-size:.85rem;margin:2px 0 0;">${agency.address}</p>` : ''}
      </div>
    </div>

    <div class="ti-agency-stat-grid">
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.home}</span><b>${props.length}</b><span>${t('listings_count_label')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.check}</span><b>${stateCount('for_sale') + stateCount('for_rent')}</b><span>${t('state_for_sale')} / ${t('state_for_rent')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.document}</span><b>${stateCount('pending')}</b><span>${t('listing_status_pending')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.star}</span><b>${avgRating}</b><span>${t('sort_rating')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.grid}</span><b>${bookings.length}</b><span>${t('dash_agency_bookings')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.user}</span><b>${agents.length}/${agency.maxAgents ?? '—'}</b><span>${t('agents_label')}</span></div>
    </div>

    <div class="ti-agency-detail-section">
      <h4 class="ti-form-section-title">${t('subsite_section_title')}</h4>
      <p style="color:var(--ink-soft);font-size:.85rem;margin:-6px 0 14px;">${t('subsite_section_sub')}</p>
      <div class="ti-subsite-panel">
        <div class="ti-subsite-toggle-row">
          <strong>${t('subsite_enable_label')}</strong>
          <label class="ti-switch">
            <input type="checkbox" ${agency.subsiteEnabled ? 'checked' : ''} onchange="tiToggleSubsite('${agency.id}')">
            <span class="ti-switch-track"></span>
          </label>
        </div>
        <div id="subsite-details-mount">${tiSubsiteDetailsHtml(agency)}</div>
      </div>
    </div>

    <div class="ti-agency-detail-section">
      <h4 class="ti-form-section-title">${t('agency_responsible_section')}</h4>
      ${supervisor ? tiAgencyDetailPersonRowHtml(supervisor, true) : `<p style="color:var(--ink-soft);">${t('no_responsible_note')}</p>`}
    </div>

    <div class="ti-agency-detail-section">
      <h4 class="ti-form-section-title">${t('dash_agency_agents')}</h4>
      <div class="ti-filter-search" style="max-width:320px;margin-bottom:14px;">
        <span class="ti-filter-search-icon">${TI_ICONS.search}</span>
        <input type="text" id="agency-detail-agent-search" placeholder="${t('search_agent_placeholder')}" oninput="tiFilterAgencyDetailAgents()">
      </div>
      <div id="agency-detail-agents-mount"></div>
    </div>

    <div class="ti-agency-detail-section">
      <h4 class="ti-form-section-title">${t('dash_agency_audit')}</h4>
      <div id="agency-detail-audit-mount">${tiAgencyDetailAuditHtml(auditLog)}</div>
    </div>

    <div class="ti-agency-detail-section ti-danger-zone">
      <h4 class="ti-form-section-title" style="color:var(--danger);border-color:var(--danger);">${t('danger_zone')}</h4>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="tiAgencyDetailToggleSuspended('${agency.id}')">${suspended ? t('action_activate') : t('action_suspend')}</button>
        <button class="btn btn-danger btn-sm" onclick="tiDeleteAgency('${agency.id}')">${t('action_delete')}</button>
      </div>
    </div>`;

  tiFilterAgencyDetailAgents();
  tiShowPanel("agency-detail");
}

function tiAgencyDetailPersonRowHtml(user, isSupervisor) {
  const frozen = user.status === "suspended";
  return `
    <div class="ti-list-row ${frozen ? 'ti-row-frozen' : ''}">
      <span class="ti-agency-avatar">${user.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
      <div class="ti-list-row-body">
        <strong>${tiEscapeHtml(user.name)}</strong>
        <span class="badge ${isSupervisor ? 'badge-paid' : 'badge-pending'}" style="margin-left:6px;">${isSupervisor ? t('role_supervisor') : t('role_agent')}</span>
        <span class="badge ${frozen ? 'badge-cancelled' : 'badge-confirmed'}" style="margin-left:4px;">${frozen ? t('status_frozen') : t('status_active')}</span>
        <br>
        <span style="color:var(--ink-soft);font-size:.85rem;">${user.email}${user.phone ? ' · ' + user.phone : ''} · ${t('last_login_label')}: ${user.lastLoginAt ? tiFormatDateTime(user.lastLoginAt) : t('never_label')}</span>
      </div>
      <div class="ti-list-row-actions" style="flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="tiAgencyDetailResetPassword('${user.id}')">${t('reset_password')}</button>
        <button class="btn btn-outline btn-sm" onclick="tiAgencyDetailShowDebug('${user.id}')">${t('debug_account')}</button>
        <button class="btn btn-outline btn-sm" onclick="tiAgencyDetailImpersonate('${user.id}')">${t('impersonate')}</button>
        <button class="btn btn-outline btn-sm" onclick="tiAgencyDetailToggleFrozen('${user.id}')">${frozen ? t('action_reactivate') : t('action_freeze')}</button>
        ${!isSupervisor ? `<button class="btn btn-danger btn-sm" onclick="tiAgencyDetailDeleteAgent('${user.id}')">${t('action_delete')}</button>` : ''}
      </div>
    </div>`;
}

function tiFilterAgencyDetailAgents() {
  const q = (document.getElementById("agency-detail-agent-search")?.value || "").trim().toLowerCase();
  const list = q ? TI_AGENCY_DETAIL_AGENTS.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) : TI_AGENCY_DETAIL_AGENTS;
  const mount = document.getElementById("agency-detail-agents-mount");
  if (!mount) return;
  mount.innerHTML = list.length ? list.map(a => tiAgencyDetailPersonRowHtml(a, false)).join('') : `<p style="color:var(--ink-soft)">${t('agents_empty')}</p>`;
}

function tiAgencyDetailAuditHtml(log) {
  const recent = log.slice(0, 15);
  if (!recent.length) return `<p style="color:var(--ink-soft)">${t('audit_empty')}</p>`;
  return `
    <table class="ti-rental-schedule-table">
      <thead><tr><th>${t('audit_col_date')}</th><th>${t('audit_col_actor')}</th><th>${t('audit_col_action')}</th><th>${t('audit_col_details')}</th></tr></thead>
      <tbody>
        ${recent.map(l => `<tr>
          <td>${tiFormatDateTime(l.timestamp)}</td>
          <td>${l.actorName}</td>
          <td>${t('audit_action_' + l.action) || l.action}</td>
          <td style="color:var(--ink-soft);">${l.targetLabel || ''}${l.details ? ' · ' + l.details : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function tiAgencyDetailToggleFrozen(userId) {
  const user = (await TiDB.getUsers()).find(u => u.id === userId);
  if (!user) return;
  const nowFrozen = user.status !== "suspended";
  await TiDB.setUserStatus(userId, nowFrozen ? "suspended" : "active");
  tiToast((nowFrozen ? t("action_freeze") : t("action_reactivate")) + " ✓");
  tiLogAdminAction(nowFrozen ? "agent_frozen" : "agent_reactivated", "agent", userId, user.name, "", TI_AGENCY_DETAIL_ID);
  tiOpenAgencyDetail(TI_AGENCY_DETAIL_ID);
}
async function tiAgencyDetailDeleteAgent(userId) {
  const user = (await TiDB.getUsers()).find(u => u.id === userId);
  if (!confirm(t("confirm_delete_agent"))) return;
  await TiDB.deleteAgent(userId);
  tiToast(t("agent_removed") + " ✓");
  tiLogAdminAction("agent_removed", "agent", userId, user ? user.name : userId, "", TI_AGENCY_DETAIL_ID);
  tiOpenAgencyDetail(TI_AGENCY_DETAIL_ID);
}
async function tiAgencyDetailResetPassword(userId) {
  const user = (await TiDB.getUsers()).find(u => u.id === userId);
  const result = await TiDB.regenerateTempPassword(userId);
  if (!result.ok) return;
  tiLogAdminAction("password_reset", "agent", userId, user ? user.name : userId, "", TI_AGENCY_DETAIL_ID);
  document.getElementById("temp-password-user-note").textContent = user ? `${user.name} — ${user.email}` : '';
  document.getElementById("temp-password-value").value = result.password;
  tiOpenModal("modal-temp-password");
  tiOpenAgencyDetail(TI_AGENCY_DETAIL_ID);
}
async function tiAgencyDetailShowDebug(userId) {
  const user = (await TiDB.getUsers()).find(u => u.id === userId);
  if (!user) return;
  document.getElementById("debug-info-mount").innerHTML = `
    <div class="ti-debug-row"><span>ID</span><code>${user.id}</code></div>
    <div class="ti-debug-row"><span>${t('email')}</span><code>${user.email}</code></div>
    <div class="ti-debug-row"><span>${t('role_label')}</span><code>${user.role} / ${user.agentRole || '—'}</code></div>
    <div class="ti-debug-row"><span>Agency ID</span><code>${user.agencyId || '—'}</code></div>
    <div class="ti-debug-row"><span>${t('status_label')}</span><code>${user.status || 'active'}</code></div>
    <div class="ti-debug-row"><span>${t('created_at_label')}</span><code>${user.createdAt ? tiFormatDateTime(user.createdAt) : '—'}</code></div>
    <div class="ti-debug-row"><span>${t('last_login_label')}</span><code>${user.lastLoginAt ? tiFormatDateTime(user.lastLoginAt) : t('never_label')}</code></div>
    <div class="ti-debug-row"><span>${t('must_change_password_label')}</span><code>${user.mustChangePassword ? t('yes_label') : t('no_label')}</code></div>`;
  tiOpenModal("modal-debug-account");
}
async function tiAgencyDetailImpersonate(userId) {
  const user = (await TiDB.getUsers()).find(u => u.id === userId);
  if (!user) return;
  if (!confirm(`${t('confirm_impersonate')} ${user.name} ?`)) return;
  tiLogAdminAction("impersonation_started", "agent", userId, user.name, "", TI_AGENCY_DETAIL_ID);
  await tiImpersonateUser(userId);
}

async function tiRenderAgencies() {
  const [agencies, props] = await Promise.all([TiDB.getAgencies(), TiDB.getProperties()]);
  TI_ADMIN_ALL_AGENCIES = agencies;
  TI_ADMIN_ALL_AGENCY_PROPS = props;
  tiRenderAgenciesFilterBar();
  tiApplyAgenciesFilter();
}

async function tiToggleAgencyVerified(id) {
  const agency = await TiDB.getAgency(id);
  if (!agency) return;
  await TiDB.saveAgency({ id, verified: !agency.verified });
  tiToast((agency.verified ? t('action_unverify') : t('action_verify')) + " ✓");
  tiLogAdminAction(agency.verified ? "agency_unverified" : "agency_verified", "agency", id, agency.name, "", id);
  await tiRefreshPanel("agencies");
}

async function tiToggleAgencySuspended(id) {
  const agency = await TiDB.getAgency(id);
  if (!agency) return;
  const nowSuspended = agency.status !== "suspended";
  await TiDB.saveAgency({ id, status: nowSuspended ? "suspended" : "active" });
  tiToast((nowSuspended ? t('action_suspend') : t('action_activate')) + " ✓");
  tiLogAdminAction(nowSuspended ? "agency_suspended" : "agency_activated", "agency", id, agency.name, "", id);
  await tiRefreshPanel("agencies");
}

// Variantes sur place, utilisées depuis la fiche détail d'une agence : elles
// réaffichent cette même fiche au lieu de retourner à la liste.
async function tiAgencyDetailToggleVerified(id) {
  const agency = await TiDB.getAgency(id);
  if (!agency) return;
  await TiDB.saveAgency({ id, verified: !agency.verified });
  tiToast((agency.verified ? t('action_unverify') : t('action_verify')) + " ✓");
  tiLogAdminAction(agency.verified ? "agency_unverified" : "agency_verified", "agency", id, agency.name, "", id);
  tiOpenAgencyDetail(id);
}
async function tiAgencyDetailToggleSuspended(id) {
  const agency = await TiDB.getAgency(id);
  if (!agency) return;
  const nowSuspended = agency.status !== "suspended";
  await TiDB.saveAgency({ id, status: nowSuspended ? "suspended" : "active" });
  tiToast((nowSuspended ? t('action_suspend') : t('action_activate')) + " ✓");
  tiLogAdminAction(nowSuspended ? "agency_suspended" : "agency_activated", "agency", id, agency.name, "", id);
  tiOpenAgencyDetail(id);
}

async function tiDeleteAgency(id) {
  const agency = await TiDB.getAgency(id);
  if (!confirm(t('confirm_delete_agency'))) return;
  await TiDB.deleteAgency(id, true);
  tiToast(t("action_delete") + " ✓");
  tiLogAdminAction("agency_deleted", "agency", id, agency ? agency.name : id);
  await tiRefreshPanel("agencies");
}

function tiRenderTierPicker(selectedTierId) {
  const picker = document.getElementById("ag-tier-picker");
  picker.innerHTML = TI_AGENCY_TIERS.map(tier => `
    <label class="ti-tier-card ${tier.id === selectedTierId ? 'selected' : ''}" data-tier="${tier.id}">
      <input type="radio" name="ag-tier" value="${tier.id}" ${tier.id === selectedTierId ? 'checked' : ''} onchange="tiSelectTier('${tier.id}')">
      <strong>${tiGetLang() === 'en' ? tier.labelEn : tier.label}</strong>
      <span>${tier.maxAgents} ${t('agents_label')} · ${tier.maxListings} ${t('listings_count_label')}</span>
    </label>`).join('');
}
function tiSelectTier(tierId) {
  const tier = TI_AGENCY_TIERS.find(t2 => t2.id === tierId);
  document.querySelectorAll('.ti-tier-card').forEach(c => c.classList.toggle('selected', c.dataset.tier === tierId));
  if (tier) {
    document.getElementById("ag-max-agents").value = tier.maxAgents;
    document.getElementById("ag-max-listings").value = tier.maxListings;
  }
}

function tiOpenAgencyModal(id) {
  const form = document.querySelector('#modal-agency form');
  form.reset();
  document.getElementById("ag-edit-id").value = "";
  document.getElementById("agency-modal-title").textContent = t("add_agency");
  if (id) {
    Promise.all([TiDB.getAgency(id), TiDB.getAgencySupervisor(id)]).then(([a, supervisor]) => {
      if (!a) return;
      document.getElementById("ag-edit-id").value = a.id;
      document.getElementById("ag-name").value = a.name;
      document.getElementById("ag-email").value = a.email;
      document.getElementById("ag-phone").value = a.phone || "";
      document.getElementById("ag-address").value = a.streetAddress || "";
      if (a.region && a.commune) tiSetLocationHierarchyGeneric("ag", a.region, a.department, a.arrondissement, a.commune);
      else tiPopulateRegionChipsGeneric("ag");
      document.getElementById("ag-verified").checked = !!a.verified;
      tiRenderTierPicker(a.tier || "standard");
      document.getElementById("ag-max-agents").value = a.maxAgents ?? 2;
      document.getElementById("ag-max-listings").value = a.maxListings ?? 10;
      document.getElementById("agency-modal-title").textContent = a.name;
      document.getElementById("ag-supervisor-new-section").style.display = "none";
      const existingSection = document.getElementById("ag-supervisor-existing-section");
      existingSection.style.display = "";
      existingSection.innerHTML = `
        <h4 class="ti-form-section-title">${t('agency_responsible_section')}</h4>
        ${supervisor
          ? `<p class="ti-form-section-sub">${supervisor.name} · ${supervisor.email}${supervisor.phone ? ' · ' + supervisor.phone : ''}</p>`
          : `<p class="ti-form-section-sub">${t('no_responsible_note')}</p>`}`;
      tiOpenModal("modal-agency");
    });
  } else {
    document.getElementById("ag-supervisor-new-section").style.display = "";
    document.getElementById("ag-supervisor-existing-section").style.display = "none";
    tiPopulateRegionChipsGeneric("ag");
    tiRenderTierPicker("standard");
    tiSelectTier("standard");
    tiOpenModal("modal-agency");
  }
}

async function tiSubmitAgencyForm(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn && submitBtn.classList.contains("is-loading")) return false; // soumission déjà en cours
  tiSetBtnLoading(submitBtn, true);
  const editId = document.getElementById("ag-edit-id").value;
  const name = document.getElementById("ag-name").value;
  const tier = document.querySelector('input[name="ag-tier"]:checked')?.value || "standard";
  const regionId = document.getElementById("ag-region").value;
  const deptId = document.getElementById("ag-department").value;
  const arrId = document.getElementById("ag-arrondissement").value;
  const communeId = document.getElementById("ag-commune").value;
  const commune = (TI_ADMIN_COMMUNES[arrId] || []).find(c => c.id === communeId);
  const streetAddress = document.getElementById("ag-address").value.trim();
  const displayAddress = [streetAddress, commune ? commune.name : null].filter(Boolean).join(", ");
  const agency = {
    id: editId || "ag_" + Date.now(),
    name,
    email: document.getElementById("ag-email").value,
    phone: document.getElementById("ag-phone").value,
    region: regionId, department: deptId, arrondissement: arrId, commune: communeId,
    streetAddress, address: displayAddress,
    tier,
    maxAgents: parseInt(document.getElementById("ag-max-agents").value, 10) || 1,
    maxListings: parseInt(document.getElementById("ag-max-listings").value, 10) || 1,
    verified: document.getElementById("ag-verified").checked,
  };
  if (!editId) {
    agency.code = tiDeriveAgencyCode(name);
    agency.subscriptionStatus = "trial";
    agency.subscribedSince = new Date().toISOString().slice(0, 10);
  }

  let respName, respEmail, respPhone, respPassword;
  if (!editId) {
    respName = document.getElementById("ag-resp-name").value.trim();
    respEmail = document.getElementById("ag-resp-email").value.trim();
    respPhone = document.getElementById("ag-resp-phone").value.trim();
    respPassword = document.getElementById("ag-resp-password").value;
    if (!respName || !respEmail || !respPassword) {
      tiToast(t("responsible_required_note"));
      tiSetBtnLoading(submitBtn, false);
      return false;
    }
    const existing = await TiDB.findUserByEmail(respEmail);
    if (existing) {
      tiToast(t("agent_email_exists"));
      tiSetBtnLoading(submitBtn, false);
      return false;
    }
  }

  try {
    if (!editId) {
      await TiDB.saveAgency(agency);
      await TiDB.createAgencySupervisor({ name: respName, email: respEmail, phone: respPhone, password: respPassword, agencyId: agency.id });
    } else {
      await TiDB.saveAgency(agency);
    }
  } finally {
    tiSetBtnLoading(submitBtn, false);
  }

  tiToast(t("save_changes") + " ✓");
  tiCloseModal("modal-agency");
  tiLogAdminAction(editId ? "agency_edited" : "agency_created", "agency", agency.id, agency.name);
  await tiRefreshPanel("agencies");
  return false;
}

let TI_ADMIN_ALL_PROPS = [];
const TI_ADMIN_LISTINGS_FILTER = { q: "", hood: "", agency: "", type: "", minPrice: null, maxPrice: null };
let tiAdminFilterDebounce = null;

function tiRenderAdminListingsFilterBar(agencies, props) {
  const mount = document.getElementById("admin-listings-filters");
  const hoods = [...new Set(props.map(p => p.neighborhood).filter(Boolean))]
    .map(id => ({ id, name: tiNeighborhoodName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  mount.innerHTML = `
    <div class="ti-admin-filter-bar">
      <div class="ti-filter-search">
        <span class="ti-filter-search-icon">${TI_ICONS.search}</span>
        <input type="text" id="al-search" placeholder="${t('filter_search_title')}">
      </div>
      <select id="al-hood">
        <option value="">${t('filter_all_neighborhoods')}</option>
        ${hoods.map(n => `<option value="${n.id}">${tiEscapeHtml(n.name)}</option>`).join('')}
      </select>
      <select id="al-agency">
        <option value="">${t('filter_all_agencies')}</option>
        ${agencies.map(a => `<option value="${a.id}">${tiEscapeHtml(a.name)}</option>`).join('')}
      </select>
      <select id="al-type">
        <option value="">${t('filter_all_types')}</option>
        <option value="apartment">${t('type_apartment')}</option>
        <option value="house">${t('type_house')}</option>
        <option value="office">${t('type_office')}</option>
        <option value="land">${t('type_land')}</option>
      </select>
      <select id="al-status">
        ${tiPropertyStateOptionsHtml()}
      </select>
      <input type="number" id="al-min-price" placeholder="${t('filter_min_price')}">
      <input type="number" id="al-max-price" placeholder="${t('filter_max_price')}">
      <button class="ti-filter-reset" id="al-reset" onclick="tiResetAdminListingsFilter()">${t('filter_reset')}</button>
    </div>
    <div class="ti-filter-results-count" id="al-results-count"></div>`;

  const debounced = () => { clearTimeout(tiAdminFilterDebounce); tiAdminFilterDebounce = setTimeout(tiApplyAdminListingsFilter, 300); };
  document.getElementById("al-search").addEventListener("input", debounced);
  document.getElementById("al-min-price").addEventListener("input", debounced);
  document.getElementById("al-max-price").addEventListener("input", debounced);
  document.getElementById("al-hood").addEventListener("change", tiApplyAdminListingsFilter);
  document.getElementById("al-agency").addEventListener("change", tiApplyAdminListingsFilter);
  document.getElementById("al-type").addEventListener("change", tiApplyAdminListingsFilter);
  document.getElementById("al-status").addEventListener("change", tiApplyAdminListingsFilter);
}

function tiResetAdminListingsFilter() {
  document.getElementById("al-search").value = "";
  document.getElementById("al-hood").value = "";
  document.getElementById("al-agency").value = "";
  document.getElementById("al-type").value = "";
  document.getElementById("al-status").value = "";
  document.getElementById("al-min-price").value = "";
  document.getElementById("al-max-price").value = "";
  tiApplyAdminListingsFilter();
}

function tiApplyAdminListingsFilter() {
  const q = document.getElementById("al-search").value.trim().toLowerCase();
  const hood = document.getElementById("al-hood").value;
  const agency = document.getElementById("al-agency").value;
  const type = document.getElementById("al-type").value;
  const status = document.getElementById("al-status").value;
  const minPrice = document.getElementById("al-min-price").value;
  const maxPrice = document.getElementById("al-max-price").value;

  let list = [...TI_ADMIN_ALL_PROPS];
  if (q) list = list.filter(p => tiPropertyTitle(p).toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q));
  if (hood) list = list.filter(p => p.neighborhood === hood);
  if (agency) list = list.filter(p => p.agencyId === agency);
  if (type) list = list.filter(p => p.type === type);
  if (status) list = list.filter(p => tiPropertyStateValue(p) === status);
  if (minPrice !== "") list = list.filter(p => p.price >= parseFloat(minPrice));
  if (maxPrice !== "") list = list.filter(p => p.price <= parseFloat(maxPrice));

  document.getElementById("al-results-count").textContent = `${list.length} ${t('filter_results')}`;
  document.getElementById("admin-listings-mount").innerHTML = list.length ? list.map(p => `
    <div class="ti-list-row">
      <img src="${p.cover}" alt="" onerror="this.style.display='none'">
      <div class="ti-list-row-body">
        <strong>${tiPropertyTitle(p)}</strong> ${tiListingStatusBadge(p.listingStatus)} ${tiTitleVerificationBadge(p)}<br>
        <span style="color:var(--ink-soft);font-size:.85rem;">${tiNeighborhoodName(p.neighborhood)} · ${tiEscapeHtml(tiAgencyName(p.agencyId))} · <span data-price-xof="${p.price}">${tiFormatPrice(p.price)}</span>${p.reference ? ` · <span class="ti-card-ref" style="display:inline;">${t('reference_label')} ${p.reference}</span>` : ''}</span>
      </div>
      <div class="ti-list-row-actions">
        <a class="btn btn-outline btn-sm" href="property.html?id=${p.id}" data-i18n="action_view">${t('action_view')}</a>
        <button class="btn btn-outline btn-sm" onclick="tiGeneratePropertySheet('${p.id}')" data-i18n="action_spec_sheet">${t('action_spec_sheet')}</button>
        ${p.listingStatus === 'pending' ? `
          <button class="btn btn-primary btn-sm" onclick="tiApproveListing('${p.id}')">${t('action_approve')}</button>
          <button class="btn btn-outline btn-sm" onclick="tiRejectListing('${p.id}')">${t('action_reject')}</button>
        ` : ''}
        ${p.titleVerification && p.titleVerification.status === 'pending' ? `
          <button class="btn btn-outline btn-sm" onclick="tiViewTitleDoc('${p.id}')">${t('action_view_title_doc')}</button>
          <button class="btn btn-primary btn-sm" onclick="tiApproveTitleVerification('${p.id}')">${t('action_verify_title')}</button>
          <button class="btn btn-outline btn-sm" onclick="tiRejectTitleVerification('${p.id}')">${t('action_reject_title')}</button>
        ` : ''}
        <button class="btn btn-danger btn-sm" onclick="tiAdminDeleteListing('${p.id}')" data-i18n="action_delete">${t('action_delete')}</button>
      </div>
    </div>`).join('') : `<p style="color:var(--ink-soft)">${t('filter_no_results')}</p>`;
}
function tiTitleVerificationBadge(p) {
  const status = p.titleVerification && p.titleVerification.status;
  if (status === 'verified') return `<span class="ti-verified-badge">${TI_ICONS.shield}${t('title_verified_badge')}</span>`;
  if (status === 'pending') return `<span class="badge badge-pending">${t('title_verification_status_pending')}</span>`;
  if (status === 'rejected') return `<span class="badge badge-cancelled">${t('title_verification_status_rejected')}</span>`;
  return '';
}
function tiViewTitleDoc(id) {
  const prop = TI_ADMIN_ALL_PROPS.find(p => p.id === id);
  if (!prop || !prop.titleVerification || !prop.titleVerification.fileData) return;
  const w = window.open("");
  if (!w) return;
  const isPdf = prop.titleVerification.fileData.startsWith("data:application/pdf");
  w.document.write(isPdf
    ? `<iframe src="${prop.titleVerification.fileData}" style="border:0;width:100vw;height:100vh;"></iframe>`
    : `<img src="${prop.titleVerification.fileData}" style="max-width:100%;display:block;margin:0 auto;">`);
}
async function tiApproveTitleVerification(id) {
  const prop = TI_ADMIN_ALL_PROPS.find(p => p.id === id);
  if (!prop) return;
  await TiDB.setTitleVerificationStatus(id, "verified", null);
  tiToast(t("action_verify_title") + " ✓");
  tiLogAdminAction("title_verified", "property", id, tiPropertyTitle(prop));
  await tiRefreshPanel("listings");
}
async function tiRejectTitleVerification(id) {
  const prop = TI_ADMIN_ALL_PROPS.find(p => p.id === id);
  if (!prop) return;
  const note = prompt(t("title_reject_reason_prompt"));
  if (note === null) return;
  await TiDB.setTitleVerificationStatus(id, "rejected", note);
  tiToast(t("action_reject_title") + " ✓");
  tiLogAdminAction("title_rejected", "property", id, tiPropertyTitle(prop));
  await tiRefreshPanel("listings");
}

async function tiApproveListing(id) {
  const prop = TI_ADMIN_ALL_PROPS.find(p => p.id === id);
  await TiDB.setListingStatus(id, "active");
  tiToast(t("action_approve") + " ✓");
  tiLogAdminAction("listing_approved", "property", id, prop ? tiPropertyTitle(prop) : id);
  await tiRefreshPanel("listings");
}
async function tiRejectListing(id) {
  const prop = TI_ADMIN_ALL_PROPS.find(p => p.id === id);
  await TiDB.setListingStatus(id, "rejected");
  tiToast(t("action_reject") + " ✓");
  tiLogAdminAction("listing_rejected", "property", id, prop ? tiPropertyTitle(prop) : id);
  await tiRefreshPanel("listings");
}

/* ---------- Catalogue de caractéristiques (valable pour toute la plateforme, géré par l'admin) ---------- */
const TI_ICON_PICKER_OPTIONS = [
  "🛡️", "📹", "🔔", "🚪", "🧑‍✈️", "🛗", "🌇", "🏙️", "🌆", "🌳",
  "🏊", "🍖", "❄️", "🔥", "🛋️", "👔", "🛁", "🍳", "🍽️", "🅿️",
  "🚗", "🔌", "📶", "☀️", "🚰", "🏋️", "🛝", "🧺", "📦", "🏞️",
  "🌊", "🗣️", "🛎️", "🏢", "🖥️", "📜", "🚧", "🛣️", "💡", "🔑",
  "🐾", "🚲", "🛗", "🧯", "🚿", "🪟", "🌿", "🏠", "🏗️", "✨",
];
let TI_AMENITY_CATALOG_CACHE = [];

function tiRenderIconPicker(selectedIcon) {
  const mount = document.getElementById("am-icon-picker");
  mount.innerHTML = TI_ICON_PICKER_OPTIONS.map(icon => `
    <button type="button" class="ti-icon-picker-opt ${icon === selectedIcon ? 'active' : ''}" onclick="tiSelectIcon('${icon}', this)">${icon}</button>`).join("");
  document.getElementById("am-icon-value").value = selectedIcon || "";
}
function tiSelectIcon(icon, btnEl) {
  document.getElementById("am-icon-value").value = icon;
  document.querySelectorAll(".ti-icon-picker-opt").forEach(el => el.classList.remove("active"));
  btnEl.classList.add("active");
}
function tiOpenAmenityModal(id) {
  const form = document.querySelector("#modal-amenity form");
  form.reset();
  document.getElementById("am-edit-id").value = "";
  document.getElementById("amenity-modal-title").textContent = t("amenity_add_action");
  const item = id ? TI_AMENITY_CATALOG_CACHE.find(a => a.id === id) : null;
  if (item) {
    document.getElementById("am-edit-id").value = item.id;
    document.getElementById("am-label-fr").value = item.label;
    document.getElementById("am-label-en").value = item.labelEn;
    document.querySelectorAll('.ti-amenity-type-checks input').forEach(cb => { cb.checked = item.types.includes(cb.value); });
    document.getElementById("amenity-modal-title").textContent = t("amenity_edit_action");
  }
  tiRenderIconPicker(item ? item.icon : TI_ICON_PICKER_OPTIONS[0]);
  tiOpenModal("modal-amenity");
}
async function tiSubmitAmenity(e) {
  e.preventDefault();
  const id = document.getElementById("am-edit-id").value || null;
  const types = [...document.querySelectorAll('.ti-amenity-type-checks input:checked')].map(cb => cb.value);
  if (!types.length) { tiToast(t("amenity_need_type")); return false; }
  const item = {
    id, icon: document.getElementById("am-icon-value").value,
    label: document.getElementById("am-label-fr").value.trim(),
    labelEn: document.getElementById("am-label-en").value.trim(),
    types,
  };
  await TiDB.saveAmenityCatalogItem(item);
  tiToast(t("save_changes") + " ✓");
  tiLogAdminAction(id ? "amenity_edited" : "amenity_added", "amenity", item.id || item.label, item.label);
  tiCloseModal("modal-amenity");
  await tiRenderAmenityCatalog();
  return false;
}
async function tiDeleteAmenity(id) {
  const item = TI_AMENITY_CATALOG_CACHE.find(a => a.id === id);
  if (!confirm(t("confirm_delete_amenity"))) return;
  await TiDB.deleteAmenityCatalogItem(id);
  tiToast(t("action_delete") + " ✓");
  tiLogAdminAction("amenity_deleted", "amenity", id, item ? item.label : id);
  await tiRenderAmenityCatalog();
}
function tiApplyAmenityFilter() {
  const typeFilter = document.getElementById("am-type-filter").value;
  const list = typeFilter ? TI_AMENITY_CATALOG_CACHE.filter(a => a.types.includes(typeFilter)) : TI_AMENITY_CATALOG_CACHE;
  const typeLabels = { apartment: t("type_apartment"), house: t("type_house"), office: t("type_office"), land: t("type_land") };
  document.getElementById("amenity-catalog-mount").innerHTML = list.length ? list.map(a => `
    <div class="ti-amenity-catalog-card">
      <div class="ti-amenity-catalog-head">
        <span class="ti-amenity-catalog-icon">${a.icon}</span>
        <strong>${tiGetLang() === 'en' ? a.labelEn : a.label}</strong>
      </div>
      <div class="ti-amenity-catalog-types">${a.types.map(t2 => `<span class="badge badge-review">${typeLabels[t2]}</span>`).join(' ')}</div>
      <div class="ti-amenity-catalog-actions">
        <button class="btn btn-outline btn-sm" onclick="tiOpenAmenityModal('${a.id}')">${t('action_edit')}</button>
        <button class="btn btn-danger btn-sm" onclick="tiDeleteAmenity('${a.id}')">${t('action_delete')}</button>
      </div>
    </div>`).join('') : `<p style="color:var(--ink-soft)">${t('filter_no_results')}</p>`;
}
async function tiRenderAmenityCatalog() {
  TI_AMENITY_CATALOG_CACHE = await TiDB.getAmenityCatalog();
  tiApplyAmenityFilter();
}

async function tiRenderAdminListings() {
  const [props, agencies] = await Promise.all([TiDB.getProperties(), TiDB.getAgencies()]);
  TI_ADMIN_ALL_PROPS = props;
  tiSetNavBadge("listings", props.filter(p => p.titleVerification && p.titleVerification.status === "pending").length);
  tiRenderAdminListingsFilterBar(agencies, props);
  tiApplyAdminListingsFilter();
}
async function tiAdminDeleteListing(id) {
  const prop = TI_ADMIN_ALL_PROPS.find(p => p.id === id);
  await TiDB.deleteProperty(id);
  tiToast(t("action_delete") + " ✓");
  tiLogAdminAction("listing_deleted", "property", id, prop ? tiPropertyTitle(prop) : id);
  await tiRefreshPanel("listings");
}

function tiSubscriptionStatusBadge(status) {
  if (status === "active") return `<span class="badge badge-confirmed">${t('sub_status_active')}</span>`;
  if (status === "past_due") return `<span class="badge badge-cancelled">${t('sub_status_past_due')}</span>`;
  if (status === "trial") return `<span class="badge badge-pending">${t('sub_status_trial')}</span>`;
  return `<span class="badge badge-review">${status}</span>`;
}
function tiInvoiceStatusBadge(status) {
  if (status === "paid") return `<span class="badge badge-paid">${t('status_paid')}</span>`;
  if (status === "overdue") return `<span class="badge badge-cancelled">${t('rental_status_overdue')}</span>`;
  if (status === "trial") return `<span class="badge badge-pending">${t('sub_status_trial')}</span>`;
  return `<span class="badge badge-pending">${t('status_pending')}</span>`;
}

let TI_ADMIN_SUBS_CACHE = [];
function tiRenderAdminPaymentsFilterBar() {
  const mount = document.getElementById("admin-payments-filters");
  mount.innerHTML = `
    <div class="ti-admin-filter-bar">
      <div class="ti-filter-search">
        <span class="ti-filter-search-icon">${TI_ICONS.search}</span>
        <input type="text" id="ap-search" placeholder="${t('filter_search_payments')}">
      </div>
      <select id="ap-status">
        <option value="">${t('filter_all_statuses')}</option>
        <option value="active">${t('sub_status_active')}</option>
        <option value="past_due">${t('sub_status_past_due')}</option>
        <option value="trial">${t('sub_status_trial')}</option>
      </select>
      <button class="ti-filter-reset" onclick="document.getElementById('ap-search').value='';document.getElementById('ap-status').value='';tiApplyAdminPaymentsFilter();">${t('filter_reset')}</button>
    </div>`;
  document.getElementById("ap-search").addEventListener("input", tiApplyAdminPaymentsFilter);
  document.getElementById("ap-status").addEventListener("change", tiApplyAdminPaymentsFilter);
}
function tiApplyAdminPaymentsFilter() {
  const q = document.getElementById("ap-search").value.trim().toLowerCase();
  const statusFilter = document.getElementById("ap-status").value;
  let list = TI_ADMIN_SUBS_CACHE;
  if (q) list = list.filter(s => s.agency.name.toLowerCase().includes(q));
  if (statusFilter) list = list.filter(s => s.sub.status === statusFilter);

  document.getElementById("admin-payments-mount").innerHTML = list.length ? `<table><thead><tr>
      <th>${t('agency_name')}</th><th>${t('agency_tier_section')}</th><th>${t('monthly_payment_label')}</th>
      <th>${t('sub_status_label')}</th><th>${t('sub_since_label')}</th><th></th>
    </tr></thead><tbody>
    ${list.map(({ agency, sub, latestInvoice }) => {
      const tier = TI_AGENCY_TIERS.find(t2 => t2.id === sub.tierId);
      return `<tr>
        <td><strong>${tiEscapeHtml(agency.name)}</strong></td>
        <td>${tier ? (tiGetLang() === 'en' ? tier.labelEn : tier.label) : sub.tierId}</td>
        <td data-price-xof="${sub.monthlyFee}">${tiFormatPrice(sub.monthlyFee)}</td>
        <td>${tiSubscriptionStatusBadge(sub.status)}</td>
        <td>${sub.subscribedSince ? tiFormatMonth(sub.subscribedSince) : '—'}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="tiShowInvoiceHistory('${agency.id}')">${t('view_invoices')}</button>
          ${sub.status === 'past_due' && latestInvoice ? `<button class="btn btn-sm btn-primary" onclick="tiAdminMarkInvoicePaid('${agency.id}','${latestInvoice.id}')">${t('mark_paid')}</button>` : ''}
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>` : `<p style="color:var(--ink-soft)">${t('filter_no_results')}</p>`;
}

async function tiRenderAdminPayments() {
  const agencies = await TiDB.getAgencies();
  const subsData = await Promise.all(agencies.map(async agency => {
    const sub = await TiDB.getAgencySubscription(agency.id);
    const invoices = await TiDB.getAgencyInvoices(agency.id);
    return { agency, sub, invoices, latestInvoice: invoices[invoices.length - 1] };
  }));
  TI_ADMIN_SUBS_CACHE = subsData;

  const mrr = subsData.filter(s => s.sub.status !== "trial").reduce((sum, s) => sum + s.sub.monthlyFee, 0);
  const activeCount = subsData.filter(s => s.sub.status === "active").length;
  const pastDueCount = subsData.filter(s => s.sub.status === "past_due").length;
  const collectedThisMonth = subsData.reduce((sum, s) => {
    const inv = s.latestInvoice;
    return sum + (inv && inv.status === "paid" ? inv.amount : 0);
  }, 0);

  // Vraie tendance du MRR sur 6 mois, agrégée à partir des factures réellement émises pour chaque agence.
  const byPeriod = {};
  subsData.forEach(s => s.invoices.forEach(inv => { byPeriod[inv.period] = (byPeriod[inv.period] || 0) + inv.amount; }));
  const periods = Object.keys(byPeriod).sort();
  const mrrTrendHtml = periods.length ? tiLineChartHtml(
    t('mrr_trend_title'),
    periods.map(p => tiFormatMonth(p + "-01").split(" ")[0]),
    periods.map(p => byPeriod[p]),
    v => tiFormatPrice(v)
  ) : "";

  const prevMonthTotal = periods.length >= 2 ? byPeriod[periods[periods.length - 2]] : null;
  const mrrDelta = prevMonthTotal ? Math.round(((mrr - prevMonthTotal) / prevMonthTotal) * 1000) / 10 : null;

  const statsHtml = `
    <div class="ti-agency-stat-grid" style="margin-bottom:22px;">
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.check}</span><b data-price-xof="${mrr}">${tiFormatPrice(mrr)}</b>${tiTrendBadgeHtml(mrrDelta)}<span>${t('mrr_label')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.buildingCheck}</span><b>${activeCount}</b><span>${t('sub_status_active')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.document}</span><b>${pastDueCount}</b><span>${t('sub_status_past_due')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.star}</span><b data-price-xof="${collectedThisMonth}">${tiFormatPrice(collectedThisMonth)}</b><span>${t('collected_this_month_label')}</span></div>
    </div>
    ${mrrTrendHtml}`;

  const clientPayments = await TiDB.getPayments();
  const otherPaymentsHtml = clientPayments.length ? `
    <h4 style="margin:30px 0 14px;">${t('other_payments_title')}</h4>
    <table><thead><tr>
      <th>${t('field_title')}</th><th>${t('pay_method')}</th><th>${t('pay_amount')}</th><th></th>
    </tr></thead><tbody>
    ${clientPayments.map(p => `<tr>
      <td>${p.propertyTitle}</td>
      <td style="text-transform:uppercase;">${p.method}</td>
      <td data-price-xof="${p.amount}">${tiFormatPrice(p.amount)}</td>
      <td><span class="badge badge-paid">${t('status_paid')}</span></td>
    </tr>`).join('')}
    </tbody></table>` : '';

  document.getElementById("admin-payments-mount").insertAdjacentHTML("beforebegin", statsHtml);
  tiRenderAdminPaymentsFilterBar();
  tiApplyAdminPaymentsFilter();
  document.getElementById("admin-payments-mount").insertAdjacentHTML("afterend", otherPaymentsHtml);
}

function tiShowInvoiceHistory(agencyId) {
  const entry = TI_ADMIN_SUBS_CACHE.find(s => s.agency.id === agencyId);
  if (!entry) return;
  TiDB.getAgencyInvoices(agencyId).then(invoices => {
    document.getElementById("invoice-history-title").textContent = `${t('invoice_history_title')} — ${entry.agency.name}`;
    document.getElementById("invoice-history-mount").innerHTML = `
      <table><thead><tr>
        <th>${t('period_label')}</th><th>${t('pay_amount')}</th><th>${t('pay_method')}</th><th>${t('paid_on_label')}</th><th>${t('status_label')}</th>
      </tr></thead><tbody>
      ${invoices.slice().reverse().map(inv => `<tr>
        <td>${tiFormatMonth(inv.period + "-01")}</td>
        <td data-price-xof="${inv.amount}">${tiFormatPrice(inv.amount)}</td>
        <td style="text-transform:uppercase;">${inv.method || '—'}</td>
        <td>${inv.paidAt ? tiFormatDateTime(inv.paidAt) : '—'}</td>
        <td>${tiInvoiceStatusBadge(inv.status)}</td>
      </tr>`).join('')}
      </tbody></table>`;
    tiOpenModal("modal-invoice-history");
  });
}
async function tiAdminMarkInvoicePaid(agencyId, invoiceId) {
  const entry = TI_ADMIN_SUBS_CACHE.find(s => s.agency.id === agencyId);
  await TiDB.markInvoicePaid(agencyId, invoiceId, "manual");
  tiToast(t("mark_paid") + " ✓");
  tiLogAdminAction("invoice_marked_paid", "agency", agencyId, entry ? entry.agency.name : agencyId, invoiceId, agencyId);
  await tiRefreshPanel("payments");
}

async function tiRenderDeletionRequests() {
  const mount = document.getElementById("deletions-mount");
  if (!mount) return;
  const [pendingProps, pendingAgents, agencies] = await Promise.all([
    TiDB.getPendingPropertyDeletions(), TiDB.getPendingAgentDeletions(), TiDB.getAgencies(),
  ]);
  const items = [
    ...pendingProps.map(p => ({ type: "property", id: p.id, title: tiPropertyTitle(p), agencyName: tiAgencyName(p.agencyId), reason: p.deletionReason, requestedBy: p.deletionRequestedBy, requestedAt: p.deletionRequestedAt })),
    ...pendingAgents.map(a => ({ type: "agent", id: a.id, title: a.name, agencyName: tiAgencyName(a.agencyId), reason: a.deletionReason, requestedBy: a.deletionRequestedBy, requestedAt: a.deletionRequestedAt })),
  ].sort((x, y) => new Date(x.requestedAt) - new Date(y.requestedAt));
  tiSetNavBadge("deletions", items.length);

  if (!items.length) { mount.innerHTML = tiEmptyStateHtml(t('deletions_empty'), null, null, 'check'); return; }
  mount.innerHTML = items.map(it => `
    <div class="ti-list-row" style="align-items:flex-start;flex-direction:column;">
      <div style="display:flex;align-items:center;gap:10px;width:100%;">
        <span class="ti-agency-avatar">${it.type === 'property' ? TI_ICONS.home : TI_ICONS.user}</span>
        <div class="ti-list-row-body">
          <strong>${tiEscapeHtml(it.title)}</strong>
          <span class="badge badge-pending">${it.type === 'property' ? t('deletion_type_property') : t('deletion_type_agent')}</span>
          <br>
          <span style="color:var(--ink-soft);font-size:.85rem;">${tiEscapeHtml(it.agencyName)} · ${t('deletion_requested_by')} ${tiEscapeHtml(it.requestedBy || '—')} · ${tiFormatDateTime(it.requestedAt)}</span>
        </div>
      </div>
      <div class="ti-doc-note" style="margin-top:10px;width:100%;"><strong>${t('deletion_reason_label')}</strong> ${tiEscapeHtml(it.reason || '—')}</div>
      <div class="ti-list-row-actions" style="margin-top:10px;">
        <button class="btn btn-outline btn-sm" onclick="tiRejectDeletionRequest('${it.type}','${it.id}')">${TI_ICONS.check} ${t('deletion_reject_action')}</button>
        <button class="btn btn-danger btn-sm" onclick="tiApproveDeletionRequest('${it.type}','${it.id}')">${TI_ICONS.trash} ${t('deletion_approve_action')}</button>
      </div>
    </div>`).join('');
}
/** Litiges de dépôt de garantie en attente d'arbitrage — le locataire a
 *  contesté la répartition proposée par l'agence ; l'administration
 *  tranche avec une décision finale et contraignante. */
async function tiRenderDepositDisputes() {
  const mount = document.getElementById("admin-deposit-disputes-mount");
  if (!mount) return;
  const bookings = await TiDB.getBookings({});
  const disputed = bookings.filter(b => b.rental && b.rental.deposit && b.rental.deposit.escrowStatus === "disputed");
  if (!disputed.length) { mount.innerHTML = ""; return; }
  mount.innerHTML = `
    <h3 style="margin:0 0 4px;">${t('escrow_disputes_title')}</h3>
    <p style="color:var(--ink-soft);font-size:.88rem;margin:0 0 16px;">${t('escrow_disputes_sub')}</p>
    ${disputed.map(b => `
    <div class="ti-list-row" style="align-items:flex-start;flex-direction:column;">
      <div style="display:flex;align-items:center;gap:10px;width:100%;">
        <span class="ti-agency-avatar">${TI_ICONS.wallet || TI_ICONS.home}</span>
        <div class="ti-list-row-body">
          <strong>${tiEscapeHtml(b.propertyTitle)}</strong>
          <span class="badge badge-cancelled">${t('escrow_disputed_badge')}</span>
          <br>
          <span style="color:var(--ink-soft);font-size:.85rem;">${tiEscapeHtml(tiAgencyName(b.agencyId))} · ${tiEscapeHtml(b.name)} · ${t('escrow_deposit_total_label')} <span data-price-xof="${b.rental.deposit.amount}">${tiFormatPrice(b.rental.deposit.amount)}</span></span>
        </div>
      </div>
      <div class="ti-doc-note" style="margin-top:10px;width:100%;">
        <strong>${t('escrow_proposed_split_label')}</strong>
        ${t('escrow_release_label')} <span data-price-xof="${b.rental.deposit.releaseAmount}">${tiFormatPrice(b.rental.deposit.releaseAmount)}</span> ·
        ${t('escrow_claim_label')} <span data-price-xof="${b.rental.deposit.claimAmount}">${tiFormatPrice(b.rental.deposit.claimAmount)}</span>
        ${b.rental.deposit.claimReason ? `<br>${t('escrow_claim_reason_label')} ${tiEscapeHtml(b.rental.deposit.claimReason)}` : ''}
      </div>
      <div class="ti-list-row-actions" style="margin-top:10px;">
        <button class="btn btn-primary btn-sm" onclick="tiOpenDepositResolveModal('${b.id}', ${b.rental.deposit.amount})">${t('escrow_resolve_action')}</button>
      </div>
    </div>`).join('')}
  `;
}
let TI_DEPOSIT_RESOLVE_CTX = null;
function tiOpenDepositResolveModal(bookingId, depositAmount) {
  TI_DEPOSIT_RESOLVE_CTX = { bookingId, depositAmount };
  document.getElementById("deposit-resolve-total").textContent = tiFormatPrice(depositAmount);
  document.getElementById("deposit-resolve-release").value = "";
  document.getElementById("deposit-resolve-claim").value = "";
  document.getElementById("deposit-resolve-note").value = "";
  tiOpenModal("modal-deposit-resolve");
}
async function tiSubmitDepositResolve(e) {
  e.preventDefault();
  const { bookingId, depositAmount } = TI_DEPOSIT_RESOLVE_CTX;
  const release = parseFloat(document.getElementById("deposit-resolve-release").value) || 0;
  const claim = parseFloat(document.getElementById("deposit-resolve-claim").value) || 0;
  if (release + claim !== depositAmount) {
    tiToast(t('escrow_amounts_must_sum_error'));
    return false;
  }
  const note = document.getElementById("deposit-resolve-note").value.trim();
  const btn = e.target.querySelector("button[type=submit]");
  tiSetBtnLoading(btn, true);
  await TiDB.resolveDepositDispute(bookingId, release, claim, note);
  tiSetBtnLoading(btn, false);
  tiCloseModal("modal-deposit-resolve");
  tiToast(t('escrow_resolved_toast'));
  await tiRenderDepositDisputes();
  return false;
}
async function tiApproveDeletionRequest(type, id) {
  if (!confirm(t('confirm_approve_deletion'))) return;
  if (type === "property") await TiDB.approvePropertyDeletion(id, TI_SESSION.name);
  else await TiDB.approveAgentDeletion(id, TI_SESSION.name);
  tiLogAdminAction(type === "property" ? "property_deletion_approved" : "agent_deletion_approved", type, id, id);
  tiToast(t('deletion_approved_toast') + " ✓");
  await tiRenderDeletionRequests();
}
async function tiRejectDeletionRequest(type, id) {
  if (type === "property") await TiDB.rejectPropertyDeletion(id, TI_SESSION.name);
  else await TiDB.rejectAgentDeletion(id, TI_SESSION.name);
  tiLogAdminAction(type === "property" ? "property_deletion_rejected" : "agent_deletion_rejected", type, id, id);
  tiToast(t('deletion_rejected_toast') + " ✓");
  await tiRenderDeletionRequests();
}

async function tiRenderModeration() {
  const reviews = await TiDB.getAllReviews();
  const props = await TiDB.getProperties();
  tiRenderReviewInsights("moderation-insight-mount", reviews);
  const mount = document.getElementById("moderation-mount");
  mount.innerHTML = reviews.length ? reviews.map(r => {
    const prop = props.find(p => p.id === r.propertyId);
    return `<div class="ti-review">
      <div class="ti-review-head">
        <span>${prop ? tiPropertyTitle(prop) : ''} — ${tiEscapeHtml(r.userName)}</span>
        ${tiStarsHtml(r.rating)}
      </div>
      ${tiReviewTagsHtml(r.tags)}
      ${r.comment ? `<p style="margin:6px 0;color:var(--ink-soft);">${tiEscapeHtml(r.comment)}</p>` : ''}
      <div style="display:flex;gap:8px;align-items:center;">
        ${r.approved !== false ? '<span class="badge badge-confirmed">Publié</span>' : '<span class="badge badge-cancelled">Masqué</span>'}
        <button class="btn btn-sm btn-outline" onclick="tiModerate('${r.id}', ${r.approved === false})">${r.approved === false ? t('action_approve') : t('action_reject')}</button>
      </div>
    </div>`;
  }).join('') : `<p style="color:var(--ink-soft)">—</p>`;
}
async function tiModerate(id, approve) {
  await TiDB.moderateReview(id, approve);
  tiToast((approve ? t('action_approve') : t('action_reject')) + " ✓");
  tiLogAdminAction(approve ? "review_approved" : "review_rejected", "review", id, "");
  await tiRefreshPanel("moderation");
}

let TI_ADMIN_AUDIT_CACHE = [];
/* ---------- Notifications push (diffusion admin) ---------- */
/* ---------- Rapports (prêts à imprimer, exportables via Imprimer → PDF du navigateur) ---------- */
const TI_REPORT_PERIOD_DAYS = { week: 7, month: 30, quarter: 90, year: 365 };
/* ---------- Résumé intelligent de rapport (récit basé sur les données, pas un appel LLM en direct) ---------- */
function tiGenerateAdminReportInsight(d) {
  const lang = tiGetLang();
  const parts = [];

  parts.push(lang === "en"
    ? `The platform now has ${d.userCount} users across ${d.agencyCount} agencies, generating ${tiFormatPrice(d.mrr)} in monthly recurring revenue.`
    : `La plateforme compte désormais ${d.userCount} utilisateurs répartis sur ${d.agencyCount} agences, pour un revenu mensuel récurrent de ${tiFormatPrice(d.mrr)}.`);

  parts.push(d.collectedInPeriod > 0
    ? (lang === "en"
        ? `${tiFormatPrice(d.collectedInPeriod)} was actually collected from agency subscriptions during this period.`
        : `${tiFormatPrice(d.collectedInPeriod)} ont été réellement encaissés en abonnements agences durant cette période.`)
    : (lang === "en"
        ? `No subscription payments were collected during this period.`
        : `Aucun paiement d'abonnement n'a été encaissé durant cette période.`));

  if (d.pastDueAgencies.length) {
    parts.push(lang === "en"
      ? `${d.pastDueAgencies.length} agenc${d.pastDueAgencies.length > 1 ? "ies are" : "y is"} past due on payment: ${d.pastDueAgencies.join(", ")}.`
      : `${d.pastDueAgencies.length} agence${d.pastDueAgencies.length > 1 ? "s sont" : " est"} en retard de paiement : ${d.pastDueAgencies.join(", ")}.`);
  } else {
    parts.push(lang === "en" ? `All agencies are current on their subscription payments.` : `Toutes les agences sont à jour de leur abonnement.`);
  }

  if (d.topType) {
    parts.push(lang === "en"
      ? `${d.topType.label} listings make up the largest share of the catalog (${d.topType.count} of ${d.propCount}).`
      : `Les biens de type ${d.topType.label} représentent la plus grande part du catalogue (${d.topType.count} sur ${d.propCount}).`);
  }

  return parts.join(" ");
}

async function tiGenerateAdminReport() {
  const periodKey = document.getElementById("admin-report-period").value;
  const days = TI_REPORT_PERIOD_DAYS[periodKey];
  const since = new Date(); since.setDate(since.getDate() - days);

  const users = await TiDB.getUsers();
  const agencies = await TiDB.getAgencies();
  const props = await TiDB.getProperties();
  const bookings = await TiDB.getBookings();
  const totalViews = props.reduce((s, p) => s + (p.views || 0), 0);

  const subsData = await Promise.all(agencies.map(async agency => {
    const sub = await TiDB.getAgencySubscription(agency.id);
    const invoices = await TiDB.getAgencyInvoices(agency.id);
    return { agency, sub, invoices };
  }));
  const mrr = subsData.filter(s => s.sub.status !== "trial").reduce((sum, s) => sum + s.sub.monthlyFee, 0);
  let collectedInPeriod = 0;
  const invoicesInPeriod = [];
  subsData.forEach(({ agency, invoices }) => invoices.forEach(inv => {
    if (inv.status === "paid" && inv.paidAt && new Date(inv.paidAt) >= since) {
      collectedInPeriod += inv.amount;
      invoicesInPeriod.push({ agency: agency.name, period: inv.period, amount: inv.amount, paidAt: inv.paidAt });
    }
  }));
  invoicesInPeriod.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

  const byType = {
    apartment: props.filter(p => p.type === "apartment").length,
    house: props.filter(p => p.type === "house").length,
    office: props.filter(p => p.type === "office").length,
    land: props.filter(p => p.type === "land").length,
  };
  const agencyRows = subsData.map(({ agency, sub }) => {
    const tier = TI_AGENCY_TIERS.find(t2 => t2.id === sub.tierId);
    const listingCount = props.filter(p => p.agencyId === agency.id).length;
    return { name: agency.name, tier: tier ? (tiGetLang() === 'en' ? tier.labelEn : tier.label) : sub.tierId, status: sub.status, listingCount, fee: sub.monthlyFee };
  }).sort((a, b) => b.listingCount - a.listingCount);

  const periodLabel = t("period_" + periodKey);
  const generatedAt = tiFormatDateTime(new Date().toISOString());
  const typeLabels = { apartment: t("type_apartment"), house: t("type_house"), office: t("type_office"), land: t("type_land") };
  const topTypeKey = Object.keys(byType).reduce((a, b) => byType[a] >= byType[b] ? a : b);
  const insightMetrics = {
    userCount: users.length, agencyCount: agencies.length, mrr, collectedInPeriod, totalViews,
    pastDueAgencies: agencyRows.filter(a => a.status === "past_due").map(a => a.name),
    topType: byType[topTypeKey] > 0 ? { label: typeLabels[topTypeKey], count: byType[topTypeKey] } : null,
    propCount: props.length,
  };
  const insightText = await tiGetReportInsight(
    { type: "platform_overview", period: periodKey, metrics: insightMetrics, lang: tiGetLang() },
    () => tiGenerateAdminReportInsight(insightMetrics)
  );

  const reportHtml = `
    <div class="ti-report">
      <div class="ti-report-letterhead">
        <div>
          <div class="ti-report-brand"><img src="assets/brand/timmo-logo-primary.svg" alt="Timmo" class="ti-report-brand-logo"></div>
          <h2>${t('report_title_platform')}</h2>
          <p>${periodLabel}</p>
        </div>
        <div class="ti-report-meta">${t('report_generated_on')} ${generatedAt}</div>
      </div>

      <div class="ti-report-insight">
        <span class="ti-report-insight-icon">${TI_ICONS.sparkle}</span>
        <div>
          <div class="ti-report-insight-label">${t('report_smart_summary')}</div>
          <p>${insightText}</p>
        </div>
      </div>

      <div class="ti-report-kpi-grid">
        <div class="ti-report-kpi"><b>${users.length}</b><span>${t('dash_admin_users')}</span></div>
        <div class="ti-report-kpi"><b>${agencies.length}</b><span>${t('dash_admin_agencies')}</span></div>
        <div class="ti-report-kpi"><b>${props.length}</b><span>${t('dash_admin_listings')}</span></div>
        <div class="ti-report-kpi"><b data-price-xof="${mrr}">${tiFormatPrice(mrr)}</b><span>${t('mrr_label')}</span></div>
        <div class="ti-report-kpi"><b data-price-xof="${collectedInPeriod}">${tiFormatPrice(collectedInPeriod)}</b><span>${t('report_revenue_collected')}</span></div>
        <div class="ti-report-kpi"><b>${totalViews}</b><span>${t('stat_total_views')}</span></div>
      </div>

      <h3>${t('report_agencies_breakdown')}</h3>
      <table class="ti-report-table">
        <thead><tr><th>${t('agency_name')}</th><th>${t('agency_tier_section')}</th><th>${t('sub_status_label')}</th><th>${t('dash_admin_listings')}</th><th>${t('monthly_payment_label')}</th></tr></thead>
        <tbody>
          ${agencyRows.map(a => `<tr><td>${tiEscapeHtml(a.name)}</td><td>${a.tier}</td><td>${tiSubscriptionStatusBadge(a.status)}</td><td>${a.listingCount}</td><td data-price-xof="${a.fee}">${tiFormatPrice(a.fee)}</td></tr>`).join('') || `<tr><td colspan="5">${t('no_data')}</td></tr>`}
        </tbody>
      </table>

      <h3>${t('report_listings_by_type')}</h3>
      <table class="ti-report-table">
        <thead><tr><th>${t('report_status')}</th><th>${t('report_count')}</th></tr></thead>
        <tbody>
          <tr><td>${t('type_apartment')}</td><td>${byType.apartment}</td></tr>
          <tr><td>${t('type_house')}</td><td>${byType.house}</td></tr>
          <tr><td>${t('type_office')}</td><td>${byType.office}</td></tr>
          <tr><td>${t('type_land')}</td><td>${byType.land}</td></tr>
        </tbody>
      </table>

      <h3>${t('report_subscription_payments')}</h3>
      <table class="ti-report-table">
        <thead><tr><th>${t('report_date')}</th><th>${t('agency_name')}</th><th>${t('period_label')}</th><th>${t('pay_amount')}</th></tr></thead>
        <tbody>
          ${invoicesInPeriod.length ? invoicesInPeriod.map(inv => `<tr><td>${tiFormatDateTime(inv.paidAt)}</td><td>${inv.agency}</td><td>${tiFormatMonth(inv.period + '-01')}</td><td data-price-xof="${inv.amount}">${tiFormatPrice(inv.amount)}</td></tr>`).join('') : `<tr><td colspan="4">${t('no_data')}</td></tr>`}
        </tbody>
      </table>

      <div class="ti-report-footer">${t('report_confidential_note')} — ${t('report_generated_by')} Timmo</div>
    </div>`;
  document.getElementById("admin-report-mount").innerHTML = reportHtml;
  document.getElementById("ti-print-root").innerHTML = reportHtml;
  document.getElementById("admin-report-print-btn").style.display = "";
  document.getElementById("admin-report-mount").scrollIntoView({ behavior: "smooth", block: "start" });
}

const TI_BROADCAST_TEMPLATES = [
  { id: "maintenance", title: "Maintenance planifiée", titleEn: "Scheduled maintenance",
    message: "La plateforme sera brièvement indisponible ce week-end pour une opération de maintenance.",
    messageEn: "The platform will be briefly unavailable this weekend for scheduled maintenance." },
  { id: "feature", title: "Nouvelle fonctionnalité", titleEn: "New feature",
    message: "Découvrez les nouveautés que nous venons d'ajouter à votre espace.",
    messageEn: "Check out what's new in your workspace." },
  { id: "welcome", title: "Bienvenue sur Timmo", titleEn: "Welcome to Timmo",
    message: "Merci de nous avoir rejoint ! N'hésitez pas à explorer votre espace.",
    messageEn: "Thanks for joining us! Feel free to explore your workspace." },
  { id: "terms", title: "Mise à jour des conditions d'utilisation", titleEn: "Terms of service updated",
    message: "Nos conditions d'utilisation ont été mises à jour. Merci de les consulter.",
    messageEn: "Our terms of service have been updated. Please take a moment to review them." },
  { id: "payment_reminder", title: "Rappel de paiement", titleEn: "Payment reminder",
    message: "Un rappel amical : merci de vérifier vos échéances de paiement en cours.",
    messageEn: "A friendly reminder to check your current payment due dates." },
];

function tiPopulateBroadcastTemplates() {
  const sel = document.getElementById("bc-template");
  if (!sel) return;
  sel.innerHTML = `<option value="">${t('broadcast_template_blank')}</option>` +
    TI_BROADCAST_TEMPLATES.map(tpl => `<option value="${tpl.id}">${tiGetLang() === 'en' ? tpl.titleEn : tpl.title}</option>`).join('');
}
function tiApplyBroadcastTemplate() {
  const id = document.getElementById("bc-template").value;
  const tpl = TI_BROADCAST_TEMPLATES.find(t2 => t2.id === id);
  if (!tpl) return;
  document.getElementById("bc-title").value = tiGetLang() === 'en' ? tpl.titleEn : tpl.title;
  document.getElementById("bc-message").value = tiGetLang() === 'en' ? tpl.messageEn : tpl.message;
}
async function tiPopulateBroadcastAgencySelect() {
  const sel = document.getElementById("bc-agency-select");
  if (!sel) return;
  const agencies = await TiDB.getAgencies();
  sel.innerHTML = agencies.map(a => `<option value="agency:${a.id}">${tiEscapeHtml(a.name)}</option>`).join('');
}
function tiToggleBroadcastAgencySelect() {
  const audience = document.getElementById("bc-audience").value;
  document.getElementById("bc-agency-field").style.display = audience === "agency" ? "" : "none";
}
async function tiSubmitBroadcast(e) {
  e.preventDefault();
  const editId = document.getElementById("bc-edit-id").value;
  const title = document.getElementById("bc-title").value.trim();
  const message = document.getElementById("bc-message").value.trim();
  if (editId) {
    await TiDB.editBroadcast(editId, { title, message });
    tiToast(t("broadcast_updated") + " ✓");
    tiLogAdminAction("broadcast_edited", "broadcast", editId, title);
  } else {
    const audienceRaw = document.getElementById("bc-audience").value;
    const audience = audienceRaw === "agency" ? document.getElementById("bc-agency-select").value : audienceRaw;
    if (audience === "agency:") { tiToast(t("broadcast_pick_agency")); return false; }
    const result = await TiDB.broadcastNotification({ title, message, audience, adminId: TI_SESSION.id, adminName: TI_SESSION.name });
    tiToast(`${t("broadcast_sent")} (${result.recipientCount})`);
    tiLogAdminAction("broadcast_sent", "broadcast", result.id, title, `${audience} · ${result.recipientCount}`);
  }
  await tiRefreshPanel("broadcasts");
  return false;
}
function tiAudienceLabel(audience) {
  if (audience === "all") return t("audience_all");
  if (audience === "clients") return t("audience_clients");
  if (audience === "agencies") return t("audience_agencies");
  if (audience === "admins") return t("audience_admins");
  if (audience && audience.startsWith("agency:")) return t("audience_one_agency");
  return audience;
}
async function tiRenderBroadcastLog() {
  tiPopulateBroadcastTemplates();
  await tiPopulateBroadcastAgencySelect();
  const mount = document.getElementById("broadcast-log-mount");
  if (!mount) return;
  const broadcasts = await TiDB.getBroadcasts();
  mount.innerHTML = broadcasts.length ? broadcasts.map(b => `
    <div class="ti-list-row" style="align-items:flex-start;">
      <span class="ti-notif-broadcast-icon">${TI_ICONS.bell}</span>
      <div class="ti-list-row-body">
        <strong>${b.title}</strong> <span class="badge badge-review">${tiAudienceLabel(b.audience)}</span>
        <br><span style="color:var(--ink-soft);font-size:.85rem;">${b.message}</span>
        <br><span style="color:var(--ink-soft);font-size:.78rem;">${tiFormatDateTime(b.createdAt)} · ${b.recipientCount} ${t('broadcast_recipients')}${b.editedAt ? ' · ' + t('broadcast_edited_label') : ''}</span>
      </div>
      <div class="ti-list-row-actions">
        <button class="btn btn-outline btn-sm" onclick="tiEditBroadcast('${b.id}')">${t('action_edit')}</button>
        <button class="btn btn-danger btn-sm" onclick="tiDeleteBroadcast('${b.id}')">${t('action_delete')}</button>
      </div>
    </div>`).join('') : tiEmptyStateHtml(t('broadcast_log_empty'), null, null, 'bell');
}
async function tiEditBroadcast(id) {
  const broadcasts = await TiDB.getBroadcasts();
  const b = broadcasts.find(b => b.id === id);
  if (!b) return;
  document.getElementById("bc-edit-id").value = b.id;
  document.getElementById("bc-title").value = b.title;
  document.getElementById("bc-message").value = b.message;
  document.getElementById("bc-template").value = "";
  document.getElementById("bc-submit-btn").textContent = t("broadcast_save_edit");
  document.querySelector(".ti-broadcast-form").scrollIntoView({ behavior: "smooth", block: "center" });
}
async function tiDeleteBroadcast(id) {
  if (!confirm(t("confirm_delete_broadcast"))) return;
  await TiDB.deleteBroadcast(id);
  tiToast(t("action_delete") + " ✓");
  tiLogAdminAction("broadcast_deleted", "broadcast", id, "");
  await tiRefreshPanel("broadcasts");
}

async function tiRenderAdminAudit() {
  const mount = document.getElementById("admin-audit-mount");
  if (!mount) return;
  const [log, agencies] = await Promise.all([TiDB.getAuditLog(), TiDB.getAgencies()]);
  TI_ADMIN_AUDIT_CACHE = log;

  const agencyFilter = document.getElementById("audit-agency-filter");
  const currentAgencyVal = agencyFilter.value;
  agencyFilter.innerHTML = `<option value="">${t('all_agencies')}</option>` +
    agencies.map(a => `<option value="${a.id}">${tiEscapeHtml(a.name)}</option>`).join('');
  agencyFilter.value = currentAgencyVal;

  tiApplyAdminAuditFilter();
}

let TI_ADMIN_AUDIT_STATE = { period: "week", page: 1 };
function tiSetAdminAuditView(period, page) {
  if (period) TI_ADMIN_AUDIT_STATE.period = period;
  if (page) TI_ADMIN_AUDIT_STATE.page = page;
  tiApplyAdminAuditFilter();
}
function tiApplyAdminAuditFilter() {
  const role = document.getElementById("audit-role-filter").value;
  const agencyId = document.getElementById("audit-agency-filter").value;
  let list = TI_ADMIN_AUDIT_CACHE;
  if (role) list = list.filter(l => l.actorRole === role);
  if (agencyId) list = list.filter(l => l.agencyId === agencyId);
  tiRenderAuditTimeline("admin-audit-mount", list, TI_ADMIN_AUDIT_STATE, "tiSetAdminAuditView");
}

async function tiInitAdminDashboard() {
  tiRenderHeader();
  tiRenderFooter();
  document.getElementById("overview-mount").innerHTML = tiSkeletonStatCardsHtml(4);
  document.getElementById("platform-trend-chart-mount").innerHTML = `<div class="ti-skel-block ti-shimmer" style="height:160px;"></div>`;
  document.getElementById("agencies-trend-chart-mount").innerHTML = `<div class="ti-skel-block ti-shimmer" style="height:160px;"></div>`;
  document.getElementById("localities-chart-mount").innerHTML = tiSkeletonChartCardHtml();
  document.getElementById("overview-charts-mount").innerHTML = tiSkeletonChartCardHtml() + tiSkeletonChartCardHtml();
  document.getElementById("dash-name").textContent = TI_SESSION.name;
  await new Promise(r => setTimeout(r, 350));
  await Promise.all([tiRenderOverview(), tiRenderUsers(), tiRenderAgencies(), tiRenderAdminListings(), tiRenderAmenityCatalog(), tiRenderAdminPayments(), tiRenderDepositDisputes(), tiRenderModeration(), tiRenderDeletionRequests(), tiRenderAdminAudit(), tiRenderBroadcastLog(), tiRenderFavorites()]);
  tiApplyPanelFromUrl(["overview", "users", "agencies", "listings", "amenities", "payments", "moderation", "deletions", "audit", "broadcasts", "reports", "favorites"]);
}
if (TI_SESSION) tiInitAdminDashboard();
