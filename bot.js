require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const Auth = require("./funcionalidades/auth.js");
const Generador = require("./funcionalidades/generador.js");
const valLuhn = require("./funcionalidades/luhn.js");
const extra = require("./funcionalidades/extra.js");
const consultarBIN = require("./funcionalidades/bin.js");

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
    "</b>, soy tu asistente de generación y validación.\n\n" +
    "⚠️ <b>ESTADO DE ACCESO:</b>\n" +
    "Actualmente no tienes una suscripción activa. Para desbloquear el menú de herramientas, por favor canjea una Key.\n\n" +
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

bot.command("info", async (ctx) => {
  const infoMessage =
    "🚀 <b>DevChk Bot | Premium Tools</b>\n" +
    "━━━━━━━━━━━━━━━━━━\n\n" +
    "✨ <b>COMANDOS DISPONIBLES</b>\n" +
    " ├ 💳 <code>/gen [bin]</code> - Generador Avanzado\n" +
    " ├ 🔍 <code>/bin [bin]</code> - Info de BIN (Bank)\n" +
    " └ 📊 <code>/ex [bin]</code> - Extrapolación\n\n" +
    "🔐 <b>ACCESO Y ESTADO</b>\n" +
    " ├ 🆔 <code>/id</code> - Ver tu ID de usuario\n" +
    " ├ ⏳ <code>/status</code> - Tiempo de Key restante\n" +
    " └ 🔑 <code>/redeem [key]</code> - Canjear acceso\n\n" +
    "📢 <b>SOPORTE</b>\n" +
    "Si necesitas adquirir una Key o tienes dudas, contacta al administrador.\n\n" +
    "👤 <b>Owner:</b> @devcrackpy\n" +
    "━━━━━━━━━━━━━━━━━━";

  ctx.replyWithHTML(
    infoMessage,
    Markup.inlineKeyboard([
      [
        Markup.button.url("👨‍💻 Soporte", "https://t.me/devcrackpy"),
        Markup.button.callback("💳 Comprar Key", "REQ_PURCHASE"), // O el callback que prefieras
      ],
    ]),
  );
});

// EL COMANDO REDEEM DEBE SER PÚBLICO
bot.command("redeem", (ctx) => {
  const key = ctx.message.text.split(" ")[1];
  if (!key) return ctx.reply("⚠️ Uso: /redeem KEY-XXXX");

  // Pasamos ctx.from.first_name como tercer argumento
  const expiryDate = Auth.redeemKey(ctx.from.id, key, ctx.from.first_name);
  if (expiryDate) {
    ctx.replyWithHTML(
      `✅ <b>Acceso activado</b>\n👤 Usuario: <code>${ctx.from.first_name}</code>\n📅 Expira: <code>${expiryDate}</code>`,
    );
    sendLog(
      `🆕 <b>Key Canjeada</b>\n👤 Usuario: <code>${ctx.from.first_name}</code>\n🆔 ID: <code>${ctx.from.id}</code>\n🔑 Key: <code>${key}</code>\n⌛ Expira: <code>${expiryDate}</code>`,
    );
  } else {
    ctx.reply("❌ Key inválida.");
  }
});

/**bot.command("testlog", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;
  await sendLog("🧪 Prueba de conexión exitosa desde el comando /testlog");
  ctx.reply("Intentando enviar log al canal... Revisa la consola y el canal.");
});
**/
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

// ==========================================
// 4. BLOQUE PROTEGIDO (Requiere KEY o ser ADMIN)
// ==========================================

bot.command("status", (ctx) => {
  const userId = ctx.from.id;
  const expiration = Auth.authData.commonUsers[userId];

  if (userId === Auth.ADMIN_ID || Auth.authData.users.has(userId)) {
    return ctx.reply("👮 Rango: Administrador (Acceso Permanente)");
  }

  if (expiration) {
    const remaining = expiration - Date.now();
    if (remaining > 0) {
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      return ctx.reply(
        `⏳ Tu acceso expira en ${hours} horas y ${mins} minutos.`,
      );
    }
  }
  ctx.reply("❌ No tienes acceso activo.");
});

bot.command("gen", (ctx) => Gen(ctx));

bot.command("bin", async (ctx) => {
  const txt = await bin(ctx);
  ctx.reply(txt);
});

bot.command("ex", (ctx) => {
  let message = ctx.message.text.replace(/[a-z,A-Z,/,\s]/g, "");
  if (message.length > 14) {
    const reply = "Extrapolation " + message + "\n" + extra(message);
    ctx.reply(reply);
  } else {
    ctx.reply("⚠️ Input too short for extrapolation.");
  }
});

// ==========================================
// 5. BLOQUE DE ADMINISTRACIÓN
// ==========================================

bot.command("auth", (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const args = ctx.message.text.split(" ");
  const targetId = args[1];
  // Si no pasas un nombre manualmente, el bot pone "Admin" por defecto
  const name = args.slice(2).join(" ") || "Admin";

  if (Auth.authorize(targetId, name)) {
    ctx.replyWithHTML(
      `✅ <b>Autorizado:</b> ${name}\n🆔 <b>ID:</b> <code>${targetId}</code>`,
    );
    sendLog(
      `👮 <b>Nuevo Admin</b>\nPromovido por: ${ctx.from.first_name}\nNombre: ${name}\nID: ${targetId}`,
    );
  } else {
    ctx.reply("⚠️ Indica un ID válido.");
  }
});

bot.command("unauth", (ctx) => {
  // Solo el Dueño principal puede quitar otros admins
  if (ctx.from.id !== Auth.ADMIN_ID)
    return ctx.reply("❌ Solo el Dueño puede usar este comando.");

  const targetId = ctx.message.text.split(" ")[1];
  if (!targetId) return ctx.reply("⚠️ Uso: /unauth <ID>");

  if (Auth.unauthorize(targetId)) {
    ctx.replyWithHTML(
      `✅ Acceso revocado para el ID: <code>${targetId}</code>`,
    );

    // Log opcional para tu canal
    sendLog(
      `🗑️ <b>Admin Removido</b>\n🤴 Por Dueño: <code>${ctx.from.first_name}</code>\n❌ ID Quitado: <code>${targetId}</code>`,
    );
  } else {
    ctx.reply("⚠️ El ID no se encuentra en la lista de autorizados.");
  }
});

// --- COMANDO BROADCAST (MENSAJE MASIVO) ---
bot.command("broadcast", async (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const args = ctx.message.text.split(" ");
  const message = args.slice(1).join(" ");

  if (!message) return ctx.reply("⚠️ Uso: /broadcast <mensaje>");

  // Unificamos todos los IDs registrados
  const admins = Object.keys(Auth.authData.users);
  const users = Object.keys(Auth.authData.commonUsers);
  const allUsers = [...new Set([...admins, ...users])];

  await ctx.reply(`📣 Iniciando envío masivo a ${allUsers.size} usuarios...`);

  let success = 0;
  let failed = 0;

  for (const userId of allUsers) {
    try {
      await bot.telegram.sendMessage(
        userId,
        `📢 <b>NOTIFICACIÓN OFICIAL</b>\n━━━━━━━━━━━━━━━━━━\n\n${message}\n\n━━━━━━━━━━━━━━━━━━`,
        { parse_mode: "HTML" },
      );
      success++;
      // Delay de seguridad para evitar spam block (40ms entre mensajes)
      await new Promise((resolve) => setTimeout(resolve, 40));
    } catch (e) {
      failed++;
    }
  }

  ctx.replyWithHTML(
    `✅ <b>Envío Finalizado</b>\n\n✔️ Exitosos: <code>${success}</code>\n❌ Fallidos: <code>${failed}</code>`,
  );
  sendLog(
    `📢 <b>Broadcast enviado</b> por ${ctx.from.first_name} a ${success} personas.`,
  );
});

// --- COMANDO STATS (ESTADÍSTICAS) ---
bot.command("stats", (ctx) => {
  const isAllowed =
    ctx.from.id === Auth.ADMIN_ID || Auth.authData.users[ctx.from.id];
  if (!isAllowed) return;

  const totalAdmins = Object.keys(Auth.authData.users).length;
  const totalUsers = Object.keys(Auth.authData.commonUsers).length;
  const pendingKeys = Object.keys(Auth.authData.activeKeys).length;

  const msg =
    "📊 <b>MÉTRICAS DEL SISTEMA</b>\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "👤 <b>Usuarios Activos:</b> <code>" +
    totalUsers +
    "</code>\n" +
    "👮 <b>Admins:</b> <code>" +
    totalAdmins +
    "</code>\n" +
    "🔑 <b>Keys sin usar:</b> <code>" +
    pendingKeys +
    "</code>\n" +
    "📡 <b>Status:</b> <code>Online 🟢</code>\n" +
    "━━━━━━━━━━━━━━━━━━";

  ctx.replyWithHTML(msg);
});

//===========================
// --- CIERRE BLOQUE ADMINISTRACIÓN ---
// ==========================

bot.command("genkey", (ctx) => {
  const userId = ctx.from.id;
  const isAllowed = userId === Auth.ADMIN_ID || Auth.authData.users.has(userId);
  if (!isAllowed) return ctx.reply("❌ No autorizado.");

  const args = ctx.message.text.split(" ")[1] || "1d";
  if (!["1d", "1w", "1m"].includes(args)) {
    return ctx.reply("⚠️ Uso: /genkey [1d | 1w | 1m]");
  }

  const key = Auth.generateKey(args);
  ctx.replyWithHTML(`🔑 <b>Key [${args}] Generada:</b>\n<code>${key}</code>`);
  sendLog(
    `💎 <b>Nueva Key Generada</b>\n👮 Admin: <code>${ctx.from.first_name}</code>\n🆔 ID: <code>${ctx.from.id}</code>\n🔑 Key: <code>${key}</code>\n⏰ Duración: <code>${args}</code>`,
  );
});

bot.command("revokey", (ctx) => {
  const userId = ctx.from.id;
  const isAllowed = userId === Auth.ADMIN_ID || Auth.authData.users.has(userId);
  if (!isAllowed) return ctx.reply("❌ Sin permisos.");

  const targetId = ctx.message.text.split(" ")[1];
  if (Auth.revokeAccess(targetId)) {
    ctx.reply(`✅ Acceso revocado para ID: ${targetId}`);
  } else {
    ctx.reply("⚠️ ID no encontrado.");
  }
});

bot.command("clearkeys", (ctx) => {
  const userId = ctx.from.id;
  const isAllowed = userId === Auth.ADMIN_ID || Auth.authData.users.has(userId);
  if (!isAllowed) return ctx.reply("❌ No autorizado.");

  const deletedCount = Auth.clearPendingKeys();
  ctx.reply(`✅ Limpieza completa. ${deletedCount} keys eliminadas.`);
});

bot.command("list", (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  // Lista de Admins con Nombre
  const admins =
    Object.entries(Auth.authData.users)
      .map(([id, name]) => {
        const displayId =
          id === Auth.ADMIN_ID.toString() ? `${id} (Dueño)` : id;
        return `👮 <b>${name}</b> - <code>${displayId}</code>`;
      })
      .join("\n") || "Sin admins extra";

  // Lista de Usuarios con Key
  const users =
    Object.entries(Auth.authData.commonUsers)
      .map(([id, data]) => {
        const nombre = typeof data === "object" ? data.name : "Usuario Antiguo";
        return `👤 <b>${nombre}</b> - <code>${id}</code>`;
      })
      .join("\n") || "No hay usuarios con Key";

  ctx.replyWithHTML(
    `<b>📊 REGISTRO DE ACCESO COMPLETO</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>ADMINISTRADORES:</b>\n${admins}\n\n` +
      `<b>USUARIOS (KEYS):</b>\n${users}\n` +
      `━━━━━━━━━━━━━━━━━━`,
  );
});

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

// --- CALLBACK QUERIES & SOLICITUDES ---
// Reemplaza o limpia tu bloque de callback_query por este:
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;

  // 1. Manejador de Planes y Precios
  if (data === "SHOW_PRICES") {
    await ctx.answerCbQuery();
    const prices =
      "💳 <b>NUESTROS PLANES</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "🔵 <b>Diario:</b> $2.00 USD\n" +
      "🟢 <b>Semanal:</b> $7.00 USD\n" +
      "🔴 <b>Mensual:</b> $20.00 USD\n\n" +
      "💰 <b>Métodos:</b> Binance, Saldo Forobeta, Criptos.";

    return ctx.editMessageText(prices, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.url("🛒 Hablar con Admin", "https://t.me/devcrackpy")],
        [Markup.button.callback("🔙 Volver", "BACK_TO_DENIED")],
      ]),
    });
  }

  // 2. Manejador de Ayuda para Redimir
  if (data === "REDEEM_HELP") {
    await ctx.answerCbQuery();
    return ctx.replyWithHTML(
      "📝 Para activar usa: <code>/redeem TU_KEY</code>",
    );
  }

  // 3. (OPCIONAL) Si aún quieres mantener la solicitud de acceso por botón:
  if (data.startsWith("REQ")) {
    // Aquí va tu lógica de REQ si aún la usas...
  }

  // IMPORTANTE: Si ves códigos de "OK" o "NO" aquí abajo, ELIMÍNALOS.
});

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

bot.launch();

// --- AUX FUNCTIONS ---
function Gen(ctx) {
  let comando = ctx.message.text.replace(/[^\d,"x","X",\|]/g, "");
  if (comando.length < 4) return ctx.reply("Minimum 4 digits required.");
  const reply = Generador(comando);
  bin(ctx).then((txt) => ctx.reply(`${reply}\n\n${txt}`));
}

async function bin(ctx) {
  const comando = ctx.message.text.replace(/[a-z,A-Z,/,\s]/g, "").slice(0, 6);
  const API_KEY = "HAS-0YXMWRCJYdvDxk934HyT3rP";
  try {
    const resultado = await consultarBIN(comando, API_KEY);
    if (!resultado || resultado.error) return "❌ BIN no encontrado.";
    return `════════[BANK DETAILS]════════\n点 BIN --» ${resultado.Scheme} ${resultado.Type}\n点 BANK --» ${resultado.Issuer}\n点 COUNTRY --» ${resultado.Country?.Name}\n═══════════[INFO]═══════════\n点 CHECKED BY @${ctx.from.username || "User"}`;
  } catch (error) {
    return "❌ Error consultando BIN.";
  }
}
