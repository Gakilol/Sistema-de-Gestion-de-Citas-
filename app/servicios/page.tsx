'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, X, Scissors, Clock, DollarSign, Tag } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const emptyForm = { nombre:'',descripcion:'',duracion:'',precio:'',categoria:'' };
const CATEGORIAS = ['Cortes','Tintes','Barba','Tratamientos','Peinados','Otros'];
const CAT_COLORS: Record<string,string> = {
  Cortes:'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Tintes:'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  Barba:'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Tratamientos:'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Peinados:'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  Otros:'bg-secondary text-muted-foreground',
};

function fmtUSD(n:number){ return new Intl.NumberFormat('es-NI',{style:'currency',currency:'USD'}).format(n); }

export default function Servicios() {
  const [servicios, setServicios]   = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState<string|null>(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [tabCat, setTabCat]         = useState('Todos');

  const fetchServicios = async () => {
    try {
      const res=await fetch('/api/servicios'); const data=await res.json();
      if (res.ok) setServicios(data.servicios||[]);
    } catch { toast.error('Error al cargar servicios'); }
    finally  { setIsLoading(false); }
  };

  useEffect(()=>{ fetchServicios(); },[]);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); };
  const openEdit   = (s:any) => {
    setForm({ nombre:s.nombre, descripcion:s.descripcion||'', duracion:String(s.duracion), precio:String(s.precio), categoria:s.categoria||'' });
    setEditingId(s.id); setShowModal(true);
  };

  const toggleActivo = async (serv:any) => {
    setServicios(ss=>ss.map(s=>s.id===serv.id?{...s,activo:!serv.activo}:s));
    try {
      const res=await fetch(`/api/servicios/${serv.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({activo:!serv.activo})});
      if (!res.ok) throw new Error();
      toast.success(serv.activo?'Servicio desactivado':'Servicio activado');
    } catch { fetchServicios(); }
  };

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = { nombre:form.nombre, descripcion:form.descripcion, duracion:Number(form.duracion), precio:Number(form.precio), categoria:form.categoria };
    try {
      const url=editingId?`/api/servicios/${editingId}`:'/api/servicios';
      const meth=editingId?'PATCH':'POST';
      const res=await fetch(url,{method:meth,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if (!res.ok){ const d=await res.json(); throw new Error(d.error); }
      toast.success(editingId?'Servicio actualizado':'Servicio creado');
      setShowModal(false); fetchServicios();
    } catch(err:any){ toast.error(err.message||'Error'); }
    finally{ setSaving(false); }
  };

  const cats = ['Todos', ...Array.from(new Set(servicios.map(s=>s.categoria||'Otros').filter(Boolean)))];
  const filtered = tabCat==='Todos' ? servicios : servicios.filter(s=>(s.categoria||'Otros')===tabCat);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar/>
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Catálogo de Servicios</h1>
              <p className="text-sm text-muted-foreground">{servicios.filter(s=>s.activo).length} activos de {servicios.length}</p>
            </div>
            <Button onClick={openCreate} className="gap-1.5 glow-gold">
              <Plus className="w-4 h-4"/> Nuevo Servicio
            </Button>
          </div>

          {/* Tabs por categoría */}
          <div className="flex gap-1.5 flex-wrap">
            {cats.map(c=>(
              <button key={c} onClick={()=>setTabCat(c)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                  tabCat===c?'bg-primary text-primary-foreground border-primary':'bg-card text-muted-foreground border-border hover:text-foreground')}>
                {c}
              </button>
            ))}
          </div>

          {/* Grid de tarjetas */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({length:6}).map((_,i)=>(
                <div key={i} className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
                  <div className="skeleton h-5 w-3/4"/><div className="skeleton h-4 w-1/2"/><div className="skeleton h-8 w-full rounded-lg"/>
                </div>
              ))}
            </div>
          ) : filtered.length===0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <Scissors className="w-10 h-10 mx-auto mb-3 opacity-20"/>
              <p>No hay servicios en esta categoría</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(serv=>(
                <div key={serv.id} className={cn('rounded-xl border border-border/50 bg-card p-5 hover-lift transition-all',!serv.activo&&'opacity-60')}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{serv.nombre}</h3>
                      {serv.descripcion&&<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{serv.descripcion}</p>}
                    </div>
                    <button onClick={()=>toggleActivo(serv)}
                      className={cn('text-[10px] font-bold px-2 py-1 rounded-full ml-2 flex-shrink-0',
                        serv.activo?'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400':'bg-red-500/10 text-red-500')}>
                      {serv.activo?'Activo':'Inactivo'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3"/><span className="text-xs">{serv.duracion} min</span>
                      </div>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-primary">{fmtUSD(serv.precio)}</p>
                    </div>
                  </div>
                  {serv.categoria&&(
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mb-3', CAT_COLORS[serv.categoria]||CAT_COLORS.Otros)}>
                      {serv.categoria}
                    </span>
                  )}
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={()=>openEdit(serv)}>
                    <Edit className="w-3 h-3"/> Editar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showModal&&(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 relative border-border/50 shadow-2xl">
            <button onClick={()=>setShowModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
            <h2 className="text-lg font-bold mb-5">{editingId?'Editar Servicio':'Nuevo Servicio'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre *</label>
                <Input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} required placeholder="Ej: Corte Clásico"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Descripción</label>
                <Input value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} placeholder="Descripción breve..."/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Duración (min) *</label>
                  <Input type="number" min="5" value={form.duracion} onChange={e=>setForm({...form,duracion:e.target.value})} required placeholder="30"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Precio ($) *</label>
                  <Input type="number" min="0" step="0.01" value={form.precio} onChange={e=>setForm({...form,precio:e.target.value})} required placeholder="15.00"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Categoría</label>
                  <select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Sin categoría</option>
                    {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={()=>setShowModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="glow-gold">
                  {saving?'Guardando...':(editingId?'Actualizar':'Crear Servicio')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
