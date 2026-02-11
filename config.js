require("dotenv").config();

const Config = {
  // 1. INFO DEL PROYECTO
  bot: {
    name: "SOCIETY . E X E",
    shortName: "DEVCHK-BOT",
    version: "V3.0",
    devUser: "@devcrackpy",
    botUser: "@societychk_bot",
    engine: "SOCIETY-CORE v3.0",
  },

  // 2. PROPIETARIO Y SOPORTE (RESTAURADO PARA CALLBACKS.JS)
  owner: {
    id: "6472684724", // Tu ID
    username: "@DevCrackPy",
    supportLink: "https://t.me/DevCrackPy", // <-- ESTO FALTABA Y CAUSABA EL ERROR
  },

  // 3. PRECIOS (RESTAURADO PARA COMANDO /PRICES)
  prices: {
    currency: "USDT/LTC/BTC",
    symbol: "$",
    day: "5 USD",
    week: "20 USD",
    month: "45 USD",
    grpmonth: "350 USD",
  },

  // 4. SISTEMA DE LOGS (CENTRALIZADO)
  logs: {
    enabled: true,
    channels: {
      default: process.env.LOG_CHANNEL_ID,
      lives: process.env.LOG_LIVE_ID || process.env.LOG_CHANNEL_ID,
      errors: process.env.LOG_ERROR_ID || process.env.LOG_CHANNEL_ID,
    },
  },

  // 5. LÍMITES Y COSTOS
  limits: {
    maxCardsPerCheck: 10,
    genLimit: 10,
    spamDelay: 1500,
    costs: {
      checker: 1,
      generator: 0,
      scanner: 1,
    },
  },

  // 6. MÓDULOS (TOGGLES)
  modules: {
    stripe: true,
    braintree: true,
    pasarela: true,
    generator: true,
    binLookup: true,
  },

  // 7. EMOJIS
  emojis: {
    tech: "⚡",
    user: "👤",
    bot: "💎",
    loading: "⏳",
    warning: "⚠️",
    error: "❌",
    success: "✅",
    live: "✅",
    live2: "🟣",
    dead: "❌",
    ccn: "🟡",
    stats: "📊",
    money: "💰",
    card: "💳",
    gate: "🏦",
    tools: "🛠",
    flag: "🏳️",
    input: "🔢",
    bank: "🏛",
    world: "🌍",
    phone: "📱",
    info: "ℹ️",
    key: "🔑",
    admin: "👮‍♂️",
    ban: "🚫",
    unban: "🕊️",
    kick: "🥾",
    mute: "🔇",
    unmute: "🔊",
    shop: "🛒",
    flagDefault: "🏳️",
  },

  // 8. DECORACIÓN
  decoration: {
    line: "━━━━━━━━━━━━━━━━━━",
    separator: "•",
  },

  // 9. ROLES
  roles: {
    owner: "OWNER 👑",
    admin: "ADMIN 👮‍♂️",
    seller: "SELLER 💸",
    vip: "VIP 💎",
    user: "FREE 👤",
    mod: "MOD 🛡️",
  },

  // 10. TEXTOS LEGACY (RESTAURADOS PARA COMPATIBILIDAD CON CALLBACKS.JS)
  text: {
    headerStart: "⚡ <b>SOCIETY BOT V3</b> ⚡",
    helpMenu: "📖 <b>CENTRO DE AYUDA</b>",
    footer: "🔒 <i>Powered by Society Core</i>",
    genTitle: "💳 <b>GENERADOR DE TARJETAS</b>",
    binTitle: "🔍 <b>INFORMACIÓN DE BIN</b>",
    extraTitle: "📊 <b>EXTRAPOLACIÓN</b>",
    invalidBin: "⚠️ <b>BIN INVÁLIDO</b>\nVerifica los datos ingresados.",
    invalidFormat: "⚠️ <b>FORMATO INVÁLIDO</b>",
    crash: "❌ <b>ERROR DE SISTEMA</b>\nIntenta nuevamente.",
    accessDenied: "⛔ <b>ACCESO DENEGADO</b>\nNo tienes permisos suficientes.",
    noBalance: "⚠️ <b>SIN CRÉDITOS</b>\nRecarga tu cuenta para continuar.",
    profile: "👤 <b>PERFIL DE USUARIO</b>",
    error: "❌ Ocurrió un error inesperado.",
    invalidKey: "⚠️ <b>KEY INVÁLIDA</b>\nVerifica e intenta nuevamente.",
  },

  // 11. MENSAJES NUEVOS (PARA EL NUEVO BOT.JS)
  messages: {
    errors: {
      noBalance:
        "⚠️ <b>Saldo Insuficiente.</b>\nRecarga créditos para usar esta herramienta.",
      maintenance:
        "🛠 <b>Mantenimiento.</b>\nMódulo desactivado temporalmente.",
      invalidFormat: "⚠️ <b>Formato Inválido.</b>\nRevisa tus datos.",
      generic: "❌ <b>Error Interno.</b>",
      notAllow: "⛔ <b>Acceso Denegado.</b>",
    },
    checker: {
      wait: "🚀 <b>Iniciando Motor...</b>",
      processing: "⏳ <b>Procesando...</b>",
      finished: "🏁 <b>SESIÓN FINALIZADA</b>",
    },
    scanner: {
      scanning: "🛰 <b>Escaneando Objetivo...</b>",
      resultTitle: "📡 <b>REPORTE DE ESCANEO</b>",
      noGates: "⚠️ No se detectaron pasarelas conocidas.",
    },
  },
};

module.exports = Config;
