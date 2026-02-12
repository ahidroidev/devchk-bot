// handlers/callbacks.js
const Auth = require("../funcionalidades/auth");
const { Markup } = require("telegraf");
const CreditsManager = require("../database/credits.js");
const Config = require("../config.js");
const Logger = require("../funcionalidades/logger.js");

module.exports = (bot, userState, getUserProfile) => {
  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const uid = ctx.from.id;

    // Metadatos detallados para trazabilidad
    const operatorName = ctx.from.first_name;
    const operatorUser = ctx.from.username ? `@${ctx.from.username}` : "N/A";
    const timestamp = new Date().toLocaleString();

    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    // ====================================
    // --- 1. GUÍAS Y AYUDA (ORIGINALES) ---
    // ====================================

    if (data === "HELP_GEN") {
      const text =
        `${Config.emojis.card} <b>GUÍA: GENERADOR</b>\n` +
        `${Config.decoration.line}\n\n` +
        `El comando <code>/gen</code> crea tarjetas basadas en un BIN, calculando algoritmo de Luhn y fecha válida.\n\n` +
        `📝 <b>Uso:</b> <code>/gen 454545</code>\n` +
        `💡 <i>Genera 10 tarjetas por solicitud.</i>\n` +
        `💰 <b>Costo:</b> ${Config.limits.costs.generator} Crédito.`;

      return ctx
        .editMessageText(text, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 VOLVER", "BACK_HELP")],
          ]),
        })
        .catch(() => {});
    }

    if (data === "HELP_KEYS") {
      const text =
        `${Config.emojis.key} <b>GUÍA: SISTEMA DE KEYS</b>\n` +
        `${Config.decoration.line}\n\n` +
        `Canjea tu acceso VIP o saldo usando una Key única entregada por el admin.\n\n` +
        `📝 <b>Uso:</b> <code>/redeem KEY-XXXX-XXXX</code>\n` +
        `💎 <b>Beneficios:</b> Acceso ilimitado por el tiempo de la key.`;

      return ctx
        .editMessageText(text, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 VOLVER", "BACK_HELP")],
          ]),
        })
        .catch(() => {});
    }

    if (data === "HELP_EXTRA") {
      const text =
        `${Config.emojis.stats} <b>GUÍA: EXTRAPOLACIÓN</b>\n` +
        `${Config.decoration.line}\n\n` +
        `El comando <code>/ex</code> busca patrones matemáticos similares a una tarjeta o BIN.\n\n` +
        `📝 <b>Uso:</b> <code>/ex 454545xxxxxxxxxx</code>\n` +
        `📡 <b>Algoritmo:</b> Proximidad + Simetría.`;

      return ctx
        .editMessageText(text, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 VOLVER", "BACK_HELP")],
          ]),
        })
        .catch(() => {});
    }

    if (data === "HELP_STAFF") {
      const text =
        `${Config.emojis.admin} <b>PANEL DE COMANDOS STAFF</b>\n` +
        `${Config.decoration.line}\n\n` +
        `👮 <b>ADMIN / OWNER:</b>\n` +
        `├ <code>/auth [ID] [RANGO]</code>\n` +
        `├ <code>/unauth [ID]</code>\n` +
        `└ <code>/config</code> - Panel Global\n\n` +
        `💰 <b>SELLER / ADMIN:</b>\n` +
        `├ <code>/addcredits [ID] [CANT]</code>\n` +
        `└ <code>/genkey [1d/1w/1m]</code>\n\n` +
        `🛡️ <b>MOD / ADMIN:</b>\n` +
        `├ <code>/ban [ID]</code>\n` +
        `└ <code>/mute [ID]</code>`;

      return ctx
        .editMessageText(text, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 VOLVER", "BACK_TO_START")],
          ]),
        })
        .catch(() => {});
    }

    // ====================================
    // --- 2. GESTIÓN AUTOMÁTICA (BOTONES) ---
    // ====================================

    if (data.startsWith("MANAGE_USER_")) {
      const targetId = data.replace("MANAGE_USER_", "");
      return ctx
        .editMessageText(
          `⚙️ <b>GESTIÓN DE USUARIO</b>\n${Config.decoration.line}\n🆔 ID: <code>${targetId}</code>\n\nElige una categoría:`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "🎖️ GESTIONAR RANGO",
                  `MENU_RANK_${targetId}`,
                ),
              ],
              [
                Markup.button.callback(
                  "💰 GESTIONAR SALDO",
                  `MENU_CRED_${targetId}`,
                ),
              ],
              [
                Markup.button.callback(
                  "🚫 REVOCAR TODO",
                  `REV_ALL_${targetId}`,
                ),
              ],
              [
                Markup.button.callback(
                  "🔙 VOLVER AL PANEL",
                  "BACK_TO_MAIN_CONFIG",
                ),
              ],
            ]),
          },
        )
        .catch(() => {});
    }

    // SUB-MENÚ DE RANGOS
    if (data.startsWith("MENU_RANK_")) {
      const tid = data.replace("MENU_RANK_", "");
      return ctx
        .editMessageText(
          `🎖️ <b>ASIGNAR RANGO</b>\n🆔 ID: <code>${tid}</code>`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback("👮 ADMIN", `EXEC_RANK_${tid}_ADMIN`),
                Markup.button.callback("🛡️ MOD", `EXEC_RANK_${tid}_MOD`),
              ],
              [
                Markup.button.callback("💸 SELLER", `EXEC_RANK_${tid}_SELLER`),
                Markup.button.callback("💎 VIP", `EXEC_RANK_${tid}_VIP`),
              ],
              [Markup.button.callback("👤 FREE", `EXEC_RANK_${tid}_FREE`)],
              [Markup.button.callback("🔙 VOLVER", `MANAGE_USER_${tid}`)],
            ]),
          },
        )
        .catch(() => {});
    }

    // EJECUCIÓN RANGOS + LOGS DETALLADOS
    if (data.startsWith("EXEC_RANK_")) {
      const [_, __, tid, rank] = data.split("_");
      if (!Auth.canManage(uid, tid))
        return ctx.answerCbQuery("🚫 Jerarquía insuficiente.", {
          show_alert: true,
        });

      if (rank === "FREE") Auth.unauthorize(tid);
      else Auth.authorize(tid, rank, "User");

      const logMsg =
        `🎖️ <b>RANGO ACTUALIZADO</b>\n${Config.decoration.line}\n` +
        `👤 <b>Objetivo ID:</b> <code>${tid}</code>\n` +
        `🎖️ <b>Nuevo Rango:</b> <code>${rank}</code>\n` +
        `${Config.decoration.line}\n` +
        `👮 <b>Staff:</b> ${operatorName} (${operatorUser})\n` +
        `🆔 <b>Staff ID:</b> <code>${uid}</code>\n` +
        `📅 <b>Fecha:</b> ${timestamp}`;

      await ctx.editMessageText(logMsg, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 VOLVER", "BACK_TO_MAIN_CONFIG")],
        ]),
      });
      Logger.log("auth", ctx, logMsg);
      console.log(
        `[AUTH] ${operatorName} cambió rango de ${tid} a ${rank} - ${timestamp}`,
      );
    }

    // SUB-MENÚ CRÉDITOS
    if (data.startsWith("MENU_CRED_")) {
      const tid = data.replace("MENU_CRED_", "");
      return ctx
        .editMessageText(
          `💰 <b>AJUSTE DE SALDO</b>\n🆔 ID: <code>${tid}</code>`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback("➕ 10", `EXEC_CRED_${tid}_10`),
                Markup.button.callback("➕ 50", `EXEC_CRED_${tid}_50`),
              ],
              [
                Markup.button.callback("➕ 100", `EXEC_CRED_${tid}_100`),
                Markup.button.callback("🗑️ WIPE", `EXEC_CRED_${tid}_WIPE`),
              ],
              [Markup.button.callback("🔙 VOLVER", `MANAGE_USER_${tid}`)],
            ]),
          },
        )
        .catch(() => {});
    }

    // EJECUCIÓN CRÉDITOS + LOGS DETALLADOS
    if (data.startsWith("EXEC_CRED_")) {
      const [_, __, tid, amount] = data.split("_");
      let newBalance;

      if (amount === "WIPE") {
        CreditsManager.remove(tid, "ALL");
        newBalance = 0;
      } else {
        newBalance = CreditsManager.add(tid, amount, uid);
      }

      const logMsg =
        `💰 <b>SALDO MODIFICADO</b>\n${Config.decoration.line}\n` +
        `👤 <b>Usuario ID:</b> <code>${tid}</code>\n` +
        `💵 <b>Acción:</b> ${amount === "WIPE" ? "Reset" : "+" + amount}\n` +
        `📈 <b>Nuevo Total:</b> <code>${newBalance}</code>\n` +
        `${Config.decoration.line}\n` +
        `👮 <b>Staff:</b> ${operatorName} (${operatorUser})\n` +
        `🆔 <b>Staff ID:</b> <code>${uid}</code>\n` +
        `📅 <b>Fecha:</b> ${timestamp}`;

      await ctx.editMessageText(logMsg, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 VOLVER", "BACK_TO_MAIN_CONFIG")],
        ]),
      });
      Logger.log("money", ctx, logMsg);
      console.log(
        `[CREDITS] ${operatorName} modificó saldo de ${tid}: ${amount} - ${timestamp}`,
      );
    }

    // ====================================
    // --- 3. NAVEGACIÓN Y CONFIG ---
    // ====================================

    if (data === "BACK_HELP") {
      const helpMenu =
        `${Config.text.helpMenu}\n` +
        `${Config.decoration.line}\n\n` +
        `🛠 <b>BÁSICOS:</b>\n├ <code>/start</code>\n├ <code>/me</code>\n└ <code>/id</code>\n\n` +
        `🚀 <b>VIP:</b>\n├ <code>/gen</code>\n├ <code>/bin</code>\n└ <code>/ex</code>\n\n` +
        `${Config.decoration.line}\n` +
        `${Config.text.footer}`;

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
              Markup.button.url("🛒 COMPRAR", Config.owner.supportLink),
            ],
            [Markup.button.callback("🔙 MENÚ PRINCIPAL", "BACK_TO_START")],
          ]),
        })
        .catch(() => {});
    }

    if (data === "BACK_TO_START") {
      const profileInfo = getUserProfile(uid, ctx.from.first_name);
      let buttons = [
        [Markup.button.callback("💎 ADQUIRIR VIP", "SHOW_PRICES")],
        [Markup.button.callback("📚 GUÍA DE USO", "BACK_HELP")],
        [Markup.button.url("👨‍💻 SOPORTE", Config.owner.supportLink)],
      ];

      if (uid.toString() === Auth.ADMIN_ID.toString()) {
        buttons.unshift([
          Markup.button.callback("🛠️ PANEL DE CONTROL", "BACK_TO_MAIN_CONFIG"),
        ]);
      }

      return ctx
        .editMessageText(`${Config.text.headerStart}\n\n${profileInfo}`, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard(buttons),
        })
        .catch(() => {});
    }

    if (data === "SHOW_PRICES") {
      const msg =
        `${Config.emojis.card} <b>TARIFAS PREMIUM</b>\n` +
        `${Config.decoration.line}\n\n` +
        `🔵 <b>DIARIO:</b> <code>${Config.prices.day}</code>\n` +
        `🟢 <b>SEMANAL:</b> <code>${Config.prices.week}</code>\n` +
        `🔴 <b>MENSUAL:</b> <code>${Config.prices.month}</code>\n\n` +
        `<i>Pagos en: ${Config.prices.currency}</i>\n${Config.decoration.line}`;

      return ctx
        .editMessageText(msg, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.url("🛒 Comprar Ahora", Config.owner.supportLink)],
            [Markup.button.callback("🔙 VOLVER", "BACK_TO_START")],
          ]),
        })
        .catch(() => {});
    }

    if (data === "BACK_TO_MAIN_CONFIG") {
      if (uid.toString() !== Auth.ADMIN_ID.toString())
        return ctx.answerCbQuery("🚫 Solo el Owner.");
      delete userState[uid];
      return ctx
        .editMessageText(
          `⚙️ <b>CONFIGURACIÓN MAESTRA</b>\n${Config.decoration.line}\nSelecciona una categoría:`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback("👮 STAFF", "SET_STATE_STAFF"),
                Markup.button.callback("💰 CRÉDITOS", "SET_STATE_CRED"),
              ],
              [
                Markup.button.callback("📊 ESTADÍSTICAS", "UPDATE_STATS"),
                Markup.button.callback("❌ CERRAR", "CLOSE_PANEL"),
              ],
            ]),
          },
        )
        .catch(() => {});
    }

    if (data.startsWith("SET_STATE_")) {
      const type = data.replace("SET_STATE_", "");
      userState[uid] = { step: "WAITING_ID", type: type };
      return ctx
        .editMessageText(
          `🔍 <b>BUSCAR USUARIO</b>\n${Config.decoration.line}\nEnvía el <b>ID</b> del usuario.\n\n<i>Escribe "cancelar" para abortar.</i>`,
          {
            parse_mode: "HTML",
          },
        )
        .catch(() => {});
    }

    if (data === "UPDATE_STATS") {
      const uptime = process.uptime();
      const statsMsg =
        `${Config.emojis.stats} <b>DASHBOARD DEL SISTEMA</b>\n` +
        `${Config.decoration.line}\n` +
        `⏱ Uptime: <code>${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m</code>\n` +
        `👮 Staff: <code>${Object.keys(Auth.getAllStaff()).length}</code>\n` +
        `💎 VIPs: <code>${Object.keys(Auth.getAllVips()).length}</code>\n` +
        `📅 <b>Sync:</b> ${timestamp}`;
      return ctx
        .editMessageText(statsMsg, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("🔄 RECARGAR", "UPDATE_STATS"),
              Markup.button.callback("🔙 VOLVER", "BACK_TO_MAIN_CONFIG"),
            ],
          ]),
        })
        .catch(() => {});
    }

    if (data.startsWith("REV_ALL_")) {
      const tid = data.replace("REV_ALL_", "");
      if (!Auth.canManage(uid, tid))
        return ctx.answerCbQuery("🚫 Jerarquía Insuficiente.", {
          show_alert: true,
        });

      Auth.unauthorize(tid);
      CreditsManager.remove(tid, "ALL");

      const revLog = `🛡️ <b>REVOCACIÓN COMPLETA</b>\n${Config.decoration.line}\n🆔 <b>Target ID:</b> <code>${tid}</code>\n⚠️ Estado: Removido y Saldo 0.\n${Config.decoration.line}\n👮 <b>Staff:</b> ${operatorName}\n📅 <b>Fecha:</b> ${timestamp}`;

      await ctx.editMessageText(revLog, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 VOLVER", "BACK_TO_MAIN_CONFIG")],
        ]),
      });
      Logger.log("auth", ctx, revLog);
    }

    if (data === "CLOSE_PANEL") return ctx.deleteMessage().catch(() => {});
  });
};
