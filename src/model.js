// Modelo híbrido Elo + Maher con corrección Dixon-Coles + de-margen de Shin.
// Portado y validado contra model.py (coincide a 3 decimales).
import { DATA } from "./data.js";

const RHO = -0.10, MAXG = 10;

const _lnf = [0];
function lnfact(k) { for (let i = _lnf.length; i <= k; i++) _lnf[i] = _lnf[i - 1] + Math.log(i); return _lnf[k]; }
function poisVec(lam) { const v = []; for (let k = 0; k <= MAXG; k++) v.push(Math.exp(k * Math.log(lam) - lam - lnfact(k))); return v; }

function scoreMatrix(lh, la) {
  const ph = poisVec(lh), pa = poisVec(la), M = []; let s = 0;
  for (let i = 0; i <= MAXG; i++) {
    M[i] = [];
    for (let j = 0; j <= MAXG; j++) {
      let p = ph[i] * pa[j];
      if (i === 0 && j === 0) p *= 1 - lh * la * RHO;
      else if (i === 0 && j === 1) p *= 1 + lh * RHO;
      else if (i === 1 && j === 0) p *= 1 + la * RHO;
      else if (i === 1 && j === 1) p *= 1 - RHO;
      M[i][j] = p; s += p;
    }
  }
  for (let i = 0; i <= MAXG; i++) for (let j = 0; j <= MAXG; j++) M[i][j] /= s;
  return M;
}

function probsFromMatrix(M) {
  const n = M.length; let H = 0, D = 0, A = 0, over = 0, btts = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = M[i][j];
    if (i > j) H += p; else if (i === j) D += p; else A += p;
    if (i + j >= 3) over += p;
    if (i >= 1 && j >= 1) btts += p;
  }
  return { H, D, A, over25: over, under25: 1 - over, btts };
}

const eloExpected = (d) => 1 / (1 + Math.pow(10, -d / 400));
export const localiaElo = (altH, altA) =>
  DATA.cfg.localia_H + DATA.cfg.localia_k_alt * Math.max(0, (altH - altA) / 1000);

export function predictHybrid(h, a, adjH = 0, adjA = 0) {
  const cfg = DATA.cfg;
  const H = localiaElo(h.alt, a.alt);
  const delta = (h.elo + adjH + H) - (a.elo + adjA);
  const W = eloExpected(cfg.encogimiento * delta);
  const pe = probsFromMatrix(scoreMatrix(cfg.total_goles * W, cfg.total_goles * (1 - W)));
  const lhM = Math.exp(DATA.maher_mu + DATA.maher_gamma + h.att - a.def);
  const laM = Math.exp(DATA.maher_mu + a.att - h.def);
  const pm = probsFromMatrix(scoreMatrix(lhM, laM));
  const b = cfg.blend_hibrido, mix = {};
  for (const k of ["H", "D", "A", "over25", "under25", "btts"]) mix[k] = b * pm[k] + (1 - b) * pe[k];
  const sH = mix.H + mix.D + mix.A; mix.H /= sH; mix.D /= sH; mix.A /= sH;
  return { p: mix, H, W };
}

// Shin (1993): recupera probabilidades reales quitando el margen del libro.
export function shin(odds) {
  const r = odds.map((o) => 1 / o);
  const B = r.reduce((s, x) => s + x, 0);
  const sumP = (z) => r.reduce((s, ri) => s + (Math.sqrt(z * z + 4 * (1 - z) * ri * ri / B) - z) / (2 * (1 - z)), 0);
  let z = 0;
  if (sumP(0) - 1 > 1e-9 && sumP(0.49) - 1 < 0) {
    let lo = 0, hi = 0.49;
    for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if (sumP(m) - 1 > 0) lo = m; else hi = m; z = m; }
  }
  const p = r.map((ri) => (Math.sqrt(z * z + 4 * (1 - z) * ri * ri / B) - z) / (2 * (1 - z)));
  const sp = p.reduce((s, x) => s + x, 0);
  return { p: p.map((x) => x / sp), z, booksum: B };
}
