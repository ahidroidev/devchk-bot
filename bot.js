const { Telegraf } = require("telegraf");
const Auth = require("./funcionalidades/auth.js");
const Generador = require("./funcionalidades/generador.js");
const valLuhn = require("./funcionalidades/luhn.js");
const extra = require("./funcionalidades/extra.js");
const consultarBIN = require("./funcionalidades/bin.js");

const Token = "8540424517:AAH9w9sLBwdBEdgwO7E9OETsVgOsYx7Czsg";
const bot = new Telegraf(Token);

// --- MIDDLEWARE GLOBAL ---
// Esto protege TODOS los comandos que estén debajo
bot.use(Auth.authMiddleware);

bot.start((ctx) => ctx.reply("Welcome! Use /cmds to see available options."));

// --- COMANDO DE ADMINISTRACIÓN ---
bot.command("auth", (ctx) => {
  if (ctx.from.id !== Auth.ADMIN_ID) {
    return ctx.reply("❌ Solo el administrador puede usar este comando.");
  }
  const args = ctx.message.text.split(" ");
  const newId = args[1];

  if (Auth.authorizeUser(newId)) {
    return ctx.reply(`✅ ID ${newId} - autorizado correctamente.`);
  } else {
    ctx.reply("⚠️ Uso: /auth [ID_NUMERICO]");
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

  const fs = require("fs");
  try {
    const data = JSON.parse(fs.readFileSync("./authorized_ids.json", "utf8"));
    const lista = data.map((id) => `• <code>${id}</code>`).join("\n");
    ctx.replyWithHTML(`👥 <b> Usuarios y Grupos autorizados: </b>\n\n${lista}`);
  } catch (err) {
    ctx.reply("❌ Error al leer la lista de autorizados.");
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
