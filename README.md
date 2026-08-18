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

## ☁️ Despliegue en Vercel con Neon

La integración Neon-Vercel configura `DATABASE_URL` automáticamente. `JWT_SECRET` no forma parte de esa integración: debe existir en los entornos **Production** y **Preview** de Vercel para que las rutas protegidas funcionen.

Este repositorio ahora conserva las migraciones de Prisma. Antes de activar la ejecución automática de migraciones en una base de datos de Neon que ya contiene datos, se debe registrar la migración inicial como ya aplicada. Esto registra el estado en el historial de Prisma sin modificar las tablas de la aplicación:

```bash
npx vercel@latest link
npx vercel@latest env run -e production -- npm run db:baseline
```

Después, configure el **Build Command** de Vercel como:

```bash
npx prisma migrate deploy && npm run build
```

Este comando aplica las migraciones pendientes antes de compilar. El script `npm run build:vercel` ofrece el mismo flujo para validarlo localmente. Para bases de datos nuevas no se ejecuta el paso de línea base: el primer despliegue aplicará la migración inicial automáticamente.
