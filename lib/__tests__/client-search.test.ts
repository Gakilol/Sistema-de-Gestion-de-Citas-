import { describe, expect, it } from 'vitest';
import { isExactClientDirectoryMatch, resolveClientDirectory, searchClientDirectory } from '@/lib/clients/client-search';

const clients = [
  { id: 'client-2', nombre: 'Carlos Pérez Rodríguez', telefono: '50588882222', correo: null, cedula: null },
  { id: 'client-1', nombre: 'Álvaro   Zeledón', telefono: '50588887777', correo: 'alvaro@ejemplo.com', cedula: null },
];

function fakeDb(rows = clients) {
  return { $queryRaw: async () => rows };
}

describe('resolución central de clientes', () => {
  it('prioriza el nombre exacto normalizado', async () => {
    const matches = await searchClientDirectory('alvaro zeledon', { db: fakeDb(), limit: 8 });
    expect(matches[0]?.id).toBe('client-1');
  });

  it('resuelve un único teléfono aunque tenga formato local', async () => {
    const result = await resolveClientDirectory('8888-7777', { db: fakeDb([clients[1]]) });
    expect(result).toMatchObject({ kind: 'found', client: { id: 'client-1' } });
  });

  it('no selecciona arbitrariamente entre coincidencias parciales', async () => {
    const result = await resolveClientDirectory('Carlos', { db: fakeDb([
      clients[0],
      { id: 'client-3', nombre: 'Carlos Pérez', telefono: '50577771111', correo: null, cedula: null },
    ]) });
    expect(result).toMatchObject({ kind: 'ambiguous' });
  });

  it('distingue una coincidencia exacta de una única coincidencia parcial', () => {
    expect(isExactClientDirectoryMatch(clients[0], 'Carlos Pérez Rodríguez')).toBe(true);
    expect(isExactClientDirectoryMatch(clients[0], 'Carlos')).toBe(false);
  });
});
