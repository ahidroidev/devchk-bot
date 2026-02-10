const Auth = require("../funcionalidades/auth.js");

const CreditsManager = {
  get: (userId) => {
    const role = Auth.getRole(userId);
    if (["OWNER", "ADMIN", "SELLER", "MOD"].includes(role)) return 999999;
    const user = Auth.authData.commonUsers[userId];
    return user ? user.credits || 0 : 0;
  },

  // COBRAR (Suma al Total Gastado del usuario)
  consume: (userId) => {
    const role = Auth.getRole(userId);
    if (["OWNER", "ADMIN", "SELLER", "MOD"].includes(role)) return true;

    const user = Auth.authData.commonUsers[userId];
    if (user && (user.credits || 0) >= 1) {
      user.credits -= 1;

      // TRACKING GASTO
      user.totalSpent = (user.totalSpent || 0) + 1;

      Auth.saveIds();
      return true;
    }
    return false;
  },

  // AÑADIR (Suma al Flujo del Staff y Compra del usuario)
  add: (targetId, amount, operatorId) => {
    const qty = parseInt(amount);
    if (isNaN(qty)) return false;

    // 1. Actualizar Usuario (Comprador)
    if (!Auth.authData.commonUsers[targetId]) {
      Auth.authData.commonUsers[targetId] = {
        expiration: Date.now() - 1000,
        name: "Usuario",
        credits: 0,
        totalBought: 0,
        totalSpent: 0,
      };
    }
    const user = Auth.authData.commonUsers[targetId];
    user.credits = (user.credits || 0) + qty;
    user.totalBought = (user.totalBought || 0) + qty; // Historial compra

    // 2. Actualizar Staff (Vendedor/Operador)
    if (operatorId && Auth.authData.users[operatorId]) {
      const staff = Auth.authData.users[operatorId];
      // Si no es el Owner (que tiene infinito), sumamos a su flujo
      if (Auth.getRole(operatorId) !== "OWNER") {
        staff.monthlyFlow = (staff.monthlyFlow || 0) + qty;
      }
    }

    Auth.saveIds();
    return user.credits;
  },

  // TRANSFERIR
  transfer: (senderId, targetId, amount) => {
    const qty = parseInt(amount);
    const senderRole = Auth.getRole(senderId);

    if (senderRole !== "OWNER") {
      const sender = Auth.authData.commonUsers[senderId];
      if (!sender || (sender.credits || 0) < qty)
        return { success: false, msg: "Saldo insuficiente." };
      sender.credits -= qty;
      sender.totalSpent = (sender.totalSpent || 0) + qty; // Cuenta como gasto
    }

    if (!Auth.authData.commonUsers[targetId]) {
      Auth.authData.commonUsers[targetId] = {
        expiration: 0,
        name: "Receptor",
        credits: 0,
        totalBought: 0,
        totalSpent: 0,
      };
    }
    const receiver = Auth.authData.commonUsers[targetId];
    receiver.credits = (receiver.credits || 0) + qty;
    // No suma a totalBought porque es regalo, no compra directa al sistema (opcional)

    Auth.saveIds();
    return { success: true, newSenderTotal: CreditsManager.get(senderId) };
  },
};

module.exports = CreditsManager;
