function Generador(comando) {
  const fechaActual = new Date();
  let anioActual = fechaActual.getFullYear();
  let BIN = comando.replace(/[^\d,"x","X",\|]/g, "|");
  let listaGen = "";
  let i;
  BIN = completar(BIN);
  let x = "";
  const posiciones = [...BIN.matchAll(/\|/g)].map((m) => m.index);
  let digitos = BIN.slice(0, posiciones[0]);
  let mes = BIN.slice(posiciones[0] + 1, posiciones[1]);
  if (mes < 0 || mes > 12 || mes == "")
    return "He was admitted for a month as an invalid.";
  if (mes.length == 1) {
    mes = "0" + mes;
  }

  let anio = BIN.slice(posiciones[1] + 1, posiciones[2]);
  if (anio.length == 2) {
    anio = "20" + anio;
  }

  if (anio == "" || anio.length == 1 || anio.length == 3 || anio.length > 4)
    return "He was admitted for a year as an invalid.";
  let cvv = BIN.slice(posiciones[2] + 1, BIN.length + 1);
  cvv = ArregCvvc(BIN, cvv);
  let generador = digitos + "|" + mes + "|" + anio + "|" + cvv;
  if (generador.length < 28) {
    const faltante = 28 - generador.length;
    for (i = 0; i < faltante; i++) {
      x += "x";
    }
  }

  generador = digitos + x + "|" + mes + "|" + anio + "|" + cvv;
  if (generador.length > 28)
    return "Invalid BIN. Correct format:\n CC|MM|YYYY|CVV";
  digitos = generador.slice(0, generador.indexOf("|"));
  listaGen = "点 BIN --»" + generador + "\n═══════════════════════════\n";
  for (let j = 0; j <= 10; j++) {
    const anioGen = AnioGen(anio, anioActual);
    const mesGen = MesGen(mes);
    const cvvGen = CvvGen(cvv);
    const ccGen = TarjetaGen(digitos);
    listaGen +=
      ccGen + " | " + mesGen + " | " + anioGen + " | " + cvvGen + "\n";
  }

  return listaGen;
}
module.exports = Generador;

function completar(BIN) {
  let contadorCar = 0;
  for (let i = 0; i < 28; i++) {
    if (["|", "-", "+"].includes(BIN[i])) {
      contadorCar += 1;
    }
  }

  switch (contadorCar) {
    case 0:
      if (BIN[0] == 3) {
        BIN += "|xx|xxxx|xxxx";
      } else {
        BIN += "|xx|xxxx|xxx";
      }
      break;
    case 1:
      if (BIN[0] == 3) {
        if (["|"].includes(BIN[BIN.length - 1])) {
          BIN += "xx|xxxx|xxxx";
        } else {
          BIN += "|xxxx|xxxx";
        }
      } else if (["|"].includes(BIN[BIN.length - 1])) {
        BIN += "xx|xxxx|xxx";
      } else {
        BIN += "|xxxx|xxx";
      }
      break;
    case 2:
      if (BIN[0] == 3) {
        if (["|"].includes(BIN[BIN.length - 1])) {
          BIN += "xxxx|xxxx";
        } else {
          BIN += "|xxxx";
        }
      } else if (["|"].includes(BIN[BIN.length - 1])) {
        BIN += "xxxx|xxx";
      } else {
        BIN += "|xxx";
      }
      break;
    case 3:
      if (BIN[0] == 3 && ["|", "-", "+"].includes(BIN[BIN.length - 1])) {
        BIN += "xxxx";
      } else if (BIN[0] != 3 && ["|", "-", "+"].includes(BIN[BIN.length - 1])) {
        BIN += "xxx";
      }
      break;
  }
  return BIN;
}

function AnioGen(anio, anioActual) {
  let anioGen;
  if (anio == "xxxx" || anio == "XXXX") {
    anioGen = Math.floor(
      Math.random() * (parseInt(anioActual) + 7 - parseInt(anioActual)) +
        parseInt(anioActual),
    );
  } else {
    anioGen = anio;
  }
  return anioGen;
}

function MesGen(mes) {
  let mesGen;
  if (mes == "XX" || mes == "xx") {
    const numeroGen = Math.floor(Math.random() * (12 - 1) + 1);
    if (numeroGen < 10) {
      mesGen = "0" + numeroGen;
    } else {
      mesGen = numeroGen + "";
    }
  } else {
    mesGen = mes;
  }

  return mesGen;
}

function CvvGen(cvv) {
  let i;
  let cvvGen = "";
  for (i = 0; i < cvv.length; i++) {
    if (cvv[i] == "x" || cvv[i] == "X") {
      cvvGen += Math.floor(Math.random() * 10);
    } else {
      cvvGen += cvv[i];
    }
  }

  return cvvGen;
}

function TarjetaGen(digitos) {
  let aux = 0;
  let i;
  let ccGen = "";
  let digito;
  let suma = 0;
  for (i = 0; i < digitos.length - 1; i++) {
    if (digitos[i] == "x" || digitos[i] == "X") {
      digito = Math.floor(Math.random() * 10);
    } else {
      digito = digitos[i];
    }

    aux = digito;
    if (i % 2 == digitos.length % 2) {
      aux *= 2;
      if (aux > 9) {
        aux -= 9;
      }
    }

    suma += parseInt(aux);
    ccGen += digito;
  }

  const digitoF = (10 - (suma % 10)) % 10;
  ccGen += digitoF;
  return ccGen;
}

function ArregCvvc(BIN, cvv) {
  let falta;
  let i;
  switch (BIN[0]) {
    case "3":
      if (cvv.length > 4) {
        cvv = cvv.slice(0, 4);
      } else if (cvv.length < 4) {
        falta = 4 - cvv.length;
        for (i = 0; i < falta; i++) {
          cvv += "x";
        }
      }
      break;
    default:
      if (cvv.length > 3) {
        cvv = cvv.slice(0, 3);
      } else if (cvv.length) {
        falta = 3 - cvv.length;
        for (i = 0; i < falta; i++) {
          cvv += "x";
        }
      }
      break;
  }

  return cvv;
}
