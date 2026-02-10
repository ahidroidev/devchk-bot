const axios = require("axios");

async function consultarBIN(bin) {
  const clean = String(bin).replace(/\D/g, "").substring(0, 6);
  if (clean.length < 6) return { success: false, message: "BIN inválido" };

  // --- FUENTE 1: BINLIST ---
  try {
    const resp = await axios.get(`https://lookup.binlist.net/${clean}`, {
      headers: { "Accept-Version": "3" },
      timeout: 3000,
    });
    return formatResponse(resp.data, clean, "BINLIST");
  } catch (e) {
    console.log(`[FALLBACK] Binlist falló, probando Fuente 2...`);
  }

  // --- FUENTE 2: BINCHECK.IO ---
  try {
    const resp = await axios.get(`https://api.bincheck.io/bin/${clean}`, {
      timeout: 3000,
    });
    // Bincheck entrega una estructura distinta, la normalizamos
    const d = resp.data.result;
    return {
      success: true,
      bin: clean,
      brand: (d.brand || "N/A").toUpperCase(),
      type: (d.type || "N/A").toUpperCase(),
      level: (d.level || "STANDARD").toUpperCase(),
      bank: (d.bank || "N/A").toUpperCase(),
      country: (d.country || "N/A").toUpperCase(),
      flag: d.country_code || "🏳️",
      currency: (d.currency || "N/A").toUpperCase(),
      source: "BC-IO",
    };
  } catch (e) {
    console.log(`[FALLBACK] Bincheck falló, probando Fuente 3...`);
  }

  // --- FUENTE 3: DATAYZE (Alternativa robusta) ---
  try {
    const resp = await axios.get(
      `https://datayze.com/bin-lookup-api.php?bin=${clean}`,
      { timeout: 3000 },
    );
    const d = resp.data;
    return {
      success: true,
      bin: clean,
      brand: (d.brand || "N/A").toUpperCase(),
      type: (d.type || "N/A").toUpperCase(),
      level: "STANDARD",
      bank: (d.bank || "N/A").toUpperCase(),
      country: (d.country || "N/A").toUpperCase(),
      flag: d.country_code || "🏳️",
      currency: "N/A",
      source: "DT-YZ",
    };
  } catch (e) {
    return { success: false, error: "Todas las APIs están saturadas." };
  }
}

// Función para no repetir código de formateo en la Fuente 1
function formatResponse(d, bin, src) {
  return {
    success: true,
    bin: bin,
    brand: (d.scheme || "N/A").toUpperCase(),
    type: (d.type || "N/A").toUpperCase(),
    level: (d.brand || "STANDARD").toUpperCase(),
    bank: (d.bank?.name || "N/A").toUpperCase(),
    bank_url: d.bank?.url || "N/A",
    bank_phone: d.bank?.phone || "N/A",
    country: (d.country?.name || "N/A").toUpperCase(),
    flag: d.country?.alpha2 || "🏳️",
    currency: (d.country?.currency || "N/A").toUpperCase(),
    latitude: d.country?.latitude || "N/A",
    longitude: d.country?.longitude || "N/A",
    source: src,
  };
}

module.exports = consultarBIN;
