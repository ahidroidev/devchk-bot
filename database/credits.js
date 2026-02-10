// database/credits.js
const Auth = require("../funcionalidades/auth.js");

const CreditsManager = {
  get: (userId) => {
    // Staff siempre muestra infinito visualmente (999999)
    const role = Auth.getRole(userId);
    if (["OWNER", "ADMIN", "SELLER", "MOD"].includes(role)) return 999999;

    const user = Auth.authData.commonUsers[userId];
    return user ? user.credits || 0 : 0;
  },

  // Función para cobrar
  consume: (userId) => {
    const role = Auth.getRole(userId);

    // 1. STAFF tiene barra libre (No gastan créditos)
    if (["OWNER", "ADMIN", "SELLER", "MOD"].includes(role)) return true;

    // 2. VIPs gastan saldo
    const user = Auth.authData.commonUsers[userId];
    if (user && (user.credits || 0) >= 1) {
      user.credits -= 1;
      Auth.saveIds(); // Guardar el nuevo saldo
      return true;
    }

    // 3. FREE no tiene saldo (o si se le acabó al VIP)
    return false;
  },

  // Añadir créditos
  add: (targetId, amount) => {
    const qty = parseInt(amount);
    if (isNaN(qty)) return false;

    if (!Auth.authData.commonUsers[targetId]) {
      // Si el usuario no existe, lo creamos como FREE pero con saldo
      Auth.authData.commonUsers[targetId] = {
        expiration: Date.now() - 1000,
        name: "Usuario",
        credits: 0,
      };
    }

    Auth.authData.commonUsers[targetId].credits =
      (Auth.authData.commonUsers[targetId].credits || 0) + qty;
    Auth.saveIds();
    return Auth.authData.commonUsers[targetId].credits;
  },

  // Transferencia
  transfer: (senderId, targetId, amount) => {
    const qty = parseInt(amount);
    const senderRole = Auth.getRole(senderId);

    // El Owner se salta la validación de saldo
    if (senderRole !== "OWNER") {
      const sender = Auth.authData.commonUsers[senderId];
      if (!sender || (sender.credits || 0) < qty)
        return { success: false, msg: "Saldo insuficiente." };
      sender.credits -= qty;
    }

    // Añadir al destino
    if (!Auth.authData.commonUsers[targetId]) {
      Auth.authData.commonUsers[targetId] = {
        expiration: 0,
        name: "Receptor",
        credits: 0,
      };
    }
    Auth.authData.commonUsers[targetId].credits =
      (Auth.authData.commonUsers[targetId].credits || 0) + qty;

    Auth.saveIds();
    return { success: true, newSenderTotal: CreditsManager.get(senderId) };
  },
};

module.exports = CreditsManager;
