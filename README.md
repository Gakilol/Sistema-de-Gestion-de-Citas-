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
- **Base de Datos y ORM**: [PostgreSQL (NeonDB)](https://neon.tech/) y [Prisma ORM](https://www.prisma.io/)
- **Autenticación**: JWT criptográficos mediante [jose](https://github.com/panva/jose) y hashing con `bcryptjs`
- **Envío de Correos**: [Nodemailer](https://nodemailer.com/) (para recuperación de contraseñas vía OTP)
- **Gráficos**: [Recharts](https://recharts.org/)
- **Reportes**: [jsPDF](https://github.com/parallax/jsPDF) (generación de PDF del lado del cliente)

---

## 👥 Roles Principales del Sistema

El acceso a la plataforma está regido por un control de acceso basado en roles (RBAC):

1. **Cliente / Paciente**: Usuario final que reserva citas, consulta la disponibilidad de horarios del personal en tiempo real y gestiona sus propias citas.
2. **Empleado / Estilista**: Profesional técnico que visualiza su agenda diaria de citas, administra sus horarios y turnos de trabajo individuales, y registra/reprograma citas directas.
3. **Administrador (ADMIN)**: Control absoluto del negocio. Gestiona el personal (empleados), categorías, servicios, configuraciones globales, y tiene acceso exclusivo a los módulos de auditoría y reportes analíticos.
4. **Soporte Técnico (TECH_SUPPORT)**: Rol de mantenimiento técnico. Tiene permisos de lectura de auditoría y configuración de sistema, pero no es agendable en el calendario de citas.

---

## 📦 Módulos Principales

El sistema está estructurado en los siguientes módulos funcionales:

- **Calendario y Agenda**: Calendario interactivo en tiempo real con filtrado por profesional y estado de citas. Soporta agendamiento multiservicio y reprogramación drag-and-drop.
- **Motor de Disponibilidad**: Algoritmo centralizado en `/lib/disponibilidad.ts` que calcula la disponibilidad cruzando horarios generales del negocio, turnos de empleados, descansos recurrentes, bloqueos temporales e intervalos ocupados.
- **Control de Traslapes (Overlaps)**: Permite a administradores y empleados forzar traslapes controlados en la agenda cuando sea operacionalmente requerido, registrando la justificación en la auditoría.
- **Autenticación y Seguridad**: Inicio de sesión seguro con JWT inyectados vía cookies seguras HTTP-only y protección perimetral de rutas mediante Edge Middleware (`middleware.ts`).
- **Recuperación de Contraseña (OTP)**: Recuperación de contraseñas por código numérico temporal enviado por correo electrónico.
- **Reportes y Analíticas**: Dashboard gráfico que reporta rendimiento del negocio, productividad por empleado, demanda de servicios y tasas de asistencia/cancelaciones, con exportación a PDF, Excel y CSV.
- **Auditoría (Audit Log)**: Bitácora inmutable en base de datos que registra todas las operaciones sensibles (creación, edición, eliminación y cambios de estado), con anonimización de direcciones IP y sanitización de secretos.
- **Notificaciones de WhatsApp**: Integración para generar enlaces de WhatsApp interactivos para confirmar, recordar, reprogramar y cancelar citas.
- **Automatizaciones JIT (Cron)**: Endpoint programado que sincroniza automáticamente el estado de las citas y dispara recordatorios automáticos de WhatsApp en rangos de proximidad horaria.

---

## ⚙️ Configuración y Variables de Entorno

Cree un archivo `.env` en la raíz del proyecto basándose en `.env.example`:

```bash
cp .env.example .env
```

Defina las siguientes variables en su archivo `.env` local:

```env
# Conexión a la base de datos (PostgreSQL/NeonDB)
DATABASE_URL="postgresql://usuario:contrasena@host:puerto/db?sslmode=require"

# Autenticación y URL base
JWT_SECRET="su-llave-secreta-altamente-segura-y-larga"
FRONTEND_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="NovaCita"

# Servidor de Correo (Envío de OTP para recuperación)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="su-correo@gmail.com"
SMTP_PASSWORD="su-app-password-de-gmail"
SMTP_FROM='"NovaCita" <no-reply@gmail.com>'

# API de WhatsApp (Opcional, simulación en consola si está vacía)
WHATSAPP_API_URL=""
WHATSAPP_API_TOKEN=""

# Token de seguridad para el endpoint del Cron
CRON_SECRET="secreto-para-proteger-el-endpoint-de-cron"
```

---

## 🚀 Instalación y Ejecución Local

### 1. Instalar Dependencias
Instale los paquetes del proyecto usando npm:
```bash
npm install
```

### 2. Ejecutar Prisma
Sincronice el esquema y configure el entorno de base de datos relacional:

- **Generar el cliente Prisma (Tipos TypeScript)**:
  ```bash
  npm run db:generate
  ```
- **Crear y aplicar migraciones de desarrollo**:
  ```bash
  npm run db:migrate
  ```
- **Poblar la base de datos (Sembrado / Seed)**:
  ```bash
  npm run db:seed
  ```
  *(Crea el usuario administrador por defecto: `admin@sistema.com` con la contraseña `Admin123!` e inicializa la configuración global).*

- **Abrir la consola visual de Prisma (Studio)**:
  ```bash
  npm run db:studio
  ```

### 3. Iniciar el Servidor de Desarrollo
Inicie el entorno local:
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.
