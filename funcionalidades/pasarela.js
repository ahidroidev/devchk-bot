// funcionalidades/pasarela.js
const axios = require("axios");

// ==========================================
// 1. BASES DE DATOS (FIRMAS)
// ==========================================
const GATEWAYS = {
  STRIPE: [
    "stripe.com",
    "stripe.js",
    "__stripe_",
    "var stripe",
    "stripe_key",
    "wc_stripe_params",
  ],
  PAYPAL: [
    "paypal.com",
    "paypal-checkout",
    "paypal_objects",
    "fpdbs.paypal",
    "mock:paypal",
  ],
  BRAINTREE: ["braintree", "braintreegateway", "braintree-web"],
  "SHOPIFY PAYMENTS": [
    "shopify_pay",
    "shopify-payment-request",
    "shopify_payments",
  ],
  "WOO PAYMENTS": ["wc-ajax", "woocommerce_params", "wc-payment-method"],
  MERCADOPAGO: ["mercadopago", "sdk.mercadopago", "mercadolibre.com", "mp3.js"],
  ADYEN: ["adyen", "adyen.com", "adyen-implementation"],
  CYBERSOURCE: ["cybersource", "cybersource.com", "flex-microform"],
  "AUTHORIZE.NET": ["authorize.net", "anet", "accept.js"],
  SQUARE: ["squareup", "sq-payment", "square.js"],
  PAYU: ["payu", "payu.com", "payulatam", "payu_checkout"],
  "VTEX PAY": ["vtex", "vtexid", "vtex-payment", "vtex.js"],
  "CHECKOUT.COM": ["checkout.com", "cko-", "checkout-web-components"],
  EWAY: ["eway", "eway-pay"],
  "2CHECKOUT": ["2checkout", "2co.com"],
  KLARNA: ["klarna", "klarna.com", "klarna-checkout"],
  AFTERPAY: ["afterpay", "afterpay.com"],
  PAYMENTWALL: ["paymentwall", "pw_widgets"],
  OPENPAY: ["openpay", "openpay.js"],
  CONEKTA: ["conekta", "conekta.js"],
  WOMPI: ["wompi", "wompi.co", "wompi_widget"],
  EPAYCO: ["epayco", "epayco.co", "epayco-checkout"],
  DLOCAL: ["dlocal", "dlocal.com"],
  REDSYS: ["redsys", "sis.redsys.es"],
  PAGSEGURO: ["pagseguro", "pagseguro.uol"],
  CULQI: ["culqi", "culqi.com"],
  IZIPAY: ["izipay", "kr-payment-form"],
  "STRIPE (Embed)": ["r.stripe.com", "m.stripe.com"],
};

const CMS_SIGNATURES = {
  Shopify: ["shopify", "cdn.shopify.com", "shopify.theme"],
  WooCommerce: ["wp-content/plugins/woocommerce", "woocommerce-general"],
  Magento: ["magento", "mage/cookies", "varien/js"],
  PrestaShop: ["prestashop", "prestashop-sitemap"],
  VTEX: ["vtex", "vteximg", "vtex assets"],
  Wix: ["wix.com", "wix-code", "wix-apps"],
  BigCommerce: ["bigcommerce", "cdn11.bigcommerce"],
  Jumpseller: ["jumpseller"],
};

// Rutas comunes donde se esconden los pagos
const COMMON_PATHS = [
  "/checkout",
  "/cart",
  "/basket",
  "/pagar",
  "/compra",
  "/carrito",
];

// ==========================================
// 2. FUNCIÓN DE ESCANEO INDIVIDUAL
// ==========================================
async function scanUrl(url) {
  try {
    const response = await axios.get(url, {
      timeout: 8000, // 8 seg max por intento
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Cache-Control": "no-cache",
      },
      maxRedirects: 5,
      validateStatus: false,
    });

    const html = JSON.stringify(response.data).toLowerCase();
    const headers = JSON.stringify(response.headers).toLowerCase();

    let found = [];
    let cms = null;
    let protection = [];

    // CMS
    for (const [c, k] of Object.entries(CMS_SIGNATURES)) {
      if (k.some((key) => html.includes(key))) {
        cms = c;
        break;
      }
    }

    // GATEWAYS
    for (const [g, k] of Object.entries(GATEWAYS)) {
      if (k.some((key) => html.includes(key) || headers.includes(key))) {
        found.push(g);
      }
    }

    // PROTECCIONES
    if (html.includes("cloudflare")) protection.push("Cloudflare");
    if (html.includes("recaptcha")) protection.push("Captcha");

    return {
      success: true,
      url,
      gateways: found,
      cms,
      protection,
      status: response.status,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==========================================
// 3. MOTOR PRINCIPAL (HUNTER MODE)
// ==========================================
async function detectarPasarela(urlInput) {
  let baseUrl = urlInput.trim();
  if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;

  // Limpiamos la URL de basura (como lo de googleusercontent)
  try {
    const urlObj = new URL(baseUrl);
    baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (e) {}

  // 1. Escaneo del HOME
  let result = await scanUrl(baseUrl);

  // Si encontramos algo en el home, retornamos de una.
  if (result.success && result.gateways.length > 0) {
    return formatResult(result);
  }

  // 2. MODO CAZADOR: Si el home está limpio, buscamos en /checkout, /cart, etc.
  if (result.success) {
    // console.log("🔍 Home limpio. Activando Hunter Mode...");

    for (const path of COMMON_PATHS) {
      const hunterUrl = baseUrl + path;
      const hunterResult = await scanUrl(hunterUrl);

      // Si encontramos algo aquí, Bingo!
      if (hunterResult.success && hunterResult.gateways.length > 0) {
        // Fusionamos la info del CMS del home con el Gateway del checkout
        hunterResult.cms = result.cms || hunterResult.cms;
        return formatResult(hunterResult);
      }
    }
  }

  // 3. INFERENCIA FINAL (Si después de buscar en todo lado no hay nada)
  if (result.success && result.gateways.length === 0) {
    if (result.cms === "Shopify")
      result.gateways.push("SHOPIFY PAYMENTS (Probable)");
    if (result.cms === "VTEX") result.gateways.push("VTEX PAY (Nativa)");
    if (result.cms === "Wix") result.gateways.push("WIX PAYMENTS (Nativa)");
    if (result.cms === "WooCommerce")
      result.gateways.push("WOO PAYMENTS / PAYPAL (Default)");
  }

  if (result.success && result.gateways.length === 0) {
    result.gateways.push("⚠️ Oculta / Redirección Externa");
  }

  return formatResult(result);
}

function formatResult(r) {
  if (!r.success) return { success: false, error: r.error };
  return {
    success: true,
    url: r.url,
    gateways: [...new Set(r.gateways)],
    cms: r.cms || "Custom / Desconocido",
    protection:
      r.protection && r.protection.length > 0
        ? r.protection.join(", ")
        : "Ninguna visible",
    status: r.status,
  };
}

module.exports = detectarPasarela;
