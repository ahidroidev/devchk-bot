// funcionalidades/tools.js

// Extrae TODAS las tarjetas de un texto (Máximo 10)
function parseCards(text) {
  if (!text) return [];

  // Regex global para capturar todas las coincidencias
  const regex =
    /(\d{15,16})[\s|/:-]+(\d{1,2})[\s|/:-]+(\d{2,4})[\s|/:-]+(\d{3,4})/g;
  const matches = [...text.matchAll(regex)];

  // Mapeamos los resultados a objetos limpios
  const cards = matches.map((m) => {
    let [_, cc, mes, anio, cvv] = m;
    // Normalizar año (28 -> 2028)
    if (anio.length === 2) anio = "20" + anio;

    return {
      cc,
      mes,
      anio,
      cvv,
      full: `${cc}|${mes}|${anio}|${cvv}`,
      mask: `${cc.slice(0, 6)}xxxxxx${cc.slice(-4)}`, // Para mostrar oculto
    };
  });

  // Limitamos a 10 para evitar abuso
  return cards.slice(0, 10);
}

module.exports = { parseCards };
