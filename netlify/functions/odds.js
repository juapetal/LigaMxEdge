// Cuotas en vivo de Liga MX desde The Odds API. Formato CLASICO (CommonJS).
const SPORT = "soccer_mexico_ligamx";
const REGIONS = "us,eu";
const CACHE_TTL_MS = 10 * 60 * 1000;

let memo = null;

const TEAM_ALIASES = [
  ["Atlas Guadalajara", ["atlas"]],
  ["Deportivo Guadalajara", ["guadalajara", "chivas"]],
  ["CF America", ["america"]],
  ["Cruz Azul", ["cruz azul"]],
  ["CF Monterrey", ["monterrey", "rayados"]],
  ["UANL Tigres", ["tigres"]],
  ["CF Pachuca", ["pachuca"]],
  ["Club Necaxa", ["necaxa"]],
  ["Club Leon", ["leon"]],
  ["Pumas UNAM", ["pumas", "unam"]],
  ["Club Tijuana", ["tijuana", "xolos"]],
  ["Atletico San Luis", ["san luis"]],
  ["FC Juarez", ["juarez", "bravos"]],
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
  for (var i = 0; i < TEAM_ALIASES.length; i++) {
    var key = TEAM_ALIASES[i][0];
    var aliases = TEAM_ALIASES[i][1];
    if (aliases.some(function (a) { return n.indexOf(a) !== -1; })) return key;
  }
  return null;
}

function normalize(events) {
  if (!Array.isArray(events)) return [];
  var out = [];
  for (var e = 0; e < events.length; e++) {
    try {
      var ev = events[e];
      if (!ev || typeof ev !== "object") continue;
      var homeRaw = ev.home_team, awayRaw = ev.away_team;
      if (!homeRaw || !awayRaw) continue;

      var best = { home: null, draw: null, away: null };
      var bookmakers = Array.isArray(ev.bookmakers) ? ev.bookmakers : [];
      for (var b = 0; b < bookmakers.length; b++) {
        var bk = bookmakers[b];
        if (!bk) continue;
        var markets = Array.isArray(bk.markets) ? bk.markets : [];
        var h2h = null;
        for (var m = 0; m < markets.length; m++) { if (markets[m] && markets[m].key === "h2h") { h2h = markets[m]; break; } }
        if (!h2h) continue;
        var outcomes = Array.isArray(h2h.outcomes) ? h2h.outcomes : [];
        for (var o = 0; o < outcomes.length; o++) {
          var oc = outcomes[o];
          if (!oc) continue;
          var slot = null;
          if (oc.name === homeRaw) slot = "home";
          else if (oc.name === awayRaw) slot = "away";
          else if (/draw|empate|tie/i.test(String(oc.name || ""))) slot = "draw";
          if (!slot) continue;
          var price = Number(oc.price);
          if (!isFinite(price)) continue;
          if (!best[slot] || price > best[slot].price) best[slot] = { price: price, book: bk.title || "" };
        }
      }

      if (best.home && best.draw && best.away) {
        out.push({
          id: ev.id,
          commence_time: ev.commence_time,
          homeRaw: homeRaw, awayRaw: awayRaw,
          homeKey: mapTeam(homeRaw), awayKey: mapTeam(awayRaw),
          best: best, books: bookmakers.length
        });
      }
    } catch (err) { /* salta partido problematico */ }
  }
  return out;
}

function numOrNull(v) { return v != null ? Number(v) : null; }
function json(statusCode, obj) {
  return { statusCode: statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}

exports.handler = async function (event, context) {
  try {
    var user = context.clientContext && context.clientContext.user;
    if (!user) return json(401, { error: "No autorizado. Inicia sesion." });

    var apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) return json(500, { error: "Falta ODDS_API_KEY en las variables de entorno de Netlify." });

    if (memo && Date.now() - memo.at < CACHE_TTL_MS) {
      return json(200, Object.assign({}, memo.payload, { cached: true }));
    }

    var url = "https://api.the-odds-api.com/v4/sports/" + SPORT + "/odds"
      + "?apiKey=" + encodeURIComponent(apiKey)
      + "&regions=" + REGIONS + "&markets=h2h&oddsFormat=american&dateFormat=iso";

    var res;
    try { res = await fetch(url); }
    catch (e) { return json(502, { error: "No se pudo contactar The Odds API.", detail: String(e && e.message || e) }); }

    var remaining = res.headers.get("x-requests-remaining");
    var used = res.headers.get("x-requests-used");

    if (res.status === 404 || res.status === 422) {
      var empty = { matches: [], remaining: numOrNull(remaining), used: numOrNull(used), offseason: true, fetchedAt: new Date().toISOString(), cached: false };
      memo = { at: Date.now(), payload: empty };
      return json(200, empty);
    }
    if (res.status === 401) return json(502, { error: "API key invalida o sin creditos en The Odds API." });
    if (res.status === 429) return json(502, { error: "Limite de The Odds API alcanzado por ahora." });
    if (!res.ok) {
      var t = "";
      try { t = await res.text(); } catch (e2) { t = ""; }
      return json(502, { error: "The Odds API devolvio " + res.status + ".", detail: t.slice(0, 200) });
    }

    var raw;
    try { raw = await res.json(); } catch (e3) { return json(502, { error: "Respuesta no valida de The Odds API." }); }

    var payload = {
      matches: normalize(raw),
      remaining: numOrNull(remaining),
      used: numOrNull(used),
      fetchedAt: new Date().toISOString(),
      cached: false
    };
    memo = { at: Date.now(), payload: payload };
    return json(200, payload);
  } catch (e) {
    return json(500, { error: "Error inesperado en la funcion de cuotas.", detail: String(e && e.message ? e.message : e) });
  }
};
