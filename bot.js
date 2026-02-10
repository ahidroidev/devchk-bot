// Importaciones y Configuración Inicial
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");

// CEREBRO GLOBAL
const Config = require("./config.js");

// SISTEMA DE LOGS V3
const Logger = require("./funcionalidades/logger.js");

// Imports Locales
const Auth = require("./funcionalidades/auth.js");
const Generador = require("./funcionalidades/generador.js");
const valLuhn = require("./funcionalidades/luhn.js");
const extra = require("./funcionalidades/extra.js");
const consultarBIN = require("./funcionalidades/bin.js");
const CreditsManager = require("./database/credits.js");

// Alias para mantener compatibilidad
const Credits = CreditsManager;

// --- Inicializamos el bot ---
const Token = process.env.BOT_TOKEN;
if (!Token) throw new Error("Falta BOT_TOKEN en las variables de entorno.");
const bot = new Telegraf(Token);

// === INICIALIZAMOS EL LOGGER ===
Logger.init(bot);

// --- Variables globales y utilidades ---
const userState = {};

//=============================
// --- FUNCIONES AUXILIARES ---
//=============================
const tempReply = async (ctx, text, seconds = 5) => {
  try {
    const msg = await ctx.replyWithHTML(text);
    setTimeout(() => {
      ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    }, seconds * 1000);
  } catch (err) {}
};

function generarTarjeta(bin) {
  return Generador(bin);
}

const getUserProfile = (userId, firstName) => {
  const staffData = Auth.authData.users[userId];
  const vipData = Auth.authData.commonUsers[userId];
  const isAdmin = userId === Auth.ADMIN_ID;
  const userCredits = Credits.get(userId);

  let info = `${Config.text.profile}\n`;
  info += `${Config.decoration.line}\n`;
  info += `${Config.emojis.user} <b>Nombre:</b> <code>${firstName}</code>\n`;
  info += `🆔 <b>ID:</b> <code>${userId}</code>\n`;

  let rangoText = Config.roles.free;
  if (isAdmin) rangoText = Config.roles.owner;
  else if (staffData) {
    const r = staffData.rango.toLowerCase();
    rangoText = Config.roles[r] || `STAFF [${staffData.rango}]`;
  } else if (vipData) rangoText = Config.roles.vip;

  info += `🎖️ <b>Rango:</b> <code>${rangoText}</code>\n`;
  info += `${Config.decoration.line}\n\n`;

  if (isAdmin || staffData) {
    info += `📦 <b>Caja Chica:</b> <code>${staffData?.limit || "∞"}</code>\n`;
    info += `📊 <b>Estado:</b> <code>Operativo</code>\n`;
    info += `${Config.emojis.money} <b>Saldo Personal:</b> <code>${userCredits}</code>\n`;
  } else if (vipData) {
    const rest = vipData.expiration - Date.now();
    if (rest > 0) {
      const days = Math.floor(rest / (1000 * 60 * 60 * 24));
      info += `${Config.emojis.money} <b>Créditos:</b> <code>${userCredits}</code>\n`;
      info += `⏳ <b>Vence en:</b> <code>${days} días</code>\n`;
      info += `📅 <b>Expiración:</b> <code>${new Date(vipData.expiration).toLocaleDateString()}</code>\n`;
    } else {
      info += `${Config.emojis.warning} <b>Suscripción:</b> <code>Vencida</code>\n`;
    }
  } else {
    info += `${Config.emojis.money} <b>Créditos:</b> <code>${userCredits}</code>\n`;
    info += `${Config.emojis.warning} <b>Acceso:</b> <code>Limitado</code>\n`;
  }

  return info;
};

// ============================
// --- Middlewares Security ---
// ============================
bot.use(Auth.authMiddleware);

// ============================
// --- Manejador de Texto ---
// ============================
bot.on("text", async (ctx, next) => {
  const uid = ctx.from.id;
  const state = userState[ctx.from.id];

  // 1. Si es un comando, dejamos que pase al siguiente middleware
  if (ctx.message.text.startsWith("/")) return next();

  // 2. Si el usuario no está esperando nada, ignoramos
  if (!state || state.step !== "WAITING_ID") return next();

  const input = ctx.message.text.trim();

  // --- FIX: DETECTAR CANCELAR ---
  if (input.toLowerCase() === "cancelar") {
    delete userState[uid];
    return ctx.replyWithHTML(
      `🚫 <b>Operación cancelada.</b>\nUsa /config para volver al menú.`,
    );
  }

  // --- FIX: VALIDAR NUMEROS ---
  // Si estamos esperando un ID de usuario (Staff/Creds) y mandan texto, error.
  if (["STAFF", "CRED"].includes(state.type) && !/^\d+$/.test(input)) {
    return ctx.replyWithHTML(
      `⚠️ <b>Error:</b> El ID debe ser numérico.\nIntenta de nuevo o escribe "cancelar".`,
    );
  }

  const type = state.type;
  let buttons = [];
  let text = "";

  if (type === "STAFF") {
    text = `${Config.emojis.admin} <b>GESTIÓN DE STAFF</b>\n🆔 ID: <code>${input}</code>`;
    buttons = [
      [Markup.button.callback("🎖️ ASIGNAR RANGO", `CONF_STAFF_${input}`)],
      [Markup.button.callback("🗑️ REVOCAR STAFF", `REV_ALL_${input}`)],
    ];
  } else if (type === "CRED") {
    text = `${Config.emojis.money} <b>GESTIÓN DE CRÉDITOS</b>\n🆔 ID: <code>${input}</code>`;
    buttons = [
      [Markup.button.callback("➕ AÑADIR CRÉDITOS", `CONF_CRED_${input}`)],
      [Markup.button.callback("➖ REVOCAR TODO", `REV_ALL_${input}`)],
    ];
  } else if (type === "GRP") {
    text = `👥 <b>GESTIÓN DE GRUPO</b>\n🆔 GID: <code>${input}</code>`;
    buttons = [
      [Markup.button.callback("✅ AUTORIZAR", `CONF_GRP_${input}`)],
      [Markup.button.callback("🚫 REVOCAR", `REV_GRP_${input}`)],
    ];
  } else if (type === "KEYS") {
    text = `${Config.emojis.key} <b>GESTIÓN DE KEY</b>\n<code>${input}</code>`;
    buttons = [
      [Markup.button.callback("✅ CONFIRMAR", `CONF_KEY_${input}`)],
      [Markup.button.callback("❌ ELIMINAR", `REV_KEY_${input}`)],
    ];
  }

  buttons.push([
    Markup.button.callback("🔙 VOLVER AL MENÚ", "BACK_TO_MAIN_CONFIG"),
  ]);

  await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));

  // OJO: Borramos el estado AQUÍ para que el bot deje de escuchar texto
  // y solo espere el clic del botón.
  delete userState[uid];
});

// ==========================================
// --- MÓDULO DE MODERACIÓN (BAN/KICK) ---
// ==========================================

// Helper para validar permisos matemáticos
const checkModPerms = (ctx, targetId) => {
  const issuerId = ctx.from.id;
  const issuerRole = Auth.getRole(issuerId);

  // 1. Validar Rango Mínimo (MOD)
  if (!["OWNER", "ADMIN", "MOD"].includes(issuerRole)) {
    ctx.replyWithHTML(Config.text.accessDenied);
    return false;
  }

  // 2. Validar Jerarquía (Admin no banea Admin, Mod no banea Seller)
  if (!Auth.canManage(issuerId, targetId)) {
    ctx.replyWithHTML(
      `🛡️ <b>JERARQUÍA PROTEGIDA</b>\nNo tienes rango suficiente para sancionar a este usuario.`,
    );
    return false;
  }
  return true;
};

bot.command("ban", async (ctx) => {
  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  const reason = args.slice(2).join(" ") || "Violación de reglas";

  if (!targetId) return ctx.reply("⚠️ Uso: /ban [ID] [RAZÓN]");
  if (!checkModPerms(ctx, targetId)) return;

  try {
    // 1. Banear de DB (Global)
    Auth.banUserDB(targetId, reason);

    // 2. Banear del Grupo (Si aplica)
    if (ctx.chat.type !== "private") {
      await ctx
        .banChatMember(targetId)
        .catch((e) => console.log("Error ban chat:", e.message));
    }

    await ctx.replyWithHTML(
      `${Config.emojis.ban} <b>USUARIO BANEADO</b>\n` +
        `${Config.decoration.line}\n` +
        `👤 <b>ID:</b> <code>${targetId}</code>\n` +
        `📝 <b>Razón:</b> ${reason}\n` +
        `👮 <b>Staff:</b> ${ctx.from.first_name}`,
    );

    Logger.log(
      "mod",
      ctx,
      `🚫 <b>BANHAMMER</b>\nTarget: ${targetId}\nRazón: ${reason}`,
    );
  } catch (e) {
    ctx.reply("❌ Error técnico al banear.");
  }
});

bot.command("unban", async (ctx) => {
  const targetId = ctx.message.text.split(" ")[1];
  if (!targetId) return ctx.reply("⚠️ Uso: /unban [ID]");

  // Solo Owner/Admin
  const role = Auth.getRole(ctx.from.id);
  if (!["OWNER", "ADMIN"].includes(role))
    return ctx.reply(Config.text.accessDenied);

  Auth.unbanUserDB(targetId);

  if (ctx.chat.type !== "private") {
    await ctx.unbanChatMember(targetId).catch(() => {});
  }

  await ctx.replyWithHTML(
    `${Config.emojis.unban} <b>USUARIO DESBANEADO</b>\nID: <code>${targetId}</code>`,
  );
  Logger.log("mod", ctx, `🕊️ <b>UNBAN</b>\nTarget: ${targetId}`);
});

bot.command("kick", async (ctx) => {
  const targetId = ctx.message.text.split(" ")[1];
  if (!targetId) return ctx.reply("⚠️ Uso: /kick [ID]");
  if (!checkModPerms(ctx, targetId)) return;

  if (ctx.chat.type === "private") return ctx.reply("⚠️ Solo en grupos.");

  try {
    await ctx.banChatMember(targetId);
    await ctx.unbanChatMember(targetId);

    ctx.replyWithHTML(
      `${Config.emojis.kick} <b>USUARIO EXPULSADO</b>\nID: <code>${targetId}</code>`,
    );
    Logger.log("mod", ctx, `🥾 <b>KICK</b>\nTarget: ${targetId}`);
  } catch (e) {
    ctx.reply("❌ Error: El bot necesita ser Admin del grupo.");
  }
});

bot.command("mute", async (ctx) => {
  const targetId = ctx.message.text.split(" ")[1];
  if (!targetId) return ctx.reply("⚠️ Uso: /mute [ID]");
  if (!checkModPerms(ctx, targetId)) return;

  if (ctx.chat.type === "private") return ctx.reply("⚠️ Solo en grupos.");

  try {
    await ctx.restrictChatMember(targetId, {
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
      },
    });

    ctx.replyWithHTML(
      `${Config.emojis.mute} <b>USUARIO SILENCIADO</b>\nID: <code>${targetId}</code>`,
    );
    Logger.log("mod", ctx, `🔇 <b>MUTE</b>\nTarget: ${targetId}`);
  } catch (e) {
    ctx.reply("❌ Error de permisos.");
  }
});

bot.command("unmute", async (ctx) => {
  const targetId = ctx.message.text.split(" ")[1];
  if (!targetId) return ctx.reply("⚠️ Uso: /unmute [ID]");
  if (!checkModPerms(ctx, targetId)) return;

  try {
    await ctx.restrictChatMember(targetId, {
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
      },
    });

    ctx.replyWithHTML(
      `${Config.emojis.unmute} <b>SILENCIO REVOCADO</b>\nID: <code>${targetId}</code>`,
    );
    Logger.log("mod", ctx, `🔊 <b>UNMUTE</b>\nTarget: ${targetId}`);
  } catch (e) {
    ctx.reply("❌ Error técnico.");
  }
});

// ==========================================
// --- MÓDULO ADMINISTRATIVO (JERARQUÍA) ---
// ==========================================

bot.command("auth", async (ctx) => {
  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);

  // 1. NIVEL DE PERMISO: Solo OWNER y ADMIN contratan
  if (!["OWNER", "ADMIN"].includes(userRole)) {
    return ctx.replyWithHTML(
      `${Config.text.accessDenied}\nNecesitas ser <b>ADMIN</b> o <b>OWNER</b>.`,
    );
  }

  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  const rango = args[2]?.toUpperCase();

  if (!targetId || !["ADMIN", "SELLER", "MOD"].includes(rango)) {
    return ctx.replyWithHTML(
      `${Config.emojis.warning} <b>Uso:</b> <code>/auth [ID] [RANGO]</code>\n<i>Rangos: ADMIN, SELLER, MOD</i>`,
    );
  }

  // 2. PROTECCIÓN: Admin no crea otro Admin
  if (userRole === "ADMIN" && rango === "ADMIN") {
    return ctx.reply(
      "❌ Los Administradores solo pueden crear SELLERS y MODS.",
    );
  }

  const userChat = await ctx.telegram
    .getChat(targetId)
    .catch(() => ({ first_name: "Usuario" }));
  const fullName =
    `${userChat.first_name || ""} ${userChat.last_name || ""}`.trim();

  Auth.authorize(targetId, rango, fullName);

  await ctx.replyWithHTML(
    `${Config.emojis.admin} <b>STAFF ASIGNADO</b>\n${Config.decoration.line}\n👤 <b>Nombre:</b> <code>${fullName}</code>\n🎖️ <b>Rango:</b> <code>${rango}</code>\n🆔 <b>ID:</b> <code>${targetId}</code>\n${Config.emojis.success} <i>Registrado correctamente.</i>`,
  );

  Logger.log(
    "auth",
    ctx,
    `🛡️ <b>AUTH</b>\nTarget: ${targetId}\nRango: ${rango}`,
  );
});

bot.command("unauth", async (ctx) => {
  const userId = ctx.from.id;
  const targetId = ctx.message.text.split(" ")[1];
  if (!targetId)
    return ctx.replyWithHTML("⚠️ <b>Uso:</b> <code>/unauth [ID]</code>");

  // Verificar jerarquía antes de despedir
  if (!Auth.canManage(userId, targetId)) {
    return ctx.replyWithHTML(
      `🚫 <b>ACCESO DENEGADO</b>\nNo tienes rango para remover a este usuario.`,
    );
  }

  const userInDb = Auth.authData.users[targetId];
  const nombreCualquiera = userInDb ? userInDb.name : targetId;
  Auth.unauthorize(targetId);

  await ctx.replyWithHTML(
    `🛡️ <b>RANGO REVOCADO</b>\n${Config.decoration.line}\n👤 <b>Usuario:</b> <code>${nombreCualquiera}</code>\n🆔 <b>ID:</b> <code>${targetId}</code>\n⚠️ <i>Acceso eliminado.</i>`,
  );
  Logger.log("auth", ctx, `🗑️ <b>UNAUTH</b>\nTarget: ${targetId}`);
});

bot.command("addcredits", async (ctx) => {
  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);

  if (!["OWNER", "ADMIN", "SELLER"].includes(userRole)) {
    return ctx.replyWithHTML(
      `${Config.text.accessDenied}\nLos <b>MODS</b> no gestionan economía.`,
    );
  }

  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  const amount = parseInt(args[2]);

  if (!targetId || isNaN(amount))
    return ctx.reply("⚠️ Uso: /addcredits [ID] [CANTIDAD]");

  // AQUI PASAMOS EL userId DEL OPERADOR PARA EL TRACKING
  const newBalance = Credits.add(targetId, amount, userId);

  await ctx.replyWithHTML(
    `${Config.emojis.money} <b>RECARGA EXITOSA</b>\n${Config.decoration.line}\n👤 <b>Cliente:</b> <code>${targetId}</code>\n💰 <b>Monto:</b> +${amount}\n📈 <b>Total:</b> ${newBalance}`,
  );
  Logger.log(
    "money",
    ctx,
    `💸 <b>VENTA</b>\nSeller: ${userId}\nCliente: ${targetId}\nMonto: ${amount}`,
  );
});

bot.command("genkey", async (ctx) => {
  const userRole = Auth.getRole(ctx.from.id);
  // MOD no genera keys
  if (!["OWNER", "ADMIN", "SELLER"].includes(userRole))
    return ctx.reply(Config.text.accessDenied);

  const durationArg = ctx.message.text.split(" ")[1] || "1d";
  if (!["1d", "1w", "1m"].includes(durationArg))
    return ctx.reply("⚠️ Uso: /genkey [1d/1w/1m]");

  const newKey = Auth.generateKey(durationArg);
  await ctx.replyWithHTML(
    `${Config.emojis.key} <b>KEY GENERADA</b>\n<code>${newKey}</code>\n⏳ <b>Duración:</b> ${durationArg}`,
  );
  Logger.log(
    "auth",
    ctx,
    `🔑 <b>GEN KEY</b>\nStaff: ${ctx.from.id}\nKey: ${newKey}`,
  );
});

// ======================
// --- COMANDOS GENERALES ---
// ======================

bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;

  const profileInfo = getUserProfile(userId, firstName);
  const staffData = Auth.authData.users[userId];
  const vipData = Auth.authData.commonUsers[userId];
  const isAdmin = userId === Auth.ADMIN_ID;

  let buttons = [];

  if (isAdmin) {
    buttons = [
      [
        Markup.button.callback(
          "🛠️ CONFIGURACIÓN GLOBAL",
          "BACK_TO_MAIN_CONFIG",
        ),
      ],
      [Markup.button.callback("👮 PANEL DE STAFF", "HELP_STAFF")],
      [Markup.button.callback("🚀 HERRAMIENTAS VIP", "BACK_HELP")],
      [Markup.button.callback("🔙 Volver", "BACK_TO_START")],
    ];
  } else if (staffData) {
    const iconRango = staffData.rango === "ADMIN" ? "👮" : "💰";
    buttons = [
      [
        Markup.button.callback(
          `${iconRango} COMANDOS ${staffData.rango}`,
          "HELP_STAFF",
        ),
      ],
      [Markup.button.callback("🚀 HERRAMIENTAS VIP", "BACK_HELP")],
      [Markup.button.callback("👤 VER MI ESTADO", "SHOW_PROFILE")],
      [Markup.button.callback("🔙 Volver", "BACK_TO_START")],
    ];
  } else if (vipData && Date.now() < vipData.expiration) {
    buttons = [
      [Markup.button.callback("💎 ACCESO VIP", "BACK_HELP")],
      [Markup.button.callback("👤 MI SUSCRIPCIÓN", "SHOW_PROFILE")],
      [Markup.button.callback("🔙 Volver", "BACK_TO_START")],
    ];
  } else {
    buttons = [
      [Markup.button.callback("💎 ADQUIRIR VIP", "SHOW_PRICES")],
      [Markup.button.callback("📚 GUÍA DE USO", "BACK_HELP")],
      [Markup.button.callback("🔙 Volver", "BACK_TO_START")],
      [Markup.button.url("👨‍💻 CONTACTAR SOPORTE", Config.owner.supportLink)],
    ];
  }

  Logger.log("system", ctx, `🚀 <b>Inicio:</b> /start`);

  const header =
    `${Config.text.headerStart}\n\n` +
    `🚀 <b>CHECKER ${Config.bot.version}</b>\n` +
    `${Config.decoration.line}\n` +
    `El validador más rápido y preciso del mercado. Optimizado para profesionales.\n\n` +
    `${Config.emojis.info} <b>FEATURES:</b>\n` +
    `├ ⚡ <b>Ultra-Speed:</b> Motor multi-hilo.\n` +
    `├ 🛡️ <b>Anti-Ban:</b> Proxies residenciales.\n` +
    `├ 🎯 <b>High Precision:</b> Gateway directo.\n` +
    `└ 💎 <b>Soporte 24/7:</b> Update constante.\n` +
    `${Config.decoration.line}`;

  await ctx.replyWithHTML(
    `${header}\n${profileInfo}`,
    Markup.inlineKeyboard(buttons),
  );
});

bot.command("me", async (ctx) => {
  try {
    const profile = getUserProfile(ctx.from.id, ctx.from.first_name);
    await ctx.replyWithHTML(
      profile,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Actualizar", "SHOW_PROFILE")],
        [Markup.button.callback("🔙 Volver", "BACK_TO_START")],
      ]),
    );
  } catch (err) {
    ctx.reply(Config.text.error + " Ocurrió un error.");
  }
});

bot.command("id", (ctx) => {
  const user = ctx.from;
  const idMessage =
    `${Config.emojis.user} <b>INFORMACIÓN DE USUARIO</b>\n` +
    `${Config.decoration.line}\n` +
    `📝 <b>Nombre:</b> <code>${user.first_name}</code>\n` +
    `🏷️ <b>Username:</b> <code>@${user.username || "Sin alias"}</code>\n` +
    `🆔 <b>ID:</b> <code>${user.id}</code>\n` +
    `${Config.decoration.line}`;
  ctx.replyWithHTML(idMessage);
});

bot.command(["info", "help", "ayuda"], async (ctx) => {
  const helpMenu =
    `${Config.text.helpMenu}\n` +
    `${Config.decoration.line}\n\n` +
    `🛠 <b>BÁSICOS:</b>\n├ <code>/start</code>\n├ <code>/me</code>\n└ <code>/id</code>\n\n` +
    `🚀 <b>VIP:</b>\n├ <code>/gen</code>\n├ <code>/bin</code>\n└ <code>/ex</code>\n\n` +
    `${Config.decoration.line}\n` +
    `${Config.text.footer}`;

  await ctx.replyWithHTML(
    helpMenu,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("💳 GENERADOR", "HELP_GEN"),
        Markup.button.callback("🔑 KEYS", "HELP_KEYS"),
      ],
      [
        Markup.button.callback("📊 EXTRAPOLAR", "HELP_EXTRA"),
        Markup.button.url("🛒 COMPRAR", Config.owner.supportLink),
      ],
    ]),
  );
});

bot.command("redeem", async (ctx) => {
  const key = ctx.message.text.split(" ")[1];
  if (!key)
    return ctx.replyWithHTML(
      `${Config.emojis.key} <b>SISTEMA DE KEYS</b>\n${Config.decoration.line}\n⚠️ <b>Uso:</b> <code>/redeem KEY-XXXX</code>\n${Config.decoration.line}`,
    );

  const expiryDate = Auth.redeemKey(
    ctx.from.id,
    key,
    ctx.from.first_name,
    ctx.from.last_name || "",
  );

  if (expiryDate) {
    await ctx.replyWithHTML(
      `${Config.emojis.success} <b>¡ACCESO ACTIVADO!</b>\n${Config.decoration.line}\n${Config.emojis.user} <b>User:</b> <code>${ctx.from.first_name}</code>\n📅 <b>Expira:</b> <code>${expiryDate}</code>\n${Config.decoration.line}`,
    );
    Logger.log(
      "auth",
      ctx,
      `🔑 <b>KEY ACTIVADA</b>\n🗝️ <b>Key:</b> <code>${key}</code>`,
    );
    bot.telegram
      .sendMessage(
        Auth.ADMIN_ID,
        `🔔 El usuario <code>${ctx.from.id}</code> activó una Key.`,
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  } else {
    ctx.replyWithHTML(Config.text.invalidKey);
    Logger.log(
      "auth",
      ctx,
      `🚫 <b>KEY FALLIDA</b>\n🗝️ <b>Intento:</b> <code>${key}</code>`,
    );
  }
});

bot.command("prices", (ctx) => {
  const pricesMessage =
    `${Config.emojis.card} <b>TARIFAS PREMIUM</b>\n` +
    `${Config.decoration.line}\n\n` +
    `🔵 <b>DIARIO:</b> <code>${Config.prices.day}</code>\n` +
    `🟢 <b>SEMANAL:</b> <code>${Config.prices.week}</code>\n` +
    `🔴 <b>MENSUAL:</b> <code>${Config.prices.month}</code>\n\n` +
    `<i>Pagos en: ${Config.prices.currency}</i>\n` +
    `${Config.decoration.line}`;

  ctx.replyWithHTML(
    pricesMessage,
    Markup.inlineKeyboard([
      [
        Markup.button.url("🛒 Comprar Ahora", Config.owner.supportLink),
        Markup.button.callback("🔑 Canjear Key", "SHOW_PRICES"),
      ],
    ]),
  );
});

bot.command(["credits", "saldo", "money", "creditos"], async (ctx) => {
  const userCredits = Credits.get(ctx.from.id);
  const creditsMsg =
    `${Config.emojis.money} <b>MI BILLETERA</b>\n` +
    `${Config.decoration.line}\n` +
    `${Config.emojis.user} <b>Usuario:</b> <code>${ctx.from.first_name}</code>\n` +
    `📈 <b>Saldo:</b> <code>${userCredits} créditos</code>\n` +
    `${Config.decoration.line}`;

  await ctx.replyWithHTML(
    creditsMsg,
    Markup.inlineKeyboard([
      [
        {
          text: `🛒 RECARGAR ${Config.emojis.shop}`,
          url: Config.owner.supportLink,
        },
      ],
    ]),
  );
});

bot.command(["cmds", "comandos"], async (ctx) => {
  const helpMsg = `📖 <b>MENÚ DE COMANDOS</b>\n${Config.decoration.line}\n\n🆓 <b>FREE:</b> /start, /me, /id, /credits\n💎 <b>VIP:</b> /bin, /gen, /ex, /gift\n👮 <b>MOD:</b> /ban, /kick, /mute\n💰 <b>SELLER:</b> /addcredits, /genkey\n${Config.decoration.line}`;
  await ctx.replyWithHTML(helpMsg);
});

bot.command("bc", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;
  const args = ctx.message.text.split(" ");
  const mode = args[1] ? args[1].toUpperCase() : null;
  const announcement = args.slice(2).join(" ");

  if (!mode || !["ALL", "VIP", "STAFF"].includes(mode) || !announcement) {
    return ctx.replyWithHTML(
      `📢 <b>SISTEMA DE ANUNCIOS</b>\n${Config.decoration.line}\n⚠️ <b>Uso:</b> <code>/bc [MODO] [MENSAJE]</code>`,
    );
  }

  let targets = [];
  if (mode === "ALL" || mode === "STAFF")
    targets.push(...Object.keys(Auth.authData.users));
  if (mode === "ALL" || mode === "VIP")
    targets.push(...Object.keys(Auth.authData.commonUsers));
  const finalTargets = [...new Set(targets)];

  ctx.reply(`🚀 Iniciando broadcast para ${finalTargets.length} usuarios...`);
  Logger.log(
    "system",
    ctx,
    `📢 <b>BROADCAST</b>\n👥 <b>Targets:</b> ${finalTargets.length}\n📝 <b>Msg:</b> ${announcement}`,
  );
});

bot.command("stats", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;
  const statsMsg =
    `${Config.emojis.stats} <b>DASHBOARD DE OPERACIONES</b>\n` +
    `${Config.decoration.line}\n\n` +
    `🖥 <b>ESTADO DEL CORE:</b>\n` +
    `├ <b>Status:</b> <code>STABLE</code> 💹\n` +
    `└ <b>Uptime:</b> <code>Running</code>\n\n` +
    `${Config.decoration.line}\n` +
    `${Config.emojis.tech} <b>NETWORK:</b> <code>CONNECTED</code>`;

  await ctx.replyWithHTML(
    statsMsg,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔄 REFRESCAR", "UPDATE_STATS")],
    ]),
  );
});

bot.command("config", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;
  delete userState[ctx.from.id];
  await ctx.replyWithHTML(
    `⚙️ <b>CONFIGURACIÓN MAESTRA</b>\n${Config.decoration.line}\nSelecciona qué deseas gestionar:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("👮 STAFF", "SET_STATE_STAFF"),
        Markup.button.callback("💰 CRÉDITOS", "SET_STATE_CRED"),
      ],
      [
        Markup.button.callback("👥 GRUPOS", "SET_STATE_GRP"),
        Markup.button.callback("🔑 KEYS", "SET_STATE_KEYS"),
      ],
      [Markup.button.callback("❌ CERRAR", "CLOSE_PANEL")],
    ]),
  );
});

bot.command("gen", async (ctx) => {
  try {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(" ");
    const binInput = args[1];

    if (!binInput || binInput.length < 6)
      return tempReply(
        ctx,
        `${Config.emojis.input} <b>USO:</b> <code>/gen 454545</code>`,
        5,
      );
    if (!Credits.consume(userId))
      return ctx.replyWithHTML(`${Config.text.noBalance}`);

    const tempMsg = await ctx.replyWithHTML(
      `${Config.emojis.loading} <b>${Config.bot.shortName}:</b> Generando...`,
    );

    try {
      const info = await consultarBIN(binInput.slice(0, 6));
      const cards = [];
      for (let i = 0; i < 10; i++) cards.push(generarTarjeta(binInput));
      const cardList = cards.map((c) => `<code>${c}</code>`).join("\n");

      if (info && info.success) {
        const flagEmoji =
          info.flag === "🏳️" ? Config.emojis.flagDefault : info.flag;
        const response =
          `${Config.text.genTitle}\n` +
          `${Config.decoration.line}\n\n` +
          `${Config.emojis.bank} <b>BANCO:</b> <code>${info.bank}</code>\n` +
          `${Config.emojis.world} <b>PAÍS:</b> <code>${info.country} ${flagEmoji}</code>\n` +
          `${Config.emojis.money} <b>MONEDA:</b> <code>${info.currency}</code>\n` +
          `${Config.emojis.phone} <b>TEL:</b> <code>${info.bank_phone}</code>\n\n` +
          `${Config.emojis.card} <b>DETALLES:</b>\n` +
          `├ <b>Marca:</b> <code>${info.brand}</code>\n` +
          `├ <b>Nivel:</b> <code>${info.level}</code>\n` +
          `└ <b>Tipo:</b> <code>${info.type}</code>\n\n` +
          `${Config.emojis.info} <b>CARDS GENERADAS:</b>\n` +
          `${Config.decoration.line}\n` +
          `${cardList}\n` +
          `${Config.decoration.line}\n\n` +
          `${Config.emojis.user} <b>USER:</b> <code>${ctx.from.first_name}</code>\n` +
          `${Config.emojis.money} <b>COSTE:</b> <code>1 CRD</code> | <b>VER:</b> <code>${Config.bot.version}</code>\n` +
          `${Config.emojis.tech} <b>STATUS:</b> <code>VERIFIED BY ${Config.bot.engine}</code>`;

        await ctx.telegram.editMessageText(
          ctx.chat.id,
          tempMsg.message_id,
          null,
          response,
          { parse_mode: "HTML" },
        );
        Logger.log(
          "gen",
          ctx,
          `🎲 <b>BIN:</b> <code>${binInput.slice(0, 6)}</code>\n🏦 <b>Banco:</b> ${info.bank}`,
        );
      } else {
        Credits.add(userId, 1);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          tempMsg.message_id,
          null,
          `${Config.text.invalidBin}\nCrédito devuelto.`,
          { parse_mode: "HTML" },
        );
      }
    } catch (err) {
      Credits.add(userId, 1);
      ctx.reply("⚠️ Error en el generador.");
      Logger.log("error", ctx, `🔥 <b>Fallo en /gen</b>\n${err.message}`);
    }
  } catch (err) {
    console.error(err);
  }
});

bot.command("bin", async (ctx) => {
  try {
    const userId = ctx.from.id;
    const binInput = ctx.message.text.split(" ")[1];
    if (!binInput || binInput.length < 6)
      return tempReply(ctx, "⚠️ <b>Uso:</b> <code>/bin 454545</code>", 5);
    if (!Credits.consume(userId))
      return ctx.replyWithHTML(Config.text.noBalance);

    const tempMsg = await ctx.replyWithHTML(
      `${Config.emojis.loading} <b>Consultando...</b>`,
    );
    const info = await consultarBIN(binInput.slice(0, 6));

    if (info && info.success) {
      const response =
        `${Config.text.binTitle} <code>${info.bin}</code>\n` +
        `${Config.decoration.line}\n\n` +
        `${Config.emojis.world} <b>GEOLOCALIZACIÓN</b>\n` +
        `├ <b>País:</b> <code>${info.country} ${info.flag}</code>\n` +
        `├ <b>Moneda:</b> <code>${info.currency}</code>\n` +
        `└ <b>Coord:</b> <code>${info.latitude}, ${info.longitude}</code>\n\n` +
        `${Config.emojis.card} <b>DATOS DE EMISOR</b>\n` +
        `├ <b>Banco:</b> <code>${info.bank}</code>\n` +
        `├ <b>Marca:</b> <code>${info.brand}</code>\n` +
        `├ <b>Nivel:</b> <code>${info.level}</code>\n` +
        `└ <b>Tipo:</b> <code>${info.type}</code>\n\n` +
        `${Config.emojis.phone} <b>CONTACTO:</b>\n` +
        `├ <b>Tel:</b> <code>${info.bank_phone}</code>\n` +
        `└ <b>Web:</b> <code>${info.bank_url}</code>\n\n` +
        `${Config.decoration.line}\n` +
        `${Config.text.footer}`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        response,
        { parse_mode: "HTML" },
      );
      Logger.log(
        "bin",
        ctx,
        `🔍 <b>BIN:</b> <code>${info.bin}</code>\n🏦 <b>Banco:</b> ${info.bank}`,
      );
    } else {
      Credits.add(userId, 1);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        Config.text.invalidBin,
        { parse_mode: "HTML" },
      );
    }
  } catch (err) {
    Credits.add(ctx.from.id, 1);
    ctx.reply(Config.text.crash);
    Logger.log("error", ctx, `🔥 <b>Fallo en /bin</b>\n${err.message}`);
  }
});

bot.command("ex", async (ctx) => {
  try {
    const userId = ctx.from.id;
    let input = ctx.message.text.replace(/[a-z,A-Z,/,\s]/g, "");
    if (input.length < 12)
      return ctx.replyWithHTML(
        `${Config.text.extraTitle}\n${Config.decoration.line}\n⚠️ <b>Error:</b> Mínimo 12 dígitos.\n${Config.decoration.line}`,
      );
    if (!Credits.consume(userId))
      return ctx.replyWithHTML(Config.text.noBalance);

    const tempMsg = await ctx.replyWithHTML(
      `${Config.emojis.loading} <b>Calculando...</b>`,
    );

    try {
      const resultadoExtra = extra(input);
      const info = await consultarBIN(input.slice(0, 6));

      const response =
        `${Config.text.extraTitle}\n` +
        `${Config.decoration.line}\n\n` +
        `${Config.emojis.input} <b>INPUT:</b> <code>${input}</code>\n` +
        `${Config.emojis.bank} <b>BANCO:</b> <code>${info.bank || "N/A"}</code>\n` +
        `${Config.emojis.world} <b>PAÍS:</b> <code>${info.country || "N/A"}</code>\n\n` +
        `${Config.emojis.info} <b>PATRONES:</b>\n` +
        `${Config.decoration.line}\n` +
        `<code>${resultadoExtra}</code>\n` +
        `${Config.decoration.line}\n\n` +
        `${Config.emojis.user} <b>USER:</b> <code>${ctx.from.first_name}</code>\n` +
        `${Config.emojis.tech} <b>ENGINE:</b> <code>${Config.bot.engine}</code>`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        response,
        { parse_mode: "HTML" },
      );
      Logger.log(
        "extra",
        ctx,
        `📊 <b>Input:</b> <code>${input}</code>\n🏦 <b>Banco:</b> ${info.bank || "N/A"}`,
      );
    } catch (err) {
      Credits.add(userId, 1);
      ctx.reply(Config.text.crash);
    }
  } catch (err) {
    console.error(err);
  }
});

bot.command("gift", async (ctx) => {
  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  const amount = parseInt(args[2]);
  if (!targetId || isNaN(amount) || amount <= 0)
    return ctx.replyWithHTML(
      `${Config.emojis.warning} <b>Uso:</b> <code>/gift [ID] [CANTIDAD]</code>`,
    );

  const result = Credits.transfer(ctx.from.id, targetId, amount);
  if (result.success) {
    await ctx.replyWithHTML(
      `${Config.emojis.gift} <b>TRANSFERENCIA EXITOSA</b>\n${Config.decoration.line}\n📤 <b>Enviado a:</b> <code>${targetId}</code>\n💰 <b>Monto:</b> <code>${amount} crds</code>\n📉 <b>Tu nuevo saldo:</b> <code>${result.newSenderTotal}</code>\n${Config.decoration.line}`,
    );
    ctx.telegram
      .sendMessage(
        targetId,
        `${Config.emojis.gift} ¡Has recibido <b>${amount} créditos</b> de <b>${ctx.from.first_name}</b>!`,
        { parse_mode: "HTML" },
      )
      .catch(() => {});

    Logger.log(
      "money",
      ctx,
      `💸 <b>TRANSFERENCIA</b>\n📤 <b>De:</b> <code>${ctx.from.id}</code>\n📥 <b>A:</b> <code>${targetId}</code>\n💰 <b>Monto:</b> ${amount}`,
    );
  } else {
    ctx.replyWithHTML(`${Config.emojis.error} <b>Error:</b> ${result.msg}`);
  }
});

// ==========================================
// --- COMANDO MAESTRO: LISTAS DETALLADAS ---
// ==========================================
bot.command(["list", "ls"], async (ctx) => {
  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);

  // 1. SEGURIDAD: Solo Staff autorizado
  if (!["OWNER", "ADMIN", "SELLER"].includes(userRole)) {
    return ctx.replyWithHTML(Config.text.accessDenied);
  }

  const args = ctx.message.text.split(" ");
  const type = args[1] ? args[1].toLowerCase() : null;

  // Menú de selección si no pone argumentos
  if (!type || !["keys", "staff", "users"].includes(type)) {
    return ctx.replyWithHTML(
      `📋 <b>CENTRO DE REPORTES</b>\n${Config.decoration.line}\nSelecciona qué lista deseas ver:\n\n` +
        `🔹 <code>/list keys</code> - Inventario de Keys\n` +
        `🔹 <code>/list staff</code> - Rendimiento del Equipo\n` +
        `🔹 <code>/list users</code> - Clientes VIP y Consumo\n` +
        `${Config.decoration.line}`,
    );
  }

  // --- REPORTE DE KEYS ---
  if (type === "keys") {
    const keys = Auth.authData.activeKeys;
    const totalKeys = Object.keys(keys).length;

    if (totalKeys === 0) return ctx.reply("⚠️ No hay keys activas.");

    let msg = `${Config.emojis.key} <b>STOCK DE KEYS (${totalKeys})</b>\n${Config.decoration.line}\n`;
    for (const [k, d] of Object.entries(keys)) {
      const days = Math.round(d / 86400000);
      msg += `🔑 <code>${k}</code> | ⏳ <b>${days}d</b>\n`;
    }
    // Cortar mensaje si es muy largo
    return ctx.replyWithHTML(msg.substring(0, 4000));
  }

  // --- REPORTE DE STAFF (FLUJO DE CAJA) ---
  if (type === "staff") {
    const staff = Auth.authData.users;
    let msg = `${Config.emojis.admin} <b>REPORTE DE STAFF</b>\n${Config.decoration.line}\n`;
    let count = 0;

    for (const [sid, data] of Object.entries(staff)) {
      count++;

      let limitDisplay;

      // 1. LÓGICA DE JERARQUÍA PARA CAJA CHICA
      if (parseInt(sid) === Auth.ADMIN_ID) {
        limitDisplay = "∞ (Owner)";
      } else if (data.rango === "ADMIN") {
        limitDisplay = "∞";
      } else {
        // Para SELLERS y MODS
        // Si data.limit existe, lo usamos. Si no (es viejo), mostramos 500 por defecto.
        const actualLimit = data.limit !== undefined ? data.limit : 500;

        // Si por alguna razón tienen un límite gigante, mostramos infinito, si no, el número.
        limitDisplay = actualLimit >= 900000 ? "∞" : actualLimit;
      }

      const flow = data.monthlyFlow || 0;

      msg += `👤 <b>${data.name}</b> [${data.rango}]\n`;
      msg += `🆔 <code>${sid}</code>\n`;
      msg += `📦 <b>Caja Chica:</b> ${limitDisplay}\n`;
      msg += `📈 <b>Flujo Mensual:</b> ${flow} crds\n`;
      msg += `${Config.decoration.line}\n`;
    }

    if (count === 0) return ctx.reply("⚠️ No hay staff registrado.");
    return ctx.replyWithHTML(msg.substring(0, 4000));
  }

  // --- REPORTE DE USUARIOS (VIPS Y CONSUMO) ---
  if (type === "users") {
    const users = Auth.authData.commonUsers;
    let msg = `${Config.emojis.user} <b>CLIENTES VIP ACTIVOS</b>\n${Config.decoration.line}\n`;
    let count = 0;

    for (const [uid, data] of Object.entries(users)) {
      // Solo mostramos VIPs activos
      if (data.expiration > Date.now()) {
        count++;
        const expDate = new Date(data.expiration).toLocaleDateString();
        const keyUsed = data.keyUsed || "N/A";
        const keyType = data.keyType || "Manual";
        const bought = data.totalBought || 0;
        const spent = data.totalSpent || 0;

        msg += `👤 <b>${data.name}</b>\n`;
        msg += `🆔 <code>${uid}</code>\n`;
        msg += `🔑 <b>Key:</b> <code>${keyUsed}</code> (${keyType})\n`;
        msg += `💰 <b>Saldo:</b> ${data.credits} crds\n`;
        msg += `📊 <b>Historial:</b> 📥 ${bought} | 📤 ${spent}\n`;
        msg += `📅 <b>Vence:</b> ${expDate}\n`;
        msg += `${Config.decoration.line}\n`;
      }
    }

    if (count === 0) return ctx.reply("⚠️ No hay clientes VIP activos.");

    // Si la lista es enorme, enviamos por partes
    if (msg.length > 4000) {
      await ctx.replyWithHTML(
        "⚠️ Reporte extenso, enviando primeros registros...",
      );
      return ctx.replyWithHTML(msg.substring(0, 4090));
    }
    return ctx.replyWithHTML(msg);
  }
});

// MONITOR DE EXPIRACIÓN
setInterval(async () => {
  const now = Date.now();
  for (const [userId, expiration] of Object.entries(
    Auth.authData.commonUsers,
  )) {
    const remaining = expiration - now;
    if (remaining <= 30 * 60 * 1000 && remaining > 0) {
      if (!Auth.authData.notifiedUsers.has(userId.toString())) {
        try {
          await bot.telegram.sendMessage(
            userId,
            "⚠️ Tu acceso expira en menos de 30 min.",
            { parse_mode: "HTML" },
          );
          Auth.authData.notifiedUsers.add(userId.toString());
        } catch (e) {}
      }
    }
    if (remaining <= 0) {
      delete Auth.authData.commonUsers[userId];
      Auth.authData.notifiedUsers.delete(userId.toString());
      Auth.saveKeys();
      try {
        await bot.telegram.sendMessage(userId, "🚫 Tu acceso ha expirado.", {
          parse_mode: "HTML",
        });
      } catch (e) {}
    }
  }
}, 60000);

require("./handlers/callbacks")(bot, userState, getUserProfile, CreditsManager);

const iniciarBot = async (reintentos = 0) => {
  try {
    console.log("🚀 Iniciando conexión...");
    bot
      .launch()
      .then(() => {
        console.log(Config.logs.shutdown);
      })
      .catch((e) => console.error(e));

    console.log(Config.logs.start);
    Logger.log(
      "system",
      null,
      `✅ <b>CORE INICIADO</b>\n${Config.bot.version} operativa.\n🛡️ Logs y Cola activados.`,
    );
  } catch (error) {
    const delay = Math.min(30000, (reintentos + 1) * 5000);
    console.error(`❌ Error de conexión: ${error.message}`);
    setTimeout(() => iniciarBot(reintentos + 1), delay);
  }
};

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

iniciarBot();
