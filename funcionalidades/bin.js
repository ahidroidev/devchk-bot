const axios = require("axios");

async function consultarBIN(bin) {
  try {
    const clean = String(bin).replace(/\D/g, "").substring(0, 6);
    if (clean.length < 6) return { success: false, message: "BIN inválido" };

    const url = `https://lookup.binlist.net/${clean}`;
    const resp = await axios.get(url, {
      headers: { "Accept-Version": "3" },
      timeout: 7000,
    });

    const d = resp.data || {};

    return {
      success: true,
      bin: clean,
      brand: (d.scheme || "N/A").toUpperCase(),
      type: d.type || "N/A",
      level: d.brand || d.brand || "N/A",
      bank: d.bank?.name || "N/A",
      country: d.country?.name || "N/A",
      flag: d.country?.alpha2 || "🏳️",
    };
  } catch (error) {
    console.error("[API BIN] Error:", error.message || error);
    return { success: false, error: error.message || "Error al consultar BIN" };
  }
}

module.exports = consultarBIN;
