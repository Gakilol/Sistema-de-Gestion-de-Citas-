import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normalizeClientText } from '@/lib/clients/client-normalization';

export interface ServiceDirectoryMatch {
  id: string;
  nombre: string;
  duracion: number;
  categoria: string | null;
}

export interface EmployeeDirectoryMatch {
  id: string;
  nombre: string;
}

export type DirectoryResolution<T> =
  | { kind: 'found'; item: T }
  | { kind: 'ambiguous'; items: T[] }
  | { kind: 'not_found'; items: [] };

type CatalogSearchDb = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

interface CatalogSearchOptions {
  limit?: number;
  db?: CatalogSearchDb;
}

const ACCENTED = 'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ';
const PLAIN = 'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC';

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function rankName(name: string, query: string): number {
  const normalizedName = normalizeClientText(name);
  const normalizedQuery = normalizeClientText(query);
  if (!normalizedQuery) return 3;
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  return 2;
}

function sortByMatch<T extends { nombre: string }>(items: T[], query: string): T[] {
  return [...items].sort((a, b) => (
    rankName(a.nombre, query) - rankName(b.nombre, query)
    || a.nombre.localeCompare(b.nombre, 'es')
  ));
}

function resolveMatches<T extends { nombre: string }>(items: T[], query: string): DirectoryResolution<T> {
  const normalizedQuery = normalizeClientText(query);
  const exact = items.filter((item) => normalizeClientText(item.nombre) === normalizedQuery);
  if (exact.length === 1) return { kind: 'found', item: exact[0] };
  if (exact.length > 1) return { kind: 'ambiguous', items: exact };
  if (items.length === 1) return { kind: 'found', item: items[0] };
  if (items.length > 1) return { kind: 'ambiguous', items };
  return { kind: 'not_found', items: [] };
}

export async function searchServiceDirectory(
  rawQuery: string,
  options: CatalogSearchOptions = {},
): Promise<ServiceDirectoryMatch[]> {
  const query = rawQuery.trim();
  const db = options.db ?? (prisma as unknown as CatalogSearchDb);
  const limit = Math.min(50, Math.max(1, options.limit ?? 12));
  const normalizedQuery = normalizeClientText(query);
  const pattern = `%${escapeLike(normalizedQuery)}%`;
  const searchPredicate = normalizedQuery
    ? Prisma.sql`AND (
        REGEXP_REPLACE(LOWER(TRANSLATE(COALESCE("nombre", ''), ${ACCENTED}, ${PLAIN})), '\\s+', ' ', 'g') LIKE ${pattern} ESCAPE '\\'
        OR REGEXP_REPLACE(LOWER(TRANSLATE(COALESCE("categoria", ''), ${ACCENTED}, ${PLAIN})), '\\s+', ' ', 'g') LIKE ${pattern} ESCAPE '\\'
      )`
    : Prisma.empty;

  const rows = await db.$queryRaw<ServiceDirectoryMatch[]>(Prisma.sql`
    SELECT "id", "nombre", "duracion", "categoria"
    FROM "Servicio"
    WHERE "activo" = TRUE
    ${searchPredicate}
    ORDER BY "nombre" ASC
    LIMIT ${limit}
  `);

  return sortByMatch(rows, query);
}

export async function resolveServiceDirectory(
  query: string,
  options: CatalogSearchOptions = {},
): Promise<DirectoryResolution<ServiceDirectoryMatch>> {
  const items = await searchServiceDirectory(query, { ...options, limit: Math.max(options.limit ?? 8, 8) });
  return resolveMatches(items, query);
}

export async function searchEmployeeDirectory(
  rawQuery: string,
  options: CatalogSearchOptions = {},
): Promise<EmployeeDirectoryMatch[]> {
  const query = rawQuery.trim();
  const db = options.db ?? (prisma as unknown as CatalogSearchDb);
  const limit = Math.min(50, Math.max(1, options.limit ?? 12));
  const normalizedQuery = normalizeClientText(query);
  const pattern = `%${escapeLike(normalizedQuery)}%`;
  const searchPredicate = normalizedQuery
    ? Prisma.sql`AND REGEXP_REPLACE(LOWER(TRANSLATE(COALESCE("nombre", ''), ${ACCENTED}, ${PLAIN})), '\\s+', ' ', 'g') LIKE ${pattern} ESCAPE '\\'`
    : Prisma.empty;

  const rows = await db.$queryRaw<EmployeeDirectoryMatch[]>(Prisma.sql`
    SELECT "id", "nombre"
    FROM "Empleado"
    WHERE "activo" = TRUE AND "esAgendable" = TRUE
    ${searchPredicate}
    ORDER BY "nombre" ASC
    LIMIT ${limit}
  `);

  return sortByMatch(rows, query);
}

export async function resolveEmployeeDirectory(
  query: string,
  options: CatalogSearchOptions = {},
): Promise<DirectoryResolution<EmployeeDirectoryMatch>> {
  const items = await searchEmployeeDirectory(query, { ...options, limit: Math.max(options.limit ?? 8, 8) });
  return resolveMatches(items, query);
}
