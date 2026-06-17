// Función serverless: registro de apuestas por usuario.
// - Autenticación: requiere un JWT válido de Netlify Identity. Netlify lo decodifica
//   automáticamente y lo expone en context.clientContext.user cuando la petición
//   trae el encabezado Authorization: Bearer <jwt>.
// - Almacenamiento: Netlify Blobs, una clave por usuario (su user.sub).
import { getStore } from "@netlify/blobs";

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return json(401, { error: "No autorizado. Inicia sesión." });
  }

  const store = getStore("ligamx-bets");
  const key = "user_" + user.sub; // un blob por usuario

  try {
    if (event.httpMethod === "GET") {
      const bets = await store.get(key, { type: "json" });
      return json(200, { bets: bets || [] });
    }

    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const bets = Array.isArray(body.bets) ? body.bets : [];
      // límite defensivo de tamaño para una app personal
      if (bets.length > 5000) return json(413, { error: "Demasiadas apuestas." });
      await store.setJSON(key, bets);
      return json(200, { ok: true, count: bets.length });
    }

    return json(405, { error: "Método no permitido" });
  } catch (e) {
    return json(500, { error: "Error de almacenamiento", detail: String(e && e.message ? e.message : e) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
