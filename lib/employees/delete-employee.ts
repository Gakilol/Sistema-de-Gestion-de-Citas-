import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export async function deleteEmployeePermanently(employeeId: string, actorId: string) {
  if (employeeId === actorId) {
    throw new Error('No puedes eliminar tu propia cuenta mientras la estás usando.');
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const appointments = await tx.cita.deleteMany({
      where: { OR: [{ empleado_id: employeeId }, { created_by: employeeId }] },
    });

    const clients = await tx.cliente.updateMany({
      where: { createdByUserId: employeeId },
      data: { createdByUserId: null },
    });

    const preferences = await tx.clientePreferencia.updateMany({
      where: { createdBy: employeeId },
      data: { createdBy: actorId },
    });

    const waitlistCreated = await tx.listaEspera.updateMany({
      where: { createdBy: employeeId },
      data: { createdBy: actorId },
    });

    const waitlistAssigned = await tx.listaEspera.updateMany({
      where: { empleadoId: employeeId },
      data: { empleadoId: null },
    });

    await tx.empleado.delete({ where: { id: employeeId } });

    return {
      appointmentsDeleted: appointments.count,
      clientsPreserved: clients.count,
      preferencesPreserved: preferences.count,
      waitlistEntriesPreserved: waitlistCreated.count + waitlistAssigned.count,
    };
  });
}
