import { describe, expect, it } from 'vitest';
import {
  clientMatchesQuery,
  normalizeClientPhone,
  normalizeClientText,
} from '@/lib/clients/client-normalization';

describe('normalización compartida de clientes', () => {
  const client = {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Álvaro   Zeledón',
    telefono: '+505 8888-7777',
    correo: 'Alvaro@Ejemplo.com',
    cedula: '001-240800-0001A',
  };

  it('ignora tildes, mayúsculas y espacios repetidos', () => {
    expect(normalizeClientText('  ALVARO   zeledon ')).toBe('alvaro zeledon');
    expect(clientMatchesQuery(client, 'alvaro zeledon')).toBe(true);
  });

  it('compara teléfonos por sus dígitos', () => {
    expect(normalizeClientPhone('+505 8888-7777')).toBe('50588887777');
    expect(clientMatchesQuery(client, '8888 7777')).toBe(true);
  });

  it('permite localizar por correo e identificador', () => {
    expect(clientMatchesQuery(client, 'alvaro@ejemplo.com')).toBe(true);
    expect(clientMatchesQuery(client, '11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(clientMatchesQuery(client, '001-240800')).toBe(true);
  });
});
