/* ============================================================
   Timmo — currency engine
   Default: CFA (XOF). Secondary: EUR.
   XOF is pegged to EUR at a fixed rate set by the BCEAO treaty.
   ============================================================ */

const TI_CUR_KEY = "ti_currency";
const XOF_PER_EUR = 655.957;

function tiGetCurrency() {
  return localStorage.getItem(TI_CUR_KEY) || "XOF";
}

function tiSetCurrency(cur) {
  localStorage.setItem(TI_CUR_KEY, cur);
  tiApplyCurrency();
}

/** amountXOF: base amount always stored in CFA (XOF) */
function tiFormatPrice(amountXOF) {
  const cur = tiGetCurrency();
  const lang = tiGetLang ? tiGetLang() : "fr";
  if (cur === "EUR") {
    const eur = amountXOF / XOF_PER_EUR;
    return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-IE", {
      style: "currency", currency: "EUR", maximumFractionDigits: 0
    }).format(eur);
  }
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amountXOF) + " FCFA";
}

function tiApplyCurrency() {
  const cur = tiGetCurrency();
  document.querySelectorAll("[data-price-xof]").forEach(el => {
    const base = parseFloat(el.getAttribute("data-price-xof"));
    if (!isNaN(base)) el.textContent = tiFormatPrice(base);
  });
  document.querySelectorAll(".ti-cur-toggle [data-cur]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-cur") === cur);
  });
  document.dispatchEvent(new CustomEvent("ti:currencychange"));
}

document.addEventListener("DOMContentLoaded", tiApplyCurrency);
document.addEventListener("ti:langchange", tiApplyCurrency);
