/* ============================================================
   Timmo — property detail page logic
   ============================================================ */

let TI_PROPERTY = null;
let TI_MAP_INSTANCE = null;

function tiGetPropertyIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

async function tiRenderPropertyPage() {
  tiRenderHeader();
  tiRenderFooter();

  const id = tiGetPropertyIdFromUrl();
  TI_PROPERTY = await TiDB.getProperty(id);
  const root = document.getElementById("ti-property-root");
  if (!TI_PROPERTY) {
    root.innerHTML = `<p>Bien introuvable.</p>`;
    return;
  }
  try {
    await tiRenderPropertyContent();
  } catch (err) {
    console.error("Erreur d'affichage de la fiche bien:", err);
    root.innerHTML = `<p style="color:var(--ink-soft)">Une erreur est survenue lors du chargement de cette fiche. Essayez de vider le cache local (localStorage) du navigateur et de recharger la page.<br><small>${err.message || err}</small></p>`;
  }
}

async function tiRenderPropertyContent() {
  const root = document.getElementById("ti-property-root");
  const p = TI_PROPERTY;
  const s = tiGetSession();
  const favs = s ? (await TiDB.getFavorites(s.id)).map(f => f.propertyId) : [];
  const isFav = favs.includes(p.id);
  TiDB.recordView(p.id).catch(() => {}); // best-effort visit counter for agency analytics

  root.innerHTML = `
    <nav class="ti-breadcrumb" aria-label="Breadcrumb">
      <a href="index.html">${t('brand')}</a>
      <span>/</span>
      <a href="listings.html?type=${p.type}">${tiTypeLabel(p.type)}</a>
      <span>/</span>
      <a href="listings.html?hood=${p.neighborhood}">${tiNeighborhoodName(p.neighborhood)}</a>
      <span>/</span>
      <span class="ti-breadcrumb-current">${tiPropertyTitle(p)}</span>
    </nav>
    <div class="ti-card-hood" style="margin-bottom:6px;">${tiNeighborhoodName(p.neighborhood)} · ${tiAgencyName(p.agencyId)}${p.reference ? ` · <span class="ti-card-ref" style="display:inline;">${t('reference_label')} ${p.reference}</span>` : ''}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;">
      <h1 id="ti-prop-title" style="margin-bottom:8px;max-width:38ch;"></h1>
      <button class="ti-fav-pill ${isFav ? 'active' : ''}" id="ti-fav-btn" onclick="tiTogglePropertyFav()">
        <span class="ti-fav-pill-icon">${isFav ? TI_ICONS.heartFilled : TI_ICONS.heart}</span>
        <span id="ti-fav-btn-label">${isFav ? t('saved_fav') : t('save_fav')}</span>
      </button>
    </div>
    <div class="ti-rating" style="margin-bottom:20px;">${tiStarsHtml(p.rating)} ${p.rating} · ${p.reviews} avis</div>

    <div class="ti-detail-hero">
      <a class="ti-detail-hero-tile" onclick="tiOpenLightbox(0)">
        <img src="${p.photos[0]}" alt="" onload="this.classList.add('loaded')" onerror="this.style.display='none'">
      </a>
      <div class="ti-detail-hero-side">
        <a class="ti-detail-hero-tile" onclick="tiOpenLightbox(1)">
          <img src="${p.photos[1]}" alt="" onload="this.classList.add('loaded')" onerror="this.style.display='none'">
        </a>
        <a class="ti-detail-hero-tile" onclick="tiOpenLightbox(2)">
          <img src="${p.photos[2]}" alt="" onload="this.classList.add('loaded')" onerror="this.style.display='none'">
          ${p.photos.length > 3 ? `<div class="ti-hero-more-overlay">+${p.photos.length - 3} · ${t('gallery_title')}</div>` : ''}
        </a>
      </div>
    </div>
    <h4 style="margin-top:16px;" data-i18n="gallery_title"></h4>
    <div class="ti-gallery-strip-wrap">
      <div class="ti-gallery-strip">
        ${p.photos.map((url, i) => `
          <a class="ti-gallery-item" tabindex="0" onclick="tiOpenLightbox(${i})">
            <img src="${url}" alt="">
            <span class="ti-gallery-item-index">${i + 1}/${p.photos.length}</span>
          </a>`).join('')}
      </div>
    </div>

    <div class="ti-detail-grid">
      <div>
        <div class="ti-detail-stats">
          ${p.bedrooms ? `<div class="ti-detail-stat"><b>${p.bedrooms}</b><span>${t('bedrooms')}</span></div>` : ''}
          ${p.bathrooms ? `<div class="ti-detail-stat"><b>${p.bathrooms}</b><span>${t('bathrooms')}</span></div>` : ''}
          <div class="ti-detail-stat"><b>${p.area}</b><span>${t('area')}</span></div>
          ${p.type !== 'land' ? `<div class="ti-detail-stat"><b>${p.furnished ? '✓' : '—'}</b><span data-i18n="perk_furnished"></span></div>` : ''}
        </div>
        <p id="ti-prop-desc" style="font-size:1rem;color:var(--ink-soft);"></p>

        <div class="ti-features-wrap">
          <h4 style="margin:0 0 4px;" data-i18n="features_title"></h4>
          <p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:4px;" data-i18n="features_sub"></p>
          <div class="ti-features-grid">
            ${(p.amenities || tiBuildAmenities(p.type, p.furnished)).map(a => `
              <div class="ti-feature-item">
                <span class="ti-feature-icon">${tiAmenityIconChar(a.icon)}</span>
                <span>${tiGetLang() === "en" ? a.labelEn : a.label}</span>
              </div>`).join('')}
          </div>
        </div>

        <h4 style="margin-top:30px;" data-i18n="map_title"></h4>
        <div id="ti-map"></div>

        ${p.shortStay ? `
        <h4 style="margin-top:30px;" data-i18n="availability_title"></h4>
        <p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:4px;" data-i18n="availability_sub"></p>
        <div id="ti-page-calendar"></div>
        ` : ''}

        <h4 style="margin-top:30px;" data-i18n="reviews_title"></h4>
        <div id="ti-reviews-mount"></div>
        <button class="btn btn-outline" style="margin-top:14px;" onclick="tiOpenReviewModal()" data-i18n="write_review"></button>
      </div>

      <div class="ti-sticky-card">
        <div class="ti-sticky-price" data-price-xof="${p.price}">${tiFormatPrice(p.price)}</div>
        <div style="color:var(--ink-soft);font-size:.85rem;margin-bottom:18px;">${p.forSale ? t('price_sale') : (p.shortStay ? t('per_night') : t('per_month'))}</div>
        ${!p.forSale && !p.shortStay ? `<div class="ti-availability-badge ${tiIsAvailableNow(p) ? 'available' : 'upcoming'}">${tiIsAvailableNow(p) ? t('availability_now') : t('availability_from') + ' ' + tiFormatDateLong(p.availableFrom)}</div>` : ''}
        <button class="btn btn-primary btn-block" style="margin-bottom:10px;" onclick="tiOpenBookingModal()" data-i18n="book_title"></button>
        <button class="btn btn-dark btn-block" style="margin-bottom:10px;" onclick="tiOpenPaymentModal()" data-i18n="pay_title"></button>
        <button class="btn btn-outline btn-block" onclick="tiOpenMessageModal()" data-i18n="agency_contact_title"></button>
        <div class="ti-agency-strip">
          <div class="ti-agency-avatar">${tiAgencyName(p.agencyId).split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
          <div>
            <strong>${tiAgencyName(p.agencyId)}</strong>
            <div style="color:var(--ink-soft);font-size:.82rem;">${TI_AGENCIES.find(a => a.id === p.agencyId)?.phone || ''}</div>
          </div>
        </div>
      </div>
    </div>

    <div id="ti-similar-section"></div>
  `;
  document.getElementById("ti-prop-title").textContent = tiPropertyTitle(p);
  document.getElementById("ti-prop-desc").textContent = tiPropertyDesc(p);
  tiApplyLang();
  tiApplyCurrency();
  // Deferred to the next frame so the browser has committed layout first —
  // Leaflet in particular needs a container with a real, painted size.
  requestAnimationFrame(() => {
    try { tiInitMap(); } catch (err) { console.error("Erreur carte:", err); }
  });
  if (p.shortStay) {
    try { await tiInitPageCalendar(); } catch (err) { console.error("Erreur calendrier:", err); }
  }
  tiRenderReviews();
  tiRenderSimilar();
}

async function tiRenderSimilar() {
  const p = TI_PROPERTY;
  const all = await TiDB.getProperties();
  const s = tiGetSession();
  const favs = s ? (await TiDB.getFavorites(s.id)).map(f => f.propertyId) : [];
  let similar = all.filter(x => x.id !== p.id && (x.type === p.type || x.neighborhood === p.neighborhood));
  similar.sort((a, b) => (b.type === p.type ? 1 : 0) + (b.neighborhood === p.neighborhood ? 1 : 0) - ((a.type === p.type ? 1 : 0) + (a.neighborhood === p.neighborhood ? 1 : 0)));
  similar = similar.slice(0, 3);
  const mount = document.getElementById("ti-similar-section");
  if (!similar.length || !mount) { if (mount) mount.innerHTML = ''; return; }
  mount.innerHTML = `
    <h4 style="margin-top:44px;">Biens similaires</h4>
    <div class="ti-grid ti-reveal-stagger in-view">${similar.map(sp => tiPropertyCardHtml(sp, favs)).join('')}</div>
  `;
}

/* ---------- Map ---------- */
function tiInitMap() {
  const p = TI_PROPERTY;
  const container = document.getElementById("ti-map");
  if (!container) return;
  if (typeof L === "undefined") {
    container.innerHTML = `<div class="ti-map-fallback">Carte indisponible — vérifiez votre connexion internet.<br><small>Map unavailable — check your internet connection.</small></div>`;
    return;
  }
  TI_MAP_INSTANCE = L.map(container, { scrollWheelZoom: false }).setView([p.lat, p.lng], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(TI_MAP_INSTANCE);
  L.marker([p.lat, p.lng]).addTo(TI_MAP_INSTANCE).bindPopup(tiPropertyTitle(p)).openPopup();
  // Leaflet can mis-measure a container that was just inserted into the DOM;
  // force it to re-check its size once the layout has fully settled.
  setTimeout(() => TI_MAP_INSTANCE && TI_MAP_INSTANCE.invalidateSize(), 200);
}

/* ---------- Lightbox (gallery-aware) ---------- */
let TI_LIGHTBOX_INDEX = 0;
function tiOpenLightbox(index) {
  TI_LIGHTBOX_INDEX = index;
  tiRenderLightbox();
  tiOpenModal("modal-lightbox");
}
function tiLightboxStep(delta) {
  const n = TI_PROPERTY.photos.length;
  TI_LIGHTBOX_INDEX = (TI_LIGHTBOX_INDEX + delta + n) % n;
  tiRenderLightbox();
}
function tiRenderLightbox() {
  const img = document.getElementById("lightbox-img");
  img.classList.remove("loaded");
  img.style.display = "";
  img.src = TI_PROPERTY.photos[TI_LIGHTBOX_INDEX];
  img.onload = () => img.classList.add("loaded");
  img.onerror = () => { img.style.display = "none"; };
  document.getElementById("lightbox-counter").textContent = `${TI_LIGHTBOX_INDEX + 1} / ${TI_PROPERTY.photos.length}`;
}
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("modal-lightbox")?.classList.contains("open")) return;
  if (e.key === "ArrowLeft") tiLightboxStep(-1);
  if (e.key === "ArrowRight") tiLightboxStep(1);
  if (e.key === "Escape") tiCloseModal("modal-lightbox");
});

/* ---------- Favorite ---------- */
async function tiTogglePropertyFav() {
  const s = tiGetSession();
  if (!s) { window.location.href = "login.html"; return; }
  const nowFav = await TiDB.toggleFavorite(s.id, TI_PROPERTY.id);
  const btn = document.getElementById("ti-fav-btn");
  btn.classList.toggle("active", nowFav);
  btn.querySelector(".ti-fav-pill-icon").innerHTML = nowFav ? TI_ICONS.heartFilled : TI_ICONS.heart;
  document.getElementById("ti-fav-btn-label").textContent = nowFav ? t("saved_fav") : t("save_fav");
  btn.classList.remove("pulse");
  void btn.offsetWidth; // restart animation
  btn.classList.add("pulse");
  tiToast(nowFav ? t("saved_fav") : t("save_fav"));
}

/* ---------- Booking date fields: availability calendar (short stay) or simple date input ---------- */
function tiTodayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function tiIsAvailableNow(p) {
  return !p.availableFrom || p.availableFrom <= tiTodayIso();
}
function tiFormatDateLong(iso) {
  if (!iso) return "";
  const locale = tiGetLang() === "en" ? "en-US" : "fr-FR";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T00:00:00"));
}
function tiIsoFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function tiEachDateInRange(startIso, endIso) {
  if (!startIso || !endIso) return [];
  const dates = [];
  let d = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  while (d < end) { dates.push(tiIsoFromDate(d)); d.setDate(d.getDate() + 1); }
  return dates;
}
function tiRangeHasUnavailable(startIso, endIso, bookedSet, blockedSet) {
  return tiEachDateInRange(startIso, endIso).slice(1).some(iso => bookedSet.has(iso) || blockedSet.has(iso));
}

let TI_CAL_STATE = null;

/* Always-visible calendar rendered directly on the property page for
   short-stay listings (not just tucked away inside the booking modal). */
async function tiInitPageCalendar() {
  const p = TI_PROPERTY;
  const mount = document.getElementById("ti-page-calendar");
  if (!mount) return;
  const bookings = await TiDB.getBookings({ propertyId: p.id });
  const bookedSet = new Set();
  bookings.filter(b => b.status !== "cancelled" && b.checkin && b.checkout)
    .forEach(b => tiEachDateInRange(b.checkin, b.checkout).forEach(d => bookedSet.add(d)));
  const blockedSet = new Set(p.blockedDates || []);
  const minDate = p.availableFrom && p.availableFrom > tiTodayIso() ? p.availableFrom : tiTodayIso();
  const start = new Date(minDate + "T00:00:00");
  TI_CAL_STATE = { year: start.getFullYear(), month: start.getMonth(), bookedSet, blockedSet, minDate, checkin: null, checkout: null, mountId: "ti-page-calendar" };
  mount.innerHTML = `
    <div id="bk-calendar"></div>
    <div class="ti-cal-legend">
      <span><i class="ti-cal-dot available"></i>${t('cal_legend_available')}</span>
      <span><i class="ti-cal-dot booked"></i>${t('cal_legend_booked')}</span>
      <span><i class="ti-cal-dot blocked"></i>${t('cal_legend_blocked')}</span>
      <span><i class="ti-cal-dot selected"></i>${t('cal_legend_selected')}</span>
    </div>
    <input type="hidden" id="bk-checkin">
    <input type="hidden" id="bk-checkout">`;
  tiRenderCalendar();
  tiApplyLang();
}

async function tiRenderBookingDateFields() {
  const p = TI_PROPERTY;
  const container = document.getElementById("bk-date-fields");
  if (p.shortStay) {
    // Selection already happens in the always-visible page calendar; the
    // modal just confirms (or prompts for) the chosen dates.
    const st = TI_CAL_STATE;
    const hasRange = st && st.checkin && st.checkout;
    container.innerHTML = hasRange
      ? `<div class="ti-booking-dates-summary">
           <span>${tiFormatDateLong(st.checkin)} → ${tiFormatDateLong(st.checkout)}</span>
           <button type="button" class="ti-cal-clear" onclick="tiCloseModal('modal-book');tiScrollToCalendar();">${t('cal_change_dates')}</button>
         </div>`
      : `<p class="ti-availability-note">${t('cal_select_prompt')}</p>`;
  } else {
    const minDate = p.availableFrom && p.availableFrom > tiTodayIso() ? p.availableFrom : tiTodayIso();
    const availNote = !tiIsAvailableNow(p)
      ? `<p class="ti-availability-note">${t('availability_from')} <strong>${tiFormatDateLong(p.availableFrom)}</strong></p>` : "";
    container.innerHTML = `
      ${availNote}
      <div class="field-row">
        <div class="field"><label data-i18n="book_checkin"></label><input type="date" id="bk-checkin" required min="${minDate}"></div>
        <div class="field"><label data-i18n="book_checkout"></label><input type="date" id="bk-checkout" min="${minDate}"></div>
      </div>`;
  }
  tiApplyLang();
}

function tiScrollToCalendar() {
  document.getElementById("ti-page-calendar")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function tiCalNav(delta) {
  TI_CAL_STATE.month += delta;
  if (TI_CAL_STATE.month < 0) { TI_CAL_STATE.month = 11; TI_CAL_STATE.year--; }
  if (TI_CAL_STATE.month > 11) { TI_CAL_STATE.month = 0; TI_CAL_STATE.year++; }
  tiRenderCalendar();
}

function tiCalDayClick(iso) {
  const st = TI_CAL_STATE;
  if (!st.checkin || (st.checkin && st.checkout)) {
    st.checkin = iso; st.checkout = null;
  } else if (iso <= st.checkin) {
    st.checkin = iso; st.checkout = null;
  } else if (tiRangeHasUnavailable(st.checkin, iso, st.bookedSet, st.blockedSet)) {
    st.checkin = iso; st.checkout = null;
  } else {
    st.checkout = iso;
  }
  document.getElementById("bk-checkin").value = st.checkin || "";
  document.getElementById("bk-checkout").value = st.checkout || "";
  tiRenderCalendar();
}

function tiCalClear() {
  TI_CAL_STATE.checkin = null;
  TI_CAL_STATE.checkout = null;
  document.getElementById("bk-checkin").value = "";
  document.getElementById("bk-checkout").value = "";
  tiRenderCalendar();
}

function tiRenderCalendar() {
  const st = TI_CAL_STATE;
  const mount = document.getElementById("bk-calendar");
  if (!mount) return;
  const locale = tiGetLang() === "en" ? "en-US" : "fr-FR";
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(st.year, st.month, 1));
  const firstDay = new Date(st.year, st.month, 1);
  const daysInMonth = new Date(st.year, st.month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first

  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const weekDays = [];
  for (let i = 0; i < 7; i++) weekDays.push(weekdayFmt.format(new Date(2024, 0, 1 + i))); // Jan 1 2024 = Monday

  let cells = "";
  for (let i = 0; i < startOffset; i++) cells += `<div class="ti-cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${st.year}-${String(st.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let cls = "ti-cal-cell";
    let clickable = false;
    if (iso < st.minDate) cls += " disabled";
    else if (st.bookedSet.has(iso)) cls += " booked";
    else if (st.blockedSet.has(iso)) cls += " blocked";
    else { cls += " available"; clickable = true; }
    if (st.checkin === iso) cls += " selected-start";
    if (st.checkout === iso) cls += " selected-end";
    if (st.checkin && st.checkout && iso > st.checkin && iso < st.checkout) cls += " in-range";
    cells += `<div class="${cls}" ${clickable ? `onclick="tiCalDayClick('${iso}')"` : ""}>${day}</div>`;
  }

  let statusText = t("cal_select_checkin");
  if (st.checkin && !st.checkout) statusText = `${tiFormatDateLong(st.checkin)} — ${t("cal_select_checkout")}`;
  if (st.checkin && st.checkout) {
    const nights = tiEachDateInRange(st.checkin, st.checkout).length;
    const nightsLabel = tiGetLang() === "en" ? (nights > 1 ? "nights" : "night") : (nights > 1 ? "nuits" : "nuit");
    statusText = `${tiFormatDateLong(st.checkin)} → ${tiFormatDateLong(st.checkout)} · ${nights} ${nightsLabel}`;
  }

  mount.innerHTML = `
    <div class="ti-cal-status">${statusText}</div>
    <div class="ti-cal-card">
      <div class="ti-cal-nav">
        <button type="button" onclick="tiCalNav(-1)" aria-label="Mois précédent">&#8249;</button>
        <strong>${monthLabel}</strong>
        <button type="button" onclick="tiCalNav(1)" aria-label="Mois suivant">&#8250;</button>
      </div>
      <div class="ti-cal-weekdays">${weekDays.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="ti-cal-grid">${cells}</div>
    </div>
    ${st.checkin ? `<button type="button" class="ti-cal-clear" onclick="tiCalClear()">${t('cal_clear')}</button>` : ""}
  `;
}

/* ---------- Booking ---------- */
function tiOpenBookingModal() {
  const s = tiGetSession();
  if (s) {
    document.getElementById("bk-name").value = s.name;
    document.getElementById("bk-email").value = s.email;
  }
  tiRenderBookingDateFields();
  tiOpenModal("modal-book");
}
async function tiSubmitBooking(e) {
  e.preventDefault();
  const checkin = document.getElementById("bk-checkin").value;
  const checkout = document.getElementById("bk-checkout")?.value;
  if (!checkin) { tiToast(t("cal_select_checkin")); return false; }
  if (TI_PROPERTY.shortStay && !checkout) { tiToast(t("cal_select_checkout")); return false; }
  const btn = e.target.querySelector("button[type=submit]");
  tiSetBtnLoading(btn, true);
  const s = tiGetSession();
  await new Promise(r => setTimeout(r, 500));
  await TiDB.createBooking({
    propertyId: TI_PROPERTY.id,
    propertyTitle: tiPropertyTitle(TI_PROPERTY),
    agencyId: TI_PROPERTY.agencyId,
    userId: s ? s.id : "guest_" + Date.now(),
    checkin,
    checkout: checkout || "",
    name: document.getElementById("bk-name").value,
    phone: document.getElementById("bk-phone").value,
    email: document.getElementById("bk-email").value,
    message: document.getElementById("bk-message").value,
    price: TI_PROPERTY.price,
  });
  tiSetBtnLoading(btn, false);
  tiCloseModal("modal-book");
  tiToast(t("status_pending") + " — " + t("book_title"));
  e.target.reset();
  return false;
}

/* ---------- Message ---------- */
function tiOpenMessageModal() {
  const s = tiGetSession();
  if (!s) { window.location.href = "login.html"; return; }
  tiOpenModal("modal-message");
}
async function tiSubmitMessage(e) {
  e.preventDefault();
  const s = tiGetSession();
  await TiDB.sendMessage({
    propertyId: TI_PROPERTY.id,
    propertyTitle: tiPropertyTitle(TI_PROPERTY),
    agencyId: TI_PROPERTY.agencyId,
    userId: s.id,
    userName: s.name,
    from: "client",
    text: document.getElementById("msg-text").value,
  });
  tiCloseModal("modal-message");
  tiToast(t("send_message") + " ✓");
  e.target.reset();
  return false;
}

/* ---------- Payment ---------- */
function tiOpenPaymentModal() {
  const s = tiGetSession();
  if (!s) { window.location.href = "login.html"; return; }
  document.getElementById("pay-amount-display").textContent = tiFormatPrice(TI_PROPERTY.price);
  tiOpenModal("modal-pay");
}
async function tiSubmitPayment(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  tiSetBtnLoading(btn, true);
  const s = tiGetSession();
  const method = document.querySelector('input[name="pm"]:checked').value;
  await new Promise(r => setTimeout(r, 900));
  await TiDB.createPayment({
    propertyId: TI_PROPERTY.id,
    propertyTitle: tiPropertyTitle(TI_PROPERTY),
    userId: s.id,
    amount: TI_PROPERTY.price,
    method,
    status: "paid",
  });
  tiSetBtnLoading(btn, false);
  tiCloseModal("modal-pay");
  tiToast(t("pay_success"));
  return false;
}

/* ---------- Reviews ---------- */
let TI_SELECTED_RATING = 5;
function tiOpenReviewModal() {
  const s = tiGetSession();
  if (!s) { window.location.href = "login.html"; return; }
  tiRenderReviewTagsPicker();
  tiOpenModal("modal-review");
}
function tiRenderReviewTagsPicker() {
  const mount = document.getElementById("review-tags-picker");
  if (!mount) return;
  mount.innerHTML = TI_REVIEW_TAGS.map(tag => `
    <label class="ti-amenity-option">
      <input type="checkbox" value="${tag.id}">
      ${tiGetLang() === "en" ? tag.labelEn : tag.label}
    </label>`).join("");
}
function tiReadSelectedReviewTags() {
  return [...document.querySelectorAll("#review-tags-picker input:checked")].map(cb => cb.value);
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#review-star-input span").forEach(star => {
    star.addEventListener("click", () => {
      TI_SELECTED_RATING = parseInt(star.dataset.v);
      document.querySelectorAll("#review-star-input span").forEach(s2 => {
        s2.classList.toggle("active", parseInt(s2.dataset.v) <= TI_SELECTED_RATING);
      });
    });
  });
});
async function tiSubmitReview(e) {
  e.preventDefault();
  const s = tiGetSession();
  await TiDB.addReview({
    propertyId: TI_PROPERTY.id,
    userId: s.id,
    userName: s.name,
    rating: TI_SELECTED_RATING,
    tags: tiReadSelectedReviewTags(),
    comment: document.getElementById("review-comment").value,
  });
  tiCloseModal("modal-review");
  tiToast(t("submit_review") + " ✓");
  e.target.reset();
  tiRenderReviews();
  return false;
}
async function tiRenderReviews() {
  const reviews = (await TiDB.getReviews(TI_PROPERTY.id)).filter(r => r.approved !== false);
  const mount = document.getElementById("ti-reviews-mount");
  if (!reviews.length) {
    mount.innerHTML = `<p style="color:var(--ink-soft)">—</p>`;
    return;
  }
  mount.innerHTML = reviews.map(r => `
    <div class="ti-review">
      <div class="ti-review-head"><span>${tiEscapeHtml(r.userName)}</span>${tiStarsHtml(r.rating)}</div>
      ${tiReviewTagsHtml(r.tags)}
      ${r.comment ? `<p style="margin:6px 0 0;color:var(--ink-soft);">${tiEscapeHtml(r.comment)}</p>` : ''}
    </div>`).join('');
}

tiRenderPropertyPage();
