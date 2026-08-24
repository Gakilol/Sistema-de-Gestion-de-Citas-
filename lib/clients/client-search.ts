import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normalizeClientPhone, normalizeClientText } from './client-normalization';

export interface ClientDirectoryMatch {
  id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  cedula: string | null;
}

type ClientSearchDb = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

interface ClientSearchOptions {
  limit?: number;
  db?: ClientSearchDb;
}

export type ClientResolution =
  | { kind: 'found'; client: ClientDirectoryMatch }
  | { kind: 'ambiguous'; clients: ClientDirectoryMatch[] }
  | { kind: 'not_found'; clients: [] };

const ACCENTED = 'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ';
const PLAIN = 'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC';

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function rankClient(client: ClientDirectoryMatch, query: string): number {
  const normalizedQuery = normalizeClientText(query);
  const normalizedPhoneQuery = normalizeClientPhone(query);
  const normalizedName = normalizeClientText(client.nombre);
  const normalizedEmail = normalizeClientText(client.correo);
  const normalizedIdDocument = normalizeClientText(client.cedula);
  const normalizedPhone = normalizeClientPhone(client.telefono);

  if (client.id.toLocaleLowerCase() === normalizedQuery) return 0;
  if (normalizedName === normalizedQuery) return 1;
  if (normalizedEmail && normalizedEmail === normalizedQuery) return 1;
  if (normalizedIdDocument && normalizedIdDocument === normalizedQuery) return 1;
  if (normalizedPhoneQuery.length >= 3 && (
    normalizedPhone === normalizedPhoneQuery
      || normalizedPhone.endsWith(normalizedPhoneQuery)
  )) return 1;
  if (normalizedName.startsWith(normalizedQuery)) return 2;
  if (normalizedEmail.startsWith(normalizedQuery)) return 3;
  return 4;
}

export function isExactClientDirectoryMatch(client: ClientDirectoryMatch, query: string): boolean {
  const normalizedQuery = normalizeClientText(query);
  const normalizedPhoneQuery = normalizeClientPhone(query);
  const normalizedPhone = normalizeClientPhone(client.telefono);
  return client.id.toLocaleLowerCase() === normalizedQuery
    || normalizeClientText(client.nombre) === normalizedQuery
    || normalizeClientText(client.correo) === normalizedQuery
    || normalizeClientText(client.cedula) === normalizedQuery
    || (normalizedPhoneQuery.length >= 3 && (
      normalizedPhone === normalizedPhoneQuery
        || normalizedPhone.endsWith(normalizedPhoneQuery)
    ));
}

export async function searchClientDirectory(
  rawQuery: string,
  options: ClientSearchOptions = {},
): Promise<ClientDirectoryMatch[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  const db = options.db ?? (prisma as unknown as ClientSearchDb);
  const limit = Math.min(500, Math.max(1, options.limit ?? 8));
  const normalizedQuery = normalizeClientText(query);
  const phoneQuery = normalizeClientPhone(query);
  const textPattern = `%${escapeLike(normalizedQuery)}%`;
  const phonePattern = `%${escapeLike(phoneQuery)}%`;
  const emailPattern = `%${escapeLike(query.toLocaleLowerCase())}%`;

  const predicates: Prisma.Sql[] = [
    Prisma.sql`REGEXP_REPLACE(LOWER(TRANSLATE(COALESCE("nombre", ''), ${ACCENTED}, ${PLAIN})), '\\s+', ' ', 'g') LIKE ${textPattern} ESCAPE '\\'`,
    Prisma.sql`LOWER(COALESCE("correo", '')) LIKE ${emailPattern} ESCAPE '\\'`,
    Prisma.sql`LOWER(COALESCE("cedula", '')) LIKE ${emailPattern} ESCAPE '\\'`,
    Prisma.sql`"id"::text = ${query.toLocaleLowerCase()}`,
  ];
  if (phoneQuery.length >= 3) {
    predicates.push(Prisma.sql`REGEXP_REPLACE(COALESCE("telefono", ''), '\\D', '', 'g') LIKE ${phonePattern} ESCAPE '\\'`);
  }

  const rows = await db.$queryRaw<ClientDirectoryMatch[]>(Prisma.sql`
    SELECT "id", "nombre", "telefono", "correo", "cedula"
    FROM "Cliente"
    WHERE ${Prisma.join(predicates, ' OR ')}
    LIMIT ${Math.max(limit * 4, 24)}
  `);

  return [...rows]
    .sort((a, b) => rankClient(a, query) - rankClient(b, query) || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limit);
}

export async function resolveClientDirectory(
  query: string,
  options: ClientSearchOptions = {},
): Promise<ClientResolution> {
  const clients = await searchClientDirectory(query, { ...options, limit: Math.max(options.limit ?? 8, 8) });
  const exact = clients.filter((client) => isExactClientDirectoryMatch(client, query));
  if (exact.length === 1) return { kind: 'found', client: exact[0] };
  if (exact.length > 1) return { kind: 'ambiguous', clients: exact };
  if (clients.length === 1) return { kind: 'found', client: clients[0] };
  if (clients.length > 1) return { kind: 'ambiguous', clients };
  return { kind: 'not_found', clients: [] };
}
