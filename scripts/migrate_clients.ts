import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando migración de clientes...');

  // 1. Obtener todas las citas que aún no tienen cliente_id
  const citas = await prisma.cita.findMany({
    where: { cliente_id: null },
    select: { id: true, cliente_nombre: true, cliente_telefono: true }
  });

  console.log(`Encontradas ${citas.length} citas sin cliente_id asociado.`);

  // 2. Agrupar por nombre y teléfono normalizados
  const clientesMap = new Map<string, { nombre: string, telefono: string | null, citasIds: string[] }>();

  for (const cita of citas) {
    const nombreNormalizado = cita.cliente_nombre.trim();
    const telefonoNormalizado = cita.cliente_telefono?.trim().replace(/\D/g, '') || '';
    const clave = `${nombreNormalizado.toLowerCase()}|${telefonoNormalizado}`;

    if (!clientesMap.has(clave)) {
      clientesMap.set(clave, {
        nombre: nombreNormalizado,
        telefono: cita.cliente_telefono?.trim() || null,
        citasIds: []
      });
    }
    clientesMap.get(clave)!.citasIds.push(cita.id);
  }

  console.log(`Se identificaron ${clientesMap.size} clientes únicos.`);

  // 3. Crear los clientes en la base de datos y enlazar sus citas
  let clientesCreados = 0;
  let citasActualizadas = 0;

  for (const [clave, data] of clientesMap.entries()) {
    // Buscar si ya existe un cliente (por si el script se corre varias veces)
    // Para simplificar, insertamos todos los del map, asumiendo que es la primera vez que se crea la tabla Cliente
    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombre: data.nombre,
        telefono: data.telefono
      }
    });
    clientesCreados++;

    // Actualizar las citas asociadas con el ID del nuevo cliente
    const { count } = await prisma.cita.updateMany({
      where: { id: { in: data.citasIds } },
      data: { cliente_id: nuevoCliente.id }
    });
    citasActualizadas += count;
  }

  console.log(`Migración completada. Clientes creados: ${clientesCreados}. Citas actualizadas: ${citasActualizadas}.`);
}

main()
  .catch(e => {
    console.error('Error durante la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
