// Importaciones y Configuración Inicial
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");

// Imports Locales
const Auth = require("./funcionalidades/auth.js");
const Generador = require("./funcionalidades/generador.js");
const valLuhn = require("./funcionalidades/luhn.js");
const extra = require("./funcionalidades/extra.js");
const consultarBIN = require("./funcionalidades/bin.js");
const CreditsManager = require("./database/credits.js");

// Alias para mantener compatibilidad en todo el código
const Credits = CreditsManager;

// --- Inicializamos el bot ---
const Token = process.env.BOT_TOKEN;
if (!Token) throw new Error("Falta BOT_TOKEN en las variables de entorno.");
const bot = new Telegraf(Token);
// --- Fin ---

// Variables globales y utilidades
const userState = {};
const getUserProfile = (userId, firstName) => {
  const staffData = Auth.authData.users[userId];
  const vipData = Auth.authData.commonUsers[userId];
  const isAdmin = userId === Auth.ADMIN_ID;

  // Obtenemos los créditos del usuario (ajusta según tu CreditsManager)
  // Asumo que están en commonUsers o en una tabla aparte de créditos
  const userCredits = vipData?.credits || 0;

  let info = `👤 <b>PERFIL DE USUARIO</b>\n`;
  info += `━━━━━━━━━━━━━━━━━━\n`;
  info += `👤 <b>Nombre:</b> <code>${firstName}</code>\n`;
  info += `🆔 <b>ID:</b> <code>${userId}</code>\n`;

  // 1. DETERMINACIÓN DE RANGO
  let rangoText = "FREE";
  if (isAdmin) rangoText = "OWNER 👑";
  else if (staffData) rangoText = `${staffData.rango} 👮`;
  else if (vipData) rangoText = "VIP 💎";

  info += `🎖️ <b>Rango:</b> <code>${rangoText}</code>\n`;
  info += `━━━━━━━━━━━━━━━━━━\n\n`;

  // 2. INFORMACIÓN ESPECÍFICA
  if (isAdmin || staffData) {
    // Info para Staff/Owner
    info += `📦 <b>Caja Chica:</b> <code>${staffData?.limit || "∞"}</code>\n`;
    info += `📊 <b>Estado:</b> <code>Operativo</code>\n`;
    info += `💰 <b>Créditos Propios:</b> <code>${userCredits}</code>\n`;
  } else if (vipData) {
    // Info para VIP
    const rest = vipData.expiration - Date.now();

    if (rest > 0) {
      const days = Math.floor(rest / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (rest % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );

      info += `💰 <b>Créditos:</b> <code>${userCredits}</code>\n`;
      info += `⏳ <b>Vence en:</b> <code>${days}d ${hours}h</code>\n`;
      info += `📅 <b>Expiración:</b> <code>${new Date(vipData.expiration).toLocaleDateString()}</code>\n`;
    } else {
      info += `⚠️ <b>Suscripción:</b> <code>Vencida</code>\n`;
      info += `💡 <i>Renueva para recuperar tus beneficios.</i>\n`;
    }
  } else {
    // Info para FREE
    info += `💰 <b>Créditos:</b> <code>${userCredits}</code>\n`;
    info += `⚠️ <b>Acceso:</b> <code>Limitado</code>\n`;
    info += `💡 <i>¡Compra una key para subir a VIP!</i>\n`;
  }

  return info;
};

// =======================================
// --- Bloque de Handlers de Callbacks ---
// =======================================
// (Se movió la carga de handlers más abajo, después de definir sendLog)
// ====================================
// --- Fin de Handlers de Callbacks ---
// ====================================

// ============================
// --- Inicio del Manejador ---
// ============================
bot.on("text", async (ctx, next) => {
  const uid = ctx.from.id;
  const state = userState[ctx.from.id];

  const stateDisplay = state ? JSON.stringify(state) : "MODO_LIBRE";
  console.log(
    `[DEBUG] Texto recibido: ${ctx.message.text} | Estado: ${stateDisplay}`,
  );

  // Si no estamos en medio de una configuración, seguimos con los comandos normales
  if (!state || state.step !== "WAITING_ID") return next();

  const input = ctx.message.text.trim();
  const type = state.type;
  let buttons = [];
  let text = "";

  if (type === "STAFF") {
    text = `👮 <b>GESTIÓN DE STAFF</b>\n🆔 ID: <code>${input}</code>`;
    buttons = [
      [Markup.button.callback("🎖️ ASIGNAR RANGO", `CONF_STAFF_${input}`)],
      [Markup.button.callback("🗑️ REVOCAR STAFF", `REV_ALL_${input}`)],
    ];
  } else if (type === "CRED") {
    text = `💰 <b>GESTIÓN DE CRÉDITOS</b>\n🆔 ID: <code>${input}</code>`;
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
    text = `🔑 <b>GESTIÓN DE KEY</b>\n<code>${input}</code>`;
    buttons = [
      [Markup.button.callback("✅ CONFIRMAR", `CONF_KEY_${input}`)],
      [Markup.button.callback("❌ ELIMINAR", `REV_KEY_${input}`)],
    ];
  }

  buttons.push([
    Markup.button.callback("🔙 VOLVER AL MENÚ", "BACK_TO_MAIN_CONFIG"),
  ]);

  await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));

  // Limpiamos el estado para que el bot no se quede "pegado" esperando más texto
  delete userState[uid];
});
// ============================
// --- Cierre del Manejador ---
// ============================

// ==========================================
// 1. BLOQUE PÚBLICO
// Comandos que CUALQUIERA puede usar (Sin Key)
// ==========================================

bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  const username = ctx.from.username ? `@${ctx.from.username}` : "Sin Alias";

  // 1. GENERAMOS EL PERFIL DINÁMICO
  const profileInfo = getUserProfile(userId, firstName);

  // 2. LÓGICA DE BOTONES Y DETECCIÓN DE RANGO
  const staffData = Auth.authData.users[userId];
  const vipData = Auth.authData.commonUsers[userId];
  const isAdmin = userId === Auth.ADMIN_ID;

  let buttons = [];
  let detectedRange = "FREE"; // Por defecto

  if (isAdmin) {
    detectedRange = "OWNER 👑";
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
    detectedRange = `STAFF [${staffData.rango}]`;
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
    detectedRange = "VIP 💎";
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
      [Markup.button.url("👨‍💻 CONTACTAR SOPORTE", "https://t.me/devcrackpy")],
    ];
  }

  // --- 3. LOGS DE ACTIVIDAD (Consola y Canal) ---
  const logAction = `USUARIO INICIÓ BOT: ${firstName} (${username}) | Rango: ${detectedRange}`;

  // Console log para debug local
  console.log(`[SYSTEM] ${logAction} | ID: ${userId}`);

  // Sendlog para el canal administrativo
  try {
    await sendLog(ctx, logAction);
  } catch (err) {
    console.log(`[ERROR] Fallo al enviar log al canal: ${err.message}`);
  }

  // 4. DISEÑO VISUAL Y RESPUESTA
  const header =
    `⚡ <b>SOCIETY . E X E</b> ⚡\n` +
    `<i>"Knowledge is power, access is everything."</i>\n`;

  await ctx.replyWithHTML(
    `${header}\n${profileInfo}`,
    Markup.inlineKeyboard(buttons),
  );
});

// --- Comando para mostrar perfil y créditos ---
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
    console.error("Error en comando /me:", err);
    ctx.reply("❌ Ocurrió un error al cargar tu perfil.");
  }
});

bot.command("id", (ctx) => {
  const user = ctx.from;
  const firstName = user.first_name || "No definido";
  const username = user.username ? `@${user.username}` : "Sin alias";
  const userId = user.id;

  const idMessage =
    "👤 <b>INFORMACIÓN DE USUARIO</b>\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "📝 <b>Nombre:</b> <code>" +
    firstName +
    "</code>\n" +
    "🏷️ <b>Username:</b> <code>" +
    username +
    "</code>\n" +
    "🆔 <b>ID:</b> <code>" +
    userId +
    "</code>\n" +
    "━━━━━━━━━━━━━━━━━━";

  ctx.replyWithHTML(idMessage);
});

bot.command(["info", "help", "ayuda"], async (ctx) => {
  const helpMenu =
    `📖 <b>CENTRO DE AYUDA & COMANDOS</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `Bienvenido al manual de usuario. Selecciona una categoría para ver los detalles de cada función.\n\n` +
    `🛠 <b>COMANDOS BÁSICOS:</b>\n` +
    `├ <code>/start</code> - Inicio del bot\n` +
    `├ <code>/me</code> - Ver tu perfil/status\n` +
    `└ <code>/id</code> - Obtener tu Telegram ID\n\n` +
    `🚀 <b>HERRAMIENTAS VIP:</b>\n` +
    `├ <code>/gen [bin] [cant]</code> - Generador\n` +
    `├ <code>/bin [bin]</code> - Info de banco\n` +
    `└ <code>/ex [bin]</code> - Extrapolación\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `✨ <b>Powered by:</b> @DevChkBot`;

  await ctx.replyWithHTML(
    helpMenu,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("💳 GENERADOR", "HELP_GEN"),
        Markup.button.callback("🔑 KEYS", "HELP_KEYS"),
      ],
      [
        Markup.button.callback("📊 EXTRAPOLAR", "HELP_EXTRA"),
        Markup.button.url("🛒 COMPRAR", "https://t.me/devcrackpy"),
      ],
    ]),
  );
});

// --- CMD REDEEM KEYS ---
bot.command("redeem", async (ctx) => {
  const key = ctx.message.text.split(" ")[1];

  if (!key) {
    return ctx.replyWithHTML(
      `📝 <b>SISTEMA DE KEYS</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>Uso:</b> <code>/redeem KEY-XXXX</code>\n` +
        `━━━━━━━━━━━━━━━━━━`,
    );
  }

  // Llamamos a la función pasando ID, Key, Nombre y Apellido
  const expiryDate = Auth.redeemKey(
    ctx.from.id,
    key,
    ctx.from.first_name,
    ctx.from.last_name || "",
  );

  if (expiryDate) {
    const successMsg =
      `✅ <b>¡ACCESO ACTIVADO!</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 <b>User:</b> <code>${ctx.from.first_name} ${ctx.from.last_name || ""}</code>\n` +
      `📅 <b>Expira:</b> <code>${expiryDate}</code>\n\n` +
      `🚀 <i>Ya puedes usar todas las funciones VIP.</i>\n` +
      `━━━━━━━━━━━━━━━━━━`;

    await ctx.replyWithHTML(successMsg);

    // Opcional: Avisarte a ti que alguien activó una key
    bot.telegram
      .sendMessage(
        Auth.ADMIN_ID,
        `🔔 <b>LOG:</b> El usuario <code>${ctx.from.id}</code> activó una Key.`,
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  } else {
    ctx.replyWithHTML("❌ <b>Key inválida, usada o expirada.</b>");
  }
});

bot.command("prices", (ctx) => {
  const pricesMessage =
    "💳 <b>TARIFAS PREMIUM | DevChk Bot</b>\n" +
    "━━━━━━━━━━━━━━━━━━\n\n" +
    "🔵 <b>PLAN DIARIO</b>\n" +
    " ├ Duración: 24 Horas\n" +
    " └ Precio: <code>$2.00 USD</code>\n\n" +
    "🟢 <b>PLAN SEMANAL</b>\n" +
    " ├ Duración: 7 Días\n" +
    " └ Precio: <code>$7.00 USD</code>\n\n" +
    "🔴 <b>PLAN MENSUAL</b>\n" +
    " ├ Duración: 30 Días\n" +
    " └ Precio: <code>$20.00 USD</code>\n\n" +
    "✨ <b>INCLUYE:</b> Acceso ilimitado a /gen, /bin, /ex y soporte técnico.\n" +
    "━━━━━━━━━━━━━━━━━━";

  ctx.replyWithHTML(
    pricesMessage,
    Markup.inlineKeyboard([
      [
        Markup.button.url("🛒 Comprar con Admin", "https://t.me/devcrackpy"),
        Markup.button.callback("🔑 Canjear", "SHOW_PRICES"),
      ],
    ]),
  );
});

bot.command(["status", "profile"], async (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

  // Obtenemos créditos usando el manager que creamos
  const userCredits = Credits.get(userId);

  // 1. BUSCAR DATA EN EL SISTEMA
  const staffData = Auth.authData.users[userId];
  const vipData = Auth.authData.commonUsers[userId];
  const isOwner = userId === Auth.ADMIN_ID;

  // 2. LÓGICA DE RANGO E ICONOS
  let rangoText = "SIN ACCESO";
  let expText = "N/A";
  let icon = "👤";

  if (isOwner) {
    rangoText = "OWNER / DEV";
    expText = "PERMANENTE";
    icon = "👑";
  } else if (staffData) {
    rangoText = staffData.rango || "STAFF";
    expText = "PERMANENTE";
    icon = rangoText === "ADMIN" ? "👮" : rangoText === "SELLER" ? "💰" : "🛡️";
  } else if (vipData) {
    rangoText = "PREMIUM (VIP)";
    expText = new Date(vipData.expiration).toLocaleString();
    icon = "💎";
  }

  // 3. CONSTRUCCIÓN DEL MENSAJE
  let statusMsg =
    `${icon} <b>MI PERFIL</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `📝 <b>Nombre:</b> <code>${ctx.from.first_name || "User"}</code>\n` +
    `🆔 <b>ID:</b> <code>${userId}</code>\n` +
    `🎖️ <b>Rango:</b> <code>${rangoText}</code>\n` +
    `💰 <b>Créditos:</b> <code>${userCredits}</code>\n` + // <--- LÍNEA DE CRÉDITOS
    `📅 <b>Expira:</b> <code>${expText}</code>\n`;

  // 4. DETECCIÓN DE GRUPO (Validación corregida para objeto de grupos)
  if (isGroup) {
    const groupAuth = Auth.authData.groups[chatId]
      ? "AUTORIZADO ✅"
      : "SIN ACCESO ❌";
    statusMsg +=
      `━━━━━━━━━━━━━━━━━━\n` +
      `👥 <b>GRUPO ACTUAL</b>\n` +
      `🆔 <b>ID:</b> <code>${chatId}</code>\n` +
      `📊 <b>Estado:</b> <code>${groupAuth}</code>\n`;
  }

  statusMsg += `━━━━━━━━━━━━━━━━━━\n`;

  // 5. PIE DE MENSAJE DINÁMICO
  if (!staffData && !vipData && !isOwner) {
    statusMsg += `🛒 <b>Adquiere una membresía:</b>`;
  } else {
    statusMsg += `🚀 <b>¡Disfruta tus beneficios!</b>`;
  }

  // ENVIAR CON BOTÓN DE COMPRA
  await ctx
    .replyWithHTML(statusMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🛒 COMPRAR CRÉDITOS / VIP",
              url: "https://t.me/devcrackpy",
            },
          ],
        ],
      },
    })
    .catch((err) => {
      console.error("❌ Error en comando Status:", err.message);
    });
});

// --- BLOQUE DE COMANDOS DEL SISTEMA DE CRÉDITOS (FREE & VIP) ---
bot.command("gift", async (ctx) => {
  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  const amount = parseInt(args[2]);

  // Validación de argumentos
  if (!targetId || isNaN(amount) || amount <= 0) {
    return ctx.replyWithHTML(
      "⚠️ <b>Uso:</b> <code>/gift [ID] [CANTIDAD]</code>",
    );
  }

  // Intentamos la transferencia usando el Manager
  const result = Credits.transfer(ctx.from.id, targetId, amount);

  if (result.success) {
    // 1. Mensaje al que envía
    await ctx.replyWithHTML(
      `🎁 <b>TRANSFERENCIA EXITOSA</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📤 <b>Enviado a:</b> <code>${targetId}</code>\n` +
        `💰 <b>Monto:</b> <code>${amount} crds</code>\n` +
        `📉 <b>Tu nuevo saldo:</b> <code>${result.newSenderTotal}</code>\n` +
        `━━━━━━━━━━━━━━━━━━`,
    );

    // 2. Notificar al que recibe (si el bot lo conoce)
    ctx.telegram
      .sendMessage(
        targetId,
        `🎁 ¡Has recibido <b>${amount} créditos</b> de <b>${ctx.from.first_name}</b>!`,
        { parse_mode: "HTML" },
      )
      .catch(() => {
        console.log(
          "No se pudo notificar al receptor, tal vez no ha iniciado el bot.",
        );
      });

    // 3. Log para ti
    if (typeof sendLog === "function") {
      await sendLog(
        ctx,
        `🎁 <b>GIFT</b>\nDe: <code>${ctx.from.id}</code>\nPara: <code>${targetId}</code>\nCantidad: ${amount}`,
      );
    }
  } else {
    // Si falla (saldo insuficiente o usuario no existe)
    ctx.replyWithHTML(`❌ <b>Error:</b> ${result.msg}`);
  }
});

// Comando independiente de créditos
bot.command(["credits", "saldo", "money", "creditos"], async (ctx) => {
  const userId = ctx.from.id;

  // Usamos el manager que creamos en /database/credits.js
  const userCredits = Credits.get(userId);

  const creditsMsg =
    `💰 <b>MI BILLETERA</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 <b>Usuario:</b> <code>${ctx.from.first_name || "User"}</code>\n` +
    `📈 <b>Saldo actual:</b> <code>${userCredits} créditos</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💡 <i>Usa tus créditos en comandos VIP como /bin o /gen. Cada consulta descuenta 1 crédito.</i>\n\n` +
    `🛒 <b>¿Necesitas más saldo?</b>\n` +
    `¡Toca el botón de abajo para recargar!`;

  await ctx
    .replyWithHTML(creditsMsg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 COMPRAR CRÉDITOS", url: "https://t.me/devcrackpy" }],
          [{ text: "💎 PLAN VIP ILIMITADO", url: "https://t.me/devcrackpy" }],
        ],
      },
    })
    .catch((err) => {
      console.error("❌ Error en comando Credits:", err.message);
    });
});

// --- Comands List Free & VIP ---
bot.command(["cmds", "comandos"], async (ctx) => {
  const helpMsg =
    `📖 <b>MENÚ DE COMANDOS</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🆓 <b>COMANDOS FREE:</b>\n` +
    `├ <code>/start</code> - Iniciar interacción\n` +
    `├ <code>/me</code> - Ver perfil y créditos\n` +
    `├ <code>/id</code> - Obtener tu Telegram ID\n` +
    `├ <code>/credits</code> - Consultar saldo\n` +
    `└ <code>/redeem [key]</code> - Canjear VIP\n\n` +
    `💎 <b>COMANDOS VIP / CRÉDITOS:</b>\n` +
    `├ <code>/bin [bin]</code> - Info de BIN (1 crd)\n` +
    `├ <code>/gen [bin]</code> - Generar tarjetas (1 crd)\n` +
    `├ <code>/ex [bin]</code> - Extrapolación\n` +
    `└ <code>/gift [ID] [monto]</code> - Enviar créditos\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👨‍💻 <b>Soporte:</b> @devcrackpy\n` +
    `✨ <i>Disfruta los beneficios premium.</i>`;

  await ctx.replyWithHTML(helpMsg);
});

// ==========================================
// 2. MONITOR DE EXPIRACIÓN (Background)
// ==========================================
setInterval(async () => {
  const now = Date.now();
  const thirtyMinutesInMs = 30 * 60 * 1000;

  for (const [userId, expiration] of Object.entries(
    Auth.authData.commonUsers,
  )) {
    const remaining = expiration - now;

    if (remaining <= thirtyMinutesInMs && remaining > 0) {
      if (!Auth.authData.notifiedUsers.has(userId.toString())) {
        try {
          await bot.telegram.sendMessage(
            userId,
            "⚠️ <b>Aviso de expiración</b>\n- Tu acceso expira en menos de 30 minutos.",
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
        await bot.telegram.sendMessage(
          userId,
          "🚫 <b>Tu acceso ha expirado.</b>\nUsa /redeem para activar una nueva Key.",
          { parse_mode: "HTML" },
        );
      } catch (e) {}
    }
  }
}, 60000);

// ==========================================
// 3. MIDDLEWARE DE PROTECCIÓN (La Barrera)
// Todo lo que esté abajo requiere ID autorizado o KEY activa
// ==========================================
bot.use(Auth.authMiddleware);

// ====================================
// --- BLOQUE COMANDOS PROTEGIDOS   ---
// ====================================

// --- COMANDO GEN (Generador de Tarjetas) ---
bot.command("gen", async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ");
  const binInput = args[1];

  // 1. VALIDACIÓN DE ENTRADA (Gratis)
  if (!binInput || binInput.length < 6) {
    return ctx.replyWithHTML(
      `🎲 <b>GENERADOR DE TARJETAS</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>Uso:</b> <code>/gen 454545</code>\n\n` +
        `<i>Ingresa el BIN para generar 10 tarjetas con su respectiva información bancaria.</i>\n` +
        `━━━━━━━━━━━━━━━━━━`,
    );
  }

  // 2. INTENTO DE COBRO
  // El Staff/Owner pasan derecho. Los VIP/Common pagan 1 crédito.
  const paid = Credits.consume(userId);
  if (!paid) {
    return ctx.replyWithHTML(
      `❌ <b>SALDO INSUFICIENTE</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `La generación requiere <b>1 crédito</b>.\n` +
        `💰 <b>Tu saldo:</b> <code>0</code>\n\n` +
        `🛒 Compra créditos con @devcrackpy`,
    );
  }

  const query = binInput.slice(0, 6);
  const tempMsg = await ctx.replyWithHTML(
    `⏳ <b>Consultando BIN y generando...</b>`,
  );

  try {
    // 3. OBTENER INFO DEL BIN (HandyAPI)
    const info = await consultarBIN(query);

    // 4. GENERAR TARJETAS
    const cards = [];
    for (let i = 0; i < 10; i++) {
      cards.push(generarTarjeta(binInput));
    }
    const cardList = cards.map((c) => `<code>${c}</code>`).join("\n");

    if (info && info.success) {
      const getFlag = (code) =>
        code
          .toUpperCase()
          .replace(/./g, (char) =>
            String.fromCodePoint(char.charCodeAt(0) + 127397),
          );
      const flagEmoji = info.flag !== "🏳️" ? getFlag(info.flag) : "🏳️";

      // ESTRUCTURA DE SALIDA PREMIUM
      const response =
        `🎲 <b>TARJETAS GENERADAS</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🏦 <b>Banco:</b> <code>${info.bank}</code>\n` +
        `🌍 <b>País:</b> <code>${info.country} ${flagEmoji}</code>\n` +
        `🏷️ <b>Nivel:</b> <code>${info.brand} ${info.level}</code>\n\n` +
        `💳 <b>LISTA:</b>\n${cardList}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Generado por:</b> <code>${ctx.from.first_name}</code>\n` +
        `💰 <b>Costo:</b> <code>1 Crédito</code>\n` +
        `✨ <b>Powered by:</b> @DevChkBot`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        response,
        { parse_mode: "HTML" },
      );

      // LOG DE ÉXITO
      await sendLog(
        ctx,
        `🎲 <b>GENERACIÓN</b>\n👤 User: <code>${userId}</code>\n✅ BIN: <code>${query}</code> (Cobrado)`,
      );
    } else {
      // 5. REEMBOLSO (Opcional: Si el BIN no existe, devolvemos el crédito)
      Credits.add(userId, 1);

      const fallback =
        `❌ <b>BIN INVÁLIDO</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `No se encontró información para el BIN <code>${query}</code>.\n` +
        `🔄 <b>Tu crédito ha sido devuelto.</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <i>Asegúrate de usar un BIN real.</i>`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        fallback,
        { parse_mode: "HTML" },
      );
    }
  } catch (err) {
    // 6. REEMBOLSO POR ERROR DE SISTEMA
    Credits.add(userId, 1);
    console.error("❌ Error en GEN:", err.message);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      tempMsg.message_id,
      null,
      "⚠️ Error técnico al generar. Crédito devuelto.",
      { parse_mode: "HTML" },
    );
  }
});

// --- /BIN Command ---
bot.command("bin", async (ctx) => {
  const userId = ctx.from.id;
  const binInput = ctx.message.text.split(" ")[1];

  // 1. VALIDACIÓN INICIAL (Gratis)
  if (!binInput || binInput.length < 6) {
    return tempReply(ctx, "⚠️ <b>Uso:</b> <code>/bin 454545</code>", 5);
  }

  // 2. INTENTO DE COBRO (Usa tu CreditsManager)
  // El Staff y Owner pasan gratis automáticamente según tu lógica de consume()
  const paid = Credits.consume(userId);
  if (!paid) {
    return ctx.replyWithHTML(
      `❌ <b>SALDO INSUFICIENTE</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Esta consulta requiere <b>1 crédito</b>.\n` +
        `💰 <b>Tu saldo:</b> <code>0</code>\n\n` +
        `🛒 Compra créditos con @devcrackpy`,
    );
  }

  const query = binInput.slice(0, 6);
  // Mensaje temporal "Cargando..."
  const tempMsg = await ctx.replyWithHTML(
    `⏳ <b>Consultando BIN:</b> <code>${query}</code>...`,
  );

  try {
    // 3. CONSULTA A LA API (HandyAPI)
    const info = await consultarBIN(query);

    if (info && info.success) {
      // Generador de banderas automático
      const getFlag = (code) =>
        code
          .toUpperCase()
          .replace(/./g, (char) =>
            String.fromCodePoint(char.charCodeAt(0) + 127397),
          );
      const flagEmoji = info.flag !== "🏳️" ? getFlag(info.flag) : "🏳️";

      // 4. LA SALIDA ORIGINAL (Con el costo añadido)
      const response =
        `🏦 <b>INFORMACIÓN DEL BIN</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `💳 <b>BIN:</b> <code>${info.bin}</code>\n` +
        `🌍 <b>País:</b> <code>${info.country} ${flagEmoji}</code>\n` +
        `🏢 <b>Banco:</b> <code>${info.bank}</code>\n` +
        `🏷️ <b>Marca:</b> <code>${info.brand}</code>\n` +
        `📊 <b>Nivel:</b> <code>${info.level}</code>\n` +
        `🎫 <b>Tipo:</b> <code>${info.type}</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Consultado por:</b> <code>${ctx.from.first_name}</code>\n` +
        `💰 <b>Costo:</b> <code>1 Crédito</code>\n` +
        `✨ <b>Powered by:</b> @DevChkBot`;

      await ctx.telegram
        .editMessageText(ctx.chat.id, tempMsg.message_id, null, response, {
          parse_mode: "HTML",
        })
        .catch(() => ctx.replyWithHTML(response));

      // ENVIAR LOG DE COBRO EXITOSO
      await sendLog(
        ctx,
        `💳 <b>BIN CHECK</b>\n👤 User: <code>${userId}</code>\n✅ Estado: Cobrado 1 Cr.`,
      );
    } else {
      // 5. REEMBOLSO SI NO HAY INFO (Refund)
      Credits.add(userId, 1);

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        `❌ <b>BIN NO ENCONTRADO</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `No se encontró información para <code>${query}</code>.\n` +
          `🔄 <b>Tu crédito ha sido devuelto.</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━`,
        { parse_mode: "HTML" },
      );
    }
  } catch (err) {
    // 6. REEMBOLSO SI HAY ERROR DE SERVIDOR (Refund)
    Credits.add(userId, 1);
    console.error("❌ Error en BIN:", err.message);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      tempMsg.message_id,
      null,
      `⚠️ <b>ERROR TÉCNICO</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `Hubo un problema con la API. Tu crédito ha sido devuelto automáticamente.`,
      { parse_mode: "HTML" },
    );
  }
});

// --- COMANDO EX (Extrapolación) ---
bot.command("ex", async (ctx) => {
  const userId = ctx.from.id;

  // 1. LIMPIEZA DE INPUT
  let input = ctx.message.text.replace(/[a-z,A-Z,/,\s]/g, "");

  // 2. VALIDACIÓN DE LONGITUD (Antes de cobrar para ser justos)
  if (input.length < 10) {
    const errorMsg =
      "⚠️ <b>Input muy corto.</b>\nIngresa al menos 10-12 dígitos para extrapolar.";
    if (typeof tempReply === "function") {
      return tempReply(ctx, errorMsg, 5);
    } else {
      return ctx.replyWithHTML(errorMsg);
    }
  }

  // 3. INTENTO DE COBRO
  // Staff y Owner pasan gratis según la lógica de tu CreditsManager
  const paid = Credits.consume(userId);
  if (!paid) {
    return ctx.replyWithHTML(
      `❌ <b>SALDO INSUFICIENTE</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `La extrapolación requiere <b>1 crédito</b>.\n` +
        `💰 <b>Tu saldo:</b> <code>0</code>\n\n` +
        `🛒 Compra créditos con @devcrackpy`,
    );
  }

  try {
    // 4. LÓGICA DE EXTRAPOLACIÓN
    const resultadoExtra = extra(input);

    if (!resultadoExtra) {
      // Si la función extra() falla por alguna razón, devolvemos el crédito
      Credits.add(userId, 1);
      return ctx.replyWithHTML(
        "❌ <b>Error en extrapolación.</b> Crédito devuelto.",
      );
    }

    // 5. RESPUESTA FINAL (Tu diseño original con el costo añadido)
    const response =
      `📊 <b>EXTRAPOLACIÓN DE BIN</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📥 <b>Input:</b> <code>${input}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✨ <b>RESULTADOS:</b>\n` +
      `<code>${resultadoExtra}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💰 <b>Costo:</b> <code>1 Crédito</code>\n` +
      `💎 <b>Checked by:</b> @DevChkBot`;

    await ctx.replyWithHTML(response).catch(async (err) => {
      // Si falla el envío del mensaje, devolvemos el crédito
      Credits.add(userId, 1);
      console.error("❌ Error en comando EX:", err.message);
      ctx.reply("❌ Error al formatear la extrapolación. Crédito devuelto.");
    });

    // 6. LOG DEL SISTEMA
    if (typeof sendLog === "function") {
      await sendLog(
        ctx,
        `📊 <b>EXTRAPOLACIÓN</b>\n👤 User: <code>${userId}</code>\n✅ Estado: Cobrado 1 Cr.`,
      );
    }
  } catch (err) {
    // REEMBOLSO EN CASO DE ERROR CRÍTICO
    Credits.add(userId, 1);
    console.error("❌ Error interno en EX:", err.message);
    ctx.reply("❌ Ocurrió un error inesperado. Tu crédito ha sido devuelto.");
  }
});
// ==================================
// --- CIERRE BLOQUE CMDS PROTECT ---
// ==================================

// ================================
// --- BLOQUE DE ADMINISTRACIÓN ---
// ================================

// --- COMANDO AUTH (Promover a Admin) ---
bot.command("auth", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  const rango = args[2]?.toUpperCase();

  if (!targetId || !["ADMIN", "SELLER", "MOD"].includes(rango)) {
    return ctx.replyWithHTML(
      "⚠️ <b>Uso:</b> <code>/auth [ID] [RANGO]</code>\n<i>Rangos: ADMIN, SELLER, MOD</i>",
    );
  }

  try {
    // Buscamos la identidad en Telegram
    const userChat = await ctx.telegram.getChat(targetId);
    const fullName =
      `${userChat.first_name || ""} ${userChat.last_name || ""}`.trim() ||
      "Usuario";
    const username = userChat.username ? `@${userChat.username}` : "Sin alias";

    // Guardamos con nombre incluido
    Auth.authorize(targetId, rango, fullName);

    await ctx.replyWithHTML(
      `👮 <b>STAFF AUTORIZADO</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Nombre:</b> <code>${fullName}</code>\n` +
        `🎖️ <b>Rango:</b> <code>${rango}</code>\n` +
        `🆔 <b>ID:</b> <code>${targetId}</code>\n\n` +
        `✅ <i>Registrado correctamente en la base de datos.</i>`,
    );
  } catch (error) {
    // Si falla el getChat, autorizamos solo con ID para no frenar el proceso
    Auth.authorize(targetId, rango, "Usuario Desconocido");
    await ctx.replyWithHTML(
      `✅ <b>ID ${targetId} autorizado como ${rango}</b> (Nombre no obtenido).`,
    );
  }

  await sendLog(ctx, `AUTH MANUAL: ${targetId} como ${rango}`);
});

// --- COMANDO UN-AUTH (Revocar acceso) ---
bot.command("unauth", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const targetId = ctx.message.text.split(" ")[1];
  if (!targetId)
    return ctx.replyWithHTML("⚠️ <b>Uso:</b> <code>/unauth [ID]</code>");

  // Buscamos el nombre en nuestra DB antes de borrarlo para el mensaje de confirmación
  const userInDb = Auth.authData.users[targetId];
  const nombreCualquiera = userInDb ? userInDb.name : targetId;

  Auth.unauthorize(targetId);

  await ctx.replyWithHTML(
    `🛡️ <b>RANGO REVOCADO</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Usuario:</b> <code>${nombreCualquiera}</code>\n` +
      `🆔 <b>ID:</b> <code>${targetId}</code>\n\n` +
      `⚠️ <i>El acceso al staff ha sido eliminado.</i>`,
  );

  await sendLog(ctx, `UNAUTH MANUAL: ${targetId}`);
});

// --- COMANDO BROADCAST (MENSAJE MASIVO) ---
bot.command("bc", async (ctx) => {
  // 1. SEGURIDAD: Solo el OWNER puede hacer anuncios globales
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const args = ctx.message.text.split(" ");
  const mode = args[1] ? args[1].toUpperCase() : null; // ALL, VIP, STAFF
  const announcement = args.slice(2).join(" ");

  const validModes = ["ALL", "VIP", "STAFF"];

  if (!mode || !validModes.includes(mode) || !announcement) {
    return ctx.replyWithHTML(
      `📢 <b>SISTEMA DE ANUNCIOS</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `⚠️ <b>Uso:</b> <code>/bc [MODO] [MENSAJE]</code>\n\n` +
        `<b>Modos disponibles:</b>\n` +
        `├ <code>ALL</code> - A todo el mundo\n` +
        `├ <code>VIP</code> - Solo usuarios con Key\n` +
        `└ <code>STAFF</code> - Solo Admins/Sellers/Mods\n\n` +
        `━━━━━━━━━━━━━━━━━━`,
    );
  }

  // 2. FILTRADO DE DESTINATARIOS
  let targets = [];
  if (mode === "ALL" || mode === "STAFF") {
    targets.push(...Object.keys(Auth.authData.users)); // Staff
  }
  if (mode === "ALL" || mode === "VIP") {
    targets.push(...Object.keys(Auth.authData.commonUsers)); // VIPs
  }

  // Eliminar duplicados por si acaso
  const finalTargets = [...new Set(targets)];

  const broadcastMsg =
    `📢 <b>ANUNCIO OFICIAL</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `${announcement}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Enviado por:</b> <i>Administración</i>`;

  // 3. EJECUCIÓN DEL ENVÍO
  ctx.reply(`🚀 Iniciando broadcast para ${finalTargets.length} usuarios...`);

  let successCount = 0;
  for (const id of finalTargets) {
    try {
      await ctx.telegram.sendMessage(id, broadcastMsg, { parse_mode: "HTML" });
      successCount++;
      // Pequeño delay de 50ms para evitar el Rate Limit de Telegram (Flood)
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (err) {
      console.log(`[BC ERROR] No se pudo enviar a ${id}: ${err.message}`);
    }
  }

  ctx.replyWithHTML(
    `✅ <b>Broadcast Finalizado</b>\nEnvíos exitosos: <code>${successCount}</code>`,
  );
});

// --- COMANDO STATS (ESTADÍSTICAS) ---
bot.command("stats", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  // 1. OBTENCIÓN DE DATOS BÁSICOS
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  // Contadores de Staff
  const staffEntries = Object.values(Auth.authData.users);
  const admins = staffEntries.filter((u) => u.rango === "ADMIN").length;
  const sellers = staffEntries.filter((u) => u.rango === "SELLER").length;

  // Contadores de Usuarios y Grupos
  const totalVips = Object.keys(Auth.authData.commonUsers).length;
  const totalGroups = Object.keys(Auth.authData.groups).length;
  const pendingKeys = Object.keys(Auth.authData.activeKeys).length;

  // 2. CÁLCULO DE ECONOMÍA GLOBAL (Créditos en circulación)
  const commonUsersArray = Object.values(Auth.authData.commonUsers);
  const totalCreditsCirculating = commonUsersArray.reduce((acc, user) => {
    return acc + (parseInt(user.credits) || 0);
  }, 0);

  // 3. DISEÑO DEL DASHBOARD ACTUALIZADO
  const statsMsg =
    `🛰 <b>DASHBOARD DE OPERACIONES</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🖥 <b>ESTADO DEL CORE:</b>\n` +
    `├ <b>Status:</b> <code>STABLE</code> 💹\n` +
    `└ <b>Uptime:</b> <code>${hours}h ${minutes}m</code>\n\n` +
    `👮 <b>FUERZA DE STAFF:</b>\n` +
    `├ <b>Admins:</b> <code>${admins}</code>\n` +
    `└ <b>Sellers:</b> <code>${sellers}</code>\n\n` +
    `💎 <b>INFRAESTRUCTURA VIP:</b>\n` +
    `├ <b>Usuarios:</b> <code>${totalVips}</code>\n` +
    `├ <b>Grupos:</b> <code>${totalGroups}</code>\n` +
    `└ <b>Keys Stock:</b> <code>${pendingKeys}</code>\n\n` +
    `💰 <b>ECONOMÍA GLOBAL:</b>\n` +
    `├ <b>Circulante:</b> <code>${totalCreditsCirculating.toLocaleString()} crds</code> 💸\n` +
    `└ <b>Estado:</b> <code>${totalCreditsCirculating > 5000 ? "INFLACIÓN ALTA" : "SALUDABLE"}</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📡 <b>NETWORK:</b> <code>CONNECTED</code>\n` +
    `🕒 <b>Update:</b> <code>${new Date().toLocaleTimeString()}</code>`;

  await ctx.replyWithHTML(
    statsMsg,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔄 REFRESCAR DATOS", "UPDATE_STATS")],
    ]),
  );
});

// --- COMANDO DE ADMINISTRACIÓN: GENERAR KEYS ---
bot.command("genkey", async (ctx) => {
  const userId = ctx.from.id;
  const userStaff = Auth.authData.users[userId];

  // 1. NIVEL DE SEGURIDAD (Jerarquía de Poder)
  const isOwner = userId === Auth.ADMIN_ID;
  const isAdmin = userStaff && userStaff.rango === "ADMIN";
  const isSeller = userStaff && userStaff.rango === "SELLER";

  if (!isOwner && !isAdmin && !isSeller) {
    return ctx.replyWithHTML(
      `❌ <b>ACCESO DENEGADO</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Tu rango actual (<b>${userStaff?.rango || "USUARIO"}</b>) no tiene permisos para generar Keys de acceso.\n` +
        `━━━━━━━━━━━━━━━━━━`,
    );
  }

  // 2. PROCESAMIENTO DE ARGUMENTOS
  const args = ctx.message.text.split(" ");
  const type = args[1] ? args[1].toLowerCase() : "1d"; // Por defecto 1 día

  // Validar que el tipo de duración exista en tu objeto DURATIONS de auth.js
  const validTypes = ["1d", "1w", "1m"];
  if (!validTypes.includes(type)) {
    return ctx.replyWithHTML(
      `⚠️ <b>TIPO INVÁLIDO</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Usa uno de los siguientes formatos:\n` +
        `├ <code>/genkey 1d</code> (Diario)\n` +
        `├ <code>/genkey 1w</code> (Semanal)\n` +
        `└ <code>/genkey 1m</code> (Mensual)\n` +
        `━━━━━━━━━━━━━━━━━━`,
    );
  }

  try {
    // 3. GENERACIÓN DE KEY
    const newKey = Auth.generateKey(type);

    const adminMsg =
      `🔑 <b>NUEVA KEY GENERADA</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🎫 <b>Key:</b> <code>${newKey}</code>\n` +
      `⏳ <b>Duración:</b> <code>${type.toUpperCase()}</code>\n` +
      `👮 <b>Creada por:</b> <code>${ctx.from.first_name}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📌 <i>Toca la key para copiarla.</i>`;

    await ctx.replyWithHTML(adminMsg);

    // 4. LOG DE SEGURIDAD (Opcional: Te avisa al privado cuando un Staff genera una key)
    if (!isOwner) {
      bot.telegram
        .sendMessage(
          Auth.ADMIN_ID,
          `💰 <b>AVISO DE VENTA:</b>\nEl ${userStaff.rango} <b>${ctx.from.first_name}</b> generó una key: <code>${newKey}</code>`,
          { parse_mode: "HTML" },
        )
        .catch(() => {});
    }
  } catch (err) {
    console.error("❌ ERROR EN GENKEY:", err.message);
    ctx.reply("❌ Error crítico al generar la llave.");
  }
});

bot.command(["revokey", "revoke"], async (ctx) => {
  // Solo el OWNER puede usar este comando de limpieza profunda
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const targetId = ctx.message.text.split(" ")[1];

  if (!targetId || isNaN(targetId)) {
    return ctx.replyWithHTML(
      `🛠️ <b>ADMIN REVOKE SYSTEM</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>Uso:</b> <code>/revokey [ID]</code>\n\n` +
        `<i>Este comando elimina tanto el acceso VIP como rangos Staff.</i>\n` +
        `━━━━━━━━━━━━━━━━━━`,
    );
  }

  // Usamos la lógica de unauthorize que ya es capaz de buscar en todas las listas
  const result = Auth.unauthorize(targetId);

  if (result.success) {
    let icon = "🔥";
    let typeHeader = "ACCESO ELIMINADO";

    // Personalizamos el mensaje según lo que el sistema encontró y borró
    if (result.type === "KEY VIP") {
      icon = "🎫";
      typeHeader = "KEY VIP REVOCADA";
    } else if (["ADMIN", "SELLER", "MOD"].includes(result.type)) {
      icon = "🛡️";
      typeHeader = "RANGO STAFF REVOCADO";
    } else if (result.type === "GRUPO") {
      icon = "👥";
      typeHeader = "GRUPO REMOVIDO";
    }

    const msg =
      `${icon} <b>${typeHeader}</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 <b>Nombre:</b> <code>${result.name}</code>\n` +
      `🆔 <b>ID:</b> <code>${targetId}</code>\n` +
      `❌ <b>Rango Anterior:</b> <code>${result.type}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✅ <i>Los datos han sido purgados de la base de datos.</i>`;

    await ctx.replyWithHTML(msg);
  } else {
    ctx.replyWithHTML(
      `❌ <b>ERROR DE REVOCACIÓN</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `El ID <code>${targetId}</code> no se encuentra activo en ninguna lista (VIP, Staff o Grupos).\n` +
        `━━━━━━━━━━━━━━━━━━`,
    );
  }
});

bot.command("clearkeys", async (ctx) => {
  // 1. SEGURIDAD: Solo el OWNER puede borrar la base de datos de keys
  if (ctx.from.id !== Auth.ADMIN_ID) {
    return ctx.replyWithHTML(
      "🚫 <b>ACCESO DENEGADO</b>\nSolo el Owner puede purgar las llaves pendientes.",
    );
  }

  try {
    // 2. EJECUCIÓN: Llamamos a la función de auth.js
    const count = Auth.clearPendingKeys();

    if (count > 0) {
      const successMsg =
        `🧹 <b>PURGA DE LLAVES COMPLETADA</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🗑️ <b>Cantidad eliminada:</b> <code>${count}</code>\n` +
        `📂 <b>Estado:</b> <code>Base de datos limpia</code>\n` +
        `👤 <b>Responsable:</b> <code>${ctx.from.first_name}</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `✅ <i>Todas las llaves no canjeadas han sido borradas permanentemente.</i>`;

      await ctx.replyWithHTML(successMsg);

      // LOG DE CONSOLA
      console.log(
        `[SYSTEM] 🧹 Purga de keys realizada por ${ctx.from.id}. Se borraron ${count} llaves.`,
      );
    } else {
      ctx.replyWithHTML(
        `ℹ️ <b>SISTEMA DE KEYS</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `No hay llaves pendientes por borrar en la base de datos.\n\n` +
          `━━━━━━━━━━━━━━━━━━`,
      );
    }
  } catch (err) {
    console.error("❌ Error en clearkeys:", err.message);
    ctx.reply("❌ Ocurrió un error al intentar limpiar las llaves.");
  }
});

bot.command("list", async (ctx) => {
  // SEGURIDAD: Solo tú (Owner) puedes ver la nómina
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const users = Auth.authData.users;
  const groups = Auth.authData.groups;
  const commonUsers = Auth.authData.commonUsers;

  // 1. FORMATEO DE STAFF
  const staffList =
    Object.entries(users)
      .map(([id, data]) => {
        let icon = "🛡️"; // Default
        if (data.rango === "OWNER") icon = "👑";
        else if (data.rango === "ADMIN") icon = "👮";
        else if (data.rango === "SELLER") icon = "💰";

        return `${icon} <b>${data.name || "Desconocido"}</b> [${data.rango}]\n└ 🆔 <code>${id}</code> | 📦 Cupo: <code>${data.limit || 0}</code>`;
      })
      .join("\n\n") || "<i>No hay Staff registrado</i>";

  // 2. FORMATEO DE GRUPOS
  const groupsList =
    Object.entries(groups)
      .map(([id, name]) => {
        return `👥 <b>${name}</b>\n└ 🆔 <code>${id}</code>`;
      })
      .join("\n\n") || "<i>No hay grupos autorizados</i>";

  // 3. CONTEO DE VIPS
  const totalVips = Object.keys(commonUsers).length;

  const response =
    `📊 <b>REPORTE GLOBAL DEL SISTEMA</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👮 <b>PERSONAL STAFF:</b>\n${staffList}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👥 <b>GRUPOS AUTORIZADOS:</b>\n${groupsList}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💎 <b>MEMBRESÍAS VIP:</b>\n` +
    `✨ Total activos: <code>${totalVips} usuarios</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `✅ <i>Sistema Society . E X E actualizado.</i>`;

  await ctx.replyWithHTML(response);
});

// --- COMANDO BACKUP (RESPALDO DE BASE DE DATOS) ---
bot.command("backup", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  try {
    await ctx.reply("📦 Generando backup de base de datos...");

    // Enviamos los archivos JSON directamente
    await ctx.replyWithDocument({ source: "./authorized_ids.json" });
    await ctx.replyWithDocument({ source: "./keys.json" });

    ctx.reply("✅ Backup enviado correctamente. Guárdalos en un lugar seguro.");
  } catch (e) {
    ctx.reply("❌ Error al generar el backup: " + e.message);
  }
});

// --- BLOCK SYSTEM CREDITS ---
bot.command("addcredits", async (ctx) => {
  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  const amount = args[2];

  if (!targetId || !amount)
    return ctx.reply("⚠️ Uso: /addcredits [ID] [CANTIDAD]");

  const result = CreditsManager.add(targetId, amount, ctx.from.id);

  if (result.success) {
    ctx.replyWithHTML(
      `✅ <b>RECARGA EXITOSA</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>User:</b> <code>${targetId}</code>\n` +
        `💰 <b>Nuevo Saldo:</b> <code>${result.total}</code>\n` +
        `📉 <b>Tu Cupo:</b> <code>${result.remaining}</code>`,
    );
    await sendLog(
      ctx,
      `💰 <b>RECARGA</b>\nOp: ${ctx.from.first_name}\nPara: ${targetId}\nMonto: ${amount}\nCupo: ${result.remaining}`,
    );
  } else {
    ctx.replyWithHTML(`❌ <b>ERROR:</b> ${result.msg}`);
  }
});

// --- Limits Credits for Staff's ---
bot.command("setlimit", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const [_, adminId, amount] = ctx.message.text.split(" ");
  if (!adminId || !amount)
    return ctx.reply("⚠️ /setlimit [ID_ADMIN] [CANTIDAD]");

  const totalCaja = CreditsManager.refillAdminCaja(adminId, amount);

  if (totalCaja !== false) {
    ctx.replyWithHTML(
      `🏦 <b>CAJA CHICA CARGADA</b>\n👮 Admin: <code>${adminId}</code>\n📦 Cupo Actual: <b>${totalCaja}</b>`,
    );
    // Notificar al Admin
    ctx.telegram
      .sendMessage(
        adminId,
        `🏦 Se han asignado <b>${amount} créditos</b> a tu caja de ventas.`,
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  } else {
    ctx.reply("❌ El ID no pertenece a un Admin registrado.");
  }
});

bot.command(["mycaja", "cupo", "limit"], async (ctx) => {
  const userId = ctx.from.id;
  const adminData = Auth.authData.users[userId];
  const isOwner = userId === Auth.ADMIN_ID;

  // 1. Si es el Owner (Tú)
  if (isOwner) {
    return ctx.replyWithHTML(
      `🏦 <b>BANCO CENTRAL (OWNER)</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `👑 <b>Estado:</b> <code>ACTIVO</code>\n` +
        `📦 <b>Cupo:</b> <code>ILIMITADO (∞)</code>\n\n` +
        `<i>Eres el emisor de los créditos del bot.</i>`,
    );
  }

  // 2. Si es Staff (Admin/Seller)
  if (adminData && adminData.rango === "ADMIN") {
    const currentLimit = adminData.limit || 0;

    return ctx.replyWithHTML(
      `💼 <b>MI CAJA CHICA</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `👮 <b>Admin:</b> <code>${ctx.from.first_name}</code>\n` +
        `📦 <b>Cupo Disponible:</b> <code>${currentLimit} créditos</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <i>Cuando tu cupo llegue a 0, deberás solicitar recarga al Owner.</i>`,
    );
  }

  // 3. Si no tiene rango (Usuario normal)
  // No respondemos nada o podemos enviar un mensaje sutil
});

bot.command("remcredits", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const [_, targetId, amount] = ctx.message.text.split(" ");
  if (!targetId || !amount || isNaN(amount))
    return ctx.reply("⚠️ /remcredits [ID] [CANTIDAD]");

  const total = CreditsManager.remove(targetId, amount);

  if (total === false) return ctx.reply("❌ El usuario no existe o no es VIP.");

  ctx.replyWithHTML(
    `✅ <b>Créditos removidos.</b> Nuevo saldo de <code>${targetId}</code>: <b>${total}</b>`,
  );

  await sendLog(
    ctx,
    `📉 <b>REDUCCIÓN DE CRÉDITOS</b>\n` +
      `👮 <b>Admin:</b> ${ctx.from.first_name}\n` +
      `👤 <b>Usuario:</b> <code>${targetId}</code>\n` +
      `💵 <b>Quitado:</b> <code>-${amount}</code>\n` +
      `📉 <b>Total:</b> <code>${total}</code>`,
  );
});

bot.command("resetcredits", async (ctx) => {
  // SEGURIDAD: Solo tú (Owner) puedes ver esto
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  await ctx.replyWithHTML(
    `⚠️ <b>¡ADVERTENCIA DE SEGURIDAD!</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `Estás a punto de <b>BORRAR TODOS</b> los créditos de los usuarios del sistema.\n\n` +
      `¿Estás absolutamente seguro de realizar esta acción?`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "☢️ SÍ, REINICIAR TODO",
          "CONFIRM_RESET_ECONOMY",
        ),
        Markup.button.callback("❌ CANCELAR", "CANCEL_RESET"),
      ],
    ]),
  );
});

bot.command(["adm", "panel", "staff"], async (ctx) => {
  const userId = ctx.from.id;
  const adminData = Auth.authData.users[userId];
  const isOwner = userId === Auth.ADMIN_ID;

  // Si no tiene rango administrativo, el bot ignora el comando
  if (
    !isOwner &&
    (!adminData || !["ADMIN", "SELLER"].includes(adminData.rango))
  )
    return;

  const cupo = isOwner ? "ILIMITADO (∞)" : adminData.limit || 0;

  let admMsg =
    `🛠️ <b>PANEL DE ADMINISTRACIÓN</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👮 <b>GESTIÓN DE STAFF:</b>\n` +
    `├ <code>/mycaja</code> - Ver tu cupo: <b>${cupo}</b>\n` +
    `├ <code>/addcredits [ID] [CANT]</code> - Recargar saldo\n` +
    `├ <code>/remcredits [ID] [CANT]</code> - Quitar saldo\n` +
    `└ <code>/genkey [1d/1w/1m]</code> - Generar Key\n\n`;

  // Comandos exclusivos para ti (Owner)
  if (isOwner) {
    admMsg +=
      `👑 <b>CONTROL TOTAL (OWNER):</b>\n` +
      `├ <code>/setlimit [ID] [CANT]</code> - Fondear Admin\n` +
      `├ <code>/auth [ID] [RANGO]</code> - Dar rango Staff\n` +
      `├ <code>/unauth [ID]</code> - Quitar rango Staff\n` +
      `├ <code>/resetcredits</code> - Limpiar economía\n` +
      `├ <code>/bc [ALL/VIP] [MSG]</code> - Broadcast\n` +
      `├ <code>/stats</code> | <code>/list</code> - Reportes\n` +
      `└ <code>/clean</code> | <code>/backup</code> - Sistema\n\n`;
  }

  admMsg += `━━━━━━━━━━━━━━━━━━\n⚙️ <b>Acceso:</b> <code>${isOwner ? "OWNER" : adminData.rango}</code>`;

  await ctx.replyWithHTML(admMsg);
});

bot.command(["clean", "purgegroups"], async (ctx) => {
  // 1. SEGURIDAD: Solo el OWNER puede limpiar la base de datos
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const allGroups = Object.entries(Auth.authData.groups);
  if (allGroups.length === 0) {
    return ctx.replyWithHTML(
      "👥 <b>LIMPIEZA DE GRUPOS</b>\n━━━━━━━━━━━━━━━━━━\nNo hay grupos registrados para limpiar.",
    );
  }

  const tempMsg = await ctx.replyWithHTML(
    `🧹 <b>Iniciando limpieza...</b>\nAnalizando <code>${allGroups.length}</code> grupos.`,
  );

  let removedCount = 0;
  let activeCount = 0;

  for (const [groupId, name] of allGroups) {
    try {
      // Intentamos obtener info del grupo
      await ctx.telegram.getChat(groupId);
      activeCount++;
    } catch (err) {
      // Si da error (bot bloqueado, expulsado o chat borrado), lo eliminamos
      delete Auth.authData.groups[groupId];
      removedCount++;
      console.log(
        `[CLEAN] 🗑️ Removido grupo inactivo/inexistente: ${name} (${groupId})`,
      );
    }
    // Pequeño delay para no saturar la API de Telegram
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (removedCount > 0) Auth.saveIds();

  const finalMsg =
    `🧹 <b>LIMPIEZA COMPLETADA</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `✅ <b>Grupos activos:</b> <code>${activeCount}</code>\n` +
    `🗑️ <b>Grupos eliminados:</b> <code>${removedCount}</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `✨ <i>Tu base de datos de grupos está optimizada.</i>`;

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    tempMsg.message_id,
    null,
    finalMsg,
    { parse_mode: "HTML" },
  );

  // LOG DEL SISTEMA
  if (typeof sendLog === "function") {
    await sendLog(
      ctx,
      `🧹 <b>PURGA DE GRUPOS</b>\nAdmin: ${ctx.from.first_name}\nRemovidos: ${removedCount} grupos.`,
    );
  }
});

// --- Bloque de Configuración Maestra ---
bot.command("config", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;
  delete userState[ctx.from.id];

  await ctx.replyWithHTML(
    `⚙️ <b>CONFIGURACIÓN MAESTRA</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `Selecciona qué deseas gestionar:`,
    Markup.inlineKeyboard([
      // Usaremos SET_STATE_ para que el manejador lo atrape
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
// --- Cierre bloque Configuración ---

// ====================================
// --- CIERRE BLOQUE ADMINISTRACIÓN ---
// ====================================

// ====================================
// ---  SendLog Channel Telegram    ---
// ====================================
const sendLog = async (msg) => {
  const logChannel = process.env.LOG_CHANNEL_ID;
  if (!logChannel) {
    console.log("⚠️ No se ha configurado LOG_CHANNEL_ID en el .env");
    return;
  }

  try {
    await bot.telegram.sendMessage(
      logChannel,
      `📝 <b>SISTEMA DE LOGS</b>\n━━━━━━━━━━━━━━━━━━\n${msg}`,
      {
        parse_mode: "HTML",
        disable_notification: false,
      },
    );
  } catch (e) {
    console.error("❌ ERROR EN CHANNEL LOG:", e.description || e.message);
    if (e.description && e.description.includes("chat not found")) {
      console.log(
        "💡 TIP: Asegúrate de que el bot sea ADMINISTRADOR del canal.",
      );
    }
  }
};
// =============================
// ---  END Block SenLog    ---
// =============================

// ====================================
// --- CARGAR HANDLERS DE CALLBACKS ---
// ====================================
require("./handlers/callbacks")(
  bot,
  userState,
  getUserProfile,
  CreditsManager,
  sendLog,
);

// ==========================
// --- Block Starting Bot ---
// ==========================
const iniciarBot = async (reintentos = 0) => {
  try {
    console.log("🚀 Intentando conectar con Telegram...");
    await bot.launch();
    console.log("✅ DevChk Bot en línea.");
  } catch (error) {
    const delay = Math.min(30000, (reintentos + 1) * 5000); // Máximo 30 seg de espera
    console.error(
      `❌ Error de conexión (${error.code || "TIMEOUT"}): ${error.message}`,
    );
    console.log(`🔄 Reintentando en ${delay / 1000} segundos...`);

    setTimeout(() => iniciarBot(reintentos + 1), delay);
  }
};

// Manejo de señales del sistema para cierre limpio
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Arrancar
iniciarBot();

// =====================================
// --- FUNCIONES AUXILIARES (ÚNICAS) ---
// =====================================
const fs = require("fs");
const CACHE_PATH = "./bins_cache.json";

// Cargar caché al iniciar
let binCache = {};
if (fs.existsSync(CACHE_PATH)) {
  binCache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
}

// FUNCIÓN AUXILIAR: Respuesta temporal (Se auto-elimina)
const tempReply = async (ctx, text, seconds = 5) => {
  try {
    const msg = await ctx.replyWithHTML(text);
    setTimeout(() => {
      ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    }, seconds * 1000);
  } catch (err) {
    console.log("Error en tempReply:", err.message);
  }
};

// FUNCIÓN GENERADOR DE TARJETAS: Retorna una tarjeta válida según Luhn
function generarTarjeta(bin) {
  return Generador(bin);
}

async function getBinInfo(binNum) {
  const cleanBin = binNum.toString().replace(/\D/g, "").substring(0, 6);
  if (cleanBin.length < 6) return "⚠️ <b>BIN:</b> Formato inválido.";

  try {
    const response = await axios.get(`https://lookup.binlist.net/${cleanBin}`, {
      headers: { "Accept-Version": "3" },
      timeout: 5000,
    });

    const d = response.data;

    // Extraemos y formateamos con valores por defecto
    const brand = (d.scheme || "Desconocido").toUpperCase();
    const type = (d.type || "N/A").toUpperCase(); // DEBIT o CREDIT
    const level = (d.brand || "STANDARD").toUpperCase(); // PLATINUM, BUSINESS, etc.
    const bank = (d.bank?.name || "Emisor Desconocido").replace(/[&<>]/g, "");
    const country = d.country?.name || "Global";
    const emoji = d.country?.emoji || "🌐";
    const currency = d.country?.currency || "N/A";

    return (
      `🔍 <b>CONSULTA DE BIN</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💳 <b>BIN:</b> <code>${cleanBin}</code>\n` +
      `🏦 <b>Banco:</b> <code>${bank}</code>\n` +
      `🌍 <b>País:</b> ${emoji} ${country}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✨ <b>DETALLES TÉCNICOS:</b>\n` +
      `├ <b>Marca:</b> <code>${brand}</code>\n` +
      `├ <b>Nivel:</b> <code>${level}</code>\n` +
      `├ <b>Tipo:</b> <code>${type}</code>\n` +
      `└ <b>Moneda:</b> <code>${currency}</code>\n` +
      `━━━━━━━━━━━━━━━━━━`
    );
  } catch (error) {
    console.log(`[LOG] Fallo BIN ${cleanBin}: ${error.message}`);
    return (
      `🔍 <b>CONSULTA DE BIN</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💳 <b>BIN:</b> <code>${cleanBin}</code>\n` +
      `❌ <b>Estado:</b> Información no disponible\n` +
      `━━━━━━━━━━━━━━━━━━`
    );
  }
}
