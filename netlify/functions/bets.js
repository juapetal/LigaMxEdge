// Registro de apuestas por usuario — SIN Netlify Blobs.
// Guarda los datos en el perfil del propio usuario (user_metadata) usando la API
// de administración de Netlify Identity. Netlify inyecta automáticamente la URL y
// un token de admin en context.clientContext.identity cuando Identity está activo,
// así que no hace falta ninguna variable de entorno ni configuración extra.
export const handler = async (event, context) => {
  const cc = context.clientContext || {};
  const user = cc.user;
  const identity = cc.identity;
  if (!user) return json(401, { error: "No autorizado. Inicia sesión." });
  if (!identity || !identity.url || !identity.token) {
    return json(500, { error: "Identity no disponible en la función. ¿Está habilitado Netlify Identity?" });
  }

  const userUrl = identity.url + "/admin/users/" + user.sub;
  const headers = { Authorization: "Bearer " + identity.token, "Content-Type": "application/json" };

  try {
    if (event.httpMethod === "GET") {
      const r = await fetch(userUrl, { headers });
      if (!r.ok) return json(502, { error: "No se pudo leer el perfil.", detail: (await r.text()).slice(0, 200) });
      const u = await r.json();
      const bets = u && u.user_metadata && Array.isArray(u.user_metadata.bets) ? u.user_metadata.bets : [];
      return json(200, { bets });
    }

    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      let bets = Array.isArray(body.bets) ? body.bets : [];
      if (bets.length > 1000) bets = bets.slice(0, 1000); // tope defensivo

      // leer metadata actual para no pisar otras claves
      const cur = await fetch(userUrl, { headers });
      const u = cur.ok ? await cur.json() : {};
      const meta = u && u.user_metadata ? u.user_metadata : {};

      const put = await fetch(userUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({ user_metadata: { ...meta, bets } }),
      });
      if (!put.ok) return json(502, { error: "No se pudo guardar.", detail: (await put.text()).slice(0, 200) });
      return json(200, { ok: true, count: bets.length });
    }

    return json(405, { error: "Método no permitido" });
  } catch (e) {
    return json(500, { error: "Error en el registro.", detail: String(e && e.message ? e.message : e) });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
