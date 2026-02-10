// funcionalidades/logger.js
const Config = require("../config.js");

class Logger {
  constructor() {
    this.bot = null;
    this.channelId = process.env.LOG_CHANNEL_ID;
    this.queue = [];
    this.isProcessing = false;
  }

  // Inicializar
  init(botInstance) {
    this.bot = botInstance;
    console.log("✅ Sistema de Logs V3 (Cola): ACTIVO");
    this.processQueue();
  }

  // Método principal para agregar logs
  log(type, ctx, details) {
    if (!this.channelId) return;

    const style = Config.logs.logStyles[type] || {
      emoji: "📝",
      title: "LOG GENERADO",
    };
    const date = new Date().toLocaleString("es-CO", {
      timeZone: "America/Bogota",
    });

    let userString = "SISTEMA";
    let userId = "N/A";
    let username = "---";

    if (ctx && ctx.from) {
      userString = ctx.from.first_name.replace(/<[^>]*>/g, "");
      userId = ctx.from.id;
      username = ctx.from.username ? `@${ctx.from.username}` : "Sin Alias";
    }

    const message =
      `${style.emoji} <b>${style.title}</b>\n` +
      `${Config.decoration.line}\n` +
      `👤 <b>User:</b> <code>${userString}</code>\n` +
      `🏷️ <b>Alias:</b> <code>${username}</code>\n` +
      `🆔 <b>ID:</b> <code>${userId}</code>\n` +
      `🕒 <b>Hora:</b> <code>${date}</code>\n\n` +
      `📝 <b>DETALLE:</b>\n` +
      `${details}\n` +
      `${Config.decoration.line}`;

    this.queue.push(message);
  }

  // Procesador Anti-Flood (1 mensaje cada 1.5s)
  async processQueue() {
    setInterval(async () => {
      if (this.queue.length > 0 && this.bot) {
        const msg = this.queue.shift();
        try {
          await this.bot.telegram.sendMessage(this.channelId, msg, {
            parse_mode: "HTML",
          });
        } catch (error) {
          console.error("⚠️ Error enviando Log:", error.message);
          if (error.response && error.response.error_code === 429) {
            this.queue.unshift(msg);
          }
        }
      }
    }, 1500);
  }
}

module.exports = new Logger();
