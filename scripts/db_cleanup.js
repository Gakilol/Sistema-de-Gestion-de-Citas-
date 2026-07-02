const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Actualizando empleados con rol TECH_SUPPORT...');
  const result = await prisma.empleado.updateMany({
    where: { rol: 'TECH_SUPPORT' },
    data: { esAgendable: false },
  });
  console.log(`Se actualizaron ${result.count} empleados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
