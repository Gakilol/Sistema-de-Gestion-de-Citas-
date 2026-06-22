# Guía de Gestión y Despliegue de Base de Datos - NovaCita

Esta guía explica el diseño físico y el aprovisionamiento de la base de datos PostgreSQL/NeonDB para el sistema **NovaCita**, utilizando tanto el script SQL unificado como Prisma ORM.

---

## 1. Archivos Disponibles en `/database`

- **[`novacita_complete_schema.sql`](file:///c:/Users/Gaki/Documents/Sistema%20de%20Gestion%20de%20Citas/database/novacita_complete_schema.sql)**: Script SQL completo, ordenado e idempotente para inicializar la base de datos de forma directa en PostgreSQL o NeonDB. Contiene enums, tablas, índices de optimización, triggers para marcas de tiempo y el sembrado (seed) básico con el usuario Administrador y la configuración por defecto.
- **[`README_DATABASE.md`](file:///c:/Users/Gaki/Documents/Sistema%20de%20Gestion%20de%20Citas/database/README_DATABASE.md)**: Este archivo de documentación técnica.

---

## 2. Aprovisionamiento por Script SQL (PostgreSQL Directo / NeonDB Console)

Si requieres inicializar la base de datos en un entorno local o de desarrollo sin pasar por las herramientas CLI de Prisma, puedes ejecutar el script directamente:

### Mediante psql (Consola CLI)
```bash
psql -h <HOST_NEON> -U <USUARIO> -d <BASE_DE_DATOS> -f database/novacita_complete_schema.sql
```

### Mediante Interfaz Web (Neon SQL Editor / pgAdmin)
1. Abre el editor SQL de NeonDB en la consola de administración.
2. Copia y pega el contenido completo de [`novacita_complete_schema.sql`](file:///c:/Users/Gaki/Documents/Sistema%20de%20Gestion%20de%20Citas/database/novacita_complete_schema.sql).
3. Ejecuta el script. Al final, se listará la estructura completa de las tablas creadas.

---

## 3. Despliegue con Prisma ORM (Flujo Recomendado en Producción/Vercel)

El proyecto utiliza Prisma ORM para mapear los modelos definidos en `prisma/schema.prisma` a la base de datos.

### 3.1 Generación local de cliente Prisma
Cada vez que realices cambios en el archivo `schema.prisma`, debes compilar el cliente local en `node_modules` ejecutando:
```bash
npx prisma generate
```

### 3.2 Crear y Aplicar Migraciones en Desarrollo
En entornos locales de desarrollo, para sincronizar cambios de forma controlada y generar los archivos históricos de migración SQL, ejecuta:
```bash
npx prisma migrate dev --name <descripcion_del_cambio>
```
*Esto generará automáticamente una carpeta en `/prisma/migrations` con el script diferencial e incrementará la tabla interna `_prisma_migrations`.*

### 3.3 Despliegue Seguro en Producción (NeonDB / Vercel CI/CD)
**NUNCA** ejecutes `prisma migrate dev` en producción. Para aplicar las migraciones acumuladas y confirmadas en el repositorio sin alterar los datos existentes:
```bash
npx prisma migrate deploy
```
*Este comando se ejecuta automáticamente en el pipeline de construcción de Vercel gracias a los scripts definidos en `package.json`.*

### 3.4 Sembrado (Seed) de Datos de Prueba
Para insertar el administrador inicial (`admin@sistema.com`) y el registro de configuración básico, ejecuta:
```bash
npm run db:seed
```
O de forma directa mediante la CLI de Prisma:
```bash
npx prisma db seed
```

---

## 4. Verificación de Tablas y Auditoría

Para corroborar que las tablas críticas se crearon y están indexadas correctamente, puedes ejecutar las siguientes consultas SQL:

### Verificar todas las tablas activas
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Verificar los índices en la tabla de Auditoría (`AuditLog`)
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'AuditLog';
```
