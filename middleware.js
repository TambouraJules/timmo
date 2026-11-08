/* ============================================================
   Timmo — aperçu des liens copiés depuis la barre d'adresse
   Quand quelqu'un colle https://www.timmo.sn/property.html?id=… dans
   WhatsApp, Facebook, LinkedIn…, le robot d'aperçu de l'application ne
   lit pas le JavaScript : il ne verrait que l'aperçu générique.
   Ce middleware (exécuté par Vercel avant la page) reconnaît ces robots
   et leur sert l'aperçu détaillé du bien (photo, prix, quartier, agence)
   généré par l'API. Les visiteurs humains ne sont jamais concernés.
   ============================================================ */
export const config = { matcher: ["/property.html", "/property"] };

const BOTS = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot|Pinterest|SkypeUriPreview|Viber|Snapchat|redditbot|Embedly|SignalBot|Iframely|vkShare/i;
const API = "https://timmo-api.onrender.com/api/share";

export default async function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!BOTS.test(ua)) return;                                   // visiteur humain : page normale
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(id)) return;
  const demo = /^demo\./i.test(url.hostname);
  try {
    const res = await fetch(`${API}/${demo ? "demo/" : ""}${encodeURIComponent(id)}`, { headers: { "user-agent": ua } });
    if (!res.ok) return;
    return new Response(res.body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" },
    });
  } catch (e) {
    return;                                                       // API indisponible : aperçu générique
  }
}
