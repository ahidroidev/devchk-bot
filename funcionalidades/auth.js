// funcionalidades/auth.js
require("dotenv").config();
const crypto = require("crypto");
const db = require("../database/connection.js");

const ADMIN_ID = parseInt(process.env.ADMIN_ID);

const DURATIONS = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
};

// --- CONSULTAS SQL PREPARADAS ---
const sql = {
  getStaff: db.prepare("SELECT * FROM staff WHERE id = ?"),
  getVip: db.prepare("SELECT * FROM vips WHERE id = ?"),
  getBan: db.prepare("SELECT * FROM bans WHERE id = ?"),
  getKey: db.prepare("SELECT * FROM keys WHERE code = ?"),

  insertStaff: db.prepare(
    "INSERT OR REPLACE INTO staff (id, role, name, limit_amount, monthly_flow) VALUES (?, ?, ?, ?, ?)",
  ),
  deleteStaff: db.prepare("DELETE FROM staff WHERE id = ?"),

  insertVip: db.prepare(
    "INSERT OR REPLACE INTO vips (id, name, credits, expiration, total_bought, total_spent, key_used, key_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ),
  deleteVip: db.prepare("DELETE FROM vips WHERE id = ?"),

  insertBan: db.prepare(
    "INSERT OR REPLACE INTO bans (id, reason, banned_at) VALUES (?, ?, ?)",
  ),
  deleteBan: db.prepare("DELETE FROM bans WHERE id = ?"),

  insertKey: db.prepare(
    "INSERT INTO keys (code, duration, created_at) VALUES (?, ?, ?)",
  ),
  deleteKey: db.prepare("DELETE FROM keys WHERE code = ?"),

  allKeys: db.prepare("SELECT * FROM keys"),
  allStaff: db.prepare("SELECT * FROM staff"),
  allVips: db.prepare("SELECT * FROM vips"),
};

// --- FUNCIONES DE OBTENCIÓN MASIVA (Para Listas) ---
const getAllKeys = () => {
  const keys = {};
  sql.allKeys.all().forEach((k) => (keys[k.code] = k.duration));
  return keys;
};

const getAllStaff = () => {
  const staff = {};
  // Mapeamos los campos de SQL a tu estructura original (rango, limit, monthlyFlow)
  sql.allStaff
    .all()
    .forEach(
      (u) =>
        (staff[u.id] = {
          name: u.name,
          rango: u.role,
          limit: u.limit_amount,
          monthlyFlow: u.monthly_flow,
        }),
    );
  return staff;
};

const getAllVips = () => {
  const vips = {};
  sql.allVips
    .all()
    .forEach(
      (u) =>
        (vips[u.id] = {
          name: u.name,
          credits: u.credits,
          expiration: u.expiration,
          totalBought: u.total_bought,
          totalSpent: u.total_spent,
          keyUsed: u.key_used,
          keyType: u.key_type,
        }),
    );
  return vips;
};

// --- OBJETO HÍBRIDO (Mantiene compatibilidad con tu código visual) ---
const authData = {
  get activeKeys() {
    return getAllKeys();
  },
  get users() {
    return getAllStaff();
  },
  get commonUsers() {
    return getAllVips();
  },
  notifiedUsers: new Set(), // Memoria RAM
};

// --- SISTEMA DE ROLES ---
const getRole = (userId) => {
  const uid = String(userId);
  if (uid === String(ADMIN_ID)) return "OWNER";

  const staff = sql.getStaff.get(uid);
  if (staff) return staff.role;

  const vip = sql.getVip.get(uid);
  if (vip && vip.expiration > Date.now()) return "VIP";

  return "FREE";
};

const canManage = (issuerId, targetId) => {
  const hierarchy = { OWNER: 5, ADMIN: 4, SELLER: 3, MOD: 2, VIP: 1, FREE: 0 };
  const issuerRole = getRole(issuerId);
  const targetRole = getRole(targetId);
  if (targetRole === "OWNER") return false;
  return hierarchy[issuerRole] > hierarchy[targetRole];
};

// --- ACCIONES DE GESTIÓN ---
const authorize = (id, rango, name) => {
  const limit = rango === "ADMIN" ? 999999 : 500; // Límite por defecto
  sql.insertStaff.run(String(id), rango, name, limit, 0);
  sql.deleteVip.run(String(id));
  sql.deleteBan.run(String(id));
};

const unauthorize = (id) => {
  sql.deleteStaff.run(String(id));
  sql.deleteVip.run(String(id));
};

const banUserDB = (id, reason) => {
  unauthorize(id);
  sql.insertBan.run(String(id), reason, Date.now());
};

const unbanUserDB = (id) => {
  sql.deleteBan.run(String(id));
};

const isBanned = (id) => !!sql.getBan.get(String(id));

// --- GESTIÓN DE KEYS ---
const generateKey = (type) => {
  const duration = DURATIONS[type] || DURATIONS["1d"];
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  const key = `DEV-${type.toUpperCase()}-${randomHex}`;
  sql.insertKey.run(key, duration, Date.now());
  return key;
};

const redeemKey = (userId, key, firstName = "Usuario") => {
  const keyData = sql.getKey.get(key);

  if (keyData) {
    const expiration = Date.now() + keyData.duration;
    const currentUser = sql.getVip.get(String(userId)) || {
      credits: 0,
      total_bought: 0,
      total_spent: 0,
    };

    let type = "Custom";
    if (keyData.duration === DURATIONS["1d"]) type = "1 Día";
    if (keyData.duration === DURATIONS["1w"]) type = "1 Sem";
    if (keyData.duration === DURATIONS["1m"]) type = "1 Mes";

    sql.insertVip.run(
      String(userId),
      firstName,
      currentUser.credits + 50,
      expiration,
      currentUser.total_bought,
      currentUser.total_spent,
      key,
      type,
    );

    sql.deleteKey.run(key);
    return new Date(expiration).toLocaleString();
  }
  return false;
};

// Placeholders para evitar errores en otros archivos
const saveIds = () => {};
const saveKeys = () => {};

const authMiddleware = (ctx, next) => {
  if (ctx.from && isBanned(ctx.from.id)) return;
  return next();
};

module.exports = {
  ADMIN_ID,
  authData, // OBJETO CLAVE PARA COMPATIBILIDAD
  getAllKeys,
  getAllStaff,
  getAllVips,
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
  sql,
};
