async function consultarBIN(bin) {
  try {
    const url = `https://data.handyapi.com/bin/${bin}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404)
      return { success: false, message: "BIN no encontrado" };
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const data = await response.json();

    // Verificamos si la API devolvió data real
    if (data.Status === "SUCCESS") {
      return {
        success: true,
        bin: bin,
        brand: data.Scheme || "N/A",
        type: data.Type || "N/A",
        level: data.CardTier || "N/A",
        bank: data.Issuer || "N/A",
        country: data.Country?.Name || "N/A",
        flag: data.Country?.A2 || "🏳️",
      };
    }

    return { success: false };
  } catch (error) {
    console.error("[API ERROR] Error consultando BIN:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = consultarBIN;
