require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const Auth = require("./funcionalidades/auth.js");
const Generador = require("./funcionalidades/generador.js");
const valLuhn = require("./funcionalidades/luhn.js");
const extra = require("./funcionalidades/extra.js");
const consultarBIN = require("./funcionalidades/bin.js");
const axios = require("axios");

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

  // 1. BUSCAR DATA EN EL SISTEMA
  const staffData = Auth.authData.users[userId]; // { name, rango }
  const vipData = Auth.authData.commonUsers[userId]; // { expiration, name, lastName }
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
    // Iconos dinámicos según el rango que definimos
    icon = rangoText === "ADMIN" ? "👮" : rangoText === "SELLER" ? "💰" : "🛡️";
  } else if (vipData) {
    rangoText = "PREMIUM (VIP)";
    expText = new Date(vipData.expiration).toLocaleString();
    icon = "💎";
  }

  // 3. CONSTRUCCIÓN DEL MENSAJE (Tu diseño original mejorado)
  let statusMsg =
    `${icon} <b>MI PERFIL</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `📝 <b>Nombre:</b> <code>${ctx.from.first_name || "User"}</code>\n` +
    `🆔 <b>ID:</b> <code>${userId}</code>\n` +
    `🎖️ <b>Rango:</b> <code>${rangoText}</code>\n` +
    `📅 <b>Expira:</b> <code>${expText}</code>\n`;

  // 4. DETECCIÓN DE GRUPO (Muy útil para ti como admin)
  if (isGroup) {
    const groupAuth = Auth.authData.groups.has(chatId)
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
    statusMsg += `🛒 <b>Adquiere una key:</b> @devcrackpy`;
  } else {
    statusMsg += `🚀 <b>¡Disfruta tus beneficios!</b>`;
  }

  await ctx.replyWithHTML(statusMsg).catch((err) => {
    console.error("❌ Error en comando Status:", err.message);
  });
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
  const args = ctx.message.text.split(" ");
  const binInput = args[1];

  // 1. VALIDACIÓN DE ENTRADA
  if (!binInput || binInput.length < 6) {
    return ctx.replyWithHTML(
      `🎲 <b>GENERADOR DE TARJETAS</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>Uso:</b> <code>/gen 454545</code>\n\n` +
        `<i>Ingresa el BIN para generar 10 tarjetas con su respectiva información bancaria.</i>\n` +
        `━━━━━━━━━━━━━━━━━━`,
    );
  }

  const query = binInput.slice(0, 6);
  const tempMsg = await ctx.replyWithHTML(
    `⏳ <b>Consultando BIN y generando...</b>`,
  );

  try {
    // 2. OBTENER INFO DEL BIN (HandyAPI)
    const info = await consultarBIN(query);

    // 3. GENERAR TARJETAS (Asumiendo que tienes tu lógica de luhn)
    // Aquí puedes llamar a tu función de generación, generaremos 10 por defecto
    const cards = [];
    for (let i = 0; i < 10; i++) {
      cards.push(generarTarjeta(binInput)); // Usa tu función actual de generación
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

      // 4. ESTRUCTURA DE SALIDA PREMIUM
      const response =
        `🎲 <b>TARJETAS GENERADAS</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🏦 <b>Banco:</b> <code>${info.bank}</code>\n` +
        `🌍 <b>País:</b> <code>${info.country} ${flagEmoji}</code>\n` +
        `🏷️ <b>Nivel:</b> <code>${info.brand} ${info.level}</code>\n\n` +
        `💳 <b>LISTA:</b>\n${cardList}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Generado por:</b> <code>${ctx.from.first_name}</code>\n` +
        `✨ <b>Powered by:</b> @DevChkBot`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        response,
        { parse_mode: "HTML" },
      );
    } else {
      // Fallback si la API no encuentra el BIN pero igual generamos
      const fallback =
        `🎲 <b>TARJETAS GENERADAS</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `💳 <b>BIN:</b> <code>${query}</code>\n\n` +
        `${cardList}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <i>No se encontró información del banco.</i>`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        fallback,
        { parse_mode: "HTML" },
      );
    }
  } catch (err) {
    console.error("❌ Error en GEN:", err.message);
    ctx.reply("❌ Error al generar tarjetas.");
  }
});

// --- /BIN Command ---
bot.command("bin", async (ctx) => {
  const binInput = ctx.message.text.split(" ")[1];

  // 1. VALIDACIÓN INICIAL (Tu lógica original)
  if (!binInput || binInput.length < 6) {
    return tempReply(ctx, "⚠️ <b>Uso:</b> <code>/bin 454545</code>", 5);
  }

  const query = binInput.slice(0, 6);
  // Mensaje temporal "Cargando..."
  const tempMsg = await ctx.replyWithHTML(
    `⏳ <b>Consultando BIN:</b> <code>${query}</code>...`,
  );

  try {
    // 2. CONSULTA A LA API (HandyAPI)
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

      // 3. LA SALIDA QUE QUIERES MANTENER (Tu diseño exacto)
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
        `✨ <b>Powered by:</b> @DevChkBot`;

      // EDITAMOS el mensaje de carga con la info final
      await ctx.telegram
        .editMessageText(ctx.chat.id, tempMsg.message_id, null, response, {
          parse_mode: "HTML",
        })
        .catch(() => ctx.replyWithHTML(response));
    } else {
      // Si el BIN no existe
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        tempMsg.message_id,
        null,
        `❌ <b>BIN NO ENCONTRADO</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `No se encontró información para <code>${query}</code>.\n\n` +
          `━━━━━━━━━━━━━━━━━━`,
        { parse_mode: "HTML" },
      );
    }
  } catch (err) {
    console.error("❌ Error en BIN:", err.message);
    ctx.reply("❌ Error al consultar BIN.");
  }
});

// --- COMANDO EX (Extrapolación) ---
bot.command("ex", async (ctx) => {
  // Limpiamos el input dejando solo números
  let input = ctx.message.text.replace(/[a-z,A-Z,/,\s]/g, "");

  if (input.length >= 10) {
    // Obtenemos el resultado de tu función extra()
    const resultadoExtra = extra(input);

    const response =
      `📊 <b>EXTRAPOLACIÓN DE BIN</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📥 <b>Input:</b> <code>${input}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✨ <b>RESULTADOS:</b>\n` +
      `<code>${resultadoExtra}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💎 <b>Checked by:</b> @DevChkBot`;

    await ctx.replyWithHTML(response).catch((err) => {
      console.error("❌ Error en comando EX:", err.message);
      ctx.reply("❌ Error al formatear la extrapolación.");
    });
  } else {
    // Usamos tempReply si ya la tienes implementada para no ensuciar el chat
    const errorMsg =
      "⚠️ <b>Input muy corto.</b>\nIngresa al menos 10-12 dígitos para extrapolar.";
    if (typeof tempReply === "function") {
      tempReply(ctx, errorMsg, 5);
    } else {
      ctx.replyWithHTML(errorMsg);
    }
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
