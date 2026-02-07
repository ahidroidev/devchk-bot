const fs = require("fs");
const { Markup } = require("telegraf");
require("dotenv").config();

const path = "./authorized_ids.json";
const keyPath = "./keys.json";
// Forzamos que el ADMIN_ID sea un número para evitar errores de comparación
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

let authData = {
  users: new Set([ADMIN_ID]),
  groups: new Set([]),
  commonUsers: new Set([]),
  activeKeys: new Set([]),
};

const loadKeys = () => {
  if (fs.existsSync(keyPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(keyPath, "utf8"));
      if (data.commonUsers)
        data.commonUsers.forEach((id) =>
          authData.commonUsers.add(parseInt(id)),
        );
      if (data.activeKeys)
        data.activeKeys.forEach((key) => authData.activeKeys.add(key));
    } catch (e) {
      console.error("Error cargando keys :", e);
    }
  }
};
loadKeys(); //Cargar Keys al iniciar el bot

const saveKeys = () => {
  const data = {
    commonUsers: Array.from(authData.commonUsers),
    activeKeys: Array.from(authData.activeKeys),
  };
  fs.writeFileSync(keyPath, JSON.stringify(data, null, 2));
};

// Cargar IDs desde el JSON al iniciar
if (fs.existsSync(path)) {
  try {
    const rawData = JSON.parse(fs.readFileSync(path, "utf8"));
    if (rawData.users)
      rawData.users.forEach((id) => authData.users.add(parseInt(id)));
    if (rawData.groups)
      rawData.groups.forEach((id) => authData.groups.add(parseInt(id)));
  } catch (e) {
    console.error("Error cargando JSON:", e);
  }
}

const saveIds = () => {
  const dataToSave = {
    users: Array.from(authData.users),
    groups: Array.from(authData.groups),
  };
  fs.writeFileSync(path, JSON.stringify(dataToSave, null, 2));
};

const authMiddleware = async (ctx, next) => {
  // 1. Permitir siempre botones (Callbacks)
  if (ctx.callbackQuery) return next();

  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  // 2. REGLA DE ORO: Si eres el Admin, pasas siempre (Comparación numérica)
  if (userId === ADMIN_ID) return next();

  // 3. Verificar si el ID del chat o del usuario está autorizado
  const isAuthorizedAdmin =
    ctx.chat.type === "private"
      ? authData.users.has(userId)
      : authData.groups.has(chatId);
  const isAuthorizedUser = authData.commonUsers.has(userId);

  if (isAuthorizedAdmin || isAuthorizedUser) return next();

  if (ctx.updateType === "message" && ctx.message.text?.startsWith("/start")) {
    return ctx.reply(
      `⚠️ No estás autorizado para usar este bot.\n` +
        `Puedes solicitar acceso al administrador (${ADMIN_ID}) pulsando el botón a continuación.`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📩 Solicitar Acceso", `REQ${chatId}`)],
      ]),
    );
  }
};

const generateKeys = () => {
  const key = `KEY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  authData.activeKeys.add(key);
  saveKeys();
  return key;
};

const redeemkey = (userId, key) => {
  if (authData.activeKeys.has(key)) {
    authData.activeKeys.delete(key);
    authData.commonUsers.add(parseInt(userId));
    saveKeys();
    return true;
  }
};

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

module.exports = {
  authData,
  generateKeys,
  redeemkey,
  authMiddleware,
  authorize,
  unauthorize,
  ADMIN_ID,
  authData,
};
