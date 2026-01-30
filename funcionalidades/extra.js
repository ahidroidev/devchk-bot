function extra(CC) {
  const fechaActual = new Date();
  let tarjeta;
  let lista = "";
  let anioActual = fechaActual.getFullYear();
  let txt;
  const posiciones = [...CC.matchAll(/\|/g)].map((m) => m.index);
  if (posiciones.length > 0) {
    tarjeta = CC.slice(0, posiciones[0]);
  } else {
    tarjeta = CC;
  }
  if (CC.length < 15) return "You have input a valid card.";
  for (let i = 0; i <= 10; i++) {
    lista += genBin(tarjeta) + "" + genFecha() + "\n";
  }

  return lista;

  function genFecha() {
    const anioGen = Math.floor(
      Math.random() * (parseInt(anioActual) + 7 - parseInt(anioActual)) +
        parseInt(anioActual),
    );
    const mesGen = Math.floor(Math.random() * (12 - 1) + 1);
    return mesGen < 10
      ? " | 0" + mesGen + " | " + anioGen
      : " | " + mesGen + " | " + anioGen;
  }

  function genBin(tarjeta) {
    txt = tarjeta.slice(0, 7);
    for (let i = 7; i < tarjeta.length - 4; i++) {
      const digito = Math.floor(Math.random() * 10);
      txt += digito;
    }
    txt += "xxxx";
    return txt;
  }
}

module.exports = extra;
