# Liga MX · Detector de Valor

App web desplegable del detector de apuestas de valor para Liga MX. Modelo híbrido
Elo + Maher con corrección Dixon-Coles, calibrado por backtest sobre 2010–2025.
Incluye **cuentas reales** (Netlify Identity) y **registro por usuario** (Netlify
Blobs) para compartir con tu familia — sin vender ni cobrar nada.

---

## Qué incluye

- **Calculadora de valor** (abierta, sin login): elige el partido, ve las
  probabilidades del modelo (1X2, over/under 2.5, BTTS), captura cuotas, y obtén
  el valor, el de-margen de Shin y el stake con Kelly fraccional (tope 1.5%).
- **Cuentas**: cada familiar se registra con su correo. Netlify gestiona las
  contraseñas; el código nunca las toca.
- **Registro por usuario**: cada cuenta tiene su propio historial de apuestas y su
  CLV, guardado en el servidor (Netlify Blobs), privado.

## Estructura

```
ligamx-valor/
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml
├── src/
│   ├── main.jsx          arranque React
│   ├── App.jsx           interfaz completa
│   ├── styles.css        diseño (oscuro, alto contraste)
│   ├── data.js           ratings + configuración calibrada
│   ├── model.js          modelo híbrido + Shin (validado vs model.py)
│   ├── auth.js           Netlify Identity
│   └── api.js            llamadas al registro
└── netlify/functions/
    └── bets.js           registro por usuario (Blobs, protegido por login)
```

---

## Requisitos

- **Node.js 18+** (para desarrollo local).
- Una cuenta de **GitHub** (para alojar el repositorio).
- Una cuenta de **Netlify** (capa gratuita; para una familia sobra).

---

## Desarrollo local

```bash
npm install
npm run dev          # interfaz en http://localhost:5173
```

Ojo: con `npm run dev` (Vite) la **calculadora funciona**, pero el **login y el
registro NO**, porque Identity y Blobs solo existen cuando el sitio corre en
Netlify. Para probar todo localmente:

```bash
npm install -g netlify-cli   # una vez
netlify login
netlify link                 # vincula esta carpeta a tu sitio de Netlify
netlify dev                  # corre la app + funciones + Identity locales
```

Para que el login local funcione contra tu instancia desplegada, abre `src/auth.js`
y descomenta la línea `netlifyIdentity.init({ APIUrl: "https://TU-SITIO.netlify.app/.netlify/identity" })`
con la URL real de tu sitio.

---

## Despliegue (paso a paso)

### 1. Sube el código a GitHub
```bash
git init
git add .
git commit -m "Liga MX detector de valor"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/ligamx-valor.git
git push -u origin main
```

### 2. Crea el sitio en Netlify
- En Netlify: **Add new site → Import an existing project → GitHub** y elige el repo.
- Netlify lee `netlify.toml` solo; los ajustes ya están (build `npm run build`,
  publish `dist`, functions `netlify/functions`). Pulsa **Deploy**.

### 3. Activa Identity (el login)
- En el sitio: **Site configuration → Identity → Enable Identity**.
- En **Registration preferences**, elige **Invite only**. Esto es clave: así solo
  las personas que tú invites pueden crear cuenta. Nadie de fuera se registra.
- (Opcional) En **Emails** puedes personalizar los correos de invitación/confirmación.

### 4. Invita a tu familia
- En **Identity → Invite users**, escribe sus correos. Cada quien recibe un correo
  para poner su contraseña y entrar. Tú también te invitas a ti mismo (o usas
  "Sign up" desde la app si dejaste el registro abierto en pruebas).

### 5. Listo
Netlify Blobs está activo por defecto: no hay que configurar nada para el registro.
Cada usuario que entra ve y guarda solo su propio historial.

---

## Cómo funciona el almacenamiento por usuario

1. Al iniciar sesión, Netlify Identity entrega un **JWT** firmado.
2. La app lo manda en cada llamada a `/.netlify/functions/bets`.
3. La función lee `context.clientContext.user` (Netlify decodifica el JWT
   automáticamente). Si no hay usuario válido → 401.
4. Guarda/lee el registro en **Netlify Blobs** con la clave `user_<id-del-usuario>`,
   así cada cuenta queda aislada.

Es el mismo patrón de Blobs que ya usas; aquí va envuelto en una función con
verificación de identidad.

---

## Seguridad y privacidad

- **Registro por invitación** (paso 3) evita que desconocidos creen cuentas.
- Las contraseñas las maneja Netlify Identity; este código nunca las ve ni guarda.
- Cada registro está separado por usuario; nadie ve el de otro.
- Esto es una herramienta personal de seguimiento, **no** asesoría financiera.

---

## Siguientes pasos (Semana 3, lo que falta)

Este andamiaje es la base. Encima se añaden, como funciones serverless nuevas
(misma carpeta `netlify/functions/`), sin tocar lo ya hecho:

- **Cuotas automáticas** — función que llama a **The Odds API** (capa gratuita,
  cubre `soccer_mexico_ligamx`). La llave va oculta en una variable de entorno de
  Netlify; la app deja de capturar cuotas a mano y detecta valor sola.
- **Chat analista** — función que conecta a la API de Anthropic (llave oculta del
  lado servidor) y razona sobre el partido con los números del modelo en contexto.

---

## Nota sobre el modelo

- El **1X2 está validado** por backtest (Brier 0.6118, le gana a las bases).
- El **mercado de goles es informativo** hasta incorporar **xG** (el punto de
  enganche ya está en el pipeline de Python; aquí se usa el modelo sobre goles).
- **Atlante** entra en Apertura 2026 con rating **provisional** (juega en el
  Azteca/Banorte → hereda altitud 2,240 m). Se afina solo con los primeros partidos.
- La métrica que importa es el **CLV sostenido**, no ganar la apuesta de hoy.
  Apuesta en papel hasta acumular CLV positivo.
```
