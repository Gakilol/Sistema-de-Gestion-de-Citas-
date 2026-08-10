require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorios para ejecutar el seed.');
  }

  if (adminPassword.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.empleado.upsert({
    where: { correo: adminEmail },
    update: {},
    create: {
      nombre: 'Administrador Principal',
      correo: adminEmail,
      passwordHash,
      rol: 'ADMIN',
    },
  });

  console.log('Administrador inicial creado correctamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
