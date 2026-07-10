const { PrismaClient } = require('@prisma/client');
const { assertNotProductionScript, assertCanWriteToDatabase } = require('./env-guard');
const prisma = new PrismaClient();

const defaultHorarios = {
  lunes:     { activo: true,  inicio: '08:00', fin: '18:00' },
  martes:    { activo: true,  inicio: '08:00', fin: '18:00' },
  miercoles: { activo: true,  inicio: '08:00', fin: '18:00' },
  jueves:    { activo: true,  inicio: '08:00', fin: '18:00' },
  viernes:   { activo: true,  inicio: '08:00', fin: '18:00' },
  sabado:    { activo: true,  inicio: '08:00', fin: '14:00' },
  domingo:   { activo: false, inicio: '09:00', fin: '13:00' },
};

async function main() {
  assertNotProductionScript();
  assertCanWriteToDatabase();
  console.log('=== INICIANDO SCRIPT DE MIGRACIÓN Y CORRECCIÓN DE DATOS ===\n');

  // 1. Migración de Citas a CitaServicio (Soporte Multiservicio)
  console.log('1. Migrando citas sin registros en CitaServicio...');
  const citas = await prisma.cita.findMany({
    include: {
      citaServicios: true
    }
  });

  let citasMigradas = 0;
  for (const c of citas) {
    if (c.citaServicios.length === 0) {
      if (c.servicio_id) {
        console.log(`   -> Migrando Cita ID [${c.id}] para Cliente [${c.cliente_nombre}] con Servicio [${c.servicio_id}]...`);
        await prisma.citaServicio.create({
          data: {
            cita_id: c.id,
            servicio_id: c.servicio_id,
            duracion: c.duracion,
            orden: 0
          }
        });
        citasMigradas++;
      } else {
        console.warn(`   [ALERTA] Cita ID [${c.id}] no tiene un servicio_id legacy definido. Omitiendo.`);
      }
    }
  }
  console.log(`\n   ✓ Total de citas migradas a CitaServicio: ${citasMigradas} de ${citas.length}\n`);

  // 2. Inicialización de la Configuración Global ('default')
  console.log('2. Comprobando registro de configuración global...');
  const config = await prisma.configuracion.findUnique({
    where: { id: 'default' }
  });

  if (!config) {
    console.log('   -> Creando registro de configuración global default...');
    await prisma.configuracion.create({
      data: {
        id: 'default',
        negocio: {
          nombre: 'HAIR STYLE',
          subtitulo: 'Salón & Barber',
          telefono: '',
          whatsapp: '',
          direccion: '',
          web: '',
          moneda: 'USD',
          zona_horaria: 'America/Managua',
          tipoCambio: 36.5
        },
        horarios: defaultHorarios,
        whatsapp: {
          numero: '',
          confirmar: true,
          recordatorio: true,
          cancelacion: true,
          msgExtra: ''
        },
        apariencia: {
          tema: 'system',
          branding: true
        }
      }
    });
    console.log('   ✓ Configuración default creada exitosamente.\n');
  } else {
    console.log('   ✓ El registro de configuración global ya existe. No se realizaron cambios en la configuración.\n');
  }

  console.log('=== MIGRACIÓN COMPLETADA CON ÉXITO ===');
}

main()
  .catch(e => {
    console.error('\n[ERROR] Ocurrió un error durante la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
