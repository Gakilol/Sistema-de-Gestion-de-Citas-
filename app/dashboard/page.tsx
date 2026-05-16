'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, TrendingUp, DollarSign, Users, CheckCircle2,
  Clock, ArrowUpRight, ArrowDownRight, RefreshCcw, Loader2,
  Scissors, ChevronRight, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface DashboardData {
  stats: {
    totalCitas: number;
    citasCompletadas: number;
    citasHoy: number;
    citasPendientes: number;
    empleadosActivos: number;
    totalRevenue: number;
    ingresosMes: number;
    ingresosHoy: number;
    tasaCompletadas: number;
  };
  upcomingAppointments: any[];
  citasHoy: any[];
  serviciosPopulares: { nombre: string; cantidad: number }[];
  productividadEmpleados: { nombre: string; citas: number; ingresos: number }[];
  actividadReciente: any[];
  ingresosChart: { fecha: string; dia: string; ingresos: number; citas: number }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'badge-pendiente',
  CONFIRMADA: 'badge-confirmada',
  COMPLETADA: 'badge-completada',
  CANCELADA: 'badge-cancelada',
  EN_PROGRESO: 'badge-en_progreso',
  REPROGRAMADA: 'badge-reprogramada',
};
const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  EN_PROGRESO: 'En Progreso',
  REPROGRAMADA: 'Reprogramada',
};

const PIE_COLORS = ['#d4a017', '#10b981', '#3b82f6', '#a855f7', '#f97316'];

function fmtUSD(n: number) {
  return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('es-NI', { day: '2-digit', month: 'short' });
}

// ─── Skeleton ───────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-7 w-16" />
        </div>
        <div className="skeleton h-10 w-10 rounded-lg" />
      </div>
      <div className="skeleton h-3 w-32" />
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: 'gold' | 'emerald' | 'blue' | 'purple';
  trend?: number; // positivo=subida, negativo=bajada
}

function KpiCard({ title, value, sub, icon: Icon, accent, trend }: KpiCardProps) {
  const accentClass = {
    gold:    { card: 'card-accent-gold',    icon: 'metric-icon-gold',    text: 'text-amber-500' },
    emerald: { card: 'card-accent-emerald', icon: 'metric-icon-emerald', text: 'text-emerald-500' },
    blue:    { card: 'card-accent-blue',    icon: 'metric-icon-blue',    text: 'text-blue-500' },
    purple:  { card: 'card-accent-purple',  icon: 'metric-icon-purple',  text: 'text-purple-500' },
  }[accent];

  return (
    <div className={cn(
      'rounded-xl border border-border/50 bg-card p-5 hover-lift transition-all',
      accentClass.card
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={cn('p-2.5 rounded-xl', accentClass.icon)}>
          <Icon className={cn('w-5 h-5', accentClass.text)} />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {trend !== undefined && (
          trend >= 0
            ? <ArrowUpRight className="w-3.5 h-3.5 trend-up" />
            : <ArrowDownRight className="w-3.5 h-3.5 trend-down" />
        )}
        {sub && (
          <p className="text-xs text-muted-foreground">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Custom Tooltip para gráficas ────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2.5 text-xs shadow-xl border border-border/50">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">
            {p.name === 'Ingresos' ? fmtUSD(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/dashboard?t=' + Date.now());
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const isAdmin = user?.rol === 'ADMIN';

  // ─── Loading skeleton ───────────────────────────────────────────────
  if (isAuthLoading || isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 p-6 pt-20 lg:pt-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="skeleton h-8 w-48 mb-2" />
            <div className="skeleton h-4 w-64" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 skeleton h-64 rounded-xl" />
              <div className="skeleton h-64 rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const stats = data?.stats;
  const upcoming = data?.upcomingAppointments ?? [];
  const citasHoy = data?.citasHoy ?? [];
  const populares = data?.serviciosPopulares ?? [];
  const productividad = data?.productividadEmpleados ?? [];
  const actividad = data?.actividadReciente ?? [];
  const chartData = data?.ingresosChart ?? [];

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 page-enter">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Bienvenido, <span className="text-gold-gradient">{user?.nombre?.split(' ')[0]}</span> 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {new Date().toLocaleDateString('es-NI', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(true)}
              disabled={refreshing}
              className="hidden sm:flex items-center gap-1.5 text-xs"
            >
              <RefreshCcw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              Actualizar
            </Button>
          </div>

          {/* ── KPI Cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard
              title="Citas Hoy"
              value={String(stats?.citasHoy ?? 0)}
              sub={`${stats?.citasPendientes ?? 0} pendientes`}
              icon={Calendar}
              accent="gold"
            />
            <KpiCard
              title="Completadas"
              value={String(stats?.citasCompletadas ?? 0)}
              sub={`${stats?.tasaCompletadas ?? 0}% tasa éxito`}
              icon={CheckCircle2}
              accent="emerald"
            />
            {isAdmin && (
              <KpiCard
                title="Ingresos Hoy"
                value={fmtUSD(stats?.ingresosHoy ?? 0)}
                sub={`Mes: ${fmtUSD(stats?.ingresosMes ?? 0)}`}
                icon={DollarSign}
                accent="blue"
              />
            )}
            <KpiCard
              title="Personal Activo"
              value={String(stats?.empleadosActivos ?? 0)}
              sub="Empleados en sistema"
              icon={Users}
              accent="purple"
            />
          </div>

          {/* ── Gráficas ────────────────────────────────────────── */}
          {isAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Área: ingresos 7 días */}
              <Card className="lg:col-span-2 p-5 border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Ingresos — Últimos 7 días</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Citas completadas y monto generado</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary rounded-lg px-2.5 py-1">
                    <Activity className="w-3 h-3" />
                    En vivo
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#d4a017" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#d4a017" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#d4a017" strokeWidth={2} fill="url(#gradGold)" dot={{ r: 3, fill: '#d4a017', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="citas"    name="Citas"    stroke="#3b82f6" strokeWidth={2} fill="url(#gradBlue)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              {/* Pie: servicios populares */}
              <Card className="p-5 border-border/50">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-foreground">Servicios Populares</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Por número de citas</p>
                </div>
                {populares.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie
                          data={populares}
                          dataKey="cantidad"
                          nameKey="nombre"
                          cx="50%" cy="50%"
                          innerRadius={38}
                          outerRadius={60}
                          paddingAngle={3}
                        >
                          {populares.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v, n) => [`${v} citas`, n]}
                          contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-1">
                      {populares.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-muted-foreground truncate max-w-[110px]">{s.nombre}</span>
                          </div>
                          <span className="font-semibold text-foreground">{s.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">Sin datos suficientes</div>
                )}
              </Card>
            </div>
          )}

          {/* ── Segunda fila de gráficas ─────────────────────────── */}
          {isAdmin && productividad.length > 0 && (
            <Card className="p-5 border-border/50">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">Productividad por Empleado — Este mes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Citas atendidas e ingresos generados</p>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={productividad} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="citas"    name="Citas"    fill="#d4a017" radius={[4,4,0,0]} maxBarSize={40} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4,4,0,0]} maxBarSize={40} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ── Citas de hoy + Próximas ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Citas hoy */}
            <Card className="p-5 border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Agenda de Hoy</h2>
                  <p className="text-xs text-muted-foreground">{citasHoy.length} citas programadas</p>
                </div>
                <Link href="/citas">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                    Ver todas <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
              {citasHoy.length > 0 ? (
                <div className="space-y-2">
                  {citasHoy.slice(0, 5).map((cita: any) => (
                    <div key={cita.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cita.cliente_nombre}</p>
                        <p className="text-xs text-muted-foreground">{cita.servicio?.nombre} · {cita.empleado?.nombre}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-foreground">{cita.hora}</p>
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', ESTADO_BADGE[cita.estado])}>
                          {ESTADO_LABEL[cita.estado]}
                        </span>
                      </div>
                    </div>
                  ))}
                  {citasHoy.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-1">+{citasHoy.length - 5} citas más hoy</p>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin citas programadas para hoy</p>
                </div>
              )}
            </Card>

            {/* Próximas citas */}
            <Card className="p-5 border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Próximas Citas</h2>
                  <p className="text-xs text-muted-foreground">Pendientes y confirmadas</p>
                </div>
                <Link href="/citas">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                    Gestionar <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
              {upcoming.length > 0 ? (
                <div className="space-y-2">
                  {upcoming.map((cita: any) => (
                    <div key={cita.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Scissors className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cita.cliente_nombre}</p>
                        <p className="text-xs text-muted-foreground">{cita.servicio?.nombre}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-foreground">{fmtDate(cita.fecha)}</p>
                        <p className="text-[10px] text-muted-foreground">{cita.hora}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay citas próximas</p>
                </div>
              )}
            </Card>
          </div>

          {/* ── Actividad Reciente ───────────────────────────────── */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Actividad Reciente</h2>
                <p className="text-xs text-muted-foreground">Últimas citas registradas en el sistema</p>
              </div>
            </div>
            {actividad.length > 0 ? (
              <div className="divide-y divide-border/50">
                {actividad.slice(0, 6).map((item: any, i: number) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-primary">
                      {item.cliente_nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {item.cliente_nombre}
                        <span className="text-muted-foreground font-normal"> — {item.servicio}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">con {item.empleado} · {fmtDate(item.fecha)} {item.hora}</p>
                    </div>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full hidden sm:inline-flex', ESTADO_BADGE[item.estado])}>
                      {ESTADO_LABEL[item.estado]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Sin actividad reciente</p>
            )}
          </Card>

        </div>
      </main>
    </div>
  );
}
