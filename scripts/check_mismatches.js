const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const citaServicios = await prisma.citaServicio.findMany({
    include: {
      servicio: true,
      cita: true
    }
  });

  console.log(`Total CitaServicios check: ${citaServicios.length}`);
  let mismatches = 0;
  for (const cs of citaServicios) {
    const sPrecio = Number(cs.servicio.precio || 0);
    const csPrecio = Number(cs.precio || 0);
    if (sPrecio !== csPrecio) {
      console.log(`Mismatch on Cita [${cs.cita_id}] (Cliente: ${cs.cita.cliente_nombre}, Fecha: ${cs.cita.fecha.toISOString().split('T')[0]}):`);
      console.log(`  Servicio: [${cs.servicio_id}] "${cs.servicio.nombre}"`);
      console.log(`  Catalogue Price: ${sPrecio} vs Stored Price: ${csPrecio}`);
      mismatches++;
    }
  }
  console.log(`Total mismatches found: ${mismatches}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
