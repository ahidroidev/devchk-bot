// handlers/callbacks.js
const Auth = require("../funcionalidades/auth");
const { Markup } = require("telegraf");
const CreditsManager = require("../database/credits.js");

module.exports = (bot, userState, getUserProfile) => {
  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const uid = ctx.from.id;

    console.log(`[DEBUG] Botón presionado: ${data} | User: ${uid}`);

    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {
      console.log("Error al responder callback");
    }

    // ====================================
    // --- CALLBACK QUERIES & SOLICITUDES ---
    // ====================================

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
              Markup.button.callback("⬅️ VOLVER", "BACK_TO_START"),
            ],
          ]),
        })
        .catch(() => {});
    }

    // ============================
    // --- Store Callbacks Aquí ---
    // ============================

    if (data === "SHOW_PRICES") {
      const prices =
        "💎 <b>PLANES DISPONIBLES</b>\n" +
        "━━━━━━━━━━━━━━━━━━\n" +
        "🔵 <b>Diario:</b> <code>$2.00 USD</code>\n" +
        "🟢 <b>Semanal:</b> <code>$7.00 USD</code>\n" +
        "🔴 <b>Mensual:</b> <code>$20.00 USD</code>\n\n" +
        "💰 <b>Métodos:</b> Binance, TrustWallet, Bancos de CO, MEX, VE.";

      return ctx
        .editMessageText(prices, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.url("🛒 Comprar key", "https://t.me/devcrackpy")],
            [Markup.button.callback("🔙 Volver", "BACK_TO_START")],
          ]),
        })
        .catch((err) => console.log("Error precios:", err.message));
    }

    if (data === "REDEEM_HELP") {
      const text =
        "📝 <b>¿Cómo activar tu Key?</b>\n\n" +
        "Usa el comando seguido de tu código:\n" +
        "👉 <code>/redeem DEV-XXXX-XXXX</code>";

      return ctx
        .editMessageText(text, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Volver", "BACK_TO_DENIED")],
          ]),
        })
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
              [Markup.button.callback("⬅️ VOLVER", "BACK_TO_START")],
            ]),
          },
        )
        .catch((err) => console.log("Error back denied:", err.message));
    }

    // --- LÓGICA DE RESET DE ECONOMÍA ---
    if (data === "CONFIRM_RESET_ECONOMY") {
      if (ctx.from.id !== Auth.ADMIN_ID) {
        return ctx.answerCbQuery("🚫 No tienes permiso para esto.", {
          show_alert: true,
        });
      }

      const totalUsers = CreditsManager.clearAll();

      await ctx.editMessageText(
        `☢️ <b>ECONOMÍA RESETEADA</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `Se han limpiado los créditos de <b>${totalUsers}</b> usuarios.\n` +
          `📊 <b>Estado:</b> <code>CERO ABSOLUTO</code>\n` +
          `━━━━━━━━━━━━━━━━━━`,
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
      );

      if (typeof sendLog !== "undefined") {
        await sendLog(
          ctx,
          `RESETEO TOTAL DE ECONOMÍA (Usuarios afectados: ${totalUsers})`,
        );
      }
    }

    if (data === "CANCEL_RESET") {
      await ctx.editMessageText(
        "✅ <b>Acción cancelada.</b> La economía sigue intacta.",
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
      );
    }

    // --- SECCIÓN DE CONFIGURACIÓN (MANEJO DE ESTADOS) ---
    if (data.startsWith("SET_STATE_")) {
      const state = data.replace("SET_STATE_", "");

      userState[uid] = { step: "WAITING_ID", type: state };
      console.log(`[DEBUG] Estado guardado para ${uid}:`, userState[uid]);

      const prompts = {
        STAFF: "Escribe el <b>ID del Usuario</b> para gestionar su Rango:",
        CRED: "Escribe el <b>ID del Usuario</b> para gestionar sus Créditos:",
        GRP: "Escribe el <b>ID del Grupo</b> (ej: -100...) para Autorizar/Revocar:",
        KEYS: "Escribe la <b>KEY</b> (ej: DEV-...) para Confirmar/Eliminar:",
      };

      return ctx
        .editMessageText(
          `📥 <b>ESPERANDO DATOS</b>\n━━━━━━━━━━━━━━━━━━\n${prompts[state]}`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "❌ VOLVER AL PANEL",
                  "BACK_TO_MAIN_CONFIG",
                ),
              ],
            ]),
          },
        )
        .catch((e) => console.log("Error al editar:", e.message));
    }

    if (data === "BACK_TO_MAIN_CONFIG") {
      delete userState[uid];
      const menu = `⚙️ <b>CONFIGURACIÓN MAESTRA</b>\n━━━━━━━━━━━━━━━━━━\nSelecciona categoría:`;
      return ctx
        .editMessageText(menu, {
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
            [Markup.button.callback("🔙 VOLVER AL INICIO", "BACK_TO_START")],
          ]),
        })
        .catch(() => {});
    }

    if (data.startsWith("REV_ALL_")) {
      const tid = data.replace("REV_ALL_", "");
      Auth.unauthorize(tid);
      CreditsManager.remove(tid, "ALL");

      await ctx
        .editMessageText(
          `🛡️ <b>ACCESOS REVOCADOS</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🆔 ID: <code>${tid}</code>\n` +
            `⚠️ El usuario ha sido removido del Staff y su saldo quedó en 0.`,
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
    }

    if (data.startsWith("CONF_STAFF_")) {
      const tid = data.replace("CONF_STAFF_", "");
      const buttons = [
        [
          Markup.button.callback("ADMIN", `SET_RANG_${tid}_ADMIN`),
          Markup.button.callback("SELLER", `SET_RANG_${tid}_SELLER`),
        ],
        [Markup.button.callback("🔙 VOLVER AL PANEL", "BACK_TO_MAIN_CONFIG")],
      ];
      await ctx
        .editMessageText(
          `🎖️ <b>ASIGNAR RANGO STAFF</b>\n🆔 ID: <code>${tid}</code>\n\nSelecciona el nivel:`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard(buttons),
          },
        )
        .catch(() => {});
    }

    if (data.startsWith("SET_RANG_")) {
      const [_, __, tid, rango] = data.split("_");
      try {
        const userChat = await ctx.telegram.getChat(tid);
        const fullName =
          `${userChat.first_name || "Usuario"} ${userChat.last_name || ""}`.trim();
        const username = userChat.username
          ? `@${userChat.username}`
          : "Sin Alias";

        Auth.authorize(tid, rango, fullName);

        await ctx.editMessageText(
          `👮 <b>STAFF ACTUALIZADO</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `👤 <b>Nombre:</b> <code>${fullName}</code>\n` +
            `🏷️ <b>User:</b> <code>${username}</code>\n` +
            `🆔 <b>ID:</b> <code>${tid}</code>\n` +
            `🎖️ <b>Rango:</b> <code>${rango}</code>\n\n` +
            `✅ <i>Permisos aplicados y nombre registrado.</i>`,
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
        );
      } catch (error) {
        Auth.authorize(tid, rango, "Desconocido");
        await ctx.editMessageText(
          `⚠️ <b>STAFF ACTUALIZADO (Limitado)</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `ID: <code>${tid}</code>\n` +
            `Rango: <b>${rango}</b>\n\n` +
            `<i>No pude obtener el nombre real, pero el rango fue asignado.</i>`,
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
        );
      }
    }

    if (data.startsWith("CONF_CRED_")) {
      const tid = data.replace("CONF_CRED_", "");
      const buttons = [
        [
          Markup.button.callback("+10", `ADD_DIR_${tid}_10`),
          Markup.button.callback("+50", `ADD_DIR_${tid}_50`),
          Markup.button.callback("+100", `ADD_DIR_${tid}_100`),
        ],
        [Markup.button.callback("🔙 VOLVER AL PANEL", "BACK_TO_MAIN_CONFIG")],
      ];
      await ctx
        .editMessageText(
          `💰 <b>AÑADIR CRÉDITOS</b>\n🆔 ID: <code>${tid}</code>\n\nSelecciona el monto a sumar:`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard(buttons),
          },
        )
        .catch(() => {});
    }

    if (data.startsWith("ADD_DIR_")) {
      const [_, __, tid, cant] = data.split("_");
      CreditsManager.addDirect(tid, cant);
      await ctx.editMessageText(
        `✅ <b>RECARGA EXITOSA</b>\n🆔 ID: <code>${tid}</code>\n📈 Sumado: <b>+${cant} crds</b>\n💰 El saldo ha sido actualizado.`,
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
      );
    }

    if (data.startsWith("CONF_GRP_")) {
      const gid = data.replace("CONF_GRP_", "");
      try {
        const chatInfo = await ctx.telegram.getChat(gid);
        const groupTitle = chatInfo.title || "Grupo Privado";
        Auth.authData.groups = Auth.authData.groups || {};
        Auth.authData.groups[gid] = groupTitle;
        Auth.saveIds();

        await ctx.editMessageText(
          `✅ <b>GRUPO AUTORIZADO</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `👥 <b>Nombre:</b> <code>${groupTitle}</code>\n` +
            `🆔 <b>GID:</b> <code>${gid}</code>\n\n` +
            `<i>Ahora aparecerá correctamente en tu /list.</i>`,
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
        );
      } catch (error) {
        Auth.authData.groups[gid] = "Grupo Desconocido";
        Auth.saveIds();
        await ctx.answerCbQuery(
          "⚠️ No pude obtener el nombre, pero lo autoricé.",
          { show_alert: true },
        );
      }
    }

    if (data.startsWith("REV_GRP_")) {
      const gid = data.replace("REV_GRP_", "");
      if (Auth.authData.groups) {
        delete Auth.authData.groups[gid];
        Auth.saveIds();
      }
      await ctx
        .editMessageText(
          `🚫 <b>GRUPO REVOCADO</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🆔 GID: <code>${gid}</code>\n` +
            `⚠️ El acceso ha sido retirado para este grupo.`,
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
    }

    if (data.startsWith("CONF_KEY_")) {
      const key = data.replace("CONF_KEY_", "");
      await ctx.editMessageText(
        `✅ <b>KEY CONFIRMADA</b>\n<code>${key}</code>\nEstado: Activa.`,
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
      );
    }

    if (data.startsWith("REV_KEY_")) {
      const key = data.replace("REV_KEY_", "");
      if (Auth.authData.activeKeys) {
        delete Auth.authData.activeKeys[key];
        Auth.saveKeys();
      }
      await ctx.editMessageText(
        `🗑️ <b>KEY ELIMINADA</b>\n<code>${key}</code>\nRemovida del sistema.`,
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
      );
    }

    if (data === "HELP_STAFF") {
      const text =
        `👮 <b>COMANDOS PARA EL STAFF</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🛠️ <b>GESTIÓN:</b>\n` +
        `├ <code>/auth</code> - Autorizar Staff\n` +
        `├ <code>/unauth</code> - Revocar Staff\n` +
        `├ <code>/config</code> - Panel Maestro\n` +
        `└ <code>/list</code> - Ver base de datos\n\n` +
        `💰 <b>CRÉDITOS:</b>\n` +
        `├ <code>/add</code> - Dar créditos (Caja Chica)\n` +
        `└ <code>/key</code> - Generar Key de acceso`;

      return ctx
        .editMessageText(text, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("⬅️ VOLVER", "BACK_TO_START")],
          ]),
        })
        .catch(() => {});
    }

    if (data === "BACK_TO_START") {
      const profile = getUserProfile(uid, ctx.from.first_name);

      // Obtenemos los mismos botones que el comando /start original
      const staffData = Auth.authData.users[uid];
      const vipData = Auth.authData.commonUsers[uid];
      const isAdmin = uid === Auth.ADMIN_ID;
      let buttons = [];

      if (isAdmin) {
        buttons = [
          [
            Markup.button.callback(
              "🛠️ CONFIGURACIÓN GLOBAL",
              "BACK_TO_MAIN_CONFIG",
            ),
          ],
          [Markup.button.callback("👮 PANEL DE STAFF", "HELP_STAFF")],
          [Markup.button.callback("🚀 HERRAMIENTAS VIP", "BACK_HELP")],
        ];
      } else if (staffData) {
        buttons = [
          [Markup.button.callback("🛡️ COMANDOS STAFF", "HELP_STAFF")],
          [Markup.button.callback("🚀 HERRAMIENTAS VIP", "BACK_HELP")],
          [Markup.button.callback("👤 MI ESTADO", "SHOW_PROFILE")],
        ];
      } else {
        buttons = [
          [Markup.button.callback("💳 VER PLANES", "SHOW_PRICES")],
          [Markup.button.callback("📖 AYUDA FREE", "BACK_HELP")],
          [Markup.button.url("🛒 COMPRAR ACCESO", "https://t.me/devcrackpy")],
        ];
      }

      const header =
        `⚡ <b>SOCIETY . E X E</b> ⚡\n` +
        `<i>"Knowledge is power, access is everything."</i>\n\n` +
        `🚀 <b> . E X E CHECKER V3.0</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `El validador más rápido y preciso del mercado. Optimizado para profesionales.\n\n` +
        `✨ <b>FEATURES:</b>\n` +
        `├ ⚡ <b>Ultra-Speed:</b> Motor multi-hilo.\n` +
        `├ 🛡️ <b>Anti-Ban:</b> Proxies residenciales.\n` +
        `├ 🎯 <b>High Precision:</b> Gateway directo.\n` +
        `└ 💎 <b>Soporte 24/7:</b> Update constante.\n` +
        `━━━━━━━━━━━━━━━━━━`;
      // EDITAMOS en lugar de borrar y enviar /start
      return ctx
        .editMessageText(`${header}\n${profile}`, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard(buttons),
        })
        .catch(() => {});
    }

    if (data === "UPDATE_STATS") {
      if (ctx.from.id !== Auth.ADMIN_ID) {
        return ctx.answerCbQuery("🚫 No tienes permisos para esto.", {
          show_alert: true,
        });
      }

      try {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const staffEntries = Object.values(Auth.authData.users);
        const admins = staffEntries.filter((u) => u.rango === "ADMIN").length;
        const sellers = staffEntries.filter((u) => u.rango === "SELLER").length;

        const totalVips = Object.keys(Auth.authData.commonUsers).length;
        const totalGroups = Object.keys(Auth.authData.groups).length;
        const pendingKeys = Object.keys(Auth.authData.activeKeys).length;

        const commonUsersArray = Object.values(Auth.authData.commonUsers);
        const totalCreditsCirculating = commonUsersArray.reduce(
          (acc, user) => acc + (parseInt(user.credits) || 0),
          0,
        );

        const ecoStatus =
          totalCreditsCirculating > 5000 ? "INFLACIÓN ALTA ⚠️" : "ESTABLE ✅";

        const updateMsg =
          `🛰 <b>DASHBOARD DE OPERACIONES</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `🖥 <b>ESTADO DEL CORE:</b>\n` +
          `├ <b>Status:</b> <code>STABLE</code> 💹\n` +
          `└ <b>Uptime:</b> <code>${hours}h ${minutes}m</code>\n\n` +
          `👮 <b>FUERZA DE STAFF:</b>\n` +
          `├ <b>Admins:</b> <code>${admins}</code>\n` +
          `└ <b>Sellers:</b> <code>${sellers}</code>\n\n` +
          `💎 <b>INFRAESTRUCTURA VIP:</b>\n` +
          `├ <b>Usuarios:</b> <code>${totalVips}</code>\n` +
          `├ <b>Grupos:</b> <code>${totalGroups}</code>\n` +
          `└ <b>Keys Stock:</b> <code>${pendingKeys}</code>\n\n` +
          `💰 <b>ECONOMÍA GLOBAL:</b>\n` +
          `├ <b>Circulante:</b> <code>${totalCreditsCirculating.toLocaleString()} crds</code> 💸\n` +
          `└ <b>Estado:</b> <code>${ecoStatus}</code>\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `<i>✨ Sincronizado: ${new Date().toLocaleTimeString()}</i>`;

        await ctx.editMessageText(updateMsg, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔄 REFRESCAR DATOS", "UPDATE_STATS")],
            [Markup.button.callback("🔙 VOLVER", "BACK_TO_START")],
          ]),
        });

        return ctx.answerCbQuery("📊 Estadísticas actualizadas");
      } catch (err) {
        console.error("Error al actualizar stats:", err);
        return ctx.answerCbQuery("❌ Error al sincronizar datos.");
      }
    }

    await ctx.answerCbQuery().catch(() => {});
  });
};
