/* ============================================================
   Timmo — propriétaires particuliers et suivi des loyers
   - Mode « Propriétaire » de l'espace pro : un propriétaire qui loue
     lui-même utilise les mêmes outils qu'une agence (annonces, dossiers,
     contrats, documents, quittances), avec un menu simplifié.
   - « Loyers du mois » (agences ET propriétaires) : qui a payé, qui est
     en retard, encaissement en un clic et quittance automatique.
   - « Vérification » (propriétaires) : pièce d'identité + justificatif
     de propriété, vérifiés par l'équipe Timmo → badge « Propriétaire vérifié ».
   ============================================================ */

let TI_ACCOUNT = null;               // fiche agence/propriétaire du compte connecté
const tiIsOwnerAccount = () => !!(TI_ACCOUNT && TI_ACCOUNT.kind === "owner");

/** Bascule l'interface en mode propriétaire (libellés et menu simplifié). */
async function tiApplyAccountMode() {
  TI_ACCOUNT = await TiDB.getAgency(TI_SESSION.agencyId).catch(() => null);
  const verifNav = document.getElementById("nav-verification");
  if (!tiIsOwnerAccount()) { if (verifNav) verifNav.style.display = "none"; return; }
  document.body.classList.add("ti-owner-mode");
  const relabel = (sel, key) => { const el = document.querySelector(sel); if (el) el.setAttribute("data-i18n", key); };
  relabel(".ti-dash-head h2", "dash_owner_title");
  relabel('.ti-dash-nav a[data-panel="listings"]', "owner_nav_listings");
  relabel('.ti-dash-nav a[data-panel="clients"]', "owner_nav_tenants");
  relabel('.ti-dash-nav a[data-panel="documents"]', "owner_nav_documents");
  relabel('.ti-dash-nav [data-i18n="nav_sec_agency"]', "owner_nav_sec_account");
  ["nav-agents", "nav-audit", "nav-subscription", "nav-branding"].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });
  if (verifNav) verifNav.style.display = "";
  const assign = document.getElementById("nl-assign-wrap");
  if (assign) assign.style.display = "none";
  tiApplyLang();
  if (typeof tiApplySidebarIcons === "function") tiApplySidebarIcons();
  tiUpdateRoleLabel();
}

/* ============================================================
   Loyers du mois
   ============================================================ */
let TI_RENTS_MONTH = null;           // "AAAA-MM"
function tiMonthKey(d) { return d.toISOString().slice(0, 7); }
function tiShiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  return tiMonthKey(new Date(Date.UTC(y, m - 1 + delta, 15)));
}

async function tiRenderRentRoll() {
  const mount = document.getElementById("rents-mount");
  if (!mount) return;
  if (!TI_RENTS_MONTH) TI_RENTS_MONTH = tiMonthKey(new Date());
  let bookings = (await TiDB.getBookings({ agencyId: TI_SESSION.agencyId })).filter(b => b.rental && b.status !== "cancelled");
  if (TI_SESSION.agentRole === "agent") {
    const mine = new Set((await TiDB.getProperties()).filter(p => p.assignedAgentId === TI_SESSION.id).map(p => p.id));
    bookings = bookings.filter(b => mine.has(b.propertyId));
  }
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  bookings.forEach(b => (b.rental.schedule || []).forEach(item => {
    if (item.dueDate.slice(0, 7) !== TI_RENTS_MONTH) return;
    const total = (Number(item.rent) || 0) + (Number(item.chargesAmount) || 0);
    const late = item.status !== "paid" && item.dueDate < today;
    const days = late ? Math.round((new Date(today) - new Date(item.dueDate)) / 86400000) : 0;
    rows.push({ b, item, total, late, days, state: item.status === "paid" ? "paid" : (late ? "late" : "pending") });
  }));
  const order = { late: 0, pending: 1, paid: 2 };
  rows.sort((a, c) => order[a.state] - order[c.state] || a.item.dueDate.localeCompare(c.item.dueDate));
  const expected = rows.reduce((s, r) => s + r.total, 0);
  const received = rows.filter(r => r.state === "paid").reduce((s, r) => s + r.total, 0);
  const lateRows = rows.filter(r => r.state === "late");
  const pct = expected ? Math.round(received / expected * 100) : 0;
  const monthLabel = new Date(TI_RENTS_MONTH + "-15T12:00:00").toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", { month: "long", year: "numeric" });
  const isCurrent = TI_RENTS_MONTH === tiMonthKey(new Date());

  mount.innerHTML = `
    <div class="ti-rents-top">
      <div class="ti-rents-month">
        <button type="button" class="ti-docs-ib" onclick="TI_RENTS_MONTH=tiShiftMonth(TI_RENTS_MONTH,-1);tiRenderRentRoll()" aria-label="${t("rents_prev")}">‹</button>
        <b>${monthLabel}</b>
        <button type="button" class="ti-docs-ib" onclick="TI_RENTS_MONTH=tiShiftMonth(TI_RENTS_MONTH,1);tiRenderRentRoll()" aria-label="${t("rents_next")}">›</button>
        ${isCurrent ? "" : `<button type="button" class="btn btn-outline btn-sm" onclick="TI_RENTS_MONTH=null;tiRenderRentRoll()">${t("rents_today")}</button>`}
      </div>
    </div>
    ${rows.length ? `
    <div class="ti-rents-kpis">
      <div class="ti-rents-kpi main"><span>${t("rents_received")}</span><b data-price-xof="${received}">${tiFormatPrice(received)}</b><small>${t("rents_out_of")} <span data-price-xof="${expected}">${tiFormatPrice(expected)}</span></small>
        <div class="ti-rents-bar"><i style="width:${pct}%"></i></div></div>
      <div class="ti-rents-kpi"><span>${t("rents_paid_count")}</span><b>${rows.filter(r => r.state === "paid").length} / ${rows.length}</b><small>${t("rents_tenants")}</small></div>
      <div class="ti-rents-kpi ${lateRows.length ? "bad" : ""}"><span>${t("rents_late")}</span><b>${lateRows.length}</b><small>${lateRows.length ? `<span data-price-xof="${lateRows.reduce((s, r) => s + r.total, 0)}">${tiFormatPrice(lateRows.reduce((s, r) => s + r.total, 0))}</span>` : t("rents_none_late")}</small></div>
    </div>
    <div class="ti-table-wrap"><table class="ti-table ti-rents-table"><thead><tr>
      <th>${t("rents_col_tenant")}</th><th>${t("rents_col_property")}</th><th>${t("rents_col_amount")}</th><th>${t("rents_col_due")}</th><th>${t("rents_col_status")}</th><th></th>
    </tr></thead><tbody>
      ${rows.map(r => `<tr class="st-${r.state}">
        <td data-label="${t("rents_col_tenant")}"><b>${tiEscapeHtml(r.b.name || "")}</b>${r.b.phone ? `<br><small>${tiEscapeHtml(r.b.phone)}</small>` : ""}</td>
        <td data-label="${t("rents_col_property")}">${tiEscapeHtml(r.b.propertyTitle || "")}</td>
        <td data-label="${t("rents_col_amount")}"><b data-price-xof="${r.total}">${tiFormatPrice(r.total)}</b></td>
        <td data-label="${t("rents_col_due")}">${new Date(r.item.dueDate + "T12:00:00").toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", { day: "numeric", month: "short" })}</td>
        <td data-label="${t("rents_col_status")}">${r.state === "paid" ? `<span class="ti-doc-tag tag-ok">${t("rents_paid_on")} ${new Date(r.item.paidAt).toLocaleDateString(tiGetLang() === "en" ? "en-US" : "fr-FR", { day: "numeric", month: "short" })}</span>`
          : r.state === "late" ? `<span class="ti-doc-tag tag-late">${t("rents_late_days").replace("{n}", r.days)}</span>` : `<span class="ti-doc-tag tag-wait">${t("rents_waiting")}</span>`}</td>
        <td class="ti-rents-actions">${r.state === "paid" ? `<span class="ti-rents-receipt">✓ ${t("rents_receipt_sent")}</span>`
          : `<button type="button" class="btn btn-primary btn-sm" onclick="tiRentMarkReceived('${r.b.id}','${r.item.id}')">${t("rents_mark_received")}</button>
             ${r.state === "late" && r.b.phone ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${tiRentReminderLink(r)}">${t("rents_remind")}</a>` : ""}`}</td>
      </tr>`).join("")}
    </tbody></table></div>
    <p class="ti-rents-note">${t("rents_note")}</p>` : `<div class="ti-rents-empty">${t("rents_empty")}</div>`}`;
}

/** Message de rappel prêt à envoyer sur WhatsApp (le propriétaire l'envoie depuis son téléphone). */
function tiRentReminderLink(r) {
  const phone = String(r.b.phone || "").replace(/[^\d]/g, "");
  const month = new Date(r.item.dueDate + "T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const amount = (Number(r.total) || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ");
  const text = `Bonjour ${String(r.b.name || "").split(" ")[0]}, petit rappel : le loyer de ${month} (${amount} FCFA) pour ${r.b.propertyTitle || "votre logement"} était attendu le ${new Date(r.item.dueDate + "T12:00:00").toLocaleDateString("fr-FR")}. Merci de me prévenir dès que le paiement est fait. Bonne journée !`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

async function tiRentMarkReceived(bookingId, scheduleId) {
  if (!confirm(t("rents_confirm_received"))) return;
  try {
    await TiDB.payRentalScheduleItem(bookingId, scheduleId, "direct");
    if (typeof tiLogAgencyAction === "function") tiLogAgencyAction("rental_payment_recorded", "booking", bookingId, bookingId, scheduleId);
    tiToast(t("rents_received_toast"));
  } catch (e) {
    tiToast(t("rental_mark_received_failed"));
  }
  await tiRenderRentRoll();
}

/* ============================================================
   Vérification du propriétaire
   ============================================================ */
const TI_PROOF_TYPES = ["titre_foncier", "deliberation", "acte_vente", "facture", "autre"];

async function tiRenderOwnerVerification() {
  const mount = document.getElementById("verification-mount");
  if (!mount || !tiIsOwnerAccount()) return;
  const v = await TiDB.getOwnerVerification(TI_SESSION.agencyId).catch(() => null);
  const status = (v && v.status) || "none";
  const statusBox = {
    none: `<div class="ti-verif-status st-none"><b>${t("verif_none_title")}</b><span>${t("verif_none_sub")}</span></div>`,
    pending: `<div class="ti-verif-status st-pending"><b>⏳ ${t("verif_pending_title")}</b><span>${t("verif_pending_sub")}</span></div>`,
    approved: `<div class="ti-verif-status st-approved"><b>✓ ${t("verif_approved_title")}</b><span>${t("verif_approved_sub")}</span></div>`,
    rejected: `<div class="ti-verif-status st-rejected"><b>${t("verif_rejected_title")}</b><span>${v && v.note ? tiEscapeHtml(v.note) : t("verif_rejected_sub")}</span></div>`,
  }[status];
  const canSubmit = status !== "pending" && status !== "approved";
  mount.innerHTML = `
    <div class="ti-verif-grid">
      <div>
        ${statusBox}
        ${canSubmit ? `
        <form class="ti-verif-form" onsubmit="return tiSubmitOwnerVerification(event)">
          <div class="field"><label for="verif-id">${t("verif_id_label")}</label>
            <input type="file" id="verif-id" accept="application/pdf,image/jpeg,image/png,image/webp" required>
            <small class="ti-adoc-hint">${t("verif_id_hint")}</small></div>
          <div class="field"><label for="verif-proof-type">${t("verif_proof_type")}</label>
            <select id="verif-proof-type">${TI_PROOF_TYPES.map(k => `<option value="${k}">${t("proof_" + k)}</option>`).join("")}</select></div>
          <div class="field"><label for="verif-proof">${t("verif_proof_label")}</label>
            <input type="file" id="verif-proof" accept="application/pdf,image/jpeg,image/png,image/webp" required>
            <small class="ti-adoc-hint">${t("verif_proof_hint")}</small></div>
          <div class="field"><label for="verif-phone">${t("verif_phone")}</label>
            <input type="tel" id="verif-phone" inputmode="tel" placeholder="77 123 45 67" value="${tiEscapeHtml((TI_ACCOUNT && TI_ACCOUNT.phone) || "")}"></div>
          <div id="verif-msg"></div>
          <button type="submit" class="btn btn-primary btn-block" id="verif-submit">${t("verif_submit")}</button>
          <p class="ti-adoc-hint">${t("verif_privacy")}</p>
        </form>` : ""}
      </div>
      <div class="ti-verif-why">
        <h4>${t("verif_why_title")}</h4>
        <ul class="ti-verif-list">
          <li>${t("verif_why_1")}</li>
          <li>${t("verif_why_2")}</li>
          <li>${t("verif_why_3")}</li>
        </ul>
        <div class="ti-verif-badge-demo"><span class="ti-seller-tag owner verified">✓ ${t("seller_owner_verified")}</span><small>${t("verif_badge_preview")}</small></div>
      </div>
    </div>`;
}

async function tiSubmitOwnerVerification(e) {
  e.preventDefault();
  const msg = document.getElementById("verif-msg");
  const idFile = document.getElementById("verif-id").files[0];
  const proofFile = document.getElementById("verif-proof").files[0];
  const ok = f => f && /^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type) && f.size <= 4 * 1024 * 1024;
  if (!ok(idFile) || !ok(proofFile)) { msg.innerHTML = `<div class="ti-error">${t("verif_err_file")}</div>`; return false; }
  const btn = document.getElementById("verif-submit");
  tiSetBtnLoading(btn, true);
  try {
    const read = async f => (f.type.startsWith("image/") && f.size > 1.5 * 1024 * 1024) ? tiCompressImageFile(f, 2000, 0.82) : tiReadFileAsDataUrl(f);
    const [idData, proofData] = await Promise.all([read(idFile), read(proofFile)]);
    await TiDB.submitOwnerVerification(TI_SESSION.agencyId, {
      idDoc: { fileName: idFile.name, fileData: idData },
      proofDoc: { fileName: proofFile.name, fileData: proofData },
      proofType: document.getElementById("verif-proof-type").value,
      phone: document.getElementById("verif-phone").value.trim(),
    });
    tiToast(t("verif_sent_toast"));
    await tiRenderOwnerVerification();
  } catch (err) {
    console.error(err);
    tiSetBtnLoading(btn, false);
    msg.innerHTML = `<div class="ti-error">${t("verif_err_generic")}</div>`;
  }
  return false;
}

/* ============================================================
   Annonce : rappel de la règle « caution + avance ≤ 2 mois »
   ============================================================ */
function tiCheckDepositRule() {
  const box = document.getElementById("nl-deposit-rule");
  if (!box) return;
  const kind = (document.getElementById("nl-listing-kind") || {}).value;
  const price = parseFloat((document.getElementById("nl-price") || {}).value) || 0;
  const deposit = parseFloat((document.getElementById("nl-deposit") || {}).value) || 0;
  if (kind !== "rent" || !price || !deposit) { box.className = "ti-deposit-rule"; box.innerHTML = kind === "rent" ? t("deposit_rule_info") : ""; return; }
  const months = deposit / price;
  if (months > 1) {
    box.className = "ti-deposit-rule warn";
    box.innerHTML = t("deposit_rule_warn").replace("{n}", (Math.round(months * 10) / 10).toString().replace(".", ","));
  } else {
    box.className = "ti-deposit-rule ok";
    box.innerHTML = t("deposit_rule_ok");
  }
}
