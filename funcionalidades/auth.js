const fs = require("fs");
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

// 2. ESTADO DEL BOT
let authData = {
  users: {}, // STAFF: { "id": { name, rango } }
  commonUsers: {}, // VIPS:  { "id": { expiration, name, credits } }
  activeKeys: {},
  bannedUsers: {}, // <--- NUEVO: Lista negra { "id": "Razón" }
  notifiedUsers: new Set(),
  cooldowns: new Map(),
};

// 3. PERSISTENCIA
const saveIds = () => {
  try {
    const dataToSave = {
      users: authData.users,
      commonUsers: authData.commonUsers,
      bannedUsers: authData.bannedUsers, // Guardar baneados
    };
    fs.writeFileSync(path, JSON.stringify(dataToSave, null, 2));
  } catch (e) {
    console.error("Error guardando IDs:", e);
  }
};

const saveKeys = () => {
  try {
    fs.writeFileSync(keyPath, JSON.stringify(authData.activeKeys, null, 2));
  } catch (e) {
    console.error("Error guardando Keys:", e);
  }
};

// Cargar datos al inicio
try {
  if (fs.existsSync(path)) {
    const data = JSON.parse(fs.readFileSync(path));
    authData.users = data.users || {};
    authData.commonUsers = data.commonUsers || {};
    authData.bannedUsers = data.bannedUsers || {}; // Cargar baneados
  }
  if (fs.existsSync(keyPath)) {
    authData.activeKeys = JSON.parse(fs.readFileSync(keyPath));
  }
} catch (e) {
  console.error("Error cargando DB:", e);
}

// --- LÓGICA DE JERARQUÍA (IMPORTANTE) ---

const getRole = (userId) => {
  const uid = String(userId);
  const adminIdStr = String(ADMIN_ID);

  if (uid === adminIdStr) return "OWNER";

  if (authData.users[uid]) {
    return authData.users[uid].rango; // Retorna: ADMIN, SELLER o MOD
  }

  const vip = authData.commonUsers[uid];
  if (vip && vip.expiration > Date.now()) {
    return "VIP";
  }

  return "FREE";
};

// Verifica si un rol tiene permiso sobre otro (Matemática de poder)
const canManage = (issuerId, targetId) => {
  const hierarchy = { OWNER: 5, ADMIN: 4, SELLER: 3, MOD: 2, VIP: 1, FREE: 0 };

  const issuerRole = getRole(issuerId);
  const targetRole = getRole(targetId);

  // Regla de Oro: Nadie toca al Owner
  if (targetRole === "OWNER") return false;

  // Para accionar, tu rango debe ser ESTRICTAMENTE mayor que el del objetivo
  return (hierarchy[issuerRole] || 0) > (hierarchy[targetRole] || 0);
};

// --- GESTIÓN DE STAFF Y BANEOS ---

const authorize = (id, rango, name) => {
  authData.users[id] = { rango, name };
  // Si era VIP o Baneado, limpiamos eso
  if (authData.commonUsers[id]) delete authData.commonUsers[id];
  if (authData.bannedUsers[id]) delete authData.bannedUsers[id];
  saveIds();
};

const unauthorize = (id) => {
  if (authData.users[id]) delete authData.users[id];
  if (authData.commonUsers[id]) delete authData.commonUsers[id];
  saveIds();
};

const banUserDB = (id, reason) => {
  unauthorize(id); // Quitamos Staff/VIP
  authData.bannedUsers[id] = reason;
  saveIds();
};

const unbanUserDB = (id) => {
  if (authData.bannedUsers[id]) delete authData.bannedUsers[id];
  saveIds();
};

const isBanned = (id) => {
  return !!authData.bannedUsers[id];
};

// --- GESTIÓN DE KEYS ---

const generateKey = (type) => {
  const duration = DURATIONS[type] || DURATIONS["1d"];
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  const key = `DEV-${type.toUpperCase()}-${randomHex}`;
  authData.activeKeys[key] = duration;
  saveKeys();
  return key;
};

const redeemKey = (userId, key, firstName = "Usuario") => {
  const duration = authData.activeKeys[key];
  if (duration) {
    const expiration = Date.now() + duration;
    const currentCredits = authData.commonUsers[userId]?.credits || 0;

    authData.commonUsers[userId] = {
      expiration: expiration,
      name: firstName,
      credits: currentCredits + 50,
    };
    delete authData.activeKeys[key];
    saveKeys();
    saveIds();
    return new Date(expiration).toLocaleString();
  }
  return false;
};

// --- MIDDLEWARE DE SEGURIDAD ---
const authMiddleware = (ctx, next) => {
  if (ctx.from && isBanned(ctx.from.id)) {
    // Usuario baneado en DB no puede usar el bot
    return;
  }
  return next();
};

module.exports = {
  ADMIN_ID,
  authData,
  saveIds,
  saveKeys,
  getRole,
  canManage,
  authorize,
  unauthorize,
  banUserDB, // Nuevo
  unbanUserDB, // Nuevo
  isBanned, // Nuevo
  generateKey,
  redeemKey,
  authMiddleware,
};
