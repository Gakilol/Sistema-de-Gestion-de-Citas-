# NovaCita: Documentación Técnica y Funcional del Sistema de Gestión de Citas

Este documento constituye la especificación de diseño, arquitectura, manual de operación e ingeniería de software para **NovaCita**, una plataforma robusta y escalable diseñada para centralizar el agendamiento de citas, prevenir conflictos de concurrencia en la asignación de turnos y garantizar la mantenibilidad mediante buenas prácticas de desarrollo.

---

## 1. Introducción y Evolución del Proyecto

### 1.1 Origen del Problema y Necesidad de Centralización
La descoordinación en el agendamiento de citas representa uno de los mayores sumideros de eficiencia operativa y reputación de marca para las organizaciones orientadas al servicio. La superposición de horarios, el registro de citas en papel o sistemas aislados y la falta de visibilidad en tiempo real de la capacidad laboral del personal conducen a la insatisfacción del cliente y al desgaste del personal. 

NovaCita surge de la necesidad imperativa de centralizar, automatizar y blindar la asignación de turnos frente a conflictos lógicos y de concurrencia. El proyecto nació a partir de un diagnóstico de fallas de calendarización en entornos de atención médica y servicios profesionales. Los conflictos detectados incluían citas dobles asignadas al mismo profesional a la misma hora, diferencias horarias no computadas entre el servidor en la nube y la zona horaria del local de atención, y cancelaciones imprevistas sin actualización JIT de la disponibilidad.

La centralización de agendas bajo NovaCita proporciona una única fuente de verdad transaccional. Cualquier consulta de disponibilidad o inserción de citas evalúa síncronamente los cuadrantes laborales del personal, descansos diarios (p. ej., almuerzo), bloqueos temporales e incluso periodos de vacaciones activos, garantizando un agendamiento limpio y sin fricciones.

### 1.2 Evolución de la Arquitectura de Software
La evolución del sistema se ejecutó en base a tres grandes hitos de ingeniería:

1. **Fase 1 (Calendario Básico):** Monolito sencillo con almacenamiento basado en archivos planos. La validación se realizaba únicamente en la capa cliente (frontend), permitiendo que la concurrencia a nivel de API rompiera las restricciones horarias al realizar reservas masivas.
2. **Fase 2 (Migración Transaccional y Blindaje de Base de Datos):** Se incorporó un motor de persistencia relacional con PostgreSQL. Se implementó una lógica transaccional estricta y se trasladaron las restricciones de disponibilidad y de tiempo a nivel de base de datos, apoyándose en restricciones CHECK y claves únicas.
3. **Fase 3 (Control de Calidad Integrado y Trazabilidad):** Introducción de protocolos de control de calidad (QA). Se definieron suites de pruebas específicas para concurrencia y validación temporal de horarios. Asimismo, se implementó una Matriz de Trazabilidad de Requisitos (RTM) en formato Excel, mapeando cada requerimiento de negocio (ej. 'Evitar reservas duplicadas') a su correspondiente caso de prueba en backend y base de datos.

> [!NOTE]
> **QA y la Matriz de Trazabilidad de Requisitos (RTM)**
> La RTM actúa como el contrato de calidad del proyecto. Permite asegurar cobertura total de pruebas lógicas, vinculando cada requisito de negocio con pruebas unitarias, de integración en API y de concurrencia a nivel de motor SQL. Ningún código se despliega a producción si no pasa las verificaciones asociadas de la matriz.

---

## 2. Manual de Usuario del Sistema NovaCita

El sistema cuenta con interfaces adaptadas y segregadas lógicamente para ofrecer una experiencia fluida según el perfil del usuario: Clientes/Pacientes y Personal/Administradores.

### 2.1 Perfil de Clientes / Pacientes
Los usuarios que desean agendar un turno tienen acceso a un flujo simplificado paso a paso:
1. **Búsqueda de Disponibilidad:** El usuario ingresa a la sección de agendamiento (`/cliente/book`), selecciona el servicio del catálogo y escoge al profesional de su preferencia. El sistema renderiza un calendario interactivo que muestra únicamente los días y bloques horarios disponibles en tiempo real.
2. **Creación del Registro de Cita:** Al seleccionar una hora libre, el sistema reserva temporalmente el bloque en caché de sesión para evitar colisiones rápidas. El usuario confirma sus datos de contacto y presiona *Confirmar Reserva*. La cita se almacena con estado `PENDIENTE` o `CONFIRMADA` en base a las reglas del negocio.
3. **Reprogramación de Cita:** En su Dashboard personal, el cliente puede seleccionar una cita futura y pulsar *Reprogramar*. Se desplegarán los nuevos bloques horarios disponibles para el profesional seleccionado. Al guardar, se actualiza el registro con validación síncrona en base de datos para prevenir superposiciones.
4. **Cancelación de Cita:** El usuario puede dar de baja una cita futura con un solo clic. El estado cambia inmediatamente a `CANCELADA`, liberando el bloque horario para otros usuarios en tiempo real.

### 2.2 Perfil de Personal / Administradores
Los administradores y recepcionistas disponen de un panel avanzado para el control operacional:
- **Control de Disponibilidad del Equipo:** Permite definir para cada empleado el horario de entrada, salida y pausas recurrentes (como almuerzo). Estos datos se modelan y almacenan en formato JSONB o tablas relacionales de horarios de empleados.
- **Visualización de la Agenda General:** Un calendario global e interactivo (vista diaria, semanal y mensual) que permite a los recepcionistas agendar citas directas de mostrador, reprogramarlas mediante drag-and-drop y filtrar citas por profesional o estado.
- **Administración de Usuarios:** Permite crear cuentas de personal, asignar roles (`ADMIN`, `EMPLEADO`), modificar permisos operativos y desactivar cuentas de empleados inactivos.

---

## 3. Tecnologías Usadas y Justificación Técnica

El stack de NovaCita fue seleccionado para dar respuesta a dos grandes vectores de fallo en sistemas de agendamiento: el conflicto de recursos concurrentes y el tiempo de respuesta bajo carga masiva.

### 3.1 PostgreSQL (Persistencia y Control de Concurrencia)
PostgreSQL no solo actúa como un almacén de datos transaccional ACID, sino que constituye la primera línea de defensa contra reservas duplicadas.
- **Bloqueos Transaccionales Selectivos (`SELECT ... FOR UPDATE`):** Al intentar reservar una cita, el backend ejecuta una consulta de lectura con bloqueo exclusivo sobre el profesional y la fecha/hora seleccionados. Esto obliga a cualquier otra transacción concurrente que intente acceder al mismo recurso a esperar en cola hasta que la primera finalice (`COMMIT` o `ROLLBACK`).
- **Restricciones de Exclusión (`EXCLUDE USING gist`):** Mediante el uso de la extensión `btree_gist`, PostgreSQL valida a nivel de motor que dos registros de cita para el mismo profesional no posean rangos de tiempo solapados, impidiendo físicamente citas duplicadas incluso ante fallas lógicas del backend.

### 3.2 Node.js (Servicio de API y Backend Asíncrono)
Node.js actúa como el servidor intermedio, respondiendo de forma ágil a peticiones entrantes. Al basarse en un modelo de I/O no bloqueante dirigido por eventos (Event Loop), Node.js es ideal para manejar cientos de conexiones HTTP concurrentes provenientes de clientes que consultan disponibilidad de agenda al mismo tiempo. Esto garantiza tiempos de respuesta inferiores a los 150 ms en consultas intensivas.

### 3.3 pgAdmin 4 (Administración de Datos)
pgAdmin 4 proporciona la consola de administración visual necesaria para depurar el rendimiento. Permite a los arquitectos e ingenieros de QA inspeccionar planes de consulta utilizando `EXPLAIN ANALYZE`, identificar la necesidad de índices compuestos (como un índice en `empleado_id` y `fecha` para la agenda) y verificar si existen bloqueos de hilos colgados en base de datos.

---

## 4. Pruebas de Calidad (QA) en la Base de Datos

La calidad del sistema no depende de verificaciones manuales. Se ha establecido una metodología rigurosa para garantizar la robustez lógica y transaccional del modelo de base de datos.

### 4.1 Pruebas de Concurrencia (Doble Reserva Simultánea)
Estas pruebas simulan que dos usuarios diferentes hacen clic en el botón de reservar exactamente al mismo milisegundo para el mismo bloque horario y profesional. Se implementaron scripts en Node.js que ejecutan promesas paralelas (`Promise.all`) simulando este escenario de estrés.

El sistema utiliza aislamiento de transacciones de tipo `REPEATABLE READ` o bloqueos pesimistas para rechazar una de las operaciones.

```javascript
// Caso de prueba QA: Reserva Concurrente Simulada
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

  console.log(`Resultados -> Exitosos: ${successCount}, Fallidos: ${failureCount}`);
  
  // Aseveración (Assertion) de QA: Solo 1 debe tener éxito, el otro debe ser rechazado por colisión
  if (successCount === 1 && failureCount === 1) {
    console.log("PRUEBA DE CONCURRENCIA: APROBADA");
  } else {
    console.error("PRUEBA DE CONCURRENCIA: FALLIDA (Posible reserva duplicada)");
  }
}
```

### 4.2 Pruebas de Integridad de Horarios y Fechas
Estas pruebas evitan inconsistencias lógicas en los datos ingresados al sistema. Para ello, se definieron restricciones CHECK a nivel de tabla e interceptores en la capa de servicios de Node.js.
- **Validación de Fechas Invertidas:** Evita registrar citas cuya hora de finalización sea menor o igual a la hora de inicio, o citas con fechas en el pasado.
- **Validación de Horario Laboral:** Asegura que el rango horario seleccionado caiga estrictamente dentro de los cuadrantes declarados para el profesional (ej. de 08:00 a 17:00), rechazando reservas en fines de semana no laborables o días feriados.

```sql
-- Ejemplo de trigger en PostgreSQL para validar integridad horaria
CREATE OR REPLACE FUNCTION fn_validar_integridad_horaria()
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
EXECUTE FUNCTION fn_validar_integridad_horaria();
```

---

## 5. Aplicación de Principios SOLID en la Arquitectura

Para garantizar la mantenibilidad y modularidad del código de NovaCita, se aplicaron de forma rigurosa los 5 principios de diseño de software SOLID.

### 5.1 SRP - Single Responsibility Principle (Responsabilidad Única)
> *Cada clase o módulo debe tener una sola razón de cambio.*

En NovaCita, evitamos la existencia de controladores masivos. Por ejemplo, la clase `AppointmentValidationService` se encarga exclusivamente de verificar que la fecha y hora de la cita estén libres y dentro del horario laboral. La lógica para enviar correos de confirmación reside de forma separada en `NotificationService`. Si se decide cambiar el formato de los correos, solo se modifica `NotificationService` y no la lógica de negocio de validación.

### 5.2 OCP - Open/Closed Principle (Principio de Abierto/Cerrado)
> *Las entidades de software deben estar abiertas para su extensión, pero cerradas para su modificación.*

En el sistema de notificaciones, se definió una interfaz abstracta `INotificationSender`. Para dar soporte a nuevos canales de comunicación (como Email, SMS, WhatsApp o notificaciones push), simplemente se añade una nueva clase (ej. `WhatsAppNotificationSender`) que implemente la interfaz, sin alterar el flujo de reserva de la cita.

### 5.3 LSP - Liskov Substitution Principle (Principio de Sustitución de Liskov)
> *Los objetos de una superclase deben poder ser reemplazados por objetos de sus subclases sin alterar la corrección del programa.*

Definimos una clase base `Usuario` de la cual heredan `Cliente` y `Empleado`. Ambos subtipos conservan el contrato base (obtener credenciales, roles y datos de perfil). Cualquier servicio de autenticación puede recibir un objeto de tipo `Usuario` y realizar la validación de acceso de forma agnóstica al rol específico.

### 5.4 ISP - Interface Segregation Principle (Principio de Segregación de Interfaces)
> *Los clientes no deben ser obligados a depender de interfaces que no utilizan.*

En lugar de crear una gran interfaz de base de datos con todos los métodos CRUD para todas las tablas, se definieron interfaces segregadas específicas: `IAppointmentReader` (solo lecturas de agenda) e `IAppointmentWriter` (escrituras de citas). Así, el dashboard del cliente (que solo requiere lecturas) no depende de métodos administrativos de escritura ni de reindexación.

### 5.5 DIP - Dependency Inversion Principle (Principio de Inversión de Dependencias)
> *Los módulos de alto nivel no deben depender de módulos de bajo nivel, sino de abstracciones.*

La clase controladora `AppointmentController` no instancia de forma directa el cliente de base de datos `PrismaClient` ni llama directamente a la base de datos PostgreSQL. En su lugar, depende de la abstracción `IAppointmentRepository`. De este modo, la lógica de negocio está totalmente aislada del motor de base de datos físico, facilitando pruebas unitarias mediante mocks o la migración futura a otro ORM.
