/* ============================================================
   Timmo — alertes « nouveaux biens » (côté visiteur)
   Le visiteur enregistre sa recherche ; il confirme par e-mail (double opt-in),
   puis reçoit chaque nouveau bien correspondant par e-mail (et WhatsApp quand
   le compte WhatsApp Business de Timmo sera branché). Voir server/routes/alerts.js.
   ============================================================ */

function tiAlertCriteriaLabel(c) {
  const parts = [];
  parts.push(c.type ? tiTypeLabel(c.type) : t("alert_any_type"));
  parts.push({ rent: t("alert_kind_rent"), sale: t("alert_kind_sale"), short: t("alert_kind_short") }[c.kind] || t("alert_kind_any"));
  if (c.hood) parts.push(tiNeighborhoodName(c.hood));
  if (c.minBeds) parts.push(`${c.minBeds}+ ${t("bedrooms")}`);
  if (c.maxPrice) parts.push(`≤ ${tiFormatPrice(c.maxPrice)}`);
  return parts.join(" · ");
}

function tiOpenAlertModal(criteria) {
  const c = criteria || {};
  const s = typeof tiGetSession === "function" ? tiGetSession() : null;
  let modal = document.getElementById("modal-alert");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "ti-modal-backdrop"; modal.id = "modal-alert";
    modal.addEventListener("click", ev => { if (ev.target === modal) tiCloseModal("modal-alert"); });
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="ti-modal ti-alert-modal" role="dialog" aria-modal="true" aria-labelledby="alert-title">
      <button type="button" class="ti-modal-close" onclick="tiCloseModal('modal-alert')" aria-label="Fermer">&times;</button>
      <div class="ti-alert-bell" aria-hidden="true">🔔</div>
      <h3 id="alert-title">${t("alert_title")}</h3>
      <p class="ti-alert-sub">${t("alert_sub")}</p>
      <div class="ti-alert-criteria">${tiEscapeHtml(tiAlertCriteriaLabel(c))}</div>
      <form id="form-alert" onsubmit="return tiSubmitAlert(event)">
        <div class="field"><label for="alert-email">${t("email")}</label>
          <input type="email" id="alert-email" required value="${tiEscapeHtml((s && s.email) || "")}" placeholder="vous@exemple.com"></div>
        <div class="field"><label for="alert-phone">${t("alert_whatsapp_label")}</label>
          <input type="tel" id="alert-phone" inputmode="tel" placeholder="77 123 45 67">
          <small class="ti-alert-hint">${t("alert_whatsapp_hint")}</small></div>
        <label class="ti-alert-consent"><input type="checkbox" id="alert-consent" required> <span>${t("alert_consent")}</span></label>
        <div id="alert-msg"></div>
        <button type="submit" class="btn btn-primary btn-block">${t("alert_submit")}</button>
      </form>
    </div>`;
  modal.dataset.criteria = JSON.stringify(c);
  tiOpenModal("modal-alert");
}

async function tiSubmitAlert(e) {
  e.preventDefault();
  const modal = document.getElementById("modal-alert");
  const criteria = JSON.parse(modal.dataset.criteria || "{}");
  const btn = e.target.querySelector("button[type=submit]");
  const msg = document.getElementById("alert-msg");
  if (criteria.hood && typeof tiNeighborhoodName === "function") criteria.hoodLabel = tiNeighborhoodName(criteria.hood);
  const payload = {
    email: document.getElementById("alert-email").value.trim(),
    phone: document.getElementById("alert-phone").value.trim(),
    consent: document.getElementById("alert-consent").checked,
    criteria, lang: typeof tiGetLang === "function" ? tiGetLang() : "fr",
  };
  tiSetBtnLoading(btn, true);
  // Site de démonstration : aucun e-mail n'est envoyé.
  if (TI_BACKEND !== "api") {
    await new Promise(r => setTimeout(r, 400));
    try { const all = JSON.parse(localStorage.getItem("ti_alerts") || "[]"); all.push({ ...payload, createdAt: new Date().toISOString() }); localStorage.setItem("ti_alerts", JSON.stringify(all)); } catch (err) { /* stockage indisponible */ }
    tiAlertDone(t("alert_done_demo"));
    return false;
  }
  try {
    const res = await fetch(`${TI_API_BASE}/alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { tiAlertDone(t("alert_done").replace("{email}", tiEscapeHtml(payload.email))); return false; }
    tiSetBtnLoading(btn, false);
    const key = { invalid_email: "alert_err_email", invalid_phone: "alert_err_phone", limit_reached: "alert_err_limit", too_many: "alert_err_too_many", consent_required: "alert_err_consent" }[data.error] || "alert_err_generic";
    msg.innerHTML = `<div class="ti-error">${t(key)}</div>`;
  } catch (err) {
    tiSetBtnLoading(btn, false);
    msg.innerHTML = `<div class="ti-error">${t("alert_err_generic")}</div>`;
  }
  return false;
}

function tiAlertDone(html) {
  const form = document.getElementById("form-alert");
  form.outerHTML = `<div class="ti-alert-done"><div class="ti-alert-done-icon">✓</div><p>${html}</p>
    <button type="button" class="btn btn-outline btn-block" onclick="tiCloseModal('modal-alert')">${t("alert_close")}</button></div>`;
}
