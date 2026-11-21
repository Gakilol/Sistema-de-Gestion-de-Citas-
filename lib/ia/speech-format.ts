import { formatDBDateLong } from '@/lib/timezone';
import { formatTime12Hour, parse24hToNormal } from '@/lib/time-utils';
import type { AgendaRow, AppointmentCandidate, ClientCandidate, OfferedSlot, ServiceOption, TimeOfDayWindow } from './domain';

const ORDINAL_FEM = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta'];
const ORDINAL_MASC = ['primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto'];

export function formatDateSpanish(fechaYYYYMMDD: string): string {
  return formatDBDateLong(`${fechaYYYYMMDD}T00:00:00Z`).replace(/,?\s+de\s+\d{4}$/, '').replace(/,\s*/, ' ');
}

export function formatTimeSpoken(time24: string): string {
  const { hour12, minute, period } = parse24hToNormal(time24);
  const periodPhrase =
    period === 'AM'
      ? 'de la mañana'
      : hour12 === 12
        ? 'del mediodía'
        : hour12 >= 7
          ? 'de la noche'
          : 'de la tarde';
  if (minute === 0) return `${hour12} ${periodPhrase}`;
  if (minute === 30) return `${hour12} y media ${periodPhrase}`;
  if (minute === 15) return `${hour12} y cuarto ${periodPhrase}`;
  return `${hour12} y ${minute} ${periodPhrase}`;
}

export function formatSlotListText(slots: OfferedSlot[], showDatePerSlot: boolean): string {
  return slots
    .map((slot, idx) => {
      const datePart = showDatePerSlot ? `${formatDateSpanish(slot.fecha)} · ` : '';
      return `${idx + 1}) ${datePart}${formatTime12Hour(slot.hora)} con ${slot.empleadoNombre}`;
    })
    .join('\n');
}

export function formatSlotListSpoken(slots: OfferedSlot[], showDatePerSlot: boolean): string {
  const sameEmployee = slots.length > 0 && slots.every(slot => slot.empleadoId === slots[0].empleadoId);
  const parts = slots.slice(0, 5).map((slot, idx) => {
    const label = ORDINAL_FEM[idx] ?? `opción ${idx + 1}`;
    const datePart = showDatePerSlot ? `${formatDateSpanish(slot.fecha)} a las ` : '';
    const empPart = sameEmployee ? '' : ` con ${slot.empleadoNombre}`;
    return `${label}, ${datePart}${formatTimeSpoken(slot.hora)}${empPart}`;
  });
  const suffix = sameEmployee && slots[0] ? `, con ${slots[0].empleadoNombre}` : '';
  return `${parts.join('; ')}${suffix}.`;
}

export function formatWindowLabel(franja?: TimeOfDayWindow | null): string {
  if (franja === 'manana') return 'por la mañana';
  if (franja === 'tarde') return 'por la tarde';
  if (franja === 'noche') return 'por la noche';
  return '';
}

export function formatClientCandidatesReply(nameQuery: string, candidates: ClientCandidate[]) {
  const lines = candidates.map((client, idx) =>
    `${idx + 1}) ${client.nombre}${client.pista ? ` (${client.pista})` : ''}`,
  );
  const text = `Encontré ${candidates.length} clientes similares a «${nameQuery}»:\n${lines.join('\n')}\n¿Cuál es? Puedes decir «la primera», «la segunda» o indicar los últimos dígitos del teléfono.`;

  const spokenItems = candidates.slice(0, 4).map((client, idx) => {
    const label = ORDINAL_FEM[idx] ?? `opción ${idx + 1}`;
    const pista = client.pista
      ? client.pista.replace('tel. ···', 'teléfono terminado en ').replace('tel. ', 'teléfono ')
      : '';
    return `${label}, ${client.nombre}${pista ? `, ${pista}` : ''}`;
  });
  const spokenText = `Encontré ${candidates.length} clientes parecidos. ${spokenItems.join('; ')}. ¿Cuál de ellos es?`;
  return { text, spokenText };
}

export function formatServiceCandidatesReply(term: string, candidates: ServiceOption[]) {
  const lines = candidates.map((service, idx) => `${idx + 1}) ${service.nombre} (${service.duracion} min)`);
  const text = `Encontré varios servicios relacionados con «${term}»:\n${lines.join('\n')}\n¿Cuál deseas agendar? Puedes decir «el primero» o el nombre exacto.`;
  const spokenItems = candidates.slice(0, 4).map((service, idx) => `${ORDINAL_MASC[idx] ?? `opción ${idx + 1}`}, ${service.nombre}`);
  const spokenText = `Tengo varios servicios para ${term}: ${spokenItems.join('; ')}. ¿Cuál prefieres?`;
  return { text, spokenText };
}

export function formatAppointmentCandidatesReply(
  actionLabel: 'reprogramar' | 'cancelar',
  clienteNombre: string,
  candidates: AppointmentCandidate[],
) {
  const lines = candidates.map((cita, idx) =>
    `${idx + 1}) ${formatDateSpanish(cita.fecha)} · ${formatTime12Hour(cita.hora)} · ${cita.servicios.map(s => s.nombre).join(', ')} con ${cita.profesionalNombre}`,
  );
  const text = `${clienteNombre} tiene ${candidates.length} citas activas:\n${lines.join('\n')}\n¿Cuál quieres ${actionLabel}? Puedes decir «la primera» o «la segunda».`;
  const spokenItems = candidates.slice(0, 4).map((cita, idx) =>
    `${ORDINAL_FEM[idx] ?? `opción ${idx + 1}`}, ${formatDateSpanish(cita.fecha)} a las ${formatTimeSpoken(cita.hora)}`,
  );
  const spokenText = `${clienteNombre} tiene ${candidates.length} citas activas: ${spokenItems.join('; ')}. ¿Cuál quieres ${actionLabel}?`;
  return { text, spokenText };
}

export function formatAgendaSpoken(rows: AgendaRow[], total: number, header: string): string {
  if (!total || !rows.length) return header;
  const preview = rows.slice(0, 3).map(row =>
    `${row.cliente}, ${row.servicios}, el ${formatDateSpanish(row.fecha)} a las ${formatTimeSpoken(row.hora)}`,
  );
  const more = total > 3 ? ` Y ${total - 3} citas más en pantalla.` : '';
  return `${header} ${preview.join('; ')}.${more}`;
}
