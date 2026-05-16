const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.usuario.findMany();
  console.log('Usuarios en la base de datos:', users.length);
  users.forEach(u => console.log(`- ${u.email} (rol: ${u.rol}, activo: ${u.activo})`));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
