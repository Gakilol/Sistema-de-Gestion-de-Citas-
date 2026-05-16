const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateAdmin() {
  const hash = await bcrypt.hash('Admin123!', 10);
  console.log('New hash:', hash);
  
  await prisma.usuario.update({
    where: { email: 'admin@sistema.com' },
    data: { passwordHash: hash }
  });
  console.log('Admin password updated successfully');
}

updateAdmin()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
