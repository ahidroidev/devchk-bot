const fs = require("fs");
require("dotenv").config();
const crypto = require("crypto");

const path = "./authorized_ids.json";
const keyPath = "./keys.json";

const ADMIN_ID = parseInt(process.env.ADMIN_ID);

const DURATIONS = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
};

let authData = {
  users: {}, // STAFF: { id: { name, rango, limit, monthlyFlow } } <--- AÑADIDO FLOW
  commonUsers: {}, // VIPS:  { id: { expiration, name, credits, totalBought, totalSpent, keyUsed, keyType } } <--- AÑADIDO STATS
  activeKeys: {},
  bannedUsers: {},
  notifiedUsers: new Set(),
  cooldowns: new Map(),
};

// --- PERSISTENCIA ---
const saveIds = () => {
  try {
    const dataToSave = {
      users: authData.users,
      commonUsers: authData.commonUsers,
      bannedUsers: authData.bannedUsers,
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

// Cargar DB
try {
  if (fs.existsSync(path)) {
    const data = JSON.parse(fs.readFileSync(path));
    authData.users = data.users || {};
    authData.commonUsers = data.commonUsers || {};
    authData.bannedUsers = data.bannedUsers || {};
  }
  if (fs.existsSync(keyPath)) {
    authData.activeKeys = JSON.parse(fs.readFileSync(keyPath));
  }
} catch (e) {
  console.error("Error cargando DB:", e);
}

// --- ROLES ---
const getRole = (userId) => {
  const uid = String(userId);
  if (uid === String(ADMIN_ID)) return "OWNER";
  if (authData.users[uid]) return authData.users[uid].rango;
  if (authData.commonUsers[uid]?.expiration > Date.now()) return "VIP";
  return "FREE";
};

const canManage = (issuerId, targetId) => {
  const hierarchy = { OWNER: 5, ADMIN: 4, SELLER: 3, MOD: 2, VIP: 1, FREE: 0 };
  const issuerRole = getRole(issuerId);
  const targetRole = getRole(targetId);
  if (targetRole === "OWNER") return false;
  return hierarchy[issuerRole] > hierarchy[targetRole];
};

// --- ACCIONES DB ---
const authorize = (id, rango, name) => {
  // Inicializamos al Staff con flujo 0 y límite por defecto (ej: 500)
  authData.users[id] = {
    rango,
    name,
    limit: rango === "ADMIN" ? 999999 : 500, // Límite de caja chica inicial
    monthlyFlow: 0,
  };
  if (authData.commonUsers[id]) delete authData.commonUsers[id];
  saveIds();
};

const unauthorize = (id) => {
  if (authData.users[id]) delete authData.users[id];
  if (authData.commonUsers[id]) delete authData.commonUsers[id];
  saveIds();
};

const banUserDB = (id, reason) => {
  unauthorize(id);
  authData.bannedUsers[id] = reason;
  saveIds();
};

const unbanUserDB = (id) => {
  if (authData.bannedUsers[id]) delete authData.bannedUsers[id];
  saveIds();
};

const isBanned = (id) => !!authData.bannedUsers[id];

// --- KEYS ---
const generateKey = (type) => {
  const duration = DURATIONS[type] || DURATIONS["1d"];
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  const key = `DEV-${type.toUpperCase()}-${randomHex}`;
  authData.activeKeys[key] = duration;
  saveKeys();
  return key;
};

// --- REDEEM CON TRACKING (NUEVO) ---
const redeemKey = (userId, key, firstName = "Usuario") => {
  const duration = authData.activeKeys[key];
  if (duration) {
    const expiration = Date.now() + duration;
    const currentUser = authData.commonUsers[userId] || {};

    // Determinamos tipo de key basado en duración
    let type = "Custom";
    if (duration === DURATIONS["1d"]) type = "1 Día";
    if (duration === DURATIONS["1w"]) type = "1 Sem";
    if (duration === DURATIONS["1m"]) type = "1 Mes";

    authData.commonUsers[userId] = {
      expiration: expiration,
      name: firstName,
      credits: (currentUser.credits || 0) + 50, // Bono
      totalBought: currentUser.totalBought || 0, // Mantenemos historial
      totalSpent: currentUser.totalSpent || 0, // Mantenemos historial
      keyUsed: key, // Guardamos la Key
      keyType: type, // Guardamos el tipo
    };
    delete authData.activeKeys[key];
    saveKeys();
    saveIds();
    return new Date(expiration).toLocaleString();
  }
  return false;
};

const authMiddleware = (ctx, next) => {
  if (ctx.from && isBanned(ctx.from.id)) return;
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
  banUserDB,
  unbanUserDB,
  isBanned,
  generateKey,
  redeemKey,
  authMiddleware,
};
