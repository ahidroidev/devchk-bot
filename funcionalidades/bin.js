async function consultarBIN(bin, API_KEY) {
  try {
    const url = `https://data.handyapi.com/bin/${bin}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Request error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("There was a problem:", error.message);
  }
}

module.exports = consultarBIN;
