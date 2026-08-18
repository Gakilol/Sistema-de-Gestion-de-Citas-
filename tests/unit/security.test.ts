import { describe, test, expect } from 'vitest';
import { buildClientResponse } from '../../lib/client-privacy';
import {
  getDefaultAppointmentScope,
  getScopedAppointmentWhere,
} from '../../lib/auth-helpers';
import {
  getJwtRefreshSecret,
  getJwtSecret,
} from '../../lib/security-secrets';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signToken,
  verifyToken,
} from '../../lib/jwt';

const employeeId = '11111111-1111-1111-1111-111111111111';
const otherEmployeeId = '22222222-2222-2222-2222-222222222222';
const rawClient = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  nombre: 'Cliente de prueba',
  telefono: '50588887777',
  correo: 'cliente@example.test',
  notas: 'Nota privada del cliente',
  createdByUserId: employeeId,
  citas: [
    { id: 'own', empleado_id: employeeId, estado: 'COMPLETADA', servicio: { nombre: 'Corte' }, empleado: { nombre: 'Propio' } },
    { id: 'other', empleado_id: otherEmployeeId, estado: 'PENDIENTE', servicio: { nombre: 'Barba' }, empleado: { nombre: 'Ajeno' } },
  ],
  totalCitas: 2,
  citasCompletadas: 1,
  ultimaCita: new Date('2026-07-20T00:00:00Z'),
  primeraCita: new Date('2026-07-01T00:00:00Z'),
  esRecurrente: true,
  servicioFavorito: 'Corte',
  historial: [],
};

const employeeScopedClient = {
  ...rawClient,
  citas: rawClient.citas.filter((cita) => cita.empleado_id === employeeId),
  totalCitas: 1,
  citasCompletadas: 1,
  historial: rawClient.citas.filter((cita) => cita.empleado_id === employeeId),
};

describe('Security boundaries', () => {
  test('producción sin JWT_SECRET no obtiene secreto de autenticación', () => {
    expect(getJwtSecret({ NODE_ENV: 'production' })).toBeNull();
  });

  test('no existe fallback JWT ni refresh predecible', () => {
    expect(getJwtSecret({})).toBeNull();
    expect(getJwtRefreshSecret({})).toBeNull();
  });

  test('las cookies y los JWT comparten una duración de sesión única', () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(24 * 60 * 60);
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  test('el JWT conserva ADMIN, EMPLEADO y TECH_SUPPORT durante toda la sesión', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';

    try {
      for (const rol of ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT']) {
        const token = await signToken({
          id: employeeId,
          email: `${rol.toLowerCase()}@example.test`,
          rol,
        });
        const payload = await verifyToken(token);

        expect(payload?.rol).toBe(rol);
        expect((payload?.exp ?? 0) - (payload?.iat ?? 0)).toBe(ACCESS_TOKEN_TTL_SECONDS);
      }
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  test('EMPLEADO siempre queda limitado a su propia agenda', () => {
    expect(getDefaultAppointmentScope('EMPLEADO')).toBe('mine');
    expect(getScopedAppointmentWhere(employeeId, 'EMPLEADO', 'all', otherEmployeeId)).toEqual({
      empleado_id: employeeId,
    });
  });

  test('ADMIN puede consultar agenda global, propia o filtrada', () => {
    expect(getDefaultAppointmentScope('ADMIN')).toBe('all');
    expect(getScopedAppointmentWhere(employeeId, 'ADMIN', 'all')).toEqual({});
    expect(getScopedAppointmentWhere(employeeId, 'ADMIN', 'mine')).toEqual({ empleado_id: employeeId });
    expect(getScopedAppointmentWhere(employeeId, 'ADMIN', 'all', otherEmployeeId)).toEqual({
      empleado_id: otherEmployeeId,
    });
  });

  test('TECH_SUPPORT puede consultar agenda global, propia o filtrada', () => {
    expect(getDefaultAppointmentScope('TECH_SUPPORT')).toBe('all');
    expect(getScopedAppointmentWhere(employeeId, 'TECH_SUPPORT', 'all')).toEqual({});
    expect(getScopedAppointmentWhere(employeeId, 'TECH_SUPPORT', 'mine')).toEqual({ empleado_id: employeeId });
    expect(getScopedAppointmentWhere(employeeId, 'TECH_SUPPORT', 'all', otherEmployeeId)).toEqual({
      empleado_id: otherEmployeeId,
    });
  });

  test('ADMIN conserva cliente y citas completas', () => {
    const result = buildClientResponse(rawClient, 'ADMIN');
    const citas = result.citas ?? [];
    expect(citas.length).toBe(2);
    expect(citas.some((c) => c.id === 'other')).toBe(true);
  });

  test('TECH_SUPPORT recibe PII enmascarada y sin notas privadas', () => {
    const result = buildClientResponse(rawClient, 'TECH_SUPPORT');
    expect((result.citas ?? []).length).toBe(2);
    expect(result.telefono).not.toBe(rawClient.telefono);
    expect(result.telefono).toMatch(/7777$/);
    expect(result.correo).not.toBe(rawClient.correo);
    expect(result.notas).toBeNull();
    expect(result._privado).toBe(true);
  });

  test('EMPLOYEE recibe el DTO permitido para un cliente accesible', () => {
    const result = buildClientResponse(employeeScopedClient, 'EMPLEADO');
    expect(result.id).toBe(rawClient.id);
    expect(result.nombre).toBe(rawClient.nombre);
    expect(result.telefono).toBe(rawClient.telefono);
    expect('createdByUserId' in result).toBe(false);
  });

  test('EMPLOYEE no recibe citas de otros profesionales', () => {
    const result = buildClientResponse(employeeScopedClient, 'EMPLEADO');
    expect((result.citas ?? []).every((c) => c.empleado_id === employeeId)).toBe(true);
    expect((result.historial ?? []).every((c) => c.empleado_id === employeeId)).toBe(true);
  });

  test('DTO EMPLEADO conserva datos para buscar y seleccionar al cliente', () => {
    const result = buildClientResponse(employeeScopedClient, 'EMPLEADO');
    expect(typeof result.nombre).toBe('string');
    expect(typeof result.telefono).toBe('string');
  });
});
