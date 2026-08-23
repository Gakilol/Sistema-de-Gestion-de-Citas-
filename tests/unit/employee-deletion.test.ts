import { describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  cita: { deleteMany: vi.fn().mockResolvedValue({ count: 7 }) },
  cliente: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
  clientePreferencia: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  listaEspera: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  empleado: { delete: vi.fn().mockResolvedValue({ id: 'employee-1' }) },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import { deleteEmployeePermanently } from '@/lib/employees/delete-employee';

describe('eliminación permanente de personal', () => {
  it('elimina datos operativos y conserva los clientes', async () => {
    const result = await deleteEmployeePermanently('employee-1', 'admin-1');

    expect(tx.cita.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ empleado_id: 'employee-1' }, { created_by: 'employee-1' }] },
    });
    expect(tx.cliente.updateMany).toHaveBeenCalledWith({
      where: { createdByUserId: 'employee-1' },
      data: { createdByUserId: null },
    });
    expect(tx.clientePreferencia.updateMany).toHaveBeenCalledWith({
      where: { createdBy: 'employee-1' },
      data: { createdBy: 'admin-1' },
    });
    expect(tx.listaEspera.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.empleado.delete).toHaveBeenCalledWith({ where: { id: 'employee-1' } });
    expect(result).toMatchObject({ appointmentsDeleted: 7, clientsPreserved: 2 });
  });

  it('no permite que el usuario elimine su propia cuenta', async () => {
    await expect(deleteEmployeePermanently('admin-1', 'admin-1')).rejects.toThrow('No puedes eliminar tu propia cuenta');
  });
});
