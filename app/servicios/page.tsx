'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, X, Scissors, Clock, Trash2 } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const emptyForm = { nombre: '', descripcion: '', duracion: '', categoria_id: '' };

export default function Servicios() {
  const { user } = useAuth();
  const [servicios, setServicios]   = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<any>(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [tabCat, setTabCat]         = useState('Todos');
  const [categorias, setCategorias] = useState<any[]>([]);

  const handleEliminarServicio = async (serv: any) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el servicio "${serv.nombre}"? Esto también eliminará todas las citas asociadas a él.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/servicios/${serv.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error al eliminar el servicio');
      }
      toast.success('Servicio eliminado exitosamente');
      fetchServicios();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar el servicio');
    }
  };

  const fetchServicios = async () => {
    try {
      const res = await fetch('/api/servicios');
      const data = await res.json();
      if (res.ok) setServicios(data.servicios || []);
    } catch {
      toast.error('Error al cargar servicios');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategorias = async () => {
    try {
      const res = await fetch('/api/categorias');
      const data = await res.json();
      if (res.ok) setCategorias(data.categorias || []);
    } catch {
      toast.error('Error al cargar categorías');
    }
  };

  useEffect(() => {
    fetchServicios();
    fetchCategorias();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (s: any) => {
    setForm({
      nombre: s.nombre,
      descripcion: s.descripcion || '',
      duracion: String(s.duracion),
      categoria_id: s.categoria_id || '',
    });
    setEditingId(s.id);
    setShowModal(true);
  };

  const toggleActivo = async (serv: any) => {
    setServicios(ss => ss.map(s => s.id === serv.id ? { ...s, activo: !serv.activo } : s));
    try {
      const res = await fetch(`/api/servicios/${serv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !serv.activo }),
      });
      if (!res.ok) throw new Error();
      toast.success(serv.activo ? 'Servicio desactivado' : 'Servicio activado');
    } catch {
      fetchServicios();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nombre: form.nombre,
      descripcion: form.descripcion,
      duracion: Number(form.duracion),
      categoria_id: form.categoria_id || null,
    };
    try {
      const url = editingId ? `/api/servicios/${editingId}` : '/api/servicios';
      const meth = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method: meth,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success(editingId ? 'Servicio actualizado' : 'Servicio creado');
      setShowModal(false);
      fetchServicios();
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const cats = ['Todos', ...categorias.map(c => c.nombre)];
  const filtered = tabCat === 'Todos' 
    ? servicios 
    : servicios.filter(s => s.categoriaRel?.nombre === tabCat);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Catálogo de Servicios</h1>
              <p className="text-sm text-muted-foreground">{servicios.filter(s => s.activo).length} activos de {servicios.length}</p>
            </div>
            <Button onClick={openCreate} className="gap-1.5 glow-gold">
              <Plus className="w-4 h-4" /> Nuevo Servicio
            </Button>
          </div>

          {/* Tabs por categoría */}
          <div className="flex gap-1.5 flex-wrap">
            {cats.map(c => (
              <button
                key={c}
                onClick={() => setTabCat(c)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                  tabCat === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Grid de tarjetas */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
                  <div className="skeleton h-5 w-3/4" />
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <Scissors className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No hay servicios en esta categoría</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(serv => (
                <div key={serv.id} className={cn('rounded-xl border border-border/50 bg-card p-5 hover-lift transition-all flex flex-col justify-between', !serv.activo && 'opacity-60')}>
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{serv.nombre}</h3>
                        {serv.descripcion && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{serv.descripcion}</p>}
                      </div>
                      <button
                        onClick={() => toggleActivo(serv)}
                        className={cn(
                          'text-[10px] font-bold px-2 py-1 rounded-full ml-2 flex-shrink-0',
                          serv.activo ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'
                        )}
                      >
                        {serv.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>

                    <div className="bg-secondary/50 rounded-lg p-2.5 text-center mb-3">
                      <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">{serv.duracion} min</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {serv.categoriaRel && (
                      <span 
                        style={{
                          backgroundColor: serv.categoriaRel.color ? `${serv.categoriaRel.color}15` : '#6366f115',
                          color: serv.categoriaRel.color || '#6366f1',
                          borderColor: serv.categoriaRel.color ? `${serv.categoriaRel.color}30` : '#6366f130'
                        }}
                        className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border inline-block mb-3"
                      >
                        {serv.categoriaRel.nombre}
                      </span>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => openEdit(serv)}>
                        <Edit className="w-3 h-3" /> Editar
                      </Button>
                      {user?.rol === 'ADMIN' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 w-8 px-0 flex items-center justify-center bg-red-950/20 hover:bg-red-900/35 border border-red-500/30 text-red-500 hover:text-red-400"
                          onClick={() => handleEliminarServicio(serv)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 relative border-border/50 shadow-2xl">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold mb-5">{editingId ? 'Editar Servicio' : 'Nuevo Servicio'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre *</label>
                <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required placeholder="Ej: Corte Clásico" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Descripción</label>
                <Input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción breve..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Duración (min) *</label>
                  <Input type="number" min="5" value={form.duracion} onChange={e => setForm({ ...form, duracion: e.target.value })} required placeholder="30" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Categoría</label>
                  <select
                    value={form.categoria_id}
                    onChange={e => setForm({ ...form, categoria_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="glow-gold">
                  {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear Servicio')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
