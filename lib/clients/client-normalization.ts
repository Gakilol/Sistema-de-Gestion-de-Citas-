export function normalizeClientText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeClientPhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function clientMatchesQuery(
  client: { id?: string | null; nombre?: string | null; telefono?: string | null; correo?: string | null; cedula?: string | null },
  query: string,
): boolean {
  const textQuery = normalizeClientText(query);
  const phoneQuery = normalizeClientPhone(query);
  if (!textQuery) return true;

  return Boolean(
    client.id?.toLocaleLowerCase().includes(textQuery)
      || normalizeClientText(client.nombre).includes(textQuery)
      || normalizeClientText(client.correo).includes(textQuery)
      || normalizeClientText(client.cedula).includes(textQuery)
      || (phoneQuery.length >= 3 && normalizeClientPhone(client.telefono).includes(phoneQuery)),
  );
}
