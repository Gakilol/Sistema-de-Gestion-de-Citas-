# NovaCita — Sistema de Gestión, Agenda y Calendarización de Citas

NovaCita es una plataforma web moderna, robusta y segura diseñada para centralizar el agendamiento y reserva de citas, optimizar la gestión de personal, proteger la integridad de los horarios de atención y automatizar el flujo operativo de negocios de servicios.

---

## 🛠️ Tecnologías Usadas

El sistema está construido con un stack de tecnologías moderno para garantizar alto rendimiento, transaccionalidad segura y una interfaz de usuario fluida:

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)
- **Biblioteca UI**: [React 19](https://react.dev/)
- **Estilos**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Componentes**: [shadcn/ui](https://ui.shadcn.com/) (Radix Primitives)
- **Base de Datos y ORM**: PostgreSQL y [Prisma ORM](https://www.prisma.io/)
- **Autenticación**: JWT criptográficos mediante [jose](https://github.com/panva/jose) y hashing con `bcryptjs`
- **Envío de Correos**: [Nodemailer](https://nodemailer.com/) (para recuperación de contraseñas vía OTP)
- **Gráficos**: [Recharts](https://recharts.org/)
- **Reportes**: [jsPDF](https://github.com/parallax/jsPDF) (generación de PDF del lado del cliente)

---

## 👥 Roles Principales del Sistema

El acceso a la plataforma está regido por un control de acceso basado en roles (RBAC):

1. **Empleado / Estilista**: Visualiza su agenda y administra las citas permitidas por su alcance.
2. **Administrador (ADMIN)**: Gestiona personal, categorías, servicios, configuración, auditoría y reportes.
3. **Soporte Técnico (TECH_SUPPORT)**: Administra el sistema y no aparece como profesional agendable.

---

## 📦 Módulos Principales

El sistema está estructurado en los siguientes módulos funcionales:

- **Calendario y Agenda**: Calendario interactivo en tiempo real con filtrado por profesional y estado de citas. Soporta agendamiento multiservicio y reprogramación drag-and-drop.
- **Motor de Disponibilidad**: Algoritmo centralizado que combina horarios, turnos, descansos, bloqueos e intervalos ocupados.
- **Control de Traslapes (Overlaps)**: Permite a administradores y empleados forzar traslapes controlados en la agenda cuando sea operacionalmente requerido, registrando la justificación en la auditoría.
- **Autenticación y Seguridad**: Inicio de sesión con JWT en cookies HTTP-only y protección middleware de rutas.
- **Recuperación de Contraseña (OTP)**: Recuperación de contraseñas por código numérico temporal enviado por correo electrónico.
- **Reportes y Analíticas**: Dashboard gráfico que reporta rendimiento del negocio, productividad por empleado, demanda de servicios y tasas de asistencia/cancelaciones, con exportación a PDF, Excel y CSV.
- **Auditoría (Audit Log)**: Bitácora inmutable en base de datos que registra todas las operaciones sensibles (creación, edición, eliminación y cambios de estado), con anonimización de datos y sanitización de secretos.
- **Notificaciones de WhatsApp**: Integración para generar enlaces de WhatsApp interactivos para confirmar, recordar, reprogramar y cancelar citas.

---

## 🚀 Instalación y Ejecución Local

### 1. Requisitos Previos
- **Node.js**: Versión 18.x o superior.
- **Gestor de paquetes**: npm (incluido con Node.js).
- **Base de Datos**: Instancia de PostgreSQL accesible.

### 2. Instalación de Dependencias
Descargue e instale los paquetes de Node.js requeridos por el proyecto:
```bash
npm install
```

### 3. Configuración y Generación de Base de Datos
Ejecute Prisma para generar el cliente tipado y aplicar la estructura del esquema relacional:

- **Generar el cliente de Prisma**:
  ```bash
  npm run db:generate
  ```
- **Aplicar las migraciones del esquema relacional**:
  ```bash
  npm run db:migrate
  ```
- **Poblar datos iniciales (Sembrado / Seed)**:
  ```bash
  npm run db:seed
  ```
- **Consola de administración visual de base de datos (Prisma Studio)**:
  ```bash
  npm run db:studio
  ```

### 4. Servidor de Desarrollo
Para iniciar el servidor local con soporte de desarrollo:
```bash
npm run dev
```

La aplicación se desplegará localmente en `http://localhost:3000`.


## Asistente interno (rama desarrollo)

La sección /asistente ofrece una experiencia conversacional por voz y mensaje para agendar, reprogramar, cancelar y consultar citas, disponibilidad y resúmenes dentro de los permisos del usuario. Permite expresarse naturalmente (por ejemplo, «Agenda a Ana López para corte el viernes por la tarde», «la segunda», «mejor a las cuatro», «¿y el sábado?») conservando contexto entre turnos y resolviendo clientes (incluidos homónimos con pista mínima), servicios, personal y horarios reales dentro de NovaCita.

Privacidad y voz: el backend autentica al usuario, extrae y resuelve las identidades de clientes localmente y construye un comando reducido con vocabulario permitido y referencias temporales opacas (`sN`, `eN`, `c0`) antes de consultar a Gemini; nunca se envían audio, nombres, teléfonos, correos, notas, transcripciones crudas ni resultados internos a la API gratuita de Gemini. Las respuestas habladas utilizan exclusivamente voces locales del dispositivo (`SpeechSynthesisVoice.localService === true`) y se bloquean si solo hay voces remotas. El dictado prioriza reconocimiento local en el dispositivo (`SpeechRecognition.processLocally = true` cuando el navegador lo confirma); si el navegador no confirma reconocimiento sin conexión, solicita consentimiento explícito antes de usar el servicio de voz del navegador y mantiene el flujo completo por texto.

Variables solo del servidor: NOVACITA_IA_ENABLED=true, GEMINI_API_KEY y GEMINI_MODEL=gemini-3.5-flash-lite. En desarrollo local se guardan en .env.local; en Vercel se configuran como secretos de Preview asociados a desarrollo. La API oficial se llama como máximo una vez por turno (hasta 600 tokens y timeout de 20 segundos) y se respalda localmente cuando falla o se agota la cuota.

Los borradores duran 15 minutos, pertenecen al usuario y tienen control de revisión. Decir «sí, confirma» por voz únicamente muestra y resalta el resumen pendiente; toda creación, reprogramación o cancelación requiere pulsar el botón de confirmación en pantalla y pasar por `/api/ia/citas/confirmar` con bloqueo asesor y validaciones transaccionales compartidas. Si el horario se ocupó antes de confirmar, devuelve 409 sin consumir el borrador y ofrece nuevas opciones reales. No se habilitan traslapes ni excepciones de horario desde el asistente.

La migración 20261117090000_internal_assistant añade IaBorrador e IaLimite. Se aplica explícitamente con una conexión directa; nunca desde el build. Los límites distribuidos son 3 solicitudes/minuto y 30/día por usuario, y 5/minuto y 50/día globales (ventana diaria UTC); las cuotas propias del proveedor también pueden ser menores. Al agotarse o fallar Gemini se usa el intérprete local sin activar facturación ni cambiar de proveedor.

### Flujo de entrega acordado

- Código, commits y pushes exclusivamente en desarrollo. main y Vercel Production requieren aprobación explícita del usuario.
- Cada sesión con cambios termina con una Preview del último commit de desarrollo verificada en Vercel.
- La conexión de Neon se mantiene en main del proyecto Citas, compartida con producción. Las citas confirmadas en Preview son reales.
- Migraciones aditivas y compatibles; pruebas con dobles o una base local aislada, nunca fixtures ni seeds en la base compartida.
- Las conversaciones solo viven en memoria del navegador. Borradores y auditoría operativa permanecen en la base; no se guarda la transcripción completa.

Verificación: npm test, npm run type-check, npm run lint y npm run build. Las pruebas del asistente están en tests/unit/assistant-*.test.ts; la prueba de interfaz con APIs simuladas está en tests/assistant.mock.spec.ts.
