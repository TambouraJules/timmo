/* ============================================================
   Timmo — tableau de bord agence
   ============================================================ */

const TI_SESSION = tiRequireRole("agency");
let TI_EDITING_PROPERTY = null;

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
 *  tiReloadDashboard() qui rechargeait toute la page.
 *  Remarque : tiRenderClientsPipeline() réutilise le cache
 *  TI_AGENCY_ALL_BOOKINGS rempli par tiRenderAgencyBookings(), donc chaque
 *  fois que les deux sont nécessaires, cette récupération doit se terminer
 *  d'abord — ne jamais les lancer en parallèle via Promise.all. */
async function tiRefreshPanel(panelName) {
  const isSupervisor = TI_SESSION.agentRole === "supervisor";
  if (panelName === "listings") {
    await Promise.all([tiRenderAgencyListings(), tiRenderStats()]);
  } else if (panelName === "agents") {
    if (isSupervisor) await tiRenderAgents();
  } else if (panelName === "audit") {
    if (isSupervisor) await tiRenderAudit();
  } else if (panelName === "bookings" || panelName === "clients") {
    await tiRenderAgencyBookings();
    await Promise.all([tiRenderClientsPipeline(), tiRenderStats()]);
  } else if (panelName === "reviews") {
    await tiRenderAgencyReviews();
  } else if (panelName === "messages") {
    await tiRenderAgencyMessages();
  } else if (panelName === "favorites") {
    await tiRenderFavorites();
  }
}

function tiStatusBadge(status) {
  const map = { pending: "status_pending", confirmed: "status_confirmed", cancelled: "status_cancelled", paid: "status_paid" };
  return `<span class="badge badge-${status}">${t(map[status] || status)}</span>`;
}

async function tiAgencyProperties() {
  const all = await TiDB.getProperties();
  let props = all.filter(p => p.agencyId === TI_SESSION.agencyId);
  if (TI_SESSION.agentRole === "agent") props = props.filter(p => p.assignedAgentId === TI_SESSION.id);
  return props;
}

let TI_AGENTS_CACHE = [];
async function tiLoadAgentsCache() {
  TI_AGENTS_CACHE = TI_SESSION.agentRole === "supervisor" ? await TiDB.getAgents(TI_SESSION.agencyId) : [];
  return TI_AGENTS_CACHE;
}
function tiAgentName(agentId) {
  if (!agentId) return t("unassigned");
  const a = TI_AGENTS_CACHE.find(a => a.id === agentId);
  return a ? a.name : t("unassigned");
}

const TI_TREND_PERIODS = {
  "7d": { key: "7d", labelKey: "period_week", count: 7, unit: "day" },
  "30d": { key: "30d", labelKey: "period_month", count: 30, unit: "day" },
  "6m": { key: "6m", labelKey: "period_semester", count: 6, unit: "month" },
  "12m": { key: "12m", labelKey: "period_year", count: 12, unit: "month" },
};
let TI_STATS_TOTAL_VIEWS = 0;
let TI_VIEWS_TREND_PERIOD = "7d";

function tiRenderViewsTrendChart() {
  const cfg = TI_TREND_PERIODS[TI_VIEWS_TREND_PERIOD];
  document.getElementById("views-trend-title").textContent = `${t('chart_views_trend_title')} — ${t(cfg.labelKey)}`;
  document.getElementById("views-period-tabs").innerHTML = Object.values(TI_TREND_PERIODS).map(p => `
    <button class="ti-period-tab ${p.key === TI_VIEWS_TREND_PERIOD ? 'active' : ''}" onclick="tiSwitchViewsTrendPeriod('${p.key}', this)">${t(p.labelKey)}</button>`).join("");

  const labels = Array.from({ length: cfg.count }, (_, i) => {
    const d = new Date();
    if (cfg.unit === "day") d.setDate(d.getDate() - (cfg.count - 1 - i));
    else d.setMonth(d.getMonth() - (cfg.count - 1 - i));
    return d.toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", cfg.unit === "day" ? { day: "2-digit", month: "2-digit" } : { month: "short" });
  });
  const seedBase = TI_SESSION.agencyId + TI_VIEWS_TREND_PERIOD;
  const current = tiSyntheticDailySeries(TI_STATS_TOTAL_VIEWS, cfg.count, seedBase);
  const prevRatioPct = tiSeededDeltaPct(seedBase + "prevratio", 22); // e.g. previous period was ±22% of current
  const prevTotal = Math.max(Math.round(TI_STATS_TOTAL_VIEWS * (1 - prevRatioPct / 100)), 0);
  const previous = tiSyntheticDailySeries(prevTotal, cfg.count, seedBase + "prev");

  document.getElementById("views-trend-chart-mount").innerHTML = tiLineChartSvg(labels, current, v => v, previous);
}
function tiSwitchViewsTrendPeriod(period) {
  TI_VIEWS_TREND_PERIOD = period;
  tiRenderViewsTrendChart();
}

let TI_PROPERTIES_TREND_PERIOD = "30d";
let TI_STATS_PROPS_CACHE = [];
function tiRenderPropertiesTrendChart() {
  const cfg = TI_TREND_PERIODS[TI_PROPERTIES_TREND_PERIOD];
  document.getElementById("properties-trend-title").textContent = `${t('chart_properties_trend_title')} — ${t(cfg.labelKey)}`;
  document.getElementById("properties-period-tabs").innerHTML = Object.values(TI_TREND_PERIODS).map(p => `
    <button class="ti-period-tab ${p.key === TI_PROPERTIES_TREND_PERIOD ? 'active' : ''}" onclick="tiSwitchPropertiesTrendPeriod('${p.key}')">${t(p.labelKey)}</button>`).join("");

  const labels = [];
  const buckets = [];
  for (let i = cfg.count - 1; i >= 0; i--) {
    const d = new Date();
    if (cfg.unit === "day") d.setDate(d.getDate() - i); else d.setMonth(d.getMonth() - i);
    labels.push(d.toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", cfg.unit === "day" ? { day: "2-digit", month: "2-digit" } : { month: "short" }));
    buckets.push(d);
  }
  // Vrais décomptes à partir du createdAt réel de chaque bien — pas synthétiques,
  // puisque ce sont des données que la plateforme possède réellement.
  const counts = buckets.map(bucketDate => TI_STATS_PROPS_CACHE.filter(p => {
    if (!p.createdAt) return false;
    const created = new Date(p.createdAt);
    if (cfg.unit === "day") return created.toDateString() === bucketDate.toDateString();
    return created.getFullYear() === bucketDate.getFullYear() && created.getMonth() === bucketDate.getMonth();
  }).length);

  document.getElementById("properties-trend-chart-mount").innerHTML = tiLineChartSvg(labels, counts, v => v);
}
function tiSwitchPropertiesTrendPeriod(period) {
  TI_PROPERTIES_TREND_PERIOD = period;
  tiRenderPropertiesTrendChart();
}
function tiRenderPropertiesLocalityChart() {
  const counts = {};
  TI_STATS_PROPS_CACHE.forEach(p => {
    const name = tiNeighborhoodName(p.neighborhood) || p.neighborhood;
    counts[name] = (counts[name] || 0) + 1;
  });
  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([label, value]) => ({ label, value, color: "var(--clay)" }));
  document.getElementById("properties-locality-chart-mount").innerHTML = tiBarChartHtml(t('chart_properties_locality_title'), items);
}

async function tiRenderStats() {
  const props = await tiAgencyProperties();
  TI_STATS_PROPS_CACHE = props;
  tiRenderPropertiesTrendChart();
  tiRenderPropertiesLocalityChart();
  let bookings = await TiDB.getBookings({ agencyId: TI_SESSION.agencyId });
  if (TI_SESSION.agentRole === "agent") {
    const myPropIds = new Set(props.map(p => p.id));
    bookings = bookings.filter(b => myPropIds.has(b.propertyId));
  }
  const reviews = (await TiDB.getAllReviews()).filter(r => props.some(p => p.id === r.propertyId));
  const avgRating = props.length ? (props.reduce((s, p) => s + p.rating, 0) / props.length).toFixed(1) : "—";
  const pendingCount = props.filter(p => p.listingStatus === "pending").length;
  const availableCount = props.filter(p => p.listingStatus === "active").length;
  const rentedSoldCount = props.filter(p => p.listingStatus === "rented" || p.listingStatus === "sold").length;
  const totalViews = props.reduce((s, p) => s + (p.views || 0), 0);
  TI_STATS_TOTAL_VIEWS = totalViews;
  tiRenderViewsTrendChart();
  const overdueCount = bookings.reduce((sum, b) => {
    if (!b.rental) return sum;
    return sum + b.rental.schedule.filter(item => item.status === "pending" && item.dueDate < tiTodayIsoA()).length;
  }, 0);
  document.getElementById("stats-mount").innerHTML = `
    <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.home}</span><b>${props.length}</b>${tiTrendBadgeHtml(tiSeededDeltaPct(TI_SESSION.agencyId + 'listings', 12))}<span data-i18n="dash_agency_listings">${t('dash_agency_listings')}</span></div>
    <div class="ti-stat-card ti-stat-card-featured"><span class="ti-stat-icon">${TI_ICONS.grid}</span><b>${bookings.length}</b>${tiTrendBadgeHtml(tiSeededDeltaPct(TI_SESSION.agencyId + 'bookings', 20))}<span data-i18n="dash_agency_bookings">${t('dash_agency_bookings')}</span></div>
    <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.star}</span><b>${reviews.length}</b><span data-i18n="dash_agency_reviews">${t('dash_agency_reviews')}</span></div>
    <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.star}</span><b>${avgRating}</b><span>★ ${t('sort_rating')}</span></div>
    <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.document}</span><b>${pendingCount}</b><span>${t('stat_pending_validation')}</span></div>
    <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.check}</span><b>${availableCount}</b><span>${t('stat_available')}</span></div>
    <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.shield}</span><b>${rentedSoldCount}</b><span>${t('stat_rented_sold')}</span></div>
    <div class="ti-stat-card ti-stat-card-featured"><span class="ti-stat-icon">${TI_ICONS.eye}</span><b>${totalViews}</b>${tiTrendBadgeHtml(tiSeededDeltaPct(TI_SESSION.agencyId + 'views', 25))}<span>${t('stat_total_views')}</span></div>
    <div class="ti-stat-card${overdueCount ? ' ti-stat-card-danger' : ''}"><span class="ti-stat-icon">${TI_ICONS.document}</span><b>${overdueCount}</b><span>${t('stat_overdue_payments')}</span></div>
  `;
  tiRenderCharts(props, bookings, totalViews);
}

function tiRenderCharts(props, bookings, totalViews) {
  const byType = {
    apartment: props.filter(p => p.type === "apartment").length,
    house: props.filter(p => p.type === "house").length,
    office: props.filter(p => p.type === "office").length,
    land: props.filter(p => p.type === "land").length,
  };
  const byStatus = {
    pending: bookings.filter(b => b.status === "pending").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
  };
  const byListingStatus = {
    pending: props.filter(p => p.listingStatus === "pending").length,
    active: props.filter(p => p.listingStatus === "active").length,
    rentedSold: props.filter(p => p.listingStatus === "rented" || p.listingStatus === "sold").length,
    rejected: props.filter(p => p.listingStatus === "rejected").length,
  };
  const topVisited = [...props].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6)
    .map(p => ({ label: tiPropertyTitle(p), value: p.views || 0, color: "var(--clay)" }));

  document.getElementById("charts-mount").innerHTML =
    tiBarChartHtml(t("chart_visits"), topVisited) +
    tiPieChartHtml(t("chart_listing_status"), [
      { label: t("listing_status_pending"), value: byListingStatus.pending, color: "var(--gold)" },
      { label: t("listing_status_active"), value: byListingStatus.active, color: "var(--ok)" },
      { label: t("stat_rented_sold"), value: byListingStatus.rentedSold, color: "var(--deep)" },
      { label: t("listing_status_rejected"), value: byListingStatus.rejected, color: "var(--danger)" },
    ]) +
    tiPieChartHtml(t("chart_by_type"), [
      { label: t("type_apartment"), value: byType.apartment, color: "var(--clay)" },
      { label: t("type_house"), value: byType.house, color: "var(--deep)" },
      { label: t("type_office"), value: byType.office, color: "var(--gold)" },
      { label: t("type_land"), value: byType.land, color: "var(--ok)" },
    ]) +
    tiPieChartHtml(t("chart_by_status"), [
      { label: t("status_pending"), value: byStatus.pending, color: "var(--gold)" },
      { label: t("status_confirmed"), value: byStatus.confirmed, color: "var(--ok)" },
      { label: t("status_cancelled"), value: byStatus.cancelled, color: "var(--danger)" },
    ]);
}

let TI_AGENCY_ALL_PROPS = [];
const TI_AGENCY_LISTINGS_FILTER = {};
let tiAgencyFilterDebounce = null;

function tiRenderAgencyListingsFilterBar() {
  const mount = document.getElementById("agency-listings-filters");
  const hoods = [...new Set(TI_AGENCY_ALL_PROPS.map(p => p.neighborhood).filter(Boolean))]
    .map(id => ({ id, name: tiNeighborhoodName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  mount.innerHTML = `
    <div class="ti-admin-filter-bar">
      <div class="ti-filter-search">
        <span class="ti-filter-search-icon">${TI_ICONS.search}</span>
        <input type="text" id="ml-search" placeholder="${t('filter_search_title')}">
      </div>
      <select id="ml-hood">
        <option value="">${t('filter_all_neighborhoods')}</option>
        ${hoods.map(n => `<option value="${n.id}">${tiEscapeHtml(n.name)}</option>`).join('')}
      </select>
      <select id="ml-status">
        ${tiPropertyStateOptionsHtml()}
      </select>
      <input type="number" id="ml-min-price" placeholder="${t('filter_min_price')}">
      <input type="number" id="ml-max-price" placeholder="${t('filter_max_price')}">
      <button class="ti-filter-reset" id="ml-reset" onclick="tiResetAgencyListingsFilter()">${t('filter_reset')}</button>
    </div>
    <div class="ti-filter-results-count" id="ml-results-count"></div>`;

  const debounced = () => { clearTimeout(tiAgencyFilterDebounce); tiAgencyFilterDebounce = setTimeout(tiApplyAgencyListingsFilter, 300); };
  document.getElementById("ml-search").addEventListener("input", debounced);
  document.getElementById("ml-min-price").addEventListener("input", debounced);
  document.getElementById("ml-max-price").addEventListener("input", debounced);
  document.getElementById("ml-hood").addEventListener("change", tiApplyAgencyListingsFilter);
  document.getElementById("ml-status").addEventListener("change", tiApplyAgencyListingsFilter);
}

function tiResetAgencyListingsFilter() {
  document.getElementById("ml-search").value = "";
  document.getElementById("ml-hood").value = "";
  document.getElementById("ml-status").value = "";
  document.getElementById("ml-min-price").value = "";
  document.getElementById("ml-max-price").value = "";
  tiApplyAgencyListingsFilter();
}

async function tiSetListingStatus(id, status) {
  const slProp = TI_AGENCY_ALL_PROPS.find(p => p.id === id);
  tiLogAgencyAction("listing_status_changed", "property", id, slProp ? tiPropertyTitle(slProp) : id, status);
  await TiDB.setListingStatus(id, status);
  tiToast(t('save_changes') + " ✓");
  await tiRefreshPanel("listings");
}

function tiApplyAgencyListingsFilter() {
  const q = document.getElementById("ml-search").value.trim().toLowerCase();
  const hood = document.getElementById("ml-hood").value;
  const state = document.getElementById("ml-status").value;
  const minPrice = document.getElementById("ml-min-price").value;
  const maxPrice = document.getElementById("ml-max-price").value;

  let list = [...TI_AGENCY_ALL_PROPS];
  if (q) list = list.filter(p => tiPropertyTitle(p).toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q));
  if (hood) list = list.filter(p => p.neighborhood === hood);
  if (state) list = list.filter(p => tiPropertyStateValue(p) === state);
  if (minPrice !== "") list = list.filter(p => p.price >= parseFloat(minPrice));
  if (maxPrice !== "") list = list.filter(p => p.price <= parseFloat(maxPrice));

  document.getElementById("ml-results-count").textContent = `${list.length} ${t('filter_results')}`;
  const emptyHtml = TI_AGENCY_ALL_PROPS.length === 0
    ? `<div class="ti-empty-state"><span class="ti-empty-state-icon">${TI_ICONS.home}</span><p>${t('empty_listings')}</p><button class="btn btn-outline btn-sm" onclick="tiShowPanel('new')">${t('dash_agency_new')}</button></div>`
    : `<p style="color:var(--ink-soft)">${t('filter_no_results')}</p>`;
  document.getElementById("listings-mount").innerHTML = list.length ? list.map(p => `
    <div class="ti-list-row">
      <img src="${p.cover}" alt="">
      <div class="ti-list-row-body">
        <strong>${tiPropertyTitle(p)}</strong> ${tiListingStatusBadge(p.listingStatus)} ${tiPaymentStatusBadge(p.id)} ${p.deletionStatus === 'pending' ? `<span class="badge badge-cancelled">${t('deletion_pending_badge')}</span>` : ''}<br>
        <span style="color:var(--ink-soft);font-size:.85rem;">${tiNeighborhoodName(p.neighborhood)} · <span data-price-xof="${p.price}">${tiFormatPrice(p.price)}</span> · ${p.views || 0} ${t('views_label')}${p.reference ? ` · <span class="ti-card-ref" style="display:inline;">${t('reference_label')} ${p.reference}</span>` : ''}</span>
        ${p.listingStatus === 'rejected' ? `<div class="ti-doc-note" style="margin-top:6px;">${t('rejected_notice')}</div>` : ''}
        ${p.deletionStatus === 'pending' ? `<div class="ti-doc-note" style="margin-top:6px;">${t('deletion_pending_note')}</div>` : ''}
        ${TI_SESSION.agentRole === "supervisor" ? `
          <div class="ti-assign-row">
            <span class="ti-assign-label">${t('assign_to')}:</span>
            <select onchange="tiAssignPropertyToAgent('${p.id}', this.value)">
              <option value="">${t('unassigned')}</option>
              ${TI_AGENTS_CACHE.filter(a => a.status !== "suspended" || p.assignedAgentId === a.id).map(a => `<option value="${a.id}" ${p.assignedAgentId === a.id ? 'selected' : ''}>${tiEscapeHtml(a.name)}${a.status === 'suspended' ? ' (' + t('status_frozen') + ')' : ''}</option>`).join('')}
            </select>
          </div>` : ''}
      </div>
      <div class="ti-list-row-actions">
        <a class="btn btn-outline btn-sm" href="property.html?id=${p.id}" data-i18n="action_view">${t('action_view')}</a>
        <button class="btn btn-outline btn-sm" onclick="tiEditListing('${p.id}')" data-i18n="action_edit">${t('action_edit')}</button>
        ${tiRowMenuHtml(`
          <button type="button" onclick="tiGeneratePropertySheet('${p.id}')">${TI_ICONS.document} ${t('action_spec_sheet')}</button>
          ${p.listingStatus === 'active' ? `<button type="button" onclick="tiSetListingStatus('${p.id}','under_contract')">${TI_ICONS.editPencil} ${t('action_mark_under_contract')}</button>` : ''}
          ${p.listingStatus === 'active' ? `<button type="button" onclick="tiConfirmSetListingStatus('${p.id}','${p.forSale ? 'sold' : 'rented'}')">${TI_ICONS.check} ${p.forSale ? t('action_mark_sold') : t('action_mark_rented')}</button>` : ''}
          ${p.listingStatus === 'under_contract' ? `<button type="button" onclick="tiConfirmSetListingStatus('${p.id}','${p.forSale ? 'sold' : 'rented'}')">${TI_ICONS.check} ${p.forSale ? t('action_mark_sold') : t('action_mark_rented')}</button>` : ''}
          ${(p.listingStatus === 'rented' || p.listingStatus === 'sold' || p.listingStatus === 'under_contract') ? `<button type="button" onclick="tiSetListingStatus('${p.id}','active')">${TI_ICONS.plus} ${t('action_mark_available')}</button>` : ''}
          <div class="ti-row-menu-divider"></div>
          ${p.deletionStatus === 'pending'
            ? `<button type="button" onclick="tiCancelDeletionRequest('${p.id}')">${TI_ICONS.check} ${t('deletion_cancel_request')}</button>`
            : `<button type="button" class="ti-row-menu-danger" onclick="tiConfirmDeleteListing('${p.id}')">${TI_ICONS.trash} ${t('action_delete')}</button>`}
        `)}
      </div>
    </div>`).join('') : emptyHtml;
}

async function tiAssignPropertyToAgent(propertyId, agentId) {
  const prop = TI_AGENCY_ALL_PROPS.find(p => p.id === propertyId);
  const agent = TI_AGENTS_CACHE.find(a => a.id === agentId);
  await TiDB.assignProperty(propertyId, agentId || null);
  tiToast(t('save_changes') + " ✓");
  tiLogAgencyAction("property_assigned", "property", propertyId, prop ? tiPropertyTitle(prop) : propertyId, agent ? `${t('assign_to')}: ${agent.name}` : t('unassigned'));
  await tiRefreshPanel("listings");
}

/* ---------- Gestion des agents (superviseur uniquement) ---------- */
function tiPopulateAssignAgentSelect() {
  const sel = document.getElementById("nl-assign-agent");
  if (!sel) return;
  sel.innerHTML = `<option value="">${t('unassigned')}</option>` +
    TI_AGENTS_CACHE.filter(a => a.status !== "suspended").map(a => `<option value="${a.id}">${tiEscapeHtml(a.name)}</option>`).join('');
}

async function tiRenderAgents() {
  const mount = document.getElementById("agents-mount");
  if (!mount) return;
  await tiLoadAgentsCache();
  tiPopulateAssignAgentSelect();
  const agency = await TiDB.getAgency(TI_SESSION.agencyId);
  const allProps = await TiDB.getProperties();
  const listingCount = allProps.filter(p => p.agencyId === TI_SESSION.agencyId).length;
  const usageHtml = agency ? `
    <div class="ti-plan-usage">
      <span>${t('plan_label')}: <strong>${tiGetLang() === 'en' ? TI_AGENCY_TIERS.find(t2 => t2.id === agency.tier)?.labelEn : TI_AGENCY_TIERS.find(t2 => t2.id === agency.tier)?.label || agency.tier}</strong></span>
      <span>${t('agents_label')}: <strong>${TI_AGENTS_CACHE.length}/${agency.maxAgents ?? '—'}</strong></span>
      <span>${t('listings_count_label')}: <strong>${listingCount}/${agency.maxListings ?? '—'}</strong></span>
    </div>` : '';
  if (!TI_AGENTS_CACHE.length) {
    mount.innerHTML = usageHtml + `<div class="ti-empty-state"><span class="ti-empty-state-icon">${TI_ICONS.user}</span><p>${t('agents_empty')}</p></div>`;
    return;
  }
  const props = await tiAgencyProperties();
  const bookings = await TiDB.getBookings({ agencyId: TI_SESSION.agencyId });
  mount.innerHTML = usageHtml + TI_AGENTS_CACHE.map(a => {
    const assignedProps = props.filter(p => p.assignedAgentId === a.id);
    const count = assignedProps.length;
    const assignedIds = new Set(assignedProps.map(p => p.id));
    const relevantBookings = bookings.filter(b => assignedIds.has(b.propertyId));
    const activeCount = relevantBookings.filter(b => tiComputeBookingStage(b) === "active").length;
    const pipelineCount = relevantBookings.filter(b => ["requests", "validation", "signature"].includes(tiComputeBookingStage(b))).length;
    const frozen = a.status === "suspended";
    return `
    <div class="ti-list-row ${frozen ? 'ti-row-frozen' : ''}" style="cursor:pointer;" onclick="tiOpenAgentDetail('${a.id}')">
      <span class="ti-agency-avatar">${a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
      <div class="ti-list-row-body">
        <strong>${tiEscapeHtml(a.name)}</strong>
        <span class="badge ${frozen ? 'badge-cancelled' : 'badge-confirmed'}" style="margin-left:8px;">${frozen ? t('status_frozen') : t('status_active')}</span>
        ${a.deletionStatus === 'pending' ? `<span class="badge badge-cancelled">${t('deletion_pending_badge')}</span>` : ''}
        <br>
        <span style="color:var(--ink-soft);font-size:.85rem;">${tiEscapeHtml(a.email)} · ${count} ${t('agent_properties_count')}</span>
        <div class="ti-agent-row-stats">
          <span>${TI_ICONS.document} ${pipelineCount} ${t('agent_stat_pipeline')}</span>
          <span>${TI_ICONS.check} ${activeCount} ${t('agent_stat_active_tenants')}</span>
        </div>
      </div>
      <div class="ti-list-row-actions" onclick="event.stopPropagation()">
        <button class="btn btn-outline btn-sm" onclick="tiOpenAgentDetail('${a.id}')">${t('agent_detail_open')}</button>
      </div>
    </div>`;
  }).join('');
}

let TI_AUDIT_LOG_CACHE = [];
/* ---------- Rapports (prêts à imprimer, exportables via Imprimer → PDF du navigateur) ---------- */
const TI_REPORT_PERIOD_DAYS = { week: 7, month: 30, quarter: 90, year: 365 };
/* ---------- Résumé intelligent de rapport (récit basé sur les données, pas un appel LLM en direct) ---------- */
function tiGenerateAgencyReportInsight(d) {
  const lang = tiGetLang();
  const parts = [];

  parts.push(d.revenueCollected > 0
    ? (lang === "en"
        ? `Your agency collected ${tiFormatPrice(d.revenueCollected)} across ${d.confirmedCount} confirmed booking(s) during this period.`
        : `Votre agence a encaissé ${tiFormatPrice(d.revenueCollected)} sur ${d.confirmedCount} réservation(s) confirmée(s) durant cette période.`)
    : (lang === "en"
        ? `No payments were collected during this period.`
        : `Aucun paiement n'a été encaissé durant cette période.`));

  if (d.topProperty) {
    parts.push(lang === "en"
      ? `${d.topProperty.title} is your best-performing listing with ${d.topProperty.views} views.`
      : `${d.topProperty.title} est votre annonce la plus consultée avec ${d.topProperty.views} vues.`);
  }

  if (d.pendingCount > 0) {
    parts.push(lang === "en"
      ? `${d.pendingCount} listing(s) are still awaiting admin validation.`
      : `${d.pendingCount} annonce(s) sont encore en attente de validation par l'administrateur.`);
  }

  if (d.overdueCount > 0) {
    parts.push(lang === "en"
      ? `${d.overdueCount} payment(s) are currently overdue and need your attention.`
      : `${d.overdueCount} échéance(s) sont actuellement en retard et méritent votre attention.`);
  } else if (d.pendingCount === 0) {
    parts.push(lang === "en" ? `Everything is on track — no action needed right now.` : `Tout est en ordre — aucune action requise pour le moment.`);
  }

  return parts.join(" ");
}

async function tiGenerateAgencyReport() {
  const periodKey = document.getElementById("report-period").value;
  const days = TI_REPORT_PERIOD_DAYS[periodKey];
  const since = new Date(); since.setDate(since.getDate() - days);

  let props = await tiAgencyProperties();
  let bookings = await TiDB.getBookings({ agencyId: TI_SESSION.agencyId });
  if (TI_SESSION.agentRole === "agent") {
    const myPropIds = new Set(props.map(p => p.id));
    bookings = bookings.filter(b => myPropIds.has(b.propertyId));
  }
  const confirmedBookings = bookings.filter(b => b.status === "confirmed");
  const totalViews = props.reduce((s, p) => s + (p.views || 0), 0);
  const avgRating = props.length ? (props.reduce((s, p) => s + p.rating, 0) / props.length).toFixed(1) : "—";

  let revenueCollected = 0;
  const paymentsInPeriod = [];
  bookings.forEach(b => {
    if (!b.rental) return;
    if (b.rental.deposit.status === "paid" && b.rental.deposit.paidAt && new Date(b.rental.deposit.paidAt) >= since) {
      revenueCollected += b.rental.deposit.amount;
      paymentsInPeriod.push({ property: b.propertyTitle, client: b.name, label: t("deposit_label"), amount: b.rental.deposit.amount, date: b.rental.deposit.paidAt });
    }
    b.rental.schedule.forEach(item => {
      if (item.status === "paid" && item.paidAt && new Date(item.paidAt) >= since) {
        const total = item.rent + item.chargesAmount;
        revenueCollected += total;
        paymentsInPeriod.push({ property: b.propertyTitle, client: b.name, label: tiFormatMonth(item.dueDate), amount: total, date: item.paidAt });
      }
    });
  });
  paymentsInPeriod.sort((a, b) => new Date(b.date) - new Date(a.date));

  const byStatus = {
    active: props.filter(p => tiPropertyStateValue(p) === "for_sale" || tiPropertyStateValue(p) === "for_rent").length,
    under_contract: props.filter(p => p.listingStatus === "under_contract").length,
    rentedSold: props.filter(p => p.listingStatus === "rented" || p.listingStatus === "sold").length,
    pending: props.filter(p => p.listingStatus === "pending").length,
  };
  const topProps = [...props].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  const overdueCount = bookings.reduce((sum, b) => {
    if (!b.rental) return sum;
    return sum + b.rental.schedule.filter(item => item.status === "pending" && item.dueDate < tiTodayIsoA()).length;
  }, 0);

  const agency = await TiDB.getAgency(TI_SESSION.agencyId);
  const periodLabel = t("period_" + periodKey);
  const generatedAt = tiFormatDateTime(new Date().toISOString());
  const topProperty = topProps[0] && topProps[0].views ? { title: tiPropertyTitle(topProps[0]), views: topProps[0].views } : null;
  const insightMetrics = { revenueCollected, confirmedCount: confirmedBookings.length, totalViews, avgRating, topProperty, pendingCount: byStatus.pending, overdueCount };
  const insightText = await tiGetReportInsight(
    { type: "agency_performance", period: periodKey, agencyName: agency ? agency.name : "", metrics: insightMetrics, lang: tiGetLang() },
    () => tiGenerateAgencyReportInsight(insightMetrics)
  );

  const reportHtml = `
    <div class="ti-report">
      <div class="ti-report-letterhead">
        <div>
          <div class="ti-report-brand"><img src="assets/brand/timmo-logo-primary.svg" alt="Timmo" class="ti-report-brand-logo"></div>
          <h2>${t('report_title_agency')}</h2>
          <p>${agency ? agency.name : ''} · ${periodLabel}</p>
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
        <div class="ti-report-kpi"><b>${props.length}</b><span>${t('dash_agency_listings')}</span></div>
        <div class="ti-report-kpi"><b>${confirmedBookings.length}</b><span>${t('report_confirmed_bookings')}</span></div>
        <div class="ti-report-kpi"><b data-price-xof="${revenueCollected}">${tiFormatPrice(revenueCollected)}</b><span>${t('report_revenue_collected')}</span></div>
        <div class="ti-report-kpi"><b>${totalViews}</b><span>${t('stat_total_views')}</span></div>
        <div class="ti-report-kpi"><b>${avgRating}</b><span>★ ${t('sort_rating')}</span></div>
      </div>

      <h3>${t('report_listings_breakdown')}</h3>
      <table class="ti-report-table">
        <thead><tr><th>${t('report_status')}</th><th>${t('report_count')}</th></tr></thead>
        <tbody>
          <tr><td>${t('state_for_sale')} / ${t('state_for_rent')}</td><td>${byStatus.active}</td></tr>
          <tr><td>${t('listing_status_under_contract')}</td><td>${byStatus.under_contract}</td></tr>
          <tr><td>${t('stat_rented_sold')}</td><td>${byStatus.rentedSold}</td></tr>
          <tr><td>${t('stat_pending_validation')}</td><td>${byStatus.pending}</td></tr>
        </tbody>
      </table>

      <h3>${t('report_top_properties')}</h3>
      <table class="ti-report-table">
        <thead><tr><th>${t('field_title')}</th><th>${t('reference_label')}</th><th>${t('stat_total_views')}</th><th>★ ${t('sort_rating')}</th></tr></thead>
        <tbody>
          ${topProps.map(p => `<tr><td>${tiPropertyTitle(p)}</td><td>${p.reference || '—'}</td><td>${p.views || 0}</td><td>${p.rating}</td></tr>`).join('') || `<tr><td colspan="4">${t('no_data')}</td></tr>`}
        </tbody>
      </table>

      <h3>${t('report_payments_collected')}</h3>
      <table class="ti-report-table">
        <thead><tr><th>${t('report_date')}</th><th>${t('field_title')}</th><th>${t('full_name')}</th><th>${t('report_item')}</th><th>${t('pay_amount')}</th></tr></thead>
        <tbody>
          ${paymentsInPeriod.length ? paymentsInPeriod.map(p => `<tr><td>${tiFormatDateTime(p.date)}</td><td>${p.property}</td><td>${p.client}</td><td>${p.label}</td><td data-price-xof="${p.amount}">${tiFormatPrice(p.amount)}</td></tr>`).join('') : `<tr><td colspan="5">${t('no_data')}</td></tr>`}
        </tbody>
      </table>

      <div class="ti-report-footer">${t('report_confidential_note')} — ${t('report_generated_by')} Timmo</div>
    </div>`;
  document.getElementById("agency-report-mount").innerHTML = reportHtml;
  document.getElementById("ti-print-root").innerHTML = reportHtml;
  document.getElementById("report-print-btn").style.display = "";
  document.getElementById("agency-report-mount").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function tiRenderAudit() {
  const mount = document.getElementById("audit-mount");
  if (!mount) return;
  TI_AUDIT_LOG_CACHE = await TiDB.getAuditLog({ agencyId: TI_SESSION.agencyId });

  const actorFilter = document.getElementById("audit-actor-filter");
  const knownActors = new Map();
  TI_AUDIT_LOG_CACHE.forEach(l => { if (!knownActors.has(l.actorId)) knownActors.set(l.actorId, l.actorName); });
  const currentValue = actorFilter.value;
  actorFilter.innerHTML = `<option value="">${t('all_agents')}</option>` +
    [...knownActors.entries()].map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
  actorFilter.value = currentValue;

  tiApplyAuditFilter();
}

let TI_AGENCY_AUDIT_STATE = { period: "week", page: 1 };
function tiSetAgencyAuditView(period, page) {
  if (period) TI_AGENCY_AUDIT_STATE.period = period;
  if (page) TI_AGENCY_AUDIT_STATE.page = page;
  tiApplyAuditFilter();
}
function tiApplyAuditFilter() {
  const actorId = document.getElementById("audit-actor-filter").value;
  const list = actorId ? TI_AUDIT_LOG_CACHE.filter(l => l.actorId === actorId) : TI_AUDIT_LOG_CACHE;
  tiRenderAuditTimeline("audit-mount", list, TI_AGENCY_AUDIT_STATE, "tiSetAgencyAuditView");
}

async function tiSubmitNewAgent(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  if (!(await TiDB.canAddAgent(TI_SESSION.agencyId))) {
    tiToast(t("agent_limit_reached"));
    return false;
  }
  tiSetBtnLoading(btn, true);
  const agentName = document.getElementById("ag-agent-name").value;
  const result = await TiDB.createAgent({
    name: agentName,
    email: document.getElementById("ag-agent-email").value,
    password: document.getElementById("ag-agent-password").value,
    agencyId: TI_SESSION.agencyId,
  });
  tiSetBtnLoading(btn, false);
  if (!result.ok) {
    tiToast(t("agent_email_exists"));
    return false;
  }
  e.target.reset();
  tiToast(t("agent_added") + " ✓");
  tiLogAgencyAction("agent_created", "agent", result.agent.id, agentName);
  await tiRenderAgents();
  tiRenderAgencyListings();
  return false;
}

let TI_AGENT_DETAIL_ID = null;
let TI_AGENT_DETAIL_AUDIT_STATE = { period: "all", page: 1 };
function tiSetAgentDetailAuditView(period, page) {
  if (period) TI_AGENT_DETAIL_AUDIT_STATE.period = period;
  if (page) TI_AGENT_DETAIL_AUDIT_STATE.page = page;
  tiRefreshAgentDetailAudit();
}
async function tiRefreshAgentDetailAudit() {
  if (!TI_AGENT_DETAIL_ID) return;
  const log = (await TiDB.getAuditLog({ agencyId: TI_SESSION.agencyId })).filter(l => l.actorId === TI_AGENT_DETAIL_ID);
  tiRenderAuditTimeline("agent-detail-audit-mount", log, TI_AGENT_DETAIL_AUDIT_STATE, "tiSetAgentDetailAuditView");
}
async function tiOpenAgentDetail(agentId) {
  TI_AGENT_DETAIL_ID = agentId;
  const agent = TI_AGENTS_CACHE.find(a => a.id === agentId);
  if (!agent) return;
  const frozen = agent.status === "suspended";
  const props = await tiAgencyProperties();
  const assignedProps = props.filter(p => p.assignedAgentId === agentId);
  const assignedIds = new Set(assignedProps.map(p => p.id));
  const bookings = (await TiDB.getBookings({ agencyId: TI_SESSION.agencyId })).filter(b => assignedIds.has(b.propertyId));
  const activeCount = bookings.filter(b => tiComputeBookingStage(b) === "active").length;
  const pipelineCount = bookings.filter(b => ["requests", "validation", "signature"].includes(tiComputeBookingStage(b))).length;

  document.getElementById("agent-detail-mount").innerHTML = `
    <div class="ti-agent-detail-head">
      <span class="ti-agency-avatar" style="width:52px;height:52px;font-size:1.1rem;flex-shrink:0;">${agent.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
      <div>
        <h3 style="margin:0;">${tiEscapeHtml(agent.name)}</h3>
        <span class="badge ${frozen ? 'badge-cancelled' : 'badge-confirmed'}">${frozen ? t('status_frozen') : t('status_active')}</span>
        ${agent.deletionStatus === 'pending' ? `<span class="badge badge-cancelled">${t('deletion_pending_badge')}</span>` : ''}
      </div>
    </div>

    <div class="ti-agency-stat-grid" style="margin-top:22px;">
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.home}</span><b>${assignedProps.length}</b><span>${t('agent_properties_count')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.document}</span><b>${pipelineCount}</b><span>${t('agent_stat_pipeline')}</span></div>
      <div class="ti-stat-card"><span class="ti-stat-icon">${TI_ICONS.check}</span><b>${activeCount}</b><span>${t('agent_stat_active_tenants')}</span></div>
    </div>

    <div class="ti-agency-detail-section">
      <h4 class="ti-form-section-title">${t('agent_detail_info_title')}</h4>
      <form onsubmit="return tiAgentDetailSaveInfo(event,'${agentId}')">
        <div class="field"><label>${t('field_name')}</label><input type="text" id="agent-detail-name" value="${tiEscapeHtml(agent.name)}" required></div>
        <div class="field"><label>${t('field_email')}</label><input type="email" id="agent-detail-email" value="${tiEscapeHtml(agent.email)}" required></div>
        <div class="field"><label>${t('field_phone')}</label><input type="tel" id="agent-detail-phone" value="${tiEscapeHtml(agent.phone || '')}"></div>
        <button type="submit" class="btn btn-primary btn-sm">${t('save_changes')}</button>
      </form>
    </div>

    <div class="ti-agency-detail-section">
      <h4 class="ti-form-section-title">${t('agent_detail_security_title')}</h4>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="tiAgentDetailResetPassword('${agentId}')">${t('reset_password_action')}</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="tiAgentDetailToggleStatus('${agentId}')">${frozen ? t('action_reactivate') : t('action_freeze')}</button>
      </div>
    </div>

    <div class="ti-agency-detail-section">
      <h4 class="ti-form-section-title">${t('dash_agency_audit')}</h4>
      <div id="agent-detail-audit-mount"></div>
    </div>

    <div class="ti-agency-detail-section" style="border-color:rgba(178,58,58,.3);">
      <h4 class="ti-form-section-title" style="color:var(--danger);">${t('danger_zone')}</h4>
      ${agent.deletionStatus === 'pending' ? `
        <p style="color:var(--ink-soft);font-size:.85rem;margin:-6px 0 12px;">${t('deletion_pending_note')}</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="tiCancelAgentDeletionRequest('${agentId}')">${t('deletion_cancel_request')}</button>
      ` : `
        <p style="color:var(--ink-soft);font-size:.85rem;margin:-6px 0 12px;">${t('agent_detail_delete_note')}</p>
        <button type="button" class="btn btn-danger btn-sm" onclick="tiAgentDetailDelete('${agentId}')">${t('action_delete')}</button>
      `}
    </div>`;
  await tiRefreshAgentDetailAudit();
  tiOpenModal("modal-agent-detail");
}
async function tiAgentDetailSaveInfo(e, agentId) {
  e.preventDefault();
  await TiDB.updateUser(agentId, {
    name: document.getElementById("agent-detail-name").value.trim(),
    email: document.getElementById("agent-detail-email").value.trim(),
    phone: document.getElementById("agent-detail-phone").value.trim(),
  });
  tiLogAgencyAction("agent_info_updated", "agent", agentId, document.getElementById("agent-detail-name").value.trim());
  tiToast(t("save_changes") + " ✓");
  await tiRefreshPanel("agents");
  await tiOpenAgentDetail(agentId);
  return false;
}
async function tiAgentDetailResetPassword(agentId) {
  const agent = TI_AGENTS_CACHE.find(a => a.id === agentId);
  const result = await TiDB.regenerateTempPassword(agentId);
  if (!result.ok) return;
  tiLogAgencyAction("password_reset", "agent", agentId, agent ? agent.name : agentId);
  document.getElementById("temp-password-user-note").textContent = agent ? `${agent.name} — ${agent.email}` : "";
  document.getElementById("temp-password-value").value = result.password;
  tiOpenModal("modal-temp-password");
}
async function tiAgentDetailToggleStatus(agentId) {
  await tiToggleAgentFrozen(agentId);
  await tiOpenAgentDetail(agentId);
}
async function tiCancelAgentDeletionRequest(agentId) {
  const agent = TI_AGENTS_CACHE.find(a => a.id === agentId);
  await TiDB.cancelAgentDeletion(agentId);
  tiLogAgencyAction("agent_deletion_cancelled", "agent", agentId, agent ? agent.name : agentId);
  tiToast(t('deletion_request_cancelled') + " ✓");
  await tiRefreshPanel("agents");
  await tiOpenAgentDetail(agentId);
}
function tiAgentDetailDelete(agentId) {
  const agent = TI_AGENTS_CACHE.find(a => a.id === agentId);
  tiOpenDeletionRequestModal("agent", agentId, agent ? agent.name : "");
}
async function tiToggleAgentFrozen(id) {
  const agent = TI_AGENTS_CACHE.find(a => a.id === id);
  if (!agent) return;
  const nowFrozen = agent.status !== "suspended";
  await TiDB.setUserStatus(id, nowFrozen ? "suspended" : "active");
  tiToast((nowFrozen ? t("action_freeze") : t("action_reactivate")) + " ✓");
  tiLogAgencyAction(nowFrozen ? "agent_frozen" : "agent_reactivated", "agent", id, agent.name);
  await tiRefreshPanel("agents");
}

let TI_AGENCY_PAYMENT_STATUS_CACHE = {};
async function tiRenderAgencyListings() {
  TI_AGENCY_ALL_PROPS = await tiAgencyProperties();
  const propIds = new Set(TI_AGENCY_ALL_PROPS.map(p => p.id));
  const bookings = (await TiDB.getBookings({ agencyId: TI_SESSION.agencyId })).filter(b => propIds.has(b.propertyId) && b.rental);
  TI_AGENCY_PAYMENT_STATUS_CACHE = {};
  bookings.forEach(b => {
    // ne garde que la réservation de location confirmée la plus récente par bien
    if (!TI_AGENCY_PAYMENT_STATUS_CACHE[b.propertyId] || new Date(b.createdAt) > new Date(TI_AGENCY_PAYMENT_STATUS_CACHE[b.propertyId].createdAt)) {
      TI_AGENCY_PAYMENT_STATUS_CACHE[b.propertyId] = b;
    }
  });
  tiRenderAgencyListingsFilterBar();
  tiApplyAgencyListingsFilter();
}

function tiPaymentStatusBadge(propertyId) {
  const b = TI_AGENCY_PAYMENT_STATUS_CACHE[propertyId];
  if (!b) return "";
  const today = tiTodayIsoA();
  if (b.rental.deposit.status !== "paid") {
    return `<span class="badge badge-pending">${t('payment_deposit_pending')}</span>`;
  }
  const overdueCount = b.rental.schedule.filter(item => item.status === "pending" && item.dueDate < today).length;
  if (overdueCount > 0) {
    return `<span class="badge badge-cancelled">${overdueCount} ${t('payment_overdue_suffix')}</span>`;
  }
  return `<span class="badge badge-confirmed">${t('payment_up_to_date')}</span>`;
}

let TI_DELETION_REQUEST_CONTEXT = null;
function tiOpenDeletionRequestModal(type, id, itemLabel) {
  TI_DELETION_REQUEST_CONTEXT = { type, id };
  document.getElementById("deletion-request-title").textContent = type === "property" ? t('deletion_request_title_property') : t('deletion_request_title_agent');
  document.getElementById("deletion-request-sub").textContent = t('deletion_request_sub').replace('{item}', itemLabel);
  document.getElementById("deletion-reason").value = "";
  tiOpenModal("modal-deletion-request");
}
async function tiSubmitDeletionRequest(e) {
  e.preventDefault();
  const reason = document.getElementById("deletion-reason").value.trim();
  const { type, id } = TI_DELETION_REQUEST_CONTEXT;
  const requestedBy = TI_SESSION.name;
  if (type === "property") {
    const prop = TI_AGENCY_ALL_PROPS.find(p => p.id === id);
    await TiDB.requestPropertyDeletion(id, reason, requestedBy);
    tiLogAgencyAction("property_deletion_requested", "property", id, prop ? tiPropertyTitle(prop) : id, reason);
    await tiRefreshPanel("listings");
  } else if (type === "agent") {
    const agent = TI_AGENTS_CACHE.find(a => a.id === id);
    await TiDB.requestAgentDeletion(id, reason, requestedBy);
    tiLogAgencyAction("agent_deletion_requested", "agent", id, agent ? agent.name : id, reason);
    tiCloseModal("modal-agent-detail");
    await tiRefreshPanel("agents");
  }
  tiCloseModal("modal-deletion-request");
  tiToast(t('deletion_request_sent') + " ✓");
  return false;
}

async function tiCancelDeletionRequest(id) {
  const prop = TI_AGENCY_ALL_PROPS.find(p => p.id === id);
  await TiDB.cancelPropertyDeletion(id);
  tiLogAgencyAction("property_deletion_cancelled", "property", id, prop ? tiPropertyTitle(prop) : id);
  tiToast(t('deletion_request_cancelled') + " ✓");
  await tiRefreshPanel("listings");
}
function tiConfirmDeleteListing(id) {
  const prop = TI_AGENCY_ALL_PROPS.find(p => p.id === id);
  tiOpenDeletionRequestModal("property", id, prop ? tiPropertyTitle(prop) : "");
}
function tiConfirmSetListingStatus(id, status) {
  const label = status === "sold" ? t('action_mark_sold') : t('action_mark_rented');
  if (!confirm(t('confirm_set_listing_status').replace('{action}', label))) return;
  tiSetListingStatus(id, status);
}

/* ---------- Localisation : Région > Département > Arrondissement > Commune + adresse libre + repère sur la carte ---------- */
let TI_LOCATION_MAP = null;
let TI_LOCATION_MARKER = null;
let TI_NL_PIN = null; // { lat, lng } once the agent has clicked the map; null = use quartier default
let TI_NL_TITLE_DOC = null; // { fileName, fileData } once uploaded this session; null = keep existing (when editing) or none (new listing)

async function tiHandleTitleDocFile(file) {
  if (!file) return;
  if (file.size > TI_MAX_DOC_PREVIEW_SIZE) { tiToast(t("doc_too_large")); return; }
  try {
    const fileData = file.type.startsWith("image/") ? await tiCompressImageFile(file, 1600, 0.85) : await tiReadFileAsDataUrl(file);
    TI_NL_TITLE_DOC = { fileName: file.name, fileData };
    tiRenderTitleDocCurrent();
  } catch (err) { /* ignore unreadable file */ }
}
function tiTitleVerificationStatusLabel(status) {
  const key = "title_verification_status_" + (status || "none");
  return t(key);
}
function tiRenderTitleDocCurrent() {
  const mount = document.getElementById("nl-title-doc-current-mount");
  if (!mount) return;
  const existing = TI_EDITING_PROPERTY && TI_EDITING_PROPERTY.titleVerification;
  const doc = TI_NL_TITLE_DOC || (existing && existing.fileName ? existing : null);
  if (!doc) { mount.innerHTML = `<p style="font-size:.82rem;color:var(--ink-soft);margin-top:10px;">${t('title_doc_no_file_yet')}</p>`; return; }
  const status = TI_NL_TITLE_DOC ? "pending" : (existing ? existing.status : "none");
  mount.innerHTML = `
    <div class="ti-title-doc-current">
      ${TI_ICONS.document}
      <div style="flex:1;min-width:0;">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);">${t('title_doc_current_file')}</div>
        <strong style="display:block;font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tiEscapeHtml(doc.fileName)}</strong>
        <span style="font-size:.78rem;color:var(--ink-soft);">${tiTitleVerificationStatusLabel(status)}</span>
        ${status === "rejected" && existing && existing.rejectionNote ? `<div style="font-size:.78rem;color:var(--danger);margin-top:2px;">${t('title_verification_rejection_note')}: ${tiEscapeHtml(existing.rejectionNote)}</div>` : ''}
      </div>
    </div>`;
}

function tiPopulateRegionSelect() {
  const mount = document.getElementById("nl-region-chips");
  if (!mount) return;
  mount.innerHTML = TI_ADMIN_REGIONS.map(r => `<div class="ti-region-chip" data-region="${r.id}" onclick="tiSelectRegion('${r.id}')">${tiEscapeHtml(r.name)}</div>`).join('');
  tiSelectRegion(TI_ADMIN_REGIONS[0].id);
}
function tiSelectRegion(regionId) {
  document.getElementById("nl-region").value = regionId;
  document.querySelectorAll("#nl-region-chips .ti-region-chip").forEach(el => el.classList.toggle("active", el.dataset.region === regionId));
  const depts = TI_ADMIN_DEPARTMENTS[regionId] || [];
  document.getElementById("nl-department").innerHTML = depts.map(d => `<option value="${d.id}">${tiEscapeHtml(d.name)}</option>`).join('');
  tiOnDepartmentChange();
}
function tiOnDepartmentChange() {
  const deptId = document.getElementById("nl-department").value;
  const arrs = tiGetArrondissements(deptId);
  document.getElementById("nl-arrondissement").innerHTML = arrs.map(a => `<option value="${a.id}">${tiEscapeHtml(a.name)}</option>`).join('');
  tiOnArrondissementChange();
}
function tiOnArrondissementChange() {
  const arrId = document.getElementById("nl-arrondissement").value;
  const communes = TI_ADMIN_COMMUNES[arrId] || [];
  const communeSel = document.getElementById("nl-commune");
  communeSel.innerHTML = communes.length
    ? communes.map(c => `<option value="${c.id}">${tiEscapeHtml(c.name)}</option>`).join('')
    : `<option value="">${t('no_communes_yet')}</option>`;
  tiOnCommuneChange();
}
function tiOnCommuneChange() {
  TI_NL_PIN = null; // changer de commune réinitialise le centrage par défaut de la carte
  tiRecenterLocationMap();
  tiUpdateListingPreview();
}
/** Positionne directement la cascade sur un chemin connu (région,
 *  département, arrondissement, commune) — utilisé à l'ouverture d'une
 *  annonce ou d'une agence existante en modification. */
function tiSetLocationHierarchy(region, department, arrondissement, commune) {
  tiSelectRegion(region && TI_ADMIN_DEPARTMENTS[region] ? region : TI_ADMIN_REGIONS[0].id);
  if (department) { document.getElementById("nl-department").value = department; tiOnDepartmentChange(); }
  if (arrondissement) { document.getElementById("nl-arrondissement").value = arrondissement; tiOnArrondissementChange(); }
  if (commune) document.getElementById("nl-commune").value = commune;
}
/** Repli pour les annonces créées avant l'ajout de la hiérarchie complète,
 *  qui ne connaissaient que le quartier (hoodId) — retrouve la commune
 *  correspondante par recherche inverse. */
function tiSelectHoodInHierarchy(hoodId) {
  for (const [arrId, communes] of Object.entries(TI_ADMIN_COMMUNES)) {
    const commune = communes.find(c => c.hoodId === hoodId);
    if (!commune) continue;
    for (const [deptId, arrs] of Object.entries(TI_ADMIN_ARRONDISSEMENTS)) {
      if (!arrs.some(a => a.id === arrId)) continue;
      for (const [regionId, depts] of Object.entries(TI_ADMIN_DEPARTMENTS)) {
        if (depts.some(d => d.id === deptId)) { tiSetLocationHierarchy(regionId, deptId, arrId, commune.id); return; }
      }
    }
  }
}
function tiRecenterLocationMap() {
  if (!TI_LOCATION_MAP) return;
  const arrId = document.getElementById("nl-arrondissement").value;
  const communeId = document.getElementById("nl-commune").value;
  const commune = (TI_ADMIN_COMMUNES[arrId] || []).find(c => c.id === communeId);
  const hood = commune && commune.hoodId ? TI_NEIGHBORHOODS.find(n => n.id === commune.hoodId) : null;
  const region = TI_ADMIN_REGIONS.find(r => r.id === document.getElementById("nl-region").value);
  const fallback = hood || region || { lat: 14.7167, lng: -17.4677 };
  const target = TI_NL_PIN || fallback;
  TI_LOCATION_MAP.setView([target.lat, target.lng], TI_NL_PIN ? 16 : (hood ? 14 : 11));
  if (TI_LOCATION_MARKER) TI_LOCATION_MARKER.setLatLng([target.lat, target.lng]);
}
function tiInitLocationMap() {
  const container = document.getElementById("nl-location-map");
  if (!container) return;
  if (typeof L === "undefined") {
    container.innerHTML = `<div class="ti-map-fallback">Carte indisponible — vérifiez votre connexion internet.<br><small>Map unavailable — check your internet connection.</small></div>`;
    return;
  }
  if (TI_LOCATION_MAP) { setTimeout(() => TI_LOCATION_MAP.invalidateSize(), 150); tiRecenterLocationMap(); return; }
  const arrId0 = document.getElementById("nl-arrondissement")?.value;
  const communeId0 = document.getElementById("nl-commune")?.value;
  const commune0 = (TI_ADMIN_COMMUNES[arrId0] || []).find(c => c.id === communeId0);
  const hood0 = commune0 && commune0.hoodId ? TI_NEIGHBORHOODS.find(n => n.id === commune0.hoodId) : null;
  const region0 = TI_ADMIN_REGIONS.find(r => r.id === document.getElementById("nl-region")?.value);
  const hood = hood0 || region0 || { lat: 14.7167, lng: -17.4677 };
  const start = TI_NL_PIN || { lat: hood.lat, lng: hood.lng };
  TI_LOCATION_MAP = L.map(container, { scrollWheelZoom: false }).setView([start.lat, start.lng], TI_NL_PIN ? 16 : 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; OpenStreetMap contributors' }).addTo(TI_LOCATION_MAP);
  TI_LOCATION_MARKER = L.marker([start.lat, start.lng], { draggable: true }).addTo(TI_LOCATION_MAP);
  const applyPin = latlng => { TI_NL_PIN = { lat: latlng.lat, lng: latlng.lng }; TI_LOCATION_MARKER.setLatLng(latlng); };
  TI_LOCATION_MAP.on("click", e => applyPin(e.latlng));
  TI_LOCATION_MARKER.on("dragend", () => applyPin(TI_LOCATION_MARKER.getLatLng()));
  setTimeout(() => TI_LOCATION_MAP.invalidateSize(), 200);
}

/* ---------- Insertion de photos + aperçu en direct ---------- */
/* ---------- Gestionnaire d'envoi de photos (glisser-déposer, clic, réorganiser, remplacer) ---------- */
const TI_NL_PHOTO_MAX = 10;
let TI_NL_PHOTOS = [];
let TI_PHOTO_REPLACE_INDEX = null;
let TI_PHOTO_DRAG_SRC = null;

function tiGetPhotoUrlsFromForm() {
  return TI_NL_PHOTOS;
}
async function tiHandlePhotoFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith("image/"));
  if (!files.length) { if (fileList.length) tiToast(t("photo_invalid_type")); return; }
  const room = TI_NL_PHOTO_MAX - TI_NL_PHOTOS.length;
  if (room <= 0) { tiToast(t("photo_limit_reached")); return; }
  const toProcess = files.slice(0, room);
  if (files.length > room) tiToast(t("photo_limit_reached"));
  for (const file of toProcess) {
    try {
      const dataUrl = await tiCompressImageFile(file);
      TI_NL_PHOTOS.push(dataUrl);
    } catch (err) { /* skip files that fail to decode */ }
  }
  tiRenderPhotoPreview();
  tiUpdateListingPreview();
}
async function tiReplacePhotoFile(input) {
  const file = input.files[0];
  input.value = "";
  if (!file || !file.type.startsWith("image/") || TI_PHOTO_REPLACE_INDEX === null) return;
  try {
    const dataUrl = await tiCompressImageFile(file);
    TI_NL_PHOTOS[TI_PHOTO_REPLACE_INDEX] = dataUrl;
    tiRenderPhotoPreview();
    tiUpdateListingPreview();
  } catch (err) { /* ignore decode failure */ }
}
function tiTriggerReplacePhoto(index) {
  TI_PHOTO_REPLACE_INDEX = index;
  document.getElementById("nl-photo-replace-input").click();
}
function tiRemovePhoto(index) {
  TI_NL_PHOTOS.splice(index, 1);
  tiRenderPhotoPreview();
  tiUpdateListingPreview();
}
function tiAddPhotoFromUrl() {
  const input = document.getElementById("nl-photo-url-input");
  const url = input.value.trim();
  if (!url) return;
  if (TI_NL_PHOTOS.length >= TI_NL_PHOTO_MAX) { tiToast(t("photo_limit_reached")); return; }
  TI_NL_PHOTOS.push(url);
  input.value = "";
  tiRenderPhotoPreview();
  tiUpdateListingPreview();
}
function tiPhotoDragStart(index) { TI_PHOTO_DRAG_SRC = index; }
function tiPhotoDrop(index) {
  if (TI_PHOTO_DRAG_SRC === null || TI_PHOTO_DRAG_SRC === index) return;
  const [moved] = TI_NL_PHOTOS.splice(TI_PHOTO_DRAG_SRC, 1);
  TI_NL_PHOTOS.splice(index, 0, moved);
  TI_PHOTO_DRAG_SRC = null;
  tiRenderPhotoPreview();
  tiUpdateListingPreview();
}
function tiRenderPhotoPreview() {
  const mount = document.getElementById("nl-photo-preview");
  const hint = document.getElementById("nl-photos-count-hint");
  const dropzone = document.getElementById("nl-photo-dropzone");
  if (hint) hint.textContent = `${TI_NL_PHOTOS.length}/${TI_NL_PHOTO_MAX} ${t('photo_count_suffix')}`;
  if (dropzone) dropzone.classList.toggle("ti-photo-dropzone-full", TI_NL_PHOTOS.length >= TI_NL_PHOTO_MAX);
  mount.innerHTML = TI_NL_PHOTOS.map((url, i) => `
    <div class="ti-photo-thumb" draggable="true" ondragstart="tiPhotoDragStart(${i})" ondragover="event.preventDefault();" ondrop="tiPhotoDrop(${i})">
      ${i === 0 ? `<span class="ti-photo-cover-badge">${t('photo_cover_badge')}</span>` : ''}
      <img src="${url}" alt="" onerror="this.classList.add('broken')">
      <div class="ti-photo-thumb-actions">
        <button type="button" class="ti-photo-thumb-btn" onclick="tiTriggerReplacePhoto(${i})" title="${t('photo_replace_action')}">${TI_ICONS.edit || '✎'}</button>
        <button type="button" class="ti-photo-thumb-btn ti-photo-thumb-btn-danger" onclick="tiRemovePhoto(${i})" title="${t('action_delete')}">×</button>
      </div>
    </div>`).join('') + (TI_NL_PHOTOS.length < TI_NL_PHOTO_MAX ? '' : '');
}

/* ---------- Sélecteur de caractéristiques ---------- */
async function tiRenderAmenityPicker(checkedIcons) {
  const type = document.getElementById("nl-type").value;
  const catalog = await TiDB.getAmenityCatalog();
  const options = catalog.filter(o => o.types.includes(type) && o.id !== "am_furnished");
  const checked = checkedIcons || options.map(o => o.icon);
  document.getElementById("nl-amenity-picker").innerHTML = options.map(o => `
    <label class="ti-amenity-option">
      <input type="checkbox" value="${o.icon}" data-label="${o.label}" data-label-en="${o.labelEn}" ${checked.includes(o.icon) ? "checked" : ""}>
      <span>${o.icon}</span>
      ${tiGetLang() === "en" ? o.labelEn : o.label}
    </label>`).join('');
}

function tiReadCheckedAmenities() {
  return [...document.querySelectorAll('#nl-amenity-picker input:checked')].map(cb => ({
    icon: cb.value, label: cb.dataset.label, labelEn: cb.dataset.labelEn,
  }));
}

/* ---------- Description d'annonce assistée par IA (voir tiGetAiText dans main.js) ---------- */
function tiGenerateListingDescriptionLocal(d) {
  const isEn = d.lang === "en";
  const typeLabel = tiTypeLabel(d.type).toLowerCase();
  const frDemonstrative = { apartment: "cet", house: "cette", office: "ce", land: "ce" }[d.type] || "ce";
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const parts = [];

  parts.push(pick(isEn ? [
    `This ${typeLabel} in ${d.hoodName} offers ${d.beds} bedroom(s) and ${d.baths} bathroom(s) across ${d.area} m².`,
    `Discover this ${d.area} m² ${typeLabel}, located in the sought-after ${d.hoodName} neighborhood.`,
    `Set in ${d.hoodName}, this bright ${typeLabel} spans ${d.area} m² with ${d.beds} bedroom(s).`,
  ] : [
    `${frDemonstrative[0].toUpperCase()}${frDemonstrative.slice(1)} ${typeLabel} situé${d.type === 'house' ? 'e' : ''} à ${d.hoodName} offre ${d.beds} chambre(s) et ${d.baths} salle(s) de bain sur ${d.area} m².`,
    `Découvrez ${frDemonstrative} ${typeLabel} de ${d.area} m², idéalement situé${d.type === 'house' ? 'e' : ''} dans le quartier prisé de ${d.hoodName}.`,
    `À ${d.hoodName}, ${frDemonstrative} ${typeLabel} lumineux${d.type === 'house' ? 'se' : ''} s'étend sur ${d.area} m² avec ${d.beds} chambre(s).`,
  ]));

  if (d.amenities.length) {
    const names = d.amenities.slice(0, 4).map(a => (isEn ? a.labelEn : a.label).toLowerCase());
    const list = names.length > 1 ? names.slice(0, -1).join(", ") + (isEn ? " and " : " et ") + names[names.length - 1] : names[0];
    parts.push(isEn ? `Enjoy ${list}.` : `Profitez de ${list}.`);
  }

  if (d.furnished) {
    parts.push(isEn ? `The property comes fully furnished, ready to move in.` : `Le bien est entièrement meublé, prêt à emménager.`);
  }

  if (d.listingKind === "sale") {
    parts.push(isEn
      ? `Offered for sale at ${tiFormatPrice(d.price)} — a great opportunity in a growing area.`
      : `Proposé à la vente à ${tiFormatPrice(d.price)} — une belle opportunité dans un secteur en plein essor.`);
  } else if (d.listingKind === "short") {
    parts.push(isEn ? `Available for short-term stays at ${tiFormatPrice(d.price)} per night.` : `Disponible en courte durée à ${tiFormatPrice(d.price)} la nuit.`);
  } else {
    parts.push(isEn ? `Available for rent at ${tiFormatPrice(d.price)} per month.` : `Disponible à la location pour ${tiFormatPrice(d.price)} par mois.`);
  }

  parts.push(pick(isEn
    ? [`Contact us today to schedule a visit.`, `Get in touch to arrange a viewing.`]
    : [`Contactez-nous dès aujourd'hui pour organiser une visite.`, `N'hésitez pas à nous contacter pour une visite.`]));

  return parts.join(" ");
}
async function tiGenerateListingDescription() {
  const btn = document.getElementById("nl-generate-desc-btn");
  const communeSelect = document.getElementById("nl-commune");
  const payload = {
    type: document.getElementById("nl-type").value,
    hoodName: communeSelect.options[communeSelect.selectedIndex]?.text || "",
    listingKind: document.getElementById("nl-listing-kind").value,
    price: Number(document.getElementById("nl-price").value) || 0,
    beds: Number(document.getElementById("nl-beds").value) || 0,
    baths: Number(document.getElementById("nl-baths").value) || 0,
    area: Number(document.getElementById("nl-area").value) || 0,
    amenities: tiReadCheckedAmenities(),
    furnished: document.getElementById("nl-furnished").checked,
    lang: tiGetLang(),
  };
  if (!payload.area || !payload.price) { tiToast(t("generate_desc_need_fields")); return; }
  tiSetBtnLoading(btn, true);
  const text = await tiGetAiText("listing-description", payload, () => tiGenerateListingDescriptionLocal(payload));
  tiSetBtnLoading(btn, false);
  document.getElementById("nl-desc").value = text;
}

/* ---------- Gestion de la disponibilité (date de disponibilité / calendrier de dates bloquées) ---------- */
function tiTodayIsoA() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
let TI_BLOCKED_CAL_STATE = null;

/* ---------- Assistant de nouvelle annonce (étapes + aperçu en direct) ---------- */
let TI_WIZARD_STEP = 1;
const TI_WIZARD_TOTAL_STEPS = 6;

function tiRenderWizardProgress() {
  const mount = document.getElementById("nl-wizard-progress");
  if (!mount) return;
  const labels = ["wizard_step1_short", "wizard_step2_short", "wizard_step3_short", "wizard_step4_short", "wizard_step5_short", "wizard_step6_short"];
  mount.innerHTML = labels.map((key, i) => {
    const n = i + 1;
    const state = n < TI_WIZARD_STEP ? "done" : (n === TI_WIZARD_STEP ? "active" : "");
    return `
      <div class="ti-wizard-progress-step ${state}">
        <span class="ti-wizard-progress-dot">${n < TI_WIZARD_STEP ? "✓" : n}</span>
        <span class="ti-wizard-progress-label">${t(key)}</span>
      </div>
      ${n < labels.length ? '<div class="ti-wizard-progress-line ' + (n < TI_WIZARD_STEP ? "done" : "") + '"></div>' : ""}`;
  }).join("");
}
function tiWizardGoToStep(n) {
  TI_WIZARD_STEP = n;
  document.querySelectorAll(".ti-wizard-step").forEach(el => {
    el.style.display = Number(el.dataset.step) === n ? "block" : "none";
  });
  const prevBtn = document.getElementById("nl-wizard-prev");
  const nextBtn = document.getElementById("nl-wizard-next");
  const submitBtn = document.getElementById("nl-submit-btn");
  if (prevBtn) prevBtn.style.display = n > 1 ? "" : "none";
  if (nextBtn) nextBtn.style.display = n < TI_WIZARD_TOTAL_STEPS ? "" : "none";
  if (submitBtn) submitBtn.style.display = n === TI_WIZARD_TOTAL_STEPS ? "" : "none";
  tiRenderWizardProgress();
  tiUpdateListingPreview();
  if (n === 2) tiInitLocationMap();
  if (n === 4) tiRenderPhotoPreview();
  const panel = document.getElementById("panel-new");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}
function tiWizardNext() {
  const currentStepEl = document.querySelector(`.ti-wizard-step[data-step="${TI_WIZARD_STEP}"]`);
  const invalidField = currentStepEl && [...currentStepEl.querySelectorAll("input,select,textarea")].find(el => !el.checkValidity());
  if (invalidField) { invalidField.reportValidity(); return; }
  if (TI_WIZARD_STEP < TI_WIZARD_TOTAL_STEPS) tiWizardGoToStep(TI_WIZARD_STEP + 1);
}
function tiWizardPrev() {
  if (TI_WIZARD_STEP > 1) tiWizardGoToStep(TI_WIZARD_STEP - 1);
}
function tiUpdateListingPreview() {
  const mount = document.getElementById("nl-preview-mount");
  if (!mount) return;
  const title = document.getElementById("nl-title").value || t("wizard_preview_placeholder_title");
  const type = document.getElementById("nl-type").value;
  const hoodSel = document.getElementById("nl-commune");
  const hoodName = hoodSel && hoodSel.selectedIndex >= 0 ? hoodSel.options[hoodSel.selectedIndex].text : "";
  const kind = document.getElementById("nl-listing-kind").value;
  const price = Number(document.getElementById("nl-price").value) || 0;
  const beds = document.getElementById("nl-beds").value || "0";
  const baths = document.getElementById("nl-baths").value || "0";
  const area = document.getElementById("nl-area").value || "0";
  const photos = tiGetPhotoUrlsFromForm();
  const cover = photos[0] || TI_PHOTO_SETS[type][0];
  const priceSuffix = kind === "sale" ? "" : (kind === "short" ? ` <small style="font-weight:600;">${t('per_night')}</small>` : ` <small style="font-weight:600;">${t('per_month')}</small>`);

  mount.innerHTML = `
    <div class="ti-card">
      <div class="ti-card-media">
        <img src="${cover}" alt="" onerror="this.style.opacity=0">
        <span class="ti-card-badge">${tiTypeLabel(type)}</span>
      </div>
      <div style="padding:16px;">
        <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);">${hoodName}</div>
        <div class="ti-card-title" style="margin:6px 0;font-family:var(--font-display);font-size:1.05rem;font-weight:600;">${title}</div>
        <div style="color:var(--ink-soft);font-size:.85rem;">${beds} ${t('field_bedrooms').toLowerCase()} · ${baths} ${t('field_bathrooms').toLowerCase()} · ${area} m²</div>
        <div style="margin-top:10px;font-family:var(--font-display);font-weight:700;font-size:1.15rem;color:var(--deep);">${tiFormatPrice(price)}${priceSuffix}</div>
      </div>
    </div>`;
}

function tiToggleAvailabilityFields() {
  const kind = document.getElementById("nl-listing-kind").value;
  document.getElementById("nl-available-wrap").style.display = kind === "rent" ? "block" : "none";
  document.getElementById("nl-blocked-wrap").style.display = kind === "short" ? "block" : "none";
  if (kind === "short" && !TI_BLOCKED_CAL_STATE) tiInitBlockedCalendar([], []);
}

function tiInitBlockedCalendar(blockedDates, bookedDates) {
  const today = new Date();
  TI_BLOCKED_CAL_STATE = {
    year: today.getFullYear(), month: today.getMonth(),
    blockedSet: new Set(blockedDates || []),
    bookedSet: new Set(bookedDates || []),
  };
  tiRenderBlockedCalendar();
}

function tiBlockedCalNav(delta) {
  TI_BLOCKED_CAL_STATE.month += delta;
  if (TI_BLOCKED_CAL_STATE.month < 0) { TI_BLOCKED_CAL_STATE.month = 11; TI_BLOCKED_CAL_STATE.year--; }
  if (TI_BLOCKED_CAL_STATE.month > 11) { TI_BLOCKED_CAL_STATE.month = 0; TI_BLOCKED_CAL_STATE.year++; }
  tiRenderBlockedCalendar();
}

function tiToggleBlockedDay(iso) {
  const st = TI_BLOCKED_CAL_STATE;
  if (st.blockedSet.has(iso)) st.blockedSet.delete(iso); else st.blockedSet.add(iso);
  tiRenderBlockedCalendar();
}

function tiRenderBlockedCalendar() {
  const st = TI_BLOCKED_CAL_STATE;
  const mount = document.getElementById("nl-blocked-calendar");
  if (!st || !mount) return;
  const locale = tiGetLang() === "en" ? "en-US" : "fr-FR";
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(st.year, st.month, 1));
  const firstDay = new Date(st.year, st.month, 1);
  const daysInMonth = new Date(st.year, st.month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const weekDays = [];
  for (let i = 0; i < 7; i++) weekDays.push(weekdayFmt.format(new Date(2024, 0, 1 + i)));
  const todayIso = tiTodayIsoA();

  let cells = "";
  for (let i = 0; i < startOffset; i++) cells += `<div class="ti-cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${st.year}-${String(st.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let cls = "ti-cal-cell";
    let clickable = false;
    if (iso < todayIso) cls += " disabled";
    else if (st.bookedSet.has(iso)) cls += " booked";
    else if (st.blockedSet.has(iso)) { cls += " blocked"; clickable = true; }
    else { cls += " available"; clickable = true; }
    cells += `<div class="${cls}" ${clickable ? `onclick="tiToggleBlockedDay('${iso}')"` : ""} title="${st.bookedSet.has(iso) ? t('already_booked') : ''}">${day}</div>`;
  }

  mount.innerHTML = `
    <div class="ti-cal-card">
      <div class="ti-cal-nav">
        <button type="button" onclick="tiBlockedCalNav(-1)" aria-label="Mois précédent">&#8249;</button>
        <strong>${monthLabel}</strong>
        <button type="button" onclick="tiBlockedCalNav(1)" aria-label="Mois suivant">&#8250;</button>
      </div>
      <div class="ti-cal-weekdays">${weekDays.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="ti-cal-grid">${cells}</div>
    </div>
    <div class="ti-cal-legend">
      <span><i class="ti-cal-dot available"></i>${t('cal_legend_available')}</span>
      <span><i class="ti-cal-dot booked"></i>${t('cal_legend_booked')}</span>
      <span><i class="ti-cal-dot blocked"></i>${t('cal_legend_blocked')}</span>
    </div>`;
}

/* ---------- Créer / modifier une annonce ---------- */
function tiEditListing(id) {
  TiDB.getProperty(id).then(async p => {
    if (!p) return;
    TI_EDITING_PROPERTY = p;
    document.getElementById("nl-edit-id").value = p.id;
    document.getElementById("nl-title").value = p.title;
    document.getElementById("nl-type").value = p.type;
    if (p.region && p.commune) tiSetLocationHierarchy(p.region, p.department, p.arrondissement, p.commune);
    else tiSelectHoodInHierarchy(p.neighborhood);
    document.getElementById("nl-street-address").value = p.streetAddress || "";
    TI_NL_PIN = (p.lat && p.lng) ? { lat: p.lat, lng: p.lng } : null;
    document.getElementById("nl-price").value = p.price;
    document.getElementById("nl-listing-kind").value = p.forSale ? "sale" : (p.shortStay ? "short" : "rent");
    document.getElementById("nl-beds").value = p.bedrooms;
    document.getElementById("nl-baths").value = p.bathrooms;
    document.getElementById("nl-area").value = p.area;
    document.getElementById("nl-desc").value = p.desc;
    TI_NL_PHOTOS = [...(p.photos || [])];
    tiRenderPhotoPreview();
    tiRenderAmenityPicker((p.amenities || []).map(a => a.icon));
    document.getElementById("nl-furnished").checked = !!p.furnished;
    document.getElementById("nl-available-from").value = p.availableFrom || "";
    tiToggleAvailabilityFields();
    if (document.getElementById("nl-assign-agent")) document.getElementById("nl-assign-agent").value = p.assignedAgentId || "";
    TI_NL_TITLE_DOC = null;
    document.getElementById("nl-title-doc-type").value = (p.titleVerification && p.titleVerification.docType) || "titre_foncier";
    tiRenderTitleDocCurrent();
    if (p.shortStay) {
      const bookings = await TiDB.getBookings({ propertyId: p.id });
      const bookedDates = [];
      bookings.filter(b => b.status !== "cancelled" && b.checkin && b.checkout).forEach(b => {
        let d = new Date(b.checkin + "T00:00:00");
        const end = new Date(b.checkout + "T00:00:00");
        while (d < end) { bookedDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`); d.setDate(d.getDate() + 1); }
      });
      tiInitBlockedCalendar(p.blockedDates || [], bookedDates);
    }
    document.getElementById("new-listing-form-title").textContent = t("edit_listing");
    document.getElementById("nl-submit-btn").textContent = t("save_changes");
    document.getElementById("nl-cancel-edit").style.display = "inline-flex";
    tiWizardGoToStep(1);
    tiShowPanel("new");
  });
}

function tiCancelEditListing() {
  TI_EDITING_PROPERTY = null;
  document.getElementById("form-new-listing").reset();
  document.getElementById("nl-edit-id").value = "";
  TI_NL_PHOTOS = [];
  document.getElementById("nl-photo-preview").innerHTML = "";
  tiRenderAmenityPicker();
  TI_BLOCKED_CAL_STATE = null;
  tiToggleAvailabilityFields();
  TI_NL_PIN = null;
  TI_NL_TITLE_DOC = null;
  if (document.getElementById("nl-title-doc-type")) document.getElementById("nl-title-doc-type").value = "titre_foncier";
  tiRenderTitleDocCurrent();
  tiPopulateRegionSelect();
  document.getElementById("new-listing-form-title").textContent = t("dash_agency_new");
  document.getElementById("nl-submit-btn").textContent = t("publish");
  document.getElementById("nl-cancel-edit").style.display = "none";
  tiWizardGoToStep(1);
}

async function tiSubmitNewListing(e) {
  e.preventDefault();
  const editId = document.getElementById("nl-edit-id").value;
  if (!editId && !(await TiDB.canAddListing(TI_SESSION.agencyId))) {
    tiToast(t("listing_limit_reached"));
    return false;
  }
  const type = document.getElementById("nl-type").value;
  const kind = document.getElementById("nl-listing-kind").value;
  const title = document.getElementById("nl-title").value;
  const photos = tiGetPhotoUrlsFromForm();
  const amenities = tiReadCheckedAmenities();
  const finalPhotos = photos.length ? photos : TI_PHOTO_SETS[type];

  const prop = editId ? { ...TI_EDITING_PROPERTY } : {
    id: "p_" + Date.now(), agencyId: TI_SESSION.agencyId, rating: 0, reviews: 0, listingStatus: "pending", views: 0, createdAt: new Date().toISOString(),
  };
  if (!editId) prop.reference = await TiDB.nextPropertyReference(TI_SESSION.agencyId);
  const regionId = document.getElementById("nl-region").value;
  const deptId = document.getElementById("nl-department").value;
  const arrId = document.getElementById("nl-arrondissement").value;
  const communeId = document.getElementById("nl-commune").value;
  const commune = (TI_ADMIN_COMMUNES[arrId] || []).find(c => c.id === communeId);
  Object.assign(prop, {
    type,
    forSale: kind === "sale",
    shortStay: kind === "short",
    title, titleEn: title,
    neighborhood: (commune && commune.hoodId) || (commune ? commune.name : ""),
    region: regionId, department: deptId, arrondissement: arrId, commune: communeId,
    streetAddress: document.getElementById("nl-street-address").value.trim(),
    price: parseFloat(document.getElementById("nl-price").value),
    bedrooms: parseInt(document.getElementById("nl-beds").value) || 0,
    bathrooms: parseInt(document.getElementById("nl-baths").value) || 1,
    area: parseFloat(document.getElementById("nl-area").value),
    furnished: document.getElementById("nl-furnished").checked,
    desc: document.getElementById("nl-desc").value,
    descEn: document.getElementById("nl-desc").value,
    photos: finalPhotos,
    cover: finalPhotos[0],
    amenities,
    availableFrom: kind === "rent" ? (document.getElementById("nl-available-from").value || null) : null,
    blockedDates: kind === "short" && TI_BLOCKED_CAL_STATE ? [...TI_BLOCKED_CAL_STATE.blockedSet] : (kind === "short" ? (prop.blockedDates || []) : []),
    assignedAgentId: TI_SESSION.agentRole === "agent" ? TI_SESSION.id : (document.getElementById("nl-assign-agent")?.value || null),
  });
  if (TI_NL_PIN) {
    prop.lat = TI_NL_PIN.lat;
    prop.lng = TI_NL_PIN.lng;
  } else if (!editId || !prop.lat) {
    const nb = TI_NEIGHBORHOODS.find(n => n.id === prop.neighborhood) || TI_ADMIN_REGIONS.find(r => r.id === regionId) || { lat: 14.7167, lng: -17.4677 };
    prop.lat = nb.lat + (Math.random() - 0.5) * 0.01;
    prop.lng = nb.lng + (Math.random() - 0.5) * 0.01;
  }

  const docType = document.getElementById("nl-title-doc-type")?.value || "titre_foncier";
  if (TI_NL_TITLE_DOC) {
    const wasDecided = prop.titleVerification && ["verified", "rejected"].includes(prop.titleVerification.status);
    prop.titleVerification = {
      status: "pending", docType, fileName: TI_NL_TITLE_DOC.fileName, fileData: TI_NL_TITLE_DOC.fileData,
      submittedAt: new Date().toISOString(), verifiedAt: null, verifiedBy: null, rejectionNote: null,
    };
    if (wasDecided) tiToast(t("title_resubmitted_notice"));
  } else if (prop.titleVerification) {
    prop.titleVerification.docType = docType; // allow changing the doc type label without re-uploading
  }

  await TiDB.saveProperty(prop);
  tiToast(editId ? t("save_changes") + " ✓" : t("publish") + " ✓ — " + t("pending_validation_notice"));
  tiCancelEditListing();
  tiShowPanel("listings");
  tiRenderAgencyListings();
  tiRenderStats();
  return false;
}

const TI_DOC_TYPES = [
  { key: "id_card", label: "Pièce d'identité", labelEn: "ID document" },
  { key: "income_proof", label: "Justificatif de revenus", labelEn: "Proof of income" },
  { key: "employment", label: "Attestation de travail", labelEn: "Employment letter" },
  { key: "guarantor", label: "Garant / caution", labelEn: "Guarantor" },
  { key: "bank_statement", label: "Relevé bancaire", labelEn: "Bank statement" },
];

let TI_AGENCY_ALL_BOOKINGS = [];
async function tiRenderAgencyBookings() {
  let bookings = await TiDB.getBookings({ agencyId: TI_SESSION.agencyId });
  if (TI_SESSION.agentRole === "agent") {
    const myPropIds = new Set((await tiAgencyProperties()).map(p => p.id));
    bookings = bookings.filter(b => myPropIds.has(b.propertyId));
  }
  TI_AGENCY_ALL_BOOKINGS = bookings;
  tiSetNavBadge("bookings", bookings.filter(b => b.status === "pending").length);
  const mount = document.getElementById("agency-bookings-mount");
  if (!TI_AGENCY_ALL_BOOKINGS.length) { mount.innerHTML = tiEmptyStateHtml(t('empty_bookings'), null, null, 'document'); return; }
  mount.innerHTML = TI_AGENCY_ALL_BOOKINGS.map(b => tiAgencyBookingCardHtml(b)).join('');
}

/* ---------- Pipeline clients : actif / validation du dossier / signature du contrat ---------- */
function tiClientPipelineStage(b) {
  return tiComputeBookingStage(b);
}
let TI_CLIENTS_PIPELINE_CACHE = { requests: [], active: [], validation: [], signature: [] };
let TI_CLIENTS_ACTIVE_TAB = "requests";
async function tiRenderClientsPipeline() {
  const bookings = TI_AGENCY_ALL_BOOKINGS.length ? TI_AGENCY_ALL_BOOKINGS : await (async () => { await tiRenderAgencyBookings(); return TI_AGENCY_ALL_BOOKINGS; })();
  const buckets = { requests: [], active: [], validation: [], signature: [] };
  bookings.forEach(b => { const stage = tiClientPipelineStage(b); if (stage) buckets[stage].push(b); });
  TI_CLIENTS_PIPELINE_CACHE = buckets;

  document.getElementById("clients-pipeline-tabs").innerHTML = `
    <button class="ti-pipeline-tab ${TI_CLIENTS_ACTIVE_TAB === 'requests' ? 'active' : ''}" onclick="tiSwitchClientsTab('requests', this)">
      ${t('pipeline_requests')} <span class="ti-pipeline-count">${buckets.requests.length}</span>
    </button>
    <button class="ti-pipeline-tab ${TI_CLIENTS_ACTIVE_TAB === 'active' ? 'active' : ''}" onclick="tiSwitchClientsTab('active', this)">
      ${t('pipeline_active')} <span class="ti-pipeline-count">${buckets.active.length}</span>
    </button>
    <button class="ti-pipeline-tab ${TI_CLIENTS_ACTIVE_TAB === 'validation' ? 'active' : ''}" onclick="tiSwitchClientsTab('validation', this)">
      ${t('pipeline_validation')} <span class="ti-pipeline-count">${buckets.validation.length}</span>
    </button>
    <button class="ti-pipeline-tab ${TI_CLIENTS_ACTIVE_TAB === 'signature' ? 'active' : ''}" onclick="tiSwitchClientsTab('signature', this)">
      ${t('pipeline_signature')} <span class="ti-pipeline-count">${buckets.signature.length}</span>
    </button>`;
  tiRenderClientsTabContent();
}
function tiSwitchClientsTab(tab, btnEl) {
  TI_CLIENTS_ACTIVE_TAB = tab;
  document.querySelectorAll(".ti-pipeline-tab").forEach(el => el.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  tiRenderClientsTabContent();
}
function tiRenderClientsTabContent() {
  const list = TI_CLIENTS_PIPELINE_CACHE[TI_CLIENTS_ACTIVE_TAB] || [];
  const mount = document.getElementById("clients-mount");
  if (!list.length) {
    const emptyKeys = { requests: "pipeline_empty_requests", active: "pipeline_empty_active", validation: "pipeline_empty_validation", signature: "pipeline_empty_signature" };
    mount.innerHTML = tiEmptyStateHtml(t(emptyKeys[TI_CLIENTS_ACTIVE_TAB]), null, null, "user");
    return;
  }
  mount.innerHTML = list.map(b => {
    const prop = TI_AGENCY_ALL_PROPS.find(p => p.id === b.propertyId);
    let rightHtml = "";
    let actionsHtml = `<button class="btn btn-outline btn-sm" onclick="tiShowPanel('bookings');tiScrollToBooking('${b.id}')">${t('view_details')}</button>`;
    if (TI_CLIENTS_ACTIVE_TAB === "requests") {
      rightHtml = `<span class="badge badge-pending">${t('pipeline_requests')}</span>`;
      actionsHtml = `
        <button class="btn btn-sm btn-primary" onclick="tiSetBookingStatus('${b.id}','confirmed')">${t('action_approve')}</button>
        <button class="btn btn-sm btn-outline" onclick="tiOpenDocRequestModal('${b.id}')">${TI_ICONS.document} ${t('request_documents')}</button>`;
    } else if (TI_CLIENTS_ACTIVE_TAB === "active") {
      rightHtml = tiPaymentStatusBadge(b.propertyId) || `<span class="badge badge-confirmed">${t('status_active')}</span>`;
    } else if (TI_CLIENTS_ACTIVE_TAB === "validation") {
      const labelKey = "dossier_status_" + b.dossierStatus;
      rightHtml = `<span class="badge badge-pending">${t(labelKey)}</span>`;
    } else {
      const pending = (b.contracts || []).filter(c => !c.signed).length;
      rightHtml = `<span class="badge badge-review">${pending} ${t('contracts_awaiting_signature')}</span>`;
    }
    return `
    <div class="ti-list-row">
      <span class="ti-agency-avatar">${b.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
      <div class="ti-list-row-body">
        <strong>${tiEscapeHtml(b.name)}</strong> ${rightHtml}<br>
        <span style="color:var(--ink-soft);font-size:.85rem;">${b.phone || ''} · ${b.email || ''}</span><br>
        <span style="color:var(--ink-soft);font-size:.85rem;">${b.propertyTitle}${prop && prop.reference ? ` · <span class="ti-card-ref" style="display:inline;">${t('reference_label')} ${prop.reference}</span>` : ''}${TI_CLIENTS_ACTIVE_TAB === 'requests' && b.checkin ? ` · ${t('requested_date_label')} ${b.checkin}` : ''}</span>
      </div>
      <div class="ti-list-row-actions">
        ${actionsHtml}
      </div>
    </div>`;
  }).join('');
}
function tiScrollToBooking(bookingId) {
  setTimeout(() => {
    const card = [...document.querySelectorAll('.ti-booking-card')].find(el => el.dataset.bookingId === bookingId);
    if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('map-highlight'); setTimeout(() => card.classList.remove('map-highlight'), 2000); }
  }, 150);
}

function tiAgencyDossierDocsListHtml(b) {
  return `
    <div class="ti-dossier-docs">
      ${b.documentRequests.map(doc => `
        <div class="ti-dossier-doc">
          <div class="ti-dossier-doc-info">
            <span class="ti-doc-status-dot ${doc.status}"></span>
            <span class="ti-dossier-doc-label">${tiEscapeHtml(tiDocLabel(doc))}</span>
            ${doc.fileName ? `<span class="ti-doc-filename">${tiEscapeHtml(doc.fileName)}</span>` : ''}
            ${doc.fileData ? `<button type="button" class="ti-doc-view-link" onclick="tiOpenDocumentByKey('${b.id}','${doc.key}')">${TI_ICONS.eye} ${t('view_document')}</button>` : ''}
          </div>
          ${doc.status === 'rejected' && doc.note ? `<div class="ti-doc-note">${tiEscapeHtml(doc.note)}</div>` : ''}
          <div class="ti-dossier-doc-actions">
            ${tiDocStatusBadge(doc.status)}
            ${doc.status === 'submitted' ? `
              <button class="btn btn-sm btn-primary" onclick="tiReviewDocument('${b.id}','${doc.key}','approved')">${TI_ICONS.check} ${t('approve_document')}</button>
              <button class="btn btn-sm btn-outline" onclick="tiPromptRejectDocument('${b.id}','${doc.key}')">${t('reject_document')}</button>
            ` : doc.status === 'approved' ? `<span class="ti-doc-approved-check">${TI_ICONS.check}</span>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}
function tiAgencyDossierStepperHtml(b) {
  const stage = tiComputeBookingStage(b);
  if (!stage) return `<div class="ti-list-row-actions" style="margin-top:10px;"><button class="btn btn-sm btn-outline" onclick="tiOpenDocRequestModal('${b.id}')">${TI_ICONS.document} ${t('request_documents')}</button></div>`;
  const hasDossier = b.documentRequests && b.documentRequests.length;
  const stageOrder = ["requests", "validation", "signature", "active"];
  const currentIndex = stageOrder.indexOf(stage);
  const due = (stage === "validation") ? tiDueDateInfo(b.dossierDueAt) : null;
  const stages = [
    { key: "requests", title: t('pipeline_requests') },
    { key: "validation", title: t('dossier_step_documents') },
    { key: "signature", title: t('dossier_step_signature') },
    { key: "active", title: t('dossier_step_active') },
  ];
  return `
    <div class="ti-stepper">
      ${stages.map((s, i) => {
        const state = i < currentIndex ? "completed" : i === currentIndex ? "active" : "upcoming";
        return `
        <div class="ti-stepper-step ti-stepper-${state}">
          <div class="ti-stepper-connector-line ${i === 0 ? 'ti-stepper-connector-hidden' : ''}"></div>
          <div class="ti-stepper-marker">${state === 'completed' ? TI_ICONS.check : (i + 1)}</div>
          <div class="ti-stepper-body">
            <div class="ti-stepper-title">${s.title}${state === 'active' && s.key === 'validation' && due ? `
              <span class="ti-stepper-due ti-stepper-due-${due.urgency}">
                ${due.urgency === 'overdue' ? t('due_date_overdue') : t('due_date_prefix') + ' ' + due.label}
              </span>` : ''}</div>
            ${state === 'active' && s.key === 'requests' ? `
              <div class="ti-list-row-actions" style="margin-top:8px;">
                <button class="btn btn-sm btn-primary" onclick="tiSetBookingStatus('${b.id}','confirmed')">${t('action_approve')}</button>
                <button class="btn btn-sm btn-outline" onclick="tiSetBookingStatus('${b.id}','cancelled')">${t('action_reject')}</button>
              </div>` : ''}
            ${state === 'active' && s.key === 'validation' ? `
              <div class="ti-stepper-status">${tiDossierStatusBadge(b.dossierStatus)}</div>
              ${hasDossier ? tiAgencyDossierDocsListHtml(b) : `<button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="tiOpenDocRequestModal('${b.id}')">${TI_ICONS.document} ${t('request_documents')}</button>`}` : ''}
            ${state === 'active' && s.key === 'signature' ? `<div class="ti-stepper-status">${t('dossier_step_signature_waiting')}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}
function tiAgencyBookingCardHtml(b) {
  return `
    <div class="ti-booking-card" data-booking-id="${b.id}">
      <div class="ti-booking-card-head">
        <div>
          <strong>${tiEscapeHtml(b.propertyTitle)}</strong>
          <div class="ti-booking-meta">${tiEscapeHtml(b.name)} · ${tiEscapeHtml(b.phone)} · ${b.checkin || '—'}</div>
        </div>
        ${tiStatusBadge(b.status)}
      </div>
      ${tiAgencyDossierStepperHtml(b)}
      ${b.rental ? `
        <div class="ti-dossier ti-rental-ledger">
          <div class="ti-dossier-head">
            <span class="ti-dossier-icon">${TI_ICONS.home}</span>
            <strong>${t('rental_ledger_title')}</strong>
            <button class="btn btn-sm btn-outline" style="margin-left:auto;" onclick="tiOpenChargesModal('${b.id}')">${t('manage_charges')}</button>
          </div>
          <div class="ti-rental-deposit-row">
            <span>${t('deposit_label')}</span>
            <span class="ti-rental-deposit-amount" data-price-xof="${b.rental.deposit.amount}">${tiFormatPrice(b.rental.deposit.amount)}</span>
            ${tiRentalStatusBadge(b.rental.deposit.status)}
          </div>
          ${b.rental.charges.some(c => c.enabled) ? `
            <div class="ti-charges-chips">
              ${b.rental.charges.filter(c => c.enabled).map(c => `<span class="ti-charge-chip">${tiChargeLabel(c)} · <span data-price-xof="${c.amount}">${tiFormatPrice(c.amount)}</span></span>`).join('')}
            </div>` : `<p class="ti-rental-no-charges">${t('no_charges_active')}</p>`}
          <table class="ti-rental-schedule-table">
            <thead><tr><th>${t('due_date_label')}</th><th>${t('rent_label')}</th><th>${t('charges_label')}</th><th>${t('total_label')}</th><th></th></tr></thead>
            <tbody>
              ${b.rental.schedule.map(item => {
                const overdue = item.status === "pending" && item.dueDate < tiTodayIsoA();
                return `<tr>
                <td>${tiFormatMonth(item.dueDate)}</td>
                <td data-price-xof="${item.rent}">${tiFormatPrice(item.rent)}</td>
                <td data-price-xof="${item.chargesAmount}">${tiFormatPrice(item.chargesAmount)}</td>
                <td data-price-xof="${item.rent + item.chargesAmount}"><strong>${tiFormatPrice(item.rent + item.chargesAmount)}</strong></td>
                <td>${tiRentalStatusBadge(item.status, overdue)}</td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : ''}
      ${b.status === 'confirmed' ? `
        <div class="ti-dossier ti-contract-section">
          <div class="ti-dossier-head">
            <span class="ti-dossier-icon">${TI_ICONS.document}</span>
            <strong>${t('contract_document_title')}</strong>
          </div>
          ${(b.contracts && b.contracts.length) ? b.contracts.map(c => `
            <div class="ti-dossier-doc">
              <div class="ti-dossier-doc-info">
                <span class="ti-doc-status-dot approved"></span>
                <span class="ti-dossier-doc-label">${t('contract_sent_label')}</span>
                <span class="ti-doc-filename">${c.fileName}</span>
                ${c.fileData ? `<button type="button" class="ti-doc-view-link" onclick="tiOpenDocumentByKeyContract('${b.id}','${c.id}')">${TI_ICONS.eye} ${t('view_document')}</button>` : ''}
              </div>
              <div style="color:var(--ink-soft);font-size:.78rem;margin-top:4px;">${t('sent_on_label')} ${new Date(c.sentAt).toLocaleDateString(tiGetLang() === 'en' ? 'en-US' : 'fr-FR')}</div>
            </div>`).join('') : `<p class="ti-rental-no-charges">${t('no_contract_yet')}</p>`}
          <label class="btn btn-outline btn-sm ti-upload-btn" style="margin-top:10px;">
            ${TI_ICONS.upload} ${t('send_contract')}
            <input type="file" accept="application/pdf,.pdf" onchange="tiSendContract(event,'${b.id}')">
          </label>
        </div>` : ''}
    </div>`;
}

function tiOpenDocumentByKeyContract(bookingId, contractId) {
  const booking = TI_AGENCY_ALL_BOOKINGS.find(b => b.id === bookingId);
  const contract = booking?.contracts?.find(c => c.id === contractId);
  if (contract?.fileData) tiOpenDocument(contract.fileData, contract.fileName);
}

async function tiSendContract(e, bookingId) {
  const file = e.target.files[0];
  if (!file) return;
  let fileData = null;
  let tooLarge = false;
  if (file.size <= TI_MAX_DOC_PREVIEW_SIZE) {
    try { fileData = await tiReadFileAsDataUrl(file); } catch (err) { console.error(err); }
  } else {
    tooLarge = true;
  }
  const ctrBooking = TI_AGENCY_ALL_BOOKINGS.find(b => b.id === bookingId);
  const result = await TiDB.sendContract(bookingId, file.name, fileData);
  const fallback = tooLarge || result?._storageFallback;
  tiToast(t('contract_sent_toast') + (fallback ? ` (${t('file_too_large_note')})` : ''));
  tiLogAgencyAction("contract_sent", "booking", bookingId, ctrBooking ? ctrBooking.propertyTitle : bookingId, file.name);
  await tiRefreshPanel("bookings");
}

function tiRentalStatusBadge(status, overdue) {
  if (status === "pending" && overdue) return `<span class="badge badge-cancelled">${t("rental_status_overdue")}</span>`;
  const map = { paid: ["status_paid", "badge-paid"], pending: ["rental_status_pending", "badge-pending"] };
  const [key, cls] = map[status] || map.pending;
  return `<span class="badge ${cls}">${t(key)}</span>`;
}
function tiChargeLabel(c) { return tiGetLang() === "en" ? c.labelEn : c.label; }

let TI_CHARGES_BOOKING_ID = null;
function tiOpenChargesModal(bookingId) {
  TI_CHARGES_BOOKING_ID = bookingId;
  const booking = TI_AGENCY_ALL_BOOKINGS.find(b => b.id === bookingId);
  if (!booking) return;
  document.getElementById("charges-checklist").innerHTML = booking.rental.charges.map((c, i) => `
    <div class="ti-charge-row">
      <label class="ti-amenity-option">
        <input type="checkbox" data-idx="${i}" class="ti-charge-toggle" ${c.enabled ? "checked" : ""}>
        <span>${TI_ICONS.check}</span> ${tiChargeLabel(c)}
      </label>
      <input type="number" class="ti-charge-amount" data-idx="${i}" value="${c.amount}" min="0" placeholder="${t('amount_label')}">
    </div>`).join('');
  tiOpenModal("modal-charges");
}
async function tiSubmitCharges(e) {
  e.preventDefault();
  const booking = TI_AGENCY_ALL_BOOKINGS.find(b => b.id === TI_CHARGES_BOOKING_ID);
  if (!booking) return false;
  const charges = booking.rental.charges.map((c, i) => {
    const toggle = document.querySelector(`.ti-charge-toggle[data-idx="${i}"]`);
    const amountInput = document.querySelector(`.ti-charge-amount[data-idx="${i}"]`);
    return { ...c, enabled: toggle.checked, amount: parseFloat(amountInput.value) || 0 };
  });
  await TiDB.setRentalCharges(TI_CHARGES_BOOKING_ID, charges);
  tiToast(t("save_changes") + " ✓");
  tiCloseModal("modal-charges");
  tiLogAgencyAction("charges_updated", "booking", TI_CHARGES_BOOKING_ID, booking.propertyTitle, charges.filter(c => c.enabled).map(c => tiChargeLabel(c)).join(", ") || t('no_charges_active'));
  await tiRefreshPanel("bookings");
  return false;
}

function tiOpenDocumentByKey(bookingId, docKey) {
  const booking = TI_AGENCY_ALL_BOOKINGS.find(b => b.id === bookingId);
  const doc = booking?.documentRequests?.find(d => d.key === docKey);
  if (doc?.fileData) tiOpenDocument(doc.fileData, doc.fileName);
}

function tiDocStatusBadge(status) {
  const map = { pending: "doc_status_pending", submitted: "doc_status_submitted", approved: "doc_status_approved", rejected: "doc_status_rejected" };
  return `<span class="badge ti-doc-badge-${status}">${t(map[status] || status)}</span>`;
}
function tiDossierStatusBadge(status) {
  const map = {
    awaiting_documents: ["dossier_status_awaiting_documents", "badge-pending"],
    under_review: ["dossier_status_under_review", "badge-review"],
    changes_needed: ["dossier_status_changes_needed", "badge-cancelled"],
    approved: ["dossier_status_approved", "badge-confirmed"],
  };
  const [key, cls] = map[status] || ["", "badge-pending"];
  return key ? `<span class="badge ${cls}">${t(key)}</span>` : "";
}
function tiDocLabel(doc) {
  return tiGetLang() === "en" && doc.labelEn ? doc.labelEn : doc.label;
}

let TI_DOC_REQUEST_BOOKING_ID = null;
let TI_DOC_REQUEST_RETURN_PANEL = "bookings";
function tiOpenDocRequestModal(bookingId) {
  TI_DOC_REQUEST_BOOKING_ID = bookingId;
  TI_DOC_REQUEST_RETURN_PANEL = tiGetActivePanelName() || "bookings";
  const mount = document.getElementById("doc-request-checklist");
  mount.innerHTML = TI_DOC_TYPES.map(d => `
    <label class="ti-amenity-option">
      <input type="checkbox" value="${d.key}" data-label="${d.label}" data-label-en="${d.labelEn}">
      <span>${TI_ICONS.document}</span> ${tiGetLang() === "en" ? d.labelEn : d.label}
    </label>`).join('');
  document.getElementById("doc-request-custom").value = "";
  tiOpenModal("modal-doc-request");
}
async function tiSubmitDocRequest(e) {
  e.preventDefault();
  const checked = [...document.querySelectorAll('#doc-request-checklist input:checked')].map(cb => ({
    key: cb.value, label: cb.dataset.label, labelEn: cb.dataset.labelEn,
  }));
  const custom = document.getElementById("doc-request-custom").value.trim();
  if (custom) checked.push({ key: "custom_" + Date.now(), label: custom, labelEn: custom });
  if (!checked.length) { tiToast(t('request_documents_sub')); return false; }
  const reqBooking = TI_AGENCY_ALL_BOOKINGS.find(b => b.id === TI_DOC_REQUEST_BOOKING_ID);
  await TiDB.requestDocuments(TI_DOC_REQUEST_BOOKING_ID, checked);
  tiToast(t('send_request') + " ✓");
  tiCloseModal("modal-doc-request");
  tiLogAgencyAction("documents_requested", "booking", TI_DOC_REQUEST_BOOKING_ID, reqBooking ? reqBooking.propertyTitle : TI_DOC_REQUEST_BOOKING_ID, checked.map(c => c.label).join(", "));
  await tiRefreshPanel(TI_DOC_REQUEST_RETURN_PANEL);
  return false;
}

async function tiReviewDocument(bookingId, docKey, status, note) {
  const booking = TI_AGENCY_ALL_BOOKINGS.find(b => b.id === bookingId);
  await TiDB.reviewDocument(bookingId, docKey, status, note);
  tiToast((status === "approved" ? t('approve_document') : t('reject_document')) + " ✓");
  tiLogAgencyAction(status === "approved" ? "document_approved" : "document_rejected", "booking", bookingId, booking ? booking.propertyTitle : bookingId, docKey);
  await tiRefreshPanel("bookings");
}
function tiPromptRejectDocument(bookingId, docKey) {
  const note = prompt(t('reject_note_placeholder'));
  if (note === null) return; // cancelled
  tiReviewDocument(bookingId, docKey, "rejected", note);
}

async function tiSetBookingStatus(id, status) {
  const bookingForLog = TI_AGENCY_ALL_BOOKINGS.find(b => b.id === id);
  const bookingLabel = bookingForLog ? bookingForLog.propertyTitle : id;
  await TiDB.updateBookingStatus(id, status);
  if (status === "confirmed") {
    const booking = (await TiDB.getBookings({ agencyId: TI_SESSION.agencyId })).find(b => b.id === id);
    const prop = booking ? await TiDB.getProperty(booking.propertyId) : null;
    if (prop && !prop.forSale && !prop.shortStay) await TiDB.ensureRentalLedger(id);
  }
  tiToast((status === "confirmed" ? t('action_approve') : t('action_reject')) + " ✓");
  tiLogAgencyAction(status === "confirmed" ? "booking_confirmed" : "booking_rejected", "booking", id, bookingLabel);
  await tiRefreshPanel(tiGetActivePanelName() || "bookings");
}

async function tiRenderAgencyMessages() {
  let msgs = await TiDB.getMessages({ agencyId: TI_SESSION.agencyId });
  if (TI_SESSION.agentRole === "agent") {
    const myPropIds = new Set((await tiAgencyProperties()).map(p => p.id));
    msgs = msgs.filter(m => myPropIds.has(m.propertyId));
  }
  const mount = document.getElementById("agency-messages-mount");
  if (!msgs.length) { mount.innerHTML = tiEmptyStateHtml(t('empty_messages'), null, null, 'mail'); return; }
  const byProperty = {};
  msgs.forEach(m => { (byProperty[m.propertyId] = byProperty[m.propertyId] || []).push(m); });
  mount.innerHTML = Object.entries(byProperty).map(([propId, list]) => `
    <div class="ti-list-row" style="align-items:flex-start;flex-direction:column;">
      <strong>${list[0].propertyTitle}</strong>
      <div class="ti-msg-thread" style="margin-top:10px;width:100%;">
        ${list.map(m => `<div class="ti-msg-bubble ${m.from === 'client' ? 'ti-msg-them' : 'ti-msg-me'}"><small style="opacity:.7">${tiEscapeHtml(m.userName || '')}</small><br>${tiEscapeHtml(m.text)}</div>`).join('')}
      </div>
      <form onsubmit="return tiAgencyReply(event,'${propId}','${list[0].userId}')" style="display:flex;gap:8px;width:100%;margin-top:10px;">
        <input type="text" placeholder="${t('message_placeholder')}" required style="flex:1;">
        <button class="btn btn-primary btn-sm" data-i18n="action_reply">${t('action_reply')}</button>
      </form>
    </div>`).join('');
}
async function tiAgencyReply(e, propertyId, userId) {
  e.preventDefault();
  const input = e.target.querySelector("input");
  const props = await TiDB.getProperties();
  const prop = props.find(p => p.id === propertyId);
  await TiDB.sendMessage({
    propertyId, propertyTitle: prop ? tiPropertyTitle(prop) : propertyId,
    agencyId: TI_SESSION.agencyId, userId, userName: TI_SESSION.name, from: "agency", text: input.value
  });
  input.value = "";
  tiRenderAgencyMessages();
  return false;
}

/* ---------- Annonces (diffusions de l'agence vers les locataires) ---------- */
function tiSyncAnnouncementPreview() {
  const preview = document.getElementById("an-live-preview");
  if (!preview) return;
  const title = document.getElementById("an-title").value.trim();
  const textEl = document.getElementById("an-text");
  const text = textEl ? textEl.value.trim() : "";
  const targetSelect = document.getElementById("an-target");
  const targetLabel = targetSelect.selectedIndex > 0 ? targetSelect.options[targetSelect.selectedIndex].textContent : t('announcement_target_all');
  if (!title && !text) {
    preview.innerHTML = `<p style="color:var(--ink-soft);font-size:.85rem;">${t('announcement_preview_empty')}</p>`;
    return;
  }
  preview.innerHTML = `
    <div class="ti-announcement-card">
      <div class="ti-announcement-head">
        <strong>${tiEscapeHtml(title) || t('announcement_title_label')}</strong>
        <span class="ti-announcement-date">${t('announcement_preview_now')}</span>
      </div>
      <span class="ti-announcement-agency">${tiEscapeHtml(TI_SESSION.agencyId ? tiAgencyName(TI_SESSION.agencyId) : '')} · ${tiEscapeHtml(targetLabel)}</span>
      <div>${tiRenderMiniMarkdown(text, {})}</div>
    </div>`;
}
async function tiRenderAnnouncementsPage() {
  const props = await tiAgencyProperties();
  const targetSelect = document.getElementById("an-target");
  targetSelect.innerHTML = `<option value="">${t('announcement_target_all')}</option>` +
    props.map(p => `<option value="${p.id}">${tiEscapeHtml(tiPropertyTitle(p))}</option>`).join("");

  document.getElementById("an-text-editor-mount").innerHTML = tiRichEditorHtml("an-text", [], "", {}, "tiSyncAnnouncementPreview");
  document.getElementById("an-title").value = "";
  tiSyncAnnouncementPreview();

  const list = await TiDB.getAnnouncements({ agencyId: TI_SESSION.agencyId });
  const mount = document.getElementById("announcements-agency-mount");
  if (!list.length) { mount.innerHTML = tiEmptyStateHtml(t('announcement_history_empty'), null, null, 'bell'); return; }
  mount.innerHTML = list.map(a => {
    const prop = a.propertyId ? props.find(p => p.id === a.propertyId) : null;
    return `
    <div class="ti-announcement-card">
      <div class="ti-announcement-head">
        <strong>${tiEscapeHtml(a.title)}</strong>
        <span class="ti-announcement-date">${tiFormatDateTime(a.createdAt)}</span>
      </div>
      <span class="ti-announcement-agency">${prop ? tiEscapeHtml(tiPropertyTitle(prop)) : t('announcement_target_all')}</span>
      <p>${tiEscapeHtml(a.text)}</p>
      <button type="button" class="btn btn-outline btn-sm" onclick="tiDeleteAnnouncementRow('${a.id}')" data-i18n="action_delete">${t('action_delete')}</button>
    </div>`;
  }).join('');
}
async function tiSubmitAnnouncement(e) {
  e.preventDefault();
  await TiDB.createAnnouncement({
    agencyId: TI_SESSION.agencyId,
    propertyId: document.getElementById("an-target").value || null,
    title: document.getElementById("an-title").value.trim(),
    text: document.getElementById("an-text").value.trim(),
  });
  tiToast(t('announcement_published_toast'));
  e.target.reset();
  tiRenderAnnouncementsPage();
  return false;
}
async function tiDeleteAnnouncementRow(id) {
  if (!confirm(t('confirm_delete_announcement'))) return;
  await TiDB.deleteAnnouncement(id);
  tiRenderAnnouncementsPage();
}

/* ---------- Kit de bienvenue (documents attachés automatiquement pour les nouveaux locataires) ---------- */
async function tiRenderWelcomeKit() {
  const kit = await TiDB.getWelcomeKit(TI_SESSION.agencyId);
  const mount = document.getElementById("welcomekit-mount");
  mount.innerHTML = kit.map(d => `
    <div class="ti-subsite-panel" style="margin-bottom:12px;">
      <div class="ti-subsite-toggle-row">
        <div>
          <strong>${tiEscapeHtml(d.title)}</strong>
          <p style="color:var(--ink-soft);font-size:.84rem;margin:4px 0 0;max-width:60ch;">${tiEscapeHtml(d.content)}</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <label class="ti-switch">
            <input type="checkbox" ${d.enabled ? 'checked' : ''} onchange="tiToggleWelcomeKit('${d.id}')">
            <span class="ti-switch-track"></span>
          </label>
          <button type="button" class="btn btn-outline btn-sm" onclick="tiOpenWelcomeKitModal('${d.id}')" data-i18n="action_edit">${t('action_edit')}</button>
          <button type="button" class="btn btn-danger btn-sm" onclick="tiDeleteWelcomeKitDoc('${d.id}')" data-i18n="action_delete">${t('action_delete')}</button>
        </div>
      </div>
    </div>`).join('');
}
const TI_WELCOME_KIT_VARIABLES = [
  { key: "client_name", label: "Prénom du locataire" },
  { key: "property_title", label: "Nom du bien" },
  { key: "agency_name", label: "Nom de l'agence" },
];
const TI_WELCOME_KIT_SAMPLE_VARS = { client_name: "Awa", property_title: "Appartement 3 pièces — Almadies", agency_name: "Sahel Habitat" };

async function tiOpenWelcomeKitModal(id) {
  document.getElementById("wk-id").value = id || "";
  document.getElementById("wk-title").value = "";
  let initialContent = "";
  if (id) {
    const kit = await TiDB.getWelcomeKit(TI_SESSION.agencyId);
    const item = kit.find(d => d.id === id);
    document.getElementById("wk-title").value = item ? item.title : "";
    initialContent = item ? item.content : "";
  }
  document.getElementById("wk-content-editor-mount").innerHTML = tiRichEditorHtml("wk-content", TI_WELCOME_KIT_VARIABLES, initialContent, TI_WELCOME_KIT_SAMPLE_VARS);
  tiRichEditorSyncPreview("wk-content");
  tiOpenModal("modal-welcomekit-item");
}
async function tiSubmitWelcomeKitItem(e) {
  e.preventDefault();
  const id = document.getElementById("wk-id").value;
  let enabled = true;
  if (id) {
    const kit = await TiDB.getWelcomeKit(TI_SESSION.agencyId);
    const existing = kit.find(d => d.id === id);
    if (existing) enabled = existing.enabled;
  }
  await TiDB.saveWelcomeKitItem(TI_SESSION.agencyId, {
    id: id || undefined,
    title: document.getElementById("wk-title").value.trim(),
    content: document.getElementById("wk-content").value.trim(),
    enabled,
  });
  tiCloseModal("modal-welcomekit-item");
  tiToast(t('save_changes') + " ✓");
  tiRenderWelcomeKit();
  return false;
}
async function tiToggleWelcomeKit(id) {
  await TiDB.toggleWelcomeKitItem(TI_SESSION.agencyId, id);
  tiRenderWelcomeKit();
}
async function tiDeleteWelcomeKitDoc(id) {
  if (!confirm(t('confirm_delete_welcomekit_doc'))) return;
  await TiDB.deleteWelcomeKitItem(TI_SESSION.agencyId, id);
  tiRenderWelcomeKit();
}

async function tiRenderAgencyReviews() {
  const props = await tiAgencyProperties();
  const all = await TiDB.getAllReviews();
  const reviews = all.filter(r => props.some(p => p.id === r.propertyId));
  tiRenderReviewInsights("agency-reviews-insight-mount", reviews);
  const mount = document.getElementById("agency-reviews-mount");
  mount.innerHTML = reviews.length ? reviews.map(r => {
    const prop = props.find(p => p.id === r.propertyId);
    return `<div class="ti-review">
      <div class="ti-review-head"><span>${prop ? tiPropertyTitle(prop) : ''} — ${tiEscapeHtml(r.userName)}</span>${tiStarsHtml(r.rating)}</div>
      ${tiReviewTagsHtml(r.tags)}
      ${r.comment ? `<p style="margin:6px 0 0;color:var(--ink-soft);">${tiEscapeHtml(r.comment)}</p>` : ''}
    </div>`;
  }).join('') : `<p style="color:var(--ink-soft)">—</p>`;
}

function tiUpdateRoleLabel() {
  const roleLabel = document.querySelector(".ti-dash-role");
  if (!roleLabel) return;
  roleLabel.removeAttribute("data-i18n"); // prevent tiApplyLang() from resetting this dynamic label
  roleLabel.textContent = (TI_SESSION.agentRole === "agent") ? t("role_agent") : t("role_agency");
}
document.addEventListener("ti:langchange", () => { if (typeof TI_SESSION !== "undefined" && TI_SESSION) tiUpdateRoleLabel(); });

async function tiInitAgencyDashboard() {
  tiRenderHeader();
  tiRenderFooter();
  tiRenderImpersonationBanner();
  document.getElementById("stats-mount").innerHTML = tiSkeletonStatCardsHtml(9);
  document.getElementById("views-trend-chart-mount").innerHTML = `<div class="ti-skel-block ti-shimmer" style="height:180px;"></div>`;
  document.getElementById("charts-mount").innerHTML = tiSkeletonChartCardHtml() + tiSkeletonChartCardHtml() + tiSkeletonChartCardHtml();
  document.getElementById("dash-name").textContent = TI_SESSION.name;
  tiUpdateRoleLabel();
  tiPopulateRegionSelect();
  tiRenderAmenityPicker();
  tiToggleAvailabilityFields();
  tiWizardGoToStep(1);
  const isSupervisor = TI_SESSION.agentRole === "supervisor";
  const navAgents = document.getElementById("nav-agents");
  if (navAgents) navAgents.style.display = isSupervisor ? "" : "none";
  const navAudit = document.getElementById("nav-audit");
  if (navAudit) navAudit.style.display = isSupervisor ? "" : "none";
  const assignWrap = document.getElementById("nl-assign-wrap");
  if (assignWrap) assignWrap.style.display = isSupervisor ? "" : "none";
  await tiLoadAgentsCache();
  tiPopulateAssignAgentSelect();
  await new Promise(r => setTimeout(r, 350));
  const tasks = [tiRenderStats(), tiRenderAgencyListings(), tiRenderAgencyBookings(), tiRenderAgencyMessages(), tiRenderAgencyReviews(), tiRenderAnnouncementsPage(), tiRenderWelcomeKit()];
  if (isSupervisor) { tasks.push(tiRenderAgents()); tasks.push(tiRenderAudit()); }
  await Promise.all(tasks);
  await tiRenderClientsPipeline();
  await tiRenderFavorites();
  tiApplyPanelFromUrl(["stats", "listings", "new", "bookings", "clients", "announcements", "welcomekit", "messages", "reviews", "agents", "audit", "reports", "favorites"]);
}
if (TI_SESSION) tiInitAgencyDashboard();
