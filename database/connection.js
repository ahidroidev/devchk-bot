// database/connection.js
const Database = require("better-sqlite3");

// Conexión a la DB (se crea el archivo 'society.db' automáticamente)
const db = new Database("society.db", { verbose: null });

// MODO WAL: Velocidad y seguridad crítica
db.pragma("journal_mode = WAL");

console.log("🔋 [SQLITE] Base de datos conectada.");

// --- INICIALIZACIÓN DE TABLAS ---
const initDB = () => {
  // 1. Tabla de STAFF
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT,
      role TEXT,
      limit_amount INTEGER DEFAULT 0,
      monthly_flow INTEGER DEFAULT 0
    )
  `);

  // 2. Tabla de USUARIOS VIP
  db.exec(`
    CREATE TABLE IF NOT EXISTS vips (
      id TEXT PRIMARY KEY,
      name TEXT,
      credits INTEGER DEFAULT 0,
      expiration INTEGER,
      total_bought INTEGER DEFAULT 0,
      total_spent INTEGER DEFAULT 0,
      key_used TEXT,
      key_type TEXT
    )
  `);

  // 3. Tabla de KEYS
  db.exec(`
    CREATE TABLE IF NOT EXISTS keys (
      code TEXT PRIMARY KEY,
      duration INTEGER,
      created_at INTEGER
    )
  `);

  // 4. Tabla de BANEADOS
  db.exec(`
    CREATE TABLE IF NOT EXISTS bans (
      id TEXT PRIMARY KEY,
      reason TEXT,
      banned_at INTEGER
    )
  `);
};

initDB();

module.exports = db;
