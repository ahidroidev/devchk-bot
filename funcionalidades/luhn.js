function valLuhn(tarjeta) {
  let luhn = false;
  let i;
  let contador = 0;
  let anioBin;
  let mesBin;
  let aux = 0;
  let Verificacionexp;
  const fechaActual = new Date();
  const añoActual = fechaActual.getFullYear();
  const mesActual = fechaActual.getMonth() + 1;
  const posiciones = [...tarjeta.matchAll(/\|/g)].map((m) => m.index);
  let cvv = tarjeta.slice(posiciones[2] + 1, tarjeta.length + 1);
  let CC = tarjeta.slice(0, posiciones[0]);
  // First Code Develop By: DevCrackPy
  verificarExp();
  tarjeta = CC + " | " + mesBin + " | " + anioBin + " | " + cvv + "\n";
  return Verificacionexp && luhn ? tarjeta : (tarjeta = "");

  function verificarExp() {
    Verificacionexp = false;
    mesBin = "" + tarjeta.slice(posiciones[0] + 1, posiciones[1]);
    anioBin = "" + tarjeta.slice(posiciones[1] + 1, posiciones[2]);
    if (anioBin > añoActual || (anioBin == añoActual && mesBin > mesActual)) {
      Verificacionexp = true;
      Luhn(CC, contador);
    }

    return Verificacionexp; //First verify dates
  }

  function Luhn(CC, contador) {
    for (i = 0; i < CC.length; i++) {
      aux = parseInt(CC[i]);
      if (i % 2 == CC.length % 2) {
        aux *= 2;
        if (aux > 9) {
          // Verify case two digits
          aux = aux - 9;
        }
        contador = contador + aux;
      } else {
        contador = contador + aux;
      }
    } // End for
    return contador % 10 == 0 ? (luhn = true) : (luhn = false); // luhn Return if luhn is valid or successfull
  }
}

module.exports = valLuhn;
