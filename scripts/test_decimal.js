const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const service = await prisma.servicio.findFirst();
  if (service) {
    console.log('Service precio type:', typeof service.precio);
    console.log('Service precio constructor:', service.precio.constructor.name);
    console.log('Number(service.precio):', Number(service.precio));
    console.log('service.precio.toNumber():', service.precio.toNumber());
    console.log('service.precio.toString():', service.precio.toString());
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
