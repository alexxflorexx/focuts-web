// Netlify Serverless Function — envía el prompt y fotos a Telegram
// Variables de entorno en Netlify: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

exports.handler = async (event) => {
  // CORS
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

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  try {
    const { prompt, photos = [] } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "No prompt" }) };
    }

    // Si no hay Telegram configurado, devolver el prompt para copiar
    if (!BOT_TOKEN || !CHAT_ID) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: true, fallback: true, prompt }),
      };
    }

    // Dividir en chunks de 4096 chars
    const chunks = [];
    let remaining = prompt;
    while (remaining.length > 0) {
      if (remaining.length <= 4096) {
        chunks.push(remaining);
        break;
      }
      let cut = remaining.lastIndexOf("\n", 4096);
      if (cut === -1 || cut < 3500) cut = 4096;
      chunks.push(remaining.substring(0, cut));
      remaining = remaining.substring(cut).trimStart();
    }

    // Enviar cada chunk a Telegram
    for (const chunk of chunks) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: chunk }),
      });
    }

    // Enviar fotos
    for (const photoB64 of photos) {
      try {
        const base64Data = photoB64.includes(",")
          ? photoB64.split(",")[1]
          : photoB64;

        const binaryStr = Buffer.from(base64Data, "base64").toString("binary");
        const bytes = Buffer.from(base64Data, "base64");

        const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
        const CRLF = "\r\n";

        let body = "";
        body += `--${boundary}${CRLF}`;
        body += `Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}`;
        body += `${CHAT_ID}${CRLF}`;
        body += `--${boundary}${CRLF}`;
        body += `Content-Disposition: form-data; name="photo"; filename="foto.jpg"${CRLF}`;
        body += `Content-Type: image/jpeg${CRLF}${CRLF}`;

        const bodyStart = Buffer.from(body, "utf-8");
        const bodyEnd = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, "utf-8");

        const formData = Buffer.concat([bodyStart, bytes, bodyEnd]);

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: formData,
        });
      } catch (e) {
        console.error("Error sending photo:", e);
      }
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
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
