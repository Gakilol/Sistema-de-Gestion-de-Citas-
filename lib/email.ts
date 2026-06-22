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
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hairs Style and Salon';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Código de verificación - ${appName}</title>
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
        .code-box {
          display: inline-block;
          background-color: #1f2937;
          border: 2px solid #d4a017;
          border-radius: 12px;
          font-size: 36px;
          font-weight: 800;
          letter-spacing: 6px;
          color: #d4a017;
          padding: 16px 32px;
          margin: 16px 0;
          font-family: 'Courier New', Courier, monospace;
          box-shadow: 0 4px 10px rgba(212, 160, 23, 0.1);
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
          <p>Usa el siguiente código de verificación de 6 dígitos para restablecer tu contraseña:</p>
          
          <div class="code-box">${token}</div>
          
          <div class="divider"></div>
          <p class="expiry-note">Este código de verificación es válido por <strong>10 minutos</strong>.<br>No compartas este código con nadie por razones de seguridad.</p>
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
    subject: `Código de verificación - ${appName}`,
    html,
  });
};
