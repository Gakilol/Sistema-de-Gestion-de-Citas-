// app/api/bloques-horario/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { calcularDisponibilidad } from '@/lib/disponibilidad';
import { getBusinessTodayString } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  try {
    const { userId, userRole } = getUserContext(req);

    // Solo ADMIN y TECH_SUPPORT tienen acceso
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const fecha = req.nextUrl.searchParams.get('fecha') || getBusinessTodayString();
    const empleadoId = req.nextUrl.searchParams.get('empleado_id');

    // Obtener empleados activos
    const empleados = await prisma.empleado.findMany({
      where: {
        activo: true,
        ...(empleadoId ? { id: empleadoId } : {}),
      },
      select: {
        id: true,
        nombre: true,
        especialidad: true,
        rol: true,
      },
      orderBy: { nombre: 'asc' },
    });

    const results = [];

    for (const emp of empleados) {
      try {
        // Ejecutar cálculo de disponibilidad para bloques de 15 minutos
        const disp = await calcularDisponibilidad(
          emp.id,
          fecha,
          null,
          15,    // duracion de bloque
          null,  // sin hora especifica
          null,  // sin exclusion de cita
          true   // permitir horario extendido para obtener jornada completa
        );

        results.push({
          empleado: emp,
          disponibilidad: {
            disponible: disp.disponible,
            motivo: disp.motivo,
            jornada: disp.jornada,
            bloques: disp.bloques,
            intervalosOcupados: disp.intervalosOcupados,
            turnosEmpleado: disp.turnosEmpleado
          }
        });
      } catch (err: any) {
        results.push({
          empleado: emp,
          error: err.message || 'Error al calcular disponibilidad'
        });
      }
    }

    return NextResponse.json({ fecha, empleados: results }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
