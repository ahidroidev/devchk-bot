const fs = require("fs");
const { Markup } = require("telegraf");
require("dotenv").config();
const crypto = require("crypto");

const path = "./authorized_ids.json";
const keyPath = "./keys.json";

// 1. DEFINICIÓN DE CONSTANTES
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

const DURATIONS = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
};

// 2. ESTADO DEL BOT (Grupos ahora es un Objeto {})
let authData = {
  users: {}, // { "id": { name, lastName, rango } }
  groups: {}, // { "id": "Nombre del Grupo" }
  commonUsers: {}, // { "id": { expiration, name, lastName } }
  activeKeys: {},
  notifiedUsers: new Set(),
  cooldowns: new Map(),
};

// 3. PERSISTENCIA
const saveIds = () => {
  const data = {
    users: authData.users,
    groups: authData.groups, // Guardamos el objeto directamente
  };
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error al escribir authorized_ids.json:", e);
  }
};

const saveKeys = () => {
  fs.writeFileSync(
    keyPath,
    JSON.stringify(
      {
        commonUsers: authData.commonUsers,
        activeKeys: authData.activeKeys,
      },
      null,
      2,
    ),
  );
};

const loadAll = () => {
  if (fs.existsSync(path)) {
    try {
      const raw = JSON.parse(fs.readFileSync(path, "utf8"));
      authData.users = raw.users || {};
      // Lógica de migración: Si groups era un array, lo convertimos a objeto
      if (Array.isArray(raw.groups)) {
        authData.groups = {};
        raw.groups.forEach((id) => {
          authData.groups[id] = "Grupo Autorizado";
        });
      } else {
        authData.groups = raw.groups || {};
      }
    } catch (e) {
      authData.users = {};
      authData.groups = {};
    }
  }
  if (fs.existsSync(keyPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(keyPath, "utf8"));
      authData.commonUsers = raw.commonUsers || {};
      authData.activeKeys = raw.activeKeys || {};
    } catch (e) {
      authData.commonUsers = {};
    }
  }
};

loadAll();

// 4. MIDDLEWARE DE PROTECCIÓN
const authMiddleware = async (ctx, next) => {
  if (ctx.message && ctx.message.text) {
    console.log(`[LOG] User ${ctx.from.id} usó: ${ctx.message.text}`);
  }

  if (ctx.callbackQuery) return next();

  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const firstName = ctx.from?.first_name || "Admin";
  const lastName = ctx.from?.last_name || "";

  // CAPTURA AUTOMÁTICA DE NOMBRE DE GRUPO
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    if (authData.groups[chatId]) {
      // Si el nombre en DB es diferente al actual del grupo, lo actualizamos
      if (authData.groups[chatId] !== ctx.chat.title) {
        authData.groups[chatId] = ctx.chat.title;
        saveIds();
      }
    }
  }

  // AUTOMATIZACIÓN: Dueño
  if (userId === ADMIN_ID && !authData.users[userId]) {
    authData.users[userId] = {
      name: firstName,
      lastName: lastName,
      rango: "OWNER",
    };
    saveIds();
  }

  const isAdmin = userId === ADMIN_ID || authData.users[userId];
  const isGroupAuthorized = authData.groups[chatId];

  if (isAdmin || isGroupAuthorized) {
    return next();
  }

  const userData = authData.commonUsers[userId];
  if (userData) {
    if (Date.now() < userData.expiration) {
      return next();
    } else {
      delete authData.commonUsers[userId];
      saveKeys();
      return ctx.reply("⌛ Tu acceso ha expirado.");
    }
  }

  // MENSAJE DE ACCESO DENEGADO
  if (ctx.updateType === "message" && ctx.message.text?.startsWith("/")) {
    return ctx.replyWithHTML(
      `🚫 <b>ACCESO RESTRINGIDO</b>\n━━━━━━━━━━━━━━━━━━\n` +
        `No cuentas con una membresía activa para usar esta función.\n\n` +
        `🆔 ID: <code>${ctx.from.id}</code>`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("💳 Ver Planes", "SHOW_PRICES"),
          Markup.button.callback("🔑 Canjear Key", "REDEEM_HELP"),
        ],
        [Markup.button.url("👨‍💻 Soporte Directo", "https://t.me/devcrackpy")],
      ]),
    );
  }
};

// 5. MÉTODOS DE ADMINISTRACIÓN
const authorize = (id, name = "Staff/Grupo", rango = "MOD", limit = 0) => {
  const numId = parseInt(id);
  if (isNaN(numId)) return { success: false, type: "ERROR" };

  let type = "";
  if (numId < 0) {
    authData.groups[numId] = name || "Grupo Autorizado";
    type = "GRUPO";
  } else {
    const validRanges = ["ADMIN", "SELLER", "MOD"];
    type = validRanges.includes(rango.toUpperCase())
      ? rango.toUpperCase()
      : "MOD";

    // Si es ADMIN, le asignamos su Caja Chica (limit)
    authData.users[numId] = {
      name: name,
      rango: type,
      limit: parseInt(limit) || 0, // Aquí nace la Caja Chica
    };
    console.log(
      `[AUTH] 🎖️ ${type} autorizado: ${name} (${numId}) con cupo: ${limit}`,
    );
  }

  saveIds();
  return { success: true, type: type, name: name, limit: limit };
};

const unauthorize = (id) => {
  const numId = parseInt(id);
  if (isNaN(numId)) return { success: false };

  let result = { success: false, type: "", name: "" };

  if (numId < 0) {
    if (authData.groups[numId]) {
      result = { success: true, type: "GRUPO", name: authData.groups[numId] };
      delete authData.groups[numId];
      saveIds();
    }
  } else if (authData.users[numId]) {
    const oldData = authData.users[numId];
    result = {
      success: true,
      type: oldData.rango || "STAFF",
      name: oldData.name,
    };
    delete authData.users[numId];
    saveIds();
  } else if (authData.commonUsers[numId]) {
    const oldData = authData.commonUsers[numId];
    result = { success: true, type: "KEY VIP", name: oldData.name };
    delete authData.commonUsers[numId];
    saveKeys();
  }

  if (result.success) {
    console.log(`[UNAUTH] 🗑️ Removido: ${result.type} | ID: ${numId}`);
  }
  return result;
};

const generateKey = (type) => {
  const duration = DURATIONS[type] || DURATIONS["1d"];
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  const key = `DEV-${type.toUpperCase()}-${randomHex}`;
  authData.activeKeys[key] = duration;
  saveKeys();
  return key;
};

const redeemKey = (userId, key, firstName = "Usuario", lastName = "") => {
  const duration = authData.activeKeys[key];
  if (duration) {
    const expiration = Date.now() + duration;
    authData.commonUsers[userId] = {
      expiration: expiration,
      name: firstName,
      lastName: lastName,
    };
    delete authData.activeKeys[key];
    saveKeys();
    return new Date(expiration).toLocaleString();
  }
  return false;
};

const clearPendingKeys = () => {
  const count = Object.keys(authData.activeKeys).length;
  authData.activeKeys = {};
  saveKeys();
  return count;
};

const checkCooldown = (userId, seconds) => {
  const now = Date.now();
  const userLastUse = authData.cooldowns.get(userId) || 0;
  if (now - userLastUse < seconds * 1000) {
    return ((seconds * 1000 - (now - userLastUse)) / 1000).toFixed(1);
  }
  authData.cooldowns.set(userId, now);
  return false;
};

module.exports = {
  authMiddleware,
  authorize,
  unauthorize,
  ADMIN_ID,
  authData,
  saveKeys,
  generateKey,
  redeemKey,
  clearPendingKeys,
  checkCooldown,
  saveIds,
};
