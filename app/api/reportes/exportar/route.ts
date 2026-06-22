import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireReporteRole, parseReportFilters } from '@/lib/reportes-utils';

export async function GET(req: NextRequest) {
  const authError = requireReporteRole(req);
  if (authError) return authError;

  const parsed = parseReportFilters(req);
  if ('error' in parsed) return parsed.error;
  const { filters } = parsed;

  const sp = req.nextUrl.searchParams;
  const format = sp.get('formato') || 'csv'; // csv | excel

  try {
    const citas = await prisma.cita.findMany({
      where: {
        fecha: { gte: filters.from, lte: filters.to },
        ...(filters.empleadoId ? { empleado_id: filters.empleadoId } : {}),
        ...(filters.servicioId  ? { servicio_id: filters.servicioId  } : {}),
        ...(filters.estado      ? { estado: filters.estado as any }     : {}),
      },
      select: {
        id:               true,
        fecha:            true,
        hora:             true,
        estado:           true,
        duracion:         true,
        cliente_nombre:   true,
        cliente_telefono: true,
        notas:            true,
        created_at:       true,
        cancelled_at:     true,
        completed_at:     true,
        no_show_at:       true,
        cancel_reason:    true,
        empleado:         { select: { nombre: true, especialidad: true } },
        servicio:         { select: { nombre: true, categoria: true } },
      },
      orderBy: [{ fecha: 'desc' }, { hora: 'desc' }],
      take: 5000, // safety limit
    });

    const estadoLabel: Record<string, string> = {
      PENDIENTE:    'Pendiente',
      CONFIRMADA:   'Confirmada',
      EN_PROGRESO:  'En Progreso',
      COMPLETADA:   'Completada',
      CANCELADA:    'Cancelada',
      NO_SHOW:      'No se presentó',
      REPROGRAMADA: 'Reprogramada',
    };

    const rows = citas.map(c => ({
      Fecha:            c.fecha ? new Date(c.fecha).toISOString().split('T')[0] : '',
      Hora:             c.hora,
      Estado:           estadoLabel[c.estado] || c.estado,
      Duracion_min:     c.duracion,
      Cliente:          c.cliente_nombre,
      Telefono:         c.cliente_telefono || '',
      Empleado:         c.empleado?.nombre || '',
      Especialidad:     c.empleado?.especialidad || '',
      Servicio:         c.servicio?.nombre || '',
      Categoria:        c.servicio?.categoria || '',
      Motivo_Cancelacion: c.cancel_reason || '',
      Creado_en:        c.created_at  ? c.created_at.toISOString()  : '',
      Cancelado_en:     c.cancelled_at ? c.cancelled_at.toISOString(): '',
      Completado_en:    c.completed_at ? c.completed_at.toISOString(): '',
      No_show_en:       c.no_show_at  ? c.no_show_at.toISOString()  : '',
      Notas:            c.notas || '',
    }));

    if (format === 'csv') {
      const headers = Object.keys(rows[0] || {});
      const csvLines = [
        `# Reporte: Citas | Período: ${filters.rawFrom} al ${filters.rawTo} | Generado: ${new Date().toISOString()}`,
        headers.join(','),
        ...rows.map(r =>
          headers.map(h => {
            const val = String((r as any)[h] || '').replace(/"/g, '""');
            return val.includes(',') || val.includes('"') ? `"${val}"` : val;
          }).join(',')
        ),
      ];
      const csv = csvLines.join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type':        'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="reporte-citas-${filters.rawFrom}-${filters.rawTo}.csv"`,
        },
      });
    }

    // Excel (simple XML spreadsheet compatible with Excel)
    const xmlRows = rows.map(r => {
      const cols = Object.values(r).map(v =>
        `<Cell><Data ss:Type="String">${String(v || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))}</Data></Cell>`
      ).join('');
      return `<Row>${cols}</Row>`;
    });

    const headers = Object.keys(rows[0] || {});
    const headerRow = headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('');

    const xlsx = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Reporte">
    <Table>
      <Row>${headerRow}</Row>
      ${xmlRows.join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`;

    return new NextResponse(xlsx, {
      headers: {
        'Content-Type':        'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="reporte-citas-${filters.rawFrom}-${filters.rawTo}.xls"`,
      },
    });
  } catch (err: any) {
    console.error('[/api/reportes/exportar]', err);
    return NextResponse.json({ error: 'Error interno al exportar el reporte.' }, { status: 500 });
  }
}
