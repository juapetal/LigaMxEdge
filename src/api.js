// Llamadas al backend (función serverless) para el registro por usuario.
// Cada petición lleva el JWT de Netlify Identity; la función lo verifica y
// guarda/lee el registro de ese usuario en Netlify Blobs.
import { getToken } from "./auth.js";

const ENDPOINT = "/.netlify/functions/bets";

export async function loadBets() {
  const token = await getToken();
  if (!token) return [];
  const res = await fetch(ENDPOINT, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) throw new Error("No se pudo cargar el registro (" + res.status + ")");
  const data = await res.json();
  return Array.isArray(data.bets) ? data.bets : [];
}

export async function saveBets(bets) {
  const token = await getToken();
  if (!token) throw new Error("Sesión no iniciada");
  const res = await fetch(ENDPOINT, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ bets }),
  });
  if (!res.ok) throw new Error("No se pudo guardar (" + res.status + ")");
  return true;
}

// Cuotas en vivo de Liga MX (vía la función serverless, que llama a The Odds API).
export async function loadOdds() {
  const token = await getToken();
  if (!token) throw new Error("Sesión no iniciada");
  const res = await fetch("/.netlify/functions/odds", { headers: { Authorization: "Bearer " + token } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error " + res.status);
  return data;
}
