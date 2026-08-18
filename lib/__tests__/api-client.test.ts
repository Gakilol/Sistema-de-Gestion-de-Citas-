import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const response = (status: number, body = '') => new Response(body, { status });

describe('authFetch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('envía cookies y no renueva una respuesta autorizada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, 'ok'));
    vi.stubGlobal('fetch', fetchMock);
    const { authFetch } = await import('../api-client');

    const result = await authFetch('/api/clientes');

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/clientes', {
      credentials: 'same-origin',
    });
  });

  test('renueva la sesión y repite una operación rechazada una sola vez', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401, 'sin sesión'))
      .mockResolvedValueOnce(response(200, 'renovada'))
      .mockResolvedValueOnce(response(201, 'creado'));
    vi.stubGlobal('fetch', fetchMock);
    const { authFetch } = await import('../api-client');

    const result = await authFetch('/api/clientes', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Cliente' }),
    });

    expect(result.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/clientes');
  });

  test('usa el dispositivo recordado si el refresh token ya no sirve', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal('fetch', fetchMock);
    const { authFetch } = await import('../api-client');

    const result = await authFetch('/api/clientes?q=ana');

    expect(result.status).toBe(200);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/clientes?q=ana',
      '/api/auth/refresh',
      '/api/auth/auto-login',
      '/api/clientes?q=ana',
    ]);
  });

  test('las solicitudes simultáneas comparten una sola renovación', async () => {
    let clientCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/refresh') return response(200);
      if (url.startsWith('/api/clientes')) {
        clientCalls += 1;
        return clientCalls <= 2 ? response(401) : response(200);
      }
      return response(500);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { authFetch } = await import('../api-client');

    const [first, second] = await Promise.all([
      authFetch('/api/clientes?q=ana'),
      authFetch('/api/clientes?q=luis'),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1);
  });

  test('devuelve el 401 original si no puede recuperar la sesión', async () => {
    const original = response(401, 'sin sesión');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401));
    vi.stubGlobal('fetch', fetchMock);
    const { authFetch } = await import('../api-client');

    const result = await authFetch('/api/clientes');

    expect(result).toBe(original);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
