import type {
  AssistantIntent,
  DraftOperation,
  EmployeeOption,
  PendingField,
  ServiceOption,
  TimeOfDayWindow,
} from './domain';
import { isValidBusinessDateString } from '@/lib/timezone';

export function normalizeCommand(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const VOCABULARY = new Set(`
a acerca acuerdo adelante adelantar agrega agregar agendar agenda agendame agende agendo ahora al algo alguna algun algunas algunos am ambos anade anadir ante antes anula anular anularla apunta apuntame apuntar asigna asignar asistencia atender atenderlo ayer ayuda ayudame
bajo barbero bien borrador borrar buena buenas bueno buenos busca buscame buscar
cabello cambia cambiala cambialo cambiar cambiarla cambiarlo cancela cancelacion cancelaciones cancelada canceladas cancelala cancelalo cancelar cero chequea chequear cinco cita citas cliente clienta clientes como completada completadas con confirma confirmacion confirmada confirmadas confirmala confirmalo confirmar consulta consultar consultame correcto crea creame crear cual cuales cualquier cualquiera cuando cuanto cuarta cuarto cuatro cuenta cupo cupos
dale dame de del dentro descarta descartar desde despues dia dias dieciseis diecisiete dieciocho diecinueve diez dime disponibilidad disponible disponibles doce domingo donde dos
edita editar ejemplo el ella empezar en encontrar enero entonces error es esa esas ese eso espacio espacios esta estas este estilista estado estados estadisticas exacto existe
falta faltan favor febrero fecha fechas fin
gracias guarda guardala guardalo guardar
habra hacer hasta hay haz hazme hola hora horarios horas hoy hueco huecos
igual inasistencias incluir incluye informacion
jornada jueves julio junio
la las le libre libres lista listo lo los luego lunes
manana martes marzo mas mayo me media medianoche mediodia mejor menos mes mi misma mismo mis modifica modificar mostrar muestra muestrame muy
necesito ni ningun ninguna no noche noviembre nueva nuevo nueve numero
o ocho octubre ok olvidalo once opcion opciones otra otro
para pasa pasala pasalo pasado pasar pelo pendiente pendientes pero perdon pm poder podria podrias pon poner por porfavor posponer prepara preparame preparar primera primero profesional profesionales proxima proximo puede puedes puedo puntas punto
que queda quedan quiero quita quitar
registra registrame registrar reiniciar repetir reprograma reprogramacion reprogramada reprogramala reprogramalo reprogramar reserva reservame reservar resumen revisa revisar
sabado saber saca sacar se segunda segundo seis selecciona seleccionada seleccionado seleccionar semana septiembre servicio servicios setiembre sexta sexto si siete siguiente siguientes sin sino sirve solo
tambien tarde temprano tenga tengo tercera tercero termina terminar tiene tienen treinta trece tres tu turno turnos
u ultima ultimo un una unas uno unos
vale ver viernes
y ya
`.trim().split(/\s+/));

const CLIENT_STOP_WORDS = new Set([
  'a', 'al', 'am', 'antes', 'ayer', 'barbero', 'borrador', 'cambia', 'cambiala', 'cambialo', 'cambiar',
  'cancela', 'cancelar', 'cita', 'citas', 'cliente', 'clienta', 'con', 'confirma', 'confirmar',
  'cuando', 'cuarta', 'cuarto', 'cupo', 'cupos', 'de', 'del', 'descarta', 'despues', 'dia', 'dias',
  'disponibilidad', 'disponible', 'disponibles', 'domingo', 'el', 'ella', 'en', 'esa', 'ese', 'eso',
  'espacio', 'espacios', 'esta', 'estas', 'este', 'estilista', 'fecha', 'fechas', 'hora', 'horario',
  'horarios', 'hoy', 'jueves', 'la', 'las', 'libre', 'libres', 'los', 'lunes', 'manana', 'martes',
  'mas', 'medianoche', 'mediodia', 'mejor', 'mes', 'mi', 'miercoles', 'mis', 'mueve', 'mover',
  'noche', 'nueva', 'nuevo', 'o', 'opcion', 'opciones', 'otra', 'otro', 'para', 'pasado', 'pm',
  'por', 'primera', 'primero', 'profesional', 'profesionales', 'proxima', 'proximo', 'que',
  'quinta', 'quinto', 'reprograma', 'reprogramar', 'resumen', 'sabado', 'segunda', 'segundo',
  'semana', 'servicio', 'servicios', 'si', 'siguiente', 'sin', 'tarde', 'temprano', 'tercera',
  'tercero', 'tiene', 'tienen', 'ultima', 'ultimo', 'un', 'una', 'viernes', 'y',
]);

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\b(?:select\s+\*|drop\s+table|delete\s+from|insert\s+into|update\s+\w+\s+set|union\s+select|ejecuta\s+sql|\bsql\b)\b/i,
  /\b(?:ignora\s+(?:permisos|instrucciones|reglas)|salta\s+permisos|sin\s+permisos)\b/i,
  /\b(?:aq\.[a-z0-9_-]+|sk-[a-z0-9_-]+|ghp_[a-z0-9_-]+|bearer\s+\S+|eyj[a-z0-9_-]+\.)/i,
  /\b(?:claveprivada|password|contrasena|api_?key|secret|token)\b/i,
  /\b(?:mis\s+notas|alergia|diagnostico)\b/i,
  /\bllama\s+al\b/i,
];

const NUMBER_WORDS: Record<string, number> = {
  cero: 0, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  treinta: 30, cuarenta: 40, cincuenta: 50,
};

export interface SafeCommandOptions {
  allowClientPlaceholder?: boolean;
}

export interface LocalExtractionContext {
  pendingField?: PendingField | null;
  hasClientCandidates?: boolean;
}

export interface LocalExtractionResult {
  ok: boolean;
  blocked?: boolean;
  reason?: 'privacy' | 'unrecognized_tokens';
  safeText?: string;
  clientQuery?: string;
  clientDisambiguationHint?: string;
  ambiguousServices?: ServiceOption[];
  ambiguousEmployees?: EmployeeOption[];
  ambiguousServiceTerm?: string;
  ambiguousEmployeeTerm?: string;
}

export interface ParseLocalContext {
  hasDraft?: boolean;
  activeOperation?: DraftOperation | null;
  pendingField?: PendingField | null;
  currentDraftDate?: string | null;
}

function replaceCatalogAliases(
  normalizedText: string,
  services: ServiceOption[],
  employees: EmployeeOption[],
  options: { strictEmployeeBoundary?: boolean; detectAmbiguous?: boolean } = {},
) {
  let safe = normalizedText;
  const ambiguousServices: ServiceOption[] = [];
  let ambiguousServiceTerm: string | undefined;
  const ambiguousEmployees: EmployeeOption[] = [];
  let ambiguousEmployeeTerm: string | undefined;

  const serviceFullAliases: { alias: string; ref: string }[] = [];
  const serviceFirstWordMap = new Map<string, { item: ServiceOption; index: number }[]>();

  services.forEach((item, index) => {
    const full = normalizeCommand(item.nombre);
    if (full) serviceFullAliases.push({ alias: full, ref: `s${index}` });
    const words = full.split(' ').filter(Boolean);
    const first = words[0];
    if (first && first.length >= 3 && !VOCABULARY.has(first)) {
      const list = serviceFirstWordMap.get(first) ?? [];
      list.push({ item, index });
      serviceFirstWordMap.set(first, list);
    }
  });

  // 1. Replace full service names first (longest first)
  for (const { alias, ref } of serviceFullAliases.sort((a, b) => b.alias.length - a.alias.length)) {
    safe = safe.replace(new RegExp(`(?<![a-z0-9_])${escape(alias)}(?![a-z0-9_])`, 'g'), ref);
  }

  // 2. Replace unique service first-word aliases; capture ambiguous service keywords when requested
  for (const [word, entries] of serviceFirstWordMap.entries()) {
    const pattern = new RegExp(`(?<![a-z0-9_])${escape(word)}(?![a-z0-9_])`, 'g');
    if (!pattern.test(safe)) continue;
    if (entries.length === 1) {
      safe = safe.replace(pattern, `s${entries[0].index}`);
    } else if (options.detectAmbiguous) {
      if (!ambiguousServices.length) {
        ambiguousServices.push(...entries.map(entry => entry.item));
        ambiguousServiceTerm = word;
      }
      safe = safe.replace(pattern, 'servicio');
    }
  }

  // Also allow matching unique distinctive service keywords (e.g., "barba" in "Arreglo de barba")
  if (options.detectAmbiguous) {
    const keywordMap = new Map<string, { item: ServiceOption; index: number }[]>();
    services.forEach((item, index) => {
      const words = normalizeCommand(item.nombre).split(' ').filter(w => w.length >= 4 && !VOCABULARY.has(w));
      for (const word of new Set(words)) {
        const list = keywordMap.get(word) ?? [];
        list.push({ item, index });
        keywordMap.set(word, list);
      }
    });
    for (const [word, entries] of keywordMap.entries()) {
      const pattern = new RegExp(`(?<![a-z0-9_])${escape(word)}(?![a-z0-9_])`, 'g');
      if (!pattern.test(safe)) continue;
      if (entries.length === 1) {
        safe = safe.replace(pattern, `s${entries[0].index}`);
      } else if (!ambiguousServices.length) {
        ambiguousServices.push(...entries.map(entry => entry.item));
        ambiguousServiceTerm = word;
        safe = safe.replace(pattern, 'servicio');
      }
    }
  }

  // 3. Employees: full names first (longest first)
  const employeeFullAliases: { alias: string; ref: string }[] = [];
  const employeeFirstWordMap = new Map<string, { item: EmployeeOption; index: number }[]>();

  employees.forEach((item, index) => {
    const full = normalizeCommand(item.nombre);
    if (full) employeeFullAliases.push({ alias: full, ref: `e${index}` });
    const first = full.split(' ')[0];
    if (first && first.length >= 3 && !VOCABULARY.has(first)) {
      const list = employeeFirstWordMap.get(first) ?? [];
      list.push({ item, index });
      employeeFirstWordMap.set(first, list);
    }
  });

  for (const { alias, ref } of employeeFullAliases.sort((a, b) => b.alias.length - a.alias.length)) {
    safe = safe.replace(new RegExp(`(?<![a-z0-9_])${escape(alias)}(?![a-z0-9_])`, 'g'), ref);
  }

  for (const [first, entries] of employeeFirstWordMap.entries()) {
    const pattern = new RegExp(`(?<![a-z0-9_])${escape(first)}(?![a-z0-9_])`, 'g');
    if (!pattern.test(safe)) continue;
    if (entries.length === 1) {
      if (options.strictEmployeeBoundary) {
        // Avoid misidentifying a client like "a Ana López" as an employee named "Ana María".
        safe = safe.replace(
          new RegExp(`(?<![a-z0-9_])(${escape(first)})(?![a-z0-9_])(?:\\s+([a-z]+))?`, 'g'),
          (match, _name: string, nextWord: string | undefined, offset: number, fullStr: string) => {
            const before = fullStr.slice(Math.max(0, offset - 25), offset);
            const afterExplicitEmployeeCue = /\b(?:con|profesional|estilista|barbero)\s+$/.test(before);
            const nextIsUnknownSurname = Boolean(
              nextWord && !VOCABULARY.has(nextWord) && !/^(?:s|e)\d+$/.test(nextWord) && !CLIENT_STOP_WORDS.has(nextWord),
            );
            if (!afterExplicitEmployeeCue && nextIsUnknownSurname) {
              return match;
            }
            return nextWord ? `e${entries[0].index} ${nextWord}` : `e${entries[0].index}`;
          },
        );
      } else {
        safe = safe.replace(pattern, `e${entries[0].index}`);
      }
    } else if (options.detectAmbiguous) {
      const explicitEmpPattern = new RegExp(`\\b(con|profesional|estilista|barbero)\\s+${escape(first)}(?![a-z0-9_])`, 'g');
      if (explicitEmpPattern.test(safe)) {
        if (!ambiguousEmployees.length) {
          ambiguousEmployees.push(...entries.map(entry => entry.item));
          ambiguousEmployeeTerm = first;
        }
        safe = safe.replace(explicitEmpPattern, '$1 profesional');
      }
    }
  }

  return {
    text: safe,
    ambiguousServices,
    ambiguousServiceTerm,
    ambiguousEmployees,
    ambiguousEmployeeTerm,
  };
}

/** Fail closed: only an allowlisted operational vocabulary and opaque catalog references leave the app. */
export function prepareSafeCommand(
  message: string,
  services: ServiceOption[],
  employees: EmployeeOption[],
  options: SafeCommandOptions = {},
) {
  const normalized = normalizeCommand(message);
  if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(normalized))) {
    return { ok: false as const };
  }
  const { text: safe } = replaceCatalogAliases(normalized, services, employees);
  const validRefs = new Set([
    ...services.map((_, i) => `s${i}`),
    ...employees.map((_, i) => `e${i}`),
    ...(options.allowClientPlaceholder ? ['c0'] : []),
  ]);
  const tokens = safe.split(/[\s,.;¿?¡!]+/).filter(Boolean);
  if (
    !tokens.length
    || tokens.some(
      token =>
        !VOCABULARY.has(token)
        && !validRefs.has(token)
        && !/^(?:\d{1,2}|20\d{2}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:[01]?\d|2[0-3]):[0-5]\d)$/.test(token),
    )
  ) {
    return { ok: false as const };
  }
  return { ok: true as const, text: tokens.join(' ') };
}

function isNameWord(token: string): boolean {
  if (!token) return false;
  if (/^(?:s|e)\d+$/.test(token) || token === 'c0') return false;
  if (!/^[a-zñ]+(?:-[a-zñ]+)?$/.test(token)) return false;
  if (CLIENT_STOP_WORDS.has(token)) return false;
  return true;
}

function consumeNameSpan(tokens: string[], startIndex: number): number {
  let idx = startIndex;
  let count = 0;
  while (idx < tokens.length && count < 4) {
    const token = tokens[idx];
    if (isNameWord(token)) {
      idx += 1;
      count += 1;
      continue;
    }
    // Allow compound Spanish surnames ("de la Cruz", "del Valle") ONLY when followed by a non-stop surname word
    if (count >= 1 && (token === 'de' || token === 'del')) {
      if (tokens[idx + 1] === 'la' || tokens[idx + 1] === 'los') {
        if (idx + 2 < tokens.length && isNameWord(tokens[idx + 2])) {
          idx += 3;
          count += 1;
          continue;
        }
      } else if (idx + 1 < tokens.length && isNameWord(tokens[idx + 1])) {
        idx += 2;
        count += 1;
        continue;
      }
    }
    break;
  }
  return idx;
}

function isOrdinalOnlyUtterance(normalized: string): boolean {
  const cleaned = normalized.replace(/[¿?¡!.,]/g, '').trim();
  return /^(?:(?:el|la|opcion|numero)\s+)?(?:primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta|quinto|quinta|sexto|sexta|ultimo|ultima|uno|una|dos|tres|cuatro|cinco|seis|[1-6])$/.test(cleaned);
}

/**
 * Runs 100% locally inside NovaCita BEFORE Gemini is ever called.
 * Extracts client identity/disambiguation hints locally, replaces them with opaque `c0`,
 * replaces catalog entries with `sN`/`eN`, and validates the reduced command fail-closed.
 */
export function extractLocalEntitiesAndSanitize(
  rawMessage: string,
  services: ServiceOption[],
  employees: EmployeeOption[],
  context: LocalExtractionContext = {},
): LocalExtractionResult {
  const normalized = normalizeCommand(rawMessage);
  if (!normalized) return { ok: false, reason: 'unrecognized_tokens' };

  if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(normalized))) {
    return { ok: false, blocked: true, reason: 'privacy' };
  }

  // Emails are never allowed to leave NovaCita; only allow locally during active client disambiguation
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(normalized);
  if (hasEmail && !(context.pendingField === 'cliente' && context.hasClientCandidates)) {
    return { ok: false, blocked: true, reason: 'privacy' };
  }

  const catalogPass = replaceCatalogAliases(normalized, services, employees, {
    strictEmployeeBoundary: true,
    detectAmbiguous: true,
  });

  const extra = {
    ...(catalogPass.ambiguousServices.length ? { ambiguousServices: catalogPass.ambiguousServices, ambiguousServiceTerm: catalogPass.ambiguousServiceTerm } : {}),
    ...(catalogPass.ambiguousEmployees.length ? { ambiguousEmployees: catalogPass.ambiguousEmployees, ambiguousEmployeeTerm: catalogPass.ambiguousEmployeeTerm } : {}),
  };

  let working = catalogPass.text;
  let clientQuery: string | undefined;
  let clientDisambiguationHint: string | undefined;

  // Case A: Disambiguating among known client candidates (by phone suffix, email hint, or refined name)
  if (context.pendingField === 'cliente' && context.hasClientCandidates && !isOrdinalOnlyUtterance(working)) {
    const phoneDigitsMatch = working.match(/\b(\d{3,12})\b/);
    const hyphenPhoneMatch = working.match(/\b(\d{3,4}-\d{3,4})\b/);
    const emailHintMatch = working.match(/[a-z0-9._%+-]*@[a-z0-9.-]+/i) ?? working.match(/\b(?:gmail|hotmail|outlook|yahoo|icloud)\b/i);
    if (hyphenPhoneMatch || phoneDigitsMatch) {
      const digits = (hyphenPhoneMatch?.[1] ?? phoneDigitsMatch?.[1] ?? '').replace(/\D/g, '');
      // Avoid confusing a time ("a las 4") with phone suffix; phone hints have >= 3 digits
      if (digits.length >= 3) {
        clientDisambiguationHint = digits;
        return { ok: true, safeText: 'c0', clientDisambiguationHint, ...extra };
      }
    }
    if (emailHintMatch) {
      clientDisambiguationHint = emailHintMatch[0];
      return { ok: true, safeText: 'c0', clientDisambiguationHint, ...extra };
    }
  }

  // Case B: Direct reply when assistant just asked "¿Para qué cliente es la cita?"
  if (context.pendingField === 'cliente' && !isOrdinalOnlyUtterance(working)) {
    const cleanedTokens = working.replace(/[¿?¡!.,;]/g, ' ').split(/\s+/).filter(Boolean);
    const hasOperationalShift = /\b(?:mejor|cambia|cambiar|sabado|domingo|lunes|martes|miercoles|jueves|viernes|hoy|manana|horarios|disponibilidad|disponible|agenda|resumen|descarta|olvidalo|reiniciar|cancela|cancelar|reprograma|reprogramar|confirma|confirmar|s\d+|e\d+)\b/.test(working);
    if (!hasOperationalShift && cleanedTokens.length > 0 && cleanedTokens.length <= 6) {
      let start = 0;
      while (start < cleanedTokens.length && ['para', 'a', 'es', 'el', 'la', 'cliente', 'clienta', 'se', 'llama', 'con'].includes(cleanedTokens[start])) {
        start += 1;
      }
      const end = consumeNameSpan(cleanedTokens, start);
      if (end > start && end === cleanedTokens.length) {
        clientQuery = cleanedTokens.slice(start, end).join(' ');
        return { ok: true, safeText: 'c0', clientQuery, ...extra };
      }
    }
  }

  // Case C: Extract client mention inside a natural operational sentence
  const rawTokens = working.replace(/([¿?¡!.,;])/g, ' $1 ').split(/\s+/).filter(Boolean);
  const wordIndices: number[] = [];
  const words: string[] = [];
  rawTokens.forEach((tok, idx) => {
    if (!/^[¿?¡!.,;]$/.test(tok)) {
      wordIndices.push(idx);
      words.push(tok);
    }
  });

  const introducerSingle = new Set([
    'a', 'para', 'de', 'del', 'cliente', 'clienta', 'tiene', 'tienen',
    'agenda', 'agendar', 'agendame', 'reserva', 'reservar', 'reservame', 'apunta', 'apuntame', 'registra', 'registrame',
  ]);

  for (let i = 0; i < words.length; i++) {
    const token = words[i];
    if (!isNameWord(token)) continue;
    // Only extract if preceded by a recognized cue (or if it is an unknown name span right after an operational introducer)
    const prev = i > 0 ? words[i - 1] : '';
    const prev2 = i > 1 ? words[i - 2] : '';
    const hasClientCue =
      introducerSingle.has(prev)
      || (prev === 'cita' && ['tiene', 'es', 'la', 'una', 'para', 'de', 'nueva', 'reprogramar', 'reprograma', 'cancelar', 'cancela'].includes(prev2))
      || (prev === 'citas' && ['tiene', 'ver', 'mostrar', 'consultar', 'de'].includes(prev2));

    // Do NOT extract if preceded by "con" unless it's clearly not a professional (e.g. "con Ana" after "con" was already checked against employees)
    if (!hasClientCue) continue;
    // Ensure "para" + "corte" (already mapped to s0) or "para" + "hoy" won't match because s0/hoy fail isNameWord!
    const end = consumeNameSpan(words, i);
    if (end > i) {
      const candidateWords = words.slice(i, end);
      // Avoid capturing single common verbs/typos that aren't names unless clearly after a/para/de/cliente/tiene
      const allInVocab = candidateWords.every(w => VOCABULARY.has(w));
      if (!allInVocab) {
        clientQuery = candidateWords.join(' ');
        const startRaw = wordIndices[i];
        const endRaw = wordIndices[end - 1];
        const rebuilt = [
          ...rawTokens.slice(0, startRaw),
          'c0',
          ...rawTokens.slice(endRaw + 1),
        ];
        working = rebuilt.join(' ').replace(/\s+/g, ' ').trim();
        break;
      }
    }
  }

  const safe = prepareSafeCommand(working, services, employees, {
    allowClientPlaceholder: Boolean(clientQuery || clientDisambiguationHint),
  });

  if (!safe.ok) {
    return {
      ok: false,
      reason: 'unrecognized_tokens',
      clientQuery,
      clientDisambiguationHint,
      ...extra,
    };
  }

  return {
    ok: true,
    safeText: safe.text,
    clientQuery,
    clientDisambiguationHint,
    ...extra,
  };
}

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function parseSpanishExplicitDate(value: string, today: string): string | undefined {
  const iso = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const monthNames = Object.keys(SPANISH_MONTHS).join('|');
  const named = value.match(new RegExp(`\\b(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${monthNames})(?:\\s+(?:de|del)\\s+(20\\d{2}))?\\b`));
  if (named) {
    const day = Number(named[1]);
    const month = SPANISH_MONTHS[named[2]];
    let year = named[3] ? Number(named[3]) : Number(today.slice(0, 4));
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!named[3] && isValidBusinessDateString(candidate) && candidate < today) {
      year += 1;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return candidate;
  }

  const slash = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    let year = slash[3] ? (slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])) : Number(today.slice(0, 4));
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!slash[3] && isValidBusinessDateString(candidate) && candidate < today) {
      year += 1;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return candidate;
  }

  return undefined;
}

function extractOrdinalSelection(rawNormalized: string): { opcionIndice?: number; seleccionUltima?: boolean } {
  if (/\b(?:el|la)\s+ultim[oa]\b|\bultim[oa]\b/.test(rawNormalized)) {
    return { seleccionUltima: true };
  }
  const ordinalPatterns: [RegExp, number][] = [
    [/\b(?:primera|primero)\b/, 0],
    [/\b(?:segunda|segundo)\b/, 1],
    [/\b(?:tercera|tercero)\b/, 2],
    [/\b(?:cuarta|cuarto)\b/, 3],
    [/\b(?:quinta|quinto)\b/, 4],
    [/\b(?:sexta|sexto)\b/, 5],
  ];
  for (const [pattern, index] of ordinalPatterns) {
    if (pattern.test(rawNormalized)) {
      return { opcionIndice: index };
    }
  }
  const explicitOption = rawNormalized.match(/\b(?:opcion|numero)\s+(uno|una|dos|tres|cuatro|cinco|seis|[1-6])\b/);
  if (explicitOption) {
    const map: Record<string, number> = { uno: 0, una: 0, dos: 1, tres: 2, cuatro: 3, cinco: 4, seis: 5 };
    const raw = explicitOption[1];
    return { opcionIndice: raw in map ? map[raw] : Number(raw) - 1 };
  }
  // Standalone short choice like "la 2", "el 1", "2", "dos" (never matching "a las 2" or "las 2")
  const standalone = rawNormalized.replace(/[¿?¡!.,]/g, '').trim();
  const bareMatch = standalone.match(/^(?:(?:el|la)\s+)?(uno|una|dos|tres|cuatro|cinco|seis|[1-6])$/);
  if (bareMatch) {
    const map: Record<string, number> = { uno: 0, una: 0, dos: 1, tres: 2, cuatro: 3, cinco: 4, seis: 5 };
    const raw = bareMatch[1];
    return { opcionIndice: raw in map ? map[raw] : Number(raw) - 1 };
  }
  return {};
}

function extractTimeWindow(normalized: string): TimeOfDayWindow | undefined {
  if (/\b(?:por|en|de)\s+la\s+manana\b|\btemprano\b/.test(normalized)) return 'manana';
  if (/\b(?:por|en|de)\s+la\s+tarde\b/.test(normalized)) return 'tarde';
  if (/\b(?:por|en|de)\s+la\s+noche\b|\bnoche\b/.test(normalized)) return 'noche';
  // Standalone "tarde" (not "mas tarde")
  if (/(?<!mas )\btarde\b/.test(normalized)) return 'tarde';
  return undefined;
}

export function parseLocalCommand(
  text: string,
  today: string,
  hasDraft = false,
  context: ParseLocalContext = {},
): AssistantIntent {
  const effectiveHasDraft = hasDraft || Boolean(context.hasDraft);
  const rawNormalized = normalizeCommand(text);
  const { opcionIndice, seleccionUltima } = extractOrdinalSelection(rawNormalized);
  const franja = extractTimeWindow(rawNormalized);

  const value = rawNormalized.replace(/\b[a-z]+\b/g, word => NUMBER_WORDS[word]?.toString() ?? word);

  // ─── Dates ─────────────────────────────────────────────────────────────────
  let fecha = parseSpanishExplicitDate(value, today);
  if (!fecha) {
    const inDays = value.match(/\b(?:en|dentro\s+de)\s+(\d{1,2})\s+dias?\b/);
    if (inDays) {
      fecha = addDays(today, Number(inDays[1]));
    } else if (/\bpasado manana\b/.test(value)) {
      fecha = addDays(today, 2);
    } else if (/(?<!la )\bmanana\b/.test(value)) {
      fecha = addDays(today, 1);
    } else if (/\bhoy\b/.test(value)) {
      fecha = today;
    } else if (/\bayer\b/.test(value)) {
      fecha = addDays(today, -1);
    } else {
      const weekdays = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const index = weekdays.findIndex(day => new RegExp(`\\b${day}\\b`).test(value));
      if (index >= 0) {
        let offset = (index - new Date(`${today}T12:00:00Z`).getUTCDay() + 7) % 7;
        const asksNextWeek = /\b(?:proximo|proxima)\b/.test(value) || /\bque viene\b/.test(value);
        if (asksNextWeek && offset === 0) offset = 7;
        fecha = addDays(today, offset);
      }
    }
  }

  // ─── Times ─────────────────────────────────────────────────────────────────
  let hora: string | undefined;
  let horaAmbigua = false;
  const clockAmPm = value.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)\b/);
  const clock = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const spokenMinus = value.match(/\b(?:a la|a las|las|hora|de la|de las)\s+(\d{1,2})\s+menos\s+(cuarto|\d{1,2})\b/);
  const spoken = value.match(/\b(?:a la|a las|las|hora|de la|de las)\s+(\d{1,2})(?:\s+y\s+(media|cuarto|\d{1,2}))?(?:\s+en\s+punto)?\b/);

  if (/\bmediodia\b/.test(value)) {
    hora = '12:00';
  } else if (/\bmedianoche\b/.test(value)) {
    hora = '00:00';
  } else if (clockAmPm) {
    let hour = Number(clockAmPm[1]);
    const minute = clockAmPm[2] ? Number(clockAmPm[2]) : 0;
    const isPm = clockAmPm[3].startsWith('p');
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    if (hour <= 23 && minute <= 59) {
      hora = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  } else if (spokenMinus) {
    let hour = Number(spokenMinus[1]) - 1;
    const minusMin = spokenMinus[2] === 'cuarto' ? 15 : Number(spokenMinus[2]);
    const minute = 60 - minusMin;
    if (hour <= 0) hour = 12;
    const pm = /\b(tarde|noche)\b/.test(value);
    const am = /\bde la manana\b|\bpor la manana\b|\ben la manana\b/.test(value);
    horaAmbigua = !pm && !am && hour >= 1 && hour <= 12;
    if (pm && hour < 12) hour += 12;
    if (am && hour === 12) hour = 0;
    if (hour <= 23 && minute >= 0 && minute <= 59) {
      hora = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  } else if (clock || spoken) {
    const time = clock ?? spoken!;
    let hour = Number(time[1]);
    const minute = clock ? Number(time[2]) : time[2] === 'media' ? 30 : time[2] === 'cuarto' ? 15 : Number(time[2] ?? 0);
    const pm = /\b(tarde|noche)\b/.test(value);
    const am = /\bde la manana\b|\bpor la manana\b|\ben la manana\b/.test(value);
    horaAmbigua = !clock && !pm && !am && hour >= 1 && hour <= 12;
    if (pm && hour < 12) hour += 12;
    if (am && hour === 12) hour = 0;
    if (hour <= 23 && minute <= 59) {
      hora = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  const servicios = [...new Set(value.match(/\bs\d+\b/g) ?? [])];
  const profesional = value.match(/\be\d+\b/)?.[0];
  const tieneCliente = /\bc0\b/.test(value);
  const cualquierProfesional = /\bcualquier(?:a)?\s+(?:profesional|estilista|barbero|persona)\b|\bcon\s+quien\s+(?:tenga|este|haya)\b/.test(rawNormalized);
  const cambioExplicitoFecha = Boolean(fecha && !hora);

  // ─── Intent / Action ───────────────────────────────────────────────────────
  let accion: AssistantIntent['accion'] = 'ayuda';

  const isDiscard = /\b(?:descarta|descartar|olvidalo|empezar de nuevo|reiniciar|borrar borrador|cancelar borrador)\b/.test(rawNormalized);
  const isConfirmSignal =
    !servicios.length && !fecha && !hora && !tieneCliente && opcionIndice === undefined && !seleccionUltima
    && /\b(?:confirma|confirmar|confirmala|confirmalo|guarda|guardala|guardalo|agendala|agendalo)\b/.test(rawNormalized)
    && !/\b(?:confirmadas|confirmada)\b/.test(rawNormalized);
  const isBareYesConfirm =
    effectiveHasDraft && context.pendingField === 'confirmacion'
    && /^(?:si|si claro|si por favor|dale|listo|perfecto|de acuerdo|correcto|ok|vale|si confirma|si confirmala|confirma)$/.test(rawNormalized.replace(/[¿?¡!.,]/g, '').trim());

  const hasBookingVerb = /\b(crear|crea|creame|haz|hazme|agendar|agendame|agende|agendo|anadir|apuntar|apuntame|asignar|asigna|nueva|nuevo|prepara|preparar|preparame|registrar|registra|registrame|reservar|reserva|reservame|sacar|saca)\b/.test(rawNormalized)
    || /\b(?:agenda|quiero|necesito)\b.*\b(?:cita|servicio|s\d+|c0)\b/.test(value)
    || /^agenda\s+(?:a|para)\s+c0\b/.test(value);

  const hasRescheduleVerb = /\b(reprogramar|reprograma|reprogramala|reprogramalo|mover|mueve|muevela|muevelo|posponer|adelantar|pasar la cita|pasala|pasalo)\b/.test(rawNormalized)
    || (!effectiveHasDraft && /\b(?:cambiar|cambia|cambiala|cambialo)\s+(?:la\s+)?cita\b/.test(rawNormalized));

  const hasCancelVerb = /\b(cancelar|cancela|cancelala|cancelalo|anular|anula|anularla)\b/.test(rawNormalized)
    && !/\b(cancelaciones|canceladas|cancelada)\b/.test(rawNormalized);

  if (isDiscard) {
    accion = 'descartar';
  } else if (isConfirmSignal || isBareYesConfirm) {
    accion = 'confirmar_resumen';
  } else if (/\b(resumen|estadisticas|cancelaciones|asistencia|inasistencias)\b/.test(rawNormalized)) {
    accion = 'resumen';
  } else if (hasCancelVerb) {
    accion = 'cancelar';
  } else if (hasRescheduleVerb) {
    accion = 'reprogramar';
  } else if (hasBookingVerb) {
    accion = 'borrador';
  } else if (/\b(disponibilidad|disponible|disponibles|libre|libres|hueco|huecos|horarios|espacio|espacios|cupo|cupos)\b/.test(rawNormalized)) {
    accion = 'disponibilidad';
  } else if (/\b(agenda|citas|mostrar|muestra|muestrame|ver|consulta|consultar|cuando)\b/.test(rawNormalized) && !(effectiveHasDraft && (opcionIndice !== undefined || seleccionUltima))) {
    accion = 'agenda';
  } else if (
    effectiveHasDraft
    && (
      opcionIndice !== undefined
      || seleccionUltima
      || fecha
      || hora
      || franja
      || servicios.length > 0
      || profesional
      || tieneCliente
      || cualquierProfesional
      || /\b(mejor|cambiar|cambia|cambiala|cambialo|otro|otra|esa|ese|solo)\b/.test(rawNormalized)
    )
  ) {
    accion = context.activeOperation === 'reprogramar'
      ? 'reprogramar'
      : context.activeOperation === 'cancelar'
        ? 'cancelar'
        : 'borrador';
  } else if (servicios.length > 0 && (fecha || hora || franja || tieneCliente)) {
    accion = 'borrador';
  } else if (tieneCliente && /\bcita\b/.test(rawNormalized)) {
    accion = 'agenda';
  }

  return {
    accion,
    ...(fecha ? { fecha } : {}),
    ...(hora ? { hora } : {}),
    ...(franja ? { franja } : {}),
    horaAmbigua,
    servicios,
    ...(profesional ? { profesional } : {}),
    periodo: /\bmes\b/.test(rawNormalized) ? 'mes' : /\bsemana\b/.test(rawNormalized) ? 'semana' : 'dia',
    ...(opcionIndice !== undefined ? { opcionIndice } : {}),
    ...(seleccionUltima ? { seleccionUltima: true } : {}),
    ...(tieneCliente ? { tieneCliente: true } : {}),
    ...(cualquierProfesional ? { cualquierProfesional: true } : {}),
    ...(cambioExplicitoFecha ? { cambioExplicitoFecha: true } : {}),
  };
}

export function validIntentDate(date: string | undefined): boolean {
  return !date || isValidBusinessDateString(date);
}
