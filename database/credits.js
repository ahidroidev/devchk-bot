// database/credits.js
const Auth = require("../funcionalidades/auth.js");
const db = require("./connection.js");

const sql = {
  getCredits: db.prepare("SELECT credits FROM vips WHERE id = ?"),
  deductCredit: db.prepare(
    "UPDATE vips SET credits = credits - 1, total_spent = total_spent + 1 WHERE id = ?",
  ),
  transferDeduct: db.prepare(
    "UPDATE vips SET credits = credits - ?, total_spent = total_spent + ? WHERE id = ?",
  ),
  addCredit: db.prepare(
    "UPDATE vips SET credits = credits + ?, total_bought = total_bought + ? WHERE id = ?",
  ),
  updateStaffFlow: db.prepare(
    "UPDATE staff SET monthly_flow = monthly_flow + ? WHERE id = ?",
  ),
  createVip: db.prepare(
    "INSERT OR IGNORE INTO vips (id, name, credits, expiration, total_bought, total_spent) VALUES (?, ?, ?, ?, ?, ?)",
  ),
  wipeCredits: db.prepare("UPDATE vips SET credits = 0 WHERE id = ?"),
  wipeAll: db.prepare("UPDATE vips SET credits = 0"),
};

const CreditsManager = {
  get: (userId) => {
    const role = Auth.getRole(userId);
    if (["OWNER", "ADMIN", "SELLER", "MOD"].includes(role)) return 999999;

    const user = sql.getCredits.get(String(userId));
    return user ? user.credits : 0;
  },

  consume: (userId) => {
    const role = Auth.getRole(userId);
    if (["OWNER", "ADMIN", "SELLER", "MOD"].includes(role)) return true;

    const current = CreditsManager.get(userId);
    if (current >= 1) {
      sql.deductCredit.run(String(userId));
      return true;
    }
    return false;
  },

  add: (targetId, amount, operatorId) => {
    const qty = parseInt(amount);
    if (isNaN(qty)) return false;
    const sid = String(targetId);

    sql.createVip.run(sid, "Usuario", 0, 0, 0, 0);
    sql.addCredit.run(qty, qty, sid);

    if (operatorId && Auth.getRole(operatorId) !== "OWNER") {
      const isStaff = Auth.sql.getStaff.get(String(operatorId));
      if (isStaff) {
        sql.updateStaffFlow.run(qty, String(operatorId));
      }
    }
    return CreditsManager.get(sid);
  },

  remove: (userId, amount) => {
    if (amount === "ALL") {
      sql.wipeCredits.run(String(userId));
    }
    return 0;
  },

  transfer: (senderId, targetId, amount) => {
    const qty = parseInt(amount);
    const senderRole = Auth.getRole(senderId);
    const sId = String(senderId);
    const tId = String(targetId);

    if (senderRole !== "OWNER") {
      const balance = CreditsManager.get(sId);
      if (balance < qty) return { success: false, msg: "Saldo insuficiente." };

      sql.transferDeduct.run(qty, qty, sId);
    }

    sql.createVip.run(tId, "Receptor", 0, 0, 0, 0);
    const addGift = db.prepare(
      "UPDATE vips SET credits = credits + ? WHERE id = ?",
    );
    addGift.run(qty, tId);

    return { success: true, newSenderTotal: CreditsManager.get(sId) };
  },

  clearAll: () => {
    const info = sql.wipeAll.run();
    return info.changes;
  },
};

module.exports = CreditsManager;
