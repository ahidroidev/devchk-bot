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
  // Verificación de seguridad extra
  if (ctx.from.id !== Auth.ADMIN_ID) return ctx.reply("❌ No eres el admin.");

  const targetId = ctx.message.text.split(" ")[1];
  if (Auth.unauthorize(targetId)) {
    ctx.reply(`✅ Acceso revocado para el ID ${targetId}`);
  } else {
    ctx.reply("⚠️ El ID no estaba en la lista.");
  }
});
// FIN COMANDOS ADMNISTRATIVOS (Solo el admin puede usar estos comandos)

// --- COMANDOS PARA GENERAR KEYS ---

// Comando: /genkey [1d | 1w | 1m]
bot.command("genkey", (ctx) => {
  const userId = ctx.from.id;
  const isAllowed = userId === Auth.ADMIN_ID || Auth.authData.users.has(userId);
  if (!isAllowed) return ctx.reply("❌ No autorizado.");

  const args = ctx.message.text.split(" ")[1]; // 1d, 1w o 1m
  if (!["1d", "1w", "1m"].includes(args)) {
    return ctx.reply("⚠️ Indica duración: /genkey 1d, 1w o 1m");
  }

  const key = Auth.generateKey(args);
  const tiempo =
    args === "1d" ? "24 Horas" : args === "1w" ? "1 Semana" : "1 Mes";

  ctx.replyWithHTML(`<b>🔑 Key [${tiempo}] Generada:</b>\n<code>${key}</code>`);
});

bot.command("redeem", (ctx) => {
  const key = ctx.message.text.split(" ")[1];
  if (!key) return ctx.reply("⚠️ /redeem KEY-XXXX-XXXX-XXXX-XXXX");

  const expiryDate = Auth.redeemKey(ctx.from.id, key);
  if (expiryDate) {
    ctx.reply(`✅ Acceso activado hasta el: ${expiryDate}`);
  } else {
    ctx.reply("❌ Key inválida o ya utilizada.");
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

// Manejador de Solicitud (r_)
// --- MANEJADOR DE BOTONES (SOLICITUD Y APROBACIÓN) ---
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const requester = ctx.from.username
    ? `@${ctx.from.username}`
    : ctx.from.first_name;

  // 1. Cuando el USUARIO pulsa "Solicitar Acceso"
  if (data.startsWith("REQ")) {
    const targetId = data.replace("REQ", "");
    try {
      await bot.telegram.sendMessage(
        Auth.ADMIN_ID,
        `🔔 <b>Nueva Solicitud</b>\nID: <code>${targetId}</code>\nDe: ${requester}`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("✅ Aprobar", `OK${targetId}`),
              Markup.button.callback("❌ Rechazar", `NO${targetId}`),
            ],
          ]),
        },
      );
      await ctx.answerCbQuery("✅ Solicitud enviada.");
      await ctx.editMessageText("⏳ Esperando aprobación del administrador...");
    } catch (e) {
      await ctx.answerCbQuery("❌ Error: Admin no disponible.");
    }
  }

  // 2. Cuando TÚ (Admin) pulsas "Aprobar"
  if (data.startsWith("OK")) {
    if (ctx.from.id !== Auth.ADMIN_ID) {
      return ctx.answerCbQuery("❌ No eres el Administrador.", {
        show_alert: true,
      });
    }

    const targetId = data.replace("OK", "");
    if (Auth.authorize(targetId)) {
      await ctx.answerCbQuery("✅ Usuario Autorizado.");
      await ctx.editMessageText(
        `✅ El ID <code>${targetId}</code> ha sido guardado.`,
        { parse_mode: "HTML" },
      );

      try {
        await bot.telegram.sendMessage(
          targetId,
          "🎉 ¡Tu acceso ha sido aprobado!",
        );
      } catch (e) {
        console.log("Usuario ya autorizado, pero no se pudo enviar mensaje.");
      }
    }
  }

  // 3. Cuando TÚ (Admin) pulsas "Rechazar"
  if (data.startsWith("NO")) {
    if (ctx.from.id !== Auth.ADMIN_ID)
      return ctx.answerCbQuery("No autorizado.");
    const targetId = data.replace("NO", "");
    await ctx.editMessageText(`❌ ID ${targetId} rechazado.`);
    try {
      await bot.telegram.sendMessage(
        targetId,
        "🚫 Tu solicitud fue rechazada.",
      );
    } catch (e) {}
  }
});

bot.action(/req_(.+)/, async (ctx) => {
  console.log("--- DEBUG SOLICITUD ---");
  console.log("ID Solicitante:", ctx.match[1]);
  console.log("Tu ADMIN_ID cargado:", Auth.ADMIN_ID);
  console.log("Tipo de ADMIN_ID:", typeof Auth.ADMIN_ID);
  // ... resto del código
});

bot.command("test_admin", async (ctx) => {
  try {
    await bot.telegram.sendMessage(
      Auth.ADMIN_ID,
      "✅ Conexión con el Administrador exitosa.",
    );
    ctx.reply("He enviado un mensaje a tu privado. ¿Lo recibiste?");
  } catch (e) {
    ctx.reply(
      "❌ Error: No puedo enviarte mensajes. Asegúrate de haber presionado START en el bot.",
    );
  }
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
