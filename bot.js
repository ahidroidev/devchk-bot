// =============================================================================
//  SOCIETY . E X E - MAIN BOT FILE (RESTAURADO Y BLINDADO)
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
const GateAuth = require("./gates/authorize.js"); // Tu gate nuevo

// Alias
const Credits = CreditsManager;

// --- Inicializamos el bot ---
const Token = process.env.BOT_TOKEN;
if (!Token) throw new Error("Falta BOT_TOKEN en las variables de entorno.");
const bot = new Telegraf(Token);

// === INICIALIZAMOS EL LOGGER ===
Logger.init(bot);

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
  return Generador(bin);
}

// TU PERFIL VISUAL ORIGINAL
const getUserProfile = (userId, firstName) => {
  // Compatible con SQLite gracias a auth.js
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
bot.use(Auth.authMiddleware);

// ============================
// --- Manejador de Texto (RECUPERADO) ---
// ============================
bot.on("text", async (ctx, next) => {
  const uid = ctx.from.id;
  const state = userState[ctx.from.id];

  if (ctx.message.text.startsWith("/")) return next();
  if (!state || state.step !== "WAITING_ID") return next();

  const input = ctx.message.text.trim();

  // FIX: CANCELAR
  if (input.toLowerCase() === "cancelar") {
    delete userState[uid];
    return ctx.replyWithHTML(
      `🚫 <b>Operación cancelada.</b>\nUsa /config para volver al menú.`,
    );
  }

  // FIX: VALIDAR NUMEROS
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
  delete userState[uid];
});

// ==========================================
// --- MÓDULO DE MODERACIÓN (BAN/KICK) ---
// ==========================================
const checkModPerms = (ctx, targetId) => {
  const issuerId = ctx.from.id;
  const issuerRole = Auth.getRole(issuerId);
  if (!["OWNER", "ADMIN", "MOD"].includes(issuerRole)) {
    ctx.replyWithHTML(Config.text.accessDenied);
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
      `${Config.emojis.ban} <b>USUARIO BANEADO</b>\nID: <code>${targetId}</code>\nRazón: ${reason}`,
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
    return ctx.reply(Config.text.accessDenied);

  Auth.unbanUserDB(targetId);
  if (ctx.chat.type !== "private")
    await ctx.unbanChatMember(targetId).catch(() => {});
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
// --- MÓDULO ADMINISTRATIVO (RESTAURADO) ---
// ==========================================

bot.command("auth", async (ctx) => {
  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);
  if (!["OWNER", "ADMIN"].includes(userRole))
    return ctx.replyWithHTML(Config.text.accessDenied);

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
  if (!Auth.canManage(userId, targetId))
    return ctx.replyWithHTML(Config.text.accessDenied);

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
    return ctx.replyWithHTML(Config.text.accessDenied);

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
    return ctx.reply(Config.text.accessDenied);

  const durationArg = ctx.message.text.split(" ")[1] || "1d";
  if (!["1d", "1w", "1m"].includes(durationArg))
    return ctx.reply("⚠️ Uso: /genkey [1d/1w/1m]");

  const newKey = Auth.generateKey(durationArg);
  await ctx.replyWithHTML(
    `${Config.emojis.key} <b>KEY GENERADA</b>\n<code>${newKey}</code>\n⏳ <b>Duración:</b> ${durationArg}`,
  );
  Logger.log("auth", ctx, `🔑 <b>GEN KEY</b>\nKey: ${newKey}`);
});

// COMANDO: /config y /panel (RECUPERADOS)
bot.command(["config", "panel"], async (ctx) => {
  const userId = ctx.from.id;
  if (userId !== Auth.ADMIN_ID) return;
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

// COMANDO: /stats y /status (RECUPERADOS Y ADAPTADOS A SQLITE)
bot.command(["stats", "status"], async (ctx) => {
  const userId = ctx.from.id;
  if (userId !== Auth.ADMIN_ID) return;

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
  if (ctx.from.id !== Auth.ADMIN_ID) return;
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

bot.command(["chk", "sa"], async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || "Anon";
  const userRole = Auth.getRole(userId);

  // 1. EXTRAER TARJETAS (Hasta 10)
  const input = ctx.message.text;
  const cards = parseCards(input);

  if (cards.length === 0) {
    return ctx.replyWithHTML(
      `${Config.emojis.warning} <b>Formato inválido.</b>\nEnvía hasta 10 CCs:\n<code>CC|MM|YY|CVV</code>`,
    );
  }

  // 2. CÁLCULO DE CRÉDITOS
  // Staff: Gratis. Usuarios: 1 Crédito por tarjeta.
  const cost = ["OWNER", "ADMIN", "SELLER"].includes(userRole)
    ? 0
    : cards.length;

  if (cost > 0) {
    const balance = Credits.get(userId);
    if (balance < cost)
      return ctx.replyWithHTML(
        `⚠️ <b>Saldo Insuficiente.</b>\nNecesitas <code>${cost}</code> créditos. Tienes: <code>${balance}</code>.`,
      );
    Credits.remove(userId, cost); // Descontamos el paquete entero
  }

  // 3. MENSAJE DE ESPERA (DASHBOARD)
  let dashboardMsg =
    `🚀 <b>SOCIETY CHECKER V3</b>\n` +
    `${Config.decoration.line}\n` +
    `💳 <b>Cargadas:</b> ${cards.length}\n` +
    `⏳ <b>Estado:</b> Iniciando motor...\n` +
    `${Config.decoration.line}`;

  const msgWait = await ctx.replyWithHTML(dashboardMsg);

  let liveCount = 0;
  let deadCount = 0;
  let summary = []; // Para guardar resultados Dead/CCN

  // 4. BUCLE DE PROCESAMIENTO
  for (const [index, card] of cards.entries()) {
    try {
      // Actualizamos estado visual cada 2 tarjetas para no saturar a Telegram
      if (index % 2 === 0) {
        await ctx.telegram
          .editMessageText(
            ctx.chat.id,
            msgWait.message_id,
            null,
            dashboardMsg.replace(
              "Iniciando motor...",
              `Procesando ${index + 1}/${cards.length}...`,
            ),
            { parse_mode: "HTML" },
          )
          .catch(() => {});
      }

      const startTime = Date.now();
      // LLAMADA AL GATE (Tu archivo authorize.js)
      const result = await GateAuth.check(
        card.cc,
        card.mes,
        card.anio,
        card.cvv,
      );
      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

      // === DISEÑO MAQUILLADO PARA LIVES (MENSAJE NUEVO) ===
      if (result.status === "LIVE" || result.status === "CCN") {
        liveCount++;
        const icon = result.status === "LIVE" ? "✅" : "☑️";
        const title =
          result.status === "LIVE"
            ? "APPROVED / CHARGED"
            : "CCN LIVE / APPROVED";

        const liveMessage =
          `<b>${icon} ${title}</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💳 <b>Card:</b> <code>${card.cc}</code>\n` +
          `📅 <b>Exp:</b> <code>${card.mes}/${card.anio}</code> • <b>Cvv:</b> <code>${card.cvv}</code>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💬 <b>Result:</b> ${result.msg}\n` +
          `🏦 <b>Gate:</b> ${result.gate}\n` +
          `⏱️ <b>Time:</b> ${timeTaken}s\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>User:</b> ${ctx.from.first_name} [${userRole}]\n` +
          `💎 <b>Bot:</b> ${Config.bot.shortName}`;

        // Enviamos el LIVE como mensaje NUEVO (Reply)
        await ctx.replyWithHTML(liveMessage);

        // LOG INTERNO
        Logger.log(
          "live",
          ctx,
          `${icon} <b>HIT ${result.status}</b>\nCard: ${card.mask}\nMsg: ${result.msg}`,
        );
      } else {
        deadCount++;
        // Guardamos en resumen solo los últimos 4 dígitos
        summary.push(`❌ ${card.mask} ➜ ${result.msg}`);
      }
    } catch (e) {
      console.error(e);
      deadCount++;
      summary.push(`⚠️ ${card.mask} ➜ Error API`);
    }
  }

  // 5. ACTUALIZACIÓN FINAL DEL DASHBOARD (RESUMEN)
  const finalReport =
    `🏁 <b>SESIÓN FINALIZADA</b>\n` +
    `${Config.decoration.line}\n` +
    `✅ <b>Lives:</b> ${liveCount}\n` +
    `❌ <b>Deads:</b> ${deadCount}\n` +
    `📉 <b>Total:</b> ${cards.length}\n` +
    `${Config.decoration.line}\n` +
    `<i>Los Lives fueron enviados en mensajes separados.</i>`;

  await ctx.telegram
    .editMessageText(ctx.chat.id, msgWait.message_id, null, finalReport, {
      parse_mode: "HTML",
    })
    .catch(() => {});
});

// ======================
// --- COMANDOS GENERALES (TU DISEÑO ORIGINAL) ---
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
    ctx.reply(Config.text.error);
  }
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

bot.command("redeem", async (ctx) => {
  const key = ctx.message.text.split(" ")[1];
  if (!key)
    return ctx.replyWithHTML(
      `${Config.emojis.key} <b>SISTEMA DE KEYS</b>\n${Config.decoration.line}\n⚠️ <b>Uso:</b> <code>/redeem KEY-XXXX</code>\n${Config.decoration.line}`,
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
    ctx.replyWithHTML(Config.text.invalidKey);
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
  const userId = ctx.from.id;
  const username = ctx.from.username || "Anon";
  const userRole = Auth.getRole(userId); // Obtenemos rango para el Log
  const args = ctx.message.text.split(" ");
  const url = args[1];

  // 1. Validación de entrada
  if (!url)
    return ctx.replyWithHTML(
      `${Config.emojis.warning} <b>Uso:</b> <code>/pasarela sitioweb.com</code>`,
    );

  // 2. Lógica de Rangos y Créditos
  // Credits.consume devuelve TRUE si es Staff (Gratis) o si es User/VIP y tiene saldo (Cobra 1)
  // Devuelve FALSE si es User/VIP y NO tiene saldo.
  const tieneSaldo = Credits.consume(userId);

  if (!tieneSaldo) {
    return ctx.replyWithHTML(Config.text.noBalance); // Mensaje de "Recarga saldo"
  }

  // 3. Feedback visual (Simulando hacking/escaneo)
  console.log(
    `🔍 [GATE] Scan solicitado: ${url} | User: ${username} | Role: ${userRole}`,
  );
  const tempMsg = await ctx.replyWithHTML(
    `${Config.emojis.loading} <b>Iniciando escaneo de protocolos...</b>`,
  );

  try {
    const resultado = await detectarPasarela(url);

    if (resultado.success) {
      // Formateo de lista
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

      // LOG EXITOSO
      console.log(`✅ [GATE] Éxito: ${url} -> [${resultado.gateways}]`);
      Logger.log(
        "gen",
        ctx,
        `🔍 <b>SCAN PASARELA</b>\nURL: ${url}\nCMS: ${resultado.cms}\nGates: ${resultado.gateways.join(", ")}`,
      );
    } else {
      // 4. SISTEMA DE REEMBOLSO (REFUND)
      // Si el scanner falla (timeout o error), le devolvemos el crédito al usuario Free/VIP.
      // Si es Staff, Credits.add no afecta negativamente, así que es seguro.
      Credits.add(userId, 1);

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        `❌ <b>Error de Análisis:</b>\n${resultado.error}\n\n<i>💰 Crédito reembolsado.</i>`,
        { parse_mode: "HTML" },
      );
      console.log(`❌ [GATE] Fallo: ${url} -> ${resultado.error}`);
    }
  } catch (e) {
    // Reembolso por error crítico
    Credits.add(userId, 1);
    console.error(`🔥 [GATE] Error Crítico: ${e.message}`);
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
          `🎲 <b>BIN:</b> <code>${binInput.slice(0, 6)}</code>`,
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
        `${Config.emojis.bank} <b>BANCO:</b> <code>${info.bank || "N/A"}</code>\n\n` +
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
    } catch (err) {
      Credits.add(userId, 1);
      ctx.reply(Config.text.crash);
    }
  } catch (err) {
    console.error(err);
  }
});

// LIST COMMAND (ADAPTADO A SQLITE)
bot.command(["list", "ls"], async (ctx) => {
  const userId = ctx.from.id;
  const userRole = Auth.getRole(userId);
  if (!["OWNER", "ADMIN", "SELLER"].includes(userRole))
    return ctx.replyWithHTML(Config.text.accessDenied);

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

    let msg = `${Config.emojis.key} <b>STOCK DE KEYS (${totalKeys})</b>\n${Config.decoration.line}\n`;
    for (const [code, duration] of Object.entries(keys)) {
      const ms = parseInt(duration);
      let tiempo = "Indefinido";
      if (!isNaN(ms)) {
        if (ms >= 86400000) {
          tiempo = `${Math.round(ms / 86400000)} Día(s)`;
        } else {
          tiempo = `${Math.round(ms / 3600000)} Hora(s)`;
        }
      }
      msg += `🏷️ <code>${code}</code>\n⏳ <b>Duración:</b> ${tiempo}\n${Config.decoration.line}\n`;
    }
    return ctx.replyWithHTML(msg.substring(0, 4000));
  }

  // --- STAFF ---
  if (type === "staff") {
    const staff = Auth.getAllStaff();
    let msg = `${Config.emojis.admin} <b>REPORTE DE STAFF</b>\n${Config.decoration.line}\n`;
    let count = 0;
    for (const [sid, data] of Object.entries(staff)) {
      count++;
      let limitDisplay;
      if (parseInt(sid) === Auth.ADMIN_ID || data.rango === "ADMIN") {
        limitDisplay = "∞";
      } else {
        const actualLimit = data.limit !== undefined ? data.limit : 500;
        limitDisplay = actualLimit >= 900000 ? "∞" : actualLimit;
      }
      msg += `👤 <b>${data.name}</b> [${data.rango}]\n`;
      msg += `🆔 <code>${sid}</code>\n`;
      msg += `📦 <b>Caja Chica:</b> ${limitDisplay}\n`;
      msg += `📈 <b>Flujo:</b> ${data.monthlyFlow || 0} crds\n`;
      msg += `${Config.decoration.line}\n`;
    }
    return ctx.replyWithHTML(msg.substring(0, 4000) || "Sin Staff.");
  }

  // --- USERS ---
  if (type === "users") {
    const users = Auth.getAllVips();
    let msg = `${Config.emojis.user} <b>CLIENTES VIP ACTIVOS</b>\n${Config.decoration.line}\n`;
    let count = 0;
    for (const [uid, data] of Object.entries(users)) {
      if (data.expiration > Date.now()) {
        count++;
        const expDate = new Date(data.expiration).toLocaleDateString();
        const keyUsed = data.keyUsed || "N/A";
        const shortKey =
          keyUsed.length > 10 ? keyUsed.substring(0, 8) + "..." : keyUsed;

        msg += `👤 <b>${data.name}</b>\n`;
        msg += `🆔 <code>${uid}</code>\n`;
        msg += `🔑 <b>Key:</b> <code>${shortKey}</code> (${data.keyType || "Manual"})\n`;
        msg += `💰 <b>Saldo:</b> ${data.credits}\n`;
        msg += `📅 <b>Vence:</b> ${expDate}\n`;
        msg += `${Config.decoration.line}\n`;
      }
    }
    return ctx.replyWithHTML(msg.substring(0, 4000) || "Sin VIPs.");
  }
});

// MONITOR DE EXPIRACIÓN Y CALLBACKS
setInterval(async () => {
  const now = Date.now();
  const users = Auth.getAllVips();
  for (const [userId, data] of Object.entries(users)) {
    const remaining = data.expiration - now;
    // 30 min alerta
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
    // Expirado
    if (remaining <= 0) {
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

require("./handlers/callbacks")(bot, userState, getUserProfile, CreditsManager);

// ==========================================
// --- SISTEMA DE ARRANQUE Y APAGADO ---
// ==========================================

const gracefulStop = async (signal) => {
  console.log(`🛑 Recibida señal ${signal}. Apagando sistema...`);
  try {
    if (process.env.LOG_CHANNEL_ID) {
      await bot.telegram
        .sendMessage(
          process.env.LOG_CHANNEL_ID,
          `🛑 <b>SISTEMA DETENIDO</b>\n${Config.decoration.line}\n⚠️ <b>Señal:</b> ${signal}\n📉 <b>Estado:</b> Offline`,
          { parse_mode: "HTML" },
        )
        .catch(() => {});
    }
  } catch (e) {}
  process.exit(0);
};

process.once("SIGINT", () => gracefulStop("SIGINT"));
process.once("SIGTERM", () => gracefulStop("SIGTERM"));

const iniciarBot = async () => {
  try {
    await bot.launch();
    console.log(Config.logs.start);
    console.log("🔋 [SQLITE] Base de datos conectada.");
    Logger.log(
      "system",
      null,
      `✅ <b>CORE V3 ONLINE</b>\n${Config.decoration.line}\n🔌 <b>DB:</b> SQLite (WAL)\n🤖 <b>Bot:</b> ${Config.bot.shortName}\n🛡️ <b>Sistema:</b> <code>Running</code>`,
    );
  } catch (error) {
    console.error("Error arranque:", error);
    setTimeout(iniciarBot, 5000);
  }
};

iniciarBot();
