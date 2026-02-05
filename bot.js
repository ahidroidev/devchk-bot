require("dotenv").config();
const { Telegraf } = require("telegraf");
const Auth = require("./funcionalidades/auth.js");
const Generador = require("./funcionalidades/generador.js");
const valLuhn = require("./funcionalidades/luhn.js");
const extra = require("./funcionalidades/extra.js");
const consultarBIN = require("./funcionalidades/bin.js");
const { Markup } = require("telegraf");
const Token = process.env.BOT_TOKEN;

if (!process.env.BOT_TOKEN) {
  throw new Error("Falta BOT_TOKEN en las variables de entorno.");
}
const bot = new Telegraf(Token);

// --- MIDDLEWARE GLOBAL ---
// Esto protege TODOS los comandos que estén debajo
bot.use(Auth.authMiddleware);

bot.start((ctx) =>
  ctx.reply("Welcome to DevChk Bot! Use /info to get your Authorization"),
);

// --- COMANDO DE ADMINISTRACIÓN ---
bot.command("auth", (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const targetId = ctx.message.text.split(" ")[1];
  if (Auth.authorize(targetId)) {
    const tipo = parseInt(targetId) < 0 ? "Grupo" : "Usuario";
    ctx.reply(`✅ ${tipo} ${targetId} autorizado.`);
  } else {
    ctx.reply("⚠️ Indica un ID válido.");
  }
});

bot.command("unauth", (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) {
    return ctx.reply("❌ Solo el administrador puede usar este comando.");
  }
  const args = ctx.message.text.split(" ");
  const idToRemove = parseInt(args[1]);

  if (isNaN(idToRemove)) {
    return ctx.reply("⚠️ Uso: /unauth [ID_NUMERICO]");
  }

  if (idToRemove === Auth.ADMIN_ID) {
    return ctx.reply("🛡️ No puedes desautorizar al administrador.");
  }

  if (Auth.unauthorizeUser(idToRemove)) {
    return ctx.reply(`✅ ID ${idToRemove} - desautorizado correctamente.`);
  } else {
    ctx.reply("⚠️ El ID proporcionado no estaba autorizado.");
  }
});

// --- COMANDOS DE USUARIO (Ya protegidos por el middleware) ---

bot.command("info", async (ctx) => {
  ctx.reply(
    "🚀 DevChk Bot v1.0\n\n💡 Comandos disponibles:\n• /gen - Generar tarjetas\n• /bin - Consultar información de BIN\n• /ex - Extrapolación de números\n" +
      "\n\n\n💻 Developed by @devcrackpy",
  );
});

bot.command("id", (ctx) => {
  ctx.reply(`👤 Tu ID: ${ctx.from.id}\n👥 Chat ID: ${ctx.chat.id}`);
});

bot.command("gen", (ctx) => {
  Gen(ctx);
});

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

bot.command("list", (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) return;

  const users =
    Array.from(Auth.authData.users)
      .map((id) => `👤 <code>${id}</code>`)
      .join("\n") || "Ninguno";
  const groups =
    Array.from(Auth.authData.groups)
      .map((id) => `👥 <code>${id}</code>`)
      .join("\n") || "Ninguno";

  ctx.replyWithHTML(
    `<b>📋 LISTA DE AUTORIZADOS</b>\n\n` +
      `<b>USUARIOS:</b>\n${users}\n\n` +
      `<b>GRUPOS:</b>\n${groups}`,
  );
});

// Manejar el clic del usuario en "Solicitar Acceso"
// Manejar clic en "Solicitar Acceso"
bot.action(/req_(.+)/, async (ctx) => {
  // 1. Limpiamos el ID extraído
  const targetId = String(ctx.match[1]).trim();
  const userId = ctx.from.id;
  const requester = ctx.from.username
    ? `@${ctx.from.username}`
    : ctx.from.first_name;

  // 2. DEBUG: Esto aparecerá en tu terminal SI O SI al pulsar el botón
  console.log(`--- INTENTO DE SOLICITUD ---`);
  console.log(`Target ID: ${targetId}`);
  console.log(`Admin ID: ${Auth.ADMIN_ID}`);

  // 3. Validación para grupos (Solo Owner)
  if (targetId.startsWith("-")) {
    try {
      const member = await ctx.getChatMember(userId);
      if (member.status !== "creator") {
        return ctx.answerCbQuery(
          "⚠️ Solo el Owner puede solicitar acceso para el grupo.",
          { show_alert: true },
        );
      }
    } catch (e) {
      return ctx.answerCbQuery("❌ Error: El bot debe ser Admin del grupo.");
    }
  }

  // 4. ENVÍO AL ADMIN (Con captura de error específica)
  try {
    await bot.telegram.sendMessage(
      Auth.ADMIN_ID,
      `🔔 <b>Nueva Solicitud</b>\n\n` +
        `<b>ID:</b> <code>${targetId}</code>\n` +
        `<b>User:</b> ${requester}`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Aprobar", `ok_${targetId}`),
            Markup.button.callback("❌ Rechazar", `no_${targetId}`),
          ],
        ]),
      },
    );

    await ctx.answerCbQuery("✅ Solicitud enviada.");
    await ctx.editMessageText("⏳ Esperando aprobación del administrador...");
  } catch (error) {
    console.error("FALLO AL ENVIAR AL ADMIN:", error.description);
    // Esta alerta te dirá en el móvil POR QUÉ falló
    await ctx.answerCbQuery(`❌ Error: ${error.description}`, {
      show_alert: true,
    });
  }
});

// Acción de Aprobar
bot.action(/ok_(.+)/, async (ctx) => {
  // 1. Get ID Match from Callback Data
  const targetId = ctx.match[1];

  // 2. Verify what u' be ADMIN
  if (ctx.from.id !== Auth.ADMIN_ID) {
    return ctx.answerCbQuery("❌ No tienes permiso para aprobar.");
  }

  // 3. Process Authorization
  if (Auth.authorize(targetId)) {
    await ctx.editMessageText(`✅ ID ${targetId} autorizado.`);

    //4. Notify the user about approval
    bot.telegram.sendMessage(
      targetId,
      "🎉 ¡Acceso aprobado! Ya puedes usar el bot.",
    );
  } else {
    ctx.answerCbQuery("⚠️ Error al autorizar. ID inválido.");
  }
});

// Acción de Rechazar
bot.action(/no_(.+)/, async (ctx) => {
  const targetId = ctx.match[1];
  if (ctx.from.id !== Auth.ADMIN_ID)
    return ctx.answerCbQuery(
      "❌ Solo el administrador puede usar este comando.",
    );

  await ctx.editMessageText(`❌ ID ${targetId} - autorización denegada.`);
  bot.telegram.sendMessage(
    targetId,
    "❌ Tu solicitud de acceso ha sido denegada por el administrador.",
  );
});

bot.action(/req_(.+)/, async (ctx) => {
  console.log("--- DEBUG SOLICITUD ---");
  console.log("ID Solicitante:", ctx.match[1]);
  console.log("Tu ADMIN_ID cargado:", Auth.ADMIN_ID);
  console.log("Tipo de ADMIN_ID:", typeof Auth.ADMIN_ID);
  // ... resto del código
});

// ... Agrega aquí el resto de tus comandos (lc, nn, ny) sin necesidad de IFs de autorizar

bot.launch();

// --- FUNCIONES AUXILIARES ---

function Gen(ctx) {
  let comando = ctx.message.text.replace(/[^\d,"x","X",\|]/g, "");
  if (comando.length < 4) {
    return ctx.reply("Minimum 4 digits required.");
  }
  const reply = Generador(comando);
  bin(ctx).then((txt) => {
    ctx.reply(`${reply}\n\n${txt}`);
  });
}

async function bin(ctx) {
  const comando = ctx.message.text.replace(/[a-z,A-Z,/,\s]/g, "").slice(0, 6);
  const API_KEY = "HAS-0YXMWRCJYdvDxk934HyT3rP";
  try {
    const resultado = await consultarBIN(comando, API_KEY);
    if (!resultado || resultado.error) return "❌ BIN no encontrado.";

    return `════════[BANK DETAILS]════════
点 BIN --» ${resultado.Scheme} ${resultado.Type}
点 BANK --» ${resultado.Issuer}
点 COUNTRY --» ${resultado.Country?.Name}
═══════════[INFO]═══════════
点 CHECKED BY @${ctx.from.username || "User"}`;
  } catch (error) {
    return "❌ Error consultando BIN.";
  }
}

/*async function info(ctx) {

}
*/
