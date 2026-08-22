'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { mensajeReactivacion, urlWhatsAppReactivacion } from '@/lib/whatsapp';
import { authFetch } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { PageHeader } from '@/components/shared/page-header';
import { MetricStrip } from '@/components/shared/metric-strip';
import {
  UserX, Phone, Calendar, RefreshCcw, Loader2,
  MessageSquare, Star, Search, ShieldAlert, CheckCircle,
  XCircle
} from 'lucide-react';

// ─── Formatting helpers ──────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

interface CatalogEmployee {
  id: string;
  nombre: string;
  rol: string;
}

interface CatalogService {
  id: string;
  nombre: string;
}

interface InactiveClient {
  id: string;
  nombre: string;
  telefono?: string | null;
  telefonoRaw?: string | null;
  diasSinVisita: number;
  ultimaCita: string | null;
  ultimoServicioNombre: string;
  ultimoServicioId?: string | null;
  ultimoProfesionalNombre: string;
  ultimoProfesionalId?: string | null;
  ultimoRecordatorioFecha: string | null;
  ultimoRecordatorioEstado: string | null;
  diasDesdeUltimoRecordatorio: number | null;
  completadas: number;
  canceladas: number;
  noShows: number;
  _privado?: boolean;
}

interface InactivePagination {
  page: number;
  totalPages: number;
  total: number;
}

interface InactiveStats {
  totalInactivos: number;
  sinRecordatorio: number;
  enviadosEsteMes: number;
  reagendados: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ClientesInactivos() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Scope & filters
  const [diasInactividad, setDiasInactividad] = useState<number>(90);
  const [customDays, setCustomDays] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');
  const [telefono, setTelefono] = useState('');
  const [servicioFiltro, setServicioFiltro] = useState('');
  const [estadoRecordatorio, setEstadoRecordatorio] = useState('');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [empleadoId, setEmpleadoId] = useState('');

  // Loaded catalogs
  const [empleados, setEmpleados] = useState<CatalogEmployee[]>([]);
  const [servicios, setServicios] = useState<CatalogService[]>([]);

  // Module data
  const [clientes, setClientes] = useState<InactiveClient[]>([]);
  const [pagination, setPagination] = useState<InactivePagination>({ page: 1, totalPages: 1, total: 0 });
  const [stats, setStats] = useState<InactiveStats>({ totalInactivos: 0, sinRecordatorio: 0, enviadosEsteMes: 0, reagendados: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Warning modal for recent reminders
  const [warningClient, setWarningClient] = useState<(InactiveClient & { diasDesdeUltimo: number }) | null>(null);
  const [submittingReminder, setSubmittingReminder] = useState(false);

  const isAdmin = user?.rol === 'ADMIN';
  const isTechSupport = user?.rol === 'TECH_SUPPORT';
  const canSeeAll = isAdmin || isTechSupport;

  useEffect(() => {
    if (canSeeAll) setScope('all');
  }, [canSeeAll]);

  // 1. Fetch catalogs
  useEffect(() => {
    authFetch('/api/empleados?schedulable=true')
      .then(r => r.json())
      .then(d => {
        // Exclude Tech Support from the filter list (already done in API, but double check)
        const activeSchedulable = (d.empleados || []).filter((e: CatalogEmployee) => e.rol !== 'TECH_SUPPORT');
        setEmpleados(activeSchedulable);
      });
    
    authFetch('/api/servicios')
      .then(r => r.json())
      .then(d => setServicios(d.servicios || []));
  }, []);

  // 2. Fetch Inactive Clients
  const fetchClientesInactivos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dias: String(diasInactividad),
        scope,
        page: String(page),
        size: '15',
        ...(busqueda ? { q: busqueda } : {}),
        ...(telefono ? { telefono } : {}),
        ...(servicioFiltro ? { servicioId: servicioFiltro } : {}),
        ...(estadoRecordatorio ? { estadoRecordatorio } : {}),
        ...(empleadoId ? { empleadoId } : {})
      });

      const res = await authFetch(`/api/gestion/clientes-inactivos?${params}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error al obtener clientes inactivos');
      
      setClientes(data.clientes || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      setStats(data.stats || { totalInactivos: 0, sinRecordatorio: 0, enviadosEsteMes: 0, reagendados: 0 });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Error al cargar clientes inactivos'));
    } finally {
      setLoading(false);
    }
  }, [diasInactividad, scope, page, busqueda, telefono, servicioFiltro, estadoRecordatorio, empleadoId]);

  // Trigger fetch when parameters change
  useEffect(() => {
    fetchClientesInactivos();
  }, [fetchClientesInactivos]);

  // Handle custom days input
  const handleCustomDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDays(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setDiasInactividad(num);
      setPage(1);
    }
  };

  // 3. Send/Log reminder action
  const handleSendReminder = async (client: InactiveClient, force = false) => {
    const reminderParams = {
      cliente_nombre: client.nombre,
      cliente_telefono: client.telefonoRaw || client.telefono,
      dias_inactividad: client.diasSinVisita,
      ultimo_servicio: client.ultimoServicioNombre,
      empleado_nombre: client.ultimoProfesionalNombre !== '—' ? client.ultimoProfesionalNombre : null
    };
    const waUrl = urlWhatsAppReactivacion(reminderParams);

    if (!waUrl) {
      toast.error('El cliente no tiene un número de WhatsApp válido.');
      return;
    }

    // Abrir la pestaña dentro del gesto del usuario evita que el navegador móvil
    // la bloquee mientras esperamos la respuesta de la API.
    const whatsappWindow = window.open('', '_blank');
    if (!whatsappWindow) {
      toast.error('El navegador bloqueó WhatsApp. Permite las ventanas emergentes e inténtalo de nuevo.');
      return;
    }
    whatsappWindow.opener = null;

    setSubmittingReminder(true);
    try {
      const msg = mensajeReactivacion(reminderParams);
      
      const res = await authFetch(`/api/gestion/clientes-inactivos/recordatorio?forzar=${force}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: client.id,
          message: msg,
          channel: 'WHATSAPP'
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error al registrar recordatorio');

      if (data.advertencia) {
        whatsappWindow.close();
        // Show confirmation dialog before sending
        setWarningClient({ ...client, diasDesdeUltimo: data.diasDesdeUltimo });
        setSubmittingReminder(false);
        return;
      }

      // Close warning modal if it was open
      setWarningClient(null);

      whatsappWindow.location.href = waUrl;
      toast.success('Recordatorio registrado y WhatsApp abierto');
      await fetchClientesInactivos(); // Refresh table & stats
    } catch (err: unknown) {
      whatsappWindow.close();
      toast.error(getErrorMessage(err, 'Error al enviar recordatorio'));
    } finally {
      setSubmittingReminder(false);
    }
  };

  // Navigates to scheduler
  const handleScheduleNew = (client: InactiveClient) => {
    const params = new URLSearchParams({
      clienteId: client.id,
      ...(client.ultimoServicioId ? { servicioId: client.ultimoServicioId } : {}),
      ...(client.ultimoProfesionalId ? { empleadoId: client.ultimoProfesionalId } : {})
    });
    router.push(`/citas?${params}`);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Access check
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="app-page space-y-5 sm:space-y-6 page-enter">

          <PageHeader
            eyebrow="Recuperación"
            title="Clientes inactivos"
            description="Identifica oportunidades de reactivación y vuelve a llenar la agenda"
            actions={(
              <>
              {canSeeAll && (
                <div className="flex rounded-xl border border-border/70 bg-[hsl(var(--control))] p-1">
                  <button
                    type="button"
                    onClick={() => { setScope('mine'); setEmpleadoId(''); setPage(1); }}
                    className={cn(
                      "min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      scope === 'mine'
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
                        : "text-muted-foreground hover:bg-card/55 hover:text-foreground"
                    )}
                  >
                    Mi cartera
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScope('all'); setPage(1); }}
                    className={cn(
                      "min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      scope === 'all'
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
                        : "text-muted-foreground hover:bg-card/55 hover:text-foreground"
                    )}
                  >
                    Equipo
                  </button>
                </div>
              )}
              <Button variant="outline" size="icon" onClick={fetchClientesInactivos} aria-label="Actualizar clientes inactivos" title="Actualizar">
                <RefreshCcw className="w-4 h-4" />
              </Button>
              </>
            )}
          />

          {!loading && stats.totalInactivos > 0 && (
            <MetricStrip
              items={[
                { label: 'Inactivos', value: stats.totalInactivos, detail: `Sin visita +${diasInactividad} días`, icon: UserX, tone: 'danger' },
                { label: 'Sin contacto', value: stats.sinRecordatorio, detail: 'Nunca contactados', icon: Phone, tone: 'copper' },
                { label: 'Contactados', value: stats.enviadosEsteMes, detail: 'Este mes', icon: MessageSquare, tone: 'info' },
                { label: 'Reagendados', value: stats.reagendados, detail: 'Volvieron a la agenda', icon: Star, tone: 'success' },
              ]}
            />
          )}

          {/* ── Filtros ─────────────────────────────────────────── */}
          <Card className="surface-panel p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Inactividad de:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[30, 60, 90, 120, 180].map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      setDiasInactividad(d);
                      setCustomDays('');
                      setPage(1);
                    }}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      diasInactividad === d && !customDays ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {d} días
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Personalizado:</span>
                <Input
                  type="number"
                  placeholder="Días"
                  value={customDays}
                  onChange={handleCustomDaysChange}
                  className="w-24 h-11 sm:h-9 text-xs bg-secondary/30"
                  min="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Buscar por Nombre */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); setPage(1); }}
                  className="pl-9 h-11 text-xs bg-card"
                />
              </div>

              {/* Buscar por Teléfono */}
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por teléfono..."
                  value={telefono}
                  onChange={e => { setTelefono(e.target.value); setPage(1); }}
                  className="pl-9 h-11 text-xs bg-card"
                />
              </div>

              {/* Filtrar por Servicio */}
              <select
                value={servicioFiltro}
                onChange={e => { setServicioFiltro(e.target.value); setPage(1); }}
                className="rounded-lg border border-border bg-card px-3 h-11 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todos los servicios</option>
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>

              {/* Filtrar por recordatorio */}
              <select
                value={estadoRecordatorio}
                onChange={e => { setEstadoRecordatorio(e.target.value); setPage(1); }}
                className="rounded-lg border border-border bg-card px-3 h-11 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todos los estados</option>
                <option value="none">Sin recordatorio</option>
                <option value="recent">Recordatorio reciente (≤ 7 días)</option>
                <option value="old">Recordatorio antiguo (&gt; 7 días)</option>
                <option value="failed">Último fallido</option>
              </select>
            </div>

            {/* Filtrar por Profesional (Solo Admin/Tech si scope === 'all') */}
            {canSeeAll && scope === 'all' && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/20">
                <span className="text-xs font-semibold text-muted-foreground">Filtrar profesional:</span>
                <select
                  value={empleadoId}
                  onChange={e => { setEmpleadoId(e.target.value); setPage(1); }}
                  className="rounded-lg border border-border bg-card px-3 h-11 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Todos los profesionales</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            )}
          </Card>

          {/* ── Listado / Tabla ─────────────────────────────────── */}
          {loading ? (
            <Card className="p-12 border-border/50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">Buscando clientes inactivos...</p>
            </Card>
          ) : clientes.length === 0 ? (
            <Card className="py-16 border-border/50 text-center space-y-3">
              <UserX className="w-12 h-12 mx-auto empty-state-icon" />
              <div>
                <p className="font-semibold text-foreground">
                  {busqueda || telefono || servicioFiltro || estadoRecordatorio
                    ? 'Sin resultados para tu búsqueda'
                    : 'No se encontraron clientes inactivos'
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {busqueda || telefono || servicioFiltro || estadoRecordatorio
                    ? 'Prueba ajustando los filtros o el período de inactividad.'
                    : `Ningún cliente lleva más de ${diasInactividad} días sin visitar el salón. ¡Excelente retención!`
                  }
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Encontrados <strong>{pagination.total}</strong> cliente{pagination.total !== 1 ? 's' : ''} inactivo{pagination.total !== 1 ? 's' : ''}
              </p>

              {/* ── Vista Móvil (Tarjetas) ── */}
              <div className="md:hidden space-y-3">
                {clientes.map((c) => {
                  const isVeryInactive = c.diasSinVisita > diasInactividad * 1.5;
                  const hasRecentReminder = c.ultimoRecordatorioFecha && c.diasDesdeUltimoRecordatorio !== null && c.diasDesdeUltimoRecordatorio <= 7;

                  return (
                    <Card key={c.id} className="p-4 border-border/50 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-foreground text-sm">{c.nombre}</h3>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.telefono || 'Sin teléfono'}</p>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                          isVeryInactive ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                        )}>
                          {c.diasSinVisita} días
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-border/30 py-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Última cita</span>
                          <span className="font-medium text-foreground">{fmtDate(c.ultimaCita)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Último servicio</span>
                          <span className="font-medium text-foreground truncate block">{c.ultimoServicioNombre}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Profesional</span>
                          <span className="font-medium text-foreground truncate block">{c.ultimoProfesionalNombre}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Recordatorio</span>
                          <span className="font-medium text-foreground text-[11px]">
                            {c.ultimoRecordatorioFecha ? fmtDate(c.ultimoRecordatorioFecha) : 'Nunca'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendReminder(c)}
                          disabled={c._privado || !c.telefono || c.telefono === '••••••••'}
                          className={cn(
                            "gap-1.5 h-9 px-3 text-xs flex-1 min-h-[40px] justify-center",
                            hasRecentReminder && "border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                          )}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Recordatorio</span>
                        </Button>

                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleScheduleNew(c)}
                          className="gap-1.5 h-9 px-3 text-xs glow-gold flex-1 min-h-[40px] justify-center"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Agendar</span>
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* ── Vista Escritorio (Tabla) ── */}
              <Card className="hidden md:block border-border/50 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/70 text-secondary-foreground border-b border-border/50">
                      <tr>
                        {['Cliente', 'Contacto', 'Última Cita', 'Último Servicio', 'Profesional', 'Citas', 'Último Recordatorio', 'Acciones'].map(h => (
                          <th key={h} className="px-4 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c) => {
                        const isVeryInactive = c.diasSinVisita > diasInactividad * 1.5;
                        const hasRecentReminder = c.ultimoRecordatorioFecha && c.diasDesdeUltimoRecordatorio !== null && c.diasDesdeUltimoRecordatorio <= 7;

                        return (
                          <tr key={c.id} className="border-b border-border/40 hover:bg-secondary/15 transition-colors">
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-foreground">{c.nombre}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <span className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                  isVeryInactive ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                                )}>
                                  {c.diasSinVisita} días
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap text-xs font-mono">
                              {c.telefono || '—'}
                            </td>
                            <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap text-xs">
                              {fmtDate(c.ultimaCita)}
                            </td>
                            <td className="px-4 py-3.5 text-muted-foreground font-medium text-xs truncate max-w-[150px]" title={c.ultimoServicioNombre}>
                              {c.ultimoServicioNombre}
                            </td>
                            <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                              {c.ultimoProfesionalNombre}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex gap-2">
                                <span title="Completadas" className="text-emerald-500">✔ {c.completadas}</span>
                                <span title="Canceladas" className="text-red-500">✖ {c.canceladas}</span>
                                <span title="No Shows" className="text-amber-500">⏱ {c.noShows}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                              {c.ultimoRecordatorioFecha ? (
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">{fmtDate(c.ultimoRecordatorioFecha)}</p>
                                  <div className="flex items-center gap-1">
                                    {c.ultimoRecordatorioEstado === 'SUCCESS' ? (
                                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-1 rounded">
                                        <CheckCircle className="w-2.5 h-2.5" /> Enviado
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-bold bg-red-500/10 px-1 rounded">
                                        <XCircle className="w-2.5 h-2.5" /> Fallido
                                      </span>
                                    )}
                                    {c.diasDesdeUltimoRecordatorio !== null && (
                                      <span className="text-[10px] text-muted-foreground">({c.diasDesdeUltimoRecordatorio}d)</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50 italic text-[11px]">Nunca recordado</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSendReminder(c)}
                                  disabled={c._privado || !c.telefono || c.telefono === '••••••••'}
                                  className={cn(
                                    "gap-1 h-8 px-2.5 text-xs shadow-sm hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/40 transition-colors",
                                    hasRecentReminder && "border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500"
                                  )}
                                  title={c._privado ? "Sin permiso de contacto" : "Enviar recordatorio por WhatsApp"}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Recordatorio</span>
                                </Button>

                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleScheduleNew(c)}
                                  className="gap-1 h-8 px-2.5 text-xs glow-gold"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Agendar</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* ── Paginación ─────────────────────────────────────── */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground font-medium">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Modal de Advertencia por Spam ─────────────────────────── */}
          {warningClient && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl p-6 space-y-4">
                <div className="flex items-start gap-3 text-amber-500">
                  <ShieldAlert className="w-8 h-8 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-foreground text-base">¿Enviar recordatorio de nuevo?</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ya se le envió un recordatorio a <strong>{warningClient.nombre}</strong> hace{' '}
                      <strong>{warningClient.diasDesdeUltimo} día(s)</strong>.
                    </p>
                  </div>
                </div>

                <div className="bg-secondary/40 rounded-xl p-3 border border-border/30">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Último envío registrado:</p>
                  <p className="text-xs text-foreground font-medium">
                    {fmtDate(warningClient.ultimoRecordatorioFecha)}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  Se recomienda esperar al menos 7 días entre recordatorios para evitar que el cliente considere el mensaje como spam. ¿Estás seguro de que deseas reenviar el mensaje?
                </p>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWarningClient(null)}
                    disabled={submittingReminder}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSendReminder(warningClient, true)}
                    disabled={submittingReminder}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {submittingReminder ? 'Enviando...' : 'Sí, Reenviar'}
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
