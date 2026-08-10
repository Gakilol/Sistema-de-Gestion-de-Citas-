import { describe, test, expect } from 'vitest';
import { buildClientResponse } from '../../lib/client-privacy';
import {
  getJwtRefreshSecret,
  getJwtSecret,
} from '../../lib/security-secrets';

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
