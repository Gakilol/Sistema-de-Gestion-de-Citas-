import { describe, expect, it, vi } from 'vitest';
import {
  resolveEmployeeDirectory,
  resolveServiceDirectory,
  searchEmployeeDirectory,
  searchServiceDirectory,
} from '@/lib/catalog/catalog-search';

describe('búsqueda normalizada del catálogo operativo', () => {
  it('envía una consulta segura y ordena servicios con tildes como coincidencia exacta', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'service-2', nombre: 'Alisado rápido', duracion: 45, categoria: 'Cabello' },
        { id: 'service-1', nombre: 'Álisado', duracion: 60, categoria: 'Cabello' },
      ]),
    };

    const matches = await searchServiceDirectory('  alisado ', { db, limit: 8 });

    expect(db.$queryRaw).toHaveBeenCalledOnce();
    expect(matches.map((item) => item.id)).toEqual(['service-1', 'service-2']);
  });

  it('resuelve un profesional aunque la consulta omita la tilde', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'staff-1', nombre: 'Álvaro Zeledón' },
      ]),
    };

    await expect(resolveEmployeeDirectory('Alvaro Zeledon', { db })).resolves.toEqual({
      kind: 'found',
      item: { id: 'staff-1', nombre: 'Álvaro Zeledón' },
    });
  });

  it('no elige arbitrariamente cuando varios servicios coinciden', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'service-1', nombre: 'Corte clásico', duracion: 30, categoria: 'Cabello' },
        { id: 'service-2', nombre: 'Corte y barba', duracion: 60, categoria: 'Cabello' },
      ]),
    };

    await expect(resolveServiceDirectory('Corte', { db })).resolves.toMatchObject({
      kind: 'ambiguous',
      items: [{ id: 'service-1' }, { id: 'service-2' }],
    });
  });

  it('puede listar profesionales agendables sin texto de búsqueda', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'staff-1', nombre: 'Álvaro' },
        { id: 'staff-2', nombre: 'Kevin' },
      ]),
    };

    const matches = await searchEmployeeDirectory('', { db, limit: 8 });
    expect(matches).toHaveLength(2);
  });
});
