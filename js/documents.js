/* ============================================================
   Timmo — « Mes documents »
   Rassemble tous les documents échangés entre une agence et son client :
   contrats et avenants (signature par code e-mail), reçus et quittances
   (générés automatiquement à chaque paiement enregistré), états des lieux,
   kit de bienvenue, pièces du dossier envoyées par le client, autres.

   - Côté client : page structurée (À traiter, recherche, filtres, un dossier
     par bien) + lecteur intégré + téléchargement PDF.
   - Côté agence : envoi de documents et suivi (lu / non lu, signé).
   Bibliothèques chargées à la demande : pdf.js (lecture des PDF) et
   pdf-lib (création des PDF : reçus, kit, images, certificat de signature).
   ============================================================ */

const TI_PDFLIB_URL = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
const TI_PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const TI_PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TI_DOC_MAX_UPLOAD = 5 * 1024 * 1024;

const TI_DOC_CATEGORIES = ["contract", "receipt", "inventory", "dossier", "info", "other"];
const TI_DOC_ICON = { contract: "PDF", receipt: "REÇU", inventory: "EDL", dossier: "MOI", info: "KIT", other: "DOC" };

const TI_SCRIPT_PROMISES = {};
function tiLoadScriptOnce(url) {
  if (!TI_SCRIPT_PROMISES[url]) {
    TI_SCRIPT_PROMISES[url] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url; s.async = true;
      s.onload = resolve;
      s.onerror = () => { delete TI_SCRIPT_PROMISES[url]; reject(new Error("script_load_failed")); };
      document.head.appendChild(s);
    });
  }
  return TI_SCRIPT_PROMISES[url];
}
async function tiPdfLib() { await tiLoadScriptOnce(TI_PDFLIB_URL); return window.PDFLib; }
async function tiPdfJs() {
  await tiLoadScriptOnce(TI_PDFJS_URL);
  if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = TI_PDFJS_WORKER_URL;
  return window.pdfjsLib;
}

/* ---------- Libellés ---------- */
function tiDocLocale() { return tiGetLang() === "en" ? "en-US" : "fr-FR"; }
function tiDocDate(iso) { return iso ? new Date(iso).toLocaleDateString(tiDocLocale(), { day: "numeric", month: "short", year: "numeric" }) : ""; }
function tiDocDateTime(iso) { return iso ? new Date(iso).toLocaleString(tiDocLocale(), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""; }
function tiDocAmount(n) { return (Number(n) || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " FCFA"; }
function tiPayMethodLabel(m) {
  const map = { wave: "Wave", orange_money: "Orange Money", om: "Orange Money", free_money: "Free Money", card: t("pay_method_card"), transfer: t("pay_method_transfer"), direct: t("pay_method_direct"), cash: t("pay_method_cash"), paydunya: "PayDunya" };
  return map[m] || m || "—";
}
function tiDocShortHash(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 8);
}

/* ============================================================
   Collecte : tous les documents d'une liste de réservations
   ============================================================ */
async function tiCollectDocuments(bookings) {
  const agencies = {};
  for (const b of bookings) if (b.agencyId && !agencies[b.agencyId]) agencies[b.agencyId] = await TiDB.getAgency(b.agencyId).catch(() => null);
  const docs = [];
  const now = Date.now();
  for (const b of bookings) {
    const agency = agencies[b.agencyId] || { id: b.agencyId, name: tiAgencyName(b.agencyId) };
    const reads = b.docReads || {};
    const base = { bookingId: b.id, booking: b, agency, propertyTitle: b.propertyTitle };
    const push = d => {
      d.readAt = reads[d.key] || null;
      d.isNew = d.from !== "client" && !d.readAt && d.date && (now - new Date(d.date).getTime()) < 60 * 86400000;
      docs.push({ ...base, ...d });
    };

    (b.contracts || []).forEach(c => push({
      key: `ctr:${c.id}`, category: "contract", title: c.title || t("contract_document_title"),
      sub: c.amendment ? t("doc_sub_amendment") : (c.fileName || ""), from: "agency", date: c.sentAt,
      status: c.signed ? "signed" : "to_sign", contract: c,
      source: { type: "file", dataUrl: c.fileData, fileName: c.fileName, mime: c.mime || tiGuessMime(c.fileName) },
    }));
    (b.sharedDocs || []).forEach(d => push({
      key: `sd:${d.id}`, category: TI_DOC_CATEGORIES.includes(d.category) ? d.category : "other", title: d.title,
      sub: d.note || d.fileName || "", from: "agency", date: d.sentAt, status: null,
      source: { type: "file", dataUrl: d.fileData, fileName: d.fileName, mime: d.mime || tiGuessMime(d.fileName) },
    }));
    // Reçus : uniquement les paiements enregistrés par l'agence ou la passerelle.
    if (b.rental) {
      const dep = b.rental.deposit;
      if (dep && dep.status === "paid") push({
        key: `rc:${b.id}:deposit`, category: "receipt", title: t("receipt_deposit_title"),
        sub: `${tiDocAmount(dep.amount)} · ${tiPayMethodLabel(dep.method)}`, from: "system", date: dep.paidAt, status: "paid",
        source: { type: "receipt", data: { kind: "deposit", number: `R-${new Date(dep.paidAt).getFullYear()}-${tiDocShortHash(b.id + "dep")}`, lines: [[t("receipt_line_deposit"), dep.amount]], total: dep.amount, method: dep.method, paidAt: dep.paidAt } },
      });
      (b.rental.schedule || []).filter(s => s.status === "paid").forEach(s => {
        const due = new Date(s.dueDate + "T12:00:00");
        const month = due.toLocaleDateString(tiDocLocale(), { month: "long", year: "numeric" });
        const end = new Date(due.getFullYear(), due.getMonth() + 1, 0);
        const total = (Number(s.rent) || 0) + (Number(s.chargesAmount) || 0);
        push({
          key: `rc:${b.id}:${s.id}`, category: "receipt", title: `${t("receipt_rent_title")} — ${month}`,
          sub: `${tiDocAmount(total)} · ${tiPayMethodLabel(s.method)}`, from: "system", date: s.paidAt, status: "paid", sortDate: s.dueDate,
          source: { type: "receipt", data: { kind: "rent", number: `Q-${due.getFullYear()}-${tiDocShortHash(b.id + s.id)}`,
            period: [new Date(due.getFullYear(), due.getMonth(), 1).toISOString(), end.toISOString()],
            lines: [[t("receipt_line_rent"), s.rent], ...(Number(s.chargesAmount) ? [[t("receipt_line_charges"), s.chargesAmount]] : [])], total, method: s.method, paidAt: s.paidAt } },
        });
      });
    } else if (b.status === "paid" || (b.payment && b.payment.status === "paid")) {
      const paidAt = (b.payment && b.payment.paidAt) || b.paidAt || b.createdAt;
      push({
        key: `rc:${b.id}:booking`, category: "receipt", title: t("receipt_booking_title"),
        sub: `${tiDocAmount(b.price)} · ${tiPayMethodLabel((b.payment && b.payment.method) || "card")}`, from: "system", date: paidAt, status: "paid",
        source: { type: "receipt", data: { kind: "booking", number: `R-${new Date(paidAt).getFullYear()}-${tiDocShortHash(b.id)}`, lines: [[t("receipt_line_booking"), b.price]], total: b.price, method: (b.payment && b.payment.method) || "card", paidAt, stay: [b.checkin, b.checkout] } },
      });
    }
    (b.documents || []).forEach(d => push({
      key: `kit:${d.id}`, category: "info", title: tiGetLang() === "en" ? (d.titleEn || d.title) : d.title,
      sub: t("doc_sub_welcome_kit"), from: "agency", date: d.createdAt, status: null,
      source: { type: "text", text: tiGetLang() === "en" ? (d.contentEn || d.content) : d.content },
    }));
    (b.documentRequests || []).filter(r => r.status !== "pending" || r.fileName).forEach(r => push({
      key: `req:${b.id}:${r.key}`, category: "dossier", title: tiGetLang() === "en" ? (r.labelEn || r.label) : r.label,
      sub: r.fileName || "", from: "client", date: r.submittedAt,
      status: r.status === "approved" ? "validated" : (r.status === "rejected" || r.status === "changes_requested" ? "to_fix" : "submitted"),
      source: { type: "file", dataUrl: r.fileData, fileName: r.fileName, mime: tiGuessMime(r.fileName) },
    }));
  }
  docs.sort((a, b) => new Date(b.sortDate || b.date || 0) - new Date(a.sortDate || a.date || 0));
  return docs;
}
function tiGuessMime(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  return { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[ext] || "";
}
function tiDocMime(doc) {
  const m = /^data:([^;,]+)/.exec(doc.source.dataUrl || "");
  return (m && m[1]) || doc.source.mime || "";
}

/** Actions attendues du client : contrats à signer, pièces demandées. */
function tiCollectTodos(bookings, docs) {
  const todos = docs.filter(d => d.status === "to_sign").map(d => ({ type: "sign", doc: d }));
  bookings.forEach(b => (b.documentRequests || []).forEach(r => {
    if (r.status === "pending" || r.status === "rejected" || r.status === "changes_requested") {
      todos.push({ type: "upload", booking: b, request: r });
    }
  }));
  return todos;
}

/* ============================================================
   Page client
   ============================================================ */
const TI_DOCS_STATE = { cat: "all", q: "", booking: "all", year: "all", selected: null, docs: [], bookings: [], todos: [] };

async function tiRenderClientDocuments() {
  const mount = document.getElementById("documents-mount");
  if (!mount) return;
  const portal = document.querySelector("body > #docs-viewer");      // lecteur déplacé (téléphone)
  if (portal) portal.remove();
  document.body.classList.remove("ti-docs-viewer-open");
  const bookings = (await TiDB.getBookings({ userId: TI_SESSION.id })).filter(b => b.status !== "cancelled" || (b.contracts && b.contracts.length));
  TI_DOCS_STATE.bookings = bookings;
  TI_DOCS_STATE.docs = await tiCollectDocuments(bookings);
  TI_DOCS_STATE.todos = tiCollectTodos(bookings, TI_DOCS_STATE.docs);
  const unread = TI_DOCS_STATE.docs.filter(d => d.isNew).length;
  if (typeof tiSetNavBadge === "function") tiSetNavBadge("documents", TI_DOCS_STATE.todos.length + unread);
  if (!TI_DOCS_STATE.docs.length && !TI_DOCS_STATE.todos.length) {
    mount.innerHTML = tiEmptyStateHtml(t("documents_empty"), null, null, "document");
    return;
  }
  mount.innerHTML = `
    <div class="ti-docs-layout">
      <div class="ti-docs-main">
        <div class="ti-docs-intro"><h3>${t("docs_page_title")}</h3><p>${t("docs_page_sub")}</p></div>
        <div id="docs-todo"></div>
        <div class="ti-docs-toolbar">
          <div class="ti-docs-search">${TI_ICONS.search}<input type="search" id="docs-q" placeholder="${tiEscapeHtml(t("docs_search_ph"))}" oninput="TI_DOCS_STATE.q=this.value;tiDocsRenderList()"></div>
          <select id="docs-booking" onchange="TI_DOCS_STATE.booking=this.value;tiDocsRenderList()"></select>
          <select id="docs-year" onchange="TI_DOCS_STATE.year=this.value;tiDocsRenderList()"></select>
        </div>
        <div class="ti-docs-chips" id="docs-chips" role="tablist"></div>
        <div id="docs-list"></div>
      </div>
      <aside class="ti-docs-viewer" id="docs-viewer" aria-live="polite"></aside>
    </div>`;
  const bSel = document.getElementById("docs-booking");
  bSel.innerHTML = `<option value="all">${t("docs_all_properties")}</option>` + bookings.map(b => `<option value="${b.id}">${tiEscapeHtml(b.propertyTitle || "")}</option>`).join("");
  const years = [...new Set(TI_DOCS_STATE.docs.map(d => d.date && new Date(d.date).getFullYear()).filter(Boolean))].sort((a, b) => b - a);
  document.getElementById("docs-year").innerHTML = `<option value="all">${t("docs_all_years")}</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
  bSel.value = TI_DOCS_STATE.booking; document.getElementById("docs-year").value = TI_DOCS_STATE.year;
  document.getElementById("docs-q").value = TI_DOCS_STATE.q;
  tiDocsRenderTodos();
  tiDocsRenderList();
  const fromUrl = new URLSearchParams(location.search).get("doc");
  const keep = TI_DOCS_STATE.selected && TI_DOCS_STATE.docs.find(d => d.key === TI_DOCS_STATE.selected);
  if (fromUrl && TI_DOCS_STATE.docs.find(d => d.key === fromUrl)) tiDocsOpen(fromUrl);
  else if (keep) tiDocsOpen(keep.key, { silent: true });
  else tiDocsRenderViewerEmpty();
}

function tiDocsRenderTodos() {
  const box = document.getElementById("docs-todo");
  const todos = TI_DOCS_STATE.todos;
  if (!todos.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="ti-docs-todo"><h4>${t("docs_todo_title")} (${todos.length})</h4>${todos.map(td => {
    if (td.type === "sign") {
      const d = td.doc;
      return `<div class="ti-docs-todo-row"><span class="ti-doc-ico cat-contract">${TI_DOC_ICON.contract}</span>
        <div class="ti-docs-grow"><b>${tiEscapeHtml(d.title)} — ${tiEscapeHtml(d.propertyTitle || "")}</b>
        <span>${t("docs_sent_by")} ${tiEscapeHtml(d.agency.name || "")} · ${tiDocDate(d.date)}</span></div>
        <button type="button" class="btn btn-primary btn-sm" onclick="tiDocsOpen('${d.key}')">${t("docs_read_and_sign")}</button></div>`;
    }
    const label = tiGetLang() === "en" ? (td.request.labelEn || td.request.label) : td.request.label;
    return `<div class="ti-docs-todo-row"><span class="ti-doc-ico cat-dossier">${TI_DOC_ICON.dossier}</span>
      <div class="ti-docs-grow"><b>${t("docs_requested")} : ${tiEscapeHtml(label)}</b>
      <span>${t("docs_requested_by")} ${tiEscapeHtml(tiAgencyName(td.booking.agencyId))}${td.request.note ? ` · ${tiEscapeHtml(td.request.note)}` : ""}</span></div>
      <label class="btn btn-outline btn-sm ti-upload-btn">${TI_ICONS.upload} ${t("upload_document")}
        <input type="file" accept="application/pdf,image/*" onchange="tiDocsUploadRequest(event,'${td.booking.id}','${td.request.key}')"></label></div>`;
  }).join("")}</div>`;
}

async function tiDocsUploadRequest(e, bookingId, key) {
  if (typeof tiUploadDocument === "function") { await tiUploadDocument(e, bookingId, key); await tiRenderClientDocuments(); }
}

function tiDocsFiltered() {
  const s = TI_DOCS_STATE;
  const q = s.q.trim().toLowerCase();
  return s.docs.filter(d =>
    (s.booking === "all" || d.bookingId === s.booking) &&
    (s.year === "all" || (d.date && String(new Date(d.date).getFullYear()) === s.year)) &&
    (!q || `${d.title} ${d.sub} ${d.propertyTitle} ${d.agency.name}`.toLowerCase().includes(q)));
}

function tiDocsRenderList() {
  const base = tiDocsFiltered();
  const counts = { all: base.length };
  TI_DOC_CATEGORIES.forEach(c => counts[c] = base.filter(d => d.category === c).length);
  document.getElementById("docs-chips").innerHTML = ["all", ...TI_DOC_CATEGORIES].filter(c => c === "all" || counts[c]).map(c =>
    `<button type="button" role="tab" class="ti-docs-chip ${TI_DOCS_STATE.cat === c ? "on" : ""}" aria-selected="${TI_DOCS_STATE.cat === c}" onclick="TI_DOCS_STATE.cat='${c}';tiDocsRenderList()">${t("doccat_" + c)} <i>${counts[c]}</i></button>`).join("");
  const list = base.filter(d => TI_DOCS_STATE.cat === "all" || d.category === TI_DOCS_STATE.cat);
  const mount = document.getElementById("docs-list");
  if (!list.length) { mount.innerHTML = `<p class="ti-docs-none">${t("docs_no_match")}</p>`; return; }
  const byBooking = {};
  list.forEach(d => (byBooking[d.bookingId] = byBooking[d.bookingId] || []).push(d));
  mount.innerHTML = TI_DOCS_STATE.bookings.filter(b => byBooking[b.id]).map(b => {
    const docs = byBooking[b.id];
    const agency = docs[0].agency;
    const stage = typeof tiComputeBookingStage === "function" ? tiComputeBookingStage(b) : null;
    const period = b.rental ? `${t("docs_rented_since")} ${tiDocDate(b.checkin)}` : (b.checkin ? `${tiDocDate(b.checkin)}${b.checkout ? " → " + tiDocDate(b.checkout) : ""}` : "");
    const stageTag = stage === "active" ? `<span class="ti-doc-tag tag-ok">${t(b.rental ? "docs_stage_active" : "docs_stage_confirmed")}</span>` : (stage ? `<span class="ti-doc-tag tag-wait">${t("docs_stage_in_progress")}</span>` : "");
    const groups = TI_DOC_CATEGORIES.map(c => [c, docs.filter(d => d.category === c)]).filter(([, arr]) => arr.length);
    return `<section class="ti-docs-folder">
      <header class="ti-docs-folder-head">
        <span class="ti-docs-folder-logo">${tiAgencyLogoHtml(agency)}</span>
        <div class="ti-docs-grow"><b>${tiEscapeHtml(b.propertyTitle || "")}</b><span>${tiEscapeHtml(agency.name || "")}${period ? " · " + period : ""}</span></div>
        ${stageTag}
      </header>
      ${groups.map(([c, arr]) => `<div class="ti-docs-cat">${t("doccat_" + c)}</div>${arr.map(tiDocsRowHtml).join("")}`).join("")}
    </section>`;
  }).join("");
}

function tiDocStatusTag(d) {
  const map = {
    to_sign: ["docst_to_sign", "tag-sign"], signed: ["docst_signed", "tag-ok"], paid: ["docst_paid", "tag-paid"],
    validated: ["docst_validated", "tag-ok"], submitted: ["docst_submitted", "tag-wait"], to_fix: ["docst_to_fix", "tag-sign"],
  };
  if (d.isNew && d.status !== "to_sign") return `<span class="ti-doc-tag tag-new">${t("docst_new")}</span>`;
  const m = map[d.status];
  return m ? `<span class="ti-doc-tag ${m[1]}">${t(m[0])}</span>` : "";
}
function tiDocFromLabel(d) {
  if (d.from === "client") return `${t("docs_you")} → ${tiEscapeHtml(d.agency.name || "")}`;
  if (d.from === "system") return d.sub ? tiEscapeHtml(d.sub) : "";
  return `${tiEscapeHtml(d.agency.name || "")} → ${t("docs_you_lower")}`;
}
function tiDocsRowHtml(d) {
  const sel = TI_DOCS_STATE.selected === d.key;
  const canView = d.source.type !== "file" || !!d.source.dataUrl;
  const sub = d.from === "system" ? tiDocFromLabel(d) : `${tiDocFromLabel(d)}${d.sub && d.from !== "client" && d.category !== "contract" ? " · " + tiEscapeHtml(d.sub) : ""}`;
  return `<div class="ti-docs-row ${sel ? "sel" : ""} ${d.isNew ? "is-new" : ""}" data-key="${d.key}" ${canView ? `onclick="tiDocsOpen('${d.key}')" tabindex="0" onkeydown="if(event.key==='Enter')tiDocsOpen('${d.key}')"` : ""}>
    <span class="ti-doc-ico cat-${d.category}">${TI_DOC_ICON[d.category]}</span>
    <div class="ti-docs-grow"><b>${tiEscapeHtml(d.title)}</b><span>${sub}</span></div>
    ${tiDocStatusTag(d)}
    <span class="ti-docs-date">${tiDocDate(d.date)}</span>
    <div class="ti-docs-actions">
      ${canView ? `<button type="button" class="ti-docs-ib" title="${t("view_document")}" aria-label="${t("view_document")}" onclick="event.stopPropagation();tiDocsOpen('${d.key}')">${TI_ICONS.eye}</button>
      <button type="button" class="ti-docs-ib" title="${t("docs_download_pdf")}" aria-label="${t("docs_download_pdf")}" onclick="event.stopPropagation();tiDocsDownload('${d.key}')">${TI_ICONS.download || "⬇"}</button>` : `<span class="ti-docs-unavailable">${t("docs_not_kept")}</span>`}
    </div>
  </div>`;
}

/* ---------- Lecteur ---------- */
function tiDocsFind(key) { return TI_DOCS_STATE.docs.find(d => d.key === key); }

function tiDocsRenderViewerEmpty() {
  const v = document.getElementById("docs-viewer");
  if (!v) return;
  v.classList.remove("open");
  v.innerHTML = `<div class="ti-docs-viewer-empty">${TI_ICONS.document}<p>${t("docs_viewer_empty")}</p></div>`;
}

async function tiDocsOpen(key, opts = {}) {
  const d = tiDocsFind(key);
  const v = document.getElementById("docs-viewer");
  if (!d || !v) return;
  TI_DOCS_STATE.selected = key;
  document.querySelectorAll(".ti-docs-row").forEach(r => r.classList.toggle("sel", r.dataset.key === key));
  // Sur téléphone, le lecteur s'ouvre en plein écran : on le place directement dans <body>.
  if (window.matchMedia("(max-width: 1180px)").matches && v.parentElement !== document.body) document.body.appendChild(v);
  v.classList.add("open");
  document.body.classList.add("ti-docs-viewer-open");
  // Accusé de lecture : le client ouvre un document reçu.
  if (TI_SESSION.role === "client" && d.from !== "client" && !d.readAt) {
    d.readAt = new Date().toISOString(); d.isNew = false;
    TiDB.markDocRead(d.bookingId, d.key).catch(() => {});
    const row = document.querySelector(`.ti-docs-row[data-key="${d.key}"]`);
    if (row) row.outerHTML = tiDocsRowHtml(d);
    const unread = TI_DOCS_STATE.docs.filter(x => x.isNew).length;
    if (typeof tiSetNavBadge === "function") tiSetNavBadge("documents", TI_DOCS_STATE.todos.length + unread);
  }
  const sig = d.contract && d.contract.signature;
  v.innerHTML = `
    <div class="ti-docs-viewer-head">
      <button type="button" class="ti-docs-back" onclick="tiDocsCloseViewer()" aria-label="${t("close")}">←</button>
      <span class="ti-doc-ico cat-${d.category}">${TI_DOC_ICON[d.category]}</span>
      <div class="ti-docs-grow"><b>${tiEscapeHtml(d.title)}</b><span>${tiEscapeHtml(d.agency.name || "")} · ${tiDocDate(d.date)}</span></div>
      <button type="button" class="ti-docs-ib ti-docs-close" onclick="tiDocsCloseViewer()" aria-label="${t("close")}">×</button>
    </div>
    ${d.status === "to_sign" && TI_SESSION.role === "client" ? `<div class="ti-docs-sign-banner">${t("docs_sign_banner")}<button type="button" class="btn btn-primary btn-sm" onclick="tiOpenSignModal('${d.key}')">${t("docs_sign_btn")}</button></div>` : ""}
    <div class="ti-docs-paper" id="docs-paper"><div class="ti-docs-loading">${t("docs_loading")}</div></div>
    <div class="ti-docs-viewer-actions">
      <button type="button" class="btn btn-primary" onclick="tiDocsDownload('${d.key}')">${TI_ICONS.download || "⬇"} ${t("docs_download_pdf")}</button>
      <button type="button" class="btn btn-outline" onclick="tiDocsPrint('${d.key}')">${t("docs_print")}</button>
      ${navigator.share ? `<button type="button" class="btn btn-outline" onclick="tiDocsShare('${d.key}')">${t("share_btn")}</button>` : ""}
    </div>
    <div class="ti-docs-history">
      ${d.from === "client" ? `${t("docs_hist_sent_by_you")} ${tiDocDateTime(d.date)}` : (d.from === "system" ? `${t("docs_hist_generated")} ${tiDocDateTime(d.date)}` : `${t("docs_hist_sent")} ${tiDocDateTime(d.date)} ${t("docs_by")} ${tiEscapeHtml(d.agency.name || "")}`)}
      ${d.from !== "client" ? ` · ${d.readAt ? `${t("docs_hist_read")} ${tiDocDateTime(d.readAt)}` : t("docs_hist_unread")}` : ""}
      ${sig ? `<br><span class="ti-docs-sig-line">✔ ${t("docs_hist_signed")} ${tiDocDateTime(sig.signedAt)} ${t("docs_by")} ${tiEscapeHtml(sig.signerName || "")} · ${t("docs_hist_code_to")} ${tiEscapeHtml(sig.email || "")} · ${t("docs_ref")} ${tiEscapeHtml(sig.ref || "")}</span>` : ""}
    </div>`;
  if (!opts.silent && window.matchMedia("(min-width: 1180px)").matches === false) v.scrollTop = 0;
  await tiDocsRenderPaper(d, document.getElementById("docs-paper"));
}
function tiDocsCloseViewer() {
  TI_DOCS_STATE.selected = null;
  document.body.classList.remove("ti-docs-viewer-open");
  document.querySelectorAll(".ti-docs-row.sel").forEach(r => r.classList.remove("sel"));
  const v = document.getElementById("docs-viewer");
  const home = document.querySelector(".ti-docs-layout");
  if (v && home && v.parentElement !== home) home.appendChild(v);
  tiDocsRenderViewerEmpty();
}

/** Affiche le document dans la page : HTML pour les reçus et le kit, pdf.js pour les PDF, image sinon. */
async function tiDocsRenderPaper(d, paper) {
  if (!paper) return;
  try {
    if (d.source.type === "receipt") { paper.innerHTML = `<div class="ti-docs-page">${tiReceiptHtml(d)}</div>`; return; }
    if (d.source.type === "text") {
      paper.innerHTML = `<div class="ti-docs-page">${tiDocLetterheadHtml(d)}<h4 class="ti-docs-page-title">${tiEscapeHtml(d.title)}</h4><div class="ti-docs-page-text">${tiRenderMiniMarkdown(d.source.text || "", {})}</div></div>`;
      return;
    }
    if (!d.source.dataUrl) { paper.innerHTML = `<p class="ti-docs-none">${t("docs_not_kept_long")}</p>`; return; }
    const mime = tiDocMime(d);
    if (mime.startsWith("image/")) { paper.innerHTML = `<img class="ti-docs-img" src="${d.source.dataUrl}" alt="${tiEscapeHtml(d.title)}">`; return; }
    if (mime === "application/pdf") {
      const pdfjs = await tiPdfJs();
      const bytes = tiDataUrlToBytes(d.source.dataUrl);
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      if (TI_DOCS_STATE.selected && TI_DOCS_STATE.selected !== d.key && paper.id === "docs-paper") return;
      paper.innerHTML = "";
      const width = Math.max(260, paper.clientWidth - 24);
      for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
        const page = await pdf.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = (width / vp1.width) * (window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height; canvas.className = "ti-docs-canvas";
        canvas.style.width = width + "px";
        paper.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      }
      if (pdf.numPages > 30) paper.insertAdjacentHTML("beforeend", `<p class="ti-docs-none">${t("docs_more_pages")}</p>`);
      if (d.contract && d.contract.signed) paper.insertAdjacentHTML("beforeend", tiSignatureCertificateHtml(d));
      return;
    }
    paper.innerHTML = `<p class="ti-docs-none">${t("docs_no_preview")}</p>`;
  } catch (err) {
    console.error("Lecture du document impossible :", err);
    paper.innerHTML = `<p class="ti-docs-none">${t("docs_preview_failed")}</p>`;
  }
}

function tiDataUrlToBytes(dataUrl) {
  const b64 = String(dataUrl).split(",")[1] || "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function tiDocLetterheadHtml(d, rightHtml = "") {
  return `<div class="ti-docs-letterhead"><span class="ti-docs-letterhead-id">${tiAgencyLogoHtml(d.agency)}<b>${tiEscapeHtml(d.agency.name || "")}</b></span>${rightHtml}</div>`;
}
function tiReceiptHtml(d) {
  const r = d.source.data;
  const b = d.booking;
  const clientName = b.name || (TI_SESSION && TI_SESSION.name) || "";
  const periodLine = r.kind === "rent" ? `<p>${t("receipt_period")} : ${tiDocDate(r.period[0])} → ${tiDocDate(r.period[1])}</p>` :
    (r.kind === "booking" && r.stay && r.stay[0] ? `<p>${t("receipt_stay")} : ${tiDocDate(r.stay[0])}${r.stay[1] ? " → " + tiDocDate(r.stay[1]) : ""}</p>` : "");
  const heading = r.kind === "rent" ? t("receipt_rent_title") : (r.kind === "deposit" ? t("receipt_deposit_title") : t("receipt_booking_title"));
  return `${tiDocLetterheadHtml(d, `<span class="ti-docs-receipt-no">N° ${tiEscapeHtml(r.number)}</span>`)}
    <h4 class="ti-docs-page-title">${heading}</h4>
    ${periodLine}
    <p>${t("receipt_tenant")} : <b>${tiEscapeHtml(clientName)}</b><br>${t("receipt_property")} : ${tiEscapeHtml(b.propertyTitle || "")}</p>
    <table class="ti-docs-receipt-table">
      ${r.lines.map(([label, amount]) => `<tr><td>${tiEscapeHtml(label)}</td><td>${tiDocAmount(amount)}</td></tr>`).join("")}
      <tr class="total"><td>${t("receipt_total_paid")}</td><td>${tiDocAmount(r.total)}</td></tr>
      <tr><td>${t("receipt_method")}</td><td>${tiEscapeHtml(tiPayMethodLabel(r.method))} · ${tiDocDate(r.paidAt)}</td></tr>
    </table>
    <p class="ti-docs-receipt-text">${r.kind === "rent" ? t("receipt_rent_statement") : t("receipt_generic_statement")}</p>
    <span class="ti-docs-stamp">${t("docst_paid").toUpperCase()}</span>
    <p class="ti-docs-receipt-foot">${t("receipt_footer")} · ${t("docs_ref")} ${tiEscapeHtml(r.number)}</p>`;
}
function tiSignatureCertificateHtml(d) {
  const s = d.contract.signature || {};
  return `<div class="ti-docs-cert"><b>✔ ${t("cert_title")}</b>
    <p>${t("cert_signed_by")} <b>${tiEscapeHtml(s.signerName || "")}</b> · ${tiDocDateTime(s.signedAt || d.contract.signedAt)}<br>
    ${t("cert_method")} · ${tiEscapeHtml(s.email || "")}<br>${t("docs_ref")} ${tiEscapeHtml(s.ref || "")}${s.docHash && s.docHash.length > 20 ? `<br><small>${t("cert_hash")} ${tiEscapeHtml(s.docHash.slice(0, 32))}…</small>` : ""}</p></div>`;
}

/* ---------- PDF ---------- */
const TI_PDF_SAFE = /[^\x20-\x7E -ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/g;
function tiPdfText(s) { return String(s == null ? "" : s).replace(/[   ]/g, " ").replace(/→/g, "-").replace(/✔/g, "").replace(TI_PDF_SAFE, ""); }
function tiPdfWrap(text, font, size, max) {
  const out = [];
  String(text).split("\n").forEach(par => {
    const words = tiPdfText(par).split(" ");
    let cur = "";
    words.forEach(w => { const test = cur ? cur + " " + w : w; if (font.widthOfTextAtSize(test, size) > max && cur) { out.push(cur); cur = w; } else cur = test; });
    out.push(cur);
  });
  return out;
}
/** Logo de l'agence en PNG (pour l'intégrer au PDF), ou null. */
async function tiAgencyLogoPng(agency) {
  const src = typeof tiAgencyLogoSrc === "function" ? tiAgencyLogoSrc(agency) : "";
  if (!src) return null;
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const c = document.createElement("canvas"); c.width = 160; c.height = 160;
    const ctx = c.getContext("2d");
    const k = Math.min(160 / (img.naturalWidth || 160), 160 / (img.naturalHeight || 160));
    const w = (img.naturalWidth || 160) * k, h = (img.naturalHeight || 160) * k;
    ctx.drawImage(img, (160 - w) / 2, (160 - h) / 2, w, h);
    return tiDataUrlToBytes(c.toDataURL("image/png"));
  } catch (e) { return null; }
}

async function tiPdfNewDoc(d, title) {
  const { PDFDocument, StandardFonts } = await tiPdfLib();
  const pdf = await PDFDocument.create();
  pdf.setTitle(tiPdfText(title)); pdf.setCreator("Timmo — Teranga Immobilière"); pdf.setAuthor(tiPdfText(d.agency.name || "Timmo"));
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await tiAgencyLogoPng(d.agency);
  const logo = logoBytes ? await pdf.embedPng(logoBytes) : null;
  return { pdf, font, bold, logo };
}
function tiPdfColors(PDFLib) {
  const { rgb } = PDFLib;
  return { navy: rgb(0.05, 0.106, 0.165), clay: rgb(0.749, 0.416, 0.239), grey: rgb(0.36, 0.4, 0.45), green: rgb(0.118, 0.478, 0.275), line: rgb(0.9, 0.88, 0.85), ink: rgb(0.2, 0.2, 0.2) };
}
function tiPdfHeader(page, ctx, C, d, rightText) {
  const { font, bold, logo } = ctx;
  let x = 50;
  if (logo) { page.drawImage(logo, { x: 50, y: 770, width: 36, height: 36 }); x = 94; }
  page.drawText(tiPdfText(d.agency.name || ""), { x, y: 790, size: 13, font: bold, color: C.navy });
  if (d.agency.address || d.agency.phone) page.drawText(tiPdfText([d.agency.address, d.agency.phone].filter(Boolean).join(" · ")), { x, y: 775, size: 8.5, font, color: C.grey });
  if (rightText) page.drawText(tiPdfText(rightText), { x: 545 - font.widthOfTextAtSize(tiPdfText(rightText), 9), y: 790, size: 9, font, color: C.grey });
  page.drawLine({ start: { x: 50, y: 758 }, end: { x: 545, y: 758 }, thickness: 1.5, color: C.navy });
}
function tiPdfFooter(page, ctx, C, text) {
  page.drawText(tiPdfText(text), { x: 50, y: 36, size: 7.5, font: ctx.font, color: C.grey });
}

async function tiBuildReceiptPdf(d) {
  const PDFLib = await tiPdfLib();
  const C = tiPdfColors(PDFLib);
  const ctx = await tiPdfNewDoc(d, d.title);
  const { pdf, font, bold } = ctx;
  const r = d.source.data, b = d.booking;
  const page = pdf.addPage([595, 842]);
  tiPdfHeader(page, ctx, C, d, `N° ${r.number}`);
  const heading = r.kind === "rent" ? t("receipt_rent_title") : (r.kind === "deposit" ? t("receipt_deposit_title") : t("receipt_booking_title"));
  let y = 718;
  page.drawText(tiPdfText(heading), { x: 50, y, size: 20, font: bold, color: C.navy }); y -= 30;
  const info = [];
  if (r.kind === "rent") info.push(`${t("receipt_period")} : ${tiDocDate(r.period[0])} - ${tiDocDate(r.period[1])}`);
  if (r.kind === "booking" && r.stay && r.stay[0]) info.push(`${t("receipt_stay")} : ${tiDocDate(r.stay[0])}${r.stay[1] ? " - " + tiDocDate(r.stay[1]) : ""}`);
  info.push(`${t("receipt_tenant")} : ${b.name || ""}`, `${t("receipt_property")} : ${b.propertyTitle || ""}`);
  info.forEach(l => { page.drawText(tiPdfText(l), { x: 50, y, size: 10.5, font, color: C.ink }); y -= 16; });
  y -= 14;
  const row = (label, value, isBold) => {
    page.drawText(tiPdfText(label), { x: 50, y, size: 11, font: isBold ? bold : font, color: C.ink });
    const v = tiPdfText(value);
    page.drawText(v, { x: 545 - (isBold ? bold : font).widthOfTextAtSize(v, 11), y, size: 11, font: isBold ? bold : font, color: C.navy });
    y -= 10; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.6, color: C.line }); y -= 18;
  };
  r.lines.forEach(([label, amount]) => row(label, tiDocAmount(amount)));
  row(t("receipt_total_paid"), tiDocAmount(r.total), true);
  row(t("receipt_method"), `${tiPayMethodLabel(r.method)} · ${tiDocDate(r.paidAt)}`);
  y -= 6;
  tiPdfWrap(r.kind === "rent" ? t("receipt_rent_statement") : t("receipt_generic_statement"), font, 10, 495).forEach(l => { page.drawText(l, { x: 50, y, size: 10, font, color: C.ink }); y -= 14; });
  y -= 24;
  page.drawRectangle({ x: 50, y: y - 8, width: 92, height: 30, borderColor: C.green, borderWidth: 2, rotate: PDFLib.degrees(4) });
  page.drawText(tiPdfText(t("docst_paid").toUpperCase()), { x: 70, y: y + 2, size: 14, font: bold, color: C.green, rotate: PDFLib.degrees(4) });
  tiPdfFooter(page, ctx, C, `${t("receipt_footer")} · ${t("docs_ref")} ${r.number} · ${t("docs_pdf_generated")} ${tiDocDateTime(new Date().toISOString())}`);
  return pdf.save();
}

async function tiBuildTextPdf(d) {
  const PDFLib = await tiPdfLib();
  const C = tiPdfColors(PDFLib);
  const ctx = await tiPdfNewDoc(d, d.title);
  const { pdf, font, bold } = ctx;
  let page = pdf.addPage([595, 842]);
  tiPdfHeader(page, ctx, C, d, tiDocDate(d.date));
  let y = 718;
  page.drawText(tiPdfText(d.title), { x: 50, y, size: 18, font: bold, color: C.navy }); y -= 22;
  page.drawText(tiPdfText(d.propertyTitle || ""), { x: 50, y, size: 10, font, color: C.grey }); y -= 26;
  const plain = String(d.source.text || "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/_(.+?)_/g, "$1").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)").replace(/^- /gm, "• ");
  tiPdfWrap(plain, font, 11, 495).forEach(l => {
    if (y < 60) { page = pdf.addPage([595, 842]); y = 790; }
    page.drawText(l, { x: 50, y, size: 11, font, color: C.ink }); y -= 16;
  });
  tiPdfFooter(page, ctx, C, `${t("docs_pdf_from_timmo")} · ${t("docs_pdf_generated")} ${tiDocDateTime(new Date().toISOString())}`);
  return pdf.save();
}

/** Ajoute une page « Certificat de signature » (contrat signé) à un PDF existant. */
async function tiAppendSignatureCertificate(pdf, d) {
  const PDFLib = await tiPdfLib();
  const C = tiPdfColors(PDFLib);
  const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica), bold = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const s = d.contract.signature || {};
  const page = pdf.addPage([595, 842]);
  let y = 780;
  page.drawText(tiPdfText(t("cert_title")), { x: 50, y, size: 20, font: bold, color: C.navy }); y -= 18;
  page.drawText(tiPdfText(t("cert_sub")), { x: 50, y, size: 10, font, color: C.grey }); y -= 30;
  const rows = [
    [t("cert_document"), `${d.title} — ${d.contract.fileName || ""}`],
    [t("receipt_property"), d.propertyTitle || ""],
    [t("cert_sender"), d.agency.name || ""],
    [t("cert_signer"), s.signerName || ""],
    [t("cert_date"), tiDocDateTime(s.signedAt || d.contract.signedAt)],
    [t("cert_method_label"), `${t("cert_method")} (${s.email || ""})`],
    [t("docs_ref"), s.ref || ""],
    [t("cert_hash"), s.docHash || ""],
  ];
  rows.forEach(([k, v]) => {
    page.drawText(tiPdfText(k), { x: 50, y, size: 10, font: bold, color: C.navy });
    tiPdfWrap(v, font, 10, 330).forEach((l, i) => page.drawText(l, { x: 215, y: y - i * 13, size: 10, font, color: C.ink }));
    y -= 13 * Math.max(1, tiPdfWrap(v, font, 10, 330).length) + 10;
  });
  y -= 10;
  tiPdfWrap(t("cert_statement"), font, 9.5, 495).forEach(l => { page.drawText(l, { x: 50, y, size: 9.5, font, color: C.grey }); y -= 13; });
  page.drawText(tiPdfText(`Timmo — Teranga Immobilière · ${t("docs_pdf_generated")} ${tiDocDateTime(new Date().toISOString())}`), { x: 50, y: 36, size: 7.5, font, color: C.grey });
}

async function tiImageToPdf(d) {
  const PDFLib = await tiPdfLib();
  const pdf = await PDFLib.PDFDocument.create();
  pdf.setTitle(tiPdfText(d.title)); pdf.setCreator("Timmo — Teranga Immobilière");
  // Toute image (WebP compris) passe par un canevas → JPEG.
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = d.source.dataUrl; });
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const cx = c.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0);
  const jpg = await pdf.embedJpg(tiDataUrlToBytes(c.toDataURL("image/jpeg", 0.9)));
  const page = pdf.addPage([595, 842]);
  const k = Math.min(515 / jpg.width, 762 / jpg.height);
  page.drawImage(jpg, { x: (595 - jpg.width * k) / 2, y: (842 - jpg.height * k) / 2, width: jpg.width * k, height: jpg.height * k });
  return pdf;
}

/** Octets PDF d'un document, quel que soit son type. */
async function tiDocPdfBytes(d) {
  if (d.source.type === "receipt") return tiBuildReceiptPdf(d);
  if (d.source.type === "text") return tiBuildTextPdf(d);
  if (!d.source.dataUrl) throw new Error("no_file");
  const mime = tiDocMime(d);
  const signed = d.contract && d.contract.signed;
  if (mime === "application/pdf") {
    const bytes = tiDataUrlToBytes(d.source.dataUrl);
    if (!signed) return bytes;
    const PDFLib = await tiPdfLib();
    const pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    await tiAppendSignatureCertificate(pdf, d);
    return pdf.save();
  }
  if (mime.startsWith("image/")) {
    const pdf = await tiImageToPdf(d);
    if (signed) await tiAppendSignatureCertificate(pdf, d);
    return pdf.save();
  }
  return tiDataUrlToBytes(d.source.dataUrl);
}
function tiDocPdfFileName(d) {
  const base = tiSlugify(`${d.title} ${d.propertyTitle ? "" : ""}`).slice(0, 60) || "document";
  return `${base}${d.contract && d.contract.signed ? "-signe" : ""}.pdf`;
}
async function tiDocsDownload(key) {
  const d = tiDocsFind(key) || (typeof TI_AGENCY_DOCS !== "undefined" && TI_AGENCY_DOCS.find(x => x.key === key));
  if (!d) return;
  try {
    tiToast(t("docs_preparing_pdf"));
    const bytes = await tiDocPdfBytes(d);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = tiDocPdfFileName(d);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (TI_SESSION.role === "client" && d.from !== "client" && !d.readAt) { d.readAt = new Date().toISOString(); TiDB.markDocRead(d.bookingId, d.key).catch(() => {}); }
  } catch (err) {
    console.error("PDF impossible :", err);
    tiToast(t("docs_pdf_failed"));
  }
}
async function tiDocsPrint(key) {
  const d = tiDocsFind(key) || (typeof TI_AGENCY_DOCS !== "undefined" && TI_AGENCY_DOCS.find(x => x.key === key));
  if (!d) return;
  const win = window.open("", "_blank");
  try {
    const bytes = await tiDocPdfBytes(d);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    if (win) win.location.href = url; else window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (err) {
    if (win) win.close();
    tiToast(t("docs_pdf_failed"));
  }
}
async function tiDocsShare(key) {
  const d = tiDocsFind(key);
  if (!d || !navigator.share) return;
  try {
    const bytes = await tiDocPdfBytes(d);
    const file = new File([bytes], tiDocPdfFileName(d), { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: d.title });
    else tiToast(t("docs_share_unsupported"));
  } catch (err) { /* partage annulé */ }
}

/* ============================================================
   Signature par code e-mail
   ============================================================ */
let TI_SIGN_CTX = null;
function tiOpenSignModal(key) {
  const d = tiDocsFind(key);
  if (!d || !d.contract) return;
  TI_SIGN_CTX = { key, bookingId: d.bookingId, contractId: d.contract.id, challenge: null };
  let modal = document.getElementById("modal-sign");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "ti-modal-backdrop"; modal.id = "modal-sign";
    modal.addEventListener("click", ev => { if (ev.target === modal) tiCloseModal("modal-sign"); });
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="ti-modal ti-sign-modal" role="dialog" aria-modal="true" aria-labelledby="sign-title">
    <button type="button" class="ti-modal-close" onclick="tiCloseModal('modal-sign')" aria-label="${t("close")}">&times;</button>
    <div class="ti-sign-step-icon">✍</div>
    <h3 id="sign-title">${t("sign_modal_title")}</h3>
    <p class="ti-sign-doc"><b>${tiEscapeHtml(d.title)}</b><br>${tiEscapeHtml(d.propertyTitle || "")} · ${tiEscapeHtml(d.agency.name || "")}</p>
    <div id="sign-step"></div>
  </div>`;
  tiSignStep1();
  tiOpenModal("modal-sign");
}
function tiSignStep1() {
  document.getElementById("sign-step").innerHTML = `
    <label class="ti-sign-consent"><input type="checkbox" id="sign-consent" onchange="document.getElementById('sign-send').disabled=!this.checked"> <span>${t("sign_consent")}</span></label>
    <p class="ti-sign-help">${t("sign_help")}</p>
    <div id="sign-msg"></div>
    <button type="button" class="btn btn-primary btn-block" id="sign-send" disabled onclick="tiSignSendCode()">${t("sign_send_code")}</button>`;
}
async function tiSignSendCode() {
  const btn = document.getElementById("sign-send");
  if (btn) tiSetBtnLoading(btn, true);
  const res = await TiDB.requestContractSignature(TI_SIGN_CTX.bookingId, TI_SIGN_CTX.contractId).catch(() => ({ error: "error" }));
  if (btn) tiSetBtnLoading(btn, false);
  if (res.error) {
    const key = { wait: "sign_err_wait", too_many: "sign_err_too_many", already_signed: "sign_err_already", send_failed: "sign_err_send" }[res.error] || "sign_err_generic";
    const msg = document.getElementById("sign-msg"); if (msg) msg.innerHTML = `<div class="ti-error">${t(key)}</div>`;
    return;
  }
  TI_SIGN_CTX.challenge = res.challenge;
  document.getElementById("sign-step").innerHTML = `
    <p class="ti-sign-help">${t("sign_code_sent").replace("{email}", `<b>${tiEscapeHtml(res.email || "")}</b>`)}</p>
    ${res.demo ? `<p class="ti-sign-demo">${t("sign_demo_hint")}</p>` : ""}
    <form onsubmit="return tiSignVerify(event)">
      <input type="text" id="sign-code" class="ti-sign-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" placeholder="••••••" required>
      <div id="sign-msg"></div>
      <button type="submit" class="btn btn-primary btn-block" id="sign-verify">${t("sign_confirm")}</button>
    </form>
    <button type="button" class="ti-sign-resend" onclick="tiSignSendCode()">${t("sign_resend")}</button>`;
  setTimeout(() => { const i = document.getElementById("sign-code"); if (i) i.focus(); }, 50);
}
async function tiSignVerify(e) {
  e.preventDefault();
  const code = document.getElementById("sign-code").value.trim();
  const btn = document.getElementById("sign-verify");
  tiSetBtnLoading(btn, true);
  const res = await TiDB.verifyContractSignature(TI_SIGN_CTX.bookingId, TI_SIGN_CTX.contractId, TI_SIGN_CTX.challenge, code).catch(() => ({ error: "error" }));
  tiSetBtnLoading(btn, false);
  if (res.error) {
    const key = { invalid_code: "sign_err_code", expired: "sign_err_expired", too_many: "sign_err_too_many" }[res.error] || "sign_err_generic";
    document.getElementById("sign-msg").innerHTML = `<div class="ti-error">${t(key)}${res.triesLeft != null ? ` (${t("sign_tries_left")} ${res.triesLeft})` : ""}</div>`;
    return false;
  }
  tiCloseModal("modal-sign");
  tiToast(t("sign_done"));
  const key = TI_SIGN_CTX.key;
  await tiRenderClientDocuments();
  tiDocsOpen(key);
  return false;
}

/* ============================================================
   Espace agence : envoyer un document et suivre sa lecture
   ============================================================ */
let TI_AGENCY_DOCS = [];
async function tiRenderAgencyDocuments() {
  const mount = document.getElementById("agency-docs-mount");
  if (!mount) return;
  let bookings = await TiDB.getBookings({ agencyId: TI_SESSION.agencyId });
  if (TI_SESSION.agentRole === "agent") {
    const mine = new Set((await TiDB.getProperties()).filter(p => p.assignedAgentId === TI_SESSION.id).map(p => p.id));
    bookings = bookings.filter(b => mine.has(b.propertyId));
  }
  const eligible = bookings.filter(b => b.status === "confirmed" || b.status === "paid");
  TI_AGENCY_DOCS = (await tiCollectDocuments(bookings)).filter(d => d.from !== "client");
  const sent = TI_AGENCY_DOCS;
  mount.innerHTML = `
    <div class="ti-agency-docs-grid">
      <form class="ti-agency-docs-form" onsubmit="return tiAgencySendDocument(event)">
        <h4>${t("adoc_send_title")}</h4>
        ${eligible.length ? `
        <div class="field"><label for="adoc-booking">${t("adoc_client")}</label>
          <select id="adoc-booking" required>${eligible.map(b => `<option value="${b.id}">${tiEscapeHtml(b.name || "")} — ${tiEscapeHtml(b.propertyTitle || "")}</option>`).join("")}</select></div>
        <div class="field"><label for="adoc-cat">${t("adoc_category")}</label>
          <select id="adoc-cat" onchange="tiAgencyDocCatChanged()">
            <option value="contract">${t("adoc_cat_contract")}</option>
            <option value="receipt">${t("doccat_receipt")}</option>
            <option value="inventory">${t("doccat_inventory")}</option>
            <option value="info">${t("doccat_info")}</option>
            <option value="other" selected>${t("doccat_other")}</option>
          </select></div>
        <div class="field"><label for="adoc-title">${t("adoc_title")}</label><input type="text" id="adoc-title" maxlength="100" required placeholder="${tiEscapeHtml(t("adoc_title_ph"))}"></div>
        <div class="field"><label for="adoc-file">${t("adoc_file")}</label><input type="file" id="adoc-file" accept="application/pdf,image/jpeg,image/png,image/webp" required>
          <small class="ti-adoc-hint">${t("adoc_file_hint")}</small></div>
        <div class="field"><label for="adoc-note">${t("adoc_note")}</label><textarea id="adoc-note" maxlength="300" rows="2" placeholder="${tiEscapeHtml(t("adoc_note_ph"))}"></textarea></div>
        <p class="ti-adoc-sign-note" id="adoc-sign-note" hidden>${t("adoc_sign_note")}</p>
        <div id="adoc-msg"></div>
        <button type="submit" class="btn btn-primary btn-block" id="adoc-submit">${t("adoc_send_btn")}</button>
        <p class="ti-adoc-hint">${t("adoc_email_note")}</p>` : `<p class="ti-docs-none">${t("adoc_no_clients")}</p>`}
      </form>
      <div class="ti-agency-docs-list">
        <h4>${t("adoc_sent_title")} <span class="ti-adoc-count">${sent.length}</span></h4>
        ${sent.length ? `<div class="ti-table-wrap"><table class="ti-table ti-adoc-table"><thead><tr>
          <th>${t("adoc_col_doc")}</th><th>${t("adoc_col_client")}</th><th>${t("adoc_col_date")}</th><th>${t("adoc_col_status")}</th><th></th></tr></thead><tbody>
          ${sent.map(d => `<tr>
            <td><span class="ti-doc-ico cat-${d.category} sm">${TI_DOC_ICON[d.category]}</span> <b>${tiEscapeHtml(d.title)}</b><br><small>${t("doccat_" + d.category)} · ${tiEscapeHtml(d.propertyTitle || "")}</small></td>
            <td>${tiEscapeHtml(d.booking.name || "")}</td>
            <td>${tiDocDate(d.date)}</td>
            <td>${d.status === "to_sign" ? `<span class="ti-doc-tag tag-sign">${t("docst_to_sign")}</span>` : (d.status === "signed" ? `<span class="ti-doc-tag tag-ok">${t("docst_signed")}</span>` : "")}
                ${d.readAt ? `<span class="ti-adoc-read">✓ ${t("docs_hist_read")} ${tiDocDate(d.readAt)}</span>` : `<span class="ti-adoc-unread">${t("docs_hist_unread")}</span>`}</td>
            <td>${d.source.type !== "file" || d.source.dataUrl ? `<button type="button" class="ti-docs-ib" title="${t("docs_download_pdf")}" onclick="tiDocsDownload('${d.key}')">${TI_ICONS.download || "⬇"}</button>` : ""}</td>
          </tr>`).join("")}</tbody></table></div>` : `<p class="ti-docs-none">${t("adoc_none_sent")}</p>`}
      </div>
    </div>`;
}
function tiAgencyDocCatChanged() {
  const isContract = document.getElementById("adoc-cat").value === "contract";
  document.getElementById("adoc-sign-note").hidden = !isContract;
}
async function tiAgencySendDocument(e) {
  e.preventDefault();
  const file = document.getElementById("adoc-file").files[0];
  const msg = document.getElementById("adoc-msg");
  msg.innerHTML = "";
  if (!file) return false;
  if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.type)) { msg.innerHTML = `<div class="ti-error">${t("adoc_err_type")}</div>`; return false; }
  if (file.size > TI_DOC_MAX_UPLOAD) { msg.innerHTML = `<div class="ti-error">${t("adoc_err_size")}</div>`; return false; }
  const btn = document.getElementById("adoc-submit");
  tiSetBtnLoading(btn, true);
  try {
    let fileData = file.type.startsWith("image/") && file.size > 1.5 * 1024 * 1024
      ? await tiCompressImageFile(file, 2000, 0.82) : await tiReadFileAsDataUrl(file);
    const bookingId = document.getElementById("adoc-booking").value;
    const category = document.getElementById("adoc-cat").value;
    const title = document.getElementById("adoc-title").value.trim();
    const note = document.getElementById("adoc-note").value.trim();
    const booking = await TiDB._bookingById(bookingId);
    if (category === "contract") {
      const amendment = typeof tiComputeBookingStage === "function" && tiComputeBookingStage(booking) === "active";
      await TiDB.sendContract(bookingId, file.name, fileData, { title, amendment, mime: file.type, sentBy: TI_SESSION.name });
    } else {
      await TiDB.shareDocument(bookingId, { category, title, fileName: file.name, mime: file.type, size: file.size, fileData, note, sentBy: TI_SESSION.name });
    }
    if (typeof tiLogAgencyAction === "function") tiLogAgencyAction("document_shared", "booking", bookingId, booking ? booking.propertyTitle : bookingId, title);
    tiToast(t("adoc_sent_toast"));
    await tiRenderAgencyDocuments();
  } catch (err) {
    console.error(err);
    tiSetBtnLoading(btn, false);
    msg.innerHTML = `<div class="ti-error">${t("adoc_err_generic")}</div>`;
  }
  return false;
}
