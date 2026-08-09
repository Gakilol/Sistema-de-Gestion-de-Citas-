export interface ClientAppointmentDto {
  empleado_id: string;
  [key: string]: unknown;
}

export interface ClientResponseSource {
  id: string;
  nombre: string;
  telefono: string | null;
  cedula?: string | null;
  correo: string | null;
  notas: string | null;
  citas?: ClientAppointmentDto[];
  totalCitas?: number;
  citasCompletadas?: number;
  ultimaCita?: Date | null;
  primeraCita?: Date | null;
  esRecurrente?: boolean;
  servicioFavorito?: string | null;
  historial?: ClientAppointmentDto[];
  [key: string]: unknown;
}

function maskValue(value: string | null | undefined, visible = 4): string | null {
  if (!value) return null;
  const suffix = value.slice(-visible);
  return `${'*'.repeat(Math.max(4, value.length - visible))}${suffix}`;
}

function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const [local, domain] = value.split('@');
  if (!domain) return maskValue(value);
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * The caller must scope appointments in the database before passing data here.
 * EMPLEADO receives a deliberate allowlist with no ownership metadata.
 */
export function buildClientResponse(
  client: ClientResponseSource,
  role: string | null
): ClientResponseSource & { _privado: boolean } {
  if (role === 'ADMIN') {
    return { ...client, _privado: false };
  }

  if (role === 'TECH_SUPPORT') {
    return {
      id: client.id,
      nombre: client.nombre,
      telefono: maskValue(client.telefono),
      cedula: maskValue(client.cedula),
      correo: maskEmail(client.correo),
      notas: null,
      citas: client.citas ?? [],
      totalCitas: client.totalCitas ?? 0,
      citasCompletadas: client.citasCompletadas ?? 0,
      ultimaCita: client.ultimaCita ?? null,
      primeraCita: client.primeraCita ?? null,
      esRecurrente: client.esRecurrente ?? false,
      servicioFavorito: client.servicioFavorito ?? null,
      historial: client.historial ?? [],
      _privado: true,
    };
  }

  return {
    id: client.id,
    nombre: client.nombre,
    telefono: client.telefono,
    cedula: client.cedula ?? null,
    correo: client.correo,
    notas: client.notas,
    citas: client.citas ?? [],
    totalCitas: client.totalCitas ?? 0,
    citasCompletadas: client.citasCompletadas ?? 0,
    ultimaCita: client.ultimaCita ?? null,
    primeraCita: client.primeraCita ?? null,
    esRecurrente: client.esRecurrente ?? false,
    servicioFavorito: client.servicioFavorito ?? null,
    historial: client.historial ?? [],
    _privado: false,
  };
}
