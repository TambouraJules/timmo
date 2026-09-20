/* ============================================================
   Timmo — utilitaires d'interface partagés sur toutes les pages
   ============================================================ */

/* ---------- Filet de sécurité global ----------
   Si quelque chose d'inattendu plante quelque part sur le site, ne pas
   laisser la personne face à une page blanche ou à moitié chargée.
   Afficher une petite bannière récupérable avec une option de
   rechargement/réinitialisation plutôt que d'échouer silencieusement.
   C'est un dernier recours — cela ne remplace jamais la correction du
   vrai bug, mais cela évite qu'un bug ne « bloque » complètement une page. */
window.addEventListener("error", (e) => tiShowCrashBanner(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => tiShowCrashBanner(e.reason));

let tiCrashBannerShown = false;
function tiShowCrashBanner(err) {
  if (tiCrashBannerShown) return;
  tiCrashBannerShown = true;
  console.error("Timmo — erreur inattendue:", err);
  const bar = document.createElement("div");
  bar.className = "ti-crash-banner";
  bar.innerHTML = `
    <span>Un problème d'affichage est survenu. Rechargez la page — si cela persiste, réinitialisez les données locales de démonstration.</span>
    <span class="ti-crash-actions">
      <button onclick="location.reload()">Recharger</button>
      <button onclick="localStorage.clear(); location.reload()">Réinitialiser les données</button>
      <button onclick="this.closest('.ti-crash-banner').remove()" aria-label="Fermer">&times;</button>
    </span>`;
  document.body.prepend(bar);
}

const TI_ICONS = {
  home: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 20 22 8l14 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 18v16h20V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 34v-8h8v8" stroke="currentColor" stroke-width="2"/></svg>`,
  office: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="6" width="24" height="32" rx="1" stroke="currentColor" stroke-width="2"/><path d="M16 14h4M24 14h4M16 20h4M24 20h4M16 26h4M24 26h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 38v-6h8v6" stroke="currentColor" stroke-width="2"/></svg>`,
  land: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 30 16 16l8 8 6-10 8 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 36h36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="8" y="8" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>`,
  star: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.2 6.1-.6L10 1.5z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.9-10-9.3C.4 8 2 4 6 4c2.2 0 3.8 1.3 6 4 2.2-2.7 3.8-4 6-4 4 0 5.6 4 4 7.7C19.5 16.1 12 21 12 21z"/></svg>`,
  heartFilled: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.9-10-9.3C.4 8 2 4 6 4c2.2 0 3.8 1.3 6 4 2.2-2.7 3.8-4 6-4 4 0 5.6 4 4 7.7C19.5 16.1 12 21 12 21z"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 3a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c1 .3 2 .5 3 .7a2 2 0 0 1 1.7 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2" stroke-linecap="round"/><path d="m2 7 10 6 10-6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3"/></svg>`,
  arrowUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 3 4.7 4.1.6.3 1.1.4 1.5.6.6.2 1.2.1 1.6.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.2-.5-.3Z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3V8c0-.9.2-1.5 1.6-1.5H17V3.6C16.7 3.6 15.7 3.5 14.5 3.5c-2.5 0-4.2 1.5-4.2 4.3v2.1H7.5V13h2.8v8h3.2Z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7" stroke-linecap="round"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/></svg>`,
  document: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 3v5h5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 13h6M9 17h6" stroke-linecap="round"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M7 9l5-5 5 5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m4 12 5 5L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>`,
  alertTriangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 2 20h20L12 3Z" stroke-linejoin="round"/><path d="M12 10v4" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>`,
  editPencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke-linejoin="round"/><path d="M13.5 6.5l3 3" stroke-linecap="round"/></svg>`,
  moreVertical: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" stroke-linecap="round"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" stroke-linecap="round" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke-linecap="round"/></svg>`,
  buildingCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 9h5a1 1 0 0 1 1 1v11M8 8h1M8 12h1M8 16h1" stroke-linecap="round"/><path d="m16 15 1.5 1.5L21 13" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  headset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke-linecap="round"/><rect x="2" y="13" width="5" height="7" rx="1.5"/><rect x="17" y="13" width="5" height="7" rx="1.5"/><path d="M20 20v1a2 2 0 0 1-2 2h-4" stroke-linecap="round"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18" stroke-linecap="round"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 14h2" stroke-linecap="round"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 20c0-3.3-2.7-6-6-6s-6 2.7-6 6" stroke-linecap="round"/><circle cx="11" cy="8" r="3"/><path d="M20 20c0-2.6-1.7-4.8-4-5.6" stroke-linecap="round"/><path d="M15.5 3.5a3 3 0 0 1 0 5.8" stroke-linecap="round"/></svg>`,
  barChart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M12 20V4M20 20v-7" stroke-linecap="round"/><path d="M2 20h20" stroke-linecap="round"/></svg>`,
};

/* ---------- En-tête / Pied de page ---------- */
function tiRenderHeader(active, subsite) {
  const mount = document.getElementById("ti-header");
  if (!mount) return;
  const s = tiGetSession ? tiGetSession() : null;
  const brandHtml = subsite
    ? `<a href="listings.html?agency=${subsite.slug}" class="ti-brand">
         ${subsite.logoDataUrl ? `<img src="${subsite.logoDataUrl}" alt="${tiEscapeHtml(subsite.name)}" class="ti-brand-logo-custom">` : `<span class="ti-brand-mark">${TI_ICONS.home}</span>`} ${tiEscapeHtml(subsite.name)}
       </a>`
    : `<a href="index.html" class="ti-brand">
         <img src="assets/brand/timmo-logo-primary.svg" alt="Timmo" class="ti-brand-logo">
       </a>`;
  mount.innerHTML = `
    ${TI_BACKEND === "local" ? `<div class="ti-demo-banner" data-i18n="db_banner">${t("db_banner")}</div>` : ""}
    ${subsite ? `<div class="ti-subsite-banner"><span>${t('subsite_banner_text')} <strong>${tiEscapeHtml(subsite.name)}</strong></span><a href="index.html">${t('subsite_return_link')} →</a></div>` : ""}
    <div class="ti-header-inner">
      ${brandHtml}
      <nav class="ti-nav" id="ti-nav">
        <a href="listings.html?tab=rent${subsite ? '&agency=' + subsite.slug : ''}" class="${active === 'rent' ? 'active' : ''}" data-i18n="nav_rent">${t("nav_rent")}</a>
        <a href="listings.html?tab=buy${subsite ? '&agency=' + subsite.slug : ''}" class="${active === 'buy' ? 'active' : ''}" data-i18n="nav_buy">${t("nav_buy")}</a>
        <a href="listings.html?type=office${subsite ? '&agency=' + subsite.slug : ''}" class="${active === 'office' ? 'active' : ''}" data-i18n="nav_office">${t("nav_office")}</a>
        ${s ? `<a href="dashboard-${s.role}.html" data-i18n="nav_dashboard">${t("nav_dashboard")}</a>` : ""}
      </nav>
      <div class="ti-header-actions">
        <div class="ti-toggle-group ti-lang-toggle">
          <button data-lang="fr" onclick="tiSetLang('fr')">FR</button>
          <button data-lang="en" onclick="tiSetLang('en')">EN</button>
        </div>
        <div class="ti-toggle-group ti-cur-toggle">
          <button data-cur="XOF" onclick="tiSetCurrency('XOF')">CFA</button>
          <button data-cur="EUR" onclick="tiSetCurrency('EUR')">EUR</button>
        </div>
        ${s ? `
          <div class="ti-notif-wrap" id="ti-notif-wrap">
            <button class="ti-notif-trigger" onclick="tiToggleNotifPanel()" id="ti-notif-trigger" aria-haspopup="true" aria-expanded="false">
              ${TI_ICONS.bell}
              <span class="ti-notif-badge" id="ti-notif-badge" style="display:none;">0</span>
            </button>
            <div class="ti-notif-panel" id="ti-notif-panel"></div>
          </div>` : ''}
        ${s
          ? `<div class="ti-account" id="ti-account">
               <button class="ti-account-trigger" onclick="tiToggleAccountMenu()" aria-haspopup="true" aria-expanded="false" id="ti-account-trigger">
                 <span class="ti-account-avatar">${TI_ICONS.user}</span>
                 <span class="ti-account-name">${tiFirstName(s.name)}</span>
                 <span class="ti-account-chevron">${TI_ICONS.chevronDown}</span>
               </button>
               <div class="ti-account-menu" id="ti-account-menu">
                 <div class="ti-account-menu-head">
                   <span class="ti-account-avatar ti-account-avatar-lg">${TI_ICONS.user}</span>
                   <div>
                     <strong>${s.name}</strong>
                     <span class="ti-account-role-badge">${s.role === 'agency' && s.agentRole === 'agent' ? t('role_agent') : t('role_' + s.role)}</span>
                   </div>
                 </div>
                 <a href="dashboard-${s.role}.html">${TI_ICONS.grid} <span data-i18n="nav_dashboard">${t("nav_dashboard")}</span></a>
                 ${s.role === 'client' ? `<a href="dashboard-client.html?panel=favorites">${TI_ICONS.heart} <span data-i18n="dash_favorites">${t("dash_favorites")}</span></a>` : ''}
                 <button onclick="tiLogout()" class="ti-account-logout">${TI_ICONS.logout} <span data-i18n="nav_logout">${t("nav_logout")}</span></button>
               </div>
             </div>`
          : `<a href="login.html" class="btn btn-ghost btn-sm" data-i18n="nav_login">${t("nav_login")}</a>
             <a href="register.html" class="btn btn-dark btn-sm" data-i18n="nav_register">${t("nav_register")}</a>`
        }
        <button class="ti-burger" id="ti-burger" onclick="tiToggleMobileNav()" aria-label="Menu" aria-expanded="false">
          <span class="ti-burger-line"></span><span class="ti-burger-line"></span><span class="ti-burger-line"></span>
        </button>
      </div>
    </div>`;
  tiApplyLang();
  tiApplyCurrency();
  tiInitHeaderScroll();
  if (s) tiUpdateNotificationBell();
}

function tiFirstName(fullName) {
  return (fullName || "").trim().split(/\s+/)[0] || fullName;
}

function tiToggleAccountMenu(force) {
  const wrap = document.getElementById("ti-account");
  const trigger = document.getElementById("ti-account-trigger");
  if (!wrap || !trigger) return;
  const open = typeof force === "boolean" ? force : !wrap.classList.contains("open");
  wrap.classList.toggle("open", open);
  trigger.setAttribute("aria-expanded", String(open));
}
document.addEventListener("click", (e) => {
  const wrap = document.getElementById("ti-account");
  if (!wrap || !wrap.classList.contains("open")) return;
  if (!wrap.contains(e.target)) tiToggleAccountMenu(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") tiToggleAccountMenu(false);
});

async function tiUpdateNotificationBell() {
  const s = tiGetSession();
  if (!s) return;
  const notifs = await TiDB.getNotifications(s.id);
  const unread = notifs.filter(n => !n.read).length;
  const badge = document.getElementById("ti-notif-badge");
  if (badge) { badge.textContent = unread; badge.style.display = unread ? "" : "none"; }
  const panel = document.getElementById("ti-notif-panel");
  if (!panel) return;
  panel.innerHTML = notifs.length ? `
    <div class="ti-notif-panel-head">${t('notifications_title')}</div>
    <div class="ti-notif-list">
      ${notifs.slice(0, 15).map(n => tiNotifItemHtml(n)).join('')}
    </div>` : `<div class="ti-notif-panel-head">${t('notifications_title')}</div><p class="ti-notif-empty">${t('notifications_empty')}</p>`;
}
function tiNotifItemHtml(n) {
  if (n.type === "broadcast") {
    return `
      <div class="ti-notif-item ti-notif-broadcast ${n.read ? '' : 'unread'}">
        <span class="ti-notif-broadcast-icon">${TI_ICONS.bell}</span>
        <div>
          <div class="ti-notif-text"><strong>${n.title}</strong><br>${n.message}</div>
          <div class="ti-notif-time">${tiFormatDateTime(n.createdAt)}</div>
        </div>
      </div>`;
  }
  return `
    <a href="property.html?id=${n.propertyId}" class="ti-notif-item ${n.read ? '' : 'unread'}">
      <img src="${n.propertyCover}" alt="">
      <div>
        <div class="ti-notif-text">${t('notif_status_prefix')} <strong>${n.propertyTitle}</strong> ${t('notif_status_now')} <strong>${tiNotifStatusLabel(n.status)}</strong>.</div>
        <div class="ti-notif-time">${tiFormatDateTime(n.createdAt)}</div>
      </div>
    </a>`;
}
function tiNotifStatusLabel(status) {
  if (status === "under_contract") return t("listing_status_under_contract");
  if (status === "sold") return t("listing_status_sold");
  if (status === "rented") return t("listing_status_rented");
  return status;
}
function tiToggleNotifPanel(force) {
  const wrap = document.getElementById("ti-notif-wrap");
  const trigger = document.getElementById("ti-notif-trigger");
  if (!wrap || !trigger) return;
  const open = typeof force === "boolean" ? force : !wrap.classList.contains("open");
  wrap.classList.toggle("open", open);
  trigger.setAttribute("aria-expanded", String(open));
  if (open) {
    const s = tiGetSession();
    if (s) TiDB.markNotificationsRead(s.id).then(tiUpdateNotificationBell);
  }
}
document.addEventListener("click", (e) => {
  const wrap = document.getElementById("ti-notif-wrap");
  if (!wrap || !wrap.classList.contains("open")) return;
  if (!wrap.contains(e.target)) tiToggleNotifPanel(false);
});

function tiRenderFooter(subsite) {
  const mount = document.getElementById("ti-footer");
  if (!mount) return;
  mount.innerHTML = `
    ${tiHorizonSvg()}
    <footer class="ti-footer">
      <div class="ti-footer-trust-band">
        <div class="container ti-footer-trust-grid">
          <div class="ti-trust-stat"><span class="ti-trust-icon">${TI_ICONS.buildingCheck}</span><div><b>500+</b><span>${t('trust_listings')}</span></div></div>
          <div class="ti-trust-stat"><span class="ti-trust-icon">${TI_ICONS.grid}</span><div><b>50+</b><span>${t('trust_agencies')}</span></div></div>
          <div class="ti-trust-stat"><span class="ti-trust-icon">${TI_ICONS.star}</span><div><b>4.8/5</b><span>${t('trust_rating')}</span></div></div>
          <div class="ti-trust-stat"><span class="ti-trust-icon">${TI_ICONS.headset}</span><div><b>24/7</b><span>${t('trust_support')}</span></div></div>
        </div>
      </div>
      <div class="container">
        <div class="ti-footer-newsletter">
          <div class="ti-footer-newsletter-copy">
            <span class="ti-trust-icon ti-newsletter-icon">${TI_ICONS.mail}</span>
            <div>
              <h3>${t("footer_newsletter_title")}</h3>
              <p>${t("footer_newsletter_sub")}</p>
            </div>
          </div>
          <form class="ti-newsletter-form" onsubmit="return tiSubmitNewsletter(event)">
            <input type="email" required placeholder="${t('email')}" data-i18n-placeholder="email" id="ti-newsletter-email">
            <button type="submit" class="btn btn-primary">${t("footer_newsletter_cta")}</button>
          </form>
        </div>

        <div class="ti-footer-grid">
          <div>
            <div class="ti-brand" style="color:#fff;margin-bottom:10px;"><img src="assets/brand/timmo-logo-white.svg" alt="Timmo" class="ti-footer-brand-logo"></div>
            <p style="color:rgba(255,255,255,.65);max-width:32ch;font-size:.88rem;">${t("footer_tagline")}</p>
            <div class="ti-footer-contact">
              <a href="tel:+221338600000"><span>${TI_ICONS.phone}</span> +221 33 860 00 00</a>
              <a href="mailto:contact@timmo.sn"><span>${TI_ICONS.mail}</span> contact@timmo.sn</a>
              <a href="#"><span>${TI_ICONS.pin}</span> Almadies, Dakar, Sénégal</a>
            </div>
            <div class="ti-social-row">
              <a href="#" aria-label="WhatsApp">${TI_ICONS.whatsapp}</a>
              <a href="#" aria-label="Facebook">${TI_ICONS.facebook}</a>
              <a href="#" aria-label="Instagram">${TI_ICONS.instagram}</a>
            </div>
          </div>
          <div>
            <h4><img src="assets/brand/timmo-symbol-white.svg" alt="" class="ti-footer-h4-icon">${t("brand")}</h4>
            <a href="#">${t("footer_about")}</a>
            <a href="#">${t("footer_contact")}</a>
            <a href="#">${t("footer_legal")}</a>
            <a href="#">${t("footer_help")}</a>
          </div>
          <div>
            <h4><span class="ti-footer-h4-icon">${TI_ICONS.home}</span><span data-i18n="cat_title">${t("cat_title")}</span></h4>
            <a href="listings.html?type=apartment">${t("type_apartment")}</a>
            <a href="listings.html?type=house">${t("type_house")}</a>
            <a href="listings.html?type=office">${t("type_office")}</a>
            <a href="listings.html?type=land">${t("type_land")}</a>
            <a href="listings.html">${t("see_all")}</a>
          </div>
          <div class="ti-footer-agency-card">
            <h4><span class="ti-footer-h4-icon">${TI_ICONS.shield}</span><span data-i18n="footer_agencies">${t("footer_agencies")}</span></h4>
            <p style="color:rgba(255,255,255,.65);font-size:.88rem;">${t("footer_agencies_cta")}</p>
            <ul class="ti-footer-agency-benefits">
              <li><span>${TI_ICONS.check}</span>${t('footer_agency_benefit1')}</li>
              <li><span>${TI_ICONS.check}</span>${t('footer_agency_benefit2')}</li>
              <li><span>${TI_ICONS.check}</span>${t('footer_agency_benefit3')}</li>
            </ul>
            <a href="register.html" class="btn btn-primary btn-block" style="margin-top:16px;" data-i18n="nav_register">${t("nav_register")}</a>
          </div>
        </div>

        <div class="ti-footer-bottom">
          <span>© ${new Date().getFullYear()} Timmo — Dakar, Sénégal. <span data-i18n="footer_rights">${t("footer_rights")}</span></span>
          ${subsite ? `<a href="index.html" class="ti-powered-by-badge">${t('subsite_powered_by')} <strong>Timmo</strong></a>` : ""}
          <div class="ti-footer-bottom-right">
            <div class="ti-toggle-group ti-lang-toggle">
              <button data-lang="fr" onclick="tiSetLang('fr')">FR</button>
              <button data-lang="en" onclick="tiSetLang('en')">EN</button>
            </div>
            <button class="ti-back-to-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="Retour en haut">${TI_ICONS.arrowUp}</button>
          </div>
        </div>
      </div>
    </footer>`;
  tiApplyLang();
}

async function tiSubmitNewsletter(e) {
  e.preventDefault();
  const input = document.getElementById("ti-newsletter-email");
  await TiDB.subscribeNewsletter(input.value);
  tiToast(t("footer_newsletter_success"));
  e.target.reset();
  return false;
}

function tiHorizonSvg(flip) {
  return `<svg class="ti-horizon${flip ? ' flip' : ''}" viewBox="0 0 1200 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,40 C150,10 300,55 450,30 C600,5 750,50 900,25 C1050,5 1150,35 1200,20 L1200,60 L0,60 Z"></path>
  </svg>`;
}

/* ---------- Notification toast ---------- */
/** Identifiant compatible URL à partir d'un nom d'agence — ex. « Sahel Habitat » -> « sahel-habitat ». */
/** Le seul endroit où tout texte fourni par un utilisateur est échappé avant
 *  d'être injecté dans le DOM. Chaque endroit qui affiche un nom, un
 *  message, ou un libellé tapé par un utilisateur (pas un texte que nous
 *  avons écrit nous-mêmes) doit passer par ici — un seul point de vérité
 *  plutôt qu'un correctif appliqué au cas par cas à chaque endroit. */
function tiEscapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Éditeur de message enrichi réutilisable ----------
   Un compositeur de message léger et sûr, conçu pour être réutilisé
   partout où une agence rédige un modèle de message qu'un client verra
   ensuite personnalisé — le kit de bienvenue aujourd'hui, potentiellement
   des annonces ou d'autres modèles plus tard. Volontairement une simple
   zone de texte avec une barre d'outils qui insère une syntaxe
   markdown-lite (gras/italique/listes) et des variables de fusion, plutôt
   qu'un éditeur WYSIWYG contenteditable complet — bien plus prévisible, et
   chaque caractère qui atteint la page passe toujours par tiEscapeHtml
   avant que la poignée de motifs reconnus ici ne soit transformée en balises. */
const TI_RICH_EDITOR_SAMPLES = {};
const TI_RICH_EDITOR_EXTRA_CALLBACKS = {};
function tiRichEditorHtml(fieldId, variables, initialValue, sampleVars, extraOnInput) {
  TI_RICH_EDITOR_SAMPLES[fieldId] = sampleVars || {};
  TI_RICH_EDITOR_EXTRA_CALLBACKS[fieldId] = extraOnInput || null;
  return `
    <div class="ti-rich-editor">
      <div class="ti-rich-editor-toolbar">
        <button type="button" onclick="tiRichEditorWrap('${fieldId}','**','**')" title="${t('rich_editor_bold')}"><b>G</b></button>
        <button type="button" onclick="tiRichEditorWrap('${fieldId}','_','_')" title="${t('rich_editor_italic')}"><i>I</i></button>
        <button type="button" onclick="tiRichEditorLinePrefix('${fieldId}','- ')" title="${t('rich_editor_bullet_list')}">${TI_ICONS.grid}</button>
        <button type="button" onclick="tiRichEditorLinePrefix('${fieldId}','1. ')" title="${t('rich_editor_numbered_list')}">1.</button>
        <button type="button" onclick="tiRichEditorPromptLink('${fieldId}')" title="${t('rich_editor_link')}">${TI_ICONS.pin}</button>
        ${variables && variables.length ? `
        <span class="ti-rich-editor-sep"></span>
        <select onchange="tiRichEditorInsertVar('${fieldId}', this)">
          <option value="">${t('rich_editor_insert_var')}</option>
          ${variables.map(v => `<option value="{{${v.key}}}">${tiEscapeHtml(v.label)}</option>`).join('')}
        </select>` : ''}
      </div>
      <textarea id="${fieldId}" required maxlength="1500" oninput="tiRichEditorSyncPreview('${fieldId}')">${tiEscapeHtml(initialValue || '')}</textarea>
      <div class="ti-rich-editor-preview-label">${t('rich_editor_preview_label')}</div>
      <div class="ti-rich-editor-preview" id="${fieldId}-preview"></div>
    </div>`;
}
function tiRichEditorWrap(fieldId, before, after) {
  const el = document.getElementById(fieldId);
  const start = el.selectionStart, end = el.selectionEnd;
  const selected = el.value.slice(start, end) || t('rich_editor_placeholder_text');
  el.value = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
  el.focus();
  el.selectionStart = start + before.length;
  el.selectionEnd = start + before.length + selected.length;
  tiRichEditorSyncPreview(fieldId);
}
function tiRichEditorLinePrefix(fieldId, prefix) {
  const el = document.getElementById(fieldId);
  const start = el.selectionStart, end = el.selectionEnd;
  const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
  el.value = el.value.slice(0, lineStart) + prefix + el.value.slice(lineStart);
  el.focus();
  el.selectionStart = start + prefix.length;
  el.selectionEnd = end + prefix.length;
  tiRichEditorSyncPreview(fieldId);
}
function tiRichEditorInsertVar(fieldId, selectEl) {
  const token = selectEl.value;
  if (!token) return;
  const el = document.getElementById(fieldId);
  const start = el.selectionStart, end = el.selectionEnd;
  el.value = el.value.slice(0, start) + token + el.value.slice(end);
  el.focus();
  el.selectionStart = el.selectionEnd = start + token.length;
  selectEl.selectedIndex = 0;
  tiRichEditorSyncPreview(fieldId);
}
function tiRichEditorPromptLink(fieldId) {
  const url = prompt(t('rich_editor_link_prompt'));
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    if (url) tiToast(t('rich_editor_link_invalid'));
    return;
  }
  const el = document.getElementById(fieldId);
  const start = el.selectionStart, end = el.selectionEnd;
  const label = el.value.slice(start, end) || t('rich_editor_link_default_label');
  const markup = `[${label}](${url.trim()})`;
  el.value = el.value.slice(0, start) + markup + el.value.slice(end);
  el.focus();
  el.selectionStart = el.selectionEnd = start + markup.length;
  tiRichEditorSyncPreview(fieldId);
}
/** Transforme le markdown-lite + {{variables}} en HTML sûr. Tout est
 *  d'abord échappé ; seule la poignée de motifs ci-dessous est ensuite
 *  transformée en balises, ce qui rend ce résultat sûr à injecter
 *  directement dans innerHTML. */
function tiRenderMiniMarkdown(text, vars) {
  let html = tiEscapeHtml(text || "");
  Object.keys(vars || {}).forEach(key => {
    html = html.split(tiEscapeHtml(`{{${key}}}`)).join(`<span class="ti-rich-var">${tiEscapeHtml(vars[key])}</span>`);
  });
  // Liens : seules les URL http(s) sont jamais transformées en vraie balise — tout
  // le reste (ex. un schéma javascript:) reste du texte littéral inerte.
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) =>
    /^https?:/i.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>` : m);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  html = html.replace(/(^|\n)((?:- .*(?:\n|$))+)/g, (m, lead, block) => {
    const items = block.trim().split("\n").map(l => `<li>${l.replace(/^- /, "")}</li>`).join("");
    return `${lead}<ul>${items}</ul>`;
  });
  html = html.replace(/(^|\n)((?:\d+\. .*(?:\n|$))+)/g, (m, lead, block) => {
    const items = block.trim().split("\n").map(l => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
    return `${lead}<ol>${items}</ol>`;
  });
  return html.replace(/\n/g, "<br>");
}
function tiRichEditorSyncPreview(fieldId) {
  const el = document.getElementById(fieldId);
  const preview = document.getElementById(fieldId + "-preview");
  if (!el || !preview) return;
  preview.innerHTML = tiRenderMiniMarkdown(el.value, TI_RICH_EDITOR_SAMPLES[fieldId]);
  const extraCb = TI_RICH_EDITOR_EXTRA_CALLBACKS[fieldId];
  if (extraCb && typeof window[extraCb] === "function") window[extraCb]();
}
/** Remplace les {{variables}} par de vraies valeurs — utilisé quand un
 *  modèle est réellement transmis à un client précis, par opposition aux
 *  données d'exemple affichées dans l'aperçu en direct de l'éditeur. */
function tiSubstituteVars(text, vars) {
  let out = text || "";
  Object.keys(vars || {}).forEach(key => { out = out.split(`{{${key}}}`).join(vars[key] || ""); });
  return out;
}

function tiSlugify(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
/** URL d'image de QR code pour un texte donné (un service de génération
 *  gratuit, sans clé — aucun encodage QR côté serveur n'est nécessaire ici). */
/** Résout la valeur `icon` stockée d'une caractéristique en un caractère
 *  affichable. Les biens plus anciens/initiaux stockent une courte clé de
 *  correspondance (ex. "security"), résolue via TI_AMENITY_ICONS ; les
 *  biens plus récents (construits depuis le catalogue géré par l'admin)
 *  stockent déjà directement l'emoji brut. Ceci gère les deux cas sans
 *  avoir besoin de savoir lequel un bien donné utilise. */
/* ---------- Menu déroulant partagé pour actions de ligne ----------
   A "..." kebab menu for secondary row actions, so a list row shows only
   its one or two most common actions directly plus a menu for the rest —
   the standard pattern in modern SaaS tables (Linear, Notion, Airtable)
   instead of a wall of equally-weighted buttons. */
function tiRowMenuHtml(itemsHtml) {
  return `
    <div class="ti-row-menu-wrap">
      <button type="button" class="ti-row-menu-trigger" onclick="tiToggleRowMenu(this)" aria-haspopup="true" aria-expanded="false">${TI_ICONS.moreVertical}</button>
      <div class="ti-row-menu">${itemsHtml}</div>
    </div>`;
}
/** Copie un mot de passe temporaire généré dans le presse-papiers — partagé
 *  par le flux de réinitialisation de la fiche détail agence côté admin, et
 *  celui de la fiche détail agent côté agence, qui utilisent tous deux le
 *  même schéma de fenêtre modale/champ. */
function tiCopyTempPassword() {
  const input = document.getElementById("temp-password-value");
  input.select();
  navigator.clipboard?.writeText(input.value).catch(() => {});
  tiToast(t("copied_label"));
}

/** Un bien est visible publiquement (recherche, parcours, sections mises en
 *  avant) quand il est actif et pas en cours d'examen pour suppression — une
 *  annonce en attente d'une décision de suppression par l'admin ne doit pas
 *  pouvoir être réservée par de nouveaux visiteurs entre-temps. */
/** Transforme une date d'échéance ISO en libellé affichable et en niveau
 *  d'urgence — partagé par le parcours de dossier du client et l'examen des
 *  demandes de réservation de l'agence, pour que les deux affichent la même
 *  échéance de façon cohérente. */
function tiDueDateInfo(dueAt) {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const diffDays = Math.ceil((due - new Date()) / 86400000);
  const label = due.toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", { day: "numeric", month: "short" });
  const urgency = diffDays < 0 ? "overdue" : diffDays <= 2 ? "soon" : "normal";
  return { label, diffDays, urgency };
}

/** Partagé par les vues « annonces » de l'agence et de l'admin — il en
 *  existait auparavant deux copies séparées ayant divergé, et toutes deux
 *  fusionnaient « loué » et « vendu » (et, pour la copie agence, « sous
 *  compromis ») sur le même vert que « actif », rendant les statuts
 *  difficiles à distinguer d'un coup d'œil. */
function tiListingStatusBadge(status) {
  const map = {
    pending: ["badge-pending", "listing_status_pending"],
    active: ["badge-confirmed", "listing_status_active"],
    under_contract: ["badge-under-contract", "listing_status_under_contract"],
    rented: ["badge-closed", "listing_status_rented"],
    sold: ["badge-closed", "listing_status_sold"],
    rejected: ["badge-cancelled", "listing_status_rejected"],
  };
  const [cls, key] = map[status] || map.active;
  return `<span class="badge ${cls}">${t(key)}</span>`;
}

function tiIsPubliclyVisible(p) {
  return (p.listingStatus === "active" || !p.listingStatus) && p.deletionStatus !== "pending";
}

/** Badges de nombre de notifications dans le menu latéral, partagés par les
 *  trois tableaux de bord. Les badges sont injectés comme un marqueur
 *  voisin plutôt qu'à l'intérieur du nœud de texte data-i18n, et
 *  réappliqués au changement de langue, puisque tiApplyLang() écrase le
 *  textContent de chaque élément [data-i18n]. */
let TI_NAV_BADGES = {};
function tiSetNavBadge(panelKey, count) {
  TI_NAV_BADGES[panelKey] = count;
  tiApplyNavBadges();
}
function tiApplyNavBadges() {
  Object.entries(TI_NAV_BADGES).forEach(([panelKey, count]) => {
    const navLink = document.querySelector(`.ti-dash-nav a[data-panel="${panelKey}"]`);
    if (!navLink) return;
    let badge = navLink.querySelector(".ti-nav-badge");
    if (count > 0) {
      if (!badge) { badge = document.createElement("span"); badge.className = "ti-nav-badge"; navLink.appendChild(badge); }
      badge.textContent = count > 99 ? "99+" : String(count);
    } else if (badge) { badge.remove(); }
  });
}
document.addEventListener("ti:langchange", tiApplyNavBadges);

/* ---------- Icônes et repli/dépli du menu latéral des tableaux de bord ----------
   Les icônes sont injectées par JS plutôt qu'écrites dans le HTML, pour
   n'avoir qu'une seule table de correspondance à tenir à jour au lieu de
   modifier chacun des ~32 liens à travers les 3 tableaux de bord. Réappliqué
   à chaque changement de langue (comme pour les badges, puisque
   tiApplyLang() écrase le textContent), et rappelle tiApplyNavBadges() à la
   fin puisque reconstruire le innerHTML du lien effacerait sinon un badge
   déjà affiché. */
const TI_PANEL_ICONS = {
  overview: "grid", stats: "barChart",
  bookings: "calendar", listings: "home", new: "plus",
  clients: "users", agents: "users", users: "users", agencies: "buildingCheck",
  announcements: "bell", broadcasts: "bell",
  welcomekit: "sparkle",
  messages: "mail",
  reviews: "star", moderation: "shield",
  audit: "clock",
  reports: "barChart",
  favorites: "heart",
  documents: "document",
  payments: "wallet",
  profile: "user",
  amenities: "grid",
  deletions: "trash",
};
function tiApplySidebarIcons() {
  document.querySelectorAll(".ti-dash-nav a[data-panel]").forEach(a => {
    const panel = a.getAttribute("data-panel");
    const label = a.textContent.trim();
    a.setAttribute("data-label", label);
    a.setAttribute("title", label);
    const iconKey = TI_PANEL_ICONS[panel];
    const iconHtml = iconKey && TI_ICONS[iconKey] ? `<span class="ti-dash-nav-icon">${TI_ICONS[iconKey]}</span>` : "";
    a.innerHTML = `${iconHtml}<span class="ti-dash-nav-label">${tiEscapeHtml(label)}</span>`;
  });
  tiApplyNavBadges();
}
document.addEventListener("ti:langchange", tiApplySidebarIcons);

/** Restaure l'état replié/déplié mémorisé au chargement de la page. */
function tiInitSidebarCollapse() {
  const dash = document.querySelector(".ti-dash");
  if (!dash) return;
  dash.classList.toggle("collapsed", localStorage.getItem("ti_sidebar_collapsed") === "1");
}
function tiToggleSidebar() {
  const dash = document.querySelector(".ti-dash");
  if (!dash) return;
  const collapsed = dash.classList.toggle("collapsed");
  localStorage.setItem("ti_sidebar_collapsed", collapsed ? "1" : "0");
}
document.addEventListener("DOMContentLoaded", tiInitSidebarCollapse);

function tiToggleRowMenu(btn) {
  const wrap = btn.closest(".ti-row-menu-wrap");
  const menu = wrap.querySelector(".ti-row-menu");
  const willOpen = !menu.classList.contains("open");
  document.querySelectorAll(".ti-row-menu.open").forEach(m => m.classList.remove("open"));
  if (willOpen) menu.classList.add("open");
  btn.setAttribute("aria-expanded", String(willOpen));
}
document.addEventListener("click", (e) => {
  if (e.target.closest(".ti-row-menu-wrap")) return;
  document.querySelectorAll(".ti-row-menu.open").forEach(m => m.classList.remove("open"));
});

function tiAmenityIconChar(icon) {
  return TI_AMENITY_ICONS[icon] || icon || "✨";
}

/* ---------- Fiche technique du bien (export impression / PDF pour agence et admin) ---------- */
async function tiGeneratePropertySheet(propertyId) {
  const property = await TiDB.getProperty(propertyId);
  if (!property) return;
  const agency = await TiDB.getAgency(property.agencyId);
  const photos = (property.photos && property.photos.length) ? property.photos : [];
  const url = window.location.origin + "/property.html?id=" + property.id;
  const isEn = tiGetLang() === "en";
  const priceSuffix = property.forSale ? "" : (property.shortStay ? ` ${t('per_night')}` : ` ${t('per_month')}`);
  const description = isEn ? (property.descEn || property.desc) : property.desc;

  const html = `
    <div class="ti-report ti-property-sheet">
      <div class="ti-report-letterhead">
        <div>
          <div class="ti-report-brand"><img src="assets/brand/timmo-logo-primary.svg" alt="Timmo" class="ti-report-brand-logo"></div>
          <h2>${t('property_sheet_title')}</h2>
          <p>${tiEscapeHtml(agency ? agency.name : '')} · ${t('reference_label')} ${property.reference || '—'}</p>
        </div>
        <div class="ti-report-meta">${t('report_generated_on')} ${tiFormatDateTime(new Date().toISOString())}</div>
      </div>

      ${photos[0] ? `<div class="ti-sheet-hero"><img src="${photos[0]}" alt="" onerror="this.style.display='none'"></div>` : ''}

      <div class="ti-sheet-title-row">
        <div>
          <h1>${tiEscapeHtml(tiPropertyTitle(property))}</h1>
          <p class="ti-sheet-location">${tiNeighborhoodName(property.neighborhood)} · ${tiTypeLabel(property.type)}</p>
        </div>
        <div class="ti-sheet-price">${tiFormatPrice(property.price)}<small>${priceSuffix}</small></div>
      </div>

      <div class="ti-report-kpi-grid">
        ${property.bedrooms ? `<div class="ti-report-kpi"><b>${property.bedrooms}</b><span>${t('bedrooms')}</span></div>` : ''}
        ${property.bathrooms ? `<div class="ti-report-kpi"><b>${property.bathrooms}</b><span>${t('bathrooms')}</span></div>` : ''}
        <div class="ti-report-kpi"><b>${property.area}</b><span>${t('area')}</span></div>
        ${property.type !== 'land' ? `<div class="ti-report-kpi"><b>${property.furnished ? '✓' : '—'}</b><span>${t('perk_furnished')}</span></div>` : ''}
        <div class="ti-report-kpi"><b>${property.rating || '—'}</b><span>★ ${t('sort_rating')}</span></div>
      </div>

      <h3>${t('field_desc')}</h3>
      <p class="ti-sheet-desc">${tiEscapeHtml(description || '')}</p>

      ${property.amenities && property.amenities.length ? `
      <h3>${t('field_amenities')}</h3>
      <div class="ti-sheet-amenities-grid">
        ${property.amenities.map(a => `<div class="ti-sheet-amenity"><span>${tiAmenityIconChar(a.icon)}</span>${tiEscapeHtml(isEn ? a.labelEn : a.label)}</div>`).join('')}
      </div>` : ''}

      ${photos.length > 1 ? `
      <h3>${t('gallery_title')}</h3>
      <div class="ti-sheet-photo-grid">
        ${photos.slice(1, 5).map(p => `<img src="${p}" alt="" onerror="this.style.display='none'">`).join('')}
      </div>` : ''}

      <div class="ti-sheet-footer-row">
        <div class="ti-sheet-contact">
          <strong>${tiEscapeHtml(agency ? agency.name : '')}</strong>
          ${agency && agency.phone ? `<div>${tiEscapeHtml(agency.phone)}</div>` : ''}
          ${agency && agency.email ? `<div>${tiEscapeHtml(agency.email)}</div>` : ''}
        </div>
        <div class="ti-sheet-qr">
          <img src="${tiQrCodeUrl(url, 110)}" width="110" height="110" alt="QR code">
          <span>${t('property_sheet_qr_note')}</span>
        </div>
      </div>

      <div class="ti-report-footer">${t('report_confidential_note')} — ${t('report_generated_by')} Timmo</div>
    </div>`;

  document.getElementById("property-sheet-mount").innerHTML = html;
  document.getElementById("ti-print-root").innerHTML = html;
  tiOpenModal("modal-property-sheet");
}

function tiQrCodeUrl(data, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

/** Affiche les tags sélectionnés d'un avis sous forme de petites puces,
 *  colorées selon leur sentiment pré-classifié. Partagé par la page
 *  publique du bien, le tableau de bord agence, et le tableau de bord admin. */
function tiReviewTagsHtml(tagIds) {
  if (!tagIds || !tagIds.length) return "";
  const items = tagIds.map(id => TI_REVIEW_TAGS.find(t2 => t2.id === id)).filter(Boolean);
  if (!items.length) return "";
  return `<div class="ti-review-tags">${items.map(tag => `
    <span class="ti-review-tag ti-review-tag-${tag.sentiment}">${tiEscapeHtml(tiGetLang() === "en" ? tag.labelEn : tag.label)}</span>`).join("")}</div>`;
}

/* ---------- Analyse de sentiment des avis (agrégée, pour agence/admin) ---------- */
function tiComputeReviewInsights(reviews) {
  const approved = reviews.filter(r => r.approved !== false);
  const totalCount = approved.length;
  const positiveCount = approved.filter(r => r.rating >= 4).length;
  const negativeCount = approved.filter(r => r.rating <= 2).length;
  const neutralCount = totalCount - positiveCount - negativeCount;

  const tagCounts = {};
  approved.forEach(r => (r.tags || []).forEach(id => { tagCounts[id] = (tagCounts[id] || 0) + 1; }));
  const tagEntries = Object.entries(tagCounts).map(([id, count]) => {
    const tag = TI_REVIEW_TAGS.find(t2 => t2.id === id);
    return tag ? { id, count, label: tiGetLang() === "en" ? tag.labelEn : tag.label, sentiment: tag.sentiment } : null;
  }).filter(Boolean).sort((a, b) => b.count - a.count);

  const topPositiveTags = tagEntries.filter(t2 => t2.sentiment === "positive").slice(0, 3);
  const topNegativeTags = tagEntries.filter(t2 => t2.sentiment === "negative").slice(0, 3);
  return { totalCount, positiveCount, negativeCount, neutralCount, topPositiveTags, topNegativeTags, topPositiveTag: topPositiveTags[0] || null, topNegativeTag: topNegativeTags[0] || null };
}
function tiGenerateReviewInsightLocal(d) {
  const lang = tiGetLang();
  if (!d.totalCount) return lang === "en" ? "No reviews yet to analyze." : "Aucun avis à analyser pour le moment.";
  const parts = [];
  const posPct = Math.round((d.positiveCount / d.totalCount) * 100);
  parts.push(lang === "en"
    ? `${posPct}% of reviews are positive (${d.totalCount} review${d.totalCount > 1 ? "s" : ""} analyzed).`
    : `${posPct}% des avis sont positifs (${d.totalCount} avis analysé${d.totalCount > 1 ? "s" : ""}).`);
  if (d.topPositiveTag) {
    parts.push(lang === "en"
      ? `Clients most often highlight "${d.topPositiveTag.label}" (${d.topPositiveTag.count} mention${d.topPositiveTag.count > 1 ? "s" : ""}).`
      : `Les clients citent le plus souvent « ${d.topPositiveTag.label} » (${d.topPositiveTag.count} mention${d.topPositiveTag.count > 1 ? "s" : ""}).`);
  }
  if (d.topNegativeTag) {
    parts.push(lang === "en"
      ? `The most frequently cited area for improvement is "${d.topNegativeTag.label}" (${d.topNegativeTag.count} mention${d.topNegativeTag.count > 1 ? "s" : ""}) — worth addressing first.`
      : `Le point le plus fréquemment signalé à améliorer est « ${d.topNegativeTag.label} » (${d.topNegativeTag.count} mention${d.topNegativeTag.count > 1 ? "s" : ""}) — à traiter en priorité.`);
  } else if (d.totalCount) {
    parts.push(lang === "en" ? "No recurring negative pattern found — a great sign." : "Aucun point négatif récurrent détecté — bon signe.");
  }
  return parts.join(" ");
}
async function tiRenderReviewInsights(mountId, reviews) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  const data = tiComputeReviewInsights(reviews);
  const insightText = await tiGetAiText("review-sentiment", { type: "review_sentiment", metrics: data, lang: tiGetLang() }, () => tiGenerateReviewInsightLocal(data));
  mount.innerHTML = `
    <div class="ti-report-insight" style="margin-bottom:20px;">
      <span class="ti-report-insight-icon">${TI_ICONS.sparkle}</span>
      <div>
        <div class="ti-report-insight-label">${t('review_ai_insight_label')}</div>
        <p>${insightText}</p>
      </div>
    </div>
    ${data.totalCount ? `
    <div class="ti-review-insight-grid">
      <div>
        <h5>${t('review_top_positive')}</h5>
        ${data.topPositiveTags.length ? data.topPositiveTags.map(tg => `<div class="ti-review-insight-row"><span class="ti-review-tag ti-review-tag-positive">${tiEscapeHtml(tg.label)}</span><b>${tg.count}</b></div>`).join('') : `<p style="color:var(--ink-soft);font-size:.85rem;">${t('no_data')}</p>`}
      </div>
      <div>
        <h5>${t('review_top_negative')}</h5>
        ${data.topNegativeTags.length ? data.topNegativeTags.map(tg => `<div class="ti-review-insight-row"><span class="ti-review-tag ti-review-tag-negative">${tiEscapeHtml(tg.label)}</span><b>${tg.count}</b></div>`).join('') : `<p style="color:var(--ink-soft);font-size:.85rem;">${t('no_data')}</p>`}
      </div>
    </div>` : ''}`;
}

function tiToast(msg) {
  let el = document.getElementById("ti-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "ti-toast";
    el.className = "ti-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window._tiToastTimer);
  window._tiToastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------- Fenêtre modale ---------- */
function tiOpenModal(id) { document.getElementById(id).classList.add("open"); }
function tiCloseModal(id) { document.getElementById(id).classList.remove("open"); }

/* ---------- Carte de bien ---------- */
function tiStarsHtml(rating) {
  const full = Math.round(rating);
  let html = "";
  for (let i = 0; i < 5; i++) html += `<span style="opacity:${i < full ? 1 : .3}">${TI_ICONS.star}</span>`;
  return `<span class="ti-stars" style="display:inline-flex;gap:1px;vertical-align:middle;width:16px;">${html}</span>`;
}

function tiTypeLabel(type) {
  return { apartment: t("type_apartment"), house: t("type_house"), office: t("type_office"), land: t("type_land") }[type] || type;
}

/* ---------- Panneau de favoris partagé (utilisé par client, agence et admin) ---------- */
let TI_FAVORITES_CACHE = [];

function tiSimpleSearchBar(filterMountId, inputId, placeholder, onInput) {
  const mount = document.getElementById(filterMountId);
  mount.innerHTML = `
    <div class="ti-admin-filter-bar">
      <div class="ti-filter-search">
        <span class="ti-filter-search-icon">${TI_ICONS.search}</span>
        <input type="text" id="${inputId}" placeholder="${placeholder}">
      </div>
      <button class="ti-filter-reset" onclick="document.getElementById('${inputId}').value='';document.getElementById('${inputId}').dispatchEvent(new Event('input'));">${t('filter_reset')}</button>
    </div>`;
  document.getElementById(inputId).addEventListener("input", onInput);
}
async function tiRenderFavorites() {
  const favs = await TiDB.getFavorites(TI_SESSION.id);
  const props = await TiDB.getProperties();
  TI_FAVORITES_CACHE = favs.map(f => props.find(p => p.id === f.propertyId)).filter(Boolean);
  if (!TI_FAVORITES_CACHE.length) {
    document.getElementById("favorites-filters").innerHTML = "";
    document.getElementById("favorites-mount").innerHTML = tiEmptyStateHtml(t('empty_favorites'), t('see_all'), 'listings.html', 'heart');
    return;
  }
  tiSimpleSearchBar("favorites-filters", "fav-search", t('filter_search_title'), tiApplyFavoritesFilter);
  tiApplyFavoritesFilter();
}
function tiApplyFavoritesFilter() {
  const q = document.getElementById("fav-search").value.trim().toLowerCase();
  const list = q ? TI_FAVORITES_CACHE.filter(p => tiPropertyTitle(p).toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q)) : TI_FAVORITES_CACHE;
  const favIds = TI_FAVORITES_CACHE.map(p => p.id);
  document.getElementById("favorites-mount").innerHTML = list.length
    ? list.map(p => tiPropertyCardHtml(p, favIds, true)).join('')
    : `<p style="color:var(--ink-soft)">${t('filter_no_results')}</p>`;
}
async function tiHandleFavClickRemovable(evt, propertyId, btn) {
  evt.preventDefault();
  const s = tiGetSession();
  if (!s) { window.location.href = "login.html"; return; }
  const nowFav = await TiDB.toggleFavorite(s.id, propertyId);
  if (nowFav) {
    btn.classList.add("active");
    btn.innerHTML = TI_ICONS.heartFilled;
    tiToast(t("saved_fav"));
    return;
  }
  tiToast(t("save_fav"));
  const card = btn.closest(".ti-card");
  TI_FAVORITES_CACHE = TI_FAVORITES_CACHE.filter(p => p.id !== propertyId);
  if (!card) return;
  card.style.transition = "opacity .25s ease, transform .25s ease";
  card.style.opacity = "0";
  card.style.transform = "scale(.92)";
  setTimeout(() => {
    card.remove();
    if (!TI_FAVORITES_CACHE.length) {
      document.getElementById("favorites-filters").innerHTML = "";
      document.getElementById("favorites-mount").innerHTML = tiEmptyStateHtml(t('empty_favorites'), t('see_all'), 'listings.html', 'heart');
    }
  }, 250);
}

function tiPropertyCardHtml(p, favIds = [], removeOnUnfav = false) {
  const isFav = favIds.includes(p.id);
  const favClickFn = removeOnUnfav ? "tiHandleFavClickRemovable" : "tiHandleFavClick";
  const priceSuffix = p.forSale ? "" : (p.shortStay ? ` <small style="font-weight:500;">${t("per_night")}</small>` : ` <small style="font-weight:500;">${t("per_month")}</small>`);
  return `
  <div class="ti-card" data-prop-id="${p.id}">
    <a href="property.html?id=${p.id}" class="ti-card-media">
      <img src="${p.cover}" alt="${tiPropertyTitle(p)}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.style.display='none'">
      <span class="ti-card-badge">${tiTypeLabel(p.type)}</span>
      ${tiPropertyStatusRibbonHtml(p)}
      <button class="ti-card-fav ${isFav ? 'active' : ''}" onclick="${favClickFn}(event,'${p.id}',this)">${isFav ? TI_ICONS.heartFilled : TI_ICONS.heart}</button>
    </a>
    <div class="ti-card-body">
      <div class="ti-card-hood">${tiNeighborhoodName(p.neighborhood)}</div>
      <h3 class="ti-card-title"><a href="property.html?id=${p.id}">${tiPropertyTitle(p)}</a></h3>
      ${p.reference ? `<div class="ti-card-ref">${t('reference_label')} ${p.reference}</div>` : ''}
      <div class="ti-card-meta">
        ${p.bedrooms ? `<span>${p.bedrooms} ${t("bedrooms")}</span>` : ""}
        ${p.bathrooms ? `<span>${p.bathrooms} ${t("bathrooms")}</span>` : ""}
        <span>${p.area} ${t("area")}</span>
      </div>
      <div class="ti-card-foot">
        <span class="ti-price" data-price-xof="${p.price}">${tiFormatPrice(p.price)}</span>${priceSuffix}
        <span class="ti-rating">${tiStarsHtml(p.rating)} ${p.rating}</span>
      </div>
    </div>
  </div>`;
}

async function tiHandleFavClick(evt, propertyId, btn) {
  evt.preventDefault();
  const s = tiGetSession();
  if (!s) { window.location.href = "login.html"; return; }
  const nowFav = await TiDB.toggleFavorite(s.id, propertyId);
  btn.classList.toggle("active", nowFav);
  btn.innerHTML = nowFav ? TI_ICONS.heartFilled : TI_ICONS.heart;
  btn.classList.remove("pulse");
  void btn.offsetWidth;
  btn.classList.add("pulse");
  tiToast(nowFav ? t("saved_fav") : t("save_fav"));
}

document.addEventListener("ti:currencychange", () => {
  document.querySelectorAll("[data-price-xof]").forEach(el => {
    el.textContent = tiFormatPrice(parseFloat(el.getAttribute("data-price-xof")));
  });
});

/* ---------- Apparition au défilement ---------- */
let tiRevealObserver = null;
function tiObserveReveals(root = document) {
  if (!tiRevealObserver) {
    tiRevealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          tiRevealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  }
  root.querySelectorAll(".ti-reveal, .ti-reveal-stagger").forEach(el => tiRevealObserver.observe(el));
}
document.addEventListener("DOMContentLoaded", () => tiObserveReveals());

/* ---------- Ombre d'en-tête au défilement + navigation mobile ---------- */
function tiToggleMobileNav(force) {
  const nav = document.getElementById("ti-nav");
  const burger = document.getElementById("ti-burger");
  if (!nav || !burger) return;
  const open = typeof force === "boolean" ? force : !nav.classList.contains("open");
  nav.classList.toggle("open", open);
  burger.classList.toggle("active", open);
  burger.setAttribute("aria-expanded", String(open));
}

function tiInitHeaderScroll() {
  const header = document.getElementById("ti-header");
  if (!header) return;
  const syncHeight = () => {
    document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  };
  syncHeight();
  window.addEventListener("resize", syncHeight);
  document.addEventListener("ti:langchange", syncHeight);
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("click", (e) => {
    const nav = document.getElementById("ti-nav");
    if (!nav || !nav.classList.contains("open")) return;
    if (!nav.contains(e.target) && !e.target.closest(".ti-burger")) tiToggleMobileNav(false);
  });
  document.querySelectorAll("#ti-nav a").forEach(a => a.addEventListener("click", () => tiToggleMobileNav(false)));
}

function tiGetActivePanelName() {
  const active = document.querySelector(".ti-dash-panel.active");
  return active ? active.id.replace("panel-", "") : null;
}

function tiApplyPanelFromUrl(validPanels) {
  const requested = new URLSearchParams(window.location.search).get("panel");
  if (requested && validPanels.includes(requested)) tiShowPanel(requested);
}
function tiSetBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) { btn.dataset.label = btn.textContent; btn.classList.add("is-loading"); btn.disabled = true; }
  else { btn.classList.remove("is-loading"); btn.disabled = false; }
}

/* ---------- Utilitaires de fichiers (envoi/visualisation de documents) ---------- */
const TI_MAX_DOC_PREVIEW_SIZE = 3 * 1024 * 1024; // 3MB — keeps localStorage usage safe for a client-side demo

function tiReadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Redimensionne et ré-encode un fichier image côté client avant de le
 *  stocker en URL de données — sans ça, quelques vraies photos prises avec
 *  un appareil photo dépasseraient presque immédiatement le quota du
 *  localStorage. Renvoie une URL de données JPEG plafonnée à maxDim sur son
 *  plus grand côté. */
function tiCompressImageFile(file, maxDim = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("invalid_image"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Ouvre un document stocké (URL de données) dans un nouvel onglet via une
 *  URL blob: — plus fiablement autorisé par les navigateurs que de naviguer
 *  directement vers une URL data:, et affiche les PDF/images directement
 *  quand c'est possible plutôt que de forcer un téléchargement. */
async function tiOpenDocument(dataUrl, fileName) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    console.error("Impossible d'ouvrir le document:", err);
    tiToast(t("file_open_error"));
  }
}

/** Bloc d'état vide réutilisable (icône + message + appel à l'action optionnel). */
/* ---------- Chargeurs squelettes ---------- */
function tiSkeletonCardsHtml(count = 6) {
  return Array.from({ length: count }, () => `
    <div class="ti-card ti-skeleton-el">
      <div class="ti-card-media ti-shimmer"></div>
      <div style="padding:16px;">
        <div class="ti-skel-line ti-shimmer" style="width:35%;"></div>
        <div class="ti-skel-line ti-shimmer" style="width:82%;height:17px;margin-top:12px;"></div>
        <div class="ti-skel-line ti-shimmer" style="width:55%;margin-top:9px;"></div>
        <div class="ti-skel-line ti-shimmer" style="width:45%;height:20px;margin-top:16px;"></div>
      </div>
    </div>`).join("");
}
function tiSkeletonStatCardsHtml(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="ti-stat-card ti-skeleton-el">
      <div class="ti-skel-circle ti-shimmer"></div>
      <div class="ti-skel-line ti-shimmer" style="width:50%;height:26px;margin-top:14px;"></div>
      <div class="ti-skel-line ti-shimmer" style="width:70%;margin-top:9px;"></div>
    </div>`).join("");
}
function tiSkeletonChartCardHtml() {
  return `
    <div class="ti-chart-card ti-skeleton-el">
      <div class="ti-skel-line ti-shimmer" style="width:32%;height:13px;margin-bottom:22px;"></div>
      <div class="ti-skel-block ti-shimmer" style="height:180px;"></div>
    </div>`;
}
function tiSkeletonListRowsHtml(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="ti-list-row ti-skeleton-el">
      <div class="ti-skel-circle ti-shimmer"></div>
      <div style="flex:1;">
        <div class="ti-skel-line ti-shimmer" style="width:38%;"></div>
        <div class="ti-skel-line ti-shimmer" style="width:62%;margin-top:9px;"></div>
      </div>
    </div>`).join("");
}
function tiSkeletonBookingCardsHtml(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="ti-booking-card ti-skeleton-el">
      <div class="ti-skel-line ti-shimmer" style="width:45%;height:16px;"></div>
      <div class="ti-skel-line ti-shimmer" style="width:30%;margin-top:12px;"></div>
      <div class="ti-skel-line ti-shimmer" style="width:60%;margin-top:16px;"></div>
      <div class="ti-skel-block ti-shimmer" style="height:36px;margin-top:16px;"></div>
    </div>`).join("");
}

function tiEmptyStateHtml(message, ctaText, ctaHref, iconKey) {
  return `
    <div class="ti-empty-state">
      <span class="ti-empty-state-icon">${TI_ICONS[iconKey] || TI_ICONS.document}</span>
      <p>${message}</p>
      ${ctaText && ctaHref ? `<a href="${ctaHref}" class="btn btn-outline btn-sm">${ctaText}</a>` : ""}
    </div>`;
}

/* ---------- Utilitaires du journal d'audit ---------- */
function tiLogAgencyAction(action, targetType, targetId, targetLabel, details) {
  TiDB.logAction({
    actorId: TI_SESSION.id, actorName: TI_SESSION.name, actorRole: "agency",
    agentRole: TI_SESSION.agentRole, agencyId: TI_SESSION.agencyId,
    action, targetType, targetId, targetLabel, details: details || "",
  }).catch(() => {});
}
function tiLogAdminAction(action, targetType, targetId, targetLabel, details, agencyId) {
  TiDB.logAction({
    actorId: TI_SESSION.id, actorName: TI_SESSION.name, actorRole: "admin",
    agentRole: null, agencyId: agencyId || null,
    action, targetType, targetId, targetLabel, details: details || "",
  }).catch(() => {});
}
function tiFormatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(tiGetLang() === "en" ? "en-US" : "fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function tiFormatTimeOnly(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(tiGetLang() === "en" ? "en-US" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/* ---------- Chronologie du journal d'audit (partagée : filtre de période, regroupement par jour, pagination) ----------
   Utilisée par les panneaux « Journal d'audit » de l'agence et de l'admin.
   Chaque appelant garde son propre petit objet d'état { period, page } et un
   nom de rerenderFn (une de leurs fonctions globales qui réapplique le
   filtrage) — la chronologie elle-même n'a pas d'état et affiche simplement
   la page/période qu'on lui donne. */
const TI_AUDIT_PAGE_SIZE = 15;
function tiAuditActionIcon(action) {
  const a = (action || "").toLowerCase();
  if (a.includes("delet")) return TI_ICONS.trash;
  if (a.includes("creat") || a.includes("added") || a.includes("_add") || a.includes("enabl")) return TI_ICONS.plus;
  if (a.includes("approv") || a.includes("verif")) return TI_ICONS.check;
  if (a.includes("reject") || a.includes("suspend") || a.includes("freez") || a.includes("disabl")) return TI_ICONS.alertTriangle;
  if (a.includes("edit") || a.includes("updat") || a.includes("chang")) return TI_ICONS.editPencil;
  if (a.includes("login") || a.includes("impersonat")) return TI_ICONS.lock;
  return TI_ICONS.clock;
}
function tiAuditPeriodFilter(list, periodKey) {
  if (periodKey === "all") return list;
  const since = new Date();
  if (periodKey === "today") since.setHours(0, 0, 0, 0);
  else if (periodKey === "week") since.setDate(since.getDate() - 7);
  else if (periodKey === "month") since.setDate(since.getDate() - 30);
  else if (periodKey === "year") since.setFullYear(since.getFullYear() - 1);
  return list.filter(l => new Date(l.timestamp) >= since);
}
function tiGroupAuditByDate(list) {
  const groups = [];
  let currentLabel = null;
  const todayStr = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
  list.forEach(l => {
    const d = new Date(l.timestamp);
    const dayStr = d.toDateString();
    const label = dayStr === todayStr ? t("audit_today") : dayStr === yesterdayStr ? t("audit_yesterday")
      : d.toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", { day: "numeric", month: "long", year: "numeric" });
    if (label !== currentLabel) { groups.push({ label, entries: [] }); currentLabel = label; }
    groups[groups.length - 1].entries.push(l);
  });
  return groups;
}
function tiAuditActorBadge(l) {
  if (l.actorRole === "admin") return `<span class="badge badge-confirmed">${t('role_admin_label')}</span>`;
  if (l.agentRole === "supervisor") return `<span class="badge badge-paid">${t('role_supervisor')}</span>`;
  return `<span class="badge badge-pending">${t('role_agent')}</span>`;
}
function tiAuditPeriodTabsHtml(currentPeriod, rerenderFn) {
  const periods = [["today", "period_today_short"], ["week", "period_week"], ["month", "period_month"], ["year", "period_year"], ["all", "period_all"]];
  return `<div class="ti-period-tabs">${periods.map(([key, labelKey]) => `
    <button class="ti-period-tab ${key === currentPeriod ? 'active' : ''}" onclick="${rerenderFn}('${key}', 1)">${t(labelKey)}</button>`).join("")}</div>`;
}
function tiAuditPaginationHtml(page, totalPages, rerenderFn) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return `<div class="ti-audit-pagination">
    <button class="btn btn-outline btn-sm" ${page <= 1 ? "disabled" : ""} onclick="${rerenderFn}(null, ${page - 1})">${t('pagination_prev')}</button>
    <div class="ti-audit-pagination-pages">${pages.map(p => `<button class="ti-audit-page-btn ${p === page ? 'active' : ''}" onclick="${rerenderFn}(null, ${p})">${p}</button>`).join("")}</div>
    <button class="btn btn-outline btn-sm" ${page >= totalPages ? "disabled" : ""} onclick="${rerenderFn}(null, ${page + 1})">${t('pagination_next')}</button>
  </div>`;
}
function tiRenderAuditTimeline(mountId, fullList, state, rerenderFn) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  const tabsHtml = tiAuditPeriodTabsHtml(state.period, rerenderFn);
  const filtered = tiAuditPeriodFilter(fullList, state.period);
  if (!filtered.length) {
    mount.innerHTML = tabsHtml + tiEmptyStateHtml(t("audit_empty"), null, null, "clock");
    return;
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length / TI_AUDIT_PAGE_SIZE));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const pageItems = filtered.slice((state.page - 1) * TI_AUDIT_PAGE_SIZE, state.page * TI_AUDIT_PAGE_SIZE);
  const groups = tiGroupAuditByDate(pageItems);
  mount.innerHTML = tabsHtml + `
    <div class="ti-audit-count">${filtered.length} ${t('filter_results')}</div>
    <div class="ti-audit-timeline">
      ${groups.map(g => `
        <div class="ti-audit-day-group">
          <div class="ti-audit-day-label">${g.label}</div>
          ${g.entries.map(l => `
            <div class="ti-audit-entry">
              <span class="ti-audit-entry-icon">${tiAuditActionIcon(l.action)}</span>
              <div class="ti-audit-entry-body">
                <div class="ti-audit-entry-head">
                  <strong>${tiEscapeHtml(l.actorName)}</strong> ${tiAuditActorBadge(l)}
                  <span class="ti-audit-entry-time">${tiFormatTimeOnly(l.timestamp)}</span>
                </div>
                <div class="ti-audit-entry-action">${t('audit_action_' + l.action) || l.action}${l.targetLabel ? ` — <span class="ti-audit-entry-target">${tiEscapeHtml(l.targetLabel)}</span>` : ''}${l.details ? ` · ${tiEscapeHtml(l.details)}` : ''}</div>
              </div>
            </div>`).join('')}
        </div>`).join('')}
    </div>
    ${totalPages > 1 ? tiAuditPaginationHtml(state.page, totalPages, rerenderFn) : ''}`;
}
function tiFormatMonth(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", { month: "long", year: "numeric" });
}
function tiDeriveAgencyCode(name) {
  if (!name) return "AG";
  const words = name.trim().split(/\s+/).filter(w => w.length > 1);
  const initials = words.slice(0, 2).map(w => w[0].toUpperCase()).join("");
  return initials || "AG";
}
function tiRenderImpersonationBanner() {
  const mount = document.getElementById("ti-impersonation-banner");
  if (!mount) return;
  const original = tiLoad("ti_impersonator_session", null);
  if (!original) { mount.innerHTML = ""; return; }
  mount.innerHTML = `
    <div class="ti-impersonation-banner">
      <span>${t('impersonating_as')} <strong>${TI_SESSION.name}</strong> — ${t('impersonating_by')} ${original.name}</span>
      <button class="btn btn-sm" onclick="tiStopImpersonation()">${t('stop_impersonating')}</button>
    </div>`;
}
/** État composite utilisé pour le filtrage : distingue « à vendre » de
 *  « à louer » plutôt que de les regrouper sous un simple listingStatus
 *  « actif » générique. */
function tiPropertyStateValue(p) {
  const status = p.listingStatus || "active";
  if (status === "pending" || status === "rejected") return status;
  if (status === "under_contract") return "under_contract";
  if (status === "sold") return "sold";
  if (status === "rented") return "rented";
  return p.forSale ? "for_sale" : "for_rent";
}
function tiPropertyStateOptionsHtml() {
  return `
    <option value="">${t('filter_all_statuses')}</option>
    <option value="pending">${t('listing_status_pending')}</option>
    <option value="for_sale">${t('state_for_sale')}</option>
    <option value="under_contract">${t('listing_status_under_contract')}</option>
    <option value="sold">${t('listing_status_sold')}</option>
    <option value="for_rent">${t('state_for_rent')}</option>
    <option value="rented">${t('listing_status_rented')}</option>
    <option value="rejected">${t('listing_status_rejected')}</option>`;
}

/** Bandeau compact affiché sur les cartes de bien une fois qu'une annonce
 *  mise en favori n'est plus librement disponible — reprend les badges
 *  « Sous compromis »/« Vendu » utilisés par les grandes plateformes
 *  d'annonces, pour qu'une recherche sauvegardée raconte toujours
 *  l'histoire complète. */
function tiPropertyStatusRibbonHtml(p) {
  const status = p.listingStatus;
  if (!["under_contract", "sold", "rented"].includes(status)) return "";
  const cls = status === "under_contract" ? "ribbon-contract" : status === "sold" ? "ribbon-sold" : "ribbon-rented";
  const label = status === "under_contract" ? t("listing_status_under_contract") : status === "sold" ? t("listing_status_sold") : t("listing_status_rented");
  return `<span class="ti-card-ribbon ${cls}">${label}</span>`;
}

/* ---------- Graphique circulaire (dégradé conique CSS pur, sans bibliothèque, fonctionne hors ligne) ---------- */
/** Graphique de tendance SVG léger en courbe/aire (sans bibliothèque,
 *  cohérent avec les graphiques circulaires/en barres ailleurs) — la
 *  visualisation standard « métrique dans le temps » utilisée par les
 *  tableaux de bord SaaS professionnels (Stripe, HubSpot, Mixpanel, etc.). */
let TI_CHART_INSTANCE_COUNTER = 0;
function tiHighlightLinePoint(id, on) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("ti-line-point-active", on);
}
function tiLineChartSvg(labels, values, formatFn, compareValues) {
  formatFn = formatFn || (v => v);
  const chartId = "lc" + (TI_CHART_INSTANCE_COUNTER++);
  const w = 640, h = 220, padL = 44, padR = 16, padT = 16, padB = 30;
  const allVals = compareValues ? [...values, ...compareValues] : values;
  const max = Math.max(...allVals, 1);
  const min = Math.min(...allVals, 0);
  const range = (max - min) || 1;
  const stepX = (w - padL - padR) / Math.max(values.length - 1, 1);
  const xAt = i => padL + i * stepX;
  const yAt = v => padT + (h - padT - padB) * (1 - (v - min) / range);
  const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const areaPoints = `${padL},${yAt(min)} ${points} ${xAt(values.length - 1)},${yAt(min)}`;
  const gridLines = [0, 0.5, 1].map(f => {
    const y = padT + (h - padT - padB) * f;
    const val = max - f * range;
    return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
            <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--ink-soft)">${formatFn(Math.round(val))}</text>`;
  }).join("");
  const showEvery = Math.max(1, Math.ceil(labels.length / 7));
  const xLabels = labels.map((l, i) => i % showEvery === 0 || i === labels.length - 1
    ? `<text x="${xAt(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="var(--ink-soft)">${l}</text>` : "").join("");
  const comparePoly = compareValues
    ? `<polyline points="${compareValues.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ")}" fill="none" stroke="var(--ink-soft)" stroke-width="2" stroke-dasharray="5,4" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>`
    : "";
  // Tranches de survol invisibles, en pleine hauteur — une par point de
  // donnée, couvrant l'espace entre points voisins plutôt que le minuscule
  // point lui-même. C'est le schéma d'interaction utilisé par
  // Recharts/Chart.js : survoler n'importe où dans la « colonne » d'un
  // point plutôt que de devoir placer le curseur précisément sur un cercle
  // de 4px, ce qui rendait ces graphiques difficiles à utiliser sur des
  // écrans de laptop où plusieurs graphiques se partagent une ligne. Une
  // fine ligne repère et un point agrandi confirment quelle colonne est active.
  const hoverSlices = values.map((v, i) => {
    const cx = xAt(i);
    const leftEdge = i === 0 ? padL : (xAt(i - 1) + cx) / 2;
    const rightEdge = i === values.length - 1 ? (w - padR) : (cx + xAt(i + 1)) / 2;
    const tooltipText = (compareValues
      ? `${labels[i]}: ${formatFn(v)} (${t('trend_previous_period')}: ${formatFn(compareValues[i])})`
      : `${labels[i]}: ${formatFn(v)}`).toString().replace(/'/g, "\\'");
    const pointId = `${chartId}-pt-${i}`;
    return `
      <rect x="${leftEdge}" y="${padT}" width="${Math.max(0, rightEdge - leftEdge)}" height="${h - padT - padB}" fill="transparent" class="ti-line-hover-slice"
        onmouseenter="tiShowChartTooltip(event,'${tooltipText}');tiHighlightLinePoint('${pointId}',true)" onmousemove="tiPositionChartTooltip(event)" onmouseleave="tiHideChartTooltip();tiHighlightLinePoint('${pointId}',false)"></rect>
      <line x1="${cx}" y1="${padT}" x2="${cx}" y2="${h - padB}" class="ti-line-hover-guide"/>`;
  }).join("");
  return `
    <svg class="ti-line-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      ${gridLines}
      <polygon points="${areaPoints}" fill="var(--gold-soft)" opacity=".6"/>
      ${comparePoly}
      <polyline points="${points}" fill="none" stroke="var(--clay)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${values.map((v, i) => `<circle id="${chartId}-pt-${i}" cx="${xAt(i)}" cy="${yAt(v)}" r="5" fill="var(--clay)" class="ti-line-point"><title>${labels[i]}: ${formatFn(v)}</title></circle>`).join("")}
      ${compareValues ? compareValues.map((v, i) => `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="3.5" fill="var(--ink-soft)"><title>${t('trend_previous_period')} — ${labels[i]}: ${formatFn(v)}</title></circle>`).join("") : ""}
      ${xLabels}
      ${hoverSlices}
    </svg>
    ${compareValues ? `
    <div class="ti-line-chart-legend">
      <span class="ti-line-legend-item"><i class="solid"></i>${t('trend_current_period')}</span>
      <span class="ti-line-legend-item"><i class="dashed"></i>${t('trend_previous_period')}</span>
    </div>` : ""}`;
}
function tiLineChartHtml(title, labels, values, formatFn, compareValues) {
  return `
    <div class="ti-chart-card">
      <h4>${title}</h4>
      ${tiLineChartSvg(labels, values, formatFn, compareValues)}
    </div>`;
}

/** Petit badge d'écart façon « +12% vs période précédente », à côté du chiffre d'une carte statistique. */
function tiTrendBadgeHtml(deltaPct) {
  if (deltaPct == null) return "";
  const up = deltaPct >= 0;
  const cls = up ? "ti-trend-up" : "ti-trend-down";
  const arrow = up ? "▲" : "▼";
  return `<span class="ti-trend-badge ${cls}">${arrow} ${Math.abs(deltaPct)}%</span>`;
}

/** Pseudo-tendance déterministe utilisée seulement là où aucune vraie série
 *  historique n'existe encore — stable entre rechargements (initialisée par
 *  clé) plutôt qu'un scintillement aléatoire, et clairement bornée à une
 *  plage de pourcentage faible et plausible. */
function tiSeededDeltaPct(key, maxAbs = 18) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const pct = (hash % (maxAbs * 2 * 10)) / 10 - maxAbs;
  return Math.round(pct * 10) / 10;
}

/** Décompose un total cumulé en une série quotidienne lissée et déterministe,
 *  tendant vers « aujourd'hui » — utilisé quand on suit un compteur global
 *  mais pas un journal complet jour par jour, pour qu'un graphique de
 *  tendance puisse quand même être affiché sans scintillement aléatoire. */
/* ============================================================
   Texte généré par IA — adaptateur interchangeable
   ------------------------------------------------------------
   Chaque fonctionnalité de texte assistée par IA (résumés de rapports,
   génération de description d'annonce, ...) passe par tiGetAiText()
   ci-dessous plutôt que d'être écrite directement — brancher un vrai
   modèle de langage plus tard ne demandera qu'un changement d'une ligne
   ici, sans aucune modification nécessaire dans le code propre à chaque
   fonctionnalité.

   ADAPTATEUR 1 (actif par défaut) : générateur local à base de règles
     Aucune configuration nécessaire. Construit le texte directement à
     partir des données structurées que chaque fonctionnalité transmet —
     s'adapte réellement aux valeurs réelles, mais n'a aucune
     compréhension du langage à proprement parler.

   ADAPTATEUR 2 (prêt à activer) : vraie API de modèle de langage
     1. Mettez en place un petit point d'accès backend (par exemple dans
        la base /server utilisée pour TI_BACKEND="api") avec une route
        par nom de point d'accès ci-dessous (ex. POST
        /api/ai/report-insight, POST /api/ai/listing-description),
        chacune acceptant la charge utile JSON et renvoyant
        { result: "..." }. Gardez votre clé d'API de modèle côté
        serveur — n'appelez jamais une API de modèle de langage avec une
        clé intégrée dans le code du navigateur.
     2. Définissez TI_AI_BACKEND = "api" ci-dessous et TI_AI_API_BASE
        avec l'URL de base de ce serveur.
   Si l'appel API échoue pour une raison quelconque (hors ligne, délai
   dépassé, mauvaise réponse), tiGetAiText() revient silencieusement au
   générateur local pour que la fonctionnalité ne se retrouve jamais sans résultat.
   ============================================================ */
const TI_AI_BACKEND = "local"; // "local" | "api"
const TI_AI_API_BASE = "http://localhost:4000/api/ai";

async function tiGetAiText(endpoint, payload, localFallback) {
  if (TI_AI_BACKEND === "api") {
    try {
      const res = await fetch(`${TI_AI_API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result) return data.result;
      }
    } catch (err) {
      // Échec réseau ou API — on retombe sur le générateur local.
    }
  }
  return localFallback();
}
async function tiGetReportInsight(payload, localFallback) {
  return tiGetAiText("report-insight", payload, localFallback);
}

function tiSyntheticDailySeries(total, days, seedKey) {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed % 1000) / 1000; };
  const weights = Array.from({ length: days }, (_, i) => 0.5 + (i / days) * 0.8 + rand() * 0.6);
  const sumW = weights.reduce((a, b) => a + b, 0);
  let remaining = total;
  return weights.map((w, i) => {
    if (i === days - 1) return Math.max(remaining, 0);
    const v = Math.max(Math.round(total * (w / sumW)), 0);
    remaining -= v;
    return v;
  });
}

/* ---------- Infobulle de graphique partagée (survol courbe/barres) ---------- */
function tiShowChartTooltip(evt, text) {
  let tip = document.getElementById("ti-chart-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "ti-chart-tooltip";
    tip.className = "ti-chart-tooltip";
    document.body.appendChild(tip);
  }
  tip.textContent = text;
  tip.style.opacity = "1";
  tiPositionChartTooltip(evt);
}
function tiPositionChartTooltip(evt) {
  const tip = document.getElementById("ti-chart-tooltip");
  if (!tip) return;
  tip.style.left = evt.clientX + 14 + "px";
  tip.style.top = evt.clientY - 12 + "px";
}
function tiHideChartTooltip() {
  const tip = document.getElementById("ti-chart-tooltip");
  if (tip) tip.style.opacity = "0";
}

function tiPieChartHtml(title, items) {
  const total = items.reduce((s, i) => s + i.value, 0);
  let gradient, legend;
  if (!total) {
    gradient = "var(--line) 0deg 360deg";
    legend = `<div class="ti-pie-legend-item ti-pie-legend-empty">${t("no_data")}</div>`;
  } else {
    let acc = 0;
    gradient = items.filter(i => i.value > 0).map(i => {
      const start = (acc / total) * 360;
      acc += i.value;
      const end = (acc / total) * 360;
      return `${i.color} ${start}deg ${end}deg`;
    }).join(", ");
    legend = items.map(i => {
      const pct = Math.round((i.value / total) * 100);
      return `
      <div class="ti-pie-legend-item" onmouseenter="tiPieLegendHover(this,'${i.value}','${pct}%')" onmouseleave="tiPieLegendHover(this,null)">
        <span class="ti-pie-dot" style="background:${i.color}"></span>
        <span class="ti-pie-legend-label">${i.label}</span>
        <span class="ti-pie-legend-value">${i.value}</span>
      </div>`;
    }).join("");
  }
  return `
    <div class="ti-chart-card">
      <h4>${title}</h4>
      <div class="ti-pie-row">
        <div class="ti-pie" style="background: conic-gradient(${gradient});">
          <div class="ti-pie-center" data-total="${total}">
            <span class="ti-pie-center-value">${total}</span>
            <span class="ti-pie-center-sub"></span>
          </div>
        </div>
        <div class="ti-pie-legend">${legend}</div>
      </div>
    </div>`;
}
function tiPieLegendHover(el, value, pct) {
  const center = el.closest(".ti-pie-row")?.querySelector(".ti-pie-center");
  if (!center) return;
  const valueEl = center.querySelector(".ti-pie-center-value");
  const subEl = center.querySelector(".ti-pie-center-sub");
  if (value === null) {
    valueEl.textContent = center.dataset.total;
    subEl.textContent = "";
  } else {
    valueEl.textContent = value;
    subEl.textContent = pct;
  }
}

/* ---------- Graphique en barres horizontales (CSS pur, sans bibliothèque) — adapté aux données classées/par élément ---------- */
function tiBarChartHtml(title, items) {
  const max = Math.max(1, ...items.map(i => i.value));
  const rows = items.length ? items.map(i => `
    <div class="ti-bar-row" onmouseenter="tiShowChartTooltip(event,'${i.label.replace(/'/g, "\\'")}: ${i.value}')" onmousemove="tiPositionChartTooltip(event)" onmouseleave="tiHideChartTooltip()">
      <span class="ti-bar-label" title="${i.label}">${i.label}</span>
      <div class="ti-bar-track">
        <div class="ti-bar-fill" style="width:${Math.max(3, (i.value / max) * 100)}%; background:${i.color || 'var(--clay)'}"></div>
      </div>
      <span class="ti-bar-value">${i.value}</span>
    </div>`).join("") : `<div class="ti-pie-legend-item ti-pie-legend-empty">${t("no_data")}</div>`;
  return `
    <div class="ti-chart-card">
      <h4>${title}</h4>
      <div class="ti-bar-chart">${rows}</div>
    </div>`;
}

