# NovaCita — Sistema Profesional de Gestión y Calendarización de Citas

NovaCita es una plataforma web moderna, robusta y segura diseñada para centralizar el agendamiento de citas, optimizar la gestión de personal, proteger la integridad de los horarios de atención y automatizar recordatorios y reportes operativos. Está optimizada para su despliegue JIT en infraestructuras Serverless (como Vercel) y bases de datos relacionales escalables (como NeonDB/PostgreSQL).

---

## 🚀 Características Principales

*   **Calendario Interactivo Avanzado:** Visualización ágil de citas (día, semana, mes) para recepcionistas y clientes. Soporta drag-and-drop y reprogramación síncrona en tiempo real.
*   **Gestión Multi-Servicios:** Permite asociar múltiples servicios a una sola cita (`CitaServicio`), recalculando automáticamente la duración combinada del bloque.
*   **Control Laboral del Personal:** Definición de cuadrantes de trabajo para cada profesional, configurando descansos (pausas de almuerzo), días de vacaciones (`VacacionesEmpleado`) y bloqueos temporales por eventos especiales.
*   **Módulo Avanzado de Auditoría del Sistema:** Trazabilidad completa de las acciones del sistema con enmascaramiento de direcciones IP, sanitización recursiva de datos sensibles (contraseñas, cookies, tokens) y visualización gráfica en formato de diferencias (diff) antes/después.
*   **Reportes y Analítica Predictiva:** Gráficos e indicadores clave de rendimiento (KPIs) sobre demanda de servicios, ausencias (no-shows), cancelaciones de citas a tiempo o tardías y desempeño laboral de profesionales.
*   **Sistema de Notificaciones por WhatsApp:** Generación interactiva de enlaces `wa.me` personalizados y pre-rellenados para confirmaciones, recordatorios de 24 horas y cancelaciones, sin necesidad de APIs pagas de terceros.
*   **Seguridad Multicapa (RBAC):** Control de acceso estricto basado en roles (`RolUsuario`: `EMPLEADO`, `ADMIN`, `TECH_SUPPORT`), validaciones de API en backend, middleware perimetral y sanitización profunda de logs.
*   **Recuperación de Contraseña Segura:** Flujo de autoservicio con envío de códigos OTP de 6 dígitos con tiempo de expiración y tokens criptográficos almacenados de forma segura (`PasswordResetToken`).

---

## 🛠️ Tecnologías Utilizadas

*   **Core:** [Next.js 15](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
*   **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) (tipado estricto)
*   **Persistencia (ORM):** [Prisma ORM](https://www.prisma.io/)
*   **Base de Datos:** [PostgreSQL](https://www.postgresql.org/) / [NeonDB Serverless](https://neon.tech/)
*   **Estilos:** [Tailwind CSS](https://tailwindcss.com/) & [next-themes](https://github.com/pacocoursey/next-themes) (Modo Claro/Oscuro)
*   **Gráficos e Informes:** [Recharts](https://recharts.org/) & [jsPDF](https://github.com/parallax/jsPDF) (para generación de PDF del lado del cliente)
*   **Autenticación y Criptografía:** [jose](https://github.com/panva/jose) (JWT en Edge middleware) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
*   **Gestión de Formularios:** [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)

---

## 📂 Estructura del Proyecto

El repositorio sigue la arquitectura estándar de Next.js App Router:

```txt
├── app/                  # Rutas del Frontend y Endpoints de API (App Router)
│   ├── api/              # Endpoints de API REST (Servicio Backend)
│   ├── auditoria/        # Panel de Auditoría avanzada
│   ├── citas/            # Gestión operativa de citas y calendario
│   ├── clientes/         # Administración de clientes y fichas técnicas
│   ├── configuracion/    # Parámetros del negocio y apariencia
│   ├── dashboard/        # Dashboard operativo con resúmenes rápidos
│   └── reportes/         # Reportes analíticos y gráficos
├── components/           # Componentes UI reutilizables
│   ├── ui/               # Componentes atómicos (Radix + Shadcn)
│   └── shared/           # Componentes compartidos del sistema (Sidebar, Navbar)
├── database/             # Esquema SQL unificado y guías físicas de DB
├── docs/                 # Informes y documentación de auditorías de código
├── hooks/                # Hooks de React personalizados
├── lib/                  # Servicios de backend, utilidades de red y algoritmos
├── prisma/               # Esquema Prisma y migraciones de base de datos
├── public/               # Assets estáticos (iconos, imágenes)
└── scripts/              # Scripts de migración de datos y utilidades CLI
```

---

## ⚙️ Configuración y Variables de Entorno

Para ejecutar la aplicación localmente, cree un archivo `.env` en la raíz del proyecto a partir de [`.env.example`](file:///c:/Users/Gaki/Documents/Sistema%20de%20Gestion%20de%20Citas/.env.example):

```bash
cp .env.example .env
```

Defina las siguientes variables obligatorias:

*   `DATABASE_URL`: URL de conexión segura a PostgreSQL o NeonDB.
*   `JWT_SECRET`: Llave simétrica para firmar y validar tokens de sesión de usuarios.
*   `FRONTEND_URL`: Dirección de escucha local (ej. `http://localhost:3000`).
*   `NEXT_PUBLIC_APP_NAME`: Nombre del negocio o establecimiento.
*   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: Credenciales de SMTP para el envío seguro de correos de recuperación de contraseña.

---

## 💻 Instalación y Ejecución Local

Siga los siguientes pasos para levantar el entorno de desarrollo:

### 1. Clonar el Repositorio e Instalar Dependencias
```bash
git clone <url-del-repositorio>
cd "Sistema de Gestion de Citas"
npm install
```

### 2. Generar el Cliente Prisma
Compila el esquema de base de datos para generar los tipos y métodos estáticos del ORM:
```bash
npm run db:generate
```

### 3. Aplicar Migraciones de Base de Datos
Crea las tablas, enums y relaciones en su servidor PostgreSQL/NeonDB:
```bash
npm run db:migrate
```

### 4. Sembrar (Seed) la Base de Datos
Inicializa el sistema con el Administrador Principal por defecto (`admin@sistema.com` / `Admin123!`) y el registro de configuración básico:
```bash
npm run db:seed
```

### 5. Iniciar Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

---

## 🗄️ Gestión de Base de Datos

La base de datos se puede gestionar de dos formas:

1.  **Mediante Prisma ORM (Flujo Recomendado):**
    *   Generar Cliente: `npm run db:generate`
    *   Crear migraciones en desarrollo: `npm run db:migrate`
    *   Desplegar migraciones acumuladas en producción: `npm run db:deploy`
    *   Explorador visual de base de datos: `npm run db:studio`
2.  **Mediante Script SQL Unificado (Aprovisionamiento directo):**
    *   Se encuentra en [`database/novacita_complete_schema.sql`](file:///c:/Users/Gaki/Documents/Sistema%20de%20Gestion%20de%20Citas/database/novacita_complete_schema.sql) y contiene todo el esquema mapeado idempotente, listo para ser ejecutado en el pgAdmin o Neon SQL Editor.

Consulte la [Guía de Base de Datos](file:///c:/Users/Gaki/Documents/Sistema%20de%20Gestion%20de%20Citas/database/README_DATABASE.md) para más detalles.

---

## 🔒 Seguridad e Integridad

*   **Protección Edge Middleware:** El archivo `middleware.ts` bloquea accesos no autorizados a nivel de red antes de renderizar páginas, redirigiendo a login e inyectando cabeceras seguras de sesión.
*   **Enmascaramiento de IP:** Las direcciones IP capturadas en auditoría son anonimizadas en el backend (ej. `192.168.xxx.xxx`) para proteger la privacidad de los empleados y clientes.
*   **Sanitización de Datos Sensibles:** La utilidad `sanitizeAuditData` busca y purga recursivamente contraseñas, secretos, hashes de tokens, números de tarjetas de crédito y cookies antes de guardarlos en los registros de auditoría.
*   **Prevención de Concurrencia:** Lógica transaccional a nivel de API y restricciones CHECK de base de datos previenen la doble reserva simultánea de turnos para el mismo profesional.

---

## 🛠️ Comprobaciones de Calidad y Construcción

Antes de enviar cambios al repositorio o realizar un despliegue en Vercel, es obligatorio ejecutar las suites de comprobación estática:

```bash
# Verificar tipos de TypeScript
npm run type-check

# Ejecutar linter del proyecto
npm run lint

# Simular construcción de producción
npm run build
```
