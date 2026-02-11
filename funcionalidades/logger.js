// funcionalidades/logger.js
// SISTEMA DE LOGS CENTRALIZADO V3

// Importamos el Cerebro para saber dónde enviar los mensajes
const Config = require("../config");

/**
 * Función principal de Logs
 * @param {string} level - Nivel del log: 'live', 'dead', 'error', 'info'
 * @param {object} ctx - Contexto de Telegraf (necesario para usar telegram.sendMessage)
 * @param {string} message - El mensaje HTML a enviar
 */
async function log(level, ctx, message) {
  // 1. Verificar si los logs están activados en el Config
  if (!Config.logs.enabled) return;

  // 2. Determinar a qué canal enviar según el nivel
  let channelId = Config.logs.channels.default;

  if (level === "live") {
    channelId = Config.logs.channels.lives; // Canal de Lives
  } else if (level === "error") {
    channelId = Config.logs.channels.errors; // Canal de Errores
  }

  // Si no hay ID de canal configurado, cancelamos para evitar errores
  if (!channelId) return;

  // 3. Enviar el mensaje
  try {
    // Usamos ctx.telegram para enviar directamente al canal ID
    await ctx.telegram.sendMessage(channelId, message, { parse_mode: "HTML" });
  } catch (err) {
    // Si falla (ej: bot no es admin en el canal), solo lo mostramos en consola
    console.error(
      `[LOGGER ERROR] No se pudo enviar log al canal ${channelId}:`,
      err.message,
    );
  }
}

module.exports = { log };
