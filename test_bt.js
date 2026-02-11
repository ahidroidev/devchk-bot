const braintree = require("braintree");
require("dotenv").config();

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox, // O Sandbox
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

gateway.clientToken.generate({}, (err, response) => {
  if (err) {
    console.error("❌ ERROR DE AUTENTICACIÓN:", err.message);
  } else {
    console.log("✅ CONEXIÓN EXITOSA: Token generado correctamente.");
  }
});
