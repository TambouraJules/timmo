/* ============================================================
   Timmo — Kit réseaux sociaux
   Pour une annonce, génère en un clic (dans le navigateur, sans serveur) :
     - un visuel carré 1080×1080 (Facebook, Instagram),
     - un visuel vertical 1080×1920 (statut WhatsApp, stories, TikTok),
     - des textes prêts à coller (Facebook, statut WhatsApp, Instagram / TikTok).
   Chaque visuel porte le logo et l'adresse Timmo : chaque publication d'agence
   fait aussi connaître la plateforme.
   Dépend de main.js (tiShareUrl, tiOpenModal, tiToast, t).
   ============================================================ */

const TI_KIT = { prop: null, photo: null, square: null, story: null };
const TI_KIT_C = { clay: "#BF6A3D", navy: "#0D1B2A", sun: "#F3C64B", cream: "#F7F3EE", gold: "#D4AF37" };

function tiKitPrice(p) {
  const n = (Number(p.price) || 0).toLocaleString("fr-FR").replace(/ | /g, " ");
  return { amount: `${n} FCFA`, suffix: p.forSale ? "" : (p.shortStay ? "/ nuit" : "/ mois") };
}
function tiKitOffer(p) {
  return p.forSale ? "À VENDRE" : (p.shortStay ? "COURT SÉJOUR" : "À LOUER");
}
function tiKitFacts(p) {
  return [
    p.bedrooms ? `${p.bedrooms} ch.` : "",
    p.bathrooms ? `${p.bathrooms} sdb` : "",
    p.area ? `${p.area} m²` : "",
    p.furnished ? "meublé" : "",
  ].filter(Boolean).join("  ·  ");
}
function tiKitHood(p) {
  return typeof tiNeighborhoodName === "function" ? tiNeighborhoodName(p.neighborhood) : (p.neighborhood || "");
}
function tiKitAgency(p) {
  return typeof tiAgencyName === "function" ? tiAgencyName(p.agencyId) : "";
}
/** Adresse courte imprimée sur les visuels (lisible, sans paramètres). */
function tiKitLink(p) {
  if (typeof TI_BACKEND !== "undefined" && TI_BACKEND === "api" && (p.reference || p.id)) return `timmo.sn/p/${p.reference || p.id}`;
  return location.host.replace(/^www\./, "") || "timmo.sn";
}

/** Charge la photo de couverture pour le dessin. Les photos d'un autre site doivent
 *  autoriser le partage (CORS) — sinon on dessine un fond de couleur à la place. */
function tiKitLoadPhoto(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    if (!/^data:/.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ---------- Dessin ---------- */
function tiKitCover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  const iw = img.width * r, ih = img.height * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function tiKitRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/** Symbole Timmo (toit, soleil, vague) dessiné en vectoriel : net à toutes les tailles. */
function tiKitSymbol(ctx, x, y, s) {
  const k = s / 100;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  tiKitRoundRect(ctx, 0, 0, 100, 100, 24); ctx.fillStyle = TI_KIT_C.clay; ctx.fill();
  ctx.fillStyle = TI_KIT_C.sun; ctx.beginPath(); ctx.moveTo(29, 66); ctx.arc(50, 66, 21, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(17, 47); ctx.lineTo(50, 20); ctx.lineTo(83, 47); ctx.stroke();
  ctx.strokeStyle = TI_KIT_C.navy; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(18, 77);
  [[26, 70, 34, 77], [42, 84, 50, 77], [58, 70, 66, 77], [74, 84, 82, 77]].forEach(([cx, cy, ex, ey]) => ctx.quadraticCurveTo(cx, cy, ex, ey));
  ctx.stroke();
  ctx.restore();
}
function tiKitLogo(ctx, x, y, s, color) {
  tiKitSymbol(ctx, x, y, s);
  ctx.fillStyle = color; ctx.font = `900 ${Math.round(s * 0.62)}px Lato, Inter, sans-serif`; ctx.textBaseline = "middle";
  ctx.fillText("timmo", x + s * 1.18, y + s * 0.47);
}
function tiKitWrap(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/); const lines = []; let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    while (ctx.measureText(lines[maxLines - 1] + "…").width > maxW) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S+$/, "");
    lines[maxLines - 1] += "…";
  }
  return lines;
}
function tiKitPill(ctx, text, x, y, h, bg, fg, font) {
  ctx.font = font; const w = ctx.measureText(text).width + h;
  tiKitRoundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.fillText(text, x + h / 2, y + h / 2 + 1);
  return w;
}
function tiKitPhotoOrFallback(ctx, img, x, y, w, h) {
  if (img) { tiKitCover(ctx, img, x, y, w, h); return; }
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "#E9A04F"); g.addColorStop(1, TI_KIT_C.clay);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  tiKitSymbol(ctx, x + w / 2 - 120, y + h / 2 - 140, 240);
}

/** Visuel carré 1080×1080 */
function tiKitDrawSquare(p, img) {
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1080;
  const ctx = c.getContext("2d");
  tiKitPhotoOrFallback(ctx, img, 0, 0, 1080, 1080);
  let g = ctx.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, "rgba(13,27,42,.55)"); g.addColorStop(1, "rgba(13,27,42,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 260);
  g = ctx.createLinearGradient(0, 520, 0, 1080); g.addColorStop(0, "rgba(13,27,42,0)"); g.addColorStop(.45, "rgba(13,27,42,.78)"); g.addColorStop(1, "rgba(13,27,42,.96)");
  ctx.fillStyle = g; ctx.fillRect(0, 520, 1080, 560);

  tiKitPill(ctx, tiKitOffer(p), 56, 56, 64, TI_KIT_C.clay, "#fff", "800 30px Inter, sans-serif");
  tiKitLogo(ctx, 760, 50, 76, "#fff");

  ctx.textBaseline = "alphabetic";
  // Mise en page du bas vers le haut : rien ne se chevauche, même avec un titre sur 2 lignes.
  const yFoot = 1036, facts = tiKitFacts(p);
  const yFacts = yFoot - 64, yPrice = (facts ? yFacts : yFoot) - 58;
  ctx.font = "700 28px Inter, sans-serif"; ctx.fillStyle = TI_KIT_C.sun;
  ctx.fillText(tiKitLink(p), 64, yFoot);
  const ag = tiKitAgency(p);
  if (ag) { ctx.textAlign = "right"; ctx.fillStyle = "#d8dee6"; ctx.font = "600 26px Inter, sans-serif"; ctx.fillText(ag, 1016, yFoot); ctx.textAlign = "left"; }
  if (facts) { ctx.font = "600 30px Inter, sans-serif"; ctx.fillStyle = "#d8dee6"; ctx.fillText(facts, 64, yFacts); }
  const pr = tiKitPrice(p);
  ctx.font = "900 70px Lato, Inter, sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(pr.amount, 64, yPrice);
  if (pr.suffix) { const w = ctx.measureText(pr.amount).width; ctx.font = "600 36px Inter, sans-serif"; ctx.fillStyle = "#d8dee6"; ctx.fillText(" " + pr.suffix, 64 + w + 6, yPrice); }
  ctx.font = "900 58px Lato, Inter, sans-serif"; ctx.fillStyle = "#fff";
  const lines = tiKitWrap(ctx, p.title, 950, 2);
  const yTitleLast = yPrice - 92;
  lines.forEach((l, k) => ctx.fillText(l, 64, yTitleLast - (lines.length - 1 - k) * 66));
  ctx.fillStyle = TI_KIT_C.sun; ctx.font = "800 30px Inter, sans-serif";
  ctx.fillText(tiKitHood(p).toUpperCase(), 64, yTitleLast - (lines.length - 1) * 66 - 70);
  return c;
}

/** Visuel vertical 1080×1920 (statut WhatsApp, stories) */
function tiKitDrawStory(p, img) {
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1920;
  const ctx = c.getContext("2d");
  ctx.fillStyle = TI_KIT_C.navy; ctx.fillRect(0, 0, 1080, 1920);
  ctx.save(); tiKitRoundRect(ctx, 48, 190, 984, 1060, 44); ctx.clip();
  tiKitPhotoOrFallback(ctx, img, 48, 190, 984, 1060); ctx.restore();
  tiKitLogo(ctx, 64, 60, 88, "#fff");
  tiKitPill(ctx, tiKitOffer(p), 72, 222, 66, TI_KIT_C.clay, "#fff", "800 30px Inter, sans-serif");

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = TI_KIT_C.sun; ctx.font = "800 34px Inter, sans-serif";
  ctx.fillText(tiKitHood(p).toUpperCase(), 72, 1350);
  ctx.fillStyle = "#fff"; ctx.font = "900 66px Lato, Inter, sans-serif";
  const lines = tiKitWrap(ctx, p.title, 936, 2);
  lines.forEach((l, i) => ctx.fillText(l, 72, 1430 + i * 76));
  const yPrice = 1430 + lines.length * 76 + 50;
  const pr = tiKitPrice(p);
  ctx.font = "900 84px Lato, Inter, sans-serif"; ctx.fillText(pr.amount, 72, yPrice);
  if (pr.suffix) { const w = ctx.measureText(pr.amount).width; ctx.font = "600 42px Inter, sans-serif"; ctx.fillStyle = "#c7d0da"; ctx.fillText(" " + pr.suffix, 72 + w + 8, yPrice); }
  ctx.fillStyle = "#c7d0da"; ctx.font = "600 36px Inter, sans-serif";
  const facts = tiKitFacts(p); if (facts) ctx.fillText(facts, 72, yPrice + 64);
  // Bandeau d'appel à l'action
  tiKitRoundRect(ctx, 72, 1740, 936, 112, 56); ctx.fillStyle = TI_KIT_C.clay; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const cta = `Voir l'annonce  ·  ${tiKitLink(p)}`;
  let fs = 38; do { ctx.font = `800 ${fs}px Inter, sans-serif`; fs -= 2; } while (ctx.measureText(cta).width > 860 && fs > 20);
  ctx.fillText(cta, 540, 1797);
  ctx.textAlign = "left";
  return c;
}

/* ---------- Textes prêts à coller ---------- */
function tiKitCaptions(p) {
  const pr = tiKitPrice(p); const hood = tiKitHood(p); const facts = tiKitFacts(p).replace(/\s+·\s+/g, " · ");
  const ag = tiKitAgency(p); const offer = tiKitOffer(p).toLowerCase();
  const tagHood = hood ? "#" + hood.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "") : "";
  return {
    facebook:
`🏠 ${p.title}
📍 ${hood}, Dakar — ${offer}
💰 ${pr.amount} ${pr.suffix}
${facts ? "✅ " + facts + "\n" : ""}
Photos, carte et contact direct${ag ? " avec " + ag : ""} 👇
${tiShareUrl(p, "facebook")}

#Dakar #ImmobilierSénégal ${tagHood} #Timmo`,
    whatsapp:
`🏠 ${p.title} — ${pr.amount} ${pr.suffix}
📍 ${hood} · ${facts}
👉 ${tiShareUrl(p, "statut")}`,
    social:
`${p.title} ✨
📍 ${hood} · ${pr.amount} ${pr.suffix}
${facts}
Toutes les photos et le contact : lien en bio / timmo.sn 🔑

#Dakar #Senegal #ImmobilierDakar ${tagHood} #LocationDakar #Timmo`,
  };
}

/* ---------- Fenêtre « Kit réseaux sociaux » ---------- */
async function tiOpenSocialKit(p) {
  if (!p) return;
  if (typeof tiCloseModal === "function" && document.getElementById("modal-share")) tiCloseModal("modal-share");
  TI_KIT.prop = p;
  let modal = document.getElementById("modal-kit");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "ti-modal-backdrop"; modal.id = "modal-kit";
    modal.addEventListener("click", ev => { if (ev.target === modal) tiCloseModal("modal-kit"); });
    document.body.appendChild(modal);
  }
  const caps = tiKitCaptions(p);
  modal.innerHTML = `
    <div class="ti-modal ti-modal-flex ti-kit-modal" role="dialog" aria-modal="true" aria-labelledby="kit-title">
      <div class="ti-modal-head">
        <h3 id="kit-title">${t("kit_title")}</h3>
        <button type="button" class="ti-modal-close" onclick="tiCloseModal('modal-kit')" aria-label="Fermer">&times;</button>
      </div>
      <div class="ti-modal-body">
        <p class="ti-kit-sub">${t("kit_sub")}</p>
        <div class="ti-kit-previews">
          <figure class="ti-kit-fig"><div class="ti-kit-canvas ti-kit-sq" id="kit-sq"><span class="ti-kit-loading">…</span></div>
            <figcaption><b>${t("kit_square")}</b><span>Facebook · Instagram</span>
              <button type="button" class="btn btn-primary btn-sm" onclick="tiKitExport('square')">${t("kit_download")}</button></figcaption></figure>
          <figure class="ti-kit-fig"><div class="ti-kit-canvas ti-kit-st" id="kit-st"><span class="ti-kit-loading">…</span></div>
            <figcaption><b>${t("kit_story")}</b><span>Statut WhatsApp · Stories · TikTok</span>
              <button type="button" class="btn btn-primary btn-sm" onclick="tiKitExport('story')">${t("kit_download")}</button></figcaption></figure>
        </div>
        <p class="ti-kit-warn" id="kit-warn" hidden>${t("kit_no_photo")}</p>
        <h4 class="ti-kit-h4">${t("kit_texts")}</h4>
        <div class="ti-kit-caps">
          ${[["facebook", "Facebook"], ["whatsapp", "Statut WhatsApp"], ["social", "Instagram · TikTok"]].map(([k, label]) => `
            <div class="ti-kit-cap">
              <div class="ti-kit-cap-head"><b>${label}</b><button type="button" class="btn btn-outline btn-sm" onclick="tiKitCopy('${k}')">${t("share_copy")}</button></div>
              <textarea id="kit-cap-${k}" rows="6">${tiEscapeHtml(caps[k])}</textarea>
            </div>`).join("")}
        </div>
      </div>
    </div>`;
  tiOpenModal("modal-kit");
  try { await document.fonts.load("900 60px Lato"); await document.fonts.load("800 30px Inter"); } catch (e) { /* polices système en repli */ }
  const img = await tiKitLoadPhoto(p.cover || (p.photos || [])[0]);
  document.getElementById("kit-warn").hidden = !!img;
  TI_KIT.square = tiKitDrawSquare(p, img);
  TI_KIT.story = tiKitDrawStory(p, img);
  const sq = document.getElementById("kit-sq"), st = document.getElementById("kit-st");
  sq.innerHTML = ""; st.innerHTML = "";
  sq.appendChild(TI_KIT.square); st.appendChild(TI_KIT.story);
}

function tiKitFileName(kind) {
  const ref = (TI_KIT.prop.reference || TI_KIT.prop.id || "annonce").replace(/[^A-Za-z0-9_-]/g, "");
  return `timmo-${ref}-${kind === "square" ? "carre" : "statut"}.png`;
}
/** Téléphone : ouvre le partage natif avec l'image (statut WhatsApp en 2 touches).
 *  Ordinateur : télécharge le PNG. */
async function tiKitExport(kind) {
  const canvas = kind === "square" ? TI_KIT.square : TI_KIT.story;
  if (!canvas) return;
  let blob;
  try { blob = await new Promise(r => canvas.toBlob(r, "image/png")); } catch (e) { blob = null; }
  if (!blob) { tiToast(t("kit_export_error")); return; }
  const file = new File([blob], tiKitFileName(kind), { type: "image/png" });
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: tiKitCaptions(TI_KIT.prop)[kind === "square" ? "facebook" : "whatsapp"] });
      return;
    } catch (e) { if (e && e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function tiKitCopy(k) {
  const ta = document.getElementById("kit-cap-" + k);
  if (!ta) return;
  try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand && document.execCommand("copy"); }
  tiToast(t("share_copied"));
}
