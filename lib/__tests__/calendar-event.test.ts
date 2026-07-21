import { buildGoogleCalendarUrl, calcularFinCita } from '../calendar-event';

describe('Evento de calendario', () => {
  test.each([
    [15, '09:15'],
    [30, '09:30'],
    [45, '09:45'],
    [60, '10:00'],
    [135, '11:15'],
  ])('calcula %i minutos desde las 09:00', (duracion, horaFin) => {
    expect(calcularFinCita('2026-07-21', '09:00', duracion)).toEqual({ fecha: '2026-07-21', hora: horaFin });
  });

  test('cruza mediodia y conserva la fecha', () => {
    expect(calcularFinCita('2026-07-21', '11:45', 30)).toEqual({ fecha: '2026-07-21', hora: '12:15' });
  });

  test('mantiene el horario real incluso fuera del horario laboral', () => {
    expect(calcularFinCita('2026-07-21', '19:45', 30)).toEqual({ fecha: '2026-07-21', hora: '20:15' });
  });

  test('cruza de fecha y conserva caracteres especiales', () => {
    const url = buildGoogleCalendarUrl({
      fecha: '2026-07-21',
      hora: '23:45',
      duracion: 30,
      zonaHoraria: 'America/Managua',
      profesional: 'Ana & José',
      servicios: ['Corte & barba', 'Tinte, rubí'],
      ubicacion: 'Managua, Nicaragua',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('dates')).toBe('20260721T234500/20260722T001500');
    expect(parsed.searchParams.get('ctz')).toBe('America/Managua');
    expect(parsed.searchParams.get('details')).toContain('Ana & José');
    expect(parsed.searchParams.get('details')).toContain('Tinte, rubí');
  });

  test('la variante interna identifica al cliente, servicio y duración', () => {
    const url = new URL(buildGoogleCalendarUrl({
      fecha: '2026-07-21',
      hora: '09:00',
      duracion: 30,
      zonaHoraria: 'America/Managua',
      clienteNombre: 'Mario Soto',
      profesional: 'Alvaro Zeledon',
      servicios: ['Barba - Facial'],
      variante: 'interno',
    }));

    expect(url.searchParams.get('text')).toBe('Cita - Mario Soto');
    expect(url.searchParams.get('details')).toContain('Cliente: Mario Soto');
    expect(url.searchParams.get('details')).toContain('Servicio: Barba - Facial');
    expect(url.searchParams.get('details')).toContain('Duración: 30 minutos');
    expect(url.searchParams.get('details')).toContain('Atendido por: Alvaro Zeledon');
    expect(url.searchParams.get('details')).not.toContain('Recuerde presentarse');
  });

  test('la variante interna etiqueta varios servicios y conserva duración y horario', () => {
    const url = new URL(buildGoogleCalendarUrl({
      fecha: '2026-07-21',
      hora: '09:00',
      duracion: 90,
      zonaHoraria: 'America/Managua',
      clienteNombre: 'Mario Soto',
      profesional: 'Alvaro Zeledon',
      servicios: ['Barba', 'Facial'],
      variante: 'interno',
    }));

    expect(url.searchParams.get('details')).toContain('Servicios: Barba, Facial');
    expect(url.searchParams.get('details')).toContain('Duración: 90 minutos');
    expect(url.searchParams.get('dates')).toBe('20260721T090000/20260721T103000');
    expect(url.searchParams.get('ctz')).toBe('America/Managua');
  });

  test('la variante cliente conserva título, descripción, fecha y zona horaria', () => {
    const url = new URL(buildGoogleCalendarUrl({
      fecha: '2026-07-21',
      hora: '09:00',
      duracion: 30,
      zonaHoraria: 'America/Managua',
      clienteNombre: 'Mario Soto',
      profesional: 'Alvaro Zeledon',
      servicios: ['Barba - Facial'],
    }));

    expect(url.searchParams.get('text')).toBe('Cita en HAIR STYLE Salon & Barber');
    expect(url.searchParams.get('details')).toBe('Profesional: Alvaro Zeledon\nServicios: Barba - Facial\n\nRecuerde presentarse 5 minutos antes de su cita.');
    expect(url.searchParams.get('dates')).toBe('20260721T090000/20260721T093000');
    expect(url.searchParams.get('ctz')).toBe('America/Managua');
  });
});
