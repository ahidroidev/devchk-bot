require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const Auth = require("./funcionalidades/auth.js");
const Generador = require("./funcionalidades/generador.js");
const valLuhn = require("./funcionalidades/luhn.js");
const extra = require("./funcionalidades/extra.js");
const consultarBIN = require("./funcionalidades/bin.js");
const axios = require("axios");
const CreditsManager = require("./database/credits.js");

const Token = process.env.BOT_TOKEN;
if (!Token) throw new Error("Falta BOT_TOKEN en las variables de entorno.");
const bot = new Telegraf(Token);

// ==========================================
// 1. BLOQUE PÚBLICO
// Comandos que CUALQUIERA puede usar (Sin Key)
// ==========================================

bot.start((ctx) => {
  const welcomeMessage =
    "🛡️ <b>DevChk Bot | Bienvenido</b>\n" +
    "━━━━━━━━━━━━━━━━━━\n\n" +
    "Hola <b>" +
    (ctx.from.first_name || "User") +
    "</b>, al CHK de Society . E X E\n\n" +
    "⚠️ <b>ESTADO DE ACCESO:</b>\n" +
    "Actualmente no tienes una suscripción activa. Para desbloquear los comandos, por favor canjea una Key.\n\n" +
    "💎 <b>BENEFICIOS PREMIUM:</b>\n" +
    " ✅ Generador sin límites.\n" +
    " ✅ Consulta de BINs ilimitada.\n" +
    " ✅ Soporte técnico 24/7.\n\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "🆔 <b>Tu ID:</b> <code>" +
    ctx.from.id +
    "</code>";

  ctx.replyWithHTML(
    welcomeMessage,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🔑 Canjear Key", "REDEEM_HELP"),
        Markup.button.url("🛒 Adquirir Acceso", "https://t.me/devcrackpy"),
      ],
      [Markup.button.callback("📩 Comprar KEY", `SHOW_PRICES`)],
    ]),
  );
});

bot.action("REDEEM_HELP", (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithHTML(
    "📝 <b>¿Cómo canjear tu Key?</b>\n\n" +
      "Es muy simple, solo debes escribir el comando seguido de tu código:\n" +
      "👉 <code>/redeem DEV-1D-XXXXX</code>",
  );
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

bot.command(["status", "me", "my", "profile"], async (ctx) => {
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
  const rangoInput = args[2] ? args[2].toUpperCase() : "MOD";

  if (!targetId || isNaN(targetId)) {
    return ctx.replyWithHTML(
      "⚠️ <b>Uso:</b> <code>/auth [ID] [SELLER/ADMIN/MOD]</code>",
    );
  }

  const result = Auth.authorize(targetId, "Staff", rangoInput);

  if (result.success) {
    let icon = "🛡️";
    let color = "MODERADOR ASIGNADO";

    if (result.type === "GRUPO") {
      icon = "👥";
      color = "GRUPO AUTORIZADO";
    } else if (result.type === "ADMIN") {
      icon = "👮";
      color = "ADMINISTRADOR ASIGNADO";
    } else if (result.type === "SELLER") {
      icon = "💰";
      color = "VENDEDOR (SELLER) ACTIVADO";
    }

    const msg =
      `${icon} <b>${color}</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🆔 <b>ID:</b> <code>${targetId}</code>\n` +
      `🎖️ <b>Rango:</b> <code>${result.type}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✅ Registro actualizado correctamente.`;

    ctx.replyWithHTML(msg);
  }
});

// --- COMANDO UN-AUTH (Revocar acceso) ---
bot.command("unauth", async (ctx) => {
  // Solo el OWNER puede quitar rangos de Staff
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const targetId = ctx.message.text.split(" ")[1];

  if (!targetId || isNaN(targetId)) {
    return ctx.replyWithHTML("⚠️ <b>Uso:</b> <code>/unauth [ID]</code>");
  }

  const result = Auth.unauthorize(targetId);

  if (result.success) {
    let icon = "🔨";
    if (result.type === "GRUPO") icon = "🗑️";
    if (result.type === "KEY VIP") icon = "🎫";

    const msg =
      `${icon} <b>ACCESO REVOCADO</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 <b>Nombre:</b> <code>${result.name}</code>\n` +
      `🆔 <b>ID:</b> <code>${targetId}</code>\n` +
      `❌ <b>Tipo:</b> <code>${result.type}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✅ El registro ha sido eliminado del sistema.`;

    await ctx.replyWithHTML(msg);
  } else {
    ctx.replyWithHTML(
      "❌ <b>Error:</b> El ID no se encuentra en ninguna lista activa (Staff, VIP o Grupos).",
    );
  }
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

  // 1. OBTENCIÓN DE DATOS
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  // Contadores de Staff
  const staffEntries = Object.values(Auth.authData.users);
  const admins = staffEntries.filter((u) => u.rango === "ADMIN").length;
  const sellers = staffEntries.filter((u) => u.rango === "SELLER").length;
  const mods = staffEntries.filter((u) => u.rango === "MOD").length;

  // Contadores de Usuarios y Keys
  const totalVips = Object.keys(Auth.authData.commonUsers).length;
  const pendingKeys = Object.keys(Auth.authData.activeKeys).length;
  const totalGroups = Auth.authData.groups.size;

  // 2. DISEÑO DEL DASHBOARD
  const statsMsg =
    `📊 <b>ESTADÍSTICAS DEL SISTEMA</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🖥 <b>SERVIDOR:</b>\n` +
    `├ <b>Estado:</b> <code>ONLINE</code> 🟢\n` +
    `└ <b>Uptime:</b> <code>${hours}h ${minutes}m</code>\n\n` +
    `👥 <b>PERSONAL (STAFF):</b>\n` +
    `├ <b>Admins:</b> <code>${admins}</code>\n` +
    `├ <b>Sellers:</b> <code>${sellers}</code>\n` +
    `└ <b>Mods:</b> <code>${mods}</code>\n\n` +
    `💎 <b>CLIENTES & ACCESOS:</b>\n` +
    `├ <b>VIP Activos:</b> <code>${totalVips}</code>\n` +
    `├ <b>Grupos:</b> <code>${totalGroups}</code>\n` +
    `└ <b>Keys Pendientes:</b> <code>${pendingKeys}</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `⚙️ <b>VERSIÓN:</b> <code>3.5.0 - PRO</code>`;

  await ctx.replyWithHTML(statsMsg);
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
        `👮 <b>Responsable:</b> <code>${ctx.from.first_name}</code>\n\n` +
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
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const allAdmins = Object.entries(Auth.authData.users);
  const allVips = Object.entries(Auth.authData.commonUsers);
  const allGroups = Object.entries(Auth.authData.groups);

  // Mapeo de Grupos con su Nombre
  const groupsList =
    allGroups
      .map(([id, name]) => `👥 <b>${name}</b>\n└ 🆔 <code>${id}</code>`)
      .join("\n\n") || "<i>No hay grupos autorizados</i>";

  // Mapeo de Staff (Igual que antes pero agrupado)
  const staffList =
    allAdmins
      .map(([id, data]) => {
        const icon =
          data.rango === "ADMIN" ? "👮" : data.rango === "SELLER" ? "💰" : "🛡️";
        return `${icon} <b>${data.name}</b> [${data.rango}]\n└ 🆔 <code>${id}</code>`;
      })
      .join("\n\n") || "<i>Sin Staff</i>";

  const response =
    `📊 <b>REGISTRO TOTAL DEL SISTEMA</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👑 <b>OWNER</b>\n└ 🆔 <code>${Auth.ADMIN_ID}</code>\n\n` +
    `👮 <b>PERSONAL STAFF</b>\n${staffList}\n\n` +
    `👥 <b>GRUPOS AUTORIZADOS</b>\n${groupsList}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💎 <b>CLIENTES VIP ACTIVOS</b>\n` +
    `✨ Total: <code>${allVips.length}</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `✅ <i>Usa /unauth [ID] para revocar cualquier acceso.</i>`;

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

// ====================================
// --- CIERRE BLOQUE ADMINISTRACIÓN ---
// ====================================

// ====================================
// --- CALLBACK QUERIES & SOLICITUDES ---
// Reemplaza o limpia tu bloque de callback_query por este:
// ====================================
// --- MANEJADOR UNIFICADO DE BOTONES ---
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  console.log(`[DEBUG] Botón presionado: ${data}`);

  try {
    await ctx.answerCbQuery().catch(() => {});
  } catch (e) {
    console.log("Error al responder callback");
  }

  // --- 1. SECCIÓN DE AYUDA (HELP SYSTEM) ---

  if (data === "HELP_GEN") {
    const text =
      `💳 <b>GUÍA: GENERADOR</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `El comando <code>/gen</code> crea tarjetas basadas en un BIN.\n\n` +
      `📝 <b>Uso:</b> <code>/gen 454545 10</code>\n` +
      `💡 <i>Máximo 15 tarjetas por solicitud.</i>`;
    return ctx
      .editMessageText(text, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ VOLVER", "BACK_HELP")],
        ]),
      })
      .catch(() => {});
  }

  if (data === "HELP_KEYS") {
    const text =
      `🔑 <b>SISTEMA DE KEYS</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `1️⃣ Compra tu key con el Admin.\n` +
      `2️⃣ Usa el comando: <code>/redeem KEY-XXXX</code>\n` +
      `3️⃣ Acceso instantáneo al bot.\n\n` +
      `⚠️ <i>Las keys son de un solo uso.</i>`;
    return ctx
      .editMessageText(text, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ VOLVER", "BACK_HELP")],
        ]),
      })
      .catch(() => {});
  }

  if (data === "HELP_EXTRA") {
    const text =
      `📊 <b>GUÍA: EXTRAPOLACIÓN</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `Encuentra patrones de tarjetas válidas.\n\n` +
      `📝 <b>Uso:</b> <code>/ex 489504xxxxxxxxxx</code>\n` +
      `💡 <i>Usa al menos 12 dígitos para mayor precisión.</i>`;
    return ctx
      .editMessageText(text, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ VOLVER", "BACK_HELP")],
        ]),
      })
      .catch(() => {});
  }

  if (data === "BACK_HELP") {
    const helpMenu =
      `📖 <b>CENTRO DE AYUDA</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `Selecciona una categoría para ver los detalles:\n\n` +
      `🚀 <b>HERRAMIENTAS:</b>\n` +
      `├ <code>/gen</code> - Generador\n` +
      `├ <code>/bin</code> - Info de banco\n` +
      `└ <code>/ex</code> - Extrapolación`;
    return ctx
      .editMessageText(helpMenu, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("💳 GENERADOR", "HELP_GEN"),
            Markup.button.callback("🔑 KEYS", "HELP_KEYS"),
          ],
          [
            Markup.button.callback("📊 EXTRAPOLAR", "HELP_EXTRA"),
            Markup.button.url("🛒 COMPRAR", "https://t.me/devcrackpy"),
          ],
        ]),
      })
      .catch(() => {});
  }

  // --- 2. TU LÓGICA EXISTENTE (PRICES, REDEEM, BACK) ---

  if (data === "SHOW_PRICES") {
    const prices =
      "💎 <b>PLANES DISPONIBLES</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "🔵 <b>Diario:</b> <code>$2.00 USD</code>\n" +
      "🟢 <b>Semanal:</b> <code>$7.00 USD</code>\n" +
      "🔴 <b>Mensual:</b> <code>$20.00 USD</code>\n\n" +
      "💰 <b>Métodos:</b> Binance, Saldo Forobeta, Criptos.";

    return ctx
      .editMessageText(prices, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.url("🛒 Hablar con Admin", "https://t.me/devcrackpy")],
          [Markup.button.callback("🔙 Volver", "BACK_TO_DENIED")],
        ]),
      })
      .catch((err) => console.log("Error precios:", err.message));
  }

  if (data === "REDEEM_HELP") {
    return ctx
      .replyWithHTML(
        "📝 <b>¿Cómo activar tu Key?</b>\n\n" +
          "Usa el comando seguido de tu código:\n" +
          "👉 <code>/redeem DEV-XXXX-XXXX</code>",
      )
      .catch((err) => console.log("Error redeem help:", err.message));
  }

  if (data === "BACK_TO_DENIED") {
    return ctx
      .editMessageText(
        `🚫 <b>ACCESO RESTRINGIDO</b>\n━━━━━━━━━━━━━━━━━━\n` +
          `Necesitas una suscripción activa.\n\n` +
          `🆔 ID: <code>${ctx.from.id}</code>`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("💳 Ver Planes", "SHOW_PRICES"),
              Markup.button.callback("🔑 Canjear", "REDEEM_HELP"),
            ],
            [Markup.button.url("🛒 Comprar Key", "https://t.me/devcrackpy")],
          ]),
        },
      )
      .catch((err) => console.log("Error back denied:", err.message));
  }

  // --- LÓGICA DE RESET DE ECONOMÍA ---
  if (data === "CONFIRM_RESET_ECONOMY") {
    // Verificación extra de seguridad: solo el Admin ID puede presionar el botón
    if (ctx.from.id !== Auth.ADMIN_ID) {
      return ctx.answerCbQuery("🚫 No tienes permiso para esto.", {
        show_alert: true,
      });
    }

    const totalUsers = CreditsManager.clearAll();

    await ctx.editMessageText(
      `☢️ <b>ECONOMÍA RESETEADA</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Se han limpiado los créditos de <b>${totalUsers}</b> usuarios.\n` +
        `📊 <b>Estado:</b> <code>CERO ABSOLUTO</code>\n` +
        `━━━━━━━━━━━━━━━━━━`,
      { parse_mode: "HTML" },
    );

    // Log para el canal
    await sendLog(
      ctx,
      `RESETEO TOTAL DE ECONOMÍA (Usuarios afectados: ${totalUsers})`,
    );
  }

  if (data === "CANCEL_RESET") {
    await ctx.editMessageText(
      "✅ <b>Acción cancelada.</b> La economía sigue intacta.",
      { parse_mode: "HTML" },
    );
  }
});

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
    // Usamos el método directo de telegram para evitar problemas de contexto
    await bot.telegram.sendMessage(
      logChannel,
      `📝 <b>SISTEMA DE LOGS</b>\n━━━━━━━━━━━━━━━━━━\n${msg}`,
      {
        parse_mode: "HTML",
        disable_notification: false, // Esto hará que el canal suene al recibir el log
      },
    );
  } catch (e) {
    // Si el bot no es admin o el ID está mal, aquí te dirá el porqué
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
