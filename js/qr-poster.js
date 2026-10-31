/* ============================================================
   Timmo — affiche « À LOUER / À VENDRE » avec QR code
   Pour les panneaux posés sur les immeubles : le passant scanne le QR code
   et arrive sur l'annonce (photos, carte, visite, contact). Le lien porte
   ?via=qr pour mesurer les visites venues des panneaux.
   L'affiche s'ouvre dans un nouvel onglet, prête à imprimer en A4
   (ou à enregistrer en PDF depuis la fenêtre d'impression).
   ============================================================ */

const TI_QR_LIB = "https://unpkg.com/qrcode-generator@1.4.4/qrcode.js";

function tiLoadQrLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TI_QR_LIB; s.async = true;
    s.onload = () => resolve(window.qrcode);
    s.onerror = () => reject(new Error("qr_lib"));
    document.head.appendChild(s);
  });
}

async function tiOpenQrPoster(p) {
  if (!p) return;
  // Ouvrir l'onglet tout de suite (sinon le navigateur bloque la fenêtre surgissante).
  const win = window.open("", "_blank");
  if (!win) { tiToast(t("qr_popup_blocked")); return; }
  win.document.write(`<p style="font-family:sans-serif;padding:30px">${t("qr_preparing")}</p>`);
  let qrSvg;
  try {
    const qrcode = await tiLoadQrLib();
    const qr = qrcode(0, "M");
    qr.addData(tiShareUrl(p, "qr"));
    qr.make();
    qrSvg = qr.createSvgTag({ cellSize: 10, margin: 0, scalable: true });
  } catch (e) {
    win.close(); tiToast(t("qr_error")); return;
  }
  const agency = typeof TiDB !== "undefined" && p.agencyId ? await TiDB.getAgency(p.agencyId).catch(() => null) : null;
  const offer = p.forSale ? "À VENDRE" : (p.shortStay ? "LOCATION COURTE DURÉE" : "À LOUER");
  const price = (Number(p.price) || 0).toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA";
  const suffix = p.forSale ? "" : (p.shortStay ? " / nuit" : " / mois");
  const facts = [p.bedrooms ? `${p.bedrooms} chambre${p.bedrooms > 1 ? "s" : ""}` : "", p.bathrooms ? `${p.bathrooms} sdb` : "", p.area ? `${p.area} m²` : "", p.furnished ? "meublé" : ""].filter(Boolean).join(" · ");
  const hood = typeof tiNeighborhoodName === "function" ? tiNeighborhoodName(p.neighborhood) : "";
  const shortLink = tiKitLinkForPoster(p);
  const base = location.href.replace(/[^/]*$/, "");
  // Logo intégré directement dans l'affiche (fiable à l'impression et en PDF).
  const logoSvg = await fetch(base + "assets/brand/timmo-logo-white.svg").then(r => r.ok ? r.text() : "").catch(() => "");
  const esc = tiEscapeHtml;
  win.document.open();
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Affiche ${esc(p.reference || "")} — Timmo</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, "Segoe UI", Arial, sans-serif; color: #0D1B2A; background: #e9e5df; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 210mm; height: 297mm; margin: 10mm auto; background: #fff; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.15); }
  .top { background: #BF6A3D; color: #fff; text-align: center; padding: 14mm 10mm 10mm; }
  .offer { font-size: 31mm; line-height: .95; font-weight: 900; letter-spacing: -1mm; margin: 0; }
  .offer.long { font-size: 17mm; letter-spacing: 0; }
  .hood { font-size: 8mm; font-weight: 800; letter-spacing: 1.2mm; text-transform: uppercase; margin-top: 4mm; color: #FCE3A4; }
  .mid { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 86mm; gap: 10mm; padding: 12mm 14mm 6mm; align-items: center; }
  .title { font-size: 9mm; font-weight: 800; line-height: 1.15; margin: 0 0 5mm; }
  .price { font-size: 10.5mm; font-weight: 900; margin: 0; color: #BF6A3D; }
  .price span { white-space: nowrap; }
  .price small { font-size: 6mm; color: #5d6773; font-weight: 700; white-space: nowrap; display: inline-block; margin-left: 1.5mm; }
  .facts { font-size: 5.5mm; color: #5d6773; margin-top: 4mm; }
  .agency { margin-top: 9mm; padding-top: 6mm; border-top: 0.6mm solid #e7e1d8; font-size: 5mm; }
  .agency b { display: block; font-size: 6.5mm; }
  .agency .tel { font-size: 9mm; font-weight: 900; margin-top: 2mm; }
  .qrbox { text-align: center; }
  .qr { width: 80mm; height: 80mm; padding: 4mm; border: 1.2mm solid #0D1B2A; border-radius: 5mm; margin: 0 auto; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .scan { font-size: 6mm; font-weight: 900; margin-top: 4mm; }
  .scan small { display: block; font-size: 4.2mm; font-weight: 600; color: #5d6773; margin-top: 1.5mm; }
  .bottom { background: #0D1B2A; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 7mm 14mm; }
  .bottom .logo svg { height: 13mm; width: auto; display: block; }
  .bottom .url { font-size: 6mm; font-weight: 800; color: #F3C64B; }
  .bottom .ref { font-size: 3.6mm; color: #9aa6b2; text-align: right; }
  .bar { text-align: center; padding: 6mm; }
  .bar button { font: 700 15px Inter, Arial, sans-serif; background: #BF6A3D; color: #fff; border: 0; border-radius: 999px; padding: 12px 26px; cursor: pointer; }
  .bar p { color: #5d6773; font-size: 13px; margin: 8px 0 0; }
  @media print { body { background: #fff; } .sheet { margin: 0; box-shadow: none; } .bar { display: none; } }
</style></head><body>
<div class="bar"><button onclick="print()">🖨️ Imprimer / Enregistrer en PDF</button><p>Format A4. Collez l'affiche sur le panneau ou la façade : les passants scannent et voient le bien.</p></div>
<div class="sheet">
  <div class="top"><p class="offer${offer.length > 10 ? " long" : ""}">${offer}</p>${hood ? `<div class="hood">${esc(hood)}</div>` : ""}</div>
  <div class="mid">
    <div>
      <p class="title">${esc(p.title)}</p>
      <p class="price"><span>${price}</span><small>${suffix}</small></p>
      ${facts ? `<div class="facts">${esc(facts)}</div>` : ""}
      ${agency ? `<div class="agency"><b>${esc(agency.name || "")}</b>${agency.phone ? `<div class="tel">${esc(agency.phone)}</div>` : ""}</div>` : ""}
    </div>
    <div class="qrbox">
      <div class="qr">${qrSvg}</div>
      <div class="scan">Scannez pour voir les photos<small>et contacter l'agence en un clic</small></div>
    </div>
  </div>
  <div class="bottom">
    <div class="logo">${logoSvg || '<b style="font-size:9mm">timmo</b>'}</div>
    <div class="url">${esc(shortLink)}</div>
    <div class="ref">${p.reference ? `Réf. ${esc(p.reference)}` : ""}</div>
  </div>
</div>
</body></html>`);
  win.document.close();
}

function tiKitLinkForPoster(p) {
  if (typeof TI_BACKEND !== "undefined" && TI_BACKEND === "api" && (p.reference || p.id)) return `timmo.sn/p/${p.reference || p.id}`;
  return (location.host || "timmo.sn").replace(/^www\./, "");
}
