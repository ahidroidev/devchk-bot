const fs = require("fs");
const { Markup } = require("telegraf");
require("dotenv").config();

const path = "./authorized_ids.json";
// Forzamos que el ADMIN_ID sea un número para evitar errores de comparación
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

let authData = {
  users: new Set([ADMIN_ID]),
  groups: new Set([]),
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

  // 3. Verificar si el usuario o grupo está en la lista
  const isAuthorized =
    ctx.chat.type === "private"
      ? authData.users.has(userId)
      : authData.groups.has(chatId);

  if (isAuthorized) return next();

  // 4. Si no tiene acceso y es un comando, enviar botón
  if (ctx.updateType === "message" && ctx.message.text?.startsWith("/")) {
    return ctx.reply(
      `🚫 Acceso denegado. ID: ${chatId}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📩 Solicitar Acceso", `REQ${chatId}`)],
      ]),
    );
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

module.exports = { authMiddleware, authorize, unauthorize, ADMIN_ID, authData };
