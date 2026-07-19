// Netlify Serverless Function — envía el prompt y fotos por email via Web3Forms
// Variable de entorno: WEB3FORMS_ACCESS_KEY

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY;

  try {
    const { prompt, photos = [] } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "No prompt" }) };
    }

    if (!ACCESS_KEY) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: true, fallback: true, prompt }),
      };
    }

    // Construir fotos embebidas en HTML
    let photosHtml = "";
    if (photos.length > 0) {
      photosHtml = `<br><br><strong>Fotos del cliente:</strong><br>`;
      photos.forEach((photoB64, i) => {
        const b64 = photoB64.includes(",") ? photoB64.split(",")[1] : photoB64;
        photosHtml += `<img src="data:image/jpeg;base64,${b64}" style="max-width:400px;width:100%;margin:10px 0;border-radius:4px;"><br>`;
      });
    }

    // Web3Forms acepta campos como subject, from_name, message, etc.
    const formData = new URLSearchParams();
    formData.append("access_key", ACCESS_KEY);
    formData.append("subject", `FOCU(T)S - Nuevo perfil de asesoria ${new Date().toLocaleDateString("es-ES")}`);
    formData.append("from_name", "FOCU(T)S Web");
    formData.append("message", prompt + photosHtml);

    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const result = await response.json();
    console.log("Web3Forms response:", response.status, JSON.stringify(result));

    if (!result.success) {
      return {
        statusCode: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Web3Forms failed", details: result }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("Function error:", err.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
