import type { AssistantIntent, EmployeeOption, ServiceOption } from './domain';
import { isValidBusinessDateString } from '@/lib/timezone';

export function normalizeCommand(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VOCABULARY = new Set(`crear crea creame haz hazme pelo cabello puntas a al algo alguna algun algunas algunos ante antes ahora ayuda ayudame agendar agenda agendame agende agendo anadir apuntar apuntame asignar asigna atender atenderlo bajo buscar busca buscame cambiar cambia cambiala cambiarla cambialo cambiarlo canceladas cita citas como con confirmadas consulta consultar consultame consultar disponibles disponible disponibilidad dame de del desde despues dia dias domingo dos el ella empleado empleados en encontrar entonces es esta este estas estado estados estadisticas existe fecha fechas fin favor falta faltan hacer hasta hay hola horario horarios hoy hueco huecos incluir incluye igual jornada la las le libre libres lo los luego lunes manana martes miercoles jueves mas me mediodia medianoche mejor mes mi mismo mis mostrar muestra muestrame muy necesito nueva nuevo noche no nueve ocho otra otro para pasado pendientes pendiente pero por porfavor prepara preparar preparame profesional profesionales proxima proximo que quiero registrar registra registrame reservar reserva reservame resumen sabado se semana servicio servicios si siete sin seis solo tarde temprano tengo tres turno un una uno unas unos ver viernes y ya ayer completadas cancelaciones asistencia inasistencias diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte veintiuno veintidos veintitres veinticuatro treinta cuarenta cincuenta cero cuatro cinco media cuarto minutos minuto horas hora quitar quita elimina retirar ningun ninguna ambos tambien primero segundo siguiente seleccionar seleccionado seleccionada gracias puedes podria podrias favor informacion repetir misma mismo consultar ver mis completada cancelada confirmada no_show pendiente en_progreso reprogramada`.split(' '));

/** Fail closed: only an allowlisted operational vocabulary and opaque catalog references leave the app. */
export function prepareSafeCommand(message: string, services: ServiceOption[], employees: EmployeeOption[]) {
  let safe = normalizeCommand(message);
  const references: { alias: string; ref: string }[] = [];
  const addAliases = (items: { nombre: string }[], prefix: string) => {
    const firstNames = items.map(item => normalizeCommand(item.nombre).split(' ')[0]);
    items.forEach((item, index) => {
      const full = normalizeCommand(item.nombre);
      if (full) references.push({ alias: full, ref: `${prefix}${index}` });
      const first = firstNames[index];
      if (first && first.length >= 3 && firstNames.filter(name => name === first).length === 1 && !VOCABULARY.has(first)) {
        references.push({ alias: first, ref: `${prefix}${index}` });
      }
    });
  };
  addAliases(services, 's');
  addAliases(employees, 'e');
  for (const { alias, ref } of references.sort((a, b) => b.alias.length - a.alias.length)) {
    safe = safe.replace(new RegExp(`(?<![a-z0-9_])${escape(alias)}(?![a-z0-9_])`, 'g'), ref);
  }
  const validRefs = new Set([...services.map((_, i) => `s${i}`), ...employees.map((_, i) => `e${i}`)]);
  const tokens = safe.split(/[\s,.;¿?¡!]+/).filter(Boolean);
  if (!tokens.length || tokens.some(token => !VOCABULARY.has(token) && !validRefs.has(token)
    && !/^(?:\d{1,2}|20\d{2}|\d{4}-\d{2}-\d{2}|(?:[01]?\d|2[0-3]):[0-5]\d)$/.test(token))) {
    return { ok: false as const };
  }
  return { ok: true as const, text: tokens.join(' ') };
}

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function parseLocalCommand(text: string, today: string, hasDraft = false): AssistantIntent {
  let value = normalizeCommand(text);
  const numbers: Record<string, number> = { cero: 0, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, treinta: 30, cuarenta: 40, cincuenta: 50 };
  value = value.replace(/\b[a-z]+\b/g, word => numbers[word]?.toString() ?? word);
  let fecha: string | undefined = value.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (!fecha) {
    if (/\bpasado manana\b/.test(value)) fecha = addDays(today, 2);
    else if (/(?<!la )\bmanana\b/.test(value)) fecha = addDays(today, 1);
    else if (/\bhoy\b/.test(value)) fecha = today;
    else if (/\bayer\b/.test(value)) fecha = addDays(today, -1);
    else {
      const weekdays = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const index = weekdays.findIndex(day => new RegExp(`\\b${day}\\b`).test(value));
      if (index >= 0) fecha = addDays(today, (index - new Date(`${today}T12:00:00Z`).getUTCDay() + 7) % 7);
    }
  }
  let hora: string | undefined;
  let horaAmbigua = false;
  const clock = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const spoken = value.match(/\b(?:a las?|las?|hora)\s+(\d{1,2})(?:\s+y\s+(media|cuarto|\d{1,2}))?\b/);
  const time = clock ?? spoken;
  if (/\bmediodia\b/.test(value)) hora = '12:00';
  else if (/\bmedianoche\b/.test(value)) hora = '00:00';
  else if (time) {
    let hour = Number(time[1]);
    const minute = clock ? Number(time[2]) : time[2] === 'media' ? 30 : time[2] === 'cuarto' ? 15 : Number(time[2] ?? 0);
    const pm = /\b(tarde|noche)\b/.test(value);
    const am = /\bde la manana\b|\bpor la manana\b/.test(value);
    horaAmbigua = !clock && !pm && !am && hour >= 1 && hour <= 12;
    if (pm && hour < 12) hour += 12;
    if (am && hour === 12) hour = 0;
    if (hour <= 23 && minute <= 59) hora = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  let accion: AssistantIntent['accion'] = 'ayuda';
  if (/\b(resumen|estadisticas|cancelaciones|asistencia|inasistencias)\b/.test(value)) accion = 'resumen';
  else if (/\b(disponibilidad|disponible|disponibles|libre|libres|hueco|huecos|horarios)\b/.test(value)) accion = 'disponibilidad';
  else if (/\b(crear|crea|creame|haz|hazme|agendar|agendame|agende|agendo|anadir|apuntar|apuntame|asignar|asigna|nueva|nuevo|prepara|preparar|preparame|registrar|registra|registrame|reservar|reserva|reservame)\b/.test(value) || /\b(?:agenda|quiero|necesito)\b.*\b(?:cita|s\d+)\b/.test(value)) accion = 'borrador';
  else if (/\b(agenda|citas|mostrar|muestra|muestrame|ver|consulta|consultar)\b/.test(value)) accion = 'agenda';
  else if (hasDraft && (fecha || hora || /\b(mejor|cambiar|cambia|cambiala|otro|otra|s\d+|e\d+)\b/.test(value))) accion = 'borrador';
  return {
    accion, ...(fecha ? { fecha } : {}), ...(hora ? { hora } : {}), horaAmbigua,
    servicios: [...new Set(value.match(/\bs\d+\b/g) ?? [])], profesional: value.match(/\be\d+\b/)?.[0],
    periodo: /\bmes\b/.test(value) ? 'mes' : /\bsemana\b/.test(value) ? 'semana' : 'dia',
  };
}

export function validIntentDate(date: string | undefined): boolean {
  return !date || isValidBusinessDateString(date);
}
