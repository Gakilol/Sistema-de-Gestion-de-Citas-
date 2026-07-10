/**
 * Script de Backfill Retroactivo Opcional
 * 
 * PROPÓSITO:
 * Estima y asigna precios históricos a citas pasadas que se crearon antes de
 * implementar la funcionalidad de precios y facturación.
 * 
 * QUÉ DATOS AFECTA:
 * 1. Tabla `CitaServicio`: Rellena el campo `precio` de cada servicio asociado a la cita
 *    utilizando el precio actual del servicio en el catálogo.
 * 2. Tabla `Cita`: Rellena el campo `monto` con la sumatoria de los precios estimadas 
 *    de sus servicios asociados.
 * 
 * NOTA: Este backfill es una estimación, ya que asume que el precio actual del servicio
 * es el que se cobró en el pasado. Las citas que ya tengan precios y montos asignados
 * no serán modificadas.
 * 
 * INSTRUCCIONES DE EJECUCIÓN (OPCIONAL):
 * node scripts/backfill-precios-estimados.js
 */

const { PrismaClient } = require('@prisma/client');
const { assertNotProductionScript, assertCanWriteToDatabase } = require('./env-guard');
const prisma = new PrismaClient();

async function main() {
  assertNotProductionScript();
  assertCanWriteToDatabase();
  console.log('=== INICIANDO BACKFILL DE PRECIOS ESTIMADOS ===');

  // 1. Obtener todos los servicios con sus precios actuales
  console.log('Obteniendo catálogo de servicios...');
  const servicios = await prisma.servicio.findMany({
    select: { id: true, nombre: true, precio: true }
  });
  
  const servicioPrecioMap = new Map();
  for (const s of servicios) {
    servicioPrecioMap.set(s.id, Number(s.precio || 0));
  }
  console.log(`Catálogo cargado: ${servicios.length} servicios encontrados.`);

  // 2. Obtener todas las citas que no tienen monto establecido (o monto = 0)
  console.log('Buscando citas históricas sin facturación...');
  const citas = await prisma.cita.findMany({
    where: {
      monto: 0
    },
    include: {
      citaServicios: true
    }
  });

  console.log(`Se encontraron ${citas.length} citas que requieren actualización.`);

  if (citas.length === 0) {
    console.log('No hay citas pendientes de actualizar.');
    return;
  }

  let citasActualizadas = 0;
  let serviciosActualizados = 0;
  let montoTotalReconstruido = 0;

  // 3. Procesar las citas secuencialmente en una transacción por lote o iterativamente
  for (const cita of citas) {
    let montoCitaAcumulado = 0;
    const serviciosDeCita = cita.citaServicios;

    // Si la cita no tiene registros en CitaServicio pero sí tiene un servicio_id principal,
    // creamos un registro de CitaServicio de respaldo
    if (serviciosDeCita.length === 0 && cita.servicio_id) {
      const precioEst = servicioPrecioMap.get(cita.servicio_id) || 0;
      montoCitaAcumulado = precioEst;

      await prisma.$transaction([
        // Crear relación CitaServicio
        prisma.citaServicio.create({
          data: {
            cita_id: cita.id,
            servicio_id: cita.servicio_id,
            duracion: cita.duracion || 30,
            orden: 0,
            precio: precioEst
          }
        }),
        // Actualizar monto de la cita
        prisma.cita.update({
          where: { id: cita.id },
          data: { monto: precioEst }
        })
      ]);
      
      serviciosActualizados += 1;
      citasActualizadas += 1;
      montoTotalReconstruido += precioEst;
      continue;
    }

    // Si tiene servicios asociados, actualizamos el precio de cada uno y sumamos
    const queries = [];
    for (const cs of serviciosDeCita) {
      const precioEst = servicioPrecioMap.get(cs.servicio_id) || 0;
      montoCitaAcumulado += precioEst;

      queries.push(
        prisma.citaServicio.update({
          where: { id: cs.id },
          data: { precio: precioEst }
        })
      );
      serviciosActualizados += 1;
    }

    queries.push(
      prisma.cita.update({
        where: { id: cita.id },
        data: { monto: montoCitaAcumulado }
      })
    );

    // Ejecutar transaccionalmente para esta cita
    await prisma.$transaction(queries);
    citasActualizadas += 1;
    montoTotalReconstruido += montoCitaAcumulado;
  }

  console.log('\n=== RESULTADOS DEL BACKFILL ===');
  console.log(`- Citas actualizadas con éxito: ${citasActualizadas}`);
  console.log(`- Registros de servicio actualizados (CitaServicio): ${serviciosActualizados}`);
  console.log(`- Monto total de facturación reconstruido (estimado): ₡${montoTotalReconstruido.toLocaleString('en-US')}`);
  console.log('=================================');
}

main()
  .catch((e) => {
    console.error('Error durante el backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
