// Cuotas en vivo de Liga MX desde The Odds API — SIN Netlify Blobs.
// - Protegida por login (Netlify Identity).
// - Cache en memoria (mejor esfuerzo, por instancia caliente) para no quemar el
//   límite mensual; no necesita ninguna dependencia ni configuración.
// - Devuelve las cuotas en formato AMERICANO (la de Caliente).
// - Fuera de temporada devuelve lista vacía (no error).

const SPORT = "soccer_mexico_ligamx";
const REGIONS = "us,eu";
const CACHE_TTL_MS = 10 * 60 * 1000;

let memo = null; // cache en memoria por instancia

const TEAM_ALIASES = [
  ["Atlas Guadalajara", ["atlas"]],
  ["Deportivo Guadalajara", ["guadalajara", "chivas"]],
  ["CF América", ["america"]],
  ["Cruz Azul", ["cruz azul"]],
  ["CF Monterrey", ["monterrey", "rayados"]],
  ["UANL Tigres", ["tigres"]],
  ["CF Pachuca", ["pachuca"]],
  ["Club Necaxa", ["necaxa"]],
  ["Club León", ["leon"]],
  ["Pumas UNAM", ["pumas", "unam"]],
  ["Club Tijuana", ["tijuana", "xolos"]],
  ["Atlético San Luis", ["san luis"]],
  ["FC Juárez", ["juarez", "bravos"]],
  ["Gallos Blancos", ["queretaro", "gallos"]],
  ["Atlante", ["atlante"]],
  ["Puebla FC", ["puebla"]],
  ["Santos Laguna", ["santos"]],
  ["Deportivo Toluca", ["toluca"]],
];

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function mapTeam(raw) {
  const n = norm(raw);
  for (const [key, aliases] of TEAM_ALIASES) if (aliases.some((a) => n.includes(a))) return key;
  return null;
}
function normalize(events) {
  if (!Array.isArray(events)) return [];
  return events.map((ev) => {
    const homeRaw = ev.home_team, awayRaw = ev.away_team;
    const best = { home: null, draw: null, away: null };
    for (const bk of ev.bookmakers || []) {
      const h2h = (bk.markets || []).find((m) => m.key === "h2h");
      if (!h2h) continue;
      for (const oc of h2h.outcomes || []) {
        let slot = null;
        if (oc.name === homeRaw) slot = "home";
        else if (oc.name === awayRaw) slot = "away";
        else if (/draw|empate|tie/i.test(oc.name)) slot = "draw";
        if (!slot) continue;
        const price = Number(oc.price);
        if (!isFinite(price)) continue;
        if (!best[slot] || price > best[slot].price) best[slot] = { price, book: bk.title };
      }
    }
    return {
      id: ev.id, commence_time: ev.commence_time, homeRaw, awayRaw,
      homeKey: mapTeam(homeRaw), awayKey: mapTeam(awayRaw),
      best, books: (ev.bookmakers || []).length,
    };
  }).filter((m) => m.best.home && m.best.draw && m.best.away);
}

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: "No autorizado. Inicia sesión." });

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return json(500, { error: "Falta ODDS_API_KEY en las variables de entorno de Netlify." });

  if (memo && Date.now() - memo.at < CACHE_TTL_MS) return json(200, { ...memo.payload, cached: true });

  const url = "https://api.the-odds-api.com/v4/sports/" + SPORT + "/odds"
    + "?apiKey=" + encodeURIComponent(apiKey)
    + "&regions=" + REGIONS + "&markets=h2h&oddsFormat=american&dateFormat=iso";

  let res;
  try { res = await fetch(url); }
  catch (e) { return json(502, { error: "No se pudo contactar The Odds API.", detail: String(e && e.message || e) }); }

  const remaining = res.headers.get("x-requests-remaining");
  const used = res.headers.get("x-requests-used");

  // fuera de temporada / deporte inactivo: tratar como "sin jornada", no error
  if (res.status === 404 || res.status === 422) {
    const payload = { matches: [], remaining: remaining != null ? Number(remaining) : null, used: used != null ? Number(used) : null, offseason: true, fetchedAt: new Date().toISOString(), cached: false };
    memo = { at: Date.now(), payload };
    return json(200, payload);
  }
  if (res.status === 401) return json(502, { error: "API key inválida o sin créditos en The Odds API." });
  if (res.status === 429) return json(502, { error: "Límite de The Odds API alcanzado por ahora." });
  if (!res.ok) return json(502, { error: "The Odds API devolvió " + res.status + ".", detail: (await res.text().catch(() => "")).slice(0, 200) });

  let raw;
  try { raw = await res.json(); } catch (e) { return json(502, { error: "Respuesta no válida de The Odds API." }); }

  const payload = {
    matches: normalize(raw),
    remaining: remaining != null ? Number(remaining) : null,
    used: used != null ? Number(used) : null,
    fetchedAt: new Date().toISOString(), cached: false,
  };
  memo = { at: Date.now(), payload };
  return json(200, payload);
};

function json(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
