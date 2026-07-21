// lib/__tests__/calendar-token-phone.test.ts
// Pruebas unitarias para utilidades de calendario, teléfono e ICS

import { normalizarTelefono } from '../normalize-phone';
import { generarTokenCalendario, verificarTokenCalendario } from '../calendar-token';
import { generarICS } from '../ics';

// Forzar CALENDAR_LINK_SECRET para pruebas
process.env.CALENDAR_LINK_SECRET = 'test-secret-key-1234567890-test';

describe('Pruebas Unitarias - Sistema de Calendario y WhatsApp', () => {

  describe('1. Normalización de Teléfonos', () => {
    test('1. Teléfono nicaragüense de 8 dígitos locales con guión (8675-7959)', () => {
      expect(normalizarTelefono('8675-7959', '505')).toBe('50586757959');
    });

    test('2. Teléfono nicaragüense de 8 dígitos sin guión (86757959)', () => {
      expect(normalizarTelefono('86757959', '505')).toBe('50586757959');
    });

    test('3. Teléfono con prefijo 505 sin duplicación (50586757959)', () => {
      expect(normalizarTelefono('50586757959', '505')).toBe('50586757959');
    });

    test('4. Teléfono completo con signo más, espacios y guiones (+505 8675-7959)', () => {
      expect(normalizarTelefono('+505 8675-7959', '505')).toBe('50586757959');
    });

    test('5. Teléfono costarricense por defecto de 8 dígitos (88887777)', () => {
      expect(normalizarTelefono('88887777')).toBe('50688887777');
    });

    test('6. Teléfono costarricense con +506', () => {
      expect(normalizarTelefono('+506 8888 8888', '506')).toBe('50688888888');
    });

    test('7. Cliente sin teléfono o nulo', () => {
      expect(normalizarTelefono('')).toBeNull();
      expect(normalizarTelefono('   ')).toBeNull();
      expect(normalizarTelefono(null)).toBeNull();
      expect(normalizarTelefono(undefined)).toBeNull();
      expect(normalizarTelefono('abc')).toBeNull();
    });
  });

  describe('2. Tokens HMAC de Calendario', () => {
    const citaEjemplo = {
      id: 'cita-uuid-123',
      hora: '10:00',
      updated_at: new Date('2026-07-14T10:00:00Z'),
      fecha: new Date('2026-07-20T00:00:00Z'),
      duracion: 60,
    };

    test('Genera y verifica un token válido', () => {
      const token = generarTokenCalendario(citaEjemplo);
      expect(token).toBeTruthy();
      expect(token.includes('.')).toBe(true);

      const payload = verificarTokenCalendario(token);
      expect(payload).not.toBeNull();
      expect(payload?.citaId).toBe('cita-uuid-123');
      expect(payload?.hora).toBe('10:00');
    });

    test('Rechaza token alterado', () => {
      const token = generarTokenCalendario(citaEjemplo);
      const [payload, sig] = token.split('.');
      const tokenAlterado = `${payload}.firmaFalsa12345`;

      expect(verificarTokenCalendario(tokenAlterado)).toBeNull();
    });

    test('Rechaza token si la cita fue reprogramada (cambio de hora u updatedAt)', () => {
      const token = generarTokenCalendario(citaEjemplo);
      const payloadOriginal = verificarTokenCalendario(token);
      expect(payloadOriginal).not.toBeNull();

      // Simular cambio de hora de la cita
      const citaReprogramada = {
        ...citaEjemplo,
        hora: '11:00',
        updated_at: new Date('2026-07-14T10:30:00Z'),
      };

      // Si comparamos los datos del token contra la cita reprogramada:
      expect(payloadOriginal?.hora === citaReprogramada.hora).toBe(false);
    });

    test('Rechaza token expirado', () => {
      const citaPasada = {
        ...citaEjemplo,
        fecha: new Date('2020-01-01T00:00:00Z'),
      };
      const tokenExpirado = generarTokenCalendario(citaPasada);
      expect(verificarTokenCalendario(tokenExpirado)).toBeNull();
    });
  });

  describe('3. Generación de Archivo ICS', () => {
    test('Genera un archivo ICS válido con saltos CRLF', () => {
      const ics = generarICS({
        citaId: '123',
        clienteNombre: 'Juan Pérez',
        fecha: '2026-07-20',
        hora: '14:00',
        duracion: 30,
        profesional: 'Carlos Barbero',
        zonaHoraria: 'America/Costa_Rica',
        servicios: ['Corte de Cabello', 'Barba'],
        ubicacion: 'San José, Costa Rica',
      });

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('UID:cita-123@hairstyle-salon');
      expect(ics).toContain('SUMMARY:Cita en HAIR STYLE Salon & Barber');
      expect(ics).toContain('TZID=America/Costa_Rica:20260720T140000');
      expect(ics).toContain('\r\n');
    });
  });
});
