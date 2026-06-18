// Conversión entre notación americana (moneyline, la de Caliente) y decimal.
// La app trabaja por dentro en decimal/probabilidades; esto solo traduce en los
// bordes (lo que el usuario captura y lo que ve).
//
//   Positiva (+123): apuestas 100 para ganar 123  -> decimal = 1 + A/100
//   Negativa (-253): apuestas 253 para ganar 100  -> decimal = 1 + 100/|A|
//   El valor absoluto de una cuota americana siempre es >= 100.

export function americanToDecimal(a) {
  if (a == null || !isFinite(a)) return NaN;
  if (a >= 100) return 1 + a / 100;
  if (a <= -100) return 1 + 100 / -a;
  return NaN; // |a| < 100 no es una cuota americana válida
}

export function decimalToAmerican(d) {
  if (!(d > 1)) return NaN;
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}

// Interpreta lo que el usuario escribe ("+123", "-253", "150") como número americano.
export function parseAmerican(str) {
  if (str == null) return NaN;
  const s = String(str).trim().replace(/[^0-9+\-.]/g, "");
  if (s === "" || s === "+" || s === "-" || s === ".") return NaN;
  const v = parseFloat(s);
  return isFinite(v) ? v : NaN;
}

// Da formato a un número americano con su signo: 123 -> "+123", -253 -> "-253".
export function fmtAmerican(a) {
  if (!isFinite(a)) return "—";
  const r = Math.round(a);
  return (r > 0 ? "+" : "") + r;
}

// Probabilidad -> cuota justa en americana (para mostrar la "cuota justa" del modelo).
export function fairAmerican(p) {
  if (!(p > 0 && p < 1)) return "—";
  return fmtAmerican(decimalToAmerican(1 / p));
}
