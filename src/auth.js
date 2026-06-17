// Capa de autenticación sobre Netlify Identity.
// Netlify gestiona las contraseñas; aquí solo abrimos el widget y leemos el usuario/token.
import netlifyIdentity from "netlify-identity-widget";

let started = false;

// Inicia Identity y registra callbacks. `onChange(user|null)` se llama al cargar,
// al iniciar sesión y al cerrarla.
export function initAuth(onChange) {
  if (!started) {
    // Para desarrollo local contra tu sitio desplegado, descomenta y pon tu URL:
    // netlifyIdentity.init({ APIUrl: "https://TU-SITIO.netlify.app/.netlify/identity" });
    netlifyIdentity.init();
    started = true;
  }
  netlifyIdentity.on("init", (u) => onChange(u || null));
  netlifyIdentity.on("login", (u) => { onChange(u || null); netlifyIdentity.close(); });
  netlifyIdentity.on("logout", () => onChange(null));
  return netlifyIdentity.currentUser();
}

export function login() { netlifyIdentity.open("login"); }
export function signup() { netlifyIdentity.open("signup"); }
export function logout() { netlifyIdentity.logout(); }
export function currentUser() { return netlifyIdentity.currentUser(); }

// Token JWT fresco para autenticar las llamadas a la función serverless.
export async function getToken() {
  const u = netlifyIdentity.currentUser();
  if (!u) return null;
  try { return await u.jwt(); } catch (e) { return null; }
}
