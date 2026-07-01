const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = "49e5b8ab-23e1-4de7-b2e8-f02957f54a40";
  const cs = await prisma.citaServicio.findMany({
    where: { cita_id: id },
    include: { servicio: true }
  });
  console.log(JSON.stringify(cs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
