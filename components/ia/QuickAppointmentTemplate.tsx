'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, Loader2, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/api-client';
import type { IAQuickAppointmentInput } from '@/lib/ia/types';

interface ClientOption {
  id: string;
  nombre: string;
  telefono?: string | null;
}

interface ServiceOption {
  id: string;
  nombre: string;
  duracion: number;
  activo?: boolean;
}

interface EmployeeOption {
  id: string;
  nombre: string;
}

interface Props {
  disabled?: boolean;
  onClose: () => void;
  onPrepared: (input: IAQuickAppointmentInput, summary: string) => Promise<void>;
}

export function QuickAppointmentTemplate({ disabled, onClose, onPrepared }: Props) {
  const [clientQuery, setClientQuery] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [serviceQuery, setServiceQuery] = useState('');
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeName, setEmployeeName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [searchingClients, setSearchingClients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      authFetch('/api/servicios').then((response) => response.json()),
      authFetch('/api/empleados?schedulable=true').then((response) => response.json()),
    ]).then(([serviceData, employeeData]) => {
      if (!active) return;
      setServices((serviceData.servicios ?? []).filter((service: ServiceOption) => service.activo !== false));
      setEmployees(employeeData.empleados ?? []);
      if ((employeeData.empleados ?? []).length === 1) setEmployeeName(employeeData.empleados[0].nombre);
    }).catch(() => {
      if (active) setError('No pude cargar los servicios y profesionales. Intenta abrir la plantilla de nuevo.');
    }).finally(() => {
      if (active) setLoadingCatalog(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectedClient || clientQuery.trim().length < 2) {
      setClients([]);
      setSearchingClients(false);
      return;
    }
    let active = true;
    setSearchingClients(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await authFetch(`/api/clientes?q=${encodeURIComponent(clientQuery.trim())}&limit=8&orden=nombre`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) setClients(data.clientes ?? []);
      } catch {
        if (active) setError('No pude buscar clientes en este momento.');
      } finally {
        if (active) setSearchingClients(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clientQuery, selectedClient]);

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLocaleLowerCase('es');
    if (!query || selectedService) return [];
    return services.filter((service) => service.nombre.toLocaleLowerCase('es').includes(query)).slice(0, 8);
  }, [serviceQuery, selectedService, services]);

  const selectClient = (client: ClientOption) => {
    setSelectedClient(client);
    setClientQuery(client.nombre);
    setClients([]);
    setError('');
  };

  const selectService = (service: ServiceOption) => {
    setSelectedService(service);
    setServiceQuery(service.nombre);
    setError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedClient) {
      setError('Busca y selecciona un cliente que ya esté guardado.');
      return;
    }
    if (!selectedService) {
      setError('Escribe el servicio y selecciona una opción exacta de la lista.');
      return;
    }
    if (!employeeName || !date || !time) {
      setError('Selecciona profesional, fecha y hora.');
      return;
    }

    setError('');
    setSubmitting(true);
    const summary = `Crear cita para ${selectedClient.nombre}: ${selectedService.nombre}, ${date} a las ${time}, con ${employeeName}.`;
    try {
      await onPrepared({
        clienteId: selectedClient.id,
        cliente: selectedClient.nombre,
        servicioId: selectedService.id,
        servicio: selectedService.nombre,
        profesional: employeeName,
        fecha: date,
        hora: time,
        notas: notes.trim() || undefined,
      }, summary);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No pude preparar la cita.');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toLocaleDateString('en-CA');
  const busy = disabled || submitting;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border-2 border-primary/40 bg-card shadow-md" aria-labelledby="quick-appointment-title">
      <div className="flex items-start justify-between gap-4 border-b border-primary/20 bg-primary/10 p-4 sm:p-5">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><CalendarPlus className="size-5" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Plantilla rápida</p>
            <h2 id="quick-appointment-title" className="mt-0.5 text-xl font-black text-foreground">Crear una cita sin adivinar datos</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">Escribe, elige la coincidencia exacta y revisa antes de guardar.</p>
          </div>
        </div>
        <Button type="button" size="icon" variant="ghost" className="size-11 shrink-0" onClick={onClose} aria-label="Cerrar plantilla"><X className="size-5" /></Button>
      </div>

      <form onSubmit={submit} className="grid gap-5 p-4 sm:p-5">
        <fieldset className="grid gap-3" disabled={busy || loadingCatalog}>
          <legend className="mb-3 flex items-center gap-2 text-base font-bold text-foreground"><span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">1</span> Cliente guardado</legend>
          <div className="relative">
            <label htmlFor="quick-client" className="mb-1.5 block text-sm font-semibold text-foreground">Busca por nombre o teléfono</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input id="quick-client" value={clientQuery} onChange={(event) => { setClientQuery(event.target.value); setSelectedClient(null); }} autoComplete="off" placeholder="Ejemplo: Kevin Duarte" className="min-h-12 w-full rounded-xl border border-input bg-background py-3 pl-11 pr-12 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" aria-expanded={clients.length > 0} aria-controls="quick-client-results" />
              {searchingClients && <Loader2 className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-primary" />}
              {selectedClient && <Check className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-emerald-600" />}
            </div>
            {!selectedClient && clientQuery.trim().length >= 2 && !searchingClients && (
              <div id="quick-client-results" role="listbox" className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                {clients.length > 0 ? clients.map((client) => (
                  <button key={client.id} type="button" role="option" aria-selected="false" onClick={() => selectClient(client)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none">
                    <span className="font-semibold text-foreground">{client.nombre}</span><span className="text-sm text-muted-foreground">{client.telefono || 'Sin teléfono'}</span>
                  </button>
                )) : <div className="p-3 text-sm text-muted-foreground">No está guardado. Regístralo antes de crear la cita.</div>}
              </div>
            )}
          </div>
          <Button asChild type="button" variant="outline" className="min-h-12 justify-start sm:w-fit"><Link href="/clientes?nuevo=1"><UserPlus className="size-5" /> Registrar un cliente que no aparece</Link></Button>
        </fieldset>

        <fieldset className="grid gap-3 border-t border-border pt-5" disabled={busy || loadingCatalog}>
          <legend className="mb-3 flex items-center gap-2 text-base font-bold text-foreground"><span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">2</span> Servicio exacto</legend>
          <div className="relative">
            <label htmlFor="quick-service" className="mb-1.5 block text-sm font-semibold text-foreground">Escribe el servicio</label>
            <input id="quick-service" value={serviceQuery} onChange={(event) => { setServiceQuery(event.target.value); setSelectedService(null); }} autoComplete="off" placeholder="Ejemplo: Corte" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" aria-expanded={filteredServices.length > 0} aria-controls="quick-service-results" />
            {!selectedService && serviceQuery.trim() && (
              <div id="quick-service-results" role="listbox" className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                {filteredServices.length > 0 ? filteredServices.map((service) => (
                  <button key={service.id} type="button" role="option" aria-selected="false" onClick={() => selectService(service)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none">
                    <span className="font-semibold text-foreground">{service.nombre}</span><span className="text-sm text-muted-foreground">{service.duracion} min</span>
                  </button>
                )) : <div className="p-3 text-sm text-muted-foreground">No encontré un servicio activo con ese nombre.</div>}
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3" disabled={busy || loadingCatalog}>
          <legend className="mb-3 flex items-center gap-2 text-base font-bold text-foreground"><span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">3</span> Cuándo y con quién</legend>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground">Profesional<select value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} className="min-h-12 rounded-xl border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"><option value="">Seleccionar</option>{employees.map((employee) => <option key={employee.id} value={employee.nombre}>{employee.nombre}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground">Fecha<input type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} className="min-h-12 rounded-xl border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" /></label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground">Hora<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="min-h-12 rounded-xl border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" /></label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground sm:col-span-3">Nota opcional<input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Ejemplo: prefiere tijera" className="min-h-12 rounded-xl border border-input bg-background px-4 text-base font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" /></label>
        </fieldset>

        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}

        <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button type="button" size="lg" variant="outline" className="min-h-12 text-base" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" size="lg" className="min-h-12 text-base" disabled={busy || loadingCatalog}>{submitting ? <Loader2 className="size-5 animate-spin" /> : <CalendarPlus className="size-5" />}{submitting ? 'Revisando horario…' : 'Preparar cita'}</Button>
        </div>
      </form>
    </section>
  );
}
