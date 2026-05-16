'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, X, UserRound, Toggle } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const emptyForm = { nombre:'',correo:'',telefono:'',password:'',especialidad:'',rol:'EMPLEADO' };

function Avatar({ nombre }: { nombre: string }) {
  const initials = nombre.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()||'?';
  const colors = ['bg-amber-500','bg-emerald-500','bg-blue-500','bg-purple-500','bg-rose-500'];
  const c = colors[nombre.charCodeAt(0)%colors.length];
  return (
    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0',c)}>
      {initials}
    </div>
  );
}

export default function Empleados() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);

  const fetchEmpleados = async () => {
    try {
      const res  = await fetch('/api/empleados');
      const data = await res.json();
      if (res.ok) setEmpleados(data.empleados||[]);
    } catch { toast.error('Error al cargar empleados'); }
    finally  { setIsLoading(false); }
  };

  useEffect(()=>{ fetchEmpleados(); },[]);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); };
  const openEdit   = (e:any) => {
    setForm({ nombre:e.nombre, correo:e.correo, telefono:e.telefono||'', password:'', especialidad:e.especialidad||'', rol:e.rol });
    setEditingId(e.id); setShowModal(true);
  };

  const toggleActivo = async (emp:any) => {
    const prev = emp.activo;
    setEmpleados(es=>es.map(e=>e.id===emp.id?{...e,activo:!prev}:e));
    try {
      const res = await fetch(`/api/empleados/${emp.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({activo:!prev})});
      if (!res.ok) throw new Error();
      toast.success(prev?'Empleado desactivado':'Empleado activado');
    } catch { fetchEmpleados(); toast.error('Error al cambiar estado'); }
  };

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const body:any = {...form};
      if (editingId && !body.password) delete body.password;
      if (!editingId && !form.password) { toast.error('La contraseña es obligatoria'); setSaving(false); return; }

      const url  = editingId ? `/api/empleados/${editingId}` : '/api/empleados';
      const meth = editingId ? 'PATCH' : 'POST';
      const res  = await fetch(url,{method:meth,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if (!res.ok) { const d=await res.json(); throw new Error(d.error); }
      toast.success(editingId?'Empleado actualizado':'Empleado creado exitosamente');
      setShowModal(false); fetchEmpleados();
    } catch(err:any) { toast.error(err.message||'Error al guardar'); }
    finally { setSaving(false); }
  };

  const activos = empleados.filter(e=>e.activo).length;

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar/>
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestión de Personal</h1>
              <p className="text-sm text-muted-foreground">{activos} activo{activos!==1?'s':''} de {empleados.length}</p>
            </div>
            <Button onClick={openCreate} className="gap-1.5 glow-gold">
              <Plus className="w-4 h-4"/> Nuevo Empleado
            </Button>
          </div>

          <Card className="border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/70 border-b border-border/50">
                  <tr>
                    {['Empleado','Correo','Especialidad','Rol','Estado','Acciones'].map(h=>(
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({length:3}).map((_,i)=>(
                      <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="skeleton h-8 w-full rounded-lg"/></td></tr>
                    ))
                  ) : empleados.length===0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      <UserRound className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                      No hay empleados registrados
                    </td></tr>
                  ) : empleados.map(emp=>(
                    <tr key={emp.id} className={cn('border-b border-border/40 hover:bg-secondary/20 transition-colors',!emp.activo&&'opacity-60')}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar nombre={emp.nombre}/>
                          <span className="font-medium text-foreground">{emp.nombre}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{emp.correo}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{emp.especialidad||'General'}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                          emp.rol==='ADMIN'?'bg-amber-500/15 text-amber-600 dark:text-amber-400':'bg-secondary text-muted-foreground')}>
                          {emp.rol==='ADMIN'?'Admin':'Empleado'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={()=>toggleActivo(emp)}
                          className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all',
                            emp.activo?'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                                     :'bg-red-500/10 text-red-500 hover:bg-red-500/20')}>
                          {emp.activo?'Activo':'Inactivo'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(emp)}>
                          <Edit className="w-3.5 h-3.5"/>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>

      {showModal&&(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 relative border-border/50 shadow-2xl">
            <button onClick={()=>setShowModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5"/>
            </button>
            <h2 className="text-lg font-bold mb-5">{editingId?'Editar Empleado':'Nuevo Empleado'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre completo *</label>
                <Input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} required placeholder="Juan Pérez"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Correo electrónico *</label>
                <Input type="email" value={form.correo} onChange={e=>setForm({...form,correo:e.target.value})} required placeholder="juan@hairstyle.com"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Teléfono</label>
                  <Input value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} placeholder="8888-0000"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    Contraseña {editingId?'(vacío = no cambiar)':'*'}
                  </label>
                  <Input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required={!editingId}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Especialidad</label>
                  <Input value={form.especialidad} onChange={e=>setForm({...form,especialidad:e.target.value})} placeholder="Cortes, Tintes..."/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Rol</label>
                  <select value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="EMPLEADO">Empleado</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={()=>setShowModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="glow-gold">
                  {saving?'Guardando...':(editingId?'Actualizar':'Crear Empleado')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
