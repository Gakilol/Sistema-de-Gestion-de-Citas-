# NovaCita — Plataforma Profesional de Gestión, Agenda y Calendarización de Citas

NovaCita es una plataforma web moderna, robusta y segura diseñada para centralizar el agendamiento de citas, optimizar la gestión de personal, proteger la integridad de los horarios de atención y automatizar recordatorios y reportes operativos.

El sistema está optimizado para su despliegue en infraestructuras Serverless (como Vercel) y bases de datos relacionales escalables (como NeonDB/PostgreSQL), con sincronización automática de huso horario y consistencia total bajo la zona horaria del negocio (**Costa Rica / Central America - America/Costa_Rica**).

---

## 🚀 Características y Módulos Principales

### 1. Seguridad Multicapa y Control de Acceso (RBAC)
*   **Autenticación Criptográfica:** Flujo de inicio de sesión seguro que genera y valida JSON Web Tokens (JWT) mediante la librería `jose`.
*   **Control de Acceso Basado en Roles (RBAC):** Roles definidos mediante `RolUsuario` (`EMPLEADO`, `ADMIN`, `TECH_SUPPORT`).
*   **Protección Edge Middleware (`middleware.ts`):** Intercepta peticiones del navegador antes del renderizado del lado del servidor. Restringe el acceso a las páginas y endpoints privados.
*   **Inyección de Encabezados Seguros:** El middleware inyecta los headers `x-user-id`, `x-user-role` y `x-user-email` en las llamadas a la API, permitiendo a los controladores leer de forma segura el contexto de sesión sin decodificar repetidamente el token JWT.
*   **Protección de Reportes y Auditoría:** Los módulos y endpoints `/reportes` y `/auditoria` se encuentran estrictamente restringidos para roles de administración (`ADMIN` y `TECH_SUPPORT`).

### 2. Recuperación de Contraseña Segura (OTP)
*   **Generación de Códigos OTP:** Flujo de autoservicio para empleados con envío de códigos OTP numéricos de 6 dígitos.
*   **Envío de Correos Automatizado:** Integración con servidores SMTP a través de `nodemailer` con plantillas HTML responsivas y personalizadas con la marca del negocio.
*   **Expiración y Almacenamiento Seguro:** Los tokens de recuperación se registran en la base de datos (`PasswordResetToken`) con sus respectivos hashes de integridad (`token_hash`), dirección IP solicitante y fecha de expiración estricta a los 10 minutos.

### 3. Motor de Disponibilidad y Reglas Horarias Inteligentes
*   **Cálculo Dinámico en `lib/disponibilidad.ts`:** El algoritmo es la fuente única de verdad para determinar si un bloque de tiempo está disponible para un profesional y servicio. Cruza múltiples restricciones en tiempo real:
    *   **Jornada General del Negocio:** Horarios globales activos por día de la semana.
    *   **Turnos Específicos por Empleado:** Cuadrantes de trabajo personalizados para cada profesional almacenados como JSONB.
    *   **Descansos Recurrentes (`DescansoEmpleado`):** Bloques fijos de descanso diario (ej. almuerzo) asociados a cada profesional.
    *   **Bloqueos Temporales (`BloqueoHorario`):** Períodos específicos en un día determinado bloqueados por eventos especiales o reuniones.
    *   **Vacaciones del Personal (`VacacionesEmpleado`):** Rangos de días aprobados en los que no se permite ningún agendamiento.
*   **Validación de Concurrencia:** Bloqueos a nivel de base de datos e interceptores de API evitan la superposición accidental o intencional de turnos y las dobles reservas de un mismo profesional.

### 4. Calendario y Gestión de Citas
*   **Visualización en Tiempo Real:** Interfaz de calendario dinámico interactivo que permite filtrar citas por profesional o estado actual.
*   **Agendamiento Multi-Servicio:** Soporta la asociación de múltiples servicios a una sola cita (`CitaServicio`), recalculando automáticamente la duración combinada total y ordenando las tareas a ejecutar.
*   **Estados de Cita (`EstadoCita`):** Ciclo de vida robusto controlado por estados: `PENDIENTE`, `CONFIRMADA`, `EN_PROGRESO`, `COMPLETADA`, `CANCELADA`, `NO_SHOW`, `REPROGRAMADA`.

### 5. Auditoría del Sistema Avanzada (Audit Log)
*   **Trazabilidad Completa:** Cada operación de inserción, actualización, eliminación o cambio de estado de cita es auditada y registrada en la tabla `AuditLog`.
*   **Anonimización de IP:** Enmascara automáticamente las direcciones IP registradas en los logs (ej. `192.168.xxx.xxx` o `2001:db8:xxxx:xxxx::`) para resguardar la privacidad del personal y los clientes.
*   **Sanitización de Datos Sensibles:** La utilidad `sanitizeAuditData` busca y purga recursivamente contraseñas, secretos, hashes de tokens, cookies y variables privadas de los detalles del log antes de su almacenamiento.
*   **Historial de Cambios (Diff antes/después):** Los logs almacenan el estado del objeto antes y después de la modificación (`beforeData` y `afterData`), permitiendo a los administradores visualizar detalladamente qué campos cambiaron.

### 6. WhatsApp y Automatizaciones periódicas (Cron)
*   **Generación de Enlaces wa.me:** Plantillas interactivas pre-rellenadas en `lib/whatsapp.ts` para enviar notificaciones personalizadas de confirmación, recordatorio, reprogramación y cancelación.
*   **Endpoint del Cron (`/api/cron/whatsapp-reminders`):** Servicio periódico diseñado para ser invocado por programadores externos (ej. Vercel Cron) protegido mediante la variable de entorno `CRON_SECRET`. Realiza:
    1.  **Sincronización JIT de Estados:** Ejecuta `syncCitaEstados()`, el cual transiciona citas activas de forma automática (`PENDIENTE`/`CONFIRMADA` ➔ `EN_PROGRESO` ➔ `COMPLETADA`) conforme a la hora transcurrida en Costa Rica.
    2.  **Envío de Recordatorios de Proximidad:** Detecta citas de hoy que no han recibido recordatorio y que inician en un rango de 0 a 75 minutos en el futuro. Genera y envía el mensaje por WhatsApp de forma automática si las variables HTTP están configuradas, o de lo contrario lo escribe en la consola del servidor (modo simulación).

### 7. Informes Analíticos y Exportación de Datos
*   **Dashboard Operativo:** Visualizaciones y gráficos de rendimiento impulsados por `Recharts` que reportan demanda de servicios, cancelaciones tardías, índices de no-show y productividad de empleados.
*   **Generación de PDF del lado del Cliente:** Compilación de reportes interactivos descargables en formato PDF mediante `jsPDF` y `jspdf-autotable`.

---

## 📂 Estructura del Proyecto Actual

El repositorio sigue la arquitectura de Next.js App Router:

```txt
├── app/                        # Rutas de la Aplicación y API REST (App Router)
│   ├── api/                    # Directorio de Endpoints Backend
│   │   ├── auditoria/          # Rutas API de consulta de logs
│   │   ├── auth/               # Rutas API para autenticación y recuperación (OTP)
│   │   ├── categorias/         # API para gestionar categorías de servicios
│   │   ├── citas/              # API de agendamiento y disponibilidad
│   │   ├── clientes/           # API para la base de clientes
│   │   ├── configuracion/      # API de configuraciones del negocio
│   │   ├── cron/               # Rutas del Programador (WhatsApp + Sincronización)
│   │   ├── dashboard/          # API de KPIs y estadísticas rápidas
│   │   ├── empleados/          # API de administración de personal y horarios
│   │   ├── reportes/           # API de analíticas y exportaciones
│   │   └── servicios/          # API de catálogo de servicios
│   ├── auditoria/              # Interfaz de bitácora y visor de cambios (diff)
│   ├── categorias/             # Interfaz de gestión de categorías
│   ├── citas/                  # Interfaz principal de calendario y agendamiento
│   ├── clientes/               # Interfaz de catálogo de clientes y notas
│   ├── configuracion/          # Panel de configuración general y WhatsApp
│   ├── dashboard/              # Dashboard administrativo y resumen de KPIs
│   ├── empleados/              # Administración de personal, horarios y bloqueos
│   ├── login/                  # Vista de inicio de sesión
│   ├── olvide-contrasena/      # Vista para solicitar código OTP de recuperación
│   ├── restablecer-contrasena/ # Vista para validar OTP y establecer nueva contraseña
│   ├── reportes/               # Módulo de analíticas, gráficos y descargas de PDF
│   ├── servicios/              # Vista de catálogo de servicios y duraciones
│   ├── globals.css             # Estilos globales y variables Tailwind
│   ├── layout.tsx              # Proveedores de estado y tema (Modo Claro/Oscuro)
│   └── page.tsx                # Página principal (redirige al login)
├── components/                 # Componentes de Interfaz de Usuario
│   ├── ui/                     # Componentes atómicos e interactivos (shadcn/ui)
│   └── shared/                 # Componentes compartidos (Sidebar, Navbar, etc.)
├── database/                   # Archivos físicos SQL y guías de DB
│   ├── README_DATABASE.md      # Guía extendida de aprovisionamiento
│   └── novacita_complete_schema.sql # Script SQL unificado e idempotente
├── docs/                       # Reportes adicionales de auditoría y QA
├── hooks/                      # React Hooks personalizados del frontend
├── lib/                        # Capa de Lógica de Negocio y Utilidades
│   ├── audit/                  # Funciones de logging, sanitización y anonimización
│   ├── db.ts                   # Inicialización y singleton de Prisma Client
│   ├── disponibilidad.ts       # Algoritmo de validación horaria y turnos
│   ├── email.ts                # Conexión SMTP y envío de correos OTP
│   ├── hash.ts                 # Encriptación de contraseñas con bcryptjs
│   ├── jwt.ts                  # Generación y firma de tokens JWT (jose)
│   ├── reportes-utils.ts       # Cálculos matemáticos y estructuración de KPIs
│   ├── timezone.ts             # Utilidades de normalización en America/Costa_Rica
│   └── whatsapp.ts             # Generadores de mensajes y enlaces wa.me
├── prisma/                     # Esquema y Migraciones de Prisma ORM
│   ├── migrations/             # Migraciones SQL generadas por Prisma
│   └── schema.prisma           # Modelado físico y relaciones de base de datos
├── public/                     # Assets estáticos y archivos públicos
└── seed.js                     # Script de inicialización de datos de la BD
```

---

## 🗄️ Modelo de Datos (Prisma Schema)

El sistema cuenta con las siguientes tablas y enums relacionales:

### Enums
*   **`RolUsuario`**: `EMPLEADO` | `ADMIN` | `TECH_SUPPORT`
*   **`EstadoCita`**: `PENDIENTE` | `CONFIRMADA` | `EN_PROGRESO` | `COMPLETADA` | `CANCELADA` | `NO_SHOW` | `REPROGRAMADA`

### Modelos de Base de Datos
1.  **`Empleado`**: Registra al personal, especialidades, credenciales (`passwordHash`), rol y sus turnos individuales (`horario` en formato JSONB).
2.  **`Servicio`**: Detalle de servicios, duración en minutos, costo y categoría asociada.
3.  **`Cita`**: Tabla transaccional central. Almacena fecha, hora, duración consolidada, notas, estado de la cita, marcas de tiempo para analítica (`cancelled_at`, `completed_at`, `no_show_at`) y control de recordatorio de WhatsApp.
4.  **`DescansoEmpleado`**: Configuración de los breaks o descansos del personal (ej: hora de almuerzo) por día de la semana.
5.  **`BloqueoHorario`**: Bloqueos puntuales del calendario de un empleado para una fecha y horas específicas.
6.  **`VacacionesEmpleado`**: Bloqueo total de fechas por periodos vacacionales.
7.  **`Configuracion`**: Tabla singleton (`default`) que almacena la información comercial del negocio, horarios globales por defecto, configuración y mensajes personalizados de WhatsApp, y tema visual.
8.  **`AuditLog`**: Registro detallado de operaciones. Soporta campos tradicionales y campos avanzados de auditoría (`userId`, `action`, `module`, `beforeData`, `afterData`, `ipAddress`, etc.).
9.  **`Cliente`**: Base de datos de clientes con notas y datos de contacto directo.
10. **`Categoria`**: Categorías de servicios (ej: Estética, Barbería) con orden de prioridad y color de branding para el calendario.
11. **`CitaServicio`**: Tabla intermedia que permite asignar múltiples servicios a una sola cita con duraciones independientes y orden de ejecución.
12. **`PasswordResetToken`**: Registro temporal de tokens OTP para restablecimiento de contraseña.

---

## ⚙️ Configuración y Variables de Entorno

Cree un archivo `.env` en la raíz del proyecto a partir del archivo `.env.example`:

```bash
cp .env.example .env
```

Defina las siguientes variables en su archivo local:

```env
# ─── BASE DE DATOS ──────────────────────────────────────────────────────────
DATABASE_URL="postgresql://usuario:contrasena@host:puerto/db?sslmode=require"

# ─── AUTENTICACIÓN ──────────────────────────────────────────────────────────
JWT_SECRET="su-llave-secreta-altamente-segura-y-larga"
FRONTEND_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="HAIR STYLE Salón & Barber"

# ─── SERVIDOR DE CORREO (RECUPERACIÓN OTP) ──────────────────────────────────
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="su-correo@gmail.com"
SMTP_PASSWORD="su-app-password-de-gmail"
SMTP_FROM='"HAIR STYLE Salón & Barber" <no-reply@gmail.com>'

# ─── API DE WHATSAPP AUTOMATIZADA (OPCIONAL) ────────────────────────────────
# Deje vacías para simular en consola de servidor
WHATSAPP_API_URL="https://api.proveedor.com/send"
WHATSAPP_API_TOKEN="token-secreto-de-su-api-de-whatsapp"

# ─── PROGRAMADOR DE CRON ────────────────────────────────────────────────────
CRON_SECRET="secreto-para-proteger-el-endpoint-de-cron-en-produccion"
```

---

## 💻 Instalación y Ejecución Local

### 1. Clonar el Repositorio e Instalar Dependencias
```bash
git clone <url-del-repositorio>
cd "Sistema de Gestion de Citas"
npm install
```

### 2. Generar el Cliente Prisma
Sincronice el esquema y compile los tipos locales:
```bash
npm run db:generate
```

### 3. Aplicar Migraciones de Base de Datos
Ejecute las migraciones en desarrollo para crear las tablas físicas:
```bash
npm run db:migrate
```

### 4. Inicializar Base de Datos (Sembrado/Seed)
Si es la primera vez levantando la base de datos, inicialice los registros básicos:
```bash
npm run db:seed
```
*Esto creará el Administrador inicial: `admin@sistema.com` con la contraseña `Admin123!`.*

### 5. Iniciar Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

---

## 🗄️ Gestión y Despliegue de Base de Datos

*   **Despliegue en Producción (Vercel / Pipeline):** En entornos productivos, utilice `npm run db:deploy` para aplicar las migraciones acumuladas sin correr el asistente interactivo de desarrollo.
*   **Visor Gráfico Prisma:** Para abrir la consola web interactiva y ver todas las tablas locales ejecutando consultas rápidas, use:
    ```bash
    npm run db:studio
    ```

---

## 🔒 Comprobaciones de Calidad antes de Desplegar

Antes de realizar un commit a ramas principales o desplegar en Vercel, es obligatorio validar el proyecto:

```bash
# Validar Tipos de TypeScript
npm run type-check

# Ejecutar Validaciones de Código y Linter
npm run lint

# Simular Construcción para Producción
npm run build
```
