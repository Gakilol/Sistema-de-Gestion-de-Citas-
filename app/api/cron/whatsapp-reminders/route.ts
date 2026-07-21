import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { syncCitaEstados } from '@/lib/automatizacion';
import { getBusinessTodayString, parseLocalDateToUTC } from '@/lib/timezone';
import { mensajeRecordatorioUnaHora } from '@/lib/whatsapp';
import { getCronSecret, isAuthorizedCronRequest } from '@/lib/security-secrets';

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization');
    if (!getCronSecret()) {
      console.error('[SECURITY_CONFIGURATION] CRON_SECRET is not configured. Rejecting cron request.');
      return NextResponse.json({ error: 'Configuración de seguridad incorrecta' }, { status: 503 });
    }
    if (!isAuthorizedCronRequest(authorization)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar si los recordatorios automáticos o las notificaciones están desactivadas
    if (process.env.DISABLE_REMINDER_JOBS === 'true' || process.env.DISABLE_NOTIFICATIONS === 'true') {
      console.log('[CRON] Envío de recordatorios abortado: recordatorios automáticos desactivados.');
      return NextResponse.json({
        mensaje: 'Recordatorios automáticos desactivados.',
        procesados: 0
      }, { status: 200 });
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

    let enviados = 0;

    // 6. Enviar mensajes y registrar en la BD
    for (const item of citasPorEnviar) {
      const { cita, diffMinutes } = item;

      const servicioNombres = cita.citaServicios.length > 0
        ? cita.citaServicios.map((cs: any) => cs.servicio.nombre).join(' + ')
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
      const isWhatsAppDisabled = process.env.DISABLE_WHATSAPP === 'true' || process.env.DISABLE_NOTIFICATIONS === 'true';

      // Si las variables están configuradas y hay teléfono, enviar de verdad
      if (url && token && cita.cliente_telefono && !isWhatsAppDisabled) {
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

          if (!res.ok) {
            console.error(`[CRON] Error HTTP al enviar recordatorio para Cita ${cita.id}:`, await res.text());
          }
        } catch (fetchErr) {
          console.error(`[CRON] Fallo de red al enviar recordatorio para Cita ${cita.id}:`, fetchErr);
        }
      } else {
        // Modo simulación en consola (sin exponer PII completa en logs)
        const maskedPhone = cita.cliente_telefono
          ? `${cita.cliente_telefono.slice(0, 3)}••••${cita.cliente_telefono.slice(-2)}`
          : 'Sin teléfono';
        console.log(`\n--- [SIMULACIÓN WHATSAPP ENVIADO (Cita id: ${cita.id}, inician en ${Math.round(diffMinutes)} min)] ---`);
        console.log(`Para: ${maskedPhone}`);
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

      enviados++;
    }

    return NextResponse.json({
      mensaje: `Procesamiento de recordatorios finalizado.`,
      enviados
    }, { status: 200 });

  } catch (error) {
    console.error('[CRON] Error crítico en el handler de recordatorios:', error);
    return NextResponse.json({ error: 'Error interno al procesar recordatorios' }, { status: 500 });
  }
}
