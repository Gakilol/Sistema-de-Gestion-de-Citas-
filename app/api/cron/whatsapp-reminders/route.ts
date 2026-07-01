import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { syncCitaEstados } from '@/lib/automatizacion';
import { getBusinessTodayString, parseLocalDateToUTC } from '@/lib/timezone';
import { mensajeRecordatorioUnaHora } from '@/lib/whatsapp';

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  try {
    // 1. Proteger el endpoint en producción usando el secreto de Vercel Cron
    const authHeader = req.headers.get('authorization');
    if (process.env.NODE_ENV === 'production') {
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    console.log('[CRON] Iniciando tarea periódica de recordatorios de WhatsApp...');

    // 2. Ejecutar sincronización JIT de estados de citas
    await syncCitaEstados();

    // 3. Obtener el día de hoy en la zona horaria del negocio
    const todayStr = getBusinessTodayString(); // YYYY-MM-DD
    const todayDate = parseLocalDateToUTC(todayStr); // Objeto Date UTC medianoche

    // 4. Buscar citas activas de hoy pendientes de recordatorio
    const citas = await prisma.cita.findMany({
      where: {
        fecha: todayDate,
        estado: {
          in: ['PENDIENTE', 'CONFIRMADA']
        },
        whatsapp_reminder_sent: false
      },
      include: {
        empleado: { select: { nombre: true, tituloCliente: true } },
        servicio: { select: { nombre: true } },
        citaServicios: {
          include: {
            servicio: { select: { nombre: true } }
          },
          orderBy: { orden: 'asc' }
        }
      }
    });

    if (citas.length === 0) {
      console.log('[CRON] No hay citas elegibles para enviar recordatorios en este lote.');
      return NextResponse.json({
        mensaje: 'Sincronizado. No hay citas elegibles para recordatorios.',
        procesados: 0
      }, { status: 200 });
    }

    // 5. Filtrar citas en el rango de 0 a 75 minutos en el futuro
    const nowCostaRica = new Date(Date.now() - 6 * 60 * 60 * 1000); // UTC-6
    const nowTimeMs = nowCostaRica.getTime();
    const citasPorEnviar = [];

    for (const cita of citas) {
      const [hours, minutes] = cita.hora.split(':').map(Number);
      const startOfCita = new Date(cita.fecha.getTime());
      startOfCita.setUTCHours(hours, minutes, 0, 0);

      const citaTimeMs = startOfCita.getTime();
      const diffMinutes = (citaTimeMs - nowTimeMs) / (1000 * 60);

      // Cita empieza en los próximos 75 minutos (y no ha pasado)
      if (diffMinutes >= 0 && diffMinutes <= 75) {
        citasPorEnviar.push({ cita, diffMinutes });
      }
    }

    console.log(`[CRON] Encontradas ${citasPorEnviar.length} citas que inician pronto en el rango de 0-75 min.`);

    const resultados = [];

    // 6. Enviar mensajes y registrar en la BD
    for (const item of citasPorEnviar) {
      const { cita, diffMinutes } = item;

      const servicioNombres = cita.citaServicios.length > 0
        ? cita.citaServicios.map(cs => cs.servicio.nombre).join(' + ')
        : cita.servicio.nombre;

      const mensaje = mensajeRecordatorioUnaHora({
        cliente_nombre: cita.cliente_nombre,
        cliente_telefono: cita.cliente_telefono,
        servicio: servicioNombres,
        empleado: cita.empleado.nombre,
        empleado_titulo: cita.empleado.tituloCliente,
        fecha: cita.fecha,
        hora: cita.hora
      });

      const url = process.env.WHATSAPP_API_URL;
      const token = process.env.WHATSAPP_API_TOKEN;
      let statusEnvio = 'LOGGED_TO_CONSOLE';

      // Si las variables están configuradas y hay teléfono, enviar de verdad
      if (url && token && cita.cliente_telefono) {
        try {
          const cleanPhone = cita.cliente_telefono.replace(/\D/g, '');
          const formattedPhone = cleanPhone.startsWith('505') || cleanPhone.startsWith('506')
            ? cleanPhone
            : `506${cleanPhone}`;

          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              phone: formattedPhone,
              message: mensaje,
              to: formattedPhone, // compatibilidad con varios proveedores
              body: mensaje       // compatibilidad con varios proveedores
            })
          });

          if (res.ok) {
            statusEnvio = 'SENT_HTTP';
          } else {
            statusEnvio = `ERROR_HTTP_${res.status}`;
            console.error(`[CRON] Error HTTP al enviar recordatorio para Cita ${cita.id}:`, await res.text());
          }
        } catch (fetchErr) {
          statusEnvio = 'ERROR_FETCH';
          console.error(`[CRON] Fallo de red al enviar recordatorio para Cita ${cita.id}:`, fetchErr);
        }
      } else {
        // Modo simulación en consola
        console.log(`\n--- [SIMULACIÓN WHATSAPP ENVIADO (Cita a iniciar en ${Math.round(diffMinutes)} min)] ---`);
        console.log(`Para: ${cita.cliente_telefono || 'Sin teléfono'}`);
        console.log(`Contenido:\n${mensaje}`);
        console.log('-------------------------------------------------------------------------\n');
      }

      // 7. Marcar como enviado inmediatamente en la base de datos (control anti-duplicados estricto)
      await prisma.cita.update({
        where: { id: cita.id },
        data: {
          whatsapp_reminder_sent: true,
          whatsapp_reminder_sent_at: new Date()
        }
      });

      resultados.push({
        cita_id: cita.id,
        cliente: cita.cliente_nombre,
        hora: cita.hora,
        minutos_faltantes: Math.round(diffMinutes),
        estado: statusEnvio
      });
    }

    return NextResponse.json({
      mensaje: `Procesamiento de recordatorios finalizado.`,
      enviados: resultados.length,
      detalles: resultados
    }, { status: 200 });

  } catch (error: any) {
    console.error('[CRON] Error crítico en el handler de recordatorios:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
