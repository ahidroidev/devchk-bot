const { Telegraf } = require("telegraf");
const axios = require("axios");
const Generador = require("./funcionalidades/generador.js");
const valLuhn = require("./funcionalidades/luhn.js");
const extra = require("./funcionalidades/extra.js");
const consultarBIN = require("./funcionalidades/bin.js");
const Token = "7743255641:AAFvyLDRX28Nzetgvm0bOao8rXVTOIxyp1M";
const bot = new Telegraf(Token);
bot.start((ctx) => ctx.reply('Welcome, starting with "/user"'));
let autorice = "-1002619874939";
//falta base de datos gateway y solucionar la api que reconoce los datos bancarios

//comando

bot.on("new_chat_members", (ctx) => {
  const newMembers = ctx.message.new_chat_members;
  newMembers.forEach((member) => {
    const userId = member.id;
    const firstName = member.first_name;
    ctx.reply("Bienvenido " + firstName + "\n Your ID: " + userId);
  });
});

bot.command("id", (ctx) => {
  const member = ctx.message;
  member.forEach((member) => {
    const userID = member.id;
    const first_name = member.first_name;
    const chatID = ctx.chat.id;
    ctx.reply(chatID, { caption: "Username:" + first_name + "\nID:" + userID });
  });
});
bot.command("gen", (ctx) => {
  if (!autorizar) {
    ctx.reply("Chat or Group unauthorized");
  } else {
    Gen(ctx);
  }
});

bot.command("bin", async (ctx) => {
  if (!autorizar(ctx)) {
    ctx.reply("Chat or Group unauthorized");
  } else {
    bin(ctx).then((txt) => {
      ctx.reply(txt);
    });
  }
});

bot.command("cmds", (ctx) => {
  const id = ctx.chat.id;
  if (id != autorice) {
    ctx.reply("Chat or Group unauthorized");
  } else {
    ctx.reply("");
  }
});

bot.command("lc", (ctx) => {
  if (autorizar()) {
    ctx.reply("Chat or Group unauthorized");
  } else {
    const comando = ctx.message.text;
    let reply = preCleaner(comando);
    if (reply.length === 0) {
      reply = "Input invalid cards.";
    }
    ctx.reply(reply);
  }
});

bot.command("nn", (ctx) => {
  const id = ctx.chat.id;
  if (id != autorice) {
    ctx.reply("Chat or Group unauthorized");
  } else {
    const comando = ctx.message.text;
    const validas = cleaner(comando);
  }
});

bot.command("ex", (ctx) => {
  let message = ctx.message.text.replace(/[a-z,A-Z,/,\s]/g, "");
  if (message.length > 14) {
    const reply = "Extrapolation " + message + "\n" + extra(message);
    ctx.reply(reply);
  }
});

bot.command("ny", (ctx) => {
  if (!autorizar(ctx)) {
    const comando = ctx.message.text;
    const validas = cleaner(comando);
    ctx.reply(comando.replace(/[a-z,A-Z,/,\s]/g, ""));
    ctx.reply("Chat or Group unauthorized");
  }
});
// cierre de verificacion id
//launch
bot.launch();

//funciones
function preCleaner(comando) {
  let txt = comando.replace(/[a-z,/,\s,\n]/g, "");
  let salida = "";
  let contador = 0;
  if (txt.length != 0) {
    for (let i = 0; i < txt.length / 28; i++) {
      const tarjeta = txt.slice(0 + 28 * i, 28 + 28 * i);
      salida += valLuhn(tarjeta);
      contador += 1;
    }
  }

  return salida;
}

function autorizar(ctx) {
  const id = ctx.chat.id;
  return id == autorice ? true : false;
}

function Gen(ctx) {
  let comando = ctx.message.text;
  comando = comando.replace(/[^\d,"x","X",\|]/g, "");
  if (comando.length < 4) {
    ctx.reply("Would be have 4 digits this bot.");
  } else {
    const reply = Generador(comando + "");
    bin(ctx).then((txt) => {
      if (txt != "Input invalid BIN.") {
        ctx.reply("" + reply + "\n" + txt);
      } else {
        ctx.reply(txt);
      }
    });
  }
}

async function bin(ctx) {
  const comando = ctx.message.text.replace(/[a-z,A-Z,/,\s]/g, "").slice(0, 8);
  const API_KEY = "HAS-0YXMWRCJYdvDxk934HyT3rP";
  try {
    const resultado = await consultarBIN(comando, API_KEY);
    const info = "点 CHECKED BY @" + ctx.from.username;
    const salida =
      "════════[BANK DETAILS]════════\n " +
      "\n点 BIN --» " +
      resultado.Scheme +
      " " +
      resultado.Type +
      "\n点 BANK --» " +
      resultado.Issuer +
      "\n点 COUNTRY --» " +
      resultado.Country?.Name +
      "\n═══════════[INFO]═══════════\n" +
      info;
    return salida.includes("undefined", "null") ? "Input invalid BIN." : salida;
  } catch (error) {
    console.error(error.message);
  }
}
