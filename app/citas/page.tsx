'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, X, Search, Filter, MessageCircle, Phone } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { TimeSelector } from '@/components/citas/TimeSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { urlWhatsAppConfirmacion, urlWhatsAppCancelacion } from '@/lib/whatsapp';

const emptyForm = {
  cliente_nombre: '', cliente_telefono: '', servicio_id: '',
  empleado_id: '', fecha: '', hora: '', notas: '', metodo_pago: '',
};

const ESTADOS = ['PENDIENTE','CONFIRMADA','EN_PROGRESO','COMPLETADA','CANCELADA','REPROGRAMADA'];
const ESTADO_LABEL: Record<string,string> = {
  PENDIENTE:'Pendiente', CONFIRMADA:'Confirmada', EN_PROGRESO:'En Progreso',
  COMPLETADA:'Completada', CANCELADA:'Cancelada', REPROGRAMADA:'Reprogramada',
};
const ESTADO_BADGE: Record<string,string> = {
  PENDIENTE:'badge-pendiente', CONFIRMADA:'badge-confirmada',
  EN_PROGRESO:'badge-en_progreso', COMPLETADA:'badge-completada',
  CANCELADA:'badge-cancelada', REPROGRAMADA:'badge-reprogramada',
};

function fmtUSD(n: number) {
  return new Intl.NumberFormat('es-NI',{style:'currency',currency:'USD'}).format(n);
}
function fmtDate(d: string|Date) {
  return new Date(d).toLocaleDateString('es-NI',{day:'2-digit',month:'short',year:'numeric'});
}

const PAGE_SIZE = 15;

export default function Citas() {
  const [citas, setCitas]         = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [busqueda, setBusqueda]   = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroEmpleado, setFiltroEmpleado] = useState('');
  const [page, setPage]           = useState(1);
  const debounceRef               = useRef<ReturnType<typeof setTimeout>|null>(null);

  const fetchCitas = async (q='',estado='',empleado='') => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q)       params.set('q',q);
      if (estado)  params.set('estado',estado);
      const res  = await fetch('/api/citas?'+params.toString());
      const data = await res.json();
      let list = data.citas || [];
      if (empleado) list = list.filter((c:any)=>c.empleado_id===empleado);
      setCitas(list);
      setPage(1);
    } catch { toast.error('Error al cargar citas'); }
    finally  { setIsLoading(false); }
  };

  const fetchCatalogos = async () => {
    const [sR,eR] = await Promise.all([fetch('/api/servicios'),fetch('/api/empleados')]);
    const sD = await sR.json(); const eD = await eR.json();
    setServicios(sD.servicios||[]); setEmpleados(eD.empleados||[]);
  };

  useEffect(()=>{ fetchCitas(); fetchCatalogos(); },[]);

  const handleSearch = (val:string) => {
    setBusqueda(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>fetchCitas(val,filtroEstado,filtroEmpleado),350);
  };

  const applyFilters = (estado:string, empleado:string) => {
    setFiltroEstado(estado); setFiltroEmpleado(empleado);
    fetchCitas(busqueda,estado,empleado);
  };

  const selectedServicio = servicios.find(s=>s.id===form.servicio_id);

  const openCreate = () => {
    if (!servicios.length||!empleados.length) { toast.error('Crea al menos un servicio y un empleado primero'); return; }
    setForm(emptyForm); setEditingId(null); setShowModal(true);
  };

  const openEdit = (c:any) => {
    setForm({
      cliente_nombre:c.cliente_nombre, cliente_telefono:c.cliente_telefono||'',
      servicio_id:c.servicio_id, empleado_id:c.empleado_id,
      fecha:new Date(c.fecha).toISOString().split('T')[0], hora:c.hora,
      notas:c.notas||'', metodo_pago:c.metodo_pago||'',
    });
    setEditingId(c.id); setShowModal(true);
  };

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault();
    if (!form.hora) { toast.error('Selecciona una hora'); return; }
    setSaving(true);
    const serv = servicios.find(s=>s.id===form.servicio_id);
    const payload = {...form, duracion:serv?.duracion||30, precio:serv?.precio||0};
    try {
      const url  = editingId ? `/api/citas/${editingId}` : '/api/citas';
      const meth = editingId ? 'PATCH' : 'POST';
      const res  = await fetch(url,{method:meth,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if (!res.ok) { const d=await res.json(); throw new Error(d.error); }
      toast.success(editingId?'Cita actualizada':'Cita creada exitosamente');
      setShowModal(false);
      fetchCitas(busqueda,filtroEstado,filtroEmpleado);
    } catch(err:any) { toast.error(err.message||'Error al guardar'); }
    finally { setSaving(false); }
  };

  const changeEstado = async (id:string, estado:string) => {
    setCitas(prev=>prev.map(c=>c.id===id?{...c,estado}:c));
    try {
      const res = await fetch(`/api/citas/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado})});
      if (!res.ok) { fetchCitas(busqueda,filtroEstado,filtroEmpleado); return; }
      toast.success(`Estado → ${ESTADO_LABEL[estado]}`);
    } catch { fetchCitas(busqueda,filtroEstado,filtroEmpleado); }
  };

  // Paginación
  const totalPages = Math.ceil(citas.length/PAGE_SIZE);
  const paginated  = citas.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

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
                {citas.length} cita{citas.length!==1?'s':''} en total
              </p>
            </div>
            <Button onClick={openCreate} className="gap-1.5 glow-gold">
              <Plus className="w-4 h-4"/> Nueva Cita
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
              <Input placeholder="Buscar cliente, servicio..." value={busqueda}
                onChange={e=>handleSearch(e.target.value)} className="pl-10 bg-card"/>
            </div>
            <select value={filtroEstado} onChange={e=>applyFilters(e.target.value,filtroEmpleado)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[150px]">
              <option value="">Todos los estados</option>
              {ESTADOS.map(e=><option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
            </select>
            <select value={filtroEmpleado} onChange={e=>applyFilters(filtroEstado,e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[150px]">
              <option value="">Todos los empleados</option>
              {empleados.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>

          {/* Tabla */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/70 text-secondary-foreground border-b border-border/50">
                  <tr>
                    {['Cliente','Servicio','Empleado','Fecha y Hora','Precio','Estado','Acciones'].map(h=>(
                      <th key={h} className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="skeleton h-4 w-40"/>
                      </div>
                    </td></tr>
                  ) : paginated.length===0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      {busqueda||filtroEstado||filtroEmpleado ? 'Sin resultados para los filtros aplicados' : 'No hay citas registradas'}
                    </td></tr>
                  ) : paginated.map((cita)=>{
                    const waUrl = cita.cliente_telefono ? urlWhatsAppConfirmacion({
                      cliente_nombre:cita.cliente_nombre, cliente_telefono:cita.cliente_telefono,
                      servicio:cita.servicio?.nombre||'', empleado:cita.empleado?.nombre||'',
                      fecha:cita.fecha, hora:cita.hora, precio:cita.precio,
                    }) : null;
                    return (
                      <tr key={cita.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-foreground">{cita.cliente_nombre}</p>
                          {cita.cliente_telefono&&<p className="text-xs text-muted-foreground">{cita.cliente_telefono}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{cita.servicio?.nombre||'-'}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{cita.empleado?.nombre||'-'}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium">{fmtDate(cita.fecha)}</p>
                          <p className="text-xs text-muted-foreground">{cita.hora} · {cita.servicio?.duracion||cita.duracion}min</p>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-primary">{fmtUSD(cita.precio)}</td>
                        <td className="px-4 py-3.5">
                          <select value={cita.estado} onChange={e=>changeEstado(cita.id,e.target.value)}
                            className={cn('text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer bg-transparent', ESTADO_BADGE[cita.estado])}>
                            {ESTADOS.map(e=><option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(cita)}>
                              <Edit className="w-3.5 h-3.5"/>
                            </Button>
                            {waUrl&&(
                              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#25D366] hover:text-[#1ebe5a] hover:bg-[#25D366]/10">
                                  <MessageCircle className="w-3.5 h-3.5"/>
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
            {totalPages>1&&(
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-secondary/20">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} · {citas.length} resultados
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="h-7 text-xs">Anterior</Button>
                  <Button variant="outline" size="sm" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="h-7 text-xs">Siguiente</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Modal */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto border-border/50 shadow-2xl">
            <button onClick={()=>setShowModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5"/>
            </button>
            <h2 className="text-lg font-bold mb-5">{editingId?'Editar Cita':'Nueva Cita'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre del cliente *</label>
                  <Input value={form.cliente_nombre} onChange={e=>setForm({...form,cliente_nombre:e.target.value})} required placeholder="Juan Pérez"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Teléfono</label>
                  <Input value={form.cliente_telefono} onChange={e=>setForm({...form,cliente_telefono:e.target.value})} placeholder="8888-0000"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Servicio *</label>
                <select value={form.servicio_id} onChange={e=>setForm({...form,servicio_id:e.target.value,hora:''})} required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Seleccionar servicio...</option>
                  {servicios.filter(s=>s.activo).map(s=>(
                    <option key={s.id} value={s.id}>{s.nombre} — {fmtUSD(s.precio)} ({s.duracion}min)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Empleado *</label>
                <select value={form.empleado_id} onChange={e=>setForm({...form,empleado_id:e.target.value,hora:''})} required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Seleccionar empleado...</option>
                  {empleados.filter(e=>e.activo).map(e=>(
                    <option key={e.id} value={e.id}>{e.nombre}{e.especialidad?` (${e.especialidad})`:''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Fecha *</label>
                <Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value,hora:''})} required
                  min={new Date().toISOString().split('T')[0]}/>
              </div>
              {form.fecha&&form.empleado_id&&form.servicio_id&&(
                <div className="bg-secondary/30 border border-border/50 rounded-xl p-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-3">Selecciona la Hora *</label>
                  <TimeSelector empleadoId={form.empleado_id} fecha={form.fecha} servicioId={form.servicio_id}
                    selectedTime={form.hora} onTimeSelect={h=>setForm({...form,hora:h})}/>
                </div>
              )}
              {selectedServicio&&(
                <div className="flex items-center gap-4 bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm">
                  <p><span className="text-muted-foreground">Duración:</span> <strong>{selectedServicio.duracion} min</strong></p>
                  <p><span className="text-muted-foreground">Precio:</span> <strong className="text-primary">{fmtUSD(selectedServicio.precio)}</strong></p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Método de pago</label>
                  <select value={form.metodo_pago} onChange={e=>setForm({...form,metodo_pago:e.target.value})}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Sin definir</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Transferencia">Transferencia</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Notas</label>
                  <Input value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} placeholder="Observaciones..."/>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={()=>setShowModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="glow-gold">
                  {saving?'Guardando...':(editingId?'Actualizar':'Crear Cita')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
