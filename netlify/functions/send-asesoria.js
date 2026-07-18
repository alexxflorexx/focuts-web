// Netlify Serverless Function — envía el prompt y fotos por email
// Servicio: Resend (resend.com) — 3.000 emails/mes gratis
// Variables de entorno en Netlify: RESEND_API_KEY, EMAIL_TO, EMAIL_FROM

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

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_TO = process.env.EMAIL_TO;
  const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@focutshairstudio.com";

  try {
    const { prompt, photos = [] } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "No prompt" }) };
    }

    // Fallback si no hay email configurado — devolver prompt para copiar
    if (!RESEND_API_KEY || !EMAIL_TO) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: true, fallback: true, prompt }),
      };
    }

    // Construir el HTML del email
    const promptHtml = prompt
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    let attachmentsHtml = "";
    const attachments = [];

    if (photos.length > 0) {
      attachmentsHtml = `
        <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
        <h2 style="font-size:16px;color:#333;margin-bottom:15px;">📷 Fotos del cliente</h2>
      `;

      photos.forEach((photoB64, i) => {
        const base64Data = photoB64.includes(",")
          ? photoB64.split(",")[1]
          : photoB64;
        const mimeType = photoB64.includes("data:image/png")
          ? "image/png"
          : "image/jpeg";
        const ext = mimeType === "image/png" ? "png" : "jpg";

        attachmentsHtml += `
          <div style="margin-bottom:10px;">
            <img src="cid:photo${i}" alt="Foto ${i + 1}" style="max-width:400px;width:100%;border-radius:4px;border:1px solid #eee;">
          </div>
        `;

        attachments.push({
          filename: `foto_cliente_${i + 1}.${ext}`,
          content: base64Data,
          content_id: `photo${i}`,
          type: mimeType,
        });
      });
    }

    const htmlContent = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:0 auto;padding:30px;">
        <h1 style="font-size:22px;color:#111;margin-bottom:5px;">FOCU(T)S HAIR STUDIO — Nuevo Perfil de Asesoría</h1>
        <p style="font-size:13px;color:#888;margin-top:0;">Asesoría de imagen masculina</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <div style="font-size:14px;color:#333;line-height:1.8;">
          ${promptHtml}
        </div>
        ${attachmentsHtml}
        <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
        <p style="font-size:12px;color:#999;">Generado automáticamente desde focutshairstudio.com</p>
      </div>
    `;

    // Enviar con Resend
    const emailPayload = {
      from: EMAIL_FROM,
      to: [EMAIL_TO],
      subject: `FOCU(T)S — Nuevo perfil de asesoría ${new Date().toLocaleDateString("es-ES")}`,
      html: htmlContent,
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Resend error:", response.status, errBody);
      return {
        statusCode: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Email delivery failed", details: errBody }),
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
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
