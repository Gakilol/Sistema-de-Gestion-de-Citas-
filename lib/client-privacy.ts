export interface ClientAppointmentDto {
  empleado_id: string;
  [key: string]: unknown;
}

export interface ClientResponseSource {
  id: string;
  nombre: string;
  telefono: string | null;
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

/**
 * The caller must scope appointments in the database before passing data here.
 * EMPLEADO receives a deliberate allowlist with no ownership metadata.
 */
export function buildClientResponse(
  client: ClientResponseSource,
  role: string | null
): ClientResponseSource & { _privado: boolean } {
  if (role === 'ADMIN' || role === 'TECH_SUPPORT') {
    return { ...client, _privado: false };
  }

  return {
    id: client.id,
    nombre: client.nombre,
    telefono: client.telefono,
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
