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

const PRIMARY_COLOR = "4F46E5"; // Brand Indigo
const SECONDARY_COLOR = "1E293B"; // Slate Charcoal
const ACCENT_COLOR = "0891B2"; // Cyan Accent
const MUTED_COLOR = "64748B"; // Slate Gray
const LIGHT_BG = "F8FAFC"; // Slate Lighter
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
        size: item.size || 24, // 12pt
        font: "Arial"
      }));
    });
  } else {
    runs.push(new TextRun({
      text: text,
      bold: !!options.bold,
      italic: !!options.italic,
      color: options.color || "000000",
      size: options.size || 24, // 12pt
      font: "Arial"
    }));
  }

  return new Paragraph({
    children: runs,
    spacing: { before: options.before || 120, after: options.after || 120 },
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
    borderColor = "EF4444"; // Red / Coral
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
                    size: 22,
                    font: "Arial"
                  }),
                  new TextRun({
                    text: text,
                    size: 22,
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

// Create the Word Document
const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        // ================= PORTADA (COVER PAGE) =================
        new Paragraph({ spacing: { before: 1800 } }), // Top spacer
        
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "MANUAL DE USUARIO Y ADMINISTRACIÓN",
              bold: true,
              size: 56, // 28pt
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
              text: "SISTEMA INTEGRAL DE GESTIÓN DE CITAS Y AUTOMATIZACIÓN INTELIGENTE (V2.0)",
              bold: true,
              size: 24, // 12pt
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
              text: "Una guía de operaciones corporativa sobre control de personal, gestión de catálogos multiservicios, analíticas económicas y motor de estados Just-in-Time (JIT) en la zona horaria de Managua (UTC-6).",
              italic: true,
              size: 24, // 12pt
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
              text: "Documento de Nivel Profesional\n",
              bold: true,
              size: 22,
              color: SECONDARY_COLOR,
              font: "Arial"
            }),
            new TextRun({
              text: "Entorno Técnico: Prisma, PostgreSQL (NeonDB), Next.js 16 y Vercel\n",
              size: 20,
              color: MUTED_COLOR,
              font: "Arial"
            }),
            new TextRun({
              text: "Fecha de Emisión: Mayo 2026",
              size: 20,
              color: MUTED_COLOR,
              font: "Arial"
            })
          ]
        }),

        new PageBreak(), // Move to next page

        // ================= SECCIÓN 1 =================
        createHeading1("1. Introducción y Arquitectura Operativa"),
        createParagraph(
          "El Sistema Inteligente de Gestión de Citas (AppointmentHub) representa una solución robusta y moderna diseñada para optimizar los flujos de agenda comercial, maximizar la eficiencia operativa del personal y ofrecer una experiencia de reserva digital insuperable tanto en entornos móviles como de escritorio."
        ),
        createParagraph(
          "La arquitectura de la plataforma descansa sobre una separación lógica de responsabilidades a través de dos portales especializados:"
        ),
        createParagraph(
          "Portal de Autoservicio de Clientes: Permite a los usuarios autogestionar su perfil, visualizar catálogos y reservar citas de forma autónoma con re-validación de disponibilidad en tiempo real.",
          { bullet: true }
        ),
        createParagraph(
          "Portal de Gestión Profesional: Diseñado para administradores y empleados con el fin de controlar agendas, cuadrantes de trabajo del personal, descansos programados, feriados, analíticas comerciales de facturación y parametrización general del negocio.",
          { bullet: true }
        ),
        createParagraph(
          "La base de datos PostgreSQL, administrada mediante Prisma ORM, garantiza la persistencia e integridad referencial de todos los registros de citas, empleados, descansos semanales, bloqueos puntuales y el catálogo de servicios categorizados."
        ),
        createCallout(
          "Auditoría del Sistema",
          "Toda acción administrativa crítica (creación de citas, cancelaciones, cambios de horario laboral o modificaciones en los ajustes generales) genera un registro histórico físico en la tabla AuditLog. Esto permite rastrear qué empleado realizó cada modificación, brindando transparencia y seguridad al negocio.",
          "info"
        ),

        // ================= SECCIÓN 2 =================
        createHeading1("2. Portal del Cliente (Flujo de Autoreservas)"),
        createParagraph(
          "El portal de clientes está optimizado para garantizar un embudo de conversión ágil y reducir la fricción durante el proceso de reserva de citas. Su diseño responsive facilita el uso en dispositivos móviles inteligentes."
        ),
        
        createHeading2("2.1 Registro e Inicio de Sesión"),
        createParagraph(
          "Accesible desde las rutas /cliente/login y /cliente/register. Los clientes pueden crear un perfil ingresando su nombre, correo electrónico y número telefónico. Las contraseñas se encriptan de forma segura en el servidor utilizando algoritmos de hash antes de persistirse en la base de datos."
        ),

        createHeading2("2.2 Panel de Control del Cliente (Dashboard)"),
        createParagraph(
          "Una interfaz limpia e interactiva que presenta una visión global de la cuenta del cliente:"
        ),
        createParagraph(
          "Citas Futuras: Tarjetas descriptivas de las próximas visitas agendadas, detallando el servicio, el profesional asignado, la fecha y la hora exacta.",
          { bullet: true }
        ),
        createParagraph(
          "Historial de Visitas: Resumen cronológico de todas las citas ya completadas, sirviendo como registro personal de tratamientos.",
          { bullet: true }
        ),
        createParagraph(
          "Acciones Rápidas: Botones directos para agendar nuevas citas, solicitar reprogramación o cancelar de forma interactiva.",
          { bullet: true }
        ),

        createHeading2("2.3 Flujo de Reserva en Tres Sencillos Pasos"),
        createParagraph(
          "El módulo de reservas (/cliente/book) utiliza un asistente dinámico de tres fases:"
        ),
        createParagraph(
          "1. Selección de Servicios: El cliente explora un catálogo estructurado por categorías de tratamientos. Cada servicio muestra su nombre, descripción comercial, precio estimado y duración exacta en minutos.",
          { bullet: true }
        ),
        createParagraph(
          "2. Agenda y Profesional: El cliente selecciona al profesional de su preferencia o la opción 'Cualquiera'. El sistema consulta síncronamente en la base de datos y presenta un calendario con los días y horas disponibles, bloqueando en tiempo real los turnos ocupados por otras citas, rangos de descanso del empleado (DescansoEmpleado), bloqueos puntuales (BloqueoHorario) o vacaciones vigentes.",
          { bullet: true }
        ),
        createParagraph(
          "3. Resumen y Confirmación: Se le muestra al usuario una visualización final detallando el servicio, el precio total, el empleado asignado y la fecha/hora. Al confirmar, la cita se inserta en estado PENDIENTE en la base de datos y se activa el protocolo de mensajería.",
          { bullet: true }
        ),

        new PageBreak(), // Move to next page

        // ================= SECCIÓN 3 =================
        createHeading1("3. Portal Profesional e Industrial (Administración)"),
        createParagraph(
          "El módulo para administradores y personal operativo constituye el núcleo de control comercial de la plataforma, integrando analítica de datos e interfaces de gestión avanzada."
        ),

        createHeading2("3.1 Dashboard de Indicadores y Analíticas"),
        createParagraph(
          "Ubicado en /personal/dashboard, provee a la gerencia un panel de visualización premium con tarjetas de métricas en tiempo real:"
        ),
        createParagraph(
          "Citas Totales del Negocio: Contador general del flujo acumulado.",
          { bullet: true }
        ),
        createParagraph(
          "Citas del Día y Completadas: Visión operativa de la facturación diaria.",
          { bullet: true }
        ),
        createParagraph(
          "Tasa de Asistencia: Ratio porcentual que evalúa el éxito de las citas agendadas vs. inasistencias.",
          { bullet: true }
        ),
        createParagraph(
          "Gráficos Analíticos: Visualizaciones interactivas que destacan los servicios más populares del catálogo y el nivel de facturación y productividad mensual desglosado por empleado.",
          { bullet: true }
        ),

        createHeading2("3.2 Módulo General de Administración de Citas"),
        createParagraph(
          "La sección /personal/appointments provee una tabla administrativa de alto rendimiento con capacidades de búsqueda en tiempo real, filtrado por empleado o estado, y paginación rápida. Desde aquí, el administrador puede:"
        ),
        createParagraph(
          "Agendar Citas Directas (Mostrador): Registrar citas rápidamente para clientes que llaman o asisten al local físico.",
          { bullet: true }
        ),
        createParagraph(
          "Editar y Reprogramar: Cambiar fecha, hora, duración o profesional asignado, con verificación síncrona inmediata para prevenir cruces accidentales.",
          { bullet: true }
        ),
        createParagraph(
          "Mensajería WhatsApp Integrada: Enviar recordatorios y confirmaciones automáticas con plantillas predefinidas que se abren directamente en la aplicación WhatsApp del cliente.",
          { bullet: true }
        ),

        createHeading2("3.3 Gestión de Personal y Disponibilidad Compleja"),
        createParagraph(
          "La asignación de turnos y control de disponibilidad es gestionada con un alto nivel de detalle a través de tres capas operativas específicas:"
        ),
        createParagraph(
          "Horario General Semanal: Definición de las horas de entrada y salida laborables para cada día de la semana.",
          { bullet: true }
        ),
        createParagraph(
          "Descansos Programados (DescansoEmpleado): Registro de pausas recurrentes (como horas de almuerzo) que inhabilitan automáticamente el agendamiento durante dichos intervalos.",
          { bullet: true }
        ),
        createParagraph(
          "Bloqueos de Horario (BloqueoHorario): Bloqueos específicos por fecha (ej. citas médicas, reuniones o ausencias imprevistas del personal).",
          { bullet: true }
        ),
        createParagraph(
          "Vacaciones y Feriados (VacacionesEmpleado): Permite definir rangos completos de fechas de inactividad que suspenden temporalmente al profesional del motor de reservas.",
          { bullet: true }
        ),

        createHeading2("3.4 Catálogo de Servicios y Categorías"),
        createParagraph(
          "La sección /personal/services permite administrar la oferta comercial. Cada servicio debe tener definido su precio base, descripción y duración exacta (fundamental para reservar el bloque correcto de tiempo). Para mayor orden visual, los servicios se asocian a Categorías que admiten un color en formato Hexadecimal para identificarlas fácilmente en los calendarios."
        ),

        new PageBreak(), // Move to next page

        // ================= SECCIÓN 4 =================
        createHeading1("4. Motor de Automatización Inteligente (JIT)"),
        createParagraph(
          "Una de las mayores innovaciones de la plataforma es su motor de sincronización de estados automático basado en el concepto Just-in-Time (JIT)."
        ),

        createHeading2("4.1 Arquitectura del Motor síncrono JIT"),
        createParagraph(
          "En lugar de depender de pesados daemons o Cron Jobs del sistema que consumen recursos del servidor de forma continua y pueden fallar, la plataforma realiza la sincronización de manera síncrona 'al vuelo' (Just-in-Time)."
        ),
        createParagraph(
          "Cada vez que un cliente o administrador consulta el listado de citas, visualiza los reportes o carga las estadísticas del Dashboard, el backend ejecuta instantáneamente una rutina optimizada de sincronización física en la base de datos."
        ),
        createParagraph(
          "Esta rutina evalúa la hora actual y actualiza el estado de las citas en base a reglas temporales estrictas, garantizando que los datos visualizados en tablas, gráficos y filtros de reportes sean 100% consistentes físicamente en PostgreSQL."
        ),

        createHeading2("4.2 Reglas de Transiciones Automáticas de Estado"),
        createParagraph(
          "La automatización lógica opera en tres estados secuenciales basándose en los límites de tiempo de la cita:"
        ),
        createParagraph(
          "1. Estado Inicial: Al crearse la cita, esta queda asignada por defecto a PENDIENTE (o CONFIRMADA si el negocio lo aprueba).",
          { bullet: true }
        ),
        createParagraph(
          "2. Estado En Progreso: Tan pronto como se alcanza la hora de inicio establecida de la cita (Fecha + Hora de Inicio), el sistema la transiciona automáticamente al estado EN PROGRESO.",
          { bullet: true }
        ),
        createParagraph(
          "3. Estado Completada: Una vez transcurre la duración total en minutos asignada al servicio (Hora de Inicio + Duración), el motor transiciona automáticamente la cita al estado definitivo de COMPLETADA.",
          { bullet: true }
        ),

        createCallout(
          "Preservación de Decisiones Administrativas",
          "Las citas que han sido marcadas de forma manual con los estados CANCELADA o REPROGRAMADA quedan completamente excluidas de la evaluación del motor automático. Esto garantiza que las ausencias o reprogramaciones solicitadas queden documentadas permanentemente sin alteración del sistema.",
          "important"
        ),

        createHeading2("4.3 Guía de Colores y Badges de Estados en la UI"),
        createParagraph(
          "Para agilizar el control visual, la plataforma utiliza una paleta de colores premium especialmente calibrada para identificar el estado actual de cada cita:"
        ),

        // Status Table
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          rows: [
            // Header Row
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: SECONDARY_COLOR },
                  children: [createParagraph("Estado", { bold: true, color: "FFFFFF", before: 60, after: 60 })],
                }),
                new TableCell({
                  shading: { fill: SECONDARY_COLOR },
                  children: [createParagraph("Visual en UI", { bold: true, color: "FFFFFF", before: 60, after: 60 })],
                }),
                new TableCell({
                  shading: { fill: SECONDARY_COLOR },
                  children: [createParagraph("Criterio y Comportamiento Temporal", { bold: true, color: "FFFFFF", before: 60, after: 60 })],
                }),
              ],
            }),
            // Row 1 - Pendiente
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: LIGHT_BG },
                  children: [createParagraph("PENDIENTE", { bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Amarillo / Oro (Hex #EAB308)", { color: "EAB308", bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Cita recién creada en espera de su hora programada de inicio.", { before: 60, after: 60 })],
                }),
              ],
            }),
            // Row 2 - Confirmada
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: LIGHT_BG },
                  children: [createParagraph("CONFIRMADA", { bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Índigo / Violeta (Hex #6366F1)", { color: "6366F1", bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Aprobada manualmente por un administrador. Actúa como pendiente protegida.", { before: 60, after: 60 })],
                }),
              ],
            }),
            // Row 3 - En progreso
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: LIGHT_BG },
                  children: [createParagraph("EN PROGRESO", { bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Azul Brillante (Hex #3B82F6)", { color: "3B82F6", bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("La hora actual se encuentra dentro del rango de realización de la cita.", { before: 60, after: 60 })],
                }),
              ],
            }),
            // Row 4 - Completada
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: LIGHT_BG },
                  children: [createParagraph("COMPLETADA", { bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Verde Esmeralda (Hex #22C55E)", { color: "22C55E", bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("El tiempo programado de la cita + duración ya ha transcurrido por completo.", { before: 60, after: 60 })],
                }),
              ],
            }),
            // Row 5 - Cancelada
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: LIGHT_BG },
                  children: [createParagraph("CANCELADA", { bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Rojo Coral (Hex #EF4444)", { color: "EF4444", bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Anulada de mutuo acuerdo. Excluida permanentemente de automatización JIT.", { before: 60, after: 60 })],
                }),
              ],
            }),
            // Row 6 - Reprogramada
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: LIGHT_BG },
                  children: [createParagraph("REPROGRAMADA", { bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Naranja Cálido (Hex #F97316)", { color: "F97316", bold: true, before: 60, after: 60 })],
                }),
                new TableCell({
                  children: [createParagraph("Cita pospuesta a una nueva fecha/hora. Excluida permanentemente de JIT.", { before: 60, after: 60 })],
                }),
              ],
            }),
          ],
        }),

        new PageBreak(), // Move to next page

        // ================= SECCIÓN 5 =================
        createHeading1("5. Configuración del Negocio y Zona Horaria"),
        createParagraph(
          "La parametrización adecuada de la aplicación garantiza la consistencia de todos los flujos de datos. Desde la ruta /personal/settings se definen los parámetros maestros del sistema."
        ),

        createHeading2("5.1 Zona Horaria Centralizada (America/Managua)"),
        createParagraph(
          "Dado que el servidor en la nube (Vercel) opera por defecto en la hora universal (UTC), todas las comprobaciones temporales del motor JIT están sincronizadas estrictamente con la zona horaria de Nicaragua (America/Managua - UTC-6)."
        ),
        createParagraph(
          "Esto asegura que la transición automática a 'En progreso' u 'Completada' se realice exactamente en la hora local del negocio, independientemente del servidor o el navegador del cliente."
        ),

        createHeading2("5.2 Ajustes Generales y Moneda"),
        createParagraph(
          "El superadministrador puede establecer el nombre comercial, el subtítulo del negocio para impresión de facturas, la dirección del local y la moneda de cobro estándar (Dólares o Córdobas). Estos datos se inyectan dinámicamente en las vistas del portal del cliente."
        ),

        createHeading2("5.3 Personalización de Mensajería WhatsApp"),
        createParagraph(
          "El sistema permite parametrizar las plantillas de mensajes que se utilizarán para la comunicación directa:"
        ),
        createParagraph(
          "Mensaje de Confirmación de Reserva: Enviado inmediatamente tras el registro exitoso en el portal del cliente.",
          { bullet: true }
        ),
        createParagraph(
          "Mensaje de Recordatorio de Cita: Diseñado para enviarse horas antes del inicio para mitigar el ausentismo laboral.",
          { bullet: true }
        ),
        createParagraph(
          "Mensaje de Cancelación o Ajuste: Enviado al cliente cuando la agenda administrativa requiere cancelar o reprogramar el horario asignado.",
          { bullet: true }
        ),
        
        createParagraph("\nFin del Documento Técnico Oficial.", { alignment: AlignmentType.CENTER, italic: true, color: MUTED_COLOR })
      ]
    }
  ]
});

// Pack & Write the file
Packer.toBuffer(doc).then((buffer) => {
  const outputPath = path.join(__dirname, "..", "Manual_de_Usuario_Gestion_de_Citas.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log(`[EXITO] Documento Word generado con éxito en: ${outputPath}`);
}).catch(err => {
  console.error("Error al generar el manual en Word:", err);
});

