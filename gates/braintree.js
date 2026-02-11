// gates/braintree.js
const braintree = require("braintree");
require("dotenv").config();

const gateway = new braintree.BraintreeGateway({
  // CAMBIA A .Production si vas a usar tus llaves reales
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

async function check(cc, mes, anio, cvv) {
  try {
    // PASO SENIOR: Crear un cliente temporal con la tarjeta
    // Esto dispara la verificación automática sin errores de "ID inválido"
    const result = await gateway.customer.create({
      firstName: "Society",
      lastName: "User",
      creditCard: {
        number: cc,
        expirationMonth: mes,
        expirationYear: anio,
        cvv: cvv,
        options: {
          verifyCard: true, // Esto hace el test real con el banco
        },
      },
    });

    if (result.success) {
      const verification = result.customer.creditCards[0].verification;
      return {
        status: "LIVE",
        msg: `Verified: ${verification.processorResponseText} ✅`,
        gate: "Braintree Senior",
        code: verification.processorResponseCode,
      };
    } else {
      // Capturamos la verificación incluso si falló el "success"
      const verification =
        result.verification ||
        (result.customer ? result.customer.creditCards[0].verification : null);
      const code = verification ? verification.processorResponseCode : "N/A";
      const errorMsg = result.message || "Declined";

      // 1. Fondos Insuficientes (LIVE) -> Código 2001
      if (
        code === "2001" ||
        errorMsg.toLowerCase().includes("insufficient funds")
      ) {
        return {
          status: "LIVE",
          msg: "Insufficient Funds 💰",
          gate: "Braintree Senior",
          code: code,
        };
      }

      // 2. CVC Incorrecto (CCN) -> Código 2000 + check de texto
      if (
        errorMsg.toLowerCase().includes("cvv") ||
        errorMsg.toLowerCase().includes("cvc")
      ) {
        return {
          status: "CCN",
          msg: "Incorrect CVC ☑️",
          gate: "Braintree Senior",
          code: code,
        };
      }

      // 3. Muerta Real
      return {
        status: "DEAD",
        msg: `${errorMsg} [${code}]`,
        gate: "Braintree Senior",
        code: code,
      };
    }
  } catch (err) {
    // Si sale el error de "test number", es que estás en Sandbox con una CC real
    if (err.message.includes("not an accepted test number")) {
      return {
        status: "DEAD",
        msg: "ERROR: Usando CC Real en entorno Sandbox ⚠️",
        gate: "Braintree Senior",
        code: "env_error",
      };
    }
    return {
      status: "DEAD",
      msg: `Error: ${err.message}`,
      gate: "Braintree Senior",
      code: "crash",
    };
  }
}

module.exports = { check };
