// =============================================================================
//  SOCIETY . E X E - MAIN BOT FILE (CENTRALIZADO Y COMPLETO)
// =============================================================================

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
const detectarPasarela = require("./funcionalidades/pasarela.js");
const { parseCards } = require("./funcionalidades/tools.js");

// Imports Gates
const GateAuth = require("./gates/authorize.js"); // Stripe
const GateBraintree = require("./gates/braintree.js"); // Braintree

// Alias
const Credits = CreditsManager;

// --- Inicializamos el bot ---
const Token = process.env.BOT_TOKEN;
if (!Token) throw new Error("Falta BOT_TOKEN en las variables de entorno.");
const bot = new Telegraf(Token);

// --- Variables globales ---
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
  return Generador(bin); // Asumiendo que tu modulo exporta la funcion directamente o ajustalo a Generador.generar(bin)
}

// PERFIL VISUAL (Adaptado a Config)
const getUserProfile = (userId, firstName) => {
  // Compatible con SQLite gracias a auth.js
  const staffData = Auth.authData.users[userId];
  const vipData = Auth.authData.commonUsers[userId];
  const isAdmin =
    parseInt(userId) === parseInt(Auth.ADMIN_ID) ||
    (staffData && staffData.rango === "ADMIN");
  const userCredits = Credits.get(userId);

  let info = `👤 <b>PERFIL DE USUARIO</b>\n`;
  info += `${Config.decoration.line}\n`;
  info += `${Config.emojis.user} <b>Nombre:</b> <code>${firstName}</code>\n`;
  info += `🆔 <b>ID:</b> <code>${userId}</code>\n`;

  let rangoText = Config.roles.user;
  let rangoEmoji = "👤";

  if (isAdmin) {
    rangoText = Config.roles.owner;
    rangoEmoji = "👑";
  } else if (staffData) {
    rangoText = Config.roles[staffData.rango.toLowerCase()] || staffData.rango;
    rangoEmoji = "👮‍♂️";
  } else if (vipData) {
    rangoText = Config.roles.vip;
    rangoEmoji = "💎";
  }

  info += `🎖️ <b>Rango:</b> <code>${rangoEmoji} ${rangoText}</code>\n`;
  info += `${Config.decoration.line}\n\n`;

  if (isAdmin || staffData) {
    const limitDisplay =
      isAdmin || staffData.rango === "ADMIN" ? "∞" : staffData.limit || 500;
    info += `📦 <b>Caja Chica:</b> <code>${limitDisplay}</code>\n`;
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
// Si Auth.authMiddleware existe en tu auth.js, lo usamos. Si no, lo saltamos.
if (Auth.authMiddleware) {
  bot.use(Auth.authMiddleware);
}

// ============================
// --- Manejador de Texto ---
// ============================
bot.on("text", async (ctx, next) => {
  const uid = ctx.from.id;
  const state = userState[uid];

  if (ctx.message.text.startsWith("/")) return next();
  if (!state || state.step !== "WAITING_ID") return next();

  // FIX 1: Declarar input antes de usarlo
  const input = ctx.message.text.trim();

  // Cancelar operación
  if (input.toLowerCase() === "cancelar") {
    delete userState[uid];
    return ctx.replyWithHTML(`🚫 <b>Operación cancelada.</b>\nUsa /config para volver al menú.`);
  }

  // Validar numéricos
  if (!/^\d+$/.test(input)) {
    return ctx.reply("⚠️ ID inválido. Debe ser numérico.");
  }

  const type = state.type;
  delete userState[uid]; // Limpiamos estado

  // FIX 2: Eliminamos las variables fantasma "text" y "buttons"
  return ctx.replyWithHTML(
    `👤 <b>USUARIO LOCALIZADO:</b> <code>${input}</code>\n` +
    `Acción: <b>Gestionar ${type}</b>\n\n` +
    `<i>Selecciona una opción para proceder:</i>`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⚙️ ABRIR PANEL DE GESTIÓN", `MANAGE_USER_${input}`)],
      [Markup.button.callback("❌ CANCELAR", "BACK_TO_MAIN_CONFIG")],
    ])
  );
});

// ==========================================
// --- MÓDULO DE MODERACIÓN (BAN/KICK) ---
// ==========================================
const checkModPerms = (ctx, targetId) => {
  const issuerId = ctx.from.id;
  const issuerRole = Auth.getRole(issuerId);
  if (!["OWNER", "ADMIN", "MOD"].includes(issuerRole)) {
    ctx.replyWithHTML(Config.messages.errors.notAllow);
    return false;
  }
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
    Auth.banUserDB(targetId, reason);
    if (ctx.chat.type !== "private") {
      await ctx
        .banChatMember(targetId)
        .catch((e) => console.log("Error ban chat:", e.message));
    }
    await ctx.replyWithHTML(
      `${Config.emojis.error} <b>USUARIO BANEADO</b>\nID: <code>${targetId}</code>\nRazón: ${reason}`,
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
  const role = Auth.getRole(ctx.from.id);
  if (!["OWNER", "ADMIN"].includes(role))
    return ctx.reply(Config.messages.errors.notAllow);

  Auth.unbanUserDB(targetId);
  if (ctx.chat.type !== "private")
    await ctx.unbanChatMember(targetId).catch(() => {});
  await ctx.replyWithHTML(
    `${Config.emojis.success} <b>USUARIO DESBANEADO</b>\nID: <code>${targetId}</code>`,
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
      `${Config.emojis.warning} <b>USUARIO EXPULSADO</b>\nID: <code>${targetId}</code>`,
    );
    Logger.log("mod", ctx, `🥾 <b>KICK</b>\nTarget: ${targetId}`);
  } catch (e) {
    ctx.reply("❌ Error: Necesito ser admin.");
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
      `${Config.emojis.warning} <b>USUARIO SILENCIADO</b>\nID: <code>${targetId}</code>`,
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
      `${Config.emojis.success} <b>SILENCIO REVOCADO</b>\nID: <code>${targetId}</code>`,
    );
    Logger.log("mod", ctx, `🔊 <b>UNMUTE</b>\nTarget: ${targetId}`);
  } catch (e) {
    ctx.reply("❌ Error técnico.");
  }
});

// ==========================================
// --- MÓDULO ADMINISTRATIVO ---
// ==========================================

bot.command("auth", async (ctx) => {
  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);
  if (!["OWNER", "ADMIN"].includes(userRole))
    return ctx.replyWithHTML(Config.messages.errors.notAllow);

  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  const rango = args[2]?.toUpperCase();

  if (!targetId || !["ADMIN", "SELLER", "MOD"].includes(rango))
    return ctx.replyWithHTML(
      `${Config.emojis.warning} <b>Uso:</b> <code>/auth [ID] [RANGO]</code>`,
    );
  if (userRole === "ADMIN" && rango === "ADMIN")
    return ctx.reply("❌ Admins no crean Admins.");

  const userChat = await ctx.telegram
    .getChat(targetId)
    .catch(() => ({ first_name: "Usuario" }));
  const fullName =
    `${userChat.first_name || ""} ${userChat.last_name || ""}`.trim();

  Auth.authorize(targetId, rango, fullName);
  await ctx.replyWithHTML(
    `${Config.emojis.admin || "👮"} <b>STAFF ASIGNADO</b>\n${Config.decoration.line}\n👤 <b>Nombre:</b> <code>${fullName}</code>\n🎖️ <b>Rango:</b> <code>${rango}</code>\n🆔 <b>ID:</b> <code>${targetId}</code>\n${Config.emojis.success} <i>Registrado correctamente.</i>`,
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
  if (!Auth.canManage(userId, targetId))
    return ctx.replyWithHTML(Config.messages.errors.notAllow);

  Auth.unauthorize(targetId);
  await ctx.replyWithHTML(
    `🛡️ <b>RANGO REVOCADO</b>\n${Config.decoration.line}\n🆔 <b>ID:</b> <code>${targetId}</code>\n⚠️ <i>Acceso eliminado.</i>`,
  );
  Logger.log("auth", ctx, `🗑️ <b>UNAUTH</b>\nTarget: ${targetId}`);
});

bot.command("addcredits", async (ctx) => {
  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);
  if (!["OWNER", "ADMIN", "SELLER"].includes(userRole))
    return ctx.replyWithHTML(Config.messages.errors.notAllow);

  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  const amount = parseInt(args[2]);
  if (!targetId || isNaN(amount))
    return ctx.reply("⚠️ Uso: /addcredits [ID] [CANTIDAD]");

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
  if (!["OWNER", "ADMIN", "SELLER"].includes(userRole))
    return ctx.reply(Config.messages.errors.notAllow);

  const durationArg = ctx.message.text.split(" ")[1] || "1d";
  if (!["1d", "1w", "1m"].includes(durationArg))
    return ctx.reply("⚠️ Uso: /genkey [1d/1w/1m]");

  const newKey = Auth.generateKey(durationArg);
  await ctx.replyWithHTML(
    `${Config.emojis.key || "🔑"} <b>KEY GENERADA</b>\n<code>${newKey}</code>\n⏳ <b>Duración:</b> ${durationArg}`,
  );
  Logger.log("auth", ctx, `🔑 <b>GEN KEY</b>\nKey: ${newKey}`);
});

// COMANDO: /config y /panel
bot.command(["config", "panel"], async (ctx) => {
  const userId = ctx.from.id;
  if (userId.toString() !== Auth.ADMIN_ID.toString()) return; // Comparación segura
  delete userState[userId];
  await ctx.replyWithHTML(
    `⚙️ <b>CONFIGURACIÓN MAESTRA</b>\n${Config.decoration.line}\nSelecciona qué deseas gestionar:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("👮 GESTIONAR STAFF", "SET_STATE_STAFF"),
        Markup.button.callback("💰 GESTIONAR CRÉDITOS", "SET_STATE_CRED"),
      ],
      [
        Markup.button.callback("👥 GESTIONAR GRUPOS", "SET_STATE_GRP"),
        Markup.button.callback("🔑 GESTIONAR KEYS", "SET_STATE_KEYS"),
      ],
      [Markup.button.callback("❌ CERRAR PANEL", "CLOSE_PANEL")],
    ]),
  );
});

// COMANDO: /stats y /status
bot.command(["stats", "status"], async (ctx) => {
  const userId = ctx.from.id;
  if (userId.toString() !== Auth.ADMIN_ID.toString()) return;

  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  const totalStaff = Object.keys(Auth.getAllStaff()).length;
  const totalVips = Object.keys(Auth.getAllVips()).length;
  const totalKeys = Object.keys(Auth.getAllKeys()).length;

  const statsMsg =
    `${Config.emojis.stats} <b>DASHBOARD DE OPERACIONES</b>\n` +
    `${Config.decoration.line}\n\n` +
    `🖥 <b>ESTADO DEL CORE:</b>\n` +
    `├ <b>Status:</b> <code>ONLINE</code> 🟢\n` +
    `├ <b>DB:</b> <code>SQLite (WAL)</code>\n` +
    `└ <b>Uptime:</b> <code>${hours}h ${minutes}m</code>\n\n` +
    `📊 <b>METRICAS:</b>\n` +
    `├ <b>Staff Activo:</b> <code>${totalStaff}</code>\n` +
    `├ <b>VIPs Totales:</b> <code>${totalVips}</code>\n` +
    `└ <b>Keys Stock:</b> <code>${totalKeys}</code>\n\n` +
    `${Config.decoration.line}\n` +
    `${Config.emojis.tech} <b>NETWORK:</b> <code>CONNECTED</code>`;

  await ctx.replyWithHTML(
    statsMsg,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔄 REFRESCAR DATOS", "UPDATE_STATS")],
    ]),
  );
});

// COMANDO: /bc (Broadcast)
bot.command("bc", async (ctx) => {
  if (ctx.from.id.toString() !== Auth.ADMIN_ID.toString()) return;
  const args = ctx.message.text.split(" ");
  const mode = args[1] ? args[1].toUpperCase() : null;
  const announcement = args.slice(2).join(" ");

  if (!mode || !["ALL", "VIP", "STAFF"].includes(mode) || !announcement) {
    return ctx.replyWithHTML(
      `📢 <b>BROADCAST</b>\n⚠️ <b>Uso:</b> <code>/bc [ALL/VIP/STAFF] [MENSAJE]</code>`,
    );
  }

  let targets = [];
  if (mode === "ALL" || mode === "STAFF")
    targets.push(...Object.keys(Auth.getAllStaff()));
  if (mode === "ALL" || mode === "VIP")
    targets.push(...Object.keys(Auth.getAllVips()));

  const finalTargets = [...new Set(targets)];
  ctx.reply(`🚀 Iniciando broadcast a ${finalTargets.length} usuarios...`);

  for (const targetId of finalTargets) {
    try {
      await bot.telegram.sendMessage(
        targetId,
        `📢 <b>ANUNCIO OFICIAL:</b>\n\n${announcement}`,
        { parse_mode: "HTML" },
      );
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {}
  }
  ctx.reply("✅ Broadcast terminado.");
});

// ==========================================
// --- MÓDULO: CHECKER GATES (MULTI-THREAD) ---
// ==========================================

bot.command(["sa", "chk", "stripe"], async (ctx) => {
  if (Config.modules.stripe === false)
    return ctx.replyWithHTML(Config.messages.errors.maintenance);

  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);
  const input = ctx.message.text;
  const cards = parseCards(input);

  if (cards.length === 0)
    return ctx.replyWithHTML(
      `${Config.emojis.warning} <b>Uso:</b> <code>/sa cc|mm|yy|cvv</code>`,
    );
  if (cards.length > Config.limits.maxCardsPerCheck)
    return ctx.replyWithHTML(
      `${Config.emojis.error} Máximo ${Config.limits.maxCardsPerCheck} tarjetas.`,
    );

  const cost = ["OWNER", "ADMIN", "SELLER"].includes(userRole)
    ? 0
    : cards.length * Config.limits.costs.checker;
  if (cost > 0 && Credits.get(userId) < cost)
    return ctx.replyWithHTML(Config.messages.errors.noBalance);

  let dashboardMsg = `🚀 <b>${Config.bot.name}</b>\n${Config.decoration.line}\n⏳ <b>Estado:</b> <code>Iniciando...</code>`;
  const msgWait = await ctx.replyWithHTML(dashboardMsg);

  let liveCount = 0;
  let deadCount = 0;

  if (cost > 0) Credits.remove(userId, cost);

  for (const [index, card] of cards.entries()) {
    try {
      const startTime = Date.now();

      // Intentamos la validación
      const result = await GateAuth.check(
        card.cc,
        card.mes,
        card.anio,
        card.cvv,
      );

      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

      if (result.status === "LIVE" || result.status === "CCN") {
        liveCount++;
        const icon =
          result.status === "LIVE" ? Config.emojis.live : Config.emojis.ccn;
        await ctx.replyWithHTML(
          `<b>${icon} ${result.status}</b>\n${Config.decoration.line}\n💳 <code>${card.cc}</code>\n💬 <b>Result:</b> ${result.msg}\n⏱️ ${timeTaken}s`,
        );
        Logger.log("live", ctx, `${icon} HIT: ${card.mask}`);
      } else {
        deadCount++;
        // Logueamos en consola el motivo de la muerte para que tú lo veas
        console.log(`[DEAD] ${card.mask} -> ${result.msg}`);
      }

      // Actualizar dashboard
      await ctx.telegram
        .editMessageText(
          ctx.chat.id,
          msgWait.message_id,
          null,
          `⏳ <b>PROCESANDO:</b> <code>${index + 1}/${cards.length}</code>\n${Config.decoration.line}\n✅: ${liveCount} | ❌: ${deadCount}`,
          { parse_mode: "HTML" },
        )
        .catch(() => {});
    } catch (e) {
      // --- CAPTURA DE ERROR CRÍTICO ---
      console.error("❌ ERROR EN GATE STRIPE:", e.message);

      if (
        e.response &&
        (e.response.status === 401 || e.response.status === 403)
      ) {
        await ctx.replyWithHTML(
          `🚫 <b>ERROR DE AUTENTICACIÓN:</b> Tu SK de Stripe es inválida o ha sido restringida. Revisa el .env`,
        );
        return; // Detenemos el comando por completo
      }

      deadCount++;
    }
  }

  await ctx.telegram
    .editMessageText(
      ctx.chat.id,
      msgWait.message_id,
      null,
      `🏁 <b>FINALIZADO</b>\n${Config.decoration.line}\n✅: ${liveCount} | ❌: ${deadCount}`,
      { parse_mode: "HTML" },
    )
    .catch(() => {});
});

// ==========================================
// --- BRAINTREE CHECKER (/br) ---
// ==========================================
bot.command(["br", "vbv", "braintree"], async (ctx) => {
  if (Config.modules.braintree === false)
    return ctx.replyWithHTML(Config.messages.errors.maintenance);

  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);
  const cards = parseCards(ctx.message.text);

  if (cards.length === 0) return ctx.replyWithHTML(`⚠️ Uso: /br cc|mm|yy|cvv`);

  const cost = ["OWNER", "ADMIN", "SELLER"].includes(userRole)
    ? 0
    : cards.length * Config.limits.costs.checker;
  if (cost > 0 && Credits.get(userId) < cost)
    return ctx.replyWithHTML(Config.messages.errors.noBalance);

  const msgWait = await ctx.replyWithHTML(
    `🚀 <b>BRAINTREE ENGINE</b>\n⏳ Procesando...`,
  );
  let liveCount = 0,
    deadCount = 0;

  if (cost > 0) Credits.remove(userId, cost);

  for (const [index, card] of cards.entries()) {
    try {
      const result = await GateBraintree.check(
        card.cc,
        card.mes,
        card.anio,
        card.cvv,
      );

      if (result.status === "LIVE" || result.status === "CCN") {
        liveCount++;
        const icon =
          result.status === "LIVE" ? Config.emojis.live2 : Config.emojis.ccn;
        await ctx.replyWithHTML(
          `<b>${icon} ${result.status}</b>\n${Config.decoration.line}\n💳 <code>${card.cc}</code>\n💬 <b>Resp:</b> ${result.msg}`,
        );
        Logger.log("live", ctx, `${icon} HIT BT: ${card.mask}`);
      } else {
        deadCount++;
        console.log(`[DEAD BT] ${card.mask} -> ${result.msg}`);
      }
    } catch (e) {
      console.error("❌ ERROR EN GATE BRAINTREE:", e.message);

      // Braintree suele dar errores de autenticación con códigos específicos
      if (
        e.message.includes("authentication") ||
        e.message.includes("Permission denied")
      ) {
        await ctx.replyWithHTML(
          `🚫 <b>ERROR BRAINTREE:</b> Credenciales inválidas. Revisa Merchant ID y Keys.`,
        );
        return;
      }
      deadCount++;
    }
  }
  await ctx.telegram
    .editMessageText(
      ctx.chat.id,
      msgWait.message_id,
      null,
      `🏁 <b>FINALIZADO BT</b>\n✅: ${liveCount} | ❌: ${deadCount}`,
      { parse_mode: "HTML" },
    )
    .catch(() => {});
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
  const isAdmin = parseInt(userId) === parseInt(Auth.ADMIN_ID);

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
      [
        Markup.button.url(
          "👨‍💻 CONTACTAR SOPORTE",
          `https://t.me/${Config.bot.devUser.replace("@", "")}`,
        ),
      ],
    ];
  }

  Logger.log("system", ctx, `🚀 <b>Inicio:</b> /start`);

  const header =
    `⚡ <b>${Config.bot.name}</b> ⚡\n\n` +
    `🚀 <b>CHECKER ${Config.bot.version}</b>\n` +
    `${Config.decoration.line}\n` +
    `El validador más rápido y preciso del mercado. Optimizado para profesionales.\n\n` +
    `${Config.emojis.info || "ℹ️"} <b>FEATURES:</b>\n` +
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
    ctx.reply(Config.messages.errors.generic);
  }
});

// ==========================================
// COMANDO: /ID (Utility)
// ==========================================
bot.command("id", (ctx) => {
  let targetId = ctx.from.id;
  let targetName = ctx.from.first_name;

  // Si el usuario está respondiendo a otro mensaje, tomamos los datos de ese mensaje
  if (ctx.message.reply_to_message) {
    targetId = ctx.message.reply_to_message.from.id;
    targetName = ctx.message.reply_to_message.from.first_name;
  }

  ctx.replyWithHTML(
    `🆔 <b>USER ID</b>\n` +
      `${Config.decoration.line}\n` +
      `👤 <b>User:</b> ${targetName}\n` +
      `🔢 <b>ID:</b> <code>${targetId}</code>`,
  );
});

bot.command(["info", "help", "ayuda"], async (ctx) => {
  const helpMenu =
    `📘 <b>MENÚ DE AYUDA</b>\n` +
    `${Config.decoration.line}\n\n` +
    `🛠 <b>BÁSICOS:</b>\n├ <code>/start</code>\n├ <code>/me</code>\n└ <code>/id</code>\n\n` +
    `🚀 <b>VIP:</b>\n├ <code>/gen</code>\n├ <code>/bin</code>\n└ <code>/ex</code>\n\n` +
    `${Config.decoration.line}`;

  await ctx.replyWithHTML(
    helpMenu,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("💳 GENERADOR", "HELP_GEN"),
        Markup.button.callback("🔑 KEYS", "HELP_KEYS"),
      ],
      [
        Markup.button.callback("📊 EXTRAPOLAR", "HELP_EXTRA"),
        Markup.button.url(
          "🛒 COMPRAR",
          `https://t.me/${Config.bot.devUser.replace("@", "")}`,
        ),
      ],
    ]),
  );
});

bot.command("prices", (ctx) => {
  const pricesMessage =
    `${Config.emojis.card} <b>TARIFAS PREMIUM</b>\n` +
    `${Config.decoration.line}\n\n` +
    `${Config.emojis.money} <b>DIARIO:</b> <code>${Config.prices.day}</code> ${Config.prices.symbol}\n` +
    `${Config.emojis.money} <b>SEMANAL:</b> <code>${Config.prices.week}</code> ${Config.prices.symbol}\n` +
    `${Config.emojis.money} <b>MENSUAL:</b> <code>${Config.prices.month}</code> ${Config.prices.symbol}\n\n` +
    `${Config.emojis.info || "ℹ️"} <b>PRECIO GRUPO MENSUAL:</b> <code>${Config.prices.grpmonth}</code>\n` +
    `${Config.decoration.line}`;

  ctx.replyWithHTML(
    pricesMessage,
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "🛒 Comprar Ahora",
          `https://t.me/${Config.bot.devUser.replace("@", "")}`,
        ),
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
          text: `🛒 RECARGAR ${Config.emojis.money}`,
          url: `https://t.me/${Config.bot.devUser.replace("@", "")}`,
        },
      ],
    ]),
  );
});

bot.command("redeem", async (ctx) => {
  const key = ctx.message.text.split(" ")[1];
  if (!key)
    return ctx.replyWithHTML(
      `${Config.emojis.key || "🔑"} <b>SISTEMA DE KEYS</b>\n${Config.decoration.line}\n⚠️ <b>Uso:</b> <code>/redeem KEY-XXXX</code>\n${Config.decoration.line}`,
    );

  const expiryDate = Auth.redeemKey(ctx.from.id, key, ctx.from.first_name);

  if (expiryDate) {
    await ctx.replyWithHTML(
      `${Config.emojis.success} <b>¡ACCESO ACTIVADO!</b>\n${Config.decoration.line}\n${Config.emojis.user} <b>User:</b> <code>${ctx.from.first_name}</code>\n📅 <b>Expira:</b> <code>${expiryDate}</code>\n${Config.decoration.line}`,
    );
    Logger.log(
      "auth",
      ctx,
      `🔑 <b>KEY ACTIVADA</b>\n🗝️ <b>Key:</b> <code>${key}</code>`,
    );
  } else {
    ctx.replyWithHTML(Config.messages.errors.invalidFormat || "Key inválida.");
    Logger.log(
      "auth",
      ctx,
      `🚫 <b>KEY FALLIDA</b>\n🗝️ <b>Intento:</b> <code>${key}</code>`,
    );
  }
});

// ==========================================
// --- MÓDULO: SCANNER WEB (Acceso Global) ---
// ==========================================
bot.command(["pasarela", "gate", "chkweb"], async (ctx) => {
  if (Config.modules.pasarela === false)
    return ctx.replyWithHTML(Config.messages.errors.maintenance);

  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);
  const args = ctx.message.text.split(" ");
  const url = args[1];

  if (!url)
    return ctx.replyWithHTML(
      `${Config.emojis.warning} <b>Uso:</b> <code>/pasarela sitioweb.com</code>`,
    );

  const tieneSaldo = Credits.consume(userId);
  if (!tieneSaldo) return ctx.replyWithHTML(Config.messages.errors.noBalance);

  const tempMsg = await ctx.replyWithHTML(
    `${Config.emojis.loading} <b>${Config.messages.scanner.scanning}</b>`,
  );

  try {
    const resultado = await detectarPasarela(url);

    if (resultado.success) {
      const gatesList = resultado.gateways
        .map((g) => `🔹 <b>${g}</b>`)
        .join("\n");
      const statusIcon =
        resultado.status === 200
          ? "🟢 Online"
          : `🟠 Código ${resultado.status}`;

      const msg =
        `${Config.emojis.tech} <b>SCANNER DE PASARELAS</b>\n` +
        `${Config.decoration.line}\n` +
        `🌐 <b>Target:</b> <code>${resultado.url}</code>\n` +
        `📡 <b>Estado:</b> ${statusIcon}\n` +
        `📟 <b>CMS:</b> <code>${resultado.cms}</code>\n` +
        `🛡️ <b>WAF:</b> <code>${resultado.protection}</code>\n\n` +
        `💳 <b>GATEWAYS DETECTADOS:</b>\n` +
        `${gatesList}\n` +
        `${Config.decoration.line}\n` +
        `${Config.emojis.user} <b>Usuario:</b> ${ctx.from.first_name} [${userRole}]`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        msg,
        { parse_mode: "HTML", disable_web_page_preview: true },
      );
      Logger.log(
        "gen",
        ctx,
        `🔍 <b>SCAN PASARELA</b>\nURL: ${url}\nCMS: ${resultado.cms}\nGates: ${resultado.gateways.join(", ")}`,
      );
    } else {
      Credits.add(userId, 1);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        `❌ <b>Error de Análisis:</b>\n${resultado.error}\n\n<i>💰 Crédito reembolsado.</i>`,
        { parse_mode: "HTML" },
      );
    }
  } catch (e) {
    Credits.add(userId, 1);
    ctx.telegram.editMessageText(
      ctx.chat.id,
      tempMsg.message_id,
      null,
      "❌ Error interno del bot. Crédito devuelto.",
      { parse_mode: "HTML" },
    );
  }
});

bot.command("gen", async (ctx) => {
  if (Config.modules.generator === false)
    return ctx.replyWithHTML(Config.messages.errors.maintenance);

  try {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(" ");
    const binInput = args[1];

    if (!binInput || binInput.length < 6)
      return tempReply(
        ctx,
        `${Config.emojis.warning} <b>USO:</b> <code>/gen 454545</code>`,
        5,
      );
    if (!Credits.consume(userId))
      return ctx.replyWithHTML(Config.messages.errors.noBalance);

    const tempMsg = await ctx.replyWithHTML(
      `${Config.emojis.loading} <b>${Config.bot.shortName}:</b> Generando...`,
    );

    try {
      const info = await consultarBIN(binInput.slice(0, 6));
      const cards = [];
      const cantidad = Config.limits.genLimit || 10;
      for (let i = 0; i < cantidad; i++) cards.push(generarTarjeta(binInput));
      const cardList = cards.map((c) => `<code>${c}</code>`).join("\n");

      if (info && info.success) {
        const flagEmoji = info.flag === "🏳️" ? Config.emojis.flag : info.flag;
        const response =
          `⚡ <b>GENERADOR CC</b>\n` +
          `${Config.decoration.line}\n\n` +
          `${Config.emojis.bank || "🏦"} <b>BANCO:</b> <code>${info.bank}</code>\n` +
          `${Config.emojis.flag || "🌍"} <b>PAÍS:</b> <code>${info.country} ${flagEmoji}</code>\n` +
          `${Config.emojis.money} <b>MONEDA:</b> <code>${info.currency}</code>\n` +
          `${Config.emojis.card} <b>TIPO:</b> <code>${info.brand} - ${info.type}</code>\n\n` +
          `${Config.decoration.line}\n` +
          `${cardList}\n` +
          `${Config.decoration.line}\n\n` +
          `${Config.emojis.user} <b>USER:</b> <code>${ctx.from.first_name}</code>\n`;

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
          `🎲 <b>BIN:</b> <code>${binInput.slice(0, 6)}</code>`,
        );
      } else {
        Credits.add(userId, 1);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          tempMsg.message_id,
          null,
          `${Config.messages.errors.invalidFormat}\nCrédito devuelto.`,
          { parse_mode: "HTML" },
        );
      }
    } catch (err) {
      Credits.add(userId, 1);
      ctx.reply("⚠️ Error en el generador.");
    }
  } catch (err) {
    console.error(err);
  }
});

// ==========================================
// COMANDO: /BIN (Reporte Detallado)
// ==========================================
bot.command("bin", async (ctx) => {
  if (Config.modules.binLookup === false)
    return ctx.replyWithHTML(Config.messages.errors.maintenance);

  try {
    const userId = ctx.from.id;
    const binInput = ctx.message.text.split(" ")[1];

    if (!binInput || binInput.length < 6) {
      return tempReply(
        ctx,
        `${Config.emojis.warning} <b>Uso:</b> <code>/bin 454545</code>`,
        5,
      );
    }

    // Consumo de créditos
    if (!Credits.consume(userId))
      return ctx.replyWithHTML(Config.text.noBalance);

    const tempMsg = await ctx.replyWithHTML(
      `${Config.emojis.loading} <b>Consultando Base de Datos...</b>`,
    );

    // Consultamos el BIN (Módulo original)
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
        `${Config.decoration.line}\n` +
        `${Config.text.footer}`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        response,
        { parse_mode: "HTML" },
      );
    } else {
      // Reembolso por fallo en la consulta
      Credits.add(userId, 1);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        `${Config.text.invalidBin}\n<i>💰 Crédito reembolsado.</i>`,
        { parse_mode: "HTML" },
      );
    }
  } catch (err) {
    Credits.add(ctx.from.id, 1);
    ctx.reply(Config.text.crash);
  }
});

bot.command("ex", async (ctx) => {
  try {
    const userId = ctx.from.id;
    let input = ctx.message.text.replace(/[a-z,A-Z,/,\s]/g, "");
    if (input.length < 12)
      return ctx.replyWithHTML(
        `${Config.emojis.warning} <b>Error:</b> Mínimo 12 dígitos.`,
      );
    if (!Credits.consume(userId))
      return ctx.replyWithHTML(Config.messages.errors.noBalance);

    const tempMsg = await ctx.replyWithHTML(
      `${Config.emojis.loading} <b>Calculando...</b>`,
    );

    try {
      const resultadoExtra = extra(input);
      const info = await consultarBIN(input.slice(0, 6));
      const response =
        `📊 <b>EXTRAPOLACIÓN</b>\n` +
        `${Config.decoration.line}\n\n` +
        `${Config.emojis.input || "🔢"} <b>INPUT:</b> <code>${input}</code>\n` +
        `${Config.emojis.bank || "🏦"} <b>BANCO:</b> <code>${info.bank || "N/A"}</code>\n\n` +
        `${Config.decoration.line}\n` +
        `<code>${resultadoExtra}</code>\n` +
        `${Config.decoration.line}\n\n` +
        `${Config.emojis.user} <b>USER:</b> <code>${ctx.from.first_name}</code>`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        response,
        { parse_mode: "HTML" },
      );
    } catch (err) {
      Credits.add(userId, 1);
      ctx.reply(Config.messages.errors.generic);
    }
  } catch (err) {
    console.error(err);
  }
});

// LIST COMMAND
bot.command(["list", "ls"], async (ctx) => {
  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);
  if (!["OWNER", "ADMIN", "SELLER"].includes(userRole))
    return ctx.replyWithHTML(Config.messages.errors.notAllow);

  const args = ctx.message.text.split(" ");
  const type = args[1] ? args[1].toLowerCase() : null;

  if (!type || !["keys", "staff", "users"].includes(type)) {
    return ctx.replyWithHTML(
      `📋 <b>CENTRO DE REPORTES</b>\n${Config.decoration.line}\nSelecciona una opción:\n\n` +
        `🔑 <code>/list keys</code>  - Inventario\n` +
        `👮 <code>/list staff</code> - Equipo\n` +
        `👤 <code>/list users</code> - Clientes\n` +
        `${Config.decoration.line}`,
    );
  }

  // --- KEYS ---
  if (type === "keys") {
    const keys = Auth.getAllKeys();
    const totalKeys = Object.keys(keys).length;
    if (totalKeys === 0) return ctx.reply("⚠️ No hay keys activas.");
    let msg = `${Config.emojis.key || "🔑"} <b>STOCK DE KEYS (${totalKeys})</b>\n${Config.decoration.line}\n`;
    for (const [code, duration] of Object.entries(keys)) {
      msg += `🏷️ <code>${code}</code>\n`;
    }
    return ctx.replyWithHTML(msg.substring(0, 4000));
  }

  // --- STAFF ---
  if (type === "staff") {
    const staff = Auth.getAllStaff();
    let msg = `${Config.emojis.admin || "👮"} <b>REPORTE DE STAFF</b>\n${Config.decoration.line}\n`;
    for (const [sid, data] of Object.entries(staff)) {
      msg += `👤 <b>${data.name}</b> [${data.rango}]\n🆔 <code>${sid}</code>\n${Config.decoration.line}\n`;
    }
    return ctx.replyWithHTML(msg.substring(0, 4000) || "Sin Staff.");
  }

  // --- USERS ---
  if (type === "users") {
    const users = Auth.getAllVips();
    let msg = `${Config.emojis.user} <b>CLIENTES VIP ACTIVOS</b>\n${Config.decoration.line}\n`;
    for (const [uid, data] of Object.entries(users)) {
      if (data.expiration > Date.now()) {
        const expDate = new Date(data.expiration).toLocaleDateString();
        msg += `👤 <b>${data.name}</b>\n🆔 <code>${uid}</code>\n📅 <b>Vence:</b> ${expDate}\n${Config.decoration.line}\n`;
      }
    }
    return ctx.replyWithHTML(msg.substring(0, 4000) || "Sin VIPs.");
  }
});

// MONITOR DE EXPIRACIÓN
setInterval(async () => {
  const now = Date.now();
  const users = Auth.getAllVips();
  for (const [userId, data] of Object.entries(users)) {
    const remaining = data.expiration - now;
    if (remaining <= 30 * 60 * 1000 && remaining > 0) {
      if (!Auth.authData.notifiedUsers.has(userId)) {
        try {
          await bot.telegram.sendMessage(
            userId,
            "⚠️ Tu acceso expira en menos de 30 min.",
            { parse_mode: "HTML" },
          );
          Auth.authData.notifiedUsers.add(userId);
        } catch (e) {}
      }
    }
    if (remaining <= 0) {
      // Nota: Asumiendo que Auth.sql.deleteVip existe en tu versión
      if (Auth.sql && Auth.sql.deleteVip)
        Auth.sql.deleteVip.run(String(userId));
      Auth.authData.notifiedUsers.delete(userId);
      try {
        await bot.telegram.sendMessage(userId, "🚫 Tu acceso ha expirado.", {
          parse_mode: "HTML",
        });
      } catch (e) {}
    }
  }
}, 60000);

// Cargar handlers externos si existen
try {
  require("./handlers/callbacks")(
    bot,
    userState,
    getUserProfile,
    CreditsManager,
  );
} catch (e) {
  console.log("⚠️ No se encontró handlers/callbacks.js, saltando carga.");
}

// ANTI-CRASH
bot.catch((err, ctx) => {
  const userId = ctx?.from?.id || "Desconocido";
  if (err.response && err.response.error_code === 403) return;
  if (err.response && err.response.error_code === 429) return;
  console.error(`❌ [ERROR CRÍTICO]`, err);
});

// ARRANQUE
const gracefulStop = async (signal) => {
  console.log(`🛑 Recibida señal ${signal}. Apagando sistema...`);
  process.exit(0);
};

process.once("SIGINT", () => gracefulStop("SIGINT"));
process.once("SIGTERM", () => gracefulStop("SIGTERM"));

const iniciarBot = async () => {
  try {
    await bot.launch();
    console.log("✅ CORE ONLINE");
    Logger.log(
      "system",
      null,
      `✅ <b>CORE V3 ONLINE</b>\n${Config.decoration.line}\n🤖 <b>Bot:</b> ${Config.bot.shortName}`,
    );
  } catch (error) {
    console.error("Error arranque:", error);
    setTimeout(iniciarBot, 5000);
  }
};

iniciarBot();
