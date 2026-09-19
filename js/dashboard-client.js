/* ============================================================
   Timmo — tableau de bord client
   ============================================================ */

const TI_SESSION = tiRequireRole("client");

function tiShowPanel(name) {
  document.querySelectorAll(".ti-dash-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".ti-dash-nav a").forEach(a => a.classList.remove("active"));
  const panel = document.getElementById("panel-" + name);
  if (panel) panel.classList.add("active");
  const navLink = document.querySelector(`.ti-dash-nav a[data-panel="${name}"]`);
  if (navLink) navLink.classList.add("active");
  if (name === "messages") { tiMarkAnnouncementsSeen(); tiSetNavBadge("messages", 0); }
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
    overview: tiRenderClientOverview,
    bookings: tiRenderBookings,
    favorites: tiRenderFavorites,
    messages: async () => { await Promise.all([tiRenderAnnouncements(), tiRenderMessages()]); },
    documents: tiRenderDocuments,
    payments: tiRenderPayments,
  };
  const fn = tasksByPanel[panelName];
  if (fn) await fn();
}

function tiStatusBadge(status) {
  const map = { pending: "status_pending", confirmed: "status_confirmed", cancelled: "status_cancelled", paid: "status_paid" };
  return `<span class="badge badge-${status}">${t(map[status] || status)}</span>`;
}

let TI_CLIENT_ALL_BOOKINGS = [];

async function tiRenderClientOverview() {
  const bookings = await TiDB.getBookings({ userId: TI_SESSION.id });
  const favs = await TiDB.getFavorites(TI_SESSION.id);
  const activeBookings = bookings.filter(b => b.status !== "cancelled");
  let upcomingPayments = 0;
  bookings.forEach(b => {
    if (!b.rental) return;
    upcomingPayments += b.rental.schedule.filter(item => item.status === "pending").length;
  });

  const greetingEl = document.getElementById("overview-greeting");
  if (greetingEl) greetingEl.textContent = `${t('overview_greeting')}, ${TI_SESSION.name.split(' ')[0]}`;

  const mount = document.getElementById("client-overview-mount");
  if (!mount) return;
  mount.innerHTML = `
    <div class="ti-agency-stat-grid">
      <div class="ti-stat-card" style="cursor:pointer;" onclick="tiShowPanel('bookings')">
        <span class="ti-stat-icon">${TI_ICONS.document}</span><b>${activeBookings.length}</b><span>${t('overview_active_bookings')}</span>
      </div>
      <div class="ti-stat-card" style="cursor:pointer;" onclick="tiShowPanel('favorites')">
        <span class="ti-stat-icon">${TI_ICONS.heart}</span><b>${favs.length}</b><span>${t('dash_favorites')}</span>
      </div>
      <div class="ti-stat-card ${upcomingPayments ? 'ti-stat-card-alert' : ''}" style="cursor:pointer;" onclick="tiShowPanel('payments')">
        <span class="ti-stat-icon">${TI_ICONS.document}</span><b>${upcomingPayments}</b><span>${t('overview_upcoming_payments')}</span>
      </div>
    </div>
    <div class="ti-overview-cta">
      <div>
        <strong>${t('overview_cta_title')}</strong>
        <p style="color:var(--ink-soft);font-size:.88rem;margin:4px 0 0;">${t('overview_cta_sub')}</p>
      </div>
      <a href="listings.html" class="btn btn-primary">${t('overview_cta_button')}</a>
    </div>`;
}

async function tiRenderBookings() {
  TI_CLIENT_ALL_BOOKINGS = await TiDB.getBookings({ userId: TI_SESSION.id });
  if (!TI_CLIENT_ALL_BOOKINGS.length) {
    document.getElementById("bookings-filters").innerHTML = "";
    document.getElementById("bookings-mount").innerHTML = tiEmptyStateHtml(t('empty_bookings'), t('see_all'), 'listings.html', 'home');
    return;
  }
  tiSimpleSearchBar("bookings-filters", "bk-search", t('filter_search_title'), tiApplyBookingsFilter);
  tiApplyBookingsFilter();
}
function tiApplyBookingsFilter() {
  const q = document.getElementById("bk-search").value.trim().toLowerCase();
  const bookings = q ? TI_CLIENT_ALL_BOOKINGS.filter(b => b.propertyTitle.toLowerCase().includes(q)) : TI_CLIENT_ALL_BOOKINGS;
  const mount = document.getElementById("bookings-mount");
  mount.innerHTML = bookings.length ? bookings.map(b => tiBookingCardHtml(b)).join('') : `<p style="color:var(--ink-soft)">${t('filter_no_results')}</p>`;
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

function tiDossierDocsListHtml(b) {
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
            ${doc.status !== 'approved' ? `
              <label class="btn btn-outline btn-sm ti-upload-btn">
                ${TI_ICONS.upload} ${doc.status === 'pending' ? t('upload_document') : t('resubmit_document')}
                <input type="file" onchange="tiUploadDocument(event,'${b.id}','${doc.key}')">
              </label>` : `<span class="ti-doc-approved-check">${TI_ICONS.check}</span>`}
          </div>
        </div>`).join('')}
    </div>`;
}
function tiDossierStepperHtml(b) {
  const stage = tiComputeBookingStage(b);
  const stageOrder = ["validation", "signature", "active"];
  const currentIndex = stageOrder.indexOf(stage);
  const hasContracts = b.contracts && b.contracts.length;
  const due = (stage === "validation") ? tiDueDateInfo(b.dossierDueAt) : null;
  const steps = [
    { key: "validation", title: t('dossier_step_documents') },
    { key: "signature", title: t('dossier_step_signature') },
    { key: "active", title: t('dossier_step_active') },
  ];
  return `
    <div class="ti-dossier">
      <div class="ti-stepper">
        ${steps.map((step, i) => {
          const state = currentIndex === -1 ? "upcoming" : i < currentIndex ? "completed" : i === currentIndex ? "active" : "upcoming";
          return `
          <div class="ti-stepper-step ti-stepper-${state}">
            <div class="ti-stepper-connector-line ${i === 0 ? 'ti-stepper-connector-hidden' : ''}"></div>
            <div class="ti-stepper-marker">${state === 'completed' ? TI_ICONS.check : (i + 1)}</div>
            <div class="ti-stepper-body">
              <div class="ti-stepper-title">${step.title}${state === 'active' && step.key === 'validation' && due ? `
                <span class="ti-stepper-due ti-stepper-due-${due.urgency}">
                  ${due.urgency === 'overdue' ? t('due_date_overdue') : t('due_date_prefix') + ' ' + due.label}
                </span>` : ''}</div>
              ${state === 'active' && step.key === 'validation' ? `
                <div class="ti-stepper-status">${tiDossierStatusBadge(b.dossierStatus)}</div>
                ${tiDossierDocsListHtml(b)}` : ''}
              ${state === 'active' && step.key === 'signature' ? `
                <div class="ti-stepper-status">${hasContracts ? t('dossier_step_signature_pending') : t('dossier_step_signature_waiting')}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function tiBookingCardHtml(b) {
  const hasDossier = b.documentRequests && b.documentRequests.length;
  return `
    <div class="ti-booking-card">
      <div class="ti-booking-card-head">
        <div>
          <strong>${tiEscapeHtml(b.propertyTitle)}</strong>
          <div class="ti-booking-meta">${b.checkin || '—'}${b.checkout ? ' → ' + b.checkout : ''} · ${tiFormatPrice(b.price)}</div>
        </div>
        ${tiStatusBadge(b.status)}
      </div>
      ${hasDossier ? tiDossierStepperHtml(b) : ''}
    </div>`;
}

function tiOpenDocumentByKey(bookingId, docKey) {
  const booking = TI_CLIENT_ALL_BOOKINGS.find(b => b.id === bookingId);
  const doc = booking?.documentRequests?.find(d => d.key === docKey);
  if (doc?.fileData) tiOpenDocument(doc.fileData, doc.fileName);
}

async function tiUploadDocument(e, bookingId, docKey) {
  const file = e.target.files[0];
  if (!file) return;
  let fileData = null;
  let tooLarge = false;
  if (file.size <= TI_MAX_DOC_PREVIEW_SIZE) {
    try { fileData = await tiReadFileAsDataUrl(file); } catch (err) { console.error(err); }
  } else {
    tooLarge = true;
  }
  const result = await TiDB.submitDocument(bookingId, docKey, file.name, fileData);
  const fallback = tooLarge || result?._storageFallback;
  tiToast(t('file_selected') + ' — ' + file.name + (fallback ? ` (${t('file_too_large_note')})` : ''));
  await tiRefreshPanel("bookings");
}

function tiGetLastSeenAnnouncements() {
  return localStorage.getItem(`ti_lastseen_announcements_${TI_SESSION.id}`) || "1970-01-01T00:00:00.000Z";
}
function tiMarkAnnouncementsSeen() {
  localStorage.setItem(`ti_lastseen_announcements_${TI_SESSION.id}`, new Date().toISOString());
}
async function tiRenderAnnouncements() {
  const list = await TiDB.getAnnouncements({ userId: TI_SESSION.id });
  const mount = document.getElementById("announcements-mount");
  if (!mount) return;
  const lastSeen = tiGetLastSeenAnnouncements();
  tiSetNavBadge("messages", list.filter(a => a.createdAt > lastSeen).length);
  if (!list.length) { mount.innerHTML = tiEmptyStateHtml(t('announcements_empty'), null, null, 'bell'); return; }
  const allProps = await TiDB.getProperties();
  mount.innerHTML = list.map(a => {
    const prop = a.propertyId ? allProps.find(p => p.id === a.propertyId) : null;
    return `
    <div class="ti-announcement-card">
      <div class="ti-announcement-head">
        <strong>${tiEscapeHtml(a.title)}</strong>
        <span class="ti-announcement-date">${tiFormatDateTime(a.createdAt)}</span>
      </div>
      <span class="ti-announcement-agency">${tiEscapeHtml(tiAgencyName(a.agencyId))}${prop ? ` · ${tiEscapeHtml(tiPropertyTitle(prop))}` : ''}</span>
      <p>${tiEscapeHtml(a.text)}</p>
    </div>`;
  }).join('');
}

async function tiRenderMessages() {
  const msgs = await TiDB.getMessages({ userId: TI_SESSION.id });
  const mount = document.getElementById("messages-mount");
  if (!msgs.length) { mount.innerHTML = tiEmptyStateHtml(t('empty_messages'), null, null, 'mail'); return; }
  const byProperty = {};
  msgs.forEach(m => { (byProperty[m.propertyId] = byProperty[m.propertyId] || []).push(m); });
  mount.innerHTML = Object.entries(byProperty).map(([propId, list]) => `
    <div class="ti-list-row" style="align-items:flex-start;flex-direction:column;">
      <strong>${tiEscapeHtml(list[0].propertyTitle)}</strong>
      <div class="ti-msg-thread" style="margin-top:10px;width:100%;">
        ${list.map(m => `
          <div class="ti-msg-bubble ${m.from === 'client' ? 'ti-msg-me' : 'ti-msg-them'}">
            ${m.from === 'owner' ? `<div class="ti-msg-sender-label">${t('sender_owner_label')}</div>` : ''}
            ${tiEscapeHtml(m.text)}
          </div>`).join('')}
      </div>
    </div>`).join('');
}

let TI_CLIENT_DOC_BOOKINGS = [];
async function tiRenderDocuments() {
  TI_CLIENT_DOC_BOOKINGS = await TiDB.getBookings({ userId: TI_SESSION.id });
  const mount = document.getElementById("documents-mount");
  const withDocs = TI_CLIENT_DOC_BOOKINGS.filter(b => (b.contracts && b.contracts.length) || (b.documents && b.documents.length));
  if (!withDocs.length) { mount.innerHTML = tiEmptyStateHtml(t('documents_empty'), null, null, 'document'); return; }
  mount.innerHTML = withDocs.map(b => `
    <div class="ti-list-row" style="align-items:flex-start;flex-direction:column;">
      <strong>${tiEscapeHtml(b.propertyTitle)}</strong>
      <span style="color:var(--ink-soft);font-size:.82rem;">${tiEscapeHtml(tiAgencyName(b.agencyId))}</span>
      <div class="ti-dossier-docs" style="width:100%;margin-top:10px;">
        ${(b.documents || []).map(d => `
          <div class="ti-dossier-doc">
            <div class="ti-dossier-doc-info">
              <span class="ti-doc-status-dot approved"></span>
              <span class="ti-dossier-doc-label">${tiEscapeHtml(tiGetLang() === 'en' ? (d.titleEn || d.title) : d.title)}</span>
              <button type="button" class="ti-doc-view-link" onclick="tiViewWelcomeDoc('${b.id}','${d.id}')">${TI_ICONS.eye} ${t('view_document')}</button>
            </div>
            <div style="color:var(--ink-soft);font-size:.78rem;margin-top:4px;">${t('sent_on_label')} ${new Date(d.createdAt).toLocaleDateString(tiGetLang() === 'en' ? 'en-US' : 'fr-FR')}</div>
          </div>`).join('')}
        ${(b.contracts || []).map(c => `
          <div class="ti-dossier-doc">
            <div class="ti-dossier-doc-info">
              <span class="ti-doc-status-dot ${c.signed ? 'approved' : 'submitted'}"></span>
              <span class="ti-dossier-doc-label">${t('contract_document_title')}</span>
              <span class="ti-doc-filename">${tiEscapeHtml(c.fileName)}</span>
              ${c.fileData ? `<button type="button" class="ti-doc-view-link" onclick="tiOpenClientContract('${b.id}','${c.id}')">${TI_ICONS.eye} ${t('view_document')}</button>` : ''}
              ${c.signed ? `<span class="badge badge-paid">${t('contract_signed_label')}</span>` : `<button type="button" class="btn btn-sm btn-primary" onclick="tiSignContract('${b.id}','${c.id}')">${t('sign_contract_action')}</button>`}
            </div>
            <div style="color:var(--ink-soft);font-size:.78rem;margin-top:4px;">${t('sent_on_label')} ${new Date(c.sentAt).toLocaleDateString(tiGetLang() === 'en' ? 'en-US' : 'fr-FR')}${c.signed ? ` · ${t('signed_on_label')} ${new Date(c.signedAt).toLocaleDateString(tiGetLang() === 'en' ? 'en-US' : 'fr-FR')}` : ''}</div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}
async function tiSignContract(bookingId, contractId) {
  if (!confirm(t('confirm_sign_contract'))) return;
  await TiDB.signContract(bookingId, contractId);
  tiToast(t('contract_signed_toast'));
  await tiRefreshPanel("documents");
}
function tiOpenClientContract(bookingId, contractId) {
  const booking = TI_CLIENT_DOC_BOOKINGS.find(b => b.id === bookingId);
  const contract = booking?.contracts?.find(c => c.id === contractId);
  if (contract?.fileData) tiOpenDocument(contract.fileData, contract.fileName);
}
function tiViewWelcomeDoc(bookingId, docId) {
  const booking = TI_CLIENT_DOC_BOOKINGS.find(b => b.id === bookingId);
  const doc = booking?.documents?.find(d => d.id === docId);
  if (!doc) return;
  const isEn = tiGetLang() === "en";
  document.getElementById("view-text-doc-title").textContent = isEn ? (doc.titleEn || doc.title) : doc.title;
  document.getElementById("view-text-doc-body").innerHTML = tiRenderMiniMarkdown(isEn ? (doc.contentEn || doc.content) : doc.content, {});
  tiOpenModal("modal-view-text-doc");
}

async function tiRenderPayments() {
  const bookings = await TiDB.getBookings({ userId: TI_SESSION.id });
  const rentalBookings = bookings.filter(b => b.rental);
  const payments = await TiDB.getPayments({ userId: TI_SESSION.id });
  const mount = document.getElementById("payments-mount");

  if (!rentalBookings.length && !payments.length) {
    mount.innerHTML = tiEmptyStateHtml(t('empty_payments'), null, null, 'document');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const propsById = {};
  await Promise.all(rentalBookings.map(async b => { propsById[b.propertyId] = await TiDB.getProperty(b.propertyId); }));

  const rentalHtml = (await Promise.all(rentalBookings.map(async b => {
    const prop = propsById[b.propertyId];
    const activeCharges = b.rental.charges.filter(c => c.enabled);
    const monthlyRent = b.rental.schedule[0] ? b.rental.schedule[0].rent : 0;
    const monthlyCharges = activeCharges.reduce((sum, c) => sum + c.amount, 0);
    return `
    <div class="ti-booking-card">
      <div class="ti-booking-card-head">
        <div>
          <strong>${b.propertyTitle}</strong>
          ${prop && prop.reference ? `<span class="ti-card-ref" style="display:inline;margin-left:6px;">${t('reference_label')} ${prop.reference}</span>` : ''}
          <div class="ti-booking-meta">${t('rental_ledger_title')}</div>
        </div>
      </div>
      <div class="ti-dossier ti-rental-ledger">
        <div class="ti-rental-monthly-summary">
          <span>${t('monthly_payment_label')}</span>
          <strong data-price-xof="${monthlyRent + monthlyCharges}">${tiFormatPrice(monthlyRent + monthlyCharges)}</strong>
          <span class="ti-monthly-breakdown">(${t('rent_label')} <span data-price-xof="${monthlyRent}">${tiFormatPrice(monthlyRent)}</span>${monthlyCharges ? ` + ${t('charges_label')} <span data-price-xof="${monthlyCharges}">${tiFormatPrice(monthlyCharges)}</span>` : ''})</span>
        </div>
        <div class="ti-rental-deposit-row">
          <span>${t('deposit_label')}</span>
          <span class="ti-rental-deposit-amount" data-price-xof="${b.rental.deposit.amount}">${tiFormatPrice(b.rental.deposit.amount)}</span>
          ${b.rental.deposit.status === 'paid'
            ? `<span class="badge badge-paid">${t('status_paid')}</span>`
            : `<button class="btn btn-sm btn-primary" onclick="tiOpenSchedulePayModal('${b.id}','deposit',${b.rental.deposit.amount})">${t('pay_now')}</button>`}
        </div>
        <div class="ti-month-list">
          ${b.rental.schedule.map((item, idx) => {
            const total = item.rent + item.chargesAmount;
            const overdue = item.status === 'pending' && item.dueDate < today;
            const rowId = `${b.id}-${item.id}`;
            return `
            <div class="ti-month-card">
              <button type="button" class="ti-month-card-head" onclick="tiToggleMonthBreakdown('${rowId}')">
                <span class="ti-month-name">${tiFormatMonth(item.dueDate)}</span>
                <span class="ti-month-total" data-price-xof="${total}">${tiFormatPrice(total)}</span>
                ${item.status === 'paid'
                  ? `<span class="badge badge-paid">${t('status_paid')}</span>`
                  : overdue ? `<span class="badge badge-cancelled">${t('rental_status_overdue')}</span>` : `<span class="badge badge-pending">${t('status_pending')}</span>`}
                <span class="ti-month-chevron" id="chev-${rowId}">${TI_ICONS.chevronDown}</span>
              </button>
              <div class="ti-month-breakdown" id="breakdown-${rowId}" style="display:none;">
                <div class="ti-charge-status-box">
                  <span class="ti-charge-status-label">${t('rent_label')}</span>
                  <span class="ti-charge-status-amount" data-price-xof="${item.rent}">${tiFormatPrice(item.rent)}</span>
                  ${item.status === 'paid' ? `<span class="badge badge-paid">${t('status_paid')}</span>` : `<span class="badge badge-pending">${t('status_pending')}</span>`}
                </div>
                ${activeCharges.map(c => `
                <div class="ti-charge-status-box">
                  <span class="ti-charge-status-label">${tiChargeLabel(c)}</span>
                  <span class="ti-charge-status-amount" data-price-xof="${c.amount}">${tiFormatPrice(c.amount)}</span>
                  ${item.status === 'paid' ? `<span class="badge badge-paid">${t('status_paid')}</span>` : `<span class="badge badge-pending">${t('status_pending')}</span>`}
                </div>`).join('')}
                <div class="ti-month-breakdown-action">
                  ${item.status === 'paid'
                    ? `<span class="badge badge-paid">${t('status_paid')}</span>`
                    : `<button class="btn btn-sm ${overdue ? 'btn-danger' : 'btn-outline'}" onclick="tiOpenSchedulePayModal('${b.id}','${item.id}',${total})">${t('pay_now')}</button>`}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }))).join('');

  const otherPaymentsHtml = payments.length ? `
    <h4 style="margin:26px 0 14px;">${t('other_payments_title')}</h4>
    <table><thead><tr>
      <th>${t('field_title')}</th><th>${t('pay_method')}</th><th>${t('pay_amount')}</th><th></th>
    </tr></thead><tbody>
    ${payments.map(p => `<tr>
      <td>${p.propertyTitle}</td>
      <td style="text-transform:uppercase;">${p.method}</td>
      <td>${tiFormatPrice(p.amount)}</td>
      <td>${tiStatusBadge('paid')}</td>
    </tr>`).join('')}
    </tbody></table>` : '';

  mount.innerHTML = rentalHtml + otherPaymentsHtml;
}

function tiToggleMonthBreakdown(rowId) {
  const panel = document.getElementById(`breakdown-${rowId}`);
  const chevron = document.getElementById(`chev-${rowId}`);
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'grid' : 'none';
  chevron.classList.toggle('open', open);
}

function tiChargeLabel(c) { return tiGetLang() === "en" ? c.labelEn : c.label; }

let TI_SCHEDULE_PAY_CTX = null;
function tiOpenSchedulePayModal(bookingId, scheduleId, amount) {
  TI_SCHEDULE_PAY_CTX = { bookingId, scheduleId };
  document.getElementById("schedule-pay-amount").textContent = tiFormatPrice(amount);
  tiOpenModal("modal-pay-schedule");
}
async function tiSubmitSchedulePayment(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  tiSetBtnLoading(btn, true);
  const method = document.querySelector('input[name="spm"]:checked').value;
  await new Promise(r => setTimeout(r, 600));
  const { bookingId, scheduleId } = TI_SCHEDULE_PAY_CTX;
  if (scheduleId === "deposit") await TiDB.payRentalDeposit(bookingId, method);
  else await TiDB.payRentalScheduleItem(bookingId, scheduleId, method);
  tiSetBtnLoading(btn, false);
  tiCloseModal("modal-pay-schedule");
  tiToast(t("pay_success"));
  await tiRefreshPanel("payments");
  return false;
}

async function tiInitClientDashboard() {
  tiRenderHeader();
  tiRenderFooter();
  document.getElementById("bookings-mount").innerHTML = tiSkeletonBookingCardsHtml(3);
  document.getElementById("dash-name").textContent = TI_SESSION.name;
  document.getElementById("profile-name").value = TI_SESSION.name;
  document.getElementById("profile-email").value = TI_SESSION.email;
  await new Promise(r => setTimeout(r, 350));
  await Promise.all([tiRenderClientOverview(), tiRenderBookings(), tiRenderFavorites(), tiRenderAnnouncements(), tiRenderMessages(), tiRenderDocuments(), tiRenderPayments()]);
  const myBookings = await TiDB.getBookings({ userId: TI_SESSION.id });
  const hasActiveClient = myBookings.some(b => tiComputeBookingStage(b) === "active");
  const navPayments = document.getElementById("nav-client-payments");
  if (navPayments) navPayments.style.display = hasActiveClient ? "" : "none";
  tiApplyPanelFromUrl(["overview", "bookings", "favorites", "messages", "documents", "payments", "profile"]);
}
if (TI_SESSION) tiInitClientDashboard();
