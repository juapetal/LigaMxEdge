// Ratings y configuración calibrada del backtest (maher_ratings.json, 2010–2025).
// Atlante entra en Apertura 2026 con prior provisional (juega en el Azteca/Banorte).
export const DATA = {
  teams: [
    { key: "CF América", name: "América", elo: 1731.7, att: 0.3208, def: 0.365, stadium: "Azteca", city: "Ciudad de México", alt: 2240 },
    { key: "Deportivo Toluca", name: "Toluca", elo: 1728.3, att: 0.3211, def: 0.0643, stadium: "Nemesio Diez", city: "Toluca", alt: 2660 },
    { key: "Cruz Azul", name: "Cruz Azul", elo: 1713.1, att: 0.1614, def: 0.2423, stadium: "C. de los Deportes", city: "Ciudad de México", alt: 2240 },
    { key: "CF Monterrey", name: "Monterrey", elo: 1673.8, att: 0.26, def: 0.2437, stadium: "BBVA", city: "Guadalupe", alt: 500 },
    { key: "UANL Tigres", name: "Tigres", elo: 1646.5, att: 0.1734, def: 0.3479, stadium: "Universitario", city: "San Nicolás", alt: 500 },
    { key: "CF Pachuca", name: "Pachuca", elo: 1578.3, att: 0.2125, def: 0.0811, stadium: "Hidalgo", city: "Pachuca", alt: 2400 },
    { key: "Deportivo Guadalajara", name: "Guadalajara", elo: 1568.2, att: -0.021, def: 0.2533, stadium: "Akron", city: "Zapopan", alt: 1560 },
    { key: "Club Necaxa", name: "Necaxa", elo: 1549.1, att: 0.0767, def: -0.0314, stadium: "Victoria", city: "Aguascalientes", alt: 1880 },
    { key: "Club León", name: "León", elo: 1548.0, att: 0.1595, def: 0.0777, stadium: "Nou Camp", city: "León", alt: 1815 },
    { key: "Pumas UNAM", name: "Pumas", elo: 1539.0, att: 0.081, def: 0.0658, stadium: "Olímpico Universitario", city: "Ciudad de México", alt: 2300 },
    { key: "Club Tijuana", name: "Tijuana", elo: 1517.1, att: 0.0222, def: -0.104, stadium: "Caliente", city: "Tijuana", alt: 30 },
    { key: "Atlético San Luis", name: "Atl. San Luis", elo: 1516.5, att: 0.0784, def: -0.1101, stadium: "Alfonso Lastras", city: "San Luis Potosí", alt: 1860 },
    { key: "Atlas Guadalajara", name: "Atlas", elo: 1474.6, att: -0.0806, def: 0.0249, stadium: "Jalisco", city: "Guadalajara", alt: 1560 },
    { key: "FC Juárez", name: "Juárez", elo: 1465.4, att: -0.1522, def: -0.0979, stadium: "Benito Juárez", city: "Ciudad Juárez", alt: 1130 },
    { key: "Gallos Blancos", name: "Querétaro", elo: 1458.7, att: -0.1465, def: -0.038, stadium: "Corregidora", city: "Querétaro", alt: 1820 },
    { key: "Atlante", name: "Atlante", elo: 1400, att: -0.15, def: -0.12, stadium: "Banorte (Azteca)", city: "Ciudad de México", alt: 2240, provisional: true },
    { key: "Puebla FC", name: "Puebla", elo: 1356.3, att: -0.0565, def: -0.0888, stadium: "Cuauhtémoc", city: "Puebla", alt: 2135 },
    { key: "Santos Laguna", name: "Santos", elo: 1341.4, att: 0.0983, def: -0.0897, stadium: "Corona", city: "Torreón", alt: 1120 },
  ],
  maher_mu: 0.11583,
  maher_gamma: 0.26219,
  cfg: { encogimiento: 0.9, localia_H: 38.3277, localia_k_alt: 41.7597, blend_hibrido: 0.5, total_goles: 2.64 },
};

export const CAP = 0.015; // tope duro 1.5% del bankroll por apuesta
