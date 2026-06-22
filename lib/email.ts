import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER || '';
const smtpPassword = process.env.SMTP_PASSWORD || '';
const smtpFrom = process.env.SMTP_FROM || '"Hairs Style and Salon" <no-reply@gmail.com>';

export const getTransporter = () => {
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
};

export interface SendResetPasswordEmailParams {
  email: string;
  nombre: string;
  token: string;
}

export const sendResetPasswordEmail = async ({
  email,
  nombre,
  token,
}: SendResetPasswordEmailParams) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/restablecer-contrasena?token=${token}`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hairs Style and Salon';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Restablecer contraseña - ${appName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #0b0f19;
          color: #f3f4f6;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .card {
          background-color: #111827;
          border: 1px solid #1f2937;
          border-radius: 16px;
          padding: 32px;
          text-align: center;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        }
        .logo {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.025em;
          margin-bottom: 24px;
          background: linear-gradient(135deg, #d4a017 0%, #f3e5ab 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        h1 {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin-top: 0;
          margin-bottom: 16px;
        }
        p {
          font-size: 15px;
          line-height: 1.6;
          color: #9ca3af;
          margin-top: 0;
          margin-bottom: 24px;
        }
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #d4a017 0%, #b8860b 100%);
          color: #0b0f19 !important;
          text-decoration: none;
          font-weight: 700;
          font-size: 14px;
          padding: 12px 32px;
          border-radius: 9999px;
          transition: all 0.2s ease-in-out;
          box-shadow: 0 4px 6px -1px rgba(212, 160, 23, 0.2);
        }
        .footer {
          margin-top: 32px;
          text-align: center;
          font-size: 12px;
          color: #4b5563;
        }
        .divider {
          height: 1px;
          background-color: #1f2937;
          margin: 32px 0 24px 0;
        }
        .expiry-note {
          font-size: 13px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">${appName}</div>
          <h1>Hola, ${nombre}</h1>
          <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Si no has sido tú, puedes ignorar este correo de forma segura.</p>
          <p>Para restablecer tu contraseña, haz clic en el botón de abajo:</p>
          
          <a href="${resetUrl}" class="btn" target="_blank">Restablecer Contraseña</a>
          
          <div class="divider"></div>
          <p class="expiry-note">Este enlace de recuperación es válido por 60 minutos.<br>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
          <p style="word-break: break-all; font-size: 13px; color: #d4a017;">${resetUrl}</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${appName}. Todos los derechos reservados.
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = getTransporter();
  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: `Restablecer contraseña - ${appName}`,
    html,
  });
};
