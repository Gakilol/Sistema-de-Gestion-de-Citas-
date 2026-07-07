'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  BarChart3, Users, Calendar, TrendingUp, TrendingDown, Minus,
  Download, Loader2, AlertCircle, Clock, ArrowLeft, ArrowRight,
  UserX, Star, Briefcase, Activity, Filter, RefreshCw, ChevronDown,
  CheckCircle, XCircle, AlertTriangle, Info,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'resumen' | 'demanda' | 'asistencia' | 'cancelaciones' | 'clientes' | 'fidelizacion' | 'profesionales';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen',       label: 'Resumen',        icon: BarChart3    },
  { id: 'demanda',       label: 'Demanda',         icon: Activity     },
  { id: 'asistencia',    label: 'Asistencia',      icon: CheckCircle  },
  { id: 'cancelaciones', label: 'Cancelaciones',   icon: XCircle      },
  { id: 'clientes',      label: 'Clientes Inact.', icon: UserX        },
  { id: 'fidelizacion',  label: 'Fidelización',    icon: Star         },
  { id: 'profesionales', label: 'Rendimiento',     icon: Briefcase    },
];

const PIE_COLORS = ['#d4a017', '#10b981', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#06b6d4'];
const AREA_COLORS = { primary: '#d4a017', secondary: '#10b981', accent: '#3b82f6' };

// ─── Date Presets ─────────────────────────────────────────────────────────────
function getPreset(key: string): [string, string] {
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = now.getMonth();

  const map: Record<string, [string, string]> = {
    hoy:    [fmt(now), fmt(now)],
    ayer:   [fmt(new Date(Date.now() - 86400000)), fmt(new Date(Date.now() - 86400000))],
    '7d':   [fmt(new Date(Date.now() - 6  * 86400000)), fmt(now)],
    '30d':  [fmt(new Date(Date.now() - 29 * 86400000)), fmt(now)],
    mes:    [fmt(new Date(Date.UTC(y, m, 1))), fmt(now)],
    mesPrev:[fmt(new Date(Date.UTC(y, m-1, 1))), fmt(new Date(Date.UTC(y, m, 0)))],
    '3m':   [fmt(new Date(Date.UTC(y, m-2, 1))), fmt(now)],
    '6m':   [fmt(new Date(Date.UTC(y, m-5, 1))), fmt(now)],
    anio:   [fmt(new Date(Date.UTC(y, 0, 1))), fmt(now)],
    anoPrev:[fmt(new Date(Date.UTC(y-1, 0, 1))), fmt(new Date(Date.UTC(y-1, 11, 31)))],
  };
  return map[key] ?? map['30d'];
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, unit = '', delta, tooltip, icon: Icon, colorClass, loading,
}: {
  title: string; value: string | number; unit?: string;
  delta?: { absolute: number; percent: number | null } | null;
  tooltip?: string; icon?: React.ElementType; colorClass?: string; loading?: boolean;
}) {
  const [showTip, setShowTip] = useState(false);
  const isPositive = delta && delta.absolute > 0;
  const isNegative = delta && delta.absolute < 0;

  return (
    <Card className="p-4 border-border/50 relative group hover:shadow-md transition-all duration-200">
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="skeleton h-3 w-2/3" />
          <div className="skeleton h-8 w-1/2" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
            <div className="flex items-center gap-1.5">
              {tooltip && (
                <button
                  onMouseEnter={() => setShowTip(true)}
                  onMouseLeave={() => setShowTip(false)}
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <Info className="w-3 h-3" />
                </button>
              )}
              {Icon && (
                <span className={cn('p-1.5 rounded-lg', colorClass || 'bg-primary/10')}>
                  <Icon className="w-3 h-3 text-primary" />
                </span>
              )}
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {typeof value === 'number' ? value.toLocaleString('es-CR') : value}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </p>
          {delta && (
            <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-semibold',
              isPositive ? 'text-emerald-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'
            )}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> :
               isNegative ? <TrendingDown className="w-3 h-3" /> :
               <Minus className="w-3 h-3" />}
              {delta.percent !== null
                ? `${delta.percent > 0 ? '+' : ''}${delta.percent}%`
                : 'Sin referencia'
              }
              <span className="text-muted-foreground font-normal">vs período anterior</span>
            </div>
          )}
          {!delta && <p className="text-xs text-muted-foreground/50 mt-1.5">—</p>}

          {showTip && tooltip && (
            <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-popover text-popover-foreground text-xs p-2.5 rounded-lg shadow-xl border border-border/50 leading-relaxed">
              {tooltip}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl border border-border/50 min-w-[120px]">
      {label && <p className="font-semibold mb-1 text-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{typeof p.value === 'number' ? p.value.toLocaleString('es-CR') : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ message = 'No hay datos para el período seleccionado.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
      <BarChart3 className="w-8 h-8 opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Nivel Badge ─────────────────────────────────────────────────────────────
function NivelBadge({ nivel }: { nivel: 'excelente' | 'aceptable' | 'riesgo' | string }) {
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
      nivel === 'excelente' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
      nivel === 'aceptable' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
      'bg-red-500/15 text-red-600 dark:text-red-400'
    )}>
      {nivel === 'excelente' ? 'Excelente' : nivel === 'aceptable' ? 'Aceptable' : 'En riesgo'}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function ReportesContent() {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  // ── Filters
  const [preset, setPreset] = useState('30d');
  const [desde, setDesde]   = useState(() => getPreset('30d')[0]);
  const [hasta, setHasta]   = useState(() => getPreset('30d')[1]);
  const [compare, setCompare] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [empleadoId, setEmpleadoId] = useState('');
  const [servicioId, setServicioId] = useState('');

  // ── Tabs & data
  const [tab, setTab] = useState<Tab>('resumen');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // ── Inactive clients specific
  const [inactDias, setInactDias] = useState(90);
  const [inactPage, setInactPage] = useState(1);

  const abortRef = useRef<AbortController | null>(null);

  // ── Load filter options
  useEffect(() => {
    fetch('/api/empleados').then(r => r.json()).then(d => setEmpleados(d.empleados || []));
    fetch('/api/servicios').then(r => r.json()).then(d => setServicios(d.servicios || []));
  }, []);

  const buildUrl = useCallback((currentTab: Tab) => {
    const params = new URLSearchParams({
      from: desde, to: hasta,
      compare: String(compare),
      ...(empleadoId ? { empleadoId } : {}),
      ...(servicioId ? { servicioId } : {}),
    });
    const endpoints: Record<Tab, string> = {
      resumen:       `/api/reportes/resumen?${params}`,
      demanda:       `/api/reportes/demanda?${params}`,
      asistencia:    `/api/reportes/asistencia?${params}`,
      cancelaciones: `/api/reportes/cancelaciones?${params}`,
      clientes:      `/api/reportes/clientes-inactivos?${params}&dias=${inactDias}&page=${inactPage}`,
      fidelizacion:  `/api/reportes/clientes-frecuentes?${params}`,
      profesionales: `/api/reportes/profesionales?${params}`,
    };
    return endpoints[currentTab];
  }, [desde, hasta, compare, empleadoId, servicioId, inactDias, inactPage]);

  const fetchData = useCallback(async (currentTab: Tab) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(buildUrl(currentTab), { signal: abortRef.current.signal });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error al cargar datos'); return; }
      setData(json);
    } catch (e: any) {
      if (e.name !== 'AbortError') setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => { fetchData(tab); }, [tab, desde, hasta, compare, empleadoId, servicioId, inactDias, inactPage]);

  const applyPreset = (key: string) => {
    const [f, t] = getPreset(key);
    setPreset(key);
    setDesde(f);
    setHasta(t);
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams({ from: desde, to: hasta, formato: 'csv', ...(empleadoId ? { empleadoId } : {}), ...(servicioId ? { servicioId } : {}) });
    window.location.href = `/api/reportes/exportar?${params}`;
  };
  const handleExportExcel = () => {
    const params = new URLSearchParams({ from: desde, to: hasta, formato: 'excel', ...(empleadoId ? { empleadoId } : {}), ...(servicioId ? { servicioId } : {}) });
    window.location.href = `/api/reportes/exportar?${params}`;
  };

  // ── Auth guard
  if (authLoading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (user && user.rol !== 'ADMIN' && user.rol !== 'TECH_SUPPORT') {
    return (
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center p-4 pt-20 lg:pt-0">
          <Card className="max-w-md w-full p-8 text-center border-border/50 shadow-xl space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Acceso Denegado</h2>
            <p className="text-sm text-muted-foreground">
              El módulo de Reportes y Analítica está disponible únicamente para roles de Administrador y Soporte Técnico.
            </p>
            <Button onClick={() => router.push('/dashboard')} className="w-full glow-gold">
              Volver al Dashboard
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  // ─── TAB CONTENT ────────────────────────────────────────────────────────────
  const renderResumen = () => {
    if (!data) return null;
    const { kpis, deltas } = data;
    return (
      <div className="space-y-5">
        <SectionTitle icon={BarChart3} title="Indicadores Clave" subtitle="KPIs del período seleccionado" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <KpiCard title="Total de Citas"      value={kpis.totalCitas}      delta={deltas?.totalCitas}     icon={Calendar}     colorClass="bg-blue-500/10"    tooltip="Total de citas registradas en el período, sin importar su estado." />
          <KpiCard title="Completadas"         value={kpis.completadas}     delta={deltas?.completadas}    icon={CheckCircle}  colorClass="bg-emerald-500/10" tooltip="Citas que culminaron exitosamente." />
          <KpiCard title="Canceladas"          value={kpis.canceladas}      delta={deltas?.canceladas}     icon={XCircle}      colorClass="bg-red-500/10"     tooltip="Citas canceladas antes de realizarse." />
          <KpiCard title="No Presentados"      value={kpis.noShow}          delta={deltas?.noShow}         icon={UserX}        colorClass="bg-orange-500/10"  tooltip="Citas donde el cliente no se presentó." />
          <KpiCard title="Pendientes"          value={kpis.pendientes}      icon={Clock}       colorClass="bg-amber-500/10"   tooltip="Citas activas aún sin confirmar." />
          <KpiCard title="Tasa de Asistencia"  value={`${kpis.tasaAsistencia}%`}  delta={deltas?.tasaAsistencia}  icon={TrendingUp}   colorClass="bg-primary/10"     tooltip="(Completadas / Citas pasadas) × 100. Excluye citas futuras." />
          <KpiCard title="Tasa de Cancelación" value={`${kpis.tasaCancelacion}%`} delta={deltas?.tasaCancelacion} icon={TrendingDown}  colorClass="bg-red-500/10"     tooltip="(Canceladas / Total citas del período) × 100." />
          <KpiCard title="Tasa de No Shows"    value={`${kpis.tasaNoShow}%`}      delta={deltas?.tasaNoShow}      icon={AlertTriangle} colorClass="bg-orange-500/10"  tooltip="(No Shows / Citas pasadas) × 100. Excluye futuras y canceladas." />
          <KpiCard title="Clientes Atendidos"  value={kpis.clientesAtendidos}  icon={Users}     colorClass="bg-cyan-500/10"    tooltip="Clientes únicos con al menos una cita completada en el período." />
          <KpiCard title="Clientes Nuevos"     value={kpis.clientesNuevos}     icon={Star}      colorClass="bg-violet-500/10"  tooltip="Clientes cuyo primer registro fue en el período actual." />
          <KpiCard title="Prom. Citas/Día"     value={kpis.promedioCitasDia}   icon={Activity}  colorClass="bg-teal-500/10"    tooltip="Total de citas dividido entre los días del período." />
          <KpiCard title="Cancel. Tardías"     value={kpis.cancelacionesTardias} icon={Clock}   colorClass="bg-rose-500/10"    tooltip="Cancelaciones realizadas menos de 24 horas antes de la cita." />
          <KpiCard title="Día más Solicitado"  value={kpis.diaMasSolicitado}   icon={Calendar}  colorClass="bg-amber-500/10"   tooltip="Día de la semana con más citas en el período." />
          <KpiCard title="Hora más Solicitada" value={kpis.horaMasSolicitada}  icon={Clock}     colorClass="bg-sky-500/10"     tooltip="Franja horaria con mayor concentración de citas." />
          <KpiCard title="Servicio Top"        value={kpis.servicioMasSolicitado} icon={Briefcase} colorClass="bg-purple-500/10" tooltip="Servicio con mayor cantidad de citas en el período." />
        </div>

        {kpis.empleadoTop && kpis.empleadoTop !== 'N/A' && (
          <Card className="p-4 border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
            <p className="text-xs text-muted-foreground mb-1">Profesional con más citas completadas</p>
            <p className="text-lg font-bold text-primary">{kpis.empleadoTop}</p>
          </Card>
        )}
      </div>
    );
  };

  const renderDemanda = () => {
    if (!data) return null;
    const { porDiaSemana, porHora, porServicio, heatmap, insights } = data;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5 border-border/50">
            <SectionTitle icon={Calendar} title="Citas por Día de la Semana" />
            {porDiaSemana?.some((d: any) => d.total > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porDiaSemana}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="total" name="Citas" fill="#d4a017" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
            {insights && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-emerald-500">↑ Más solicitado:</span> {insights.diaMasSolicitado?.dia} ({insights.diaMasSolicitado?.total})
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-amber-500">↓ Menos solicitado:</span> {insights.diaMenosSolicitado?.dia} ({insights.diaMenosSolicitado?.total})
                </p>
              </div>
            )}
          </Card>

          <Card className="p-5 border-border/50">
            <SectionTitle icon={Clock} title="Citas por Franja Horaria" />
            {porHora?.some((h: any) => h.total > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porHora}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="hora" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="total" name="Citas" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </Card>

          <Card className="p-5 border-border/50 lg:col-span-2">
            <SectionTitle icon={Activity} title="Servicios más Solicitados" />
            {porServicio?.length > 0 ? (
              <div className="space-y-2 mt-2">
                {porServicio.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4 text-right font-mono">{i + 1}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground min-w-[120px]">{s.nombre}</span>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${s.pct || 0}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">{s.total} ({s.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState />}
          </Card>
        </div>
      </div>
    );
  };

  const renderAsistencia = () => {
    if (!data) return null;
    const { resumen, tendencia, porEmpleado, porServicio, deltas } = data;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard title="Tasa de Asistencia"  value={`${resumen?.tasaAsistencia || 0}%`}  delta={deltas?.tasaAsistencia}  icon={CheckCircle}  colorClass="bg-emerald-500/10" tooltip="(Completadas / Citas pasadas) × 100. Solo considera citas cuya fecha ya pasó." />
          <KpiCard title="Tasa de No Show"     value={`${resumen?.tasaNoShow    || 0}%`}   icon={UserX}        colorClass="bg-orange-500/10" tooltip="(No Shows / Citas pasadas) × 100." />
          <KpiCard title="Citas Completadas"   value={resumen?.completadas      || 0}       delta={deltas?.completadas}     icon={Calendar}     colorClass="bg-blue-500/10" />
        </div>

        <Card className="p-5 border-border/50">
          <SectionTitle icon={TrendingUp} title="Tendencia Semanal de Asistencia" />
          {tendencia?.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={tendencia}>
                <defs>
                  <linearGradient id="gradAsist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="tasaAsistencia" name="Asistencia %" stroke="#10b981" fill="url(#gradAsist)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </Card>

        {porEmpleado?.length > 0 && (
          <Card className="p-5 border-border/50">
            <SectionTitle icon={Users} title="Asistencia por Profesional" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Profesional', 'Completadas', 'Total Pasadas', 'Tasa Asistencia', 'Nivel'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porEmpleado.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-foreground">{e.nombre}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{e.completadas}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{e.total}</td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums">{e.tasaAsistencia}%</td>
                      <td className="px-3 py-2.5"><NivelBadge nivel={e.nivel} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderCancelaciones = () => {
    if (!data) return null;
    const { resumen, tendencia, porDia, porEmpleado, porServicio, clientesConMasCancelaciones, deltas } = data;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Total Canceladas"    value={resumen?.totalCanceladas   || 0} delta={deltas?.totalCanceladas}   icon={XCircle}      colorClass="bg-red-500/10"  tooltip="Total de citas canceladas en el período." />
          <KpiCard title="Tasa de Cancelación" value={`${resumen?.tasaCancelacion || 0}%`} delta={deltas?.tasaCancelacion} icon={TrendingDown} colorClass="bg-orange-500/10" tooltip="(Canceladas / Total citas) × 100." />
          <KpiCard title="Tardías"             value={resumen?.cancelacionesTardias || 0} icon={Clock}  colorClass="bg-rose-500/10"   tooltip={`Cancelaciones ${resumen?.umbralTardias || '< 24h'} antes de la cita.`} />
          <KpiCard title="% Tardías"           value={`${resumen?.porcentajeTardias || 0}%`} icon={AlertTriangle} colorClass="bg-amber-500/10" tooltip="Porcentaje de cancelaciones tardías sobre el total cancelado." />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5 border-border/50">
            <SectionTitle icon={TrendingDown} title="Tendencia Semanal" />
            {tendencia?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={tendencia}>
                  <defs>
                    <linearGradient id="gradCancel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="semana" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="total" name="Canceladas" stroke="#ef4444" fill="url(#gradCancel)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </Card>

          <Card className="p-5 border-border/50">
            <SectionTitle icon={Calendar} title="Por Día de la Semana" />
            {porDia?.some((d: any) => d.total > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={porDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="total" name="Canceladas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </Card>
        </div>

        {clientesConMasCancelaciones?.length > 0 && (
          <Card className="p-5 border-border/50">
            <SectionTitle icon={Users} title="Clientes con más Cancelaciones" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['#', 'Cliente', 'Cancelaciones'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientesConMasCancelaciones.map((c: any, i: number) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{c.nombre}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold">{c.total}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderClientesInactivos = () => {
    if (!data) return null;
    const { clientes, pagination, meta } = data;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 bg-secondary/30 p-3 rounded-xl border border-border/40">
          <span className="text-xs font-semibold text-muted-foreground">Inactivos después de:</span>
          {[30, 60, 90, 120, 180].map(d => (
            <button
              key={d}
              onClick={() => { setInactDias(d); setInactPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                inactDias === d ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {d} días
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{pagination?.total || 0}</span> clientes inactivos desde{' '}
            <span className="font-medium">{meta?.corteFecha}</span>
          </p>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>

        {clientes?.length > 0 ? (
          <>
            <Card className="border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/70">
                    <tr>
                      {['Cliente', 'Teléfono', 'Última Cita', 'Días sin visita', 'Completadas', 'Canceladas', 'No Shows', 'Servicio Fav.'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c: any) => (
                      <tr key={c.id} className="border-t border-border/40 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{c.nombre}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{c.telefono || '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {c.ultimaCita ? new Date(c.ultimaCita).toLocaleDateString('es-NI') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold">
                            {c.diasSinVisita}d
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{c.completadas}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{c.canceladas}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{c.noShows}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.servicioFavorito}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={inactPage <= 1} onClick={() => setInactPage(p => p - 1)}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {pagination.page} de {pagination.totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={inactPage >= pagination.totalPages} onClick={() => setInactPage(p => p + 1)}>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </>
        ) : <EmptyState message="No hay clientes inactivos para el umbral seleccionado." />}
      </div>
    );
  };

  const renderFidelizacion = () => {
    if (!data) return null;
    const { resumen, distribucionFrecuencia, tasaRetorno, topClientes } = data;
    const freqData = [
      { name: 'Frecuente (< 30d)',  value: distribucionFrecuencia?.frecuente  || 0, color: '#10b981' },
      { name: 'Regular (30-90d)',   value: distribucionFrecuencia?.regular    || 0, color: '#d4a017' },
      { name: 'En riesgo (> 90d)',  value: distribucionFrecuencia?.enRiesgo   || 0, color: '#ef4444' },
    ];
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Clientes Atendidos" value={resumen?.totalClientesAtendidos || 0} icon={Users}      colorClass="bg-blue-500/10" />
          <KpiCard title="Clientes Nuevos"    value={resumen?.clientesNuevos         || 0} icon={Star}       colorClass="bg-violet-500/10" />
          <KpiCard title="Recurrentes"        value={resumen?.clientesRecurrentes    || 0} icon={RefreshCw}  colorClass="bg-emerald-500/10" />
          <KpiCard title="Tasa de Retorno"    value={`${resumen?.tasaRecurrentes || 0}%`} icon={TrendingUp} colorClass="bg-primary/10" tooltip="Porcentaje de clientes atendidos que son recurrentes." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="p-5 border-border/50">
            <SectionTitle icon={Activity} title="Distribución de Frecuencia de Visita" />
            {freqData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={freqData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={4}
                    label={({ name, value }) => value > 0 ? `${value}` : ''} labelLine={false}>
                    {freqData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </Card>

          <Card className="p-5 border-border/50">
            <SectionTitle icon={Clock} title="Días Promedio entre Visitas" />
            <div className="space-y-3 mt-2">
              <div className="text-center py-4">
                <p className="text-4xl font-bold text-primary tabular-nums">
                  {resumen?.promedioDiasEntreVisitas || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">días promedio entre visitas</p>
                <p className="text-xs text-muted-foreground">Mediana: {resumen?.medianaDiasEntreVisitas || 0} días</p>
              </div>
              <div className="space-y-2 pt-3 border-t border-border/40">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Retorno dentro de:</p>
                {[
                  { label: '30 días', value: tasaRetorno?.dias30 || 0 },
                  { label: '60 días', value: tasaRetorno?.dias60 || 0 },
                  { label: '90 días', value: tasaRetorno?.dias90 || 0 },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-semibold text-foreground">{r.value} clientes</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {topClientes?.length > 0 && (
          <Card className="p-5 border-border/50">
            <SectionTitle icon={Star} title="Top 20 Clientes Más Frecuentes" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Visitas</th>
                  </tr>
                </thead>
                <tbody>
                  {topClientes.map((c: any) => (
                    <tr key={c.rank} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="px-3 py-2.5">
                        <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          c.rank === 1 ? 'bg-amber-500 text-white' :
                          c.rank === 2 ? 'bg-slate-400 text-white' :
                          c.rank === 3 ? 'bg-amber-700 text-white' :
                          'bg-secondary text-muted-foreground'
                        )}>
                          {c.rank}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{c.nombre}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">{c.visitas}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderProfesionales = () => {
    if (!data) return null;
    const { porEmpleado, porServicio } = data;
    return (
      <div className="space-y-5">
        {porEmpleado?.length > 0 && (
          <Card className="p-5 border-border/50">
            <SectionTitle icon={Users} title="Rendimiento por Profesional" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Profesional', 'Especialidad', 'Total', 'Completadas', 'Canceladas', 'No Shows', 'Asistencia', 'Cancel.'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porEmpleado.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{e.nombre}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.especialidad}</td>
                      <td className="px-3 py-2.5 text-center">{e.total}</td>
                      <td className="px-3 py-2.5 text-center text-emerald-600 dark:text-emerald-400 font-medium">{e.completadas}</td>
                      <td className="px-3 py-2.5 text-center text-red-600 dark:text-red-400">{e.canceladas}</td>
                      <td className="px-3 py-2.5 text-center text-orange-600 dark:text-orange-400">{e.noShow}</td>
                      <td className="px-3 py-2.5 text-center font-semibold tabular-nums">{e.tasaAsistencia}%</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">{e.tasaCancelacion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {porServicio?.length > 0 && (
          <Card className="p-5 border-border/50">
            <SectionTitle icon={Briefcase} title="Rendimiento por Servicio" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Servicio', 'Categoría', 'Total', 'Completadas', 'Canceladas', 'No Shows', 'Asistencia', 'Cancel.'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porServicio.map((s: any, i: number) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{s.nombre}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.categoria}</td>
                      <td className="px-3 py-2.5 text-center">{s.total}</td>
                      <td className="px-3 py-2.5 text-center text-emerald-600 dark:text-emerald-400 font-medium">{s.completadas}</td>
                      <td className="px-3 py-2.5 text-center text-red-600 dark:text-red-400">{s.canceladas}</td>
                      <td className="px-3 py-2.5 text-center text-orange-600 dark:text-orange-400">{s.noShow}</td>
                      <td className="px-3 py-2.5 text-center font-semibold tabular-nums">{s.tasaAsistencia}%</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">{s.tasaCancelacion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {(!porEmpleado?.length && !porServicio?.length) && <EmptyState />}
      </div>
    );
  };



  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4 border-border/50 animate-pulse space-y-3">
              <div className="skeleton h-3 w-2/3" />
              <div className="skeleton h-8 w-1/2" />
              <div className="skeleton h-3 w-1/3" />
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
          <AlertCircle className="w-8 h-8" />
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchData(tab)}>Reintentar</Button>
        </div>
      );
    }

    if (!data) return null;

    switch (tab) {
      case 'resumen':       return renderResumen();
      case 'demanda':       return renderDemanda();
      case 'asistencia':    return renderAsistencia();
      case 'cancelaciones': return renderCancelaciones();
      case 'clientes':      return renderClientesInactivos();
      case 'fidelizacion':  return renderFidelizacion();
      case 'profesionales': return renderProfesionales();
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          {/* ─── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Reportes y Analítica</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Período: {desde} → {hasta}
                {(empleadoId || servicioId) && (
                  <span className="ml-2 text-primary font-medium">• Filtros activos</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => fetchData(tab)} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </Button>
              <div className="relative">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilters(f => !f)}>
                  <Download className="w-3.5 h-3.5" /> Exportar <ChevronDown className="w-3 h-3" />
                </Button>
                {showFilters && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border/50 rounded-xl shadow-xl py-1 min-w-[150px]">
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={() => { handleExportCSV(); setShowFilters(false); }}>
                      Exportar CSV
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={() => { handleExportExcel(); setShowFilters(false); }}>
                      Exportar Excel (.xls)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Filter Bar ──────────────────────────────────────────────── */}
          <Card className="p-4 border-border/50 space-y-3">
            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { k: 'hoy',     l: 'Hoy' },
                { k: 'ayer',    l: 'Ayer' },
                { k: '7d',      l: '7 días' },
                { k: '30d',     l: '30 días' },
                { k: 'mes',     l: 'Este mes' },
                { k: 'mesPrev', l: 'Mes anterior' },
                { k: '3m',      l: '3 meses' },
                { k: '6m',      l: '6 meses' },
                { k: 'anio',    l: 'Este año' },
                { k: 'anoPrev', l: 'Año anterior' },
              ].map(p => (
                <button
                  key={p.k}
                  onClick={() => applyPreset(p.k)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    preset === p.k ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {p.l}
                </button>
              ))}
            </div>

            {/* Date inputs + advanced filters */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="date" value={desde}
                  onChange={e => { setDesde(e.target.value); setPreset(''); }}
                  className="h-8 text-xs w-36"
                />
                <span className="text-muted-foreground text-xs">—</span>
                <Input
                  type="date" value={hasta}
                  onChange={e => { setHasta(e.target.value); setPreset(''); }}
                  className="h-8 text-xs w-36"
                />
              </div>

              <select
                value={empleadoId}
                onChange={e => setEmpleadoId(e.target.value)}
                className="h-8 rounded-lg border border-border bg-card px-2 py-0 text-xs min-w-[150px] outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                <option value="">Todos los profesionales</option>
                {empleados.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>

              <select
                value={servicioId}
                onChange={e => setServicioId(e.target.value)}
                className="h-8 rounded-lg border border-border bg-card px-2 py-0 text-xs min-w-[150px] outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                <option value="">Todos los servicios</option>
                {servicios.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={e => setCompare(e.target.checked)}
                  className="w-3.5 h-3.5 text-primary border-border bg-background rounded focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground">Comparar período anterior</span>
              </label>

              {(empleadoId || servicioId) && (
                <button
                  onClick={() => { setEmpleadoId(''); setServicioId(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </Card>

          {/* ─── Tabs ────────────────────────────────────────────────────── */}
          <div className="overflow-x-auto">
            <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit min-w-full sm:min-w-0">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setData(null); }}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                    tab === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Content ─────────────────────────────────────────────────── */}
          <div className="min-h-[400px]">
            {renderTabContent()}
          </div>

          {/* ─── Footer note ─────────────────────────────────────────────── */}
          <p className="text-[10px] text-muted-foreground/50 text-center pb-2">
            Zona horaria: America/Costa_Rica • Todos los datos provienen de la base de datos en tiempo real • Ninguna métrica es estimada
          </p>
        </div>
      </main>
    </div>
  );
}

export default function Reportes() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    }>
      <ReportesContent />
    </Suspense>
  );
}
