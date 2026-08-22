import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth-helpers';
import { syncAppointmentStatuses } from '@/lib/appointments/appointment-status-automation';

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`);
}

export async function POST(req: NextRequest) {
  const { userId, userRole } = getUserContext(req);
  const cronAuthorized = isAuthorizedCron(req);
  const authenticated = Boolean(userId && userRole);

  if (!authenticated && !cronAuthorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const result = await syncAppointmentStatuses({
      userId: userId ?? null,
      userRole: userRole ?? (cronAuthorized ? 'SYSTEM' : null),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[APPOINTMENT_STATUS_SYNC_ERROR]', error);
    return NextResponse.json(
      { error: 'No se pudo sincronizar el estado de las citas' },
      { status: 500 }
    );
  }
}
