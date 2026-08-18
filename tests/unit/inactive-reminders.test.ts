import { beforeEach, describe, expect, test, vi } from 'vitest';
import { canContactInactiveClient } from '../../lib/inactive-clients';
import {
  generarEnlaceWA,
  mensajeReactivacion,
  urlWhatsAppReactivacion,
} from '../../lib/whatsapp';

describe('Recordatorios de clientes inactivos', () => {
  test('ADMIN puede contactar clientes globales', () => {
    expect(canContactInactiveClient('ADMIN', false)).toBe(true);
  });

  test('EMPLEADO solo puede contactar clientes que ya atendió', () => {
    expect(canContactInactiveClient('EMPLEADO', true)).toBe(true);
    expect(canContactInactiveClient('EMPLEADO', false)).toBe(false);
  });

  test('TECH_SUPPORT conserva los datos de contacto privados', () => {
    expect(canContactInactiveClient('TECH_SUPPORT', true)).toBe(false);
  });

  test('normaliza teléfonos locales y conserva prefijos 505/506', () => {
    expect(generarEnlaceWA('8583-1295', 'Hola')).toBe('https://wa.me/50685831295?text=Hola');
    expect(generarEnlaceWA('+505 8888-7777', 'Hola')).toBe('https://wa.me/50588887777?text=Hola');
  });

  test('rechaza teléfonos vacíos, incompletos o enmascarados', () => {
    expect(generarEnlaceWA('', 'Hola')).toBeNull();
    expect(generarEnlaceWA('1234', 'Hola')).toBeNull();
    expect(generarEnlaceWA('••••••••', 'Hola')).toBeNull();
  });

  test('genera el mismo mensaje que se abre en WhatsApp', () => {
    const params = {
      cliente_nombre: 'Ana',
      cliente_telefono: '8583-1295',
      dias_inactividad: 90,
      ultimo_servicio: 'Corte',
    };
    const url = urlWhatsAppReactivacion(params);
    expect(url).toContain(encodeURIComponent(mensajeReactivacion(params)));
  });
});

describe('Renovación de sesión para APIs protegidas', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  test('renueva la sesión y reintenta una solicitud que recibió 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await import('../../lib/api-client');
    const response = await authFetch('/api/gestion/clientes-inactivos');

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/gestion/clientes-inactivos',
      '/api/auth/refresh',
      '/api/gestion/clientes-inactivos',
    ]);
  });

  test('usa auto-login si el refresh token ya no funciona', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await import('../../lib/api-client');
    const response = await authFetch('/api/dashboard');

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/dashboard',
      '/api/auth/refresh',
      '/api/auth/auto-login',
      '/api/dashboard',
    ]);
  });
});
