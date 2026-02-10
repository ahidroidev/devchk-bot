function extra(CC) {
  const fechaActual = new Date();
  const anioActual = fechaActual.getFullYear();
  let tarjeta;

  // 1. Extraer solo el número (limpiar si viene con pipes)
  const posiciones = [...CC.matchAll(/\|/g)].map((m) => m.index);
  tarjeta =
    posiciones.length > 0
      ? CC.slice(0, posiciones[0]).replace(/\s/g, "")
      : CC.replace(/\s/g, "");

  // 2. Validación técnica: Un BIN mínimo requiere 6 dígitos
  if (tarjeta.length < 6) return "⚠️ Error: BIN muy corto.";

  let lista = "";
  for (let i = 0; i < 10; i++) {
    lista += genBin(tarjeta) + genFecha() + "\n";
  }

  return lista.trim();

  // --- Funciones Internas Optimizadas ---

  function genFecha() {
    // Genera entre el año actual y 7 años a futuro
    const anioGen = Math.floor(Math.random() * 8) + anioActual;
    const mesGen = Math.floor(Math.random() * 12) + 1;
    const mesFormateado = mesGen < 10 ? "0" + mesGen : mesGen;
    return `|${mesFormateado}|${anioGen}`;
  }

  function genBin(t) {
    let txt = t.substring(0, 8); // Respetamos los primeros 8 (Standard BIN)

    // Si la tarjeta es corta (BIN), rellenamos hasta 12 y ponemos xxxx
    if (t.length <= 12) {
      while (txt.length < 12) {
        txt += Math.floor(Math.random() * 10);
      }
      txt += "xxxx";
    } else {
      // Si pasó una CC completa, extrapolamos el medio y respetamos el final
      const last4 = t.slice(-4);
      while (txt.length < 12) {
        txt += Math.floor(Math.random() * 10);
      }
      txt += last4;
    }
    return txt;
  }
}

module.exports = extra;
