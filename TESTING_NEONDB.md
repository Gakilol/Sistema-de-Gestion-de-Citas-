# Checklist de Pruebas Manuales Guiadas en Staging (NeonDB)

Utilice esta checklist para guiar e identificar los resultados de las pruebas manuales ejecutadas sobre el entorno de staging (`qa-novacita`).

---

## Módulo Citas

- [ ] **Prueba:** Crear cita desde el botón "Nueva Cita".
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Crear cita tocando una hora directamente en el calendario.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Editar la duración de una cita existente.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Cambiar/seleccionar varios servicios para una misma cita.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Cancelar una cita.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Agendar una cita dentro del rango de hora de otra cita (traslape/overbooking si existe la regla).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Validar la visualización correcta de la fecha y la hora en formato AM-PM.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Validar regla de fin de día (ej. si después de las 6:30 PM el calendario se desplaza al día siguiente, si aplica).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Agendar una cita en una hora que ya ha pasado en el día de hoy (validar reglas de negocio).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

---

## Módulo Calendario

- [ ] **Prueba:** Vista "Día".
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Vista "3 Días".
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Vista "Semana".
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Botón / sección "Ver mi agenda".
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Botón / sección "Ver agenda de todos".
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Orden de profesionales en calendario: Álvaro, Vannesa, Daniel, Charlie (y otros después).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Soporte Técnico no aparece listado como profesional agendable.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

---

## Módulo Roles

- [ ] **Prueba:** Administrador (Admin) puede ver y gestionar todo en el sistema.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Soporte Técnico puede ver todo el sistema pero no aparece como profesional agendable.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Empleado solo ve los módulos permitidos por su rol.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Empleado no puede agendar una cita para otro profesional si no tiene el permiso explícito.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Empleado no puede ver los datos privados de clientes ajenos o no asignados (si aplica restricción).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** El backend bloquea acciones no permitidas según el rol (seguridad a nivel de API, no solo UI).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

---

## Módulo Clientes

- [ ] **Prueba:** Crear un nuevo cliente desde la ventana de reserva de cita.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Buscar cliente por nombre o teléfono en la barra de búsqueda.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Editar datos de un cliente (nombre, teléfono, notas).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Validar que los datos de contacto estén debidamente protegidos según el rol del usuario logueado.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

---

## Módulo Servicios

- [ ] **Prueba:** Crear un nuevo servicio.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Editar un servicio (marcar como inactivo, cambiar precio/duración).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Validar la suma automática de la duración y el precio total cuando se eligen múltiples servicios en una cita.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Validar la asignación de categorías para los servicios.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

---

## Interfaz de Usuario (UI)

- [ ] **Prueba:** Alternar entre Modo Claro y Modo Oscuro.
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Responsive móvil (visualización de sidebar, calendario y modales en pantallas pequeñas).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Funcionamiento del Sidebar (expandir y colapsar).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

---

## Seguridad

- [ ] **Prueba:** Iniciar sesión (Login).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Cerrar sesión (Logout).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Recordar sesión ("Recordar dispositivo" o sesión persistente al refrescar).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Middleware de rutas protegidas (intentar acceder a `/dashboard` o `/configuracion` sin loguearse).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 

- [ ] **Prueba:** Rate limit de login (bloqueo por múltiples intentos fallidos si aplica).
  * **Resultado:** 
  * **Evidencia:** 
  * **Error encontrado:** 
  * **Captura:** 
  * **Prioridad:** 
