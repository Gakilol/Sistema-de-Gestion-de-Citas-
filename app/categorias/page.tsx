'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, X, Tag, Trash2, Layers, Search, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const emptyForm = { nombre: '', color: '#6366f1', orden: '0', activo: true };

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#64748b', // Slate
];

export default function Categorias() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [categorias, setCategorias] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  
  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // todos, activos, inactivos

  const fetchCategorias = async () => {
    try {
      const res = await fetch('/api/categorias');
      const data = await res.json();
      if (res.ok) {
        setCategorias(data.categorias || []);
      } else {
        toast.error(data.error || 'Error al cargar categorías');
      }
    } catch {
      toast.error('Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.rol !== 'ADMIN') {
      // Si no es ADMIN, no cargamos y mostramos acceso denegado
      setIsLoading(false);
      return;
    }
    fetchCategorias();
  }, [user]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (cat: any) => {
    setForm({
      nombre: cat.nombre,
      color: cat.color || '#6366f1',
      orden: String(cat.orden),
      activo: cat.activo,
    });
    setEditingId(cat.id);
    setShowModal(true);
  };

  const toggleActivo = async (cat: any) => {
    // Optimistic UI update
    setCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, activo: !cat.activo } : c));
    try {
      const res = await fetch(`/api/categorias/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !cat.activo }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error al cambiar estado');
      }
      toast.success(cat.activo ? 'Categoría desactivada' : 'Categoría activada');
      fetchCategorias();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar categoría');
      fetchCategorias(); // rollback
    }
  };

  const handleEliminarCategoria = async (cat: any) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente la categoría "${cat.nombre}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/categorias/${cat.id}`, {
        method: 'DELETE',
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || 'Error al eliminar la categoría');
      }
      toast.success('Categoría eliminada exitosamente');
      fetchCategorias();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar la categoría');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }
    setSaving(true);
    const payload = {
      nombre: form.nombre.trim(),
      color: form.color,
      orden: Number(form.orden) || 0,
      activo: form.activo,
    };
    try {
      const url = editingId ? `/api/categorias/${editingId}` : '/api/categorias';
      const meth = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method: meth,
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN'
        },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || 'Error al guardar la categoría');
      }
      toast.success(editingId ? 'Categoría actualizada exitosamente' : 'Categoría creada exitosamente');
      setShowModal(false);
      fetchCategorias();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Filtrado de categorías
  const filteredCategorias = categorias.filter(cat => {
    const cumpleBusqueda = cat.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const cumpleEstado = 
      filtroEstado === 'todos' ? true :
      filtroEstado === 'activos' ? cat.activo === true :
      cat.activo === false;
    
    return cumpleBusqueda && cumpleEstado;
  });

  // Si no está logueado o está cargando el auth
  if (!user && isLoading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  // Protección de Rol ADMIN
  if (user && user.rol !== 'ADMIN') {
    return (
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center p-4 pt-20 lg:pt-0">
          <Card className="max-w-md w-full p-6 text-center border-border/50 shadow-xl space-y-4 backdrop-blur-md bg-card/65">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Acceso Denegado</h2>
            <p className="text-sm text-muted-foreground">
              Esta sección es exclusiva para administradores. Si eres parte del personal, puedes gestionar las citas en el panel correspondiente.
            </p>
            <Button onClick={() => router.push('/dashboard')} className="w-full glow-gold">
              Volver al Dashboard
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Categorías de Servicios</h1>
              <p className="text-sm text-muted-foreground">
                {categorias.filter(c => c.activo).length} activas de {categorias.length} en total
              </p>
            </div>
            <Button onClick={openCreate} className="gap-1.5 glow-gold">
              <Plus className="w-4 h-4" /> Nueva Categoría
            </Button>
          </div>

          {/* Buscador y Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-10 bg-card border-border/50 focus:border-primary/50"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[150px] outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="todos">Todos los estados</option>
              <option value="activos">Sólo Activos</option>
              <option value="inactivos">Sólo Inactivos</option>
            </select>
          </div>

          {/* Grid o Lista */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="skeleton w-8 h-8 rounded-lg" />
                    <div className="skeleton h-5 w-1/2" />
                  </div>
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredCategorias.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/20">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-20 animate-bounce" />
              <p className="font-medium text-sm">No se encontraron categorías</p>
              <p className="text-xs text-muted-foreground mt-1">Intenta ajustando el filtro de búsqueda o crea una nueva.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategorias.map(cat => {
                const glassStyle = {
                  backgroundColor: cat.color ? `${cat.color}12` : '#6366f112',
                  borderColor: cat.color ? `${cat.color}25` : '#6366f125',
                };
                const badgeStyle = {
                  backgroundColor: cat.color ? `${cat.color}20` : '#6366f120',
                  color: cat.color || '#6366f1',
                  borderColor: cat.color ? `${cat.color}40` : '#6366f140',
                };
                return (
                  <div 
                    key={cat.id} 
                    style={glassStyle}
                    className={cn(
                      'rounded-xl border p-5 transition-all duration-300 hover-lift flex flex-col justify-between backdrop-blur-[2px]',
                      !cat.activo && 'opacity-65 border-border bg-card'
                    )}
                  >
                    <div>
                      {/* Name & Active Badge */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <span 
                            style={{ backgroundColor: cat.color || '#6366f1' }}
                            className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-white/20"
                          />
                          <h3 className="font-semibold text-foreground text-base tracking-tight truncate max-w-[150px]">
                            {cat.nombre}
                          </h3>
                        </div>
                        <button
                          onClick={() => toggleActivo(cat)}
                          className={cn(
                            'text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0 border uppercase tracking-wider transition-all hover:brightness-110',
                            cat.activo 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                              : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                          )}
                        >
                          {cat.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 mb-5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground bg-background/45 rounded-lg px-2.5 py-1.5 border border-border/20">
                          <span className="flex items-center gap-1.5 font-medium">
                            <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" /> Prioridad / Orden:
                          </span>
                          <span className="font-bold text-foreground font-mono">{cat.orden}</span>
                        </div>
                        <div 
                          style={badgeStyle}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 uppercase tracking-wider"
                        >
                          <Tag className="w-3 h-3" /> Color: {cat.color || '#6366f1'}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-border/10">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 h-8 text-xs gap-1.5 bg-background/55 hover:bg-background/85 border-border/45" 
                        onClick={() => openEdit(cat)}
                      >
                        <Edit className="w-3 h-3" /> Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 w-8 px-0 flex items-center justify-center bg-red-950/20 hover:bg-red-900/35 border border-red-500/30 text-red-500 hover:text-red-400"
                        onClick={() => handleEliminarCategoria(cat)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal Crear / Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 relative border-border/50 shadow-2xl bg-card animate-in zoom-in-95 duration-250">
            <button 
              onClick={() => setShowModal(false)} 
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre *</label>
                <Input 
                  value={form.nombre} 
                  onChange={e => setForm({ ...form, nombre: e.target.value })} 
                  required 
                  maxLength={50}
                  placeholder="Ej: Barbería, Tintes, Manicura..." 
                  className="bg-background/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Orden de Visualización</label>
                  <Input 
                    type="number" 
                    min="0"
                    value={form.orden} 
                    onChange={e => setForm({ ...form, orden: e.target.value })} 
                    required 
                    placeholder="0" 
                    className="bg-background/60 font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">El valor menor se muestra primero.</p>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Estado</label>
                  <div className="flex items-center gap-2 h-10">
                    <input 
                      type="checkbox"
                      id="cat-activo"
                      checked={form.activo}
                      onChange={e => setForm({ ...form, activo: e.target.checked })}
                      className="w-4.5 h-4.5 text-primary border-border bg-background rounded focus:ring-primary focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="cat-activo" className="text-sm font-medium text-foreground cursor-pointer select-none">
                      Activa
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Color Identificador *</label>
                <div className="flex gap-2.5 items-center bg-background/45 border border-border p-2.5 rounded-lg mb-2">
                  <input 
                    type="color" 
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-10 rounded-md border border-border/80 cursor-pointer overflow-hidden bg-transparent"
                  />
                  <Input 
                    type="text" 
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    required
                    pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                    placeholder="#6366f1"
                    className="h-10 font-mono text-sm uppercase bg-background/60"
                  />
                </div>
                
                {/* Paleta rápida de preselección */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Colores recomendados:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, color: c })}
                        style={{ backgroundColor: c }}
                        className={cn(
                          'w-6.5 h-6.5 rounded-full border border-white/20 shadow-sm transition-all hover:scale-110 active:scale-95 flex items-center justify-center',
                          form.color.toLowerCase() === c.toLowerCase() && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                        )}
                        title={c}
                      >
                        {form.color.toLowerCase() === c.toLowerCase() && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border/30">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="glow-gold">
                  {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear Categoría')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
