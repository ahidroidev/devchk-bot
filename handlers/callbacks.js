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
    const msgId = ctx.callbackQuery.message.message_id;

    // console.log(`[DEBUG] Button: ${data} | User: ${uid}`);

    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}

    // ====================================
    // --- 1. SISTEMA DE AYUDA (INFO) ---
    // ====================================

    if (data === "HELP_GEN") {
      const text =
        `${Config.emojis.card} <b>GUÍA: GENERADOR</b>\n` +
        `${Config.decoration.line}\n\n` +
        `El comando <code>/gen</code> crea tarjetas basadas en un BIN, calculando algoritmo de Luhn y fecha válida.\n\n` +
        `📝 <b>Uso:</b> <code>/gen 454545</code>\n` +
        `💡 <i>Genera 10 tarjetas por solicitud.</i>\n` +
        `💰 <b>Costo:</b> 1 Crédito.`;

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
        `├ <code>/auth [ID] [RANGO]</code> - Crear Staff\n` +
        `├ <code>/unauth [ID]</code> - Despedir Staff\n` +
        `└ <code>/config</code> - Panel Global\n\n` +
        `💰 <b>SELLER / ADMIN:</b>\n` +
        `├ <code>/addcredits [ID] [CANT]</code>\n` +
        `└ <code>/genkey [1d/1w/1m]</code>\n\n` +
        `🛡️ <b>MOD / ADMIN:</b>\n` +
        `├ <code>/ban [ID]</code> - Banear Usuario\n` +
        `├ <code>/unban [ID]</code> - Desbanear\n` +
        `├ <code>/kick [ID]</code> - Expulsar\n` +
        `└ <code>/mute [ID]</code> - Silenciar`;

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
    // --- 2. NAVEGACIÓN DE MENÚS ---
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
      const firstName = ctx.from.first_name;
      const profileInfo = getUserProfile(uid, firstName);

      // Reconstruir botones de Start
      let buttons = [
        [Markup.button.callback("💎 ADQUIRIR VIP", "SHOW_PRICES")],
        [Markup.button.callback("📚 GUÍA DE USO", "BACK_HELP")],
        [Markup.button.url("👨‍💻 SOPORTE", Config.owner.supportLink)],
      ];

      // Si es Admin/Owner, mostrar botón de config
      if (uid === Auth.ADMIN_ID) {
        buttons.unshift([
          Markup.button.callback("🛠️ CONFIGURACIÓN", "BACK_TO_MAIN_CONFIG"),
        ]);
      }

      return ctx
        .editMessageText(
          `${Config.text.headerStart}\n\n🚀 <b>CHECKER ${Config.bot.version}</b>\n${Config.decoration.line}\nSelecciona una opción:\n\n${profileInfo}`,
          { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) },
        )
        .catch(() => {});
    }

    if (data === "SHOW_PROFILE") {
      const profile = getUserProfile(uid, ctx.from.first_name);
      return ctx
        .editMessageText(profile, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 VOLVER", "BACK_TO_START")],
          ]),
        })
        .catch(() => {});
    }

    if (data === "SHOW_PRICES") {
      const pricesMessage =
        `${Config.emojis.card} <b>TARIFAS PREMIUM</b>\n` +
        `${Config.decoration.line}\n\n` +
        `🔵 <b>DIARIO:</b> <code>${Config.prices.day}</code>\n` +
        `🟢 <b>SEMANAL:</b> <code>${Config.prices.week}</code>\n` +
        `🔴 <b>MENSUAL:</b> <code>${Config.prices.month}</code>\n\n` +
        `<i>Pagos en: ${Config.prices.currency}</i>\n` +
        `${Config.decoration.line}`;

      return ctx
        .editMessageText(pricesMessage, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.url("🛒 Comprar Ahora", Config.owner.supportLink)],
            [Markup.button.callback("🔙 VOLVER", "BACK_TO_START")],
          ]),
        })
        .catch(() => {});
    }

    // ====================================
    // --- 3. GESTIÓN DE ESTADOS (ADMIN) ---
    // ====================================

    if (data === "BACK_TO_MAIN_CONFIG") {
      // SOLO EL OWNER (ADMIN_ID) PUEDE VER EL PANEL GLOBAL
      if (uid !== Auth.ADMIN_ID)
        return ctx.answerCbQuery("🚫 Acceso restringido al Owner.", {
          show_alert: true,
        });

      delete userState[uid];

      return ctx
        .editMessageText(
          `⚙️ <b>CONFIGURACIÓN MAESTRA</b>\n${Config.decoration.line}\nSelecciona qué deseas gestionar:`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback("👮 STAFF", "SET_STATE_STAFF"),
                Markup.button.callback("💰 CRÉDITOS", "SET_STATE_CRED"),
              ],
              [
                Markup.button.callback("👥 GRUPOS", "SET_STATE_GRP"),
                Markup.button.callback("🔑 KEYS", "SET_STATE_KEYS"),
              ],
              [Markup.button.callback("❌ CERRAR", "CLOSE_PANEL")],
            ]),
          },
        )
        .catch(() => {});
    }

    if (data === "CLOSE_PANEL") {
      return ctx.deleteMessage().catch(() => {});
    }

    if (data.startsWith("SET_STATE_")) {
      if (uid !== Auth.ADMIN_ID) return;
      const type = data.replace("SET_STATE_", "");

      userState[uid] = { step: "WAITING_ID", type: type };

      let msg = "";
      if (type === "STAFF")
        msg =
          "👮 <b>GESTIÓN STAFF</b>\nEnvía el <b>ID</b> del usuario a gestionar:";
      if (type === "CRED")
        msg = "💰 <b>GESTIÓN CRÉDITOS</b>\nEnvía el <b>ID</b> del usuario:";
      if (type === "GRP")
        msg = "👥 <b>GESTIÓN GRUPOS</b>\nEnvía el <b>ID</b> del grupo:";
      if (type === "KEYS")
        msg = "🔑 <b>GESTIÓN KEYS</b>\nEnvía la <b>KEY</b> a consultar:";

      return ctx
        .editMessageText(msg + `\n\n<i>Escribe "cancelar" para salir.</i>`, {
          parse_mode: "HTML",
        })
        .catch(() => {});
    }

    // ====================================
    // --- 4. ACCIONES DE GESTIÓN ---
    // ====================================

    // --- STAFF ---
    if (data.startsWith("CONF_STAFF_")) {
      const targetId = data.replace("CONF_STAFF_", "");
      // Le mostramos al Admin los comandos exactos para copiar y pegar
      await ctx.replyWithHTML(
        `👮 <b>ASIGNACIÓN RÁPIDA</b>\nCopía y pega el comando:\n\n` +
          `🔹 <b>ADMIN:</b> <code>/auth ${targetId} ADMIN</code>\n` +
          `🔹 <b>SELLER:</b> <code>/auth ${targetId} SELLER</code>\n` +
          `🔹 <b>MOD:</b> <code>/auth ${targetId} MOD</code>`,
      );
    }

    // --- CRÉDITOS ---
    if (data.startsWith("CONF_CRED_")) {
      const targetId = data.replace("CONF_CRED_", "");
      await ctx.reply(
        `💰 Para añadir créditos, usa:\n<code>/addcredits ${targetId} 10</code>`,
      );
    }

    // --- KEYS (Consultar) ---
    if (data.startsWith("CONF_KEY_")) {
      const key = data.replace("CONF_KEY_", "");
      const info = Auth.authData.activeKeys[key];
      if (info) {
        await ctx.editMessageText(
          `${Config.emojis.key} <b>KEY INFO</b>\nKEY: <code>${key}</code>\nDuración: ${info / 3600000} Horas\nEstado: ACTIVA`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("🔙 VOLVER", "BACK_TO_MAIN_CONFIG")],
            ]),
          },
        );
      } else {
        await ctx.reply("❌ Key no encontrada o ya usada.");
      }
    }

    // --- REVOCAR (Acción Crítica BLINDADA) ---
    if (data.startsWith("REV_ALL_")) {
      const tid = data.replace("REV_ALL_", "");

      // 1. BLINDAJE: Verificamos Jerarquía antes de ejecutar
      if (!Auth.canManage(uid, tid)) {
        return ctx.answerCbQuery(
          "🚫 Jerarquía Insuficiente: No puedes revocar a este usuario.",
          { show_alert: true },
        );
      }

      Auth.unauthorize(tid);
      CreditsManager.remove(tid, "ALL");

      await ctx
        .editMessageText(
          `🛡️ <b>ACCESOS REVOCADOS</b>\n${Config.decoration.line}\n🆔 ID: <code>${tid}</code>\n⚠️ El usuario ha sido removido del Staff y su saldo quedó en 0.`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
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

      Logger.log(
        "auth",
        ctx,
        `🗑️ <b>REVOKE ALL (PANEL)</b>\nTarget: <code>${tid}</code>\nAcción: Unauth + Wipe Credits`,
      );
    }

    if (data.startsWith("REV_KEY_")) {
      const key = data.replace("REV_KEY_", "");
      if (Auth.authData.activeKeys[key]) {
        delete Auth.authData.activeKeys[key];
        Auth.saveKeys();
        await ctx.reply("🗑️ Key eliminada correctamente.");
        Logger.log(
          "auth",
          ctx,
          `🗑️ <b>KEY ELIMINADA</b>\nKey: <code>${key}</code>`,
        );
      } else {
        await ctx.reply("❌ Key no existe.");
      }
    }

    // ====================================
    // --- 5. STATS UPDATE (ACTUALIZADO) ---
    // ====================================

    if (data === "UPDATE_STATS") {
      if (uid !== Auth.ADMIN_ID) return;

      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      const totalUsers = Object.keys(Auth.authData.users).length;
      const totalVips = Object.keys(Auth.authData.commonUsers).length;

      // Calcular Stats Reales por Rango
      let admins = 0,
        sellers = 0,
        mods = 0;
      Object.values(Auth.authData.users).forEach((u) => {
        if (u.rango === "ADMIN") admins++;
        if (u.rango === "SELLER") sellers++;
        if (u.rango === "MOD") mods++; // ¡AHORA SÍ CONTAMOS MODS!
      });

      const statsMsg =
        `${Config.emojis.stats} <b>DASHBOARD DE OPERACIONES</b>\n` +
        `${Config.decoration.line}\n\n` +
        `🖥 <b>ESTADO DEL CORE:</b>\n` +
        `├ <b>Status:</b> <code>STABLE</code> 💹\n` +
        `└ <b>Uptime:</b> <code>${hours}h ${minutes}m</code>\n\n` +
        `👮 <b>FUERZA DE STAFF:</b>\n` +
        `├ <b>Admins:</b> <code>${admins}</code>\n` +
        `├ <b>Sellers:</b> <code>${sellers}</code>\n` +
        `└ <b>Mods:</b> <code>${mods}</code>\n\n` +
        `💎 <b>INFRAESTRUCTURA VIP:</b>\n` +
        `├ <b>Usuarios VIP:</b> <code>${totalVips}</code>\n` +
        `└ <b>Staff Total:</b> <code>${totalUsers}</code>\n\n` +
        `${Config.decoration.line}\n` +
        `${Config.emojis.tech} <b>NETWORK:</b> <code>CONNECTED</code>`;

      await ctx
        .editMessageText(statsMsg, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔄 REFRESCAR DATOS", "UPDATE_STATS")],
          ]),
        })
        .catch(() => {});
    }
  });
};
