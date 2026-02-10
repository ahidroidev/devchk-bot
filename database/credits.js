// database/credits.js
const Auth = require("../funcionalidades/auth.js");

const CreditsManager = {
  get: (userId) => {
    const user = Auth.authData.commonUsers[userId];
    return user ? user.credits || 0 : 0;
  },

  // Función necesaria para que los comandos descuenten saldo
  consume: (userId) => {
    // 1. El Owner tiene acceso ilimitado
    if (userId === Auth.ADMIN_ID) return true;

    // 2. El STAFF (Admin/Seller) también tiene acceso ilimitado a herramientas
    if (Auth.authData.users[userId]) return true;

    // 3. Usuarios VIP/Comunes pagan 1 crédito
    const user = Auth.authData.commonUsers[userId];
    if (!user || (user.credits || 0) < 1) {
      return false; // Saldo insuficiente
    }

    // 4. Ejecutar cobro y guardar
    user.credits -= 1;
    Auth.saveKeys();
    return true;
  },

  // Punto clave: add ahora valida quién hace la operación
  add: (targetId, amount, operatorId) => {
    const qty = parseInt(amount);
    if (isNaN(qty) || qty <= 0)
      return { success: false, msg: "Monto inválido" };

    const isOwner = operatorId === Auth.ADMIN_ID;
    const adminData = Auth.authData.users[operatorId];

    // --- SEGURIDAD DE CAJA ---
    if (!isOwner) {
      // Si no es Owner, debe ser ADMIN y tener cupo
      if (!adminData || adminData.rango !== "ADMIN") {
        return { success: false, msg: "No tienes rango ADMIN para recargar." };
      }

      if ((adminData.limit || 0) < qty) {
        return {
          success: false,
          msg: `Cupo insuficiente. Tu Caja Chica tiene: ${adminData.limit || 0}`,
        };
      }

      // Restamos de la Caja Chica del Admin
      adminData.limit -= qty;
      Auth.saveIds(); // Guardamos el nuevo cupo del admin
    }

    // --- CARGA AL USUARIO ---
    if (!Auth.authData.commonUsers[targetId]) {
      Auth.authData.commonUsers[targetId] = {
        expiration: Date.now() + 30 * 24 * 60 * 60 * 1000,
        name: "Usuario",
        credits: 0,
      };
    }

    Auth.authData.commonUsers[targetId].credits =
      (Auth.authData.commonUsers[targetId].credits || 0) + qty;
    Auth.saveKeys();

    return {
      success: true,
      total: Auth.authData.commonUsers[targetId].credits,
      remaining: isOwner ? "∞ (Caja Grande)" : adminData.limit,
    };
  },

  clearAll: () => {
    // Obtenemos todos los IDs de los usuarios que tienen créditos
    const userIds = Object.keys(Auth.authData.commonUsers);
    const count = userIds.length;

    // Seteamos los créditos de cada uno a 0
    userIds.forEach((id) => {
      Auth.authData.commonUsers[id].credits = 0;
    });

    // Guardamos los cambios en el JSON
    Auth.saveKeys();
    return count;
  },

  // Solo tú (Owner) usas esto para fondear a tus Admins
  refillAdminCaja: (adminId, amount) => {
    const qty = parseInt(amount);
    // Buscamos en la lista de STAFF (users), no en commonUsers
    if (!Auth.authData.users[adminId] || isNaN(qty)) return false;

    Auth.authData.users[adminId].limit =
      (Auth.authData.users[adminId].limit || 0) + qty;
    Auth.saveIds(); // Importante: Guardar en authorized_ids.json
    return Auth.authData.users[adminId].limit;
  },

  addDirect: (userId, amount) => {
    const qty = parseInt(amount);
    if (!Auth.authData.commonUsers[userId]) {
      Auth.authData.commonUsers[userId] = { credits: 0, expiration: 0 };
    }
    Auth.authData.commonUsers[userId].credits += qty;
    Auth.saveKeys(); // Guardamos los cambios en el JSON
    return Auth.authData.commonUsers[userId].credits;
  },

  // Remover créditos o resetear a cero
  remove: (userId, amount) => {
    if (!Auth.authData.commonUsers[userId]) return false;

    if (amount === "ALL") {
      Auth.authData.commonUsers[userId].credits = 0;
    } else {
      const qty = parseInt(amount);
      Auth.authData.commonUsers[userId].credits = Math.max(
        0,
        Auth.authData.commonUsers[userId].credits - qty,
      );
    }

    Auth.saveKeys(); // Guardamos los cambios
    return Auth.authData.commonUsers[userId].credits;
  },

  // Transferencia de créditos entre usuarios (Comando /gift)
  transfer: (senderId, targetId, amount) => {
    const qty = parseInt(amount);
    const sender = Auth.authData.commonUsers[senderId];

    // El Owner puede regalar créditos infinitos
    const isOwner = senderId === Auth.ADMIN_ID;

    if (!isOwner && (!sender || (sender.credits || 0) < qty)) {
      return { success: false, msg: "Saldo insuficiente." };
    }

    if (!Auth.authData.commonUsers[targetId]) {
      Auth.authData.commonUsers[targetId] = {
        credits: 0,
        expiration: Date.now() + 86400000,
      };
    }

    if (!isOwner) sender.credits -= qty;
    Auth.authData.commonUsers[targetId].credits += qty;

    Auth.saveKeys();
    return {
      success: true,
      newSenderTotal: isOwner ? "∞" : sender.credits,
    };
  },
};

module.exports = CreditsManager;
