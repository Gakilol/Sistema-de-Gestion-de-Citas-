interface ExistingAppointment {
  fecha: Date | string;
  hora: string;
  duracion: number;
  empleado_id: string;
  servicio_id: string;
  citaServicios?: Array<{ servicio_id: string; duracion: number; orden: number }>;
}

interface AppointmentSchedulePatch {
  fecha?: string | null;
  hora?: string | null;
  empleado_id?: string | null;
  duracion?: number | string | null;
  servicio_id?: string | null;
  servicio_ids?: string[] | null;
  servicios_seleccionados?: Array<{ id: string; duracion?: number }> | null;
  [key: string]: unknown;
}

export function hasAppointmentScheduleChange(original: ExistingAppointment, patch: AppointmentSchedulePatch): boolean {
  const originalDate = new Date(original.fecha).toISOString().slice(0, 10);
  if (patch.fecha && patch.fecha.split('T')[0] !== originalDate) return true;
  if (patch.hora && patch.hora !== original.hora) return true;
  if (patch.empleado_id && patch.empleado_id !== original.empleado_id) return true;
  if (patch.duracion != null && Number(patch.duracion) !== original.duracion) return true;
  if (patch.servicio_id && patch.servicio_id !== original.servicio_id) return true;

  const currentServices = original.citaServicios?.length
    ? [...original.citaServicios].sort((a, b) => a.orden - b.orden)
    : [{ servicio_id: original.servicio_id, duracion: original.duracion, orden: 0 }];
  if (patch.servicios_seleccionados?.length) {
    return patch.servicios_seleccionados.length !== currentServices.length ||
      patch.servicios_seleccionados.some((service, index) =>
        service.id !== currentServices[index].servicio_id ||
        (service.duracion != null && service.duracion !== currentServices[index].duracion));
  }
  if (patch.servicio_ids?.length) {
    return patch.servicio_ids.length !== currentServices.length ||
      patch.servicio_ids.some((id, index) => id !== currentServices[index].servicio_id);
  }
  return false;
}
