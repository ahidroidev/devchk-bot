const fs = require("fs");
const { Markup } = require("telegraf");
require("dotenv").config();
const crypto = require("crypto");

const path = "./authorized_ids.json";
const keyPath = "./keys.json";

// 1. DEFINICIÓN DE CONSTANTES (Primero el ADMIN_ID para evitar ReferenceError)
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

const DURATIONS = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
};

// 2. ESTADO DEL BOT
let authData = {
  users: new Set([ADMIN_ID]),
  groups: new Set([]),
  commonUsers: {}, // { "userId": timestamp }
  activeKeys: {}, // { "KEY": durationMs }
  notifiedUsers: new Set(),
};

// 3. PERSISTENCIA
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

// 4. MIDDLEWARE DE PROTECCIÓN
const authMiddleware = async (ctx, next) => {
  // Dentro del authMiddleware, antes del next()
  if (ctx.message && ctx.message.text) {
    console.log(`[LOG] User ${ctx.from.id} usó: ${ctx.message.text}`);
    // Opcional: enviar esto también al canal de logs si quieres monitoreo extremo
  }
  if (ctx.callbackQuery) return next();
  const userId = ctx.from?.id;
  const firstName = ctx.from?.first_name || "Admin";

  // AUTOMATIZACIÓN: Si eres el dueño y no tienes nombre guardado, lo guardamos
  if (userId === ADMIN_ID && !authData.users[userId]) {
    authData.users[userId] = firstName;
    saveIds();
  }

  const isAdmin = userId === ADMIN_ID || authData.users[userId];

  if (isAdmin || authData.groups.has(ctx.chat?.id)) {
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

  if (ctx.updateType === "message" && ctx.message.text?.startsWith("/")) {
    return ctx.reply(
      `🚫 Acceso denegado. ID: ${ctx.chat?.id}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📩 Comprar Acceso", `REQ${ctx.chat?.id}`)],
      ]),
    );
  }
};

// 5. MÉTODOS DE ADMINISTRACIÓN Y KEYS
const authorize = (id, firstName = "Admin/Grupo") => {
  const numId = parseInt(id);
  if (isNaN(numId)) return false;

  // Guardamos el ID en el Set como siempre
  if (numId < 0) authData.groups.add(numId);
  else authData.users.add(numId);

  // OPCIONAL: Podrías crear un mapa de nombres para los admins también
  // pero por ahora mantengamos la consistencia
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
  // Genera 8 bytes -> 16 caracteres hexadecimales
  const randomHex = crypto.randomBytes(8).toString("hex").toUpperCase();
  const key = `DEV-${type.toUpperCase()}-${randomHex}`;

  authData.activeKeys[key] = duration;
  saveKeys();
  return key;
};

const redeemKey = (userId, key, firstName = "Usuario") => {
  const duration = authData.activeKeys[key];
  if (duration) {
    const expiration = Date.now() + duration;

    // GUARDAMOS COMO OBJETO
    authData.commonUsers[userId] = {
      expiration: expiration,
      name: firstName || "Sin Nombre",
    };

    authData.notifiedUsers.delete(userId.toString());
    delete authData.activeKeys[key];
    saveKeys();
    return new Date(expiration).toLocaleString();
  }
  return false;
};

const revokeAccess = (id) => {
  const numId = parseInt(id);
  if (isNaN(numId)) return false;

  const deletedFromAdmins =
    authData.users.delete(numId) || authData.groups.delete(numId);
  if (deletedFromAdmins) saveIds();

  let deletedFromKeys = false;
  if (authData.commonUsers[numId]) {
    delete authData.commonUsers[numId];
    saveKeys();
    deletedFromKeys = true;
  }
  return deletedFromAdmins || deletedFromKeys;
};

const clearPendingKeys = () => {
  const count = Object.keys(authData.activeKeys).length;
  authData.activeKeys = {};
  saveKeys();
  return count;
};

// 6. EXPORTACIÓN
module.exports = {
  authMiddleware,
  authorize,
  unauthorize,
  ADMIN_ID,
  authData,
  saveKeys, // Exportado para el monitor de expiración en index.js
  generateKey,
  redeemKey,
  revokeAccess,
  clearPendingKeys,
};
