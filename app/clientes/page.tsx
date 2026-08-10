'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Search, Star, Phone, Calendar,
  Scissors, X, RefreshCcw, UserPlus, ChevronRight, Trash2, Edit
} from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { urlWhatsAppConfirmacion } from '@/lib/whatsapp';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { APPOINTMENT_STATUS_BADGE_CLASSES, APPOINTMENT_STATUS_LABELS } from '@/lib/appointments/appointment-status';

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  cedula: string | null;
  correo: string | null;
  notas: string | null;
  totalCitas: number;
  citasCompletadas: number;
  ultimaCita: string;
  primeraCita: string;
  esRecurrente: boolean;
  servicioFavorito: string | null;
  historial: any[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
function HistorialModal({ cliente, onClose, onDelete, onEdit }: { cliente: any; onClose: () => void; onDelete: (id: string) => void; onEdit: (cliente: any) => void }) {
  const { user } = useAuth();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'TECH_SUPPORT' || (user?.rol === 'EMPLEADO' && cliente.createdByUserId === user?.id);
  const canDelete = user?.rol === 'ADMIN' || user?.rol === 'TECH_SUPPORT' || (user?.rol === 'EMPLEADO' && cliente.createdByUserId === user?.id);

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="historial-cliente-title"
    >
      <div className="w-full max-w-lg bg-card border border-border/50 rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl shadow-2xl max-h-[94dvh] sm:max-h-[88vh] flex flex-col pb-safe overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-border/50 shrink-0">
          <Avatar nombre={cliente.nombre} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="historial-cliente-title" className="font-bold text-foreground truncate">{cliente.nombre}</h2>
              {cliente.esRecurrente && (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                  <Star className="w-2.5 h-2.5" /> VIP
                </span>
              )}
            </div>
            {cliente.telefono && (
              <p className="text-sm text-muted-foreground">{cliente.telefono}</p>
            )}
            {cliente.correo && (
              <p className="text-xs text-muted-foreground truncate">{cliente.correo}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar historial"
            className="w-11 h-11 rounded-xl hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 p-3 sm:p-4 border-b border-border/50 shrink-0">
          <div className="text-center border-r border-border/50">
            <p className="text-lg font-bold text-foreground">{cliente.totalCitas}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Visitas</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{cliente.citasCompletadas}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Completadas</p>
          </div>
        </div>

        {/* Historial */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Historial de citas</p>
          {cliente.historial && cliente.historial.length > 0 ? (
            cliente.historial.map((cita: any) => (
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
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', APPOINTMENT_STATUS_BADGE_CLASSES[cita.estado])}>
                    {APPOINTMENT_STATUS_LABELS[cita.estado]}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-4">Sin citas en el historial visible</p>
          )}
        </div>

        {/* Notas Privadas */}
        {cliente.notas && (
          <div className="px-5 py-3 border-t border-border/30 bg-secondary/10 shrink-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Notas / Observaciones</p>
            <p className="text-xs text-foreground mt-1 whitespace-pre-wrap leading-relaxed">{cliente.notas}</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border/50 flex flex-col gap-2 bg-secondary/5 shrink-0">
          <div className="flex gap-2">
            {cliente.telefono && cliente.telefono !== '••••••••' ? (
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
                className="flex items-center justify-center gap-2 flex-1 bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-xl py-2.5 text-sm font-semibold transition-all"
              >
                <Phone className="w-4 h-4" />
                WhatsApp
              </a>
            ) : (
              <p className="text-xs text-center text-muted-foreground flex-1 self-center border border-border/30 rounded-xl py-2.5 bg-background/50">
                Sin número registrado
              </p>
            )}

            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(cliente)}
                className="flex items-center justify-center gap-2 flex-1 border border-border/50 hover:bg-secondary rounded-xl py-2.5 text-sm font-semibold transition-all"
              >
                <Edit className="w-4 h-4" />
                Editar Datos
              </Button>
            )}
          </div>

          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(cliente.id)}
              className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-all mt-1"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar Cliente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cliente Card ─────────────────────────────────────────────────────────────
function ClienteCard({ cliente, onSelect }: { cliente: any; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Ver historial de ${cliente.nombre}`}
      className="surface-panel w-full p-4 sm:p-5 hover-lift cursor-pointer group text-left focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
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
            <p className="text-xs text-muted-foreground mt-0.5">
              {cliente.telefono}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50 mt-0.5 italic">Sin teléfono</p>
          )}
          {cliente.correo && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {cliente.correo}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{cliente.totalCitas}</p>
          <p className="text-[10px] text-muted-foreground">Visitas</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{cliente.citasCompletadas}</p>
          <p className="text-[10px] text-muted-foreground">Completadas</p>
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
    </button>
  );
}

// ─── Modal Agregar Cliente ─────────────────────────────────────────────────
function AgregarClienteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nombre: '', telefono: '', cedula: '', correo: '', notas: '' });
  const [phoneValid, setPhoneValid] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (form.nombre.trim().length < 2) { toast.error('El nombre debe tener al menos 2 caracteres'); return; }
    if (form.telefono && !phoneValid) { toast.error('El número de teléfono no es válido'); return; }
    setSaving(true);
    try {
      let res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      let data = await res.json();
      if (!res.ok && data.requiresConfirmation) {
        const continuar = window.confirm(`${data.error}\n\n¿Deseas crear otro cliente con este nombre?`);
        if (!continuar) return;
        res = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, confirmarDuplicadoNombre: true }),
        });
        data = await res.json();
      }
      if (!res.ok) throw new Error(data.error);
      toast.success('Cliente registrado exitosamente');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar cliente');
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agregar-cliente-title"
    >
      <div className="w-full max-w-md bg-card border border-border/50 rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl shadow-2xl p-4 sm:p-6 pb-safe max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/40 shrink-0">
          <h2 id="agregar-cliente-title" className="text-lg font-bold text-foreground">Agregar Cliente</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar formulario" className="w-11 h-11 rounded-xl hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="min-h-0 space-y-4 overflow-y-auto flex-1 custom-scrollbar pr-0.5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre completo *</label>
            <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required placeholder="Juan Pérez" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Teléfono (opcional)</label>
            <PhoneInput
              value={form.telefono}
              optional={true}
              onChange={(formattedVal, isValid) => {
                setForm(prev => ({ ...prev, telefono: formattedVal }));
                setPhoneValid(isValid);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Cédula (opcional)</label>
            <Input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} placeholder="Identificación" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Correo electrónico (opcional)</label>
            <Input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} placeholder="juan.perez@ejemplo.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Notas (opcional)</label>
            <textarea
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              placeholder="Alergias, preferencias, observaciones..."
              rows={2}
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">
            El cliente quedará registrado y podrá programarle una cita desde el panel correspondiente.
          </p>
          <div className="sticky bottom-0 flex justify-end gap-2 pt-3 pb-1 border-t border-border/50 bg-card shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">Cancelar</Button>
            <Button type="submit" disabled={saving} className="glow-gold flex-1 sm:flex-none">
              {saving ? 'Guardando...' : 'Registrar Cliente'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Editar Cliente ───────────────────────────────────────────────────
function EditarClienteModal({ cliente, onClose, onUpdated }: { cliente: Cliente; onClose: () => void; onUpdated: (data: { nombre: string; telefono: string | null; cedula: string | null; correo: string | null; notas: string | null }) => void }) {
  const [form, setForm] = useState({
    nombre: cliente.nombre || '',
    telefono: cliente.telefono || '',
    cedula: cliente.cedula || '',
    correo: cliente.correo || '',
    notas: cliente.notas || '',
  });
  const [phoneValid, setPhoneValid] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (form.nombre.trim().length < 2) { toast.error('El nombre debe tener al menos 2 caracteres'); return; }
    if (form.telefono && !phoneValid) { toast.error('El número de teléfono no es válido'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Cliente actualizado exitosamente');
      onUpdated({
        nombre: form.nombre.trim(),
        telefono: data.cliente?.telefono ?? (form.telefono?.trim() || null),
        cedula: data.cliente?.cedula ?? (form.cedula?.trim() || null),
        correo: data.cliente?.correo ?? (form.correo?.trim().toLowerCase() || null),
        notas: data.cliente?.notas ?? (form.notas?.trim() || null),
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar cliente');
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editar-cliente-title"
    >
      <div className="w-full max-w-md bg-card border border-border/50 rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl shadow-2xl p-4 sm:p-6 pb-safe max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/40 shrink-0">
          <h2 id="editar-cliente-title" className="text-lg font-bold text-foreground">Editar Cliente</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar formulario" className="w-11 h-11 rounded-xl hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="min-h-0 space-y-4 overflow-y-auto flex-1 custom-scrollbar pr-0.5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre completo *</label>
            <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required placeholder="Juan Pérez" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Teléfono (opcional)</label>
            <PhoneInput
              value={form.telefono}
              optional={true}
              onChange={(formattedVal, isValid) => {
                setForm(prev => ({ ...prev, telefono: formattedVal }));
                setPhoneValid(isValid);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Cédula (opcional)</label>
            <Input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} placeholder="Identificación" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Correo electrónico (opcional)</label>
            <Input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} placeholder="juan.perez@ejemplo.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Notas (opcional)</label>
            <textarea
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              placeholder="Alergias, preferencias, observaciones..."
              rows={2}
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 pt-3 pb-1 border-t border-border/50 bg-card shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">Cancelar</Button>
            <Button type="submit" disabled={saving} className="glow-gold flex-1 sm:flex-none">
              {saving ? 'Guardando...' : 'Guardar Cambios'}
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
  const [clienteAEditar, setClienteAEditar] = useState<Cliente | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClientes = useCallback(async (q = '', targetPage = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ q, page: String(targetPage), limit: '24' });
      const res = await fetch(`/api/clientes?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setClientes(data.clientes ?? []);
        setTotal(data.total ?? 0);
        setPage(data.page ?? targetPage);
        setTotalPages(data.totalPages ?? 1);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  // Debounce búsqueda
  const handleSearch = (val: string) => {
    setBusqueda(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchClientes(val, 1), 350);
  };

  const handleEliminarCliente = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente? Se desvinculará de sus citas históricas sin perder el registro de las mismas.')) {
      return;
    }
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar cliente');
      toast.success('Cliente eliminado exitosamente');
      setClienteSeleccionado(null);
      fetchClientes(busqueda);
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar cliente');
    }
  };

  const recurrentes = clientes.filter((c) => c.esRecurrente).length;
  const totalCitasCompletadas = clientes.reduce((a, c) => a + c.citasCompletadas, 0);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="app-page space-y-5 sm:space-y-6 page-enter">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="page-heading text-foreground">Clientes</h1>
              <p className="page-description truncate sm:whitespace-normal">Historial y estadísticas de tus clientes</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="icon" onClick={() => fetchClientes(busqueda)} aria-label="Actualizar clientes" title="Actualizar clientes">
                <RefreshCcw className="w-4 h-4" />
              </Button>
              <Button onClick={() => setShowAgregar(true)} className="gap-2 glow-gold px-3.5 sm:px-4">
                <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Registrar cliente</span><span className="sm:hidden">Registrar</span>
              </Button>
            </div>
          </div>


          {/* ── KPI mini ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="surface-panel p-2.5 sm:p-4 text-center">
              <p className="text-xl font-bold text-foreground">{total}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">Clientes únicos</p>
            </Card>
            <Card className="surface-panel p-2.5 sm:p-4 text-center">
              <p className="text-xl font-bold text-amber-500">{recurrentes}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">Recurrentes</p>
            </Card>
            <Card className="surface-panel p-2.5 sm:p-4 text-center">
              <p className="text-xl font-bold text-emerald-500">{totalCitasCompletadas}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">Completadas</p>
            </Card>
          </div>

          {/* ── Búsqueda ─────────────────────────────────────────── */}
          <div className="sticky top-14 lg:top-0 z-20 -mx-1 px-1 py-2 bg-background/90 backdrop-blur-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o cédula..."
              value={busqueda}
              onChange={(e) => handleSearch(e.target.value)}
              aria-label="Buscar clientes"
              className="pl-10 pr-11 bg-card border-border/60 shadow-sm"
            />
            {busqueda && (
              <button type="button" onClick={() => handleSearch('')} aria-label="Limpiar búsqueda" className="absolute right-1.5 top-1/2 -translate-y-1/2 size-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ── Grid de clientes ─────────────────────────────────── */}
          {isLoading ? (
            <Skeleton />
          ) : clientes.length === 0 ? (
            <div className="empty-state surface-panel text-muted-foreground">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {clientes.map((c) => (
                  <ClienteCard key={c.id} cliente={c} onSelect={() => setClienteSeleccionado(c)} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="surface-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    PÃ¡gina {page} de {totalPages} Â· {total} clientes
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => fetchClientes(busqueda, page - 1)} disabled={page <= 1} className="min-h-11 flex-1 sm:flex-none">
                      Anterior
                    </Button>
                    <Button variant="outline" onClick={() => fetchClientes(busqueda, page + 1)} disabled={page >= totalPages} className="min-h-11 flex-1 sm:flex-none">
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal de historial */}
      {clienteSeleccionado && (
        <HistorialModal
          cliente={clienteSeleccionado}
          onClose={() => setClienteSeleccionado(null)}
          onDelete={handleEliminarCliente}
          onEdit={(c) => setClienteAEditar(c)}
        />
      )}

      {/* Modal agregar cliente */}
      {showAgregar && (
        <AgregarClienteModal
          onClose={() => setShowAgregar(false)}
          onCreated={() => fetchClientes(busqueda)}
        />
      )}

      {/* Modal editar cliente */}
      {clienteAEditar && (
        <EditarClienteModal
          cliente={clienteAEditar}
          onClose={() => setClienteAEditar(null)}
          onUpdated={(formFields) => {
            fetchClientes(busqueda);
            if (clienteSeleccionado && clienteSeleccionado.id === clienteAEditar.id) {
              setClienteSeleccionado((prev) => prev ? {
                ...prev,
                ...formFields
              } : null);
            }
          }}
        />
      )}
    </div>
  );
}
