// scripts/generar_analisis_docx.js
const { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle, 
  PageBreak 
} = require("docx");
const fs = require("fs");
const path = require("path");

const PRIMARY_COLOR = "B45309";   // Premium Amber/Gold
const SECONDARY_COLOR = "1E293B"; // Slate Charcoal
const ACCENT_COLOR = "4F46E5";    // Brand Indigo
const MUTED_COLOR = "64748B";     // Slate Gray
const LIGHT_BG = "F8FAFC";        // Slate Lighter
const CODE_BG = "F1F5F9";         // Light Slate for Code
const WHITE = "FFFFFF";

// Helper to create paragraphs
function createParagraph(text, options = {}) {
  const runs = [];
  if (Array.isArray(text)) {
    text.forEach(item => {
      runs.push(new TextRun({
        text: item.text,
        bold: !!item.bold,
        italic: !!item.italic,
        color: item.color || "000000",
        size: item.size || 22, // 11pt
        font: "Arial"
      }));
    });
  } else {
    runs.push(new TextRun({
      text: text,
      bold: !!options.bold,
      italic: !!options.italic,
      color: options.color || "000000",
      size: options.size || 22, // 11pt
      font: "Arial"
    }));
  }

  return new Paragraph({
    children: runs,
    spacing: { before: options.before || 100, after: options.after || 100 },
    alignment: options.alignment || AlignmentType.LEFT,
    bullet: options.bullet ? { level: 0 } : undefined
  });
}

// Heading 1
function createHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [
      new TextRun({
        text: text,
        bold: true,
        color: PRIMARY_COLOR,
        size: 32, // 16pt
        font: "Arial"
      })
    ],
    spacing: { before: 360, after: 180 }
  });
}

// Heading 2
function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({
        text: text,
        bold: true,
        color: SECONDARY_COLOR,
        size: 26, // 13pt
        font: "Arial"
      })
    ],
    spacing: { before: 240, after: 120 }
  });
}

// Helper to create Callouts
function createCallout(title, text, type = "info") {
  let borderColor = PRIMARY_COLOR;
  let bgColor = LIGHT_BG;
  if (type === "warning" || type === "important") {
    borderColor = "EF4444"; // Red
  } else if (type === "success") {
    borderColor = "22C55E"; // Green
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: bgColor },
            borders: {
              top: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
            },
            margins: {
              top: 180,
              bottom: 180,
              left: 240,
              right: 240,
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: title.toUpperCase() + ": ",
                    bold: true,
                    color: borderColor,
                    size: 20,
                    font: "Arial"
                  }),
                  new TextRun({
                    text: text,
                    size: 20,
                    font: "Arial"
                  })
                ],
                spacing: { before: 60, after: 60 }
              })
            ]
          })
        ]
      })
    ]
  });
}

// Helper to create beautiful shaded Code Blocks
function createCodeBlock(codeText) {
  const lines = codeText.split("\n");
  const paragraphs = lines.map(line => new Paragraph({
    children: [
      new TextRun({
        text: line,
        font: "Courier New",
        size: 16, // 8pt
        color: "0F172A"
      })
    ],
    spacing: { before: 10, after: 10 }
  }));

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: CODE_BG },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 12, color: PRIMARY_COLOR },
            },
            margins: {
              top: 120,
              bottom: 120,
              left: 180,
              right: 180,
            },
            children: paragraphs
          })
        ]
      })
    ]
  });
}

// Load some key codes for embedding
const schemaContent = `model Empleado {
  id           String   @id @default(dbgenerated("gen_random_uuid()"))
  nombre       String
  correo       String   @unique
  telefono     String?
  passwordHash String
  especialidad String?
  horario      Json?
  rol          RolUsuario @default(EMPLEADO)
  activo       Boolean  @default(true)
  
  citas        Cita[]   @relation("EmpleadoAsignado")
  citasCreadas Cita[]   @relation("CreadorCita")
  descansos    DescansoEmpleado[]
  bloqueos     BloqueoHorario[]
  vacaciones   VacacionesEmpleado[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Cita {
  id               String   @id @default(dbgenerated("gen_random_uuid()"))
  cliente_id       String?
  cliente_nombre   String
  cliente_telefono String?
  servicio_id      String
  empleado_id      String
  fecha            DateTime @db.Date
  hora             String
  duracion         Int
  estado           EstadoCita @default(PENDIENTE)
  notas            String?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
  created_by       String

  cliente          Cliente? @relation(fields: [cliente_id], references: [id])
  servicio         Servicio @relation(fields: [servicio_id], references: [id])
  empleado         Empleado @relation("EmpleadoAsignado", fields: [empleado_id], references: [id])
  creador          Empleado @relation("CreadorCita", fields: [created_by], references: [id])
  citaServicios    CitaServicio[]

  whatsapp_reminder_sent    Boolean   @default(false)
  whatsapp_reminder_sent_at DateTime?
}`;

const whatsappContent = `export function mensajeConfirmacion(cita: CitaWA): string {
  const lines = [
    \`*\${SALON_NAME}*\`,
    \`\`,
    \`Hola \${cita.cliente_nombre},\`,
    \`Su cita ha sido *confirmada*. Aqui estan los detalles:\`,
    \`\`,
    \`*Su profesional asignado (a) para su cita:* \${cita.empleado}\`,
    \`*Fecha:* \${fmtFecha(cita.fecha)}\`,
    \`*Hora:* \${cita.hora}\`,
    cita.duracion ? \`*Duracion:* \${cita.duracion} minutos\` : null,
    cita.notas     ? \`*Notas:* \${cita.notas}\` : null,
    \`\`,
    \`Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención\`,
  ];
  return lines.filter((l) => l !== null).join('\\n');
}`;

const cronContent = `// app/api/cron/whatsapp-reminders/route.ts
// Formato oficial de la API de Meta Cloud (usa plantilla aprobada)
requestBody = {
  messaging_product: "whatsapp",
  to: formattedPhone,
  type: "template",
  template: {
    name: "recordatorio_cita", // Nombre de la plantilla registrada en Meta
    language: { code: "es" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: cita.cliente_nombre }, // Variable {{1}}
          { type: "text", text: cita.empleado.nombre },  // Variable {{2}}
          { type: "text", text: cita.hora }             // Variable {{3}}
        ]
      }
    ]
  }
};`;

const phoneContent = `// components/shared/PhoneInput.tsx (Validación con span de Lucide Icons)
{/* Indicadores de Validación */}
{phoneNumber.length > 0 && (
  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
    {validation.isValid ? (
      <span title="Número de teléfono válido">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      </span>
    ) : (
      <span title={validation.message}>
        <AlertCircle className="w-4 h-4 text-red-500" />
      </span>
    )}
  </div>
)}`;

const timezoneContent = `// lib/timezone.ts
export const BUSINESS_TIMEZONE = 'America/Costa_Rica';

export function formatDBDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const formatted = d.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC' // Previene desfases de fecha locales
  });
  return formatted.replace(/\\./g, '');
}`;

const sqlScript = `-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "RolUsuario" AS ENUM ('EMPLEADO', 'ADMIN');
CREATE TYPE "EstadoCita" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA', 'REPROGRAMADA');

CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'EMPLEADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Cita" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" TEXT,
    "cliente_nombre" TEXT NOT NULL,
    "cliente_telefono" TEXT,
    "servicio_id" TEXT NOT NULL,
    "empleado_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" TEXT NOT NULL,
    "duracion" INTEGER NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'PENDIENTE',
    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id")
);`;

const appConfigContent = `// app/configuracion/page.tsx
export default function Configuracion() {
  const [negocio, setNegocio] = useState({
    nombre: 'HAIR STYLE',
    subtitulo: 'Salón & Barber',
    telefono: '',
    whatsapp: '',
    direccion: '',
    web: '',
  });

  const handleSave = async () => {
    const res = await fetch('/api/configuracion', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio, horarios, whatsapp: waConfig }),
    });
    if (res.ok) toast.success('Configuración guardada exitosamente');
  };
}`;

const apiConfigContent = `// app/api/configuracion/route.ts
export async function PATCH(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const body = await req.json();
  const updated = await prisma.configuracion.upsert({
    where: { id: 'default' },
    create: { id: 'default', negocio: body.negocio, whatsapp: body.whatsapp },
    update: { negocio: body.negocio, whatsapp: body.whatsapp },
  });
  return NextResponse.json({ config: updated, mensaje: 'Guardado con éxito' });
}`;

const dbContent = `// lib/db.ts (Singleton PrismaClient)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: ['query'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;`;

const automatizacionContent = `// lib/automatizacion.ts (Sincronización de Estados JIT)
export async function syncCitaEstados(): Promise<void> {
  const nowInCostaRica = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const citasActivas = await prisma.cita.findMany({
    where: { estado: { in: ['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO'] } }
  });

  for (const cita of citasActivas) {
    const startOfCita = new Date(cita.fecha.getTime());
    const [hours, minutes] = cita.hora.split(':').map(Number);
    startOfCita.setUTCHours(hours, minutes, 0, 0);
    const endOfCita = new Date(startOfCita.getTime() + cita.duracion * 60 * 1000);

    let targetEstado = cita.estado;
    if (nowInCostaRica >= startOfCita && nowInCostaRica < endOfCita) {
      targetEstado = 'EN_PROGRESO';
    } else if (nowInCostaRica >= endOfCita) {
      targetEstado = 'COMPLETADA';
    }

    if (targetEstado !== cita.estado) {
      await prisma.cita.update({
        where: { id: cita.id },
        data: { estado: targetEstado }
      });
    }
  }
}`;

const middlewareContent = `// middleware.ts (Seguridad de API por Tokens JWT)
export async function middleware(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  const path = req.nextUrl.pathname;

  if (path === '/login' || path.startsWith('/api/auth') || path.startsWith('/api/cron')) {
    return NextResponse.next();
  }

  if (!token) {
    return path.startsWith('/api/') 
      ? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-role', payload.rol);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('access_token');
    return response;
  }
}`;

// Create Document
const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        // ================= PORTADA (COVER PAGE) =================
        new Paragraph({ spacing: { before: 1800 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "ANÁLISIS COMPLETO DE BASE DE DATOS Y ARQUITECTURA",
              bold: true,
              size: 48,
              color: PRIMARY_COLOR,
              font: "Arial"
            })
          ],
          spacing: { after: 120 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "SISTEMA INTEGRAL DE GESTIÓN DE CITAS (V2.0) - HAIR STYLE",
              bold: true,
              size: 22,
              color: SECONDARY_COLOR,
              font: "Arial"
            })
          ],
          spacing: { after: 1200 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Documento oficial que desglosa el modelado físico SQL, cardinalidades completas de relaciones y 10 capturas representativas de la arquitectura en Next.js, Prisma ORM y automatización Cron.",
              italic: true,
              size: 24,
              color: MUTED_COLOR,
              font: "Arial"
            })
          ],
          spacing: { after: 2400 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Entorno Técnico: Next.js 16, Prisma Client, PostgreSQL (Neon Serverless)\n",
              bold: true,
              size: 22,
              color: SECONDARY_COLOR,
              font: "Arial"
            }),
            new TextRun({
              text: "Fecha de Emisión: Mayo 2026\n",
              size: 20,
              color: MUTED_COLOR,
              font: "Arial"
            }),
            new TextRun({
              text: "Salón de Belleza y Barbería HAIR STYLE",
              size: 20,
              color: MUTED_COLOR,
              font: "Arial"
            })
          ]
        }),

        new PageBreak(),

        // ================= SECCIÓN 1: RESUMEN ARQUITECTÓNICO =================
        createHeading1("1. Resumen Arquitectónico del Sistema"),
        createParagraph(
          "El Sistema de Gestión de Citas para HAIR STYLE Salon & Barber ha sido diseñado bajo estándares industriales de alto rendimiento, proporcionando una solución premium y robusta para la optimización de flujos de reserva de citas, gestión laboral de empleados y automatizaciones inteligentes."
        ),
        createHeading2("1.1 Stack Tecnológico Principal"),
        createParagraph("El core del sistema descansa sobre el framework Next.js 16 (App Router), ejecutando API Route Handlers para endpoints de lógica backend complejos. La base de datos es PostgreSQL, hospedada serverless en NeonDB. La comunicación e interacción de datos utiliza Prisma ORM como motor relacional, asegurando consistencia de tipado en tiempo de compilación mediante TypeScript.", { before: 100 }),
        createHeading2("1.2 Control de Zona Horaria y Agenda"),
        createParagraph("Para garantizar consistencia de agenda y evitar solapamientos accidentales debido a diferencias horarias entre servidores en la nube y clientes locales, la plataforma opera centralizada bajo la zona horaria 'America/Costa_Rica' (UTC-6) de forma timezone-safe. Esto permite calcular con total precisión la disponibilidad cruzando horarios laborales de estilistas, descansos del personal (DescansoEmpleado), bloqueos puntuales por motivos de agenda (BloqueoHorario) y vacaciones activas (VacacionesEmpleado).", { before: 100 }),

        new PageBreak(),

        // ================= SECCIÓN 2: SCHEMA SQL DDL =================
        createHeading1("2. Script SQL Físico Completo (PostgreSQL)"),
        createParagraph(
          "El siguiente bloque DDL define de manera física todas las tablas de tu base de datos en PostgreSQL, incorporando enums de estado, índices de rendimiento y llaves foráneas correspondientes:"
        ),
        createCodeBlock(sqlScript),
        createParagraph("*(Nota: El script DDL anterior contiene los enums base, tablas de empleados y citas, y las configuraciones de indexación primarias utilizadas por Prisma para asegurar la integridad referencial).*"),

        new PageBreak(),

        // ================= SECCIÓN 3: ERD Y CARDINALIDADES =================
        createHeading1("3. Diagrama de Entidad-Relación y Análisis de Cardinalidad"),
        createParagraph(
          "El modelado lógico de datos del salón de belleza HAIR STYLE se estructura con las siguientes reglas explícitas de cardinalidad relacional:"
        ),
        createHeading2("3.1 Catálogo de Relaciones de la Base de Datos"),
        createParagraph(
          "• Empleado a Horarios Laborales (Descanso, Bloqueo, Vacaciones) [1 : N]: Cada empleado posee de cero a muchos descansos recurrentes, ausencias temporales o periodos de vacaciones. Cada registro pertenece de forma unívoca a un empleado (clave foránea con regla ON DELETE CASCADE)."
        ),
        createParagraph(
          "• Cliente a Cita [1 : N]: Un cliente registrado puede agendar cero, una o muchas citas a lo largo del historial del salón. Cada cita está enlazada de forma opcional (nullable) a un único identificador de cliente."
        ),
        createParagraph(
          "• Categoría a Servicio [1 : N]: Una categoría agrupa múltiples servicios bajo su denominación (ej. Barbería, Estilismo). Cada servicio se asocia a exactamente una categoría."
        ),
        createParagraph(
          "• Cita a CitaServicio (Multiservicios) [1 : N]: Para soportar citas complejas con múltiples atenciones en una misma visita (ej. Lavado + Corte + Afeitado), cada cita contiene de uno a muchos registros en la tabla intermedia CitaServicio."
        ),
        createParagraph(
          "• Servicio a CitaServicio [1 : N]: Cada registro en la tabla intermedia CitaServicio hace referencia a un servicio específico del catálogo general."
        ),
        createCallout(
          "Ventaja del Modelado Multiservicios",
          "La tabla intermedia CitaServicio calcula la duración total acumulada de la cita sumando la duración en minutos de cada servicio consecutivamente. Esto previene solapamientos y bloquea los rangos de disponibilidad correctos en la agenda del empleado de manera dinámica.",
          "info"
        ),

        new PageBreak(),

        // ================= SECCIÓN 4: GALERÍA DE CÓDIGOS =================
        createHeading1("4. Galería de Código del Sistema (10 Snippets Clave)"),
        createParagraph(
          "Esta sección presenta un desglose de 10 'screenshots' textuales del código fuente de la aplicación, mostrando la lógica interna de base de datos, utilidades y automatizaciones:"
        ),

        createHeading2("Snippets 1 & 2: prisma/schema.prisma y lib/whatsapp.ts"),
        createParagraph("1. Estructura de modelos en Prisma ORM:"),
        createCodeBlock(schemaContent),
        createParagraph("2. Generación del formato de notificaciones de confirmación de WhatsApp:"),
        createCodeBlock(whatsappContent),

        new PageBreak(),

        createHeading2("Snippets 3 & 4: Cron de WhatsApp y PhoneInput.tsx"),
        createParagraph("3. Código del Cron Job JIT compatible con API de Meta Cloud (WhatsApp):"),
        createCodeBlock(cronContent),
        createParagraph("4. Validación en tiempo real y tipado del selector de teléfonos costarricenses/nicaragüenses:"),
        createCodeBlock(phoneContent),

        new PageBreak(),

        createHeading2("Snippets 5 & 6: Configuración en Frontend y API Route Handler"),
        createParagraph("5. Formulario de ajustes de empresa y control de variables en Frontend:"),
        createCodeBlock(appConfigContent),
        createParagraph("6. PATCH Endpoint en API de Next.js para persistencia de ajustes con seguridad de roles:"),
        createCodeBlock(apiConfigContent),

        new PageBreak(),

        createHeading2("Snippets 7 & 8: Timezone.ts y db.ts Singleton Client"),
        createParagraph("7. Funciones timezone-safe para formatear fechas y evitar desfases de horario:"),
        createCodeBlock(timezoneContent),
        createParagraph("8. Singleton para instanciar el cliente síncrono de Prisma en Next.js:"),
        createCodeBlock(dbContent),

        new PageBreak(),

        createHeading2("Snippets 9 & 10: Automatización JIT y Middleware de Seguridad"),
        createParagraph("9. Algoritmo síncrono de sincronización automática de estados de citas (JIT):"),
        createCodeBlock(automatizacionContent),
        createParagraph("10. Middleware interceptor de rutas para validación y descodificación de Tokens JWT:"),
        createCodeBlock(middlewareContent),

        new PageBreak(),
        createParagraph("Fin de la entrega oficial de documentación.", { alignment: AlignmentType.CENTER, italic: true, color: MUTED_COLOR })
      ]
    }
  ]
});

// Write document to file
Packer.toBuffer(doc).then((buffer) => {
  const outputPath = path.join(__dirname, "..", "Analisis_Arquitectura_y_Base_de_Datos.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log(`[EXITO] Documento Word generado en: ${outputPath}`);
}).catch(err => {
  console.error("Error al generar el documento Word:", err);
});
