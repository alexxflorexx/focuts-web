// Netlify Serverless Function — envía el prompt y fotos por email
// Servicio: Resend (resend.com) — 3.000 emails/mes gratis
// Variables de entorno en Netlify: RESEND_API_KEY, EMAIL_TO

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

  try {
    const { prompt, photos = [] } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "No prompt" }) };
    }

    console.log("RESEND_API_KEY present:", !!RESEND_API_KEY);
    console.log("EMAIL_TO present:", !!EMAIL_TO);

    // Fallback si no hay email configurado — devolver prompt para copiar
    if (!RESEND_API_KEY || !EMAIL_TO) {
      console.log("Missing env vars, returning fallback");
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
        <h2 style="font-size:16px;color:#333;margin-bottom:15px;">Fotos del cliente</h2>
      `;

      photos.forEach((photoB64, i) => {
        const base64Data = photoB64.includes(",")
          ? photoB64.split(",")[1]
          : photoB64;

        attachmentsHtml += `
          <div style="margin-bottom:10px;">
            <img src="data:image/jpeg;base64,${base64Data}" alt="Foto ${i + 1}" style="max-width:400px;width:100%;border-radius:4px;border:1px solid #eee;">
          </div>
        `;
      });
    }

    const htmlContent = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:0 auto;padding:30px;">
        <h1 style="font-size:22px;color:#111;margin-bottom:5px;">FOCU(T)S HAIR STUDIO - Nuevo Perfil de Asesoria</h1>
        <p style="font-size:13px;color:#888;margin-top:0;">Asesoria de imagen masculina</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <div style="font-size:14px;color:#333;line-height:1.8;">
          ${promptHtml}
        </div>
        ${attachmentsHtml}
        <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
        <p style="font-size:12px;color:#999;">Generado automaticamente desde focutshairstudio.com</p>
      </div>
    `;

    // Usar el dominio verificado de Resend (onboarding@resend.dev) que funciona sin verificar dominio
    // Cuando tengas dominio verificado, cambia a: noreply@focutshairstudio.com
    const emailPayload = {
      from: "onboarding@resend.dev",
      to: [EMAIL_TO],
      subject: `FOCU(T)S - Nuevo perfil de asesoria ${new Date().toLocaleDateString("es-ES")}`,
      html: htmlContent,
    };

    console.log("Sending email to:", EMAIL_TO);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const responseBody = await response.text();
    console.log("Resend response:", response.status, responseBody);

    if (!response.ok) {
      return {
        statusCode: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Email delivery failed", status: response.status, details: responseBody }),
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
