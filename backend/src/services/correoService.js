// Envío de correos. Uso la API HTTP de Brevo (plan gratuito: 300 correos al día, sin
// tarjeta) y no SMTP: Render bloquea los puertos SMTP en el plan gratuito.
//
// Variables de entorno:
//  - BREVO_API_KEY: la clave de API de Brevo (SMTP y API > Claves de API)
//  - CORREO_REMITENTE: el email desde el que se envía; debe estar verificado como
//    "remitente" en Brevo
//  - CORREO_NOMBRE: el nombre que ve quien lo recibe (por defecto, GameHub)
//
// Sin BREVO_API_KEY el correo no sale: en desarrollo se escribe entero en la consola
// del backend (así se puede probar sin cuenta), y en producción se avisa del fallo.
const axios = require('axios');

const URL_BREVO = 'https://api.brevo.com/v3/smtp/email';

class ErrorCorreo extends Error {}

async function enviarCorreo({ para, asunto, texto, html }) {
  const clave = process.env.BREVO_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;

  if (!clave || !remitente) {
    if (process.env.NODE_ENV === 'production') {
      throw new ErrorCorreo('Falta BREVO_API_KEY o CORREO_REMITENTE: no se puede enviar correo');
    }
    console.log(`\n--- Correo (modo desarrollo, no se envía) ---\nPara: ${para}\nAsunto: ${asunto}\n\n${texto}\n---------------------------------------------\n`);
    return;
  }

  try {
    await axios.post(
      URL_BREVO,
      {
        sender: { name: process.env.CORREO_NOMBRE || 'GameHub', email: remitente },
        to: [{ email: para }],
        subject: asunto,
        textContent: texto,
        htmlContent: html,
      },
      { headers: { 'api-key': clave }, timeout: 10000 }
    );
  } catch (err) {
    // Brevo explica el motivo en el cuerpo (remitente sin verificar, clave mala...)
    const detalle = err.response?.data?.message || err.message;
    throw new ErrorCorreo(`Brevo rechazó el correo (${err.response?.status ?? 'sin respuesta'}): ${detalle}`);
  }
}

// Texto de los correos de recuperación, en el idioma de la interfaz
const TEXTOS = {
  es: {
    asunto: 'Tu código para recuperar la contraseña de GameHub',
    saludo: (n) => `Hola, ${n}:`,
    cuerpo: (min) => `Este es tu código para restablecer la contraseña. Caduca en ${min} minutos:`,
    ignorar: 'Si no lo has pedido tú, ignora este correo: tu contraseña no ha cambiado.',
  },
  en: {
    asunto: 'Your GameHub password recovery code',
    saludo: (n) => `Hi, ${n}:`,
    cuerpo: (min) => `This is your code to reset your password. It expires in ${min} minutes:`,
    ignorar: "If you didn't request it, ignore this email: your password has not changed.",
  },
};

// El nombre de usuario lo elige el usuario: lo escapo antes de meterlo en HTML
function escaparHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function enviarCodigoRecuperacion({ para, username, codigo, minutos, idioma }) {
  const x = TEXTOS[idioma] ?? TEXTOS.es;

  const texto = `${x.saludo(username)}\n\n${x.cuerpo(minutos)}\n\n    ${codigo}\n\n${x.ignorar}\n\nGameHub`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2430">
  <h2 style="margin:0 0 16px">GameHub</h2>
  <p>${escaparHtml(x.saludo(username))}</p>
  <p>${escaparHtml(x.cuerpo(minutos))}</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#f2f3f7;padding:16px;text-align:center;border-radius:8px">${codigo}</p>
  <p style="color:#6b7280;font-size:14px">${escaparHtml(x.ignorar)}</p>
</div>`;

  await enviarCorreo({ para, asunto: x.asunto, texto, html });
}

module.exports = { enviarCorreo, enviarCodigoRecuperacion, ErrorCorreo };
