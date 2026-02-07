const fs = require("fs");
const { Markup } = require("telegraf");
require("dotenv").config();

const path = "./authorized_ids.json";
const keyPath = "./keys.json";

// 1. PRIMERO declaramos la constante (el parseo del .env)
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

// 2. DESPUÉS la usamos en el objeto
let authData = {
  users: new Set([ADMIN_ID]),
  groups: new Set([]),
  commonUsers: {},
  activeKeys: {},
};

const DURATIONS = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
};

// --- FUNCIONES DE PERSISTENCIA ---
const loadAll = () => {
  if (fs.existsSync(path)) {
    try {
      const raw = JSON.parse(fs.readFileSync(path, "utf8"));
      if (raw.users)
        raw.users.forEach((id) => authData.users.add(parseInt(id)));
      if (raw.groups)
        raw.groups.forEach((id) => authData.groups.add(parseInt(id)));
    } catch (e) {
      console.error("Error cargando IDs:", e);
    }
  }

  if (fs.existsSync(keyPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(keyPath, "utf8"));
      authData.commonUsers = data.commonUsers || {};
      authData.activeKeys = data.activeKeys || {};
    } catch (e) {
      console.error("Error cargando Keys:", e);
    }
  }
};

loadAll();

const saveIds = () => {
  const data = {
    users: Array.from(authData.users),
    groups: Array.from(authData.groups),
  };
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
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

// --- MIDDLEWARE ---
const authMiddleware = async (ctx, next) => {
  if (ctx.callbackQuery) return next();
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (
    userId === ADMIN_ID ||
    authData.users.has(userId) ||
    authData.groups.has(chatId)
  ) {
    return next();
  }

  const expiration = authData.commonUsers[userId];
  if (expiration) {
    if (Date.now() < expiration) {
      return next();
    } else {
      delete authData.commonUsers[userId];
      saveKeys();
      return ctx.reply("⌛ Tu acceso ha expirado.");
    }
  }

  if (ctx.updateType === "message" && ctx.message.text?.startsWith("/")) {
    return ctx.reply(
      `🚫 Acceso denegado. ID: ${chatId}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📩 Solicitar Acceso", `REQ${chatId}`)],
      ]),
    );
  }
};

// --- EXPORTACIÓN DE MÉTODOS ---
const authorize = (id) => {
  const numId = parseInt(id);
  if (isNaN(numId)) return false;
  if (numId < 0) authData.groups.add(numId);
  else authData.users.add(numId);
  saveIds();
  return true;
};

const unauthorize = (id) => {
  const numId = parseInt(id);
  const deleted = authData.users.delete(numId) || authData.groups.delete(numId);
  if (deleted) saveIds();
  return deleted;
};

const generateKey = (type) => {
  const duration = DURATIONS[type] || DURATIONS["1d"];
  const key = `DEV-${type.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  authData.activeKeys[key] = duration;
  saveKeys();
  return key;
};

const redeemKey = (userId, key) => {
  const duration = authData.activeKeys[key];
  if (duration) {
    const expiration = Date.now() + duration;
    authData.commonUsers[userId] = expiration;
    delete authData.activeKeys[key];
    saveKeys();
    return new Date(expiration).toLocaleString();
  }
  return false;
};

module.exports = {
  authMiddleware,
  authorize,
  unauthorize,
  ADMIN_ID,
  authData,
  generateKey,
  redeemKey,
};
