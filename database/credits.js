const Auth = require("../funcionalidades/auth.js");

const CreditsManager = {
  get: (userId) => {
    const user = Auth.authData.commonUsers[userId];
    return user ? user.credits || 0 : 0;
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
};
module.exports = CreditsManager;
