# Inicio de pruebas (Restoration Point)

Este archivo registra el punto de partida y los detalles del entorno antes de iniciar las pruebas seguras en la rama de staging de NeonDB.

* **Fecha de inicio:** 2026-07-10
* **Hora Costa Rica:** 08:08 AM (Zona horaria: UTC-6)
* **Responsable:** Kevin
* **Git branch:** main
* **Commit:** aa6cea9d19202f6dc1947fe92da7a6de83f67cd0
* **Branch Neon:** qa-novacita (rama de staging en NeonDB)
* **DATABASE_URL (parcial):** `postgresql://neondb_owner:***@ep-odd-base-aj140b7z-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
* **TEST_RUN_ID:** `QA_20260710_0830`
* **Objetivo:** Pruebas seguras del sistema de citas, vistas de calendario, gestión de clientes, servicios, seguridad por roles y middleware de acceso.

---

### Integraciones y Efectos Externos
Las siguientes integraciones se han desactivado en el entorno de pruebas para evitar impacto con clientes reales:
* **WhatsApp API:** Desactivada (`DISABLE_WHATSAPP=true`). Los mensajes automáticos se redirigen a la consola del servidor.
* **Envío de correos SMTP:** Desactivado (`DISABLE_EMAILS=true`). Los correos de recuperación se imprimen únicamente en consola.
* **Cron Jobs de Recordatorios:** Desactivado (`DISABLE_REMINDER_JOBS=true`).

---

### Registro de Restauración de NeonDB
Para restaurar el entorno al punto inicial si algo sale mal, siga uno de estos métodos:
1. **Método Principal (Re-crear Rama):**
   * Vaya a la consola de NeonDB.
   * Elimine la rama `qa-novacita`.
   * Cree una nueva rama llamada `qa-novacita` a partir de la rama `main` (producción).
2. **Método Alternativo (Point-in-Time Recovery):**
   * NeonDB permite restaurar una rama a un timestamp específico. Use la marca de tiempo de este log: `2026-07-10 08:08:00 UTC-6`.
