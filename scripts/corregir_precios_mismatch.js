const { PrismaClient } = require('@prisma/client');
const { assertNotProductionScript, assertCanWriteToDatabase } = require('./env-guard');
const prisma = new PrismaClient();

async function main() {
  assertNotProductionScript();
  assertCanWriteToDatabase();
  console.log('=== INICIANDO SCRIPT DE CORRECCIÓN DE PRECIOS EN CITAS ===\n');

  // 1. Obtener catálogo de servicios y sus precios actuales
  console.log('Obteniendo catálogo de servicios...');
  const servicios = await prisma.servicio.findMany({
    select: { id: true, nombre: true, precio: true }
  });
  
  const servicioPrecioMap = new Map();
  for (const s of servicios) {
    const precioVal = Number(s.precio || 0);
    servicioPrecioMap.set(s.id, precioVal);
    console.log(`  -> Servicio: "${s.nombre}" [ID: ${s.id}] = ₡${precioVal}`);
  }
  console.log('\nCatálogo cargado correctamente.\n');

  // 2. Obtener todas las citas y sus servicios
  console.log('Buscando citas con desajustes de precios...');
  const citas = await prisma.cita.findMany({
    include: {
      citaServicios: true
    }
  });

  let citasActualizadas = 0;
  let serviciosActualizados = 0;

  for (const cita of citas) {
    let checkMontoSum = 0;
    let tieneCambios = false;
    const queries = [];

    // Recalcular precios de cada CitaServicio
    for (const cs of cita.citaServicios) {
      const precioCatalogo = servicioPrecioMap.get(cs.servicio_id) || 0;
      const precioGuardado = Number(cs.precio || 0);
      
      checkMontoSum += precioCatalogo;

      if (precioCatalogo !== precioGuardado) {
        console.log(`  [CitaServicio Mismatch] Cita ID: ${cita.id} (Cliente: ${cita.cliente_nombre}, Fecha: ${cita.fecha.toISOString().split('T')[0]})`);
        console.log(`    Servicio ID: ${cs.servicio_id} | Guardado: ₡${precioGuardado} -> Catálogo: ₡${precioCatalogo}`);
        
        queries.push(
          prisma.citaServicio.update({
            where: { id: cs.id },
            data: { precio: precioCatalogo }
          })
        );
        serviciosActualizados++;
        tieneCambios = true;
      }
    }

    // Verificar si el monto total de la cita también difiere
    const montoGuardado = Number(cita.monto || 0);
    if (cita.citaServicios.length > 0 && checkMontoSum !== montoGuardado) {
      console.log(`  [Cita Monto Mismatch] Cita ID: ${cita.id} (Cliente: ${cita.cliente_nombre})`);
      console.log(`    Monto Guardado: ₡${montoGuardado} -> Suma Recalculada: ₡${checkMontoSum}`);
      
      queries.push(
        prisma.cita.update({
          where: { id: cita.id },
          data: { monto: checkMontoSum }
        })
      );
      tieneCambios = true;
    }

    if (tieneCambios && queries.length > 0) {
      // Ejecutar transaccionalmente para esta cita
      await prisma.$transaction(queries);
      citasActualizadas++;
    }
  }

  console.log('\n=== RESULTADO DE LA MIGRACIÓN ===');
  console.log(`- Citas corregidas/sincronizadas: ${citasActualizadas}`);
  console.log(`- Precios de servicios individuales actualizados: ${serviciosActualizados}`);
  console.log('==================================');
}

main()
  .catch((e) => {
    console.error('Error durante la ejecución del script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
