const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { assertNotProductionScript, assertCanWriteToDatabase } = require('./scripts/env-guard');

const prisma = new PrismaClient();

async function main() {
  assertNotProductionScript();
  assertCanWriteToDatabase();
  console.log('Sembrando base de datos con Admin por defecto...');

  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.empleado.upsert({
    where: { correo: 'admin@sistema.com' },
    update: {},
    create: {
      nombre: 'Administrador Principal',
      correo: 'admin@sistema.com',
      passwordHash,
      rol: 'ADMIN',
      telefono: '000000000',
    },
  });

  console.log('Admin creado exitosamente:', admin.correo);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
