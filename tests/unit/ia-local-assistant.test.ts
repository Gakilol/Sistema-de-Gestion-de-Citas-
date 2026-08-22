import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatLocalToolResult,
  parseAppointmentMessage,
  parseHumanDate,
  parseHumanTime,
  runLocalAssistant,
} from '@/lib/ia/local-assistant';

const executeIAToolMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ia/tools', () => ({ executeIATool: executeIAToolMock }));

describe('asistente local en lenguaje natural', () => {
  beforeEach(() => executeIAToolMock.mockReset());

  it('entiende una solicitud coloquial de cita sin exigir una frase exacta', () => {
    const draft = parseAppointmentMessage(
      'Quiero registrar una cita para el cliente Kevin Duarte, lo atenderá Álvaro el lunes a las 6am',
      {},
      '2026-08-22'
    );

    expect(draft).toMatchObject({
      cliente: 'Kevin Duarte',
      profesional: 'Álvaro',
      fecha: '2026-08-24',
      hora: '06:00',
    });
  });

  it('acepta respuestas cortas cuando está preguntando un dato concreto', () => {
    const draft = parseAppointmentMessage(
      'Corte y barba',
      { cliente: 'Kevin Duarte', awaitingField: 'servicio' },
      '2026-08-22'
    );

    expect(draft.servicio).toBe('Corte y barba');
    expect(draft.awaitingField).toBeUndefined();
  });

  it('convierte fechas y horas humanas a valores operativos', () => {
    expect(parseHumanDate('pasado mañana', '2026-08-22')).toBe('2026-08-24');
    expect(parseHumanDate('el lunes', '2026-08-22')).toBe('2026-08-24');
    expect(parseHumanDate('a las 10 de la mañana', '2026-08-22')).toBeUndefined();
    expect(parseHumanTime('a las 2:30 de la tarde')).toBe('14:30');
    expect(parseHumanTime('a las 9am')).toBe('09:00');
  });

  it('presenta citas sin filtrar ids ni JSON interno', () => {
    const text = formatLocalToolResult('getTodayAppointments', [{
      id: 'b0042dce-5232-4cd5-9a27-64906bd1128f',
      cliente_nombre: 'Juan Carlos Salazar',
      hora: '08:00',
      estado: 'COMPLETADA',
      servicio: { nombre: 'Corte' },
      empleado: { nombre: 'Álvaro Zeledón' },
    }]);

    expect(text).toContain('8:00');
    expect(text).toContain('Juan Carlos Salazar');
    expect(text).toContain('Corte');
    expect(text).not.toContain('b0042dce');
    expect(text).not.toContain('{"nombre"');
  });

  it('guía una cita con una sola pregunta y conserva el borrador', async () => {
    const response = await runLocalAssistant(
      [{ role: 'user', content: 'Necesito sacar una cita' }],
      { userId: 'user-1', userRole: 'ADMIN' }
    );

    expect(response.text).toBe('¿A nombre de quién será la cita?');
    expect(response.appointmentDraft).toMatchObject({ awaitingField: 'cliente' });
    expect(executeIAToolMock).not.toHaveBeenCalled();
  });

  it('prepara la cita cuando ya reunió todos los datos', async () => {
    executeIAToolMock.mockResolvedValue({
      ok: true,
      data: { readyForConfirmation: true },
      meta: { fuenteDatos: 'HAIR STYLE' },
      pendingAction: { type: 'CREATE_APPOINTMENT', title: 'Crear cita' },
    });

    const response = await runLocalAssistant([
      {
        role: 'assistant',
        content: '¿A qué hora desea la cita?',
        appointmentDraft: {
          cliente: 'Kevin Duarte',
          servicio: 'Corte y barba',
          profesional: 'Álvaro',
          fecha: '2026-08-24',
          awaitingField: 'hora',
        },
      },
      { role: 'user', content: 'a las 10 de la mañana' },
    ], { userId: 'user-1', userRole: 'ADMIN' });

    expect(executeIAToolMock).toHaveBeenCalledWith('prepareCreateAppointment', expect.objectContaining({
      cliente: 'Kevin Duarte',
      servicio: 'Corte y barba',
      profesional: 'Álvaro',
      fecha: '2026-08-24',
      hora: '10:00',
    }), expect.any(Object));
    expect(response.pendingAction).toMatchObject({ type: 'CREATE_APPOINTMENT' });
  });

  it('guía el registro de un cliente cuando falta el nombre', async () => {
    const response = await runLocalAssistant(
      [{ role: 'user', content: 'Quiero registrar un cliente' }],
      { userId: 'user-1', userRole: 'ADMIN' }
    );

    expect(response.text).toBe('¿Cómo se llama el cliente?');
    expect(response.clientDraft).toEqual({ awaitingField: 'nombre' });
    expect(executeIAToolMock).not.toHaveBeenCalled();
  });

  it('prepara un cliente desde una respuesta humana corta', async () => {
    executeIAToolMock.mockResolvedValue({
      ok: true,
      data: { readyForConfirmation: true },
      meta: { fuenteDatos: 'HAIR STYLE' },
      pendingAction: { type: 'CREATE_CLIENT', title: 'Registrar cliente' },
    });

    const response = await runLocalAssistant([
      {
        role: 'assistant',
        content: '¿Cómo se llama el cliente?',
        clientDraft: { awaitingField: 'nombre' },
      },
      { role: 'user', content: 'Kevin Duarte, teléfono 8888-7777' },
    ], { userId: 'user-1', userRole: 'ADMIN' });

    expect(executeIAToolMock).toHaveBeenCalledWith('prepareCreateClient', expect.objectContaining({
      nombre: 'Kevin Duarte',
      telefono: '8888-7777',
    }), expect.any(Object));
    expect(response.pendingAction).toMatchObject({ type: 'CREATE_CLIENT' });
  });
});
