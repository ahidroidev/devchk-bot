const fs = require("fs");
const { Markup } = require("telegraf");
const path = "./authorized_ids.json";

// Cargar variables de entorno (Asegúrate de que ADMIN_ID esté en tu .env)
const ADMIN_ID = parseInt(process.env.ADMIN_ID.trim());

// Estructura inicial
let authData = {
  users: new Set([ADMIN_ID]),
  groups: new Set([-1001753736546]), // ID de ejemplo de tu grupo
};

// Cargar desde el archivo JSON si existe
if (fs.existsSync(path)) {
  const rawData = JSON.parse(fs.readFileSync(path));
  authData.users = new Set(rawData.users || [ADMIN_ID]);
  authData.groups = new Set(rawData.groups || []);
}

const saveIds = () => {
  const dataToSave = {
    users: Array.from(authData.users),
    groups: Array.from(authData.groups),
  };
  fs.writeFileSync(path, JSON.stringify(dataToSave, null, 2));
};

// funcionalidades/auth.js
const authMiddleware = async (ctx, next) => {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

  // REGLA DE ORO: Si eres el Admin del .env, pasas siempre
  if (userId === ADMIN_ID) {
    return next();
  }

  // Verificamos las listas para el resto
  const isAuthorized = isGroup
    ? authData.groups.has(chatId)
    : authData.users.has(userId);

  if (isAuthorized) return next();

  // Si no está autorizado, mostramos el botón
  if (ctx.updateType === "message" && ctx.message.text?.startsWith("/")) {
    return ctx.reply(
      `🚫 Acceso denegado.\nID: ${chatId}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📩 Solicitar Acceso", `req_${chatId}`)],
      ]),
    );
  }
};

// Función para autorizar detectando automáticamente si es grupo o usuario
const authorize = (id) => {
  const numId = parseInt(id);
  if (isNaN(numId)) return false;

  if (numId < 0) {
    authData.groups.add(numId);
  } else {
    authData.users.add(numId);
  }
  saveIds();
  return true;
};

const unauthorize = (id) => {
  const numId = parseInt(id);
  const removed = authData.users.delete(numId) || authData.groups.delete(numId);
  if (removed) saveIds();
  return removed;
};

module.exports = { authMiddleware, authorize, unauthorize, ADMIN_ID, authData };
