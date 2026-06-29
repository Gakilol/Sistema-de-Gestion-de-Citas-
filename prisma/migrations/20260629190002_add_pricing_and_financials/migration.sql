-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('EMPLEADO', 'ADMIN', 'TECH_SUPPORT');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA', 'NO_SHOW', 'REPROGRAMADA');

-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT,
    "passwordHash" TEXT NOT NULL,
    "especialidad" TEXT,
    "horario" JSONB,
    "rol" "RolUsuario" NOT NULL DEFAULT 'EMPLEADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servicio" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "duracion" INTEGER NOT NULL,
    "categoria" TEXT,
    "categoria_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "precio" DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "notas" TEXT,
    "monto" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "no_show_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "whatsapp_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_reminder_sent_at" TIMESTAMP(3),

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DescansoEmpleado" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleado_id" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,

    CONSTRAINT "DescansoEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloqueoHorario" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleado_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "BloqueoHorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacacionesEmpleado" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleado_id" TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'APROBADO',

    CONSTRAINT "VacacionesEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "negocio" JSONB,
    "horarios" JSONB,
    "whatsapp" JSONB,
    "apariencia" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalles" JSONB,
    "realizadoPor" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "action" TEXT,
    "module" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "entityName" TEXT,
    "description" TEXT,
    "status" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "color" TEXT DEFAULT '#6366f1',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitaServicio" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "cita_id" TEXT NOT NULL,
    "servicio_id" TEXT NOT NULL,
    "duracion" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "precio" DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "CitaServicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_ip" TEXT,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_correo_key" ON "Empleado"("correo");

-- CreateIndex
CREATE INDEX "Cita_empleado_id_idx" ON "Cita"("empleado_id");

-- CreateIndex
CREATE INDEX "Cita_estado_idx" ON "Cita"("estado");

-- CreateIndex
CREATE INDEX "Cita_fecha_idx" ON "Cita"("fecha");

-- CreateIndex
CREATE INDEX "Cita_cliente_id_idx" ON "Cita"("cliente_id");

-- CreateIndex
CREATE INDEX "Cita_servicio_id_idx" ON "Cita"("servicio_id");

-- CreateIndex
CREATE INDEX "Cita_created_at_idx" ON "Cita"("created_at");

-- CreateIndex
CREATE INDEX "Cita_cancelled_at_idx" ON "Cita"("cancelled_at");

-- CreateIndex
CREATE INDEX "Cita_completed_at_idx" ON "Cita"("completed_at");

-- CreateIndex
CREATE INDEX "Cita_whatsapp_reminder_sent_fecha_estado_idx" ON "Cita"("whatsapp_reminder_sent", "fecha", "estado");

-- CreateIndex
CREATE INDEX "DescansoEmpleado_empleado_id_idx" ON "DescansoEmpleado"("empleado_id");

-- CreateIndex
CREATE INDEX "BloqueoHorario_empleado_id_fecha_idx" ON "BloqueoHorario"("empleado_id", "fecha");

-- CreateIndex
CREATE INDEX "VacacionesEmpleado_empleado_id_idx" ON "VacacionesEmpleado"("empleado_id");

-- CreateIndex
CREATE INDEX "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "AuditLog_fecha_idx" ON "AuditLog"("fecha");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_status_idx" ON "AuditLog"("status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE INDEX "CitaServicio_cita_id_idx" ON "CitaServicio"("cita_id");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_hash_key" ON "PasswordResetToken"("token_hash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_user_id_idx" ON "PasswordResetToken"("user_id");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_hash_idx" ON "PasswordResetToken"("token_hash");

-- AddForeignKey
ALTER TABLE "Servicio" ADD CONSTRAINT "Servicio_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DescansoEmpleado" ADD CONSTRAINT "DescansoEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueoHorario" ADD CONSTRAINT "BloqueoHorario_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacacionesEmpleado" ADD CONSTRAINT "VacacionesEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaServicio" ADD CONSTRAINT "CitaServicio_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "Cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaServicio" ADD CONSTRAINT "CitaServicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
