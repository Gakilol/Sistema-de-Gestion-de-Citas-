import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  cliente: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  servicio: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  empleado: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

const availabilityMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/appointments/appointment-availability', () => ({
  calculateAppointmentAvailability: availabilityMock,
}));
vi.mock('@/lib/timezone', () => ({
  getBusinessTodayString: () => '2026-08-22',
  parseLocalDateToUTC: (value: string) => new Date(`${value}T00:00:00.000Z`),
}));

import { IAToolInputError, prepareCreateAppointment } from '@/lib/ia/action-builders';

const context = { userId: 'admin-1', userRole: 'ADMIN' as const };

describe('preparación segura de citas con IA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    availabilityMock.mockResolvedValue({
      disponible: true,
      bloques: [{ hora: '10:00', disponible: true }],
    });
    prismaMock.empleado.findMany.mockResolvedValue([{ id: 'staff-1', nombre: 'Álvaro' }]);
    prismaMock.servicio.findMany.mockResolvedValue([{ id: 'service-1', nombre: 'Corte clásico', duracion: 30 }]);
  });

  it('rechaza una cita si el cliente no está guardado', async () => {
    prismaMock.cliente.findMany.mockResolvedValue([]);

    await expect(prepareCreateAppointment({
      cliente: 'Persona nueva',
      servicio: 'Corte clásico',
      profesional: 'Álvaro',
      fecha: '2026-08-24',
      hora: '10:00',
    }, context)).rejects.toThrow(IAToolInputError);
  });

  it('usa exactamente el cliente y servicio seleccionados en la plantilla', async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', nombre: 'Kevin Duarte', telefono: '88887777' });
    prismaMock.servicio.findFirst.mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', nombre: 'Corte clásico', duracion: 30 });

    const action = await prepareCreateAppointment({
      clienteId: '11111111-1111-4111-8111-111111111111',
      cliente: 'Kevin Duarte',
      servicioId: '22222222-2222-4222-8222-222222222222',
      servicio: 'Corte clásico',
      profesional: 'Álvaro',
      fecha: '2026-08-24',
      hora: '10:00',
    }, context);

    expect(action.body).toMatchObject({
      cliente_id: '11111111-1111-4111-8111-111111111111',
      cliente_nombre: 'Kevin Duarte',
      cliente_telefono: '88887777',
      servicio_id: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('obliga a escoger el servicio exacto cuando “Corte” coincide con varios', async () => {
    prismaMock.cliente.findMany.mockResolvedValue([{ id: 'client-1', nombre: 'Kevin Duarte', telefono: null }]);
    prismaMock.servicio.findMany.mockResolvedValue([
      { id: 'service-1', nombre: 'Corte clásico', duracion: 30 },
      { id: 'service-2', nombre: 'Corte y barba', duracion: 60 },
    ]);

    await expect(prepareCreateAppointment({
      cliente: 'Kevin Duarte',
      servicio: 'Corte',
      profesional: 'Álvaro',
      fecha: '2026-08-24',
      hora: '10:00',
    }, context)).rejects.toThrow('Encontré varios servicios: Corte clásico, Corte y barba');
  });

  it('no elige al primero cuando dos clientes guardados comparten nombre', async () => {
    prismaMock.cliente.findMany.mockResolvedValue([
      { id: 'client-1', nombre: 'José López', telefono: '88881111' },
      { id: 'client-2', nombre: 'José López', telefono: '88882222' },
    ]);

    await expect(prepareCreateAppointment({
      cliente: 'José López',
      servicio: 'Corte clásico',
      profesional: 'Álvaro',
      fecha: '2026-08-24',
      hora: '10:00',
    }, context)).rejects.toThrow('José López (88881111), José López (88882222)');
  });
});
