// ... (mantenemos las importaciones anteriores)
const keyPath = "./keys.json";

let authData = {
  users: new Set([ADMIN_ID]),
  groups: new Set([]),
  commonUsers: {}, // Ahora es un objeto: { "ID": expirationTimestamp }
  activeKeys: {}, // Ahora es un objeto: { "KEY": durationInMs }
};

// --- LOGICA DE TIEMPOS ---
const DURATIONS = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
};

// Cargar y Guardar (ajustado para objetos)
const loadKeys = () => {
  if (fs.existsSync(keyPath)) {
    const data = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    authData.commonUsers = data.commonUsers || {};
    authData.activeKeys = data.activeKeys || {};
  }
};
loadKeys();

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

// --- MIDDLEWARE ACTUALIZADO CON EXPIRACIÓN ---
const authMiddleware = async (ctx, next) => {
  if (ctx.callbackQuery) return next();
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  // 1. Admins y Dueño (Siempre pasan)
  if (authData.users.has(userId) || authData.groups.has(chatId)) return next();

  // 2. Usuarios con Key (Verificar tiempo)
  const expiration = authData.commonUsers[userId];
  if (expiration) {
    if (Date.now() < expiration) {
      return next(); // Sigue activo
    } else {
      delete authData.commonUsers[userId]; // Expiró
      saveKeys();
      return ctx.reply("⌛ Tu acceso ha expirado. Adquiere una nueva Key.");
    }
  }

  // 3. Bloqueo
  if (ctx.updateType === "message" && ctx.message.text?.startsWith("/")) {
    return ctx.reply(`🚫 Acceso denegado. ID: ${chatId}`);
  }
};

// Funciones mejoradas
const generateKey = (type) => {
  const duration = DURATIONS[type] || DURATIONS["1d"];
  const key = `DEV-${type.toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
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
    return new Date(expiration).toLocaleDateString(); // Retorna fecha de fin
  }
  return false;
};

module.exports = {
  ...module.exports,
  authMiddleware,
  authData,
  generateKey,
  redeemKey,
};
