'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, X, Search, MessageCircle, UserPlus, CheckCircle2 } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { TimeSelector } from '@/components/citas/TimeSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { urlWhatsAppConfirmacion } from '@/lib/whatsapp';

const getEmptyForm = () => ({
  cliente_id: '',
  cliente_nombre: '',
  cliente_telefono: '',
  servicio_id: '',
  servicio_ids: [] as string[],
  empleado_id: '',
  fecha: '',
  hora: '',
  notas: '',
});

const ESTADOS = ['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA', 'REPROGRAMADA'];
const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  EN_PROGRESO: 'En Progreso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  REPROGRAMADA: 'Reprogramada',
};
const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'badge-pendiente',
  CONFIRMADA: 'badge-confirmada',
  EN_PROGRESO: 'badge-en_progreso',
  COMPLETADA: 'badge-completada',
  CANCELADA: 'badge-cancelada',
  REPROGRAMADA: 'badge-reprogramada',
};

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PAGE_SIZE = 15;

export default function Citas() {
  const [citas, setCitas]         = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [clientesList, setClientesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<any>(getEmptyForm());
  const [saving, setSaving]       = useState(false);
  const [busqueda, setBusqueda]   = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroEmpleado, setFiltroEmpleado] = useState('');
  const [page, setPage]           = useState(1);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [newCliente, setNewCliente] = useState({ nombre: '', telefono: '' });
  const [creatingCliente, setCreatingCliente] = useState(false);

  const fetchCitas = async (q = '', estado = '', empleado = '') => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q)       params.set('q', q);
      if (estado)  params.set('estado', estado);
      const res  = await fetch('/api/citas?' + params.toString());
      const data = await res.json();
      let list = data.citas || [];
      if (empleado) list = list.filter((c: any) => c.empleado_id === empleado);
      setCitas(list);
      setPage(1);
    } catch {
      toast.error('Error al cargar citas');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCatalogos = async () => {
    const [sR, eR, cR] = await Promise.all([fetch('/api/servicios'), fetch('/api/empleados'), fetch('/api/clientes')]);
    const sD = await sR.json();
    const eD = await eR.json();
    const cD = await cR.json();
    
    setServicios(sD.servicios || []);
    setEmpleados(eD.empleados || []);
    setClientesList(cD.clientes || []);
  };

  useEffect(() => {
    fetchCitas();
    fetchCatalogos();
  }, []);

  const handleSearch = (val: string) => {
    setBusqueda(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCitas(val, filtroEstado, filtroEmpleado), 350);
  };

  const applyFilters = (estado: string, empleado: string) => {
    setFiltroEstado(estado);
    setFiltroEmpleado(empleado);
    fetchCitas(busqueda, estado, empleado);
  };

  const openCreate = () => {
    const activeServs = servicios.filter(s => s.activo);
    const activeEmps = empleados.filter(e => e.activo);
    if (!activeServs.length || !activeEmps.length) {
      toast.error('Crea al menos un servicio y un empleado activos primero');
      return;
    }
    setForm(getEmptyForm());
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (c: any) => {
    const ids = Array.isArray(c.citaServicios) && c.citaServicios.length > 0 
      ? c.citaServicios.map((cs: any) => cs.servicio_id)
      : (c.servicio_id ? [c.servicio_id] : []);

    setForm({
      cliente_id: c.cliente_id || '',
      cliente_nombre: c.cliente_nombre,
      cliente_telefono: c.cliente_telefono || '',
      servicio_id: c.servicio_id || '',
      servicio_ids: ids,
      empleado_id: c.empleado_id,
      fecha: new Date(c.fecha).toISOString().split('T')[0],
      hora: c.hora,
      notas: c.notas || '',
    });
    setEditingId(c.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.servicio_ids || form.servicio_ids.length === 0) {
      toast.error('Selecciona al menos un servicio');
      return;
    }
    if (!form.hora) {
      toast.error('Selecciona una hora');
      return;
    }
    setSaving(true);
    const payload = {
      cliente_id: form.cliente_id || null,
      cliente_nombre: form.cliente_nombre,
      cliente_telefono: form.cliente_telefono || null,
      servicio_id: form.servicio_ids[0],
      servicio_ids: form.servicio_ids,
      empleado_id: form.empleado_id,
      fecha: form.fecha,
      hora: form.hora,
      notas: form.notas || null,
    };
    try {
      const url  = editingId ? `/api/citas/${editingId}` : '/api/citas';
      const meth = editingId ? 'PATCH' : 'POST';
      const res  = await fetch(url, {
        method: meth,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success(editingId ? 'Cita actualizada' : 'Cita creada exitosamente');
      setShowModal(false);
      fetchCitas(busqueda, filtroEstado, filtroEmpleado);
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const changeEstado = async (id: string, estado: string) => {
    setCitas(prev => prev.map(c => c.id === id ? { ...c, estado } : c));
    try {
      const res = await fetch(`/api/citas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) {
        fetchCitas(busqueda, filtroEstado, filtroEmpleado);
        return;
      }
      toast.success(`Estado → ${ESTADO_LABEL[estado]}`);
    } catch {
      fetchCitas(busqueda, filtroEstado, filtroEmpleado);
    }
  };

  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCliente.nombre.trim()) {
      toast.error('Nombre obligatorio');
      return;
    }
    setCreatingCliente(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCliente),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      const data = await res.json();
      const cli = data.cliente;
      toast.success('Cliente creado');
      setClientesList(prev => [...prev, cli]);
      setForm(prev => ({
        ...prev,
        cliente_id: cli.id,
        cliente_nombre: cli.nombre,
        cliente_telefono: cli.telefono || '',
      }));
      setShowClienteModal(false);
      setNewCliente({ nombre: '', telefono: '' });
    } catch (err: any) {
      toast.error(err.message || 'Error al crear');
    } finally {
      setCreatingCliente(false);
    }
  };

  // Paginación
  const totalPages = Math.ceil(citas.length / PAGE_SIZE);
  const paginated  = citas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestión de Citas</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {citas.length} cita{citas.length !== 1 ? 's' : ''} en total
              </p>
            </div>
            <Button onClick={openCreate} className="gap-1.5 glow-gold">
              <Plus className="w-4 h-4" /> Nueva Cita
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, servicio..."
                value={busqueda}
                onChange={e => handleSearch(e.target.value)}
                className="pl-10 bg-card"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={e => applyFilters(e.target.value, filtroEmpleado)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[150px]"
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
            </select>
            <select
              value={filtroEmpleado}
              onChange={e => applyFilters(filtroEstado, e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[150px]"
            >
              <option value="">Todos los empleados</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>

          {/* Tabla */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/70 text-secondary-foreground border-b border-border/50">
                  <tr>
                    {['Cliente', 'Servicio', 'Empleado', 'Fecha y Hora', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <div className="skeleton h-4 w-40" />
                        </div>
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        {busqueda || filtroEstado || filtroEmpleado ? 'Sin resultados para los filtros aplicados' : 'No hay citas registradas'}
                      </td>
                    </tr>
                  ) : paginated.map((cita) => {
                    const waUrl = cita.cliente_telefono ? urlWhatsAppConfirmacion({
                      cliente_nombre: cita.cliente_nombre,
                      cliente_telefono: cita.cliente_telefono,
                      servicio: cita.servicio?.nombre || '',
                      empleado: cita.empleado?.nombre || '',
                      fecha: cita.fecha,
                      hora: cita.hora,
                    }) : null;
                    return (
                      <tr key={cita.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-foreground">{cita.cliente_nombre}</p>
                          {cita.cliente_telefono && <p className="text-xs text-muted-foreground">{cita.cliente_telefono}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">
                          {cita.citaServicios && cita.citaServicios.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {cita.citaServicios.map((cs: any) => (
                                <span 
                                  key={cs.id} 
                                  className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium" 
                                  title={cs.servicio?.nombre}
                                >
                                  {cs.servicio?.nombre}
                                </span>
                              ))}
                            </div>
                          ) : (
                            cita.servicio?.nombre || '-'
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{cita.empleado?.nombre || '-'}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium">{fmtDate(cita.fecha)}</p>
                          <p className="text-xs text-muted-foreground">{cita.hora} · {cita.duracion} min</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <select
                            value={cita.estado}
                            onChange={e => changeEstado(cita.id, e.target.value)}
                            className={cn('text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer bg-transparent', ESTADO_BADGE[cita.estado])}
                          >
                            {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cita)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            {waUrl && (
                              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#25D366] hover:text-[#1ebe5a] hover:bg-[#25D366]/10">
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </Button>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-secondary/20">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} · {citas.length} resultados
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 text-xs">Anterior</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 text-xs">Siguiente</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto border-border/50 shadow-2xl">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold mb-5">{editingId ? 'Editar Cita' : 'Nueva Cita'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre del cliente *</label>
                    <button type="button" onClick={() => setShowClienteModal(true)} className="text-[10px] flex items-center gap-1 font-bold text-primary hover:underline">
                      <UserPlus className="w-3.5 h-3.5" /> Nuevo
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      list="clientes-list"
                      value={form.cliente_nombre}
                      onChange={e => {
                        const val = e.target.value;
                        const match = clientesList.find(c => c.nombre.toLowerCase() === val.toLowerCase());
                        if (match) {
                          setForm({ ...form, cliente_nombre: match.nombre, cliente_telefono: match.telefono || '', cliente_id: match.id });
                        } else {
                          setForm({ ...form, cliente_nombre: val, cliente_id: '' });
                        }
                      }}
                      required
                      placeholder="Escriba o seleccione..."
                      className={cn(form.cliente_id && 'pr-8 border-emerald-500/50')}
                    />
                    {form.cliente_id && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" title="Cliente vinculado a la base de datos">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <datalist id="clientes-list">
                    {clientesList.map(c => (
                      <option key={c.id} value={c.nombre}>{c.telefono ? `${c.nombre} (${c.telefono})` : c.nombre}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Teléfono</label>
                  <Input
                    value={form.cliente_telefono}
                    onChange={e => setForm({ ...form, cliente_telefono: e.target.value })}
                    placeholder="8888-0000"
                    readOnly={!!form.cliente_id}
                    className={cn(form.cliente_id && 'bg-secondary/30 text-muted-foreground cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0')}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Servicio(s) *</label>
                <div className="space-y-2">
                  <select
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) return;
                      if (form.servicio_ids.includes(val)) {
                        toast.error('Este servicio ya está agregado');
                        return;
                      }
                      setForm((prev: any) => ({
                        ...prev,
                        servicio_ids: [...prev.servicio_ids, val],
                        hora: '' // Reset selected time
                      }));
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">+ Agregar servicio...</option>
                    {servicios
                      .filter(s => s.activo || form.servicio_ids.includes(s.id))
                      .filter(s => !form.servicio_ids.includes(s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.nombre} ({s.duracion} min)</option>
                      ))}
                  </select>

                  {form.servicio_ids.length > 0 && (
                    <div className="border border-border/60 rounded-lg p-2.5 space-y-1.5 bg-secondary/15">
                      {form.servicio_ids.map((id: string, index: number) => {
                        const s = servicios.find(srv => srv.id === id);
                        if (!s) return null;
                        return (
                          <div key={id} className="flex items-center justify-between bg-card border border-border/40 px-2.5 py-1.5 rounded-md text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded-full">
                                {index + 1}
                              </span>
                              <span className="font-medium text-foreground">{s.nombre}</span>
                              <span className="text-xs text-muted-foreground">({s.duracion} min)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setForm((prev: any) => ({
                                  ...prev,
                                  servicio_ids: prev.servicio_ids.filter((sid: string) => sid !== id),
                                  hora: '' // Reset selected time
                                }));
                              }}
                              className="text-muted-foreground hover:text-red-500 p-0.5 rounded transition-colors"
                              title="Quitar servicio"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                      
                      {(() => {
                        const totalDur = form.servicio_ids.reduce((sum: number, id: string) => {
                          const s = servicios.find(srv => srv.id === id);
                          return sum + (s?.duracion || 0);
                        }, 0);
                        return (
                          <div className="flex items-center justify-between pt-1.5 border-t border-border/50 px-1 text-xs font-semibold text-foreground">
                            <span>Total: {form.servicio_ids.length} servicio(s)</span>
                            <span className="text-primary font-bold">{totalDur} minutos</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Empleado *</label>
                <select
                  value={form.empleado_id}
                  onChange={e => setForm({ ...form, empleado_id: e.target.value, hora: '' })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar empleado...</option>
                  {/* Permitimos el empleado actual si estamos editando, e incluimos solo empleados ACTIVOS para nuevas citas */}
                  {empleados.filter(e => e.activo || e.id === form.empleado_id).map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}{e.especialidad ? ` (${e.especialidad})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Fecha *</label>
                <Input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm({ ...form, fecha: e.target.value, hora: '' })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              {form.fecha && form.empleado_id && form.servicio_ids.length > 0 && (
                <div className="bg-secondary/30 border border-border/50 rounded-xl p-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-3">Selecciona la Hora *</label>
                  <TimeSelector
                    empleadoId={form.empleado_id}
                    fecha={form.fecha}
                    servicioId={form.servicio_ids[0]}
                    duracionTotal={form.servicio_ids.reduce((sum: number, id: string) => {
                      const s = servicios.find(srv => srv.id === id);
                      return sum + (s?.duracion || 0);
                    }, 0)}
                    selectedTime={form.hora}
                    onTimeSelect={h => setForm({ ...form, hora: h })}
                  />
                </div>
              )}
              {form.servicio_ids.length > 0 && (
                <div className="flex items-center gap-4 bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Duración total estimada:</span>{' '}
                    <strong>
                      {form.servicio_ids.reduce((sum: number, id: string) => {
                        const s = servicios.find(srv => srv.id === id);
                        return sum + (s?.duracion || 0);
                      }, 0)}{' '}
                      minutos
                    </strong>
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Notas / Comentarios</label>
                <Input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones o peticiones especiales..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="glow-gold">
                  {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear Cita')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {/* Modal Crear Cliente Inline */}
      {showClienteModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-sm p-6 relative border-border/50 shadow-2xl">
            <button onClick={() => setShowClienteModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Crear Cliente
            </h2>
            <form onSubmit={handleCreateCliente} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre completo *</label>
                <Input value={newCliente.nombre} onChange={e => setNewCliente({ ...newCliente, nombre: e.target.value })} required placeholder="Ej: Juan Pérez" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Teléfono</label>
                <Input value={newCliente.telefono} onChange={e => setNewCliente({ ...newCliente, telefono: e.target.value })} placeholder="8888-0000" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowClienteModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={creatingCliente} className="glow-gold">
                  {creatingCliente ? 'Guardando...' : 'Guardar y Seleccionar'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
