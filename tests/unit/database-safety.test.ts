import { describe, expect, it } from 'vitest';
import {
  assertNonProductionE2ERuntime,
  assertSafeE2EDatabaseUrl,
  getE2EDatabaseIdentity,
} from '../e2e/database-safety';

describe('protección de la base E2E', () => {
  it('acepta una base PostgreSQL identificada como E2E', () => {
    expect(
      assertSafeE2EDatabaseUrl(
        'postgresql://user:secret@localhost:5432/sistema_citas_e2e',
        'postgresql://user:secret@localhost:5432/sistema_citas'
      )
    ).toEqual({ host: 'localhost', port: '5432', database: 'sistema_citas_e2e' });
  });

  it('rechaza una conexión igual a la base de la aplicación', () => {
    const url = 'postgresql://user:secret@db.example.com/sistema_test';
    expect(() => assertSafeE2EDatabaseUrl(url, url)).toThrow(/no puede coincidir/i);
  });

  it('rechaza la misma base aunque cambien las credenciales', () => {
    expect(() =>
      assertSafeE2EDatabaseUrl(
        'postgresql://e2e:secret@db.example.com:5432/sistema_test',
        'postgresql://app:other-secret@db.example.com/sistema_test?sslmode=require'
      )
    ).toThrow(/no puede coincidir/i);
  });

  it('rechaza una base sin marcador e2e o test', () => {
    expect(() =>
      assertSafeE2EDatabaseUrl('postgresql://user:secret@db.example.com/sistema_citas')
    ).toThrow(/debe incluir/i);
  });

  it('rechaza protocolos que no sean PostgreSQL', () => {
    expect(() => getE2EDatabaseIdentity('mysql://localhost/sistema_e2e')).toThrow(
      /PostgreSQL/i
    );
  });

  it('rechaza señales de producción', () => {
    expect(() => assertNonProductionE2ERuntime({ APP_ENV: 'production' })).toThrow(
      /producción/i
    );
  });
});
