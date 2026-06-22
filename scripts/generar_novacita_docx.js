// scripts/generar_novacita_docx.js
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

const PRIMARY_COLOR = "1E3A8A";   // Deep Royal Blue
const SECONDARY_COLOR = "0F172A"; // Slate Dark
const ACCENT_COLOR = "2563EB";    // Bright Blue
const MUTED_COLOR = "64748B";     // Slate Gray
const LIGHT_BG = "F8FAFC";        // Light Gray Bg
const CODE_BG = "F1F5F9";         // Code Block Bg
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

// Helper to create shaded Code Blocks
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

// Construct Document
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
              text: "ESPECIFICACIÓN TÉCNICA Y FUNCIONAL DE SISTEMA",
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
              text: "SISTEMA DE GESTIÓN DE CITAS (NOVACITA)",
              bold: true,
              size: 26,
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
              text: "Documento maestro de ingeniería de software que aborda la evolución del proyecto, manual de operación, stack tecnológico de concurrencia, metodologías de QA en base de datos y diseño basado en principios SOLID.",
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
              text: "Perfil Profesional: Ingeniero de Software, QA & Arquitecto de Sistemas\n",
              bold: true,
              size: 22,
              color: SECONDARY_COLOR,
              font: "Arial"
            }),
            new TextRun({
              text: "Tecnologías: Node.js, PostgreSQL, pgAdmin 4, Vercel\n",
              size: 20,
              color: MUTED_COLOR,
              font: "Arial"
            }),
            new TextRun({
              text: "Fecha de Emisión: Junio 2026",
              size: 20,
              color: MUTED_COLOR,
              font: "Arial"
            })
          ]
        }),

        new PageBreak(),

        // ================= SECCIÓN 1: INTRODUCCIÓN Y EVOLUCIÓN =================
        createHeading1("1. Introducción y Evolución del Proyecto"),
        createParagraph(
          "La descoordinación en el agendamiento de citas representa uno de los mayores sumideros de eficiencia operativa y reputación de marca para las organizaciones orientadas al servicio. La superposición de horarios, el registro de citas en papel o sistemas aislados y la falta de visibilidad en tiempo real de la capacidad laboral del personal conducen a la insatisfacción del cliente y al desgaste del personal. NovaCita (Sistema de Gestión de Citas) surge de la necesidad imperativa de centralizar, automatizar y blindar la asignación de turnos frente a conflictos lógicos y de concurrencia."
        ),
        createHeading2("1.1 Origen del Problema y Necesidad de Centralización"),
        createParagraph(
          "El proyecto nació a partir de un diagnóstico de fallas lógicas de calendarización en entornos de atención médica y servicios profesionales. Los conflictos detectados incluían citas dobles asignadas al mismo profesional a la misma hora, diferencias horarias no computadas entre el servidor en la nube y la zona horaria del local de atención, y cancelaciones imprevistas sin actualización JIT de la disponibilidad."
        ),
        createParagraph(
          "La centralización de agendas bajo NovaCita proporciona una única fuente de verdad transaccional. Esto significa que cualquier consulta de disponibilidad o inserción de citas evalúa síncronamente los cuadrantes laborales del personal, descansos diarios (p. ej., almuerzo), bloqueos temporales e incluso periodos de vacaciones activos, garantizando un agendamiento limpio y sin fricciones."
        ),
        createHeading2("1.2 Evolución de la Arquitectura de Software"),
        createParagraph(
          "La evolución del sistema se ejecutó en base a tres grandes hitos de ingeniería:"
        ),
        createParagraph(
          "• Fase 1 (Calendario Básico): Monolito sencillo con almacenamiento basado en archivos planos. La validación se realizaba únicamente en la capa cliente (frontend), permitiendo que la concurrencia a nivel de API rompiera las restricciones horarias al realizar reservas masivas.",
          { bullet: true }
        ),
        createParagraph(
          "• Fase 2 (Migración Transaccional y Blindaje de Base de Datos): Se incorporó un motor de persistencia relacional con PostgreSQL. Se implementó una lógica transaccional estricta y se trasladaron las restricciones de disponibilidad y de tiempo a nivel de base de datos, apoyándose en restricciones CHECK y claves únicas.",
          { bullet: true }
        ),
        createParagraph(
          "• Fase 3 (Control de Calidad Integrado y Trazabilidad): Introducción de protocolos de control de calidad (QA). Se definieron suites de pruebas específicas para concurrencia y validación temporal de horarios. Asimismo, se implementó una Matriz de Trazabilidad de Requisitos (RTM) en formato Excel, mapeando cada requerimiento de negocio (ej. 'Evitar reservas duplicadas') a su correspondiente caso de prueba en backend y base de datos.",
          { bullet: true }
        ),
        createCallout(
          "QA y la Matriz de Trazabilidad de Requisitos (RTM)",
          "La RTM actúa como el contrato de calidad del proyecto. Permite asegurar cobertura total de pruebas lógicas, vinculando cada requisito de negocio con pruebas unitarias, de integración en API y de concurrencia a nivel de motor SQL. Ningún código se despliega a producción si no pasa las verificaciones asociadas de la matriz.",
          "info"
        ),

        new PageBreak(),

        // ================= SECCIÓN 2: MANUAL DE USUARIO =================
        createHeading1("2. Manual de Usuario del Sistema NovaCita"),
        createParagraph(
          "El sistema cuenta con interfaces adaptadas y segregadas lógicamente para ofrecer una experiencia fluida según el perfil del usuario: Clientes/Pacientes y Personal/Administradores."
        ),
        createHeading2("2.1 Perfil de Clientes / Pacientes"),
        createParagraph(
          "Los usuarios que desean agendar un turno tienen acceso a un flujo simplificado paso a paso:"
        ),
        createParagraph(
          "1. Búsqueda de Disponibilidad: El usuario ingresa a la sección de agendamiento (/cliente/book), selecciona el servicio del catálogo y escoge al profesional de su preferencia. El sistema renderiza un calendario interactivo que muestra únicamente los días y bloques horarios disponibles en tiempo real.",
          { bullet: true }
        ),
        createParagraph(
          "2. Creación del Registro de Cita: Al seleccionar una hora libre, el sistema reserva temporalmente el bloque en caché de sesión para evitar colisiones rápidas. El usuario confirma sus datos de contacto y presiona 'Confirmar Reserva'. La cita se almacena con estado PENDIENTE o CONFIRMADA en base a las reglas del negocio.",
          { bullet: true }
        ),
        createParagraph(
          "3. Reprogramación de Cita: En su Dashboard personal, el cliente puede seleccionar una cita futura y pulsar 'Reprogramar'. Se desplegarán los nuevos bloques horarios disponibles para el profesional seleccionado. Al guardar, se actualiza el registro con validación síncrona en base de datos para prevenir superposiciones.",
          { bullet: true }
        ),
        createParagraph(
          "4. Cancelación de Cita: El usuario puede dar de baja una cita futura con un solo clic. El estado cambia inmediatamente a CANCELADA, liberando el bloque horario para otros usuarios en tiempo real.",
          { bullet: true }
        ),
        
        createHeading2("2.2 Perfil de Personal / Administradores"),
        createParagraph(
          "Los administradores y recepcionistas disponen de un panel avanzado para el control operacional:"
        ),
        createParagraph(
          "• Control de Disponibilidad del Equipo: Permite definir para cada empleado el horario de entrada, salida y pausas recurrentes (como almuerzo). Estos datos se modelan y almacenan en formato JSONB o tablas relacionales de horarios de empleados.",
          { bullet: true }
        ),
        createParagraph(
          "• Visualización de la Agenda General: Un calendario global e interactivo (vista diaria, semanal y mensual) que permite a los recepcionistas agendar citas directas de mostrador, reprogramarlas mediante drag-and-drop y filtrar citas por profesional o estado.",
          { bullet: true }
        ),
        createParagraph(
          "• Administración de Usuarios: Permite crear cuentas de personal, asignar roles (ADMIN, EMPLEADO), modificar permisos operativos y desactivar cuentas de empleados inactivos.",
          { bullet: true }
        ),

        new PageBreak(),

        // ================= SECCIÓN 3: TECNOLOGÍAS USADAS =================
        createHeading1("3. Tecnologías Usadas y Justificación Técnica"),
        createParagraph(
          "El stack de NovaCita fue seleccionado para dar respuesta a dos grandes vectores de fallo en sistemas de agendamiento: el conflicto de recursos concurrentes y el tiempo de respuesta bajo carga masiva."
        ),
        createHeading2("3.1 PostgreSQL (Persistencia y Control de Concurrencia)"),
        createParagraph(
          "PostgreSQL no solo actúa como un almacén de datos transaccional ACID, sino que constituye la primera línea de defensa contra reservas duplicadas."
        ),
        createParagraph(
          "• Bloqueos Transaccionales Selectivos (SELECT ... FOR UPDATE): Al intentar reservar una cita, el backend ejecuta una consulta de lectura con bloqueo exclusivo sobre el profesional y la fecha/hora seleccionados. Esto obliga a cualquier otra transacción concurrente que intente acceder al mismo recurso a esperar en cola hasta que la primera finalice (COMMIT o ROLLBACK).",
          { bullet: true }
        ),
        createParagraph(
          "• Restricciones de Exclusión (EXCLUDE USING gist): Mediante el uso de la extensión btree_gist, PostgreSQL valida a nivel de motor que dos registros de cita para el mismo profesional no posean rangos de tiempo solapados, impidiendo físicamente citas duplicadas incluso ante fallas lógicas del backend.",
          { bullet: true }
        ),
        createHeading2("3.2 Node.js (Servicio de API y Backend Asíncrono)"),
        createParagraph(
          "Node.js actúa como el servidor intermedio, respondiendo de forma ágil a peticiones entrantes. Al basarse en un modelo de I/O no bloqueante dirigido por eventos (Event Loop), Node.js es ideal para manejar cientos de conexiones HTTP concurrentes provenientes de clientes que consultan disponibilidad de agenda al mismo tiempo. Esto garantiza tiempos de respuesta inferiores a los 150 ms en consultas intensivas."
        ),
        createHeading2("3.3 pgAdmin 4 (Administración de Datos)"),
        createParagraph(
          "pgAdmin 4 proporciona la consola de administración visual necesaria para depurar el rendimiento. Permite a los arquitectos e ingenieros de QA inspeccionar planes de consulta utilizando EXPLAIN ANALYZE, identificar la necesidad de índices compuestos (como un índice en `empleado_id` y `fecha` para la agenda) y verificar si existen bloqueos de hilos colgados en base de datos."
        ),

        new PageBreak(),

        // ================= SECCIÓN 4: PRUEBAS EN BASE DE DATOS =================
        createHeading1("4. Pruebas de Calidad (QA) en la Base de Datos"),
        createParagraph(
          "La calidad del sistema no depende de verificaciones manuales. Se ha establecido una metodología rigurosa para garantizar la robustez lógica y transaccional del modelo de base de datos."
        ),
        createHeading2("4.1 Pruebas de Concurrencia (Doble Reserva Simultánea)"),
        createParagraph(
          "Estas pruebas simulan que dos usuarios diferentes hacen clic en el botón de reservar exactamente al mismo milisegundo para el mismo bloque horario y profesional. Se implementaron scripts en Node.js que ejecutan promesas paralelas (`Promise.all`) simulando este escenario de estrés."
        ),
        createParagraph(
          "El sistema utiliza aislamiento de transacciones de tipo REPEATABLE READ o bloqueos pesimistas para rechazar una de las operaciones."
        ),
        createParagraph("A continuación, se detalla el código de prueba de concurrencia y validación implementado en el backend de pruebas QA:"),
        createCodeBlock(`// Caso de prueba QA: Reserva Concurrente Simulada
async function testConcurrentBooking() {
  const appointmentData = {
    empleado_id: "emp-uuid-101",
    fecha: "2026-06-15",
    hora: "10:00",
    duracion: 30,
    cliente_nombre: "Simulado QA"
  };

  console.log("Iniciando peticiones simultaneas...");
  
  // Ejecutamos dos inserciones al mismo tiempo
  const results = await Promise.allSettled([
    bookAppointment(appointmentData, "Cliente A"),
    bookAppointment(appointmentData, "Cliente B")
  ]);

  // Evaluamos resultados esperados
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failureCount = results.filter(r => r.status === 'rejected').length;

  console.log(\`Resultados -> Exitosos: \${successCount}, Fallidos: \${failureCount}\`);
  
  // Aseveración (Assertion) de QA: Solo 1 debe tener éxito, el otro debe ser rechazado por colisión
  if (successCount === 1 && failureCount === 1) {
    console.log("PRUEBA DE CONCURRENCIA: APROBADA");
  } else {
    console.error("PRUEBA DE CONCURRENCIA: FALLIDA (Posible reserva duplicada)");
  }
}`),
        createHeading2("4.2 Pruebas de Integridad de Horarios y Fechas"),
        createParagraph(
          "Estas pruebas evitan inconsistencias lógicas en los datos ingresados al sistema. Para ello, se definieron restricciones CHECK a nivel de tabla e interceptores en la capa de servicios de Node.js."
        ),
        createParagraph(
          "• Validación de Fechas Invertidas: Evita registrar citas cuya hora de finalización sea menor o igual a la hora de inicio, o citas con fechas en el pasado."
        ),
        createParagraph(
          "• Validación de Horario Laboral: Asegura que el rango horario seleccionado caiga estrictamente dentro de los cuadrantes declarados para el profesional (ej. de 08:00 a 17:00), rechazando reservas en fines de semana no laborables o días feriados."
        ),
        createParagraph("Ejemplo de trigger en PostgreSQL para validar integridad horaria:"),
        createCodeBlock(`CREATE OR REPLACE FUNCTION fn_validar_integridad_horaria()
RETURNS TRIGGER AS $$
DECLARE
  horario_valido BOOLEAN;
BEGIN
  -- 1. Validar que la fecha no sea en el pasado
  IF NEW.fecha < CURRENT_DATE THEN
    RAISE EXCEPTION 'No se pueden registrar citas en fechas pasadas.';
  END IF;

  -- 2. Validar que la hora tenga un formato coherente (HH:MM entre 00:00 y 23:59)
  IF NOT NEW.hora ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Formato de hora invalido.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_validar_cita_integridad
BEFORE INSERT OR UPDATE ON "Cita"
FOR EACH ROW
EXECUTE FUNCTION fn_validar_integridad_horaria();`),

        new PageBreak(),

        // ================= SECCIÓN 5: PRINCIPIOS SOLID =================
        createHeading1("5. Aplicación de Principios SOLID en la Arquitectura"),
        createParagraph(
          "Para garantizar la mantenibilidad y modularidad del código de NovaCita, se aplicaron de forma rigurosa los 5 principios de diseño de software SOLID."
        ),
        createHeading2("5.1 SRP - Single Responsibility Principle (Responsabilidad Única)"),
        createParagraph(
          "Cada clase o módulo debe tener una sola razón de cambio. En NovaCita, evitamos la existencia de controladores masivos."
        ),
        createParagraph(
          "Por ejemplo, la clase `AppointmentValidationService` se encarga exclusivamente de verificar que la fecha y hora de la cita estén libres y dentro del horario laboral. La lógica para enviar correos de confirmación reside de forma separada en `NotificationService`. Si se decide cambiar el formato de los correos, solo se modifica `NotificationService` y no la lógica de negocio de validación.",
          { italic: true }
        ),
        createHeading2("5.2 OCP - Open/Closed Principle (Abierto/Cerrado)"),
        createParagraph(
          "Las clases deben estar abiertas para la extensión pero cerradas para la modificación."
        ),
        createParagraph(
          "En el sistema de notificaciones, se definió una interfaz abstracta `INotificationSender`. Para dar soporte a nuevos canales de comunicación (como Email, SMS, WhatsApp o notificaciones push), simplemente se añade una nueva clase (ej. `WhatsAppNotificationSender`) que implemente la interfaz, sin alterar el flujo de reserva de la cita.",
          { italic: true }
        ),
        createHeading2("5.3 LSP - Liskov Substitution Principle (Sustitución de Liskov)"),
        createParagraph(
          "Los subtipos de una clase deben poder sustituir a la clase base sin romper el comportamiento esperado."
        ),
        createParagraph(
          "Definimos una clase base `Usuario` de la cual heredan `Cliente` y `Empleado`. Ambos subtipos conservan el contrato base (obtener credenciales, roles y datos de perfil). Cualquier servicio de autenticación puede recibir un objeto de tipo `Usuario` y realizar la validación de acceso de forma agnóstica al rol específico.",
          { italic: true }
        ),
        createHeading2("5.4 ISP - Interface Segregation Principle (Segregación de Interfaces)"),
        createParagraph(
          "Los clientes no deben ser obligados a depender de interfaces que no utilicen."
        ),
        createParagraph(
          "En lugar de crear una gran interfaz de base de datos con todos los métodos CRUD para todas las tablas, se definieron interfaces segregadas específicas: `IAppointmentReader` (solo lecturas de agenda) e `IAppointmentWriter` (escrituras de citas). Así, el dashboard del cliente (que solo requiere lecturas) no depende de métodos administrativos de escritura ni de reindexación.",
          { italic: true }
        ),
        createHeading2("5.5 DIP - Dependency Inversion Principle (Inversión de Dependencias)"),
        createParagraph(
          "Los módulos de alto nivel no deben depender de módulos de bajo nivel, sino de abstracciones."
        ),
        createParagraph(
          "La clase controladora `AppointmentController` no instancia de forma directa el cliente de base de datos `PrismaClient` ni llama directamente a la base de datos PostgreSQL. En su lugar, depende de la abstracción `IAppointmentRepository`. De este modo, la lógica de negocio está totalmente aislada del motor de base de datos físico, facilitando pruebas unitarias mediante mocks o la migración futura a otro ORM.",
          { italic: true }
        ),
        
        createParagraph("\nFin del reporte de arquitectura e ingeniería de software.", { alignment: AlignmentType.CENTER, italic: true, color: MUTED_COLOR })
      ]
    }
  ]
});

// Write to file
Packer.toBuffer(doc).then((buffer) => {
  const outputPath = path.join(__dirname, "..", "Documentacion_Tecnica_NovaCita.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log(`[EXITO] Documento Word generado exitosamente en: ${outputPath}`);
}).catch(err => {
  console.error("Error al generar el documento Word NovaCita:", err);
});
