const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityId: "a901b3e0-ec5f-44e9-9d6d-f5d9b5a499c2" },
        { description: { contains: "Pedicura" } }
      ]
    },
    orderBy: { fecha: 'desc' }
  });
  console.log(JSON.stringify(logs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
