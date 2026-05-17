'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Search, Star, TrendingUp, Phone, Calendar,
  DollarSign, Clock, ChevronRight, Scissors, X, RefreshCcw, UserPlus,
} from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { urlWhatsAppConfirmacion } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  totalCitas: number;
  citasCompletadas: number;
  gastoTotal: number;
  ultimaCita: string;
  primeraCita: string;
  esRecurrente: boolean;
  servicioFavorito: string | null;
  historial: any[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtUSD(n: number) {
  return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'badge-pendiente',
  CONFIRMADA: 'badge-confirmada',
  COMPLETADA: 'badge-completada',
  CANCELADA: 'badge-cancelada',
  EN_PROGRESO: 'badge-en_progreso',
  REPROGRAMADA: 'badge-reprogramada',
};
const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada', EN_PROGRESO: 'En Progreso', REPROGRAMADA: 'Reprogramada',
};

// ─── Avatar con iniciales ─────────────────────────────────────────────────
function Avatar({ nombre, size = 'md' }: { nombre: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = nombre.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  const colors = [
    'bg-amber-500', 'bg-emerald-500', 'bg-blue-500',
    'bg-purple-500', 'bg-rose-500', 'bg-cyan-500',
  ];
  const color = colors[nombre.charCodeAt(0) % colors.length];
  const sz = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' }[size];
  return (
    <div className={cn('rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0', color, sz)}>
      {initials}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <div className="flex gap-3">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="skeleton h-12 rounded-lg" />
            <div className="skeleton h-12 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Modal de historial ───────────────────────────────────────────────────────
function HistorialModal({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-border/50">
          <Avatar nombre={cliente.nombre} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-foreground truncate">{cliente.nombre}</h2>
              {cliente.esRecurrente && (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                  <Star className="w-2.5 h-2.5" /> VIP
                </span>
              )}
            </div>
            {cliente.telefono && (
              <p className="text-sm text-muted-foreground">{cliente.telefono}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-border/50">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{cliente.totalCitas}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Visitas</p>
          </div>
          <div className="text-center border-x border-border/50">
            <p className="text-lg font-bold text-emerald-500">{fmtUSD(cliente.gastoTotal)}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gastado</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{cliente.citasCompletadas}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Completadas</p>
          </div>
        </div>

        {/* Historial */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Historial de citas</p>
          {cliente.historial.map((cita: any) => (
            <div key={cita.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Scissors className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{cita.servicio.nombre}</p>
                <p className="text-xs text-muted-foreground">con {cita.empleado.nombre}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-semibold text-foreground">{fmtDate(cita.fecha)}</p>
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', ESTADO_BADGE[cita.estado])}>
                  {ESTADO_LABEL[cita.estado]}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer con WhatsApp */}
        <div className="p-4 border-t border-border/50">
          {cliente.telefono ? (
            <a
              href={urlWhatsAppConfirmacion({
                cliente_nombre: cliente.nombre,
                cliente_telefono: cliente.telefono,
                servicio: cliente.servicioFavorito ?? 'Servicio',
                empleado: 'HAIR STYLE',
                fecha: new Date(),
                hora: '—',
              }) ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-xl py-2.5 text-sm font-semibold transition-all"
            >
              <Phone className="w-4 h-4" />
              Contactar por WhatsApp
            </a>
          ) : (
            <p className="text-xs text-center text-muted-foreground">Sin número de teléfono registrado</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cliente Card ─────────────────────────────────────────────────────────────
function ClienteCard({ cliente, onSelect }: { cliente: Cliente; onSelect: () => void }) {
  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-5 hover-lift cursor-pointer group"
      onClick={onSelect}
    >
      <div className="flex items-start gap-3 mb-4">
        <Avatar nombre={cliente.nombre} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-foreground truncate text-sm">{cliente.nombre}</p>
            {cliente.esRecurrente && (
              <Star className="w-3 h-3 text-amber-500 flex-shrink-0" fill="currentColor" />
            )}
          </div>
          {cliente.telefono ? (
            <p className="text-xs text-muted-foreground mt-0.5">{cliente.telefono}</p>
          ) : (
            <p className="text-xs text-muted-foreground/50 mt-0.5 italic">Sin teléfono</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{cliente.totalCitas}</p>
          <p className="text-[10px] text-muted-foreground">Visitas</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">{fmtUSD(cliente.gastoTotal)}</p>
          <p className="text-[10px] text-muted-foreground">Gastado</p>
        </div>
      </div>

      {/* Info adicional */}
      <div className="space-y-1.5">
        {cliente.servicioFavorito && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Scissors className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{cliente.servicioFavorito}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          <span>Última visita: {fmtDate(cliente.ultimaCita)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Agregar Cliente ─────────────────────────────────────────────────
function AgregarClienteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nombre: '', telefono: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Cliente registrado exitosamente');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar cliente');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">Agregar Cliente</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre completo *</label>
            <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required placeholder="Juan Pérez" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Teléfono (opcional)</label>
            <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="8888-0000" />
          </div>
          <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">
            El cliente quedará registrado como pendiente. Puede programarle una cita luego desde la sección de Citas.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="glow-gold">
              {saving ? 'Guardando...' : 'Registrar Cliente'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [showAgregar, setShowAgregar] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClientes = useCallback(async (q = '') => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok) setClientes(data.clientes ?? []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  // Debounce búsqueda
  const handleSearch = (val: string) => {
    setBusqueda(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchClientes(val), 350);
  };

  const recurrentes = clientes.filter((c) => c.esRecurrente).length;
  const gastoTotal  = clientes.reduce((a, c) => a + c.gastoTotal, 0);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 page-enter">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Historial y estadísticas de tus clientes</p>
            </div>
            <div className="flex gap-2 self-start sm:self-auto">
              <Button variant="outline" size="sm" onClick={() => fetchClientes(busqueda)} className="gap-1.5">
                <RefreshCcw className="w-3.5 h-3.5" /> Actualizar
              </Button>
              <Button size="sm" onClick={() => setShowAgregar(true)} className="gap-1.5 glow-gold">
                <UserPlus className="w-3.5 h-3.5" /> Agregar Cliente
              </Button>
            </div>
          </div>

          {/* ── KPI mini ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 border-border/50 text-center">
              <p className="text-xl font-bold text-foreground">{clientes.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Clientes únicos</p>
            </Card>
            <Card className="p-4 border-border/50 text-center">
              <p className="text-xl font-bold text-amber-500">{recurrentes}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Recurrentes</p>
            </Card>
            <Card className="p-4 border-border/50 text-center">
              <p className="text-xl font-bold text-emerald-500">
                {new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'USD', notation: 'compact' }).format(gastoTotal)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Facturado</p>
            </Card>
          </div>

          {/* ── Búsqueda ─────────────────────────────────────────── */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o teléfono..."
              value={busqueda}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 bg-card border-border/60"
            />
            {busqueda && (
              <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ── Grid de clientes ─────────────────────────────────── */}
          {isLoading ? (
            <Skeleton />
          ) : clientes.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">
                {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay clientes registrados'}
              </p>
              <p className="text-sm mt-1 opacity-70">Los clientes aparecen aquí cuando tienen citas</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Mostrando <strong>{clientes.length}</strong> cliente{clientes.length !== 1 ? 's' : ''}
                {busqueda && ` para "${busqueda}"`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientes.map((c) => (
                  <ClienteCard key={c.id} cliente={c} onSelect={() => setClienteSeleccionado(c)} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modal de historial */}
      {clienteSeleccionado && (
        <HistorialModal
          cliente={clienteSeleccionado}
          onClose={() => setClienteSeleccionado(null)}
        />
      )}

      {/* Modal agregar cliente */}
      {showAgregar && (
        <AgregarClienteModal
          onClose={() => setShowAgregar(false)}
          onCreated={() => fetchClientes(busqueda)}
        />
      )}
    </div>
  );
}
