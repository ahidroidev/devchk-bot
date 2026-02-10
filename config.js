// =============================================================================
//  CONFIGURACIÓN MAESTRA - SOCIETY . E X E
//  Control Global del Bot
// =============================================================================

const Config = {
  // 1. IDENTIDAD Y SISTEMA
  bot: {
    name: "SOCIETY . E X E",
    shortName: "DEVCHK-BOT",
    version: "V3.0",
    devUser: "@devcrackpy",
    botUser: "@societychk_bot",
    engine: "SOCIETY-CORE v3.1",
  },

  // 2. CONTACTO Y DUEÑO
  owner: {
    id: 8477619369,
    username: "devcrackpy",
    supportLink: "https://t.me/devcrackpy",
    channelLink: "https://t.me/society_exe",
  },

  // 3. ECONOMÍA Y PRECIOS
  prices: {
    day: "$3.00 USD",
    week: "$8.00 USD",
    month: "$25.00 USD",
    currency: "USDT / LTC / BTC",
    symbol: "$",
  },

  // 4. ROLES Y JERARQUÍA (Visual)
  roles: {
    owner: "OWNER 👑",
    admin: "ADMIN 👮",
    seller: "SELLER 💰",
    mod: "MOD 🛡️",
    vip: "VIP 💎",
    free: "FREE 👤",
  },

  // 5. DISEÑO VISUAL
  decoration: {
    line: "━━━━━━━━━━━━━━━━━━",
    blockStart: "┏",
    blockEnd: "┗",
    bullet: "├",
    lastBullet: "└",
  },

  // 6. EMOJIS GLOBALES
  emojis: {
    loading: "⏳",
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
    bank: "🏦",
    world: "🌍",
    card: "💳",
    money: "💰",
    user: "👤",
    tech: "📡",
    phone: "📞",
    input: "📥",
    gift: "🎁",
    stats: "📊",
    admin: "🛠️",
    trash: "🗑️",
    key: "🔑",
    shop: "🛒",
    flagDefault: "🏳️",
    // MODERACIÓN
    ban: "🚫",
    unban: "🕊️",
    kick: "🥾",
    mute: "🔇",
    unmute: "🔊",
    shield: "🛡️",
  },

  // 7. TEXTOS PREDEFINIDOS
  text: {
    footer: `✨ <b>Powered by:</b> @devcrackpy`,
    headerStart: `⚡ <b>SOCIETY . E X E</b> ⚡\n<i>"Knowledge is power, access is everything."</i>`,
    loading: `<b>Procesando solicitud en el servidor...</b>`,
    maintenance: `⚠️ <b>Sistema en mantenimiento. Intenta más tarde.</b>`,
    noBalance: `❌ <b>SALDO INSUFICIENTE</b>\n━━━━━━━━━━━━━━━━━━\nNecesitas créditos para usar esta función.`,
    invalidBin: `❌ <b>BIN INVÁLIDO O NO ENCONTRADO</b>`,
    invalidKey: `❌ <b>Key inválida, usada o expirada.</b>`,
    accessDenied: `🚫 <b>ACCESO DENEGADO</b>\nNo tienes permisos suficientes para esta acción.`,
    helpMenu: `📖 <b>CENTRO DE COMANDOS</b>`,
    profile: `👤 <b>PERFIL DE USUARIO</b>`,
    genTitle: `🎲 <b>GENERADOR V3.0</b>`,
    binTitle: `🔍 <b>INSPECCIÓN DE BIN</b>`,
    extraTitle: `📊 <b>EXTRAPOLADOR PRO</b>`,
  },

  // 8. LOGS DE SISTEMA (ESTILOS NUEVOS)
  logs: {
    start: "✅ SISTEMA ONLINE: Core iniciado correctamente.",
    shutdown: "🛑 SISTEMA OFFLINE: Deteniendo procesos...",
    logStyles: {
      command: { emoji: "🎮", title: "COMANDO EJECUTADO" },
      error: { emoji: "🔥", title: "ERROR DE SISTEMA" },
      auth: { emoji: "🛡️", title: "SEGURIDAD / AUTH" },
      system: { emoji: "🖥️", title: "ESTADO DEL CORE" },
      money: { emoji: "💸", title: "TRANSACCIÓN / CRÉDITOS" },
      gen: { emoji: "🎲", title: "GENERACIÓN DE CARDS" },
      bin: { emoji: "🔍", title: "CONSULTA DE BIN" },
      extra: { emoji: "📊", title: "EXTRAPOLACIÓN" },
      mod: { emoji: "⚖️", title: "ACCIÓN DE MODERACIÓN" }, // <--- NUEVO
    },
  },
};

module.exports = Config;
