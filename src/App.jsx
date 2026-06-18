import { useState, useEffect, useMemo } from "react";
import { DATA, CAP } from "./data.js";
import { predictHybrid, shin } from "./model.js";
import { initAuth, login, logout } from "./auth.js";
import { loadBets, saveBets, loadOdds } from "./api.js";
import { americanToDecimal, decimalToAmerican, parseAmerican, fmtAmerican, fairAmerican } from "./oddsFormat.js";

const pct = (x) => (x * 100).toFixed(1) + "%";
const money = (x) => "$" + (Math.round(x * 100) / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const initials = (s) => (s || "?").split("@")[0].slice(0, 2).toUpperCase();
// cuota americana mostrada a partir de un registro (compatibilidad con decimales viejos)
const betAmerican = (b) => fmtAmerican(b.oddsAmerican != null ? b.oddsAmerican : decimalToAmerican(b.odds));
const teamName = (key) => { const t = DATA.teams.find((x) => x.key === key); return t ? t.name : key; };
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return iso; }
};

function AltGauge({ home, away, loc }) {
  const max = 2700, hh = Math.max(7, (home.alt / max) * 72), ha = Math.max(7, (away.alt / max) * 72);
  return (
    <div className="gauge">
      <div className="vs">VS</div>
      <svg width="120" height="84" viewBox="0 0 120 84" aria-label="Perfil de altitud">
        <line x1="8" y1="78" x2="112" y2="78" stroke="var(--line2)" strokeWidth="1.5" />
        <rect x="24" y={78 - hh} width="24" height={hh} rx="3" fill="var(--flood)" opacity="0.9" />
        <rect x="72" y={78 - ha} width="24" height={ha} rx="3" fill="var(--chalk-2)" opacity="0.6" />
        <text x="36" y={73 - hh} fill="var(--flood)" fontSize="10" textAnchor="middle" fontFamily="IBM Plex Mono">{home.alt}</text>
        <text x="84" y={73 - ha} fill="var(--chalk-2)" fontSize="10" textAnchor="middle" fontFamily="IBM Plex Mono">{away.alt}</text>
        <text x="36" y="88" fill="var(--chalk-3)" fontSize="9.5" textAnchor="middle">local</text>
        <text x="84" y="88" fill="var(--chalk-3)" fontSize="9.5" textAnchor="middle">visita</text>
      </svg>
      <div className="loc">+{loc.toFixed(1)}</div>
      <div className="loclbl">Elo localía</div>
    </div>
  );
}

export default function App() {
  const [homeKey, setHomeKey] = useState("Atlante");
  const [awayKey, setAwayKey] = useState("CF Monterrey");
  const [adjH, setAdjH] = useState(0);
  const [adjA, setAdjA] = useState(0);
  const [bankroll, setBankroll] = useState(1000);
  const [kf, setKf] = useState(0.25);
  const [thr, setThr] = useState(0.02);
  const [odds, setOdds] = useState({ H: "", D: "", A: "", over25: "", under25: "", btts: "" });

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [bets, setBets] = useState([]);
  const [betsLoading, setBetsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState(false);

  // cuotas en vivo
  const [oddsMatches, setOddsMatches] = useState(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [oddsErr, setOddsErr] = useState("");
  const [oddsRemaining, setOddsRemaining] = useState(null);
  const [oddsCached, setOddsCached] = useState(false);

  useEffect(() => {
    const u = initAuth((usr) => setUser(usr));
    if (u) setUser(u);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!user) { setBets([]); setBetsLoading(false); return; }
    setBetsLoading(true);
    loadBets().then((b) => setBets(b)).catch(() => setBets([])).finally(() => setBetsLoading(false));
  }, [user]);

  const persist = async (next) => {
    setBets(next);
    if (!user) return;
    setSyncing(true); setSyncErr(false);
    try { await saveBets(next); } catch (e) { setSyncErr(true); } finally { setSyncing(false); }
  };

  const fetchOdds = async () => {
    setOddsLoading(true); setOddsErr("");
    try {
      const data = await loadOdds();
      setOddsMatches(data.matches || []);
      setOddsRemaining(data.remaining ?? null);
      setOddsCached(!!data.cached);
    } catch (e) {
      setOddsErr(String(e.message || e));
      setOddsMatches(null);
    } finally { setOddsLoading(false); }
  };

  const useMatch = (m) => {
    if (!m.homeKey || !m.awayKey) return;
    setHomeKey(m.homeKey); setAwayKey(m.awayKey);
    setAdjH(0); setAdjA(0);
    setOdds({
      H: fmtAmerican(m.best.home.price), D: fmtAmerican(m.best.draw.price), A: fmtAmerican(m.best.away.price),
      over25: "", under25: "", btts: "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const home = useMemo(() => DATA.teams.find((t) => t.key === homeKey), [homeKey]);
  const away = useMemo(() => DATA.teams.find((t) => t.key === awayKey), [awayKey]);
  const same = homeKey === awayKey;
  const pred = useMemo(() => (same ? null : predictHybrid(home, away, adjH, adjA)), [home, away, adjH, adjA, same]);
  const shin1x2 = useMemo(() => {
    const o = [odds.H, odds.D, odds.A].map((x) => americanToDecimal(parseAmerican(x)));
    return o.every((x) => x > 1) ? shin(o) : null;
  }, [odds]);

  const MARKETS = [
    { key: "H", label: home ? "Gana " + home.name : "Local", short: "1" },
    { key: "D", label: "Empate", short: "X" },
    { key: "A", label: away ? "Gana " + away.name : "Visita", short: "2" },
    { key: "over25", label: "Más de 2.5 goles", short: "O2.5" },
    { key: "under25", label: "Menos de 2.5 goles", short: "U2.5" },
    { key: "btts", label: "Ambos anotan", short: "BTTS" },
  ];
  const rows = MARKETS.map((m) => {
    const aNum = parseAmerican(odds[m.key]);     // cuota americana capturada
    const o = americanToDecimal(aNum);           // su equivalente decimal (interno)
    const pModel = pred ? pred.p[m.key] : 0;
    const valid = o > 1 && pred;
    const value = valid ? pModel * o - 1 : null;
    const b = o - 1;
    const fstar = valid ? pModel - (1 - pModel) / b : 0;
    const stakePct = Math.min(Math.max(0, fstar) * kf, CAP);
    const isValue = valid && value >= thr && fstar > 0;
    const implausible = valid && value > 0.25;
    let marketFair = null;
    if (["H", "D", "A"].includes(m.key) && shin1x2) marketFair = shin1x2.p[{ H: 0, D: 1, A: 2 }[m.key]];
    return { ...m, aNum, o, pModel, value, fstar, stakePct, isValue, implausible, marketFair };
  });
  const recos = rows.filter((r) => r.isValue);
  const anyImplausible = rows.some((r) => r.implausible);

  const addBet = (r) => {
    if (!user) { login(); return; }
    persist([{
      id: Date.now() + "_" + r.key, ts: new Date().toISOString().slice(0, 10),
      match: home.name + " v " + away.name, sel: r.label, short: r.short,
      odds: r.o, oddsAmerican: r.aNum, pModel: r.pModel, value: r.value,
      stakePct: r.stakePct, stake: r.stakePct * bankroll, bankroll,
      closing: null, closingAmerican: null, clv: null,
    }, ...bets]);
  };
  const setClosing = (id, val) => {
    const cA = parseAmerican(val);
    const cDec = americanToDecimal(cA);
    persist(bets.map((b) => b.id === id
      ? { ...b, closing: cDec > 1 ? cDec : null, closingAmerican: isFinite(cA) ? cA : null, clv: cDec > 1 ? (b.odds / cDec - 1) * 100 : null }
      : b));
  };
  const delBet = (id) => persist(bets.filter((b) => b.id !== id));

  const settled = bets.filter((b) => b.clv !== null);
  const avgClv = settled.length ? settled.reduce((s, b) => s + b.clv, 0) / settled.length : null;
  const beatClose = settled.length ? settled.filter((b) => b.clv > 0).length / settled.length : null;
  const totalStake = bets.reduce((s, b) => s + b.stake, 0);

  return (
    <div className="lmx">
      <div className="accountbar">
        <div className="inner">
          <div className="brandmark"><span className="dot" />Liga MX · Valor</div>
          {!authReady ? <span /> : user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="avatar">{initials(user.email)}</span>
              <span className="acctname">{user.email}</span>
              <button className="logoutbtn" onClick={logout}>Salir</button>
            </div>
          ) : (
            <button className="loginbtn" onClick={login}>Iniciar sesión</button>
          )}
        </div>
      </div>

      <div className="max">
        <header>
          <p className="eyebrow">Liga MX · Apertura 2026</p>
          <h1>Detector de valor</h1>
          <p className="sub">Modelo híbrido Elo + Maher con corrección Dixon-Coles, calibrado sobre 4,965 partidos (2010–2025). El encogimiento (0.90) y la localía por altitud se fijaron por backtest.</p>
          <div className="topchips">
            <span className="chip">Brier 1X2 <b>0.6118</b></span>
            <span className="chip">encogimiento <b>0.90</b></span>
            <span className="chip">localía <b>altitud</b></span>
            <span className="chip">cuotas <b>americana (Caliente)</b></span>
          </div>
        </header>

        <section className="panel" style={{ marginTop: 20 }}>
          <p className="ptitle">Cuotas en vivo · Liga MX{oddsRemaining != null ? <span className="syncing">· {oddsRemaining} consultas restantes este mes</span> : null}</p>
          {!user ? (
            <div className="gate"><p>Inicia sesión para cargar cuotas reales de Liga MX y detectar valor automáticamente.</p><button className="loginbtn" onClick={login}>Iniciar sesión</button></div>
          ) : (
            <>
              <button className="loadbtn" onClick={fetchOdds} disabled={oddsLoading}>{oddsLoading ? "Cargando cuotas…" : "Cargar partidos de Liga MX"}</button>
              {oddsErr && <div className="warn"><span>⚠</span><span>{oddsErr}</span></div>}
              {oddsMatches != null && oddsMatches.length === 0 && !oddsErr && (
                <div className="nodata">No hay partidos de Liga MX con cuotas ahora mismo. El Apertura 2026 arranca tras el Mundial; vuelve cuando haya jornada programada.</div>
              )}
              {oddsMatches != null && oddsMatches.length > 0 && (
                <>
                  <div className="oddslist">
                    {oddsMatches.map((m) => {
                      const ok = m.homeKey && m.awayKey;
                      return (
                        <div className="oddsmatch" key={m.id}>
                          <div>
                            <div className="om-name">{m.homeKey ? teamName(m.homeKey) : m.homeRaw} <span className="om-vs">vs</span> {m.awayKey ? teamName(m.awayKey) : m.awayRaw}</div>
                            <div className="om-meta">{fmtDate(m.commence_time)} · mejor de {m.books} casas{!ok ? " · equipo no reconocido" : ""}</div>
                          </div>
                          <div className="om-odds mono">{fmtAmerican(m.best.home.price)} / {fmtAmerican(m.best.draw.price)} / {fmtAmerican(m.best.away.price)}</div>
                          <button className="reg" disabled={!ok} onClick={() => useMatch(m)}>{ok ? "Usar" : "—"}</button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="footnote">Se carga la <b>mejor</b> cuota disponible por resultado (en americana){oddsCached ? " · desde cache (~10 min)" : ""}. Ajústala a tu línea de Caliente antes de registrar si difiere.</div>
                </>
              )}
            </>
          )}
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <p className="ptitle">Partido</p>
          <div className="match">
            <div className="side">
              <label>Local</label>
              <select value={homeKey} onChange={(e) => setHomeKey(e.target.value)}>
                {DATA.teams.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
              <div className="stats">
                <span className="stat">Elo <b>{(home.elo + adjH).toFixed(0)}</b></span>
                <span className="stat">ataque <b>{home.att >= 0 ? "+" : ""}{home.att.toFixed(2)}</b></span>
                <span className="stat">defensa <b>{home.def >= 0 ? "+" : ""}{home.def.toFixed(2)}</b></span>
              </div>
              <div className="where">{home.stadium} · {home.city} · {home.alt} m</div>
              {home.provisional && <div className="prov">rating provisional · sin datos recientes de Primera</div>}
            </div>
            {pred ? <AltGauge home={home} away={away} loc={pred.H} /> : <div className="gauge"><div className="vs">VS</div><div className="loclbl" style={{ marginTop: 10 }}>elige dos<br />equipos</div></div>}
            <div className="side">
              <label>Visitante</label>
              <select value={awayKey} onChange={(e) => setAwayKey(e.target.value)}>
                {DATA.teams.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
              <div className="stats">
                <span className="stat">Elo <b>{(away.elo + adjA).toFixed(0)}</b></span>
                <span className="stat">ataque <b>{away.att >= 0 ? "+" : ""}{away.att.toFixed(2)}</b></span>
                <span className="stat">defensa <b>{away.def >= 0 ? "+" : ""}{away.def.toFixed(2)}</b></span>
              </div>
              <div className="where">{away.stadium} · {away.city} · {away.alt} m</div>
              {away.provisional && <div className="prov">rating provisional · sin datos recientes de Primera</div>}
            </div>
          </div>
          {same && <div className="warn"><span>⚠</span><span>Elige dos equipos distintos.</span></div>}
          <div className="ctxgrid" style={{ marginTop: 20 }}>
            <div className="ctx">
              <label><span>Ajuste local · forma / bajas</span><b>{adjH >= 0 ? "+" : ""}{adjH} Elo</b></label>
              <input type="range" min="-80" max="80" step="5" value={adjH} onChange={(e) => setAdjH(+e.target.value)} />
            </div>
            <div className="ctx">
              <label><span>Ajuste visitante · forma / bajas</span><b>{adjA >= 0 ? "+" : ""}{adjA} Elo</b></label>
              <input type="range" min="-80" max="80" step="5" value={adjA} onChange={(e) => setAdjA(+e.target.value)} />
            </div>
          </div>
          {(adjH !== 0 || adjA !== 0) && <button className="linkbtn" onClick={() => { setAdjH(0); setAdjA(0); }}>restablecer ajustes</button>}
        </section>

        {pred && (
          <section className="panel">
            <p className="ptitle">Probabilidades del modelo</p>
            {(home.provisional || away.provisional) && (
              <div className="warn info"><span>◆</span><span><b>Rating provisional en juego ({[home, away].filter((t) => t.provisional).map((t) => t.name).join(", ")}).</b> Equipo recién llegado a Primera sin datos recientes; su fuerza es un prior conservador. La mitad Elo se afina en ~6–10 partidos; la mitad Maher, hasta el reajuste del próximo torneo. Trata estas probabilidades como orientativas.</span></div>
            )}
            <div className="bar">
              <div className="seg segH" style={{ flexGrow: pred.p.H }}><span className="sp">{pct(pred.p.H)}</span><span className="sl">{home.name}</span></div>
              <div className="seg segD" style={{ flexGrow: pred.p.D }}><span className="sp">{pct(pred.p.D)}</span><span className="sl">Empate</span></div>
              <div className="seg segA" style={{ flexGrow: pred.p.A }}><span className="sp">{pct(pred.p.A)}</span><span className="sl">{away.name}</span></div>
            </div>
            <div className="oddsrow">
              <div className="ocell"><div className="k">Cuota justa 1</div><div className="v">{fairAmerican(pred.p.H)}</div></div>
              <div className="ocell"><div className="k">Cuota justa X</div><div className="v">{fairAmerican(pred.p.D)}</div></div>
              <div className="ocell"><div className="k">Cuota justa 2</div><div className="v">{fairAmerican(pred.p.A)}</div></div>
            </div>
            <div className="twocol">
              <div className="mini">
                <div className="mt">Goles · línea 2.5</div>
                <div className="mr"><span>Más de 2.5</span><span className="mono">{pct(pred.p.over25)} · {fairAmerican(pred.p.over25)}</span></div>
                <div className="mr"><span>Menos de 2.5</span><span className="mono">{pct(pred.p.under25)} · {fairAmerican(pred.p.under25)}</span></div>
              </div>
              <div className="mini">
                <div className="mt">Ambos anotan</div>
                <div className="mr"><span>Sí (BTTS)</span><span className="mono">{pct(pred.p.btts)} · {fairAmerican(pred.p.btts)}</span></div>
                <div className="mr"><span>No</span><span className="mono">{pct(1 - pred.p.btts)} · {fairAmerican(1 - pred.p.btts)}</span></div>
              </div>
            </div>
          </section>
        )}

        {pred && (
          <section className="panel">
            <p className="ptitle">Cuotas del mercado · valor</p>
            <div className="mhead"><span>Selección</span><span>Cuota</span><span>Mercado*</span><span>Valor</span></div>
            {rows.map((r) => (
              <div className="market" key={r.key}>
                <div>
                  <div className="sel">{r.label}</div>
                  <div className="modp">modelo {pct(r.pModel)}{r.marketFair != null ? " · mercado " + pct(r.marketFair) : ""}</div>
                </div>
                <input className="oin" inputMode="text" placeholder="+150 / -200" value={odds[r.key]} onChange={(e) => setOdds({ ...odds, [r.key]: e.target.value })} />
                <div className="mfair">{r.marketFair != null ? fairAmerican(r.marketFair) : (["H", "D", "A"].includes(r.key) ? "···" : "—")}</div>
                <div className="valbox">
                  {r.value == null ? <span className="vneg">—</span> : <span className={r.isValue ? "vpos" : "vneg"}>{r.value >= 0 ? "+" : ""}{(r.value * 100).toFixed(1)}%</span>}
                  {r.isValue && !r.implausible && <button className="reg" onClick={() => addBet(r)}>Registrar</button>}
                </div>
              </div>
            ))}
            <div className="footnote">Cuotas en formato americano (Caliente): +150 paga 150 por 100, −200 arriesga 200 por 100. * "Mercado" = probabilidad real con de-margen de Shin sobre las 3 cuotas 1X2.</div>
            {anyImplausible && <div className="warn"><span>⚠</span><span><b>Valor inverosímil (&gt;25%).</b> Casi siempre es una cuota mal capturada o un límite del modelo, no ventaja real. El backtest mostró sobreconfianza justo en favoritos fuertes. No se sugiere apuesta hasta verificar.</span></div>}
          </section>
        )}

        {pred && (
          <section className="panel">
            <p className="ptitle">Stake · Kelly fraccional</p>
            <div className="stakegrid">
              <div className="field"><label>Bankroll</label><input inputMode="decimal" value={bankroll} onChange={(e) => setBankroll(Math.max(0, +e.target.value || 0))} /></div>
              <div className="field"><label>Fracción Kelly</label><div className="toggle">{[0.25, 0.5, 1].map((v) => <button key={v} className={kf === v ? "on" : ""} onClick={() => setKf(v)}>{v === 1 ? "1×" : v + "×"}</button>)}</div></div>
              <div className="field"><label>Umbral de valor</label><div className="toggle">{[0.02, 0.03, 0.05].map((v) => <button key={v} className={thr === v ? "on" : ""} onClick={() => setThr(v)}>{(v * 100).toFixed(0)}%</button>)}</div></div>
            </div>
            {kf === 1 && <div className="warn"><span>⚠</span><span><b>Kelly completo.</b> Maximiza crecimiento pero con varianza brutal; una mala racha vacía el bankroll. El sistema recomienda fracciones de 0.25–0.5.</span></div>}
            <div className="recos">
              {recos.length === 0 && <div className="nodata">Ninguna selección supera el umbral de valor con las cuotas actuales. Sin valor, no se apuesta.</div>}
              {recos.map((r) => {
                const capped = Math.max(0, r.fstar) * kf > CAP;
                return (
                  <div className={"reco" + (capped ? " capped" : "")} key={r.key}>
                    <div>
                      <div className="rsel">{r.label}</div>
                      <div className="rmeta">cuota {fmtAmerican(r.aNum)} · valor +{(r.value * 100).toFixed(1)}% · Kelly* {(r.fstar * 100).toFixed(1)}%{capped ? " · topado a 1.5%" : ""}</div>
                    </div>
                    <div><div className="rstake">{money(r.stakePct * bankroll)}</div><div className="rstakelbl">{(r.stakePct * 100).toFixed(2)}% bankroll</div></div>
                    <button className="reg" onClick={() => addBet(r)}>Registrar</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="panel">
          <p className="ptitle">Registro{user ? " · " + user.email.split("@")[0] : ""} · seguimiento de CLV{syncing ? <span className="syncing">guardando…</span> : null}</p>
          {!user ? (
            <div className="gate">
              <p>Inicia sesión para guardar tu registro de apuestas y seguir tu CLV. Cada miembro de tu familia tiene su propio registro privado.</p>
              <button className="loginbtn" onClick={login}>Iniciar sesión o registrarse</button>
            </div>
          ) : betsLoading ? (
            <div className="nodata">Cargando registro…</div>
          ) : (
            <>
              <div className="summary">
                <div className="scard"><div className="sv">{bets.length}</div><div className="sk">apuestas</div></div>
                <div className="scard"><div className="sv">{settled.length}</div><div className="sk">con cierre</div></div>
                <div className="scard"><div className={"sv " + (avgClv == null ? "" : avgClv >= 0 ? "pos" : "neg")}>{avgClv == null ? "—" : (avgClv >= 0 ? "+" : "") + avgClv.toFixed(2) + "%"}</div><div className="sk">CLV medio</div></div>
                <div className="scard"><div className={"sv " + (beatClose == null ? "" : beatClose >= 0.5 ? "pos" : "neg")}>{beatClose == null ? "—" : (beatClose * 100).toFixed(0) + "%"}</div><div className="sk">venció al cierre</div></div>
              </div>
              {bets.length === 0 ? (
                <div className="nodata">Aún no hay apuestas. Cuando una selección muestre valor, pulsa "Registrar" para anotarla y luego captura la cuota de cierre (americana) para medir tu CLV.</div>
              ) : (
                <>
                  <div className="bethead"><span>Apuesta</span><span>Cuota</span><span>Cierre</span><span>CLV</span></div>
                  {bets.map((b) => (
                    <div className="bet" key={b.id}>
                      <div><div className="bm">{b.short} · {b.sel}</div><div className="bmeta">{b.ts} · {b.match} · {money(b.stake)} ({(b.stakePct * 100).toFixed(2)}%)</div></div>
                      <div className="mono">{betAmerican(b)}</div>
                      <input className="clvin" inputMode="text" placeholder="+150" defaultValue={b.closingAmerican != null ? fmtAmerican(b.closingAmerican) : (b.closing != null ? fmtAmerican(decimalToAmerican(b.closing)) : "")} onBlur={(e) => setClosing(b.id, e.target.value)} />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <span className={"clvtag " + (b.clv == null ? "" : b.clv >= 0 ? "pos" : "neg")}>{b.clv == null ? "—" : (b.clv >= 0 ? "+" : "") + b.clv.toFixed(1) + "%"}</span>
                        <button className="del" onClick={() => delBet(b.id)} title="Eliminar">×</button>
                      </div>
                    </div>
                  ))}
                  <div className="footnote">Total apostado: {money(totalStake)} · CLV = cuota tomada ÷ cuota de cierre − 1 (en decimal equivalente; positivo = venciste al cierre).</div>
                </>
              )}
              {syncErr && <div className="warn"><span>⚠</span><span>No se pudo guardar el último cambio en el servidor. Revisa tu conexión; tus cambios siguen en pantalla pero podrían no persistir.</span></div>}
            </>
          )}
        </section>

        <p className="note">
          <b>Cómo leerlo.</b> El modelo da su probabilidad; tú capturas la cuota de Caliente (americana); el valor es cuánto te paga de más respecto a lo que el modelo cree (valor = prob × cuota − 1, calculado en decimal por dentro). Solo se sugiere apostar por encima del umbral, con Kelly fraccional y tope duro de 1.5% del bankroll. El de-margen de Shin te dice qué piensa de verdad el mercado, para distinguir si tu ventaja viene del margen del libro o de un desacuerdo real con la línea.<br /><br />
          <b>Disciplina.</b> El 1X2 está validado por backtest; el mercado de goles es informativo hasta incorporar xG. La métrica que importa no es ganar la apuesta de hoy sino el CLV sostenido. Apuesta en papel hasta acumular CLV positivo. Esto no es consejo financiero.
        </p>
      </div>
    </div>
  );
}
