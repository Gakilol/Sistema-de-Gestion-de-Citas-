import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('rutas GET sin efectos secundarios', () => {
  it.each([
    'app/api/dashboard/route.ts',
    'app/api/citas/route.ts',
    'app/api/reportes/route.ts',
    'lib/services/dashboard-service.ts',
  ])('%s no ejecuta sincronizacion de estados', (path) => {
    expect(read(path)).not.toContain('syncAppointmentStatuses');
  });

  it('expone la sincronizacion solo mediante POST controlado', () => {
    const route = read('app/api/gestion/citas/sincronizar-estados/route.ts');
    expect(route).toContain('export async function POST');
    expect(route).not.toContain('export async function GET');
  });
});
