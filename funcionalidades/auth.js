// Función para validar usuarios
const ADMIN_ID = 8477619369; // Reemplaza con tu ID de Telegram
let authorizedIds = new Set([ADMIN_ID]); // Conjunto para almacenar IDs autorizados

// Export middleware auth
const authMiddleware = (ctx, next) => {
  const userId = ctx.from?.id;
  if (!authorizedIds.has(userId)) {
    ctx.reply("Unauthorized access.");
    return;
  }
  next();
};

const authorizeUser = (id) => {
  const numId = parseInt(id);
  if (isNaN(numId)) return false;
  authorizedIds.add(numId);
  return true;
};

// Export only needed
module.exports = {
  authMiddleware,
  authorizeUser,
  ADMIN_ID,
};
