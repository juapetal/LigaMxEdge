// Registro de apuestas por usuario. Formato CLASICO (CommonJS).
// Guarda en el perfil del usuario (user_metadata) via Netlify Identity.
function json(statusCode, obj) {
  return { statusCode: statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}

exports.handler = async function (event, context) {
  var cc = context.clientContext || {};
  var user = cc.user;
  var identity = cc.identity;
  if (!user) return json(401, { error: "No autorizado. Inicia sesion." });
  if (!identity || !identity.url || !identity.token) {
    return json(500, { error: "Identity no disponible. Esta habilitado Netlify Identity?" });
  }

  var userUrl = identity.url + "/admin/users/" + user.sub;
  var headers = { Authorization: "Bearer " + identity.token, "Content-Type": "application/json" };

  try {
    if (event.httpMethod === "GET") {
      var r = await fetch(userUrl, { headers: headers });
      if (!r.ok) {
        var t = "";
        try { t = await r.text(); } catch (e) { t = ""; }
        return json(502, { error: "No se pudo leer el perfil.", detail: t.slice(0, 200) });
      }
      var u = await r.json();
      var bets = u && u.user_metadata && Array.isArray(u.user_metadata.bets) ? u.user_metadata.bets : [];
      return json(200, { bets: bets });
    }

    if (event.httpMethod === "PUT") {
      var body = JSON.parse(event.body || "{}");
      var newBets = Array.isArray(body.bets) ? body.bets : [];
      if (newBets.length > 1000) newBets = newBets.slice(0, 1000);

      var cur = await fetch(userUrl, { headers: headers });
      var cu = cur.ok ? await cur.json() : {};
      var meta = cu && cu.user_metadata ? cu.user_metadata : {};
      meta.bets = newBets;

      var put = await fetch(userUrl, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify({ user_metadata: meta })
      });
      if (!put.ok) {
        var t2 = "";
        try { t2 = await put.text(); } catch (e) { t2 = ""; }
        return json(502, { error: "No se pudo guardar.", detail: t2.slice(0, 200) });
      }
      return json(200, { ok: true, count: newBets.length });
    }

    return json(405, { error: "Metodo no permitido" });
  } catch (e) {
    return json(500, { error: "Error en el registro.", detail: String(e && e.message ? e.message : e) });
  }
};
