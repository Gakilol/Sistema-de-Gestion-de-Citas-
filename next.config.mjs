/** @type {import('next').NextConfig} */

// ─── Cabeceras de Seguridad HTTP ─────────────────────────────────────────────
//
// NOTA sobre la CSP:
// El proyecto usa next/font/google, que Next.js auto-aloja las fuentes en
// /_next/static/ (sin peticiones a fonts.googleapis.com en producción).
// Por esto NO se incluyen dominios de Google Fonts en la CSP.
//
// La CSP está en modo Report-Only inicialmente para detectar falsos positivos
// sin romper la aplicación. Cuando se confirme que todo funciona, cambiar a:
//   Content-Security-Policy: <mismo valor>
// eliminando la cabecera Content-Security-Policy-Report-Only.
// ─────────────────────────────────────────────────────────────────────────────

const securityHeaders = [
  // Content Security Policy (modo report-only para monitoreo inicial)
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      // Scripts: solo el propio dominio + nonces generados por Next.js
      // 'unsafe-inline' solo mientras se usa el modo report-only; retirar cuando CSP sea activa
      "script-src 'self' 'unsafe-inline'",
      // Estilos: solo el propio dominio
      "style-src 'self' 'unsafe-inline'",
      // Imágenes: solo locales + data URIs para iconos en línea
      "img-src 'self' data: blob:",
      // Fuentes: next/font las sirve desde el mismo dominio (/_next/static/)
      "font-src 'self'",
      // Conexiones API: solo el mismo dominio
      "connect-src 'self'",
      // Formularios: solo el mismo dominio
      "form-action 'self'",
      // Frames: completamente prohibido para prevenir clickjacking
      "frame-ancestors 'none'",
      // Objetos (Flash, etc.): prohibidos
      "object-src 'none'",
      // Base URI: solo el mismo origen
      "base-uri 'self'",
      // Manifest (PWA): solo el mismo dominio
      "manifest-src 'self'",
      // Media (audio/video): solo el mismo dominio
      "media-src 'self'",
      // Workers: solo el mismo dominio
      "worker-src 'self' blob:",
    ].join('; '),
  },
  // Evitar que el navegador infiera tipos MIME (previene XSS vía upload)
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Prevenir clickjacking (también cubierto por CSP frame-ancestors, pero doble defensa)
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Controlar información de referrer: no enviar en peticiones cross-origin
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Forzar HTTPS en producción (6 meses, incluye subdominios)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=15552000; includeSubDomains',
  },
  // Limitar acceso a la cámara, micrófono y geolocalización
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Protección XSS legacy (navegadores sin CSP)
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
];

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['192.168.0.5'],

  // ─── Agregar cabeceras de seguridad a todas las rutas ──────────────────────
  async headers() {
    return [
      {
        // Aplicar a todas las rutas
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
