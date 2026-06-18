// Función serverless: cuotas en vivo de Liga MX desde The Odds API.
// - Protegida por login (Netlify Identity), igual que el registro, para que solo
//   tu familia pueda gastar el límite mensual de la API.
// - Cache compartido en Netlify Blobs (10 min) para no quemar las 500 consultas/mes:
//   aunque varios entren a la vez, se consulta la API una sola vez cada 10 min.
// - Devuelve las cuotas en formato AMERICANO (la de Caliente).
import { getStore } from "@netlify/blobs";

const SPORT = "soccer_mexico_ligamx";
const REGIONS = "us,eu";          // casas de EE.UU. + Europa que cubren Liga MX
const CACHE_TTL_MS = 10 * 60 * 1000;

// The Odds API -> nuestras claves de equipo (de data.js). Tolerante a acentos/mayúsculas.
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
  for (const [key, aliases] of TEAM_ALIASES) {
    if (aliases.some((a) => n.includes(a))) return key;
  }
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
        // en americana, mayor número = mejor cuota para el apostador
        if (!best[slot] || price > best[slot].price) best[slot] = { price, book: bk.title };
      }
    }
    return {
      id: ev.id,
      commence_time: ev.commence_time,
      homeRaw, awayRaw,
      homeKey: mapTeam(homeRaw),
      awayKey: mapTeam(awayRaw),
      best,
      books: (ev.bookmakers || []).length,
    };
  }).filter((m) => m.best.home && m.best.draw && m.best.away); // solo 1X2 completo
}

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: "No autorizado. Inicia sesión." });

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return json(500, { error: "Falta ODDS_API_KEY en las variables de entorno de Netlify." });

  const store = getStore("ligamx-odds-cache");

  // 1) intenta cache
  try {
    const cached = await store.get("latest", { type: "json" });
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return json(200, { ...cached.payload, cached: true });
    }
  } catch (e) { /* sin cache, seguimos a la API */ }

  // 2) consulta The Odds API
  const url = "https://api.the-odds-api.com/v4/sports/" + SPORT + "/odds"
    + "?apiKey=" + encodeURIComponent(apiKey)
    + "&regions=" + REGIONS + "&markets=h2h&oddsFormat=american&dateFormat=iso";

  let res;
  try { res = await fetch(url); }
  catch (e) { return json(502, { error: "No se pudo contactar The Odds API.", detail: String(e && e.message || e) }); }

  const remaining = res.headers.get("x-requests-remaining");
  const used = res.headers.get("x-requests-used");

  if (res.status === 401) return json(502, { error: "API key inválida o sin créditos en The Odds API." });
  if (res.status === 429) return json(502, { error: "Límite de The Odds API alcanzado por ahora." });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return json(502, { error: "The Odds API devolvió " + res.status + ".", detail: t.slice(0, 200) });
  }

  let raw;
  try { raw = await res.json(); } catch (e) { return json(502, { error: "Respuesta no válida de The Odds API." }); }

  const payload = {
    matches: normalize(raw),
    remaining: remaining != null ? Number(remaining) : null,
    used: used != null ? Number(used) : null,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };

  try { await store.setJSON("latest", { at: Date.now(), payload }); } catch (e) { /* ignora fallo de cache */ }

  return json(200, payload);
};

function json(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
