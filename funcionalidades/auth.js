const fs = require("fs");
const path = "./authorized_ids.json";

// Tu ID de Administrador (Cámbialo por el tuyo real)
const ADMIN_ID = 8477619369;

// Cargar IDs desde el archivo o usar los iniciales
let authorizedIds = new Set([ADMIN_ID, -1001753736546]);

if (fs.existsSync(path)) {
  const data = JSON.parse(fs.readFileSync(path));
  data.forEach((id) => authorizedIds.add(id));
}

const saveIds = () => {
  fs.writeFileSync(path, JSON.stringify(Array.from(authorizedIds)));
};

const authMiddleware = (ctx, next) => {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  // Permitir si el chat (grupo) o el usuario están en la lista
  if (authorizedIds.has(chatId) || authorizedIds.has(userId)) {
    return next();
  }

  // Ignorar si no está autorizado (evita spam de respuestas en grupos)
  if (ctx.updateType === "message" && ctx.message.text?.startsWith("/")) {
    return ctx.reply("🚫 Chat o Usuario no autorizado. ID: " + chatId);
  }
};

const authorizeUser = (id) => {
  const numId = parseInt(id);
  if (isNaN(numId)) return false;
  authorizedIds.add(numId);
  saveIds(); // Guardar en el JSON
  return true;
};

const unauthorizeUser = (id) => {
  const numId = parseInt(id);
  if (isNaN(numId)) return false;

  if (authorizedIds.has(numId)) {
    authorizedIds.delete(numId);
    saveIds(); // Actualizar el JSON
    return true;
  }
  return false;
};

module.exports = { authMiddleware, authorizeUser, ADMIN_ID };
