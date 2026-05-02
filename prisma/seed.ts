import { PrismaClient, RolUsuario } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de la base de datos...');

  // 1. Crear perfil de negocio por defecto
  const negocio = await prisma.perfilNegocio.create({
    data: {
      nombreNegocio: 'Mi Negocio de Citas',
      direccion: 'Calle Principal 123',
      telefono: '+1234567890',
      email: 'contacto@minegocio.com',
      moneda: 'USD',
      zonaHoraria: 'America/Mexico_City',
    },
  });
  console.log(`Negocio creado: ${negocio.nombreNegocio}`);

  // 2. Crear admin por defecto
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@sistema.com' },
    update: {},
    create: {
      nombre: 'Administrador Principal',
      email: 'admin@sistema.com',
      passwordHash: adminPassword,
      telefono: '555-0000',
      rol: RolUsuario.ADMIN,
    },
  });
  console.log(`Admin creado: ${admin.email}`);

  // 3. Crear empleado de demostración
  const empleadoPassword = await bcrypt.hash('Empleado123!', 10);
  const empleadoUser = await prisma.usuario.upsert({
    where: { email: 'empleado@sistema.com' },
    update: {},
    create: {
      nombre: 'Juan Pérez (Profesional)',
      email: 'empleado@sistema.com',
      passwordHash: empleadoPassword,
      telefono: '555-1111',
      rol: RolUsuario.EMPLEADO,
      perfilEmpleado: {
        create: {
          especialidad: 'Cortes y Estilismo',
          colorCalendario: '#4F46E5',
          horarios: {
            create: [
              { diaSemana: 1, horaInicio: '09:00', horaFin: '18:00', disponible: true }, // Lunes
              { diaSemana: 2, horaInicio: '09:00', horaFin: '18:00', disponible: true }, // Martes
              { diaSemana: 3, horaInicio: '09:00', horaFin: '18:00', disponible: true }, // Miércoles
              { diaSemana: 4, horaInicio: '09:00', horaFin: '18:00', disponible: true }, // Jueves
              { diaSemana: 5, horaInicio: '09:00', horaFin: '15:00', disponible: true }, // Viernes
            ],
          },
        },
      },
    },
  });
  console.log(`Empleado demo creado: ${empleadoUser.email}`);

  // 4. Crear servicios de ejemplo
  const servicios = await Promise.all([
    prisma.servicio.create({
      data: {
        nombre: 'Corte Básico',
        descripcion: 'Corte de cabello estándar',
        duracionMinutos: 30,
        precio: 15.0,
      },
    }),
    prisma.servicio.create({
      data: {
        nombre: 'Corte y Lavado',
        descripcion: 'Corte de cabello y lavado profundo',
        duracionMinutos: 45,
        precio: 25.0,
      },
    }),
    prisma.servicio.create({
      data: {
        nombre: 'Tinte Completo',
        descripcion: 'Aplicación de tinte en todo el cabello',
        duracionMinutos: 120,
        precio: 60.0,
      },
    }),
  ]);
  console.log(`Creados ${servicios.length} servicios de ejemplo.`);

  console.log('Seed completado satisfactoriamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
