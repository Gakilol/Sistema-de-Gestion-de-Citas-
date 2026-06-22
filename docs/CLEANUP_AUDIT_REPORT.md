# Reporte de Auditoría de Limpieza Técnica (Cleanup Audit Report)
**Proyecto:** NovaCita
**Fecha:** 2026-06-22
**Estado del Repositorio:** Desplegado en Vercel, con Prisma y NeonDB (PostgreSQL)

---

## 1. Archivos Detectados como No Utilizados (Seguro Eliminar)

Los siguientes archivos se han identificado como obsoletos, huérfanos o sin referencias activas en el código de producción. Su eliminación es segura y no afecta la funcionalidad del sistema ni su despliegue en Vercel.

| Archivo / Ruta | Descripción | Estado / Recomendación | Riesgo de Eliminación |
| :--- | :--- | :--- | :--- |
| `check_users.js` (Raíz) | Script de prueba que lista usuarios. Intenta acceder al campo `email` en lugar de `correo` (que es el campo real del modelo `Empleado`), por lo que arroja errores en ejecución. | **Seguro Eliminar** | Nulo |
| `update_admin.js` (Raíz) | Script de prueba para actualizar contraseñas. Intenta hacer uso de `prisma.usuario` que no existe en el esquema (el modelo real es `Empleado`). | **Seguro Eliminar** | Nulo |
| `test_hash.js` (Raíz) | Script de prueba local de hash de BCrypt con contraseña fija. No tiene referencias de uso en producción ni de desarrollo. | **Seguro Eliminar** | Nulo |
| `components/theme-provider.tsx` | Envoltura redundante para `next-themes`. El layout principal (`app/layout.tsx`) importa `ThemeProvider` directamente desde la dependencia de npm `next-themes`, haciendo este archivo inútil. | **Seguro Eliminar** | Nulo |
| `app/api/auditorias/route.ts` | Endpoint de la API antigua (plural) que fue reemplazado en la actualización anterior por el módulo avanzado de auditoría centralizado en `/api/auditoria` (singular). | **Seguro Eliminar** | Nulo |

---

## 2. Archivos SQL Fragmentados y Duplicados (Consolidar y Eliminar)

El proyecto contiene múltiples archivos SQL independientes que representan parches lógicos o históricos de la base de datos aplicados en distintos momentos del desarrollo. Todos estos archivos serán consolidados en un único script de esquema limpio (`database/novacita_complete_schema.sql`).

| Archivo SQL | Descripción | Recomendación |
| :--- | :--- | :--- |
| `migration_add_notas_to_cliente.sql` | Fragmento SQL para añadir campo `notas` a `Cliente`. | **Consolidar y Eliminar** |
| `migration_multiservicios_duplicados.sql` | Fragmento SQL para corregir datos duplicados en citas. | **Consolidar y Eliminar** |
| `migration_neondb.sql` | Inicializador primario del esquema en NeonDB. | **Consolidar y Eliminar** |
| `migration_v2.sql` | Script de actualización a la versión 2. | **Consolidar y Eliminar** |
| `migration_v3_soporte_tecnico.sql` | Fragmento para soporte de usuarios de soporte técnico. | **Consolidar y Eliminar** |
| `migration_v4_auditoria.sql` | Fragmento para adición de campos de auditoría. | **Consolidar y Eliminar** |
| `neon_migration.sql` | Fragmento con inicializadores y esquemas para Neon. | **Consolidar y Eliminar** |
| `prisma_password_reset_migration.sql` | Fragmento para recuperación de contraseñas. | **Consolidar y Eliminar** |
| `prisma/neon_init.sql` | Script SQL histórico basado en modelos obsoletos (`Usuario`, `PerfilCliente`, etc.) que ya no se corresponden con `schema.prisma`. Genera confusión sobre el estado actual de la base de datos. | **Consolidar y Eliminar** |
| `prisma/migration_analytics.sql` | Fragmento con campos de análisis y métricas. | **Consolidar y Eliminar** |
| `prisma/migration_whatsapp_reminders.sql` | Fragmento para recordatorios de WhatsApp. | **Consolidar y Eliminar** |

> [!WARNING]
> **Referencia a `migration_analytics.sql`**
> Existe una cadena de texto informativa en `app/api/reportes/cancelaciones/route.ts` que menciona: *"Si cancelled_at es NULL... Aplique la migración migration_analytics.sql"*. Este texto se actualizará para indicar que debe aplicarse el script consolidated único de base de datos o correr las migraciones de Prisma.

---

## 3. Dependencias en `package.json`

Se auditó el árbol de dependencias del proyecto. No se encontraron librerías instaladas redundantes u obsoletas que pongan en riesgo el tamaño del bundle o la compilación.

- **`docx` y `docx-templates` (si existiera)**: Utilizada por los scripts generadores de reportes en la carpeta `scripts/`. Deben conservarse.
- **`tw-animate-css`**: Utilizada directamente en `app/globals.css`. Debe conservarse.
- **`jspdf` y `jspdf-autotable`**: Usados en el frontend para exportar informes de auditoría en PDF sin dependencias nativas del lado del servidor.
- **`jose` y `bcryptjs`**: Core del sistema de autenticación y hashing de contraseñas.
- **`date-fns` y `date-fns-tz`**: Utilidades del motor de control temporal.

### Recomendación de package.json
- **No eliminar dependencias**. Mantenerlas intactas.
- **Actualizar scripts npm**: Estandarizar los comandos para desarrollo (`dev`), compilación (`build`), linter (`lint`), chequeo de tipos (`type-check`), generación de clientes Prisma y ejecución de seeds de base de datos.

---

## 4. Archivos a Mantener Intactos (No Eliminar)

Para asegurar la continuidad operativa y evitar errores en Vercel y NeonDB, **NO** se eliminarán los siguientes elementos:

1. **`node_modules` (mediante Git)**: Ya está ignorado correctamente en `.gitignore`.
2. **`.env`**: Archivo de variables locales (debe protegerse y mantenerse local).
3. **`prisma/schema.prisma`**: Fuente de verdad absoluta para el ORM Prisma.
4. **`middleware.ts`**: Validador perimetral de seguridad y protección de rutas.
5. **`lib/auditoria.ts`**: Aunque tiene código legacy de logging, redirige las solicitudes antiguas al nuevo logger avanzado de forma segura, garantizando la compatibilidad.
6. **Carpeta `public/`**: Contiene iconos y assets estáticos indispensables para el branding del sistema.
7. **`vercel.json`**: Aunque contiene `{}` en la raíz, se mantendrá vacío o configurado mínimamente para no alterar el pipeline de Vercel.

---

## 5. Matriz de Riesgos y Recomendación Final

1. **Riesgo por eliminación de código muerto:** Extremadamente bajo. Los archivos propuestos para eliminación no cuentan con importaciones activas.
2. **Riesgo por consolidación de SQL:** Bajo-Medio. La base de datos actual ya cuenta con estas tablas. Consolidar el esquema en un script único sirve como herramienta de aprovisionamiento de entornos locales y staging desde cero. El script indicará advertencias explícitas de no ejecutarse ciegamente sobre bases de datos en producción.
3. **Riesgo de despliegue en Vercel:** Nulo. Se realizarán validaciones estáticas (`tsc --noEmit` y `next build`) antes de confirmar cualquier limpieza para asegurar compilación exitosa.
