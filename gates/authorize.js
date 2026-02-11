// gates/authorize.js
const axios = require("axios");
const qs = require("qs");
require("dotenv").config();

async function check(cc, mes, anio, cvv) {
  // 1. Cargamos la LLAVE SECRETA (Fundamental para validación real)
  const SECRET_KEY = process.env.STRIPE_SK;

  if (!SECRET_KEY || !SECRET_KEY.startsWith("sk_")) {
    return {
      status: "DEAD",
      msg: "Error: No Stripe SK (Secret Key) configured.",
      gate: "Stripe Senior Auth",
      code: "500",
    };
  }

  try {
    // --- PASO 1: CREAR PAYMENT METHOD ---
    // Esto transforma los datos de la CC en un objeto de pago seguro.
    const pmData = qs.stringify({
      type: "card",
      "card[number]": cc,
      "card[exp_month]": mes,
      "card[exp_year]": anio,
      "card[cvc]": cvv,
    });

    const pmResponse = await axios.post(
      "https://api.stripe.com/v1/payment_methods",
      pmData,
      {
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const pmId = pmResponse.data.id;

    // --- PASO 2: INTENTAR AUTORIZACIÓN (El test de vida real) ---
    // Creamos un PaymentIntent de $1.00 USD con confirmación inmediata.
    // Al poner 'confirm: true', Stripe contacta al banco emisor en tiempo real.
    const piData = qs.stringify({
      amount: 100, // $1.00 USD (Puedes bajarlo a 50 para $0.50)
      currency: "usd",
      payment_method: pmId,
      confirm: "true",
      off_session: "true", // Indica que el cliente no está presente
    });

    const piResponse = await axios.post(
      "https://api.stripe.com/v1/payment_intents",
      piData,
      {
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    // Si llegamos aquí, la tarjeta tiene fondos y está activa.
    if (piResponse.data.status === "succeeded") {
      return {
        status: "LIVE",
        msg: "Charged $1.00 Succeeded ✅",
        gate: "Stripe Senior Auth",
        code: "success",
      };
    }

    return {
      status: "LIVE",
      msg: `Status: ${piResponse.data.status}`,
      gate: "Stripe Senior Auth",
      code: "unknown",
    };
  } catch (error) {
    const err = error.response ? error.response.data.error : error;
    const code = err.code || "unknown_error";
    const decline = err.decline_code || "no_decline_code";
    const msg = err.message || "Error en la transacción";

    // --- LÓGICA DE FILTRADO REAL ---

    // 1. Fondos Insuficientes (Es LIVE porque la tarjeta existe y el banco respondió)
    if (code === "insufficient_funds" || decline === "insufficient_funds") {
      return {
        status: "LIVE",
        msg: "Insufficient Funds 💰",
        gate: "Stripe Senior Auth",
        code: "funds",
      };
    }

    // 2. CVC Incorrecto (Es CCN - La tarjeta vive pero el código falló)
    if (code === "incorrect_cvc" || decline === "incorrect_cvc") {
      return {
        status: "CCN",
        msg: "Incorrect CVC (Live Card) ☑️",
        gate: "Stripe Senior Auth",
        code: "cvc",
      };
    }

    // 3. Autenticación Requerida (SCA - Es LIVE, solo pide 3D Secure)
    if (
      code === "authentication_required" ||
      decline === "authentication_required"
    ) {
      return {
        status: "LIVE",
        msg: "3D Secure Required (Authentication) 🔐",
        gate: "Stripe Senior Auth",
        code: "sca",
      };
    }

    // 4. Muertas reales (Bloqueadas, Expiradas, Perdidas, Fraude)
    return {
      status: "DEAD",
      msg: `${msg} [${decline}]`,
      gate: "Stripe Senior Auth",
      code: decline,
    };
  }
}

module.exports = { check };
