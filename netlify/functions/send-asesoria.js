// Netlify Serverless Function — envía el prompt y fotos por email Y Telegram
// Variables de entorno: RESEND_API_KEY, EMAIL_TO, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

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

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_TO = process.env.EMAIL_TO;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  try {
    const { prompt, photos = [] } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "No prompt" }) };
    }

    const hasEmail = RESEND_API_KEY && EMAIL_TO;
    const hasTelegram = BOT_TOKEN && CHAT_ID;

    // Si no hay nada configurado, devolver prompt para copiar
    if (!hasEmail && !hasTelegram) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: true, fallback: true, prompt }),
      };
    }

    console.log("TELEGRAM_CHAT_ID:", CHAT_ID);
    console.log("hasTelegram:", hasTelegram);

    const errors = [];

    // ─── EMAIL (Resend) ───
    if (hasEmail) {
      try {
        const promptHtml = prompt
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");

        let photosHtml = "";
        if (photos.length > 0) {
          photosHtml = `
            <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
            <h2 style="font-size:16px;color:#333;margin-bottom:15px;">Fotos del cliente</h2>
          `;
          photos.forEach((photoB64, i) => {
            const b64 = photoB64.includes(",") ? photoB64.split(",")[1] : photoB64;
            photosHtml += `<div style="margin-bottom:10px;"><img src="data:image/jpeg;base64,${b64}" alt="Foto ${i + 1}" style="max-width:400px;width:100%;border-radius:4px;border:1px solid #eee;"></div>`;
          });
        }

        const htmlContent = `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:0 auto;padding:30px;">
            <h1 style="font-size:22px;color:#111;margin-bottom:5px;">FOCU(T)S HAIR STUDIO - Nuevo Perfil de Asesoria</h1>
            <p style="font-size:13px;color:#888;margin-top:0;">Asesoria de imagen masculina</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <div style="font-size:14px;color:#333;line-height:1.8;">${promptHtml}</div>
            ${photosHtml}
            <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
            <p style="font-size:12px;color:#999;">Generado automaticamente desde focutshairstudio.com</p>
          </div>
        `;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: [EMAIL_TO],
            subject: `FOCU(T)S - Nuevo perfil de asesoria ${new Date().toLocaleDateString("es-ES")}`,
            html: htmlContent,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          console.error("Email error:", res.status, err);
          errors.push("email");
        } else {
          console.log("Email sent OK");
        }
      } catch (e) {
        console.error("Email exception:", e.message);
        errors.push("email");
      }
    }

    // ─── TELEGRAM ───
    if (hasTelegram) {
      try {
        // Enviar texto en chunks de 4096 chars
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
            const base64Data = photoB64.includes(",") ? photoB64.split(",")[1] : photoB64;
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
              headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
              body: formData,
            });
          } catch (e) {
            console.error("Telegram photo error:", e.message);
          }
        }

        console.log("Telegram sent OK");
      } catch (e) {
        console.error("Telegram exception:", e.message);
        errors.push("telegram");
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ok: true, errors: errors.length > 0 ? errors : undefined }),
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
