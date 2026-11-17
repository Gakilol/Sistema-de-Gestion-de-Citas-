import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), counters: vi.fn(), upsert: vi.fn() }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: mocks.generate }; } }));
vi.mock('@/lib/db', () => ({ prisma: {
  $transaction: (callback: (tx: unknown) => unknown) => callback({
    $queryRaw: vi.fn(), iaLimite: { findMany: mocks.counters, upsert: mocks.upsert },
  }),
} }));
import { interpretCommand } from '../../lib/ia/provider';
const local = { accion: 'borrador' as const, fecha: '2026-11-18', hora: '15:00', servicios: ['s0'], horaAmbigua: false };

describe('integración de Gemini y respaldo', () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv('GEMINI_API_KEY', 'test-provider-key');
    mocks.counters.mockResolvedValue([]);
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ accion: 'borrador', servicios: ['s0'] }) });
  });
  it('envía únicamente el comando filtrado y pide una respuesta estructurada', async () => {
    expect(await interpretCommand('agenda s0 manana a las 15:00', '2026-11-17', local, 'user-1')).toMatchObject({ mode: 'gemini', intent: { fecha: '2026-11-18', hora: '15:00' } });
    const args = mocks.generate.mock.calls[0][0];
    expect(JSON.parse(args.contents)).toEqual({ instruccion: 'agenda s0 manana a las 15:00', hoy: '2026-11-17', borradorActivo: true });
    expect(args.config.responseMimeType).toBe('application/json');
    expect(args.config.maxOutputTokens).toBe(600);
  });
  it('sin clave usa el motor local sin contactar al proveedor ni consumir cuota', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(await interpretCommand('agenda s0', '2026-11-17', local, 'user-1')).toMatchObject({ mode: 'local', fallbackReason: 'not_configured' });
    expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.counters).not.toHaveBeenCalled();
  });
  it('un 429 no cambia de proveedor y conserva el comando local', async () => {
    mocks.generate.mockRejectedValue({ status: 429 });
    expect(await interpretCommand('agenda s0', '2026-11-17', local, 'user-1')).toMatchObject({ mode: 'local', intent: local });
  });
  it.each(['{"accion":"eliminar"}', '{malformed', '{"accion":"borrador","servicios":["s9"]}'])('descarta una respuesta inválida o referencias inventadas: %s', async text => {
    mocks.generate.mockResolvedValue({ text });
    expect(await interpretCommand('agenda s0', '2026-11-17', local, 'user-1')).toMatchObject({ mode: 'local', intent: local });
  });
  it('un límite compartido agotado evita llamar a Gemini', async () => {
    mocks.counters.mockResolvedValue([{ clave: 'global:day', cantidad: 50, ventana: new Date(Math.floor(Date.now() / 86400000) * 86400000) }]);
    expect(await interpretCommand('agenda s0', '2026-11-17', local, 'user-1')).toMatchObject({ mode: 'local', fallbackReason: 'quota' });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
