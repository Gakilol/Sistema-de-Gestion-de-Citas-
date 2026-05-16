'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Plus, Trash2, Save, CheckCircle2, Calendar, ShieldX } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DIAS = [
  { key: 'lunes',     label: 'Lun', labelFull: 'Lunes' },
  { key: 'martes',    label: 'Mar', labelFull: 'Martes' },
  { key: 'miercoles', label: 'Mié', labelFull: 'Miércoles' },
  { key: 'jueves',    label: 'Jue', labelFull: 'Jueves' },
  { key: 'viernes',   label: 'Vie', labelFull: 'Viernes' },
  { key: 'sabado',    label: 'Sáb', labelFull: 'Sábado' },
  { key: 'domingo',   label: 'Dom', labelFull: 'Domingo' },
];

interface Turno { inicio: string; fin: string }
type HorarioSemana = Record<string, Turno[]>;

interface Descanso { id?: string; dia_semana: number; hora_inicio: string; hora_fin: string }
interface Bloqueo  { id?: string; fecha: string; hora_inicio: string; hora_fin: string; motivo: string }
interface Vacacion { id?: string; fecha_inicio: string; fecha_fin: string; estado: string }

const defaultHorario: HorarioSemana = {
  lunes: [{ inicio: '08:00', fin: '17:00' }],
  martes: [{ inicio: '08:00', fin: '17:00' }],
  miercoles: [{ inicio: '08:00', fin: '17:00' }],
  jueves: [{ inicio: '08:00', fin: '17:00' }],
  viernes: [{ inicio: '08:00', fin: '17:00' }],
  sabado: [],
  domingo: [],
};

export default function HorariosEmpleado() {
  const params  = useParams();
  const router  = useRouter();
  const id      = params.id as string;

  const [empleado, setEmpleado]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [tab, setTab]               = useState<'horario'|'descansos'|'bloqueos'|'vacaciones'>('horario');

  const [horario, setHorario]       = useState<HorarioSemana>(defaultHorario);
  const [descansos, setDescansos]   = useState<Descanso[]>([]);
  const [bloqueos, setBloqueos]     = useState<Bloqueo[]>([]);
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch(`/api/empleados/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error();
        setEmpleado(data.empleado);
        if (data.empleado.horario) setHorario(data.empleado.horario);

        const [dR, bR, vR] = await Promise.all([
          fetch(`/api/empleados/${id}/descansos`),
          fetch(`/api/empleados/${id}/bloqueos`),
          fetch(`/api/empleados/${id}/vacaciones`),
        ]);
        if (dR.ok) { const d = await dR.json(); setDescansos(d.descansos ?? []); }
        if (bR.ok) { const d = await bR.json(); setBloqueos(d.bloqueos ?? []); }
        if (vR.ok) { const d = await vR.json(); setVacaciones(d.vacaciones ?? []); }
      } catch {
        toast.error('Error al cargar datos del empleado');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // ── Horario: agregar/quitar turnos ─────────────────────────────────
  const addTurno = (dia: string) =>
    setHorario(h => ({ ...h, [dia]: [...(h[dia] ?? []), { inicio: '08:00', fin: '17:00' }] }));

  const removeTurno = (dia: string, idx: number) =>
    setHorario(h => ({ ...h, [dia]: h[dia].filter((_:any, i:number) => i !== idx) }));

  const updateTurno = (dia: string, idx: number, field: 'inicio'|'fin', val: string) =>
    setHorario(h => ({
      ...h,
      [dia]: h[dia].map((t:Turno, i:number) => i === idx ? { ...t, [field]: val } : t),
    }));

  // ── Guardar horario ─────────────────────────────────────────────────
  const saveHorario = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/empleados/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      toast.success('Horario guardado');
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error('Error al guardar horario');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center pt-14 lg:pt-0">
          <div className="text-center space-y-3">
            <div className="skeleton h-8 w-48 mx-auto"/>
            <div className="skeleton h-4 w-32 mx-auto"/>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/empleados')} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4"/>
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">Horarios — {empleado?.nombre}</h1>
              <p className="text-sm text-muted-foreground">{empleado?.especialidad || 'General'}</p>
            </div>
            {tab === 'horario' && (
              <Button onClick={saveHorario} disabled={saving} className={cn('gap-1.5', saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'glow-gold')}>
                {saved ? <CheckCircle2 className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
                {saved ? 'Guardado' : 'Guardar'}
              </Button>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit flex-wrap">
            {[
              { id: 'horario',    label: 'Horario semanal', icon: Clock },
              { id: 'descansos',  label: 'Descansos',       icon: Clock },
              { id: 'bloqueos',   label: 'Bloqueos',        icon: ShieldX },
              { id: 'vacaciones', label: 'Vacaciones',      icon: Calendar },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  tab === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <t.icon className="w-3 h-3"/>{t.label}
              </button>
            ))}
          </div>

          {/* ── Horario semanal ─────────────────────────────── */}
          {tab === 'horario' && (
            <Card className="p-5 border-border/50 space-y-3">
              <p className="text-xs text-muted-foreground">
                Configura los turnos de trabajo por día. Puedes agregar múltiples turnos (ej: mañana y tarde).
                Deja vacío el día para marcarlo como <strong>día libre</strong>.
              </p>
              {DIAS.map(({ key, labelFull }) => {
                const turnos: Turno[] = horario[key] ?? [];
                const trabajaHoy = turnos.length > 0;
                return (
                  <div key={key} className={cn('border border-border/50 rounded-xl p-4 transition-all',
                    trabajaHoy ? 'bg-card' : 'bg-secondary/20')}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-semibold text-sm', trabajaHoy ? 'text-foreground' : 'text-muted-foreground')}>
                          {labelFull}
                        </span>
                        {!trabajaHoy && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">Libre</span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => addTurno(key)} className="h-7 text-xs gap-1 text-primary">
                        <Plus className="w-3 h-3"/> Turno
                      </Button>
                    </div>
                    {turnos.length > 0 && (
                      <div className="space-y-2">
                        {turnos.map((t, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input type="time" value={t.inicio} onChange={e => updateTurno(key, i, 'inicio', e.target.value)}
                              className="h-8 text-sm w-28"/>
                            <span className="text-muted-foreground text-xs">—</span>
                            <Input type="time" value={t.fin} onChange={e => updateTurno(key, i, 'fin', e.target.value)}
                              className="h-8 text-sm w-28"/>
                            <button onClick={() => removeTurno(key, i)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                              <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          {/* ── Descansos ───────────────────────────────────── */}
          {tab === 'descansos' && (
            <Card className="p-5 border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Breaks recurrentes por día (ej: almuerzo todos los lunes de 13:00–14:00)</p>
                <Button size="sm" onClick={() => setDescansos(d => [...d, { dia_semana: 1, hora_inicio: '13:00', hora_fin: '14:00' }])}
                  className="gap-1 h-8 text-xs">
                  <Plus className="w-3 h-3"/> Agregar
                </Button>
              </div>
              {descansos.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No hay descansos configurados</p>
              ) : descansos.map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-secondary/20">
                  <select value={d.dia_semana}
                    onChange={e => setDescansos(ds => ds.map((x,j)=>j===i?{...x,dia_semana:Number(e.target.value)}:x))}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm">
                    {DIAS.map((dia,idx) => <option key={dia.key} value={idx+1}>{dia.labelFull}</option>)}
                  </select>
                  <Input type="time" value={d.hora_inicio}
                    onChange={e=>setDescansos(ds=>ds.map((x,j)=>j===i?{...x,hora_inicio:e.target.value}:x))}
                    className="h-8 text-sm w-28"/>
                  <span className="text-xs text-muted-foreground">—</span>
                  <Input type="time" value={d.hora_fin}
                    onChange={e=>setDescansos(ds=>ds.map((x,j)=>j===i?{...x,hora_fin:e.target.value}:x))}
                    className="h-8 text-sm w-28"/>
                  <button onClick={()=>setDescansos(ds=>ds.filter((_,j)=>j!==i))}
                    className="text-muted-foreground hover:text-destructive ml-auto"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              ))}
            </Card>
          )}

          {/* ── Bloqueos ────────────────────────────────────── */}
          {tab === 'bloqueos' && (
            <Card className="p-5 border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Bloqueos en fechas específicas (reuniones, eventos, etc.)</p>
                <Button size="sm" onClick={() => setBloqueos(b=>[...b,{fecha:new Date().toISOString().split('T')[0],hora_inicio:'09:00',hora_fin:'10:00',motivo:''}])}
                  className="gap-1 h-8 text-xs"><Plus className="w-3 h-3"/>Agregar</Button>
              </div>
              {bloqueos.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No hay bloqueos configurados</p>
              ) : bloqueos.map((b, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-border/50 bg-secondary/20">
                  <div className="col-span-2 flex items-center gap-2">
                    <Input type="date" value={b.fecha} onChange={e=>setBloqueos(bs=>bs.map((x,j)=>j===i?{...x,fecha:e.target.value}:x))} className="h-8 text-sm"/>
                    <Input type="time" value={b.hora_inicio} onChange={e=>setBloqueos(bs=>bs.map((x,j)=>j===i?{...x,hora_inicio:e.target.value}:x))} className="h-8 text-sm w-28"/>
                    <span className="text-xs text-muted-foreground">—</span>
                    <Input type="time" value={b.hora_fin} onChange={e=>setBloqueos(bs=>bs.map((x,j)=>j===i?{...x,hora_fin:e.target.value}:x))} className="h-8 text-sm w-28"/>
                    <button onClick={()=>setBloqueos(bs=>bs.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                  <div className="col-span-2">
                    <Input value={b.motivo} onChange={e=>setBloqueos(bs=>bs.map((x,j)=>j===i?{...x,motivo:e.target.value}:x))} placeholder="Motivo del bloqueo..." className="h-8 text-sm"/>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* ── Vacaciones ──────────────────────────────────── */}
          {tab === 'vacaciones' && (
            <Card className="p-5 border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Períodos de vacaciones o ausencia</p>
                <Button size="sm" onClick={()=>setVacaciones(v=>[...v,{fecha_inicio:new Date().toISOString().split('T')[0],fecha_fin:new Date().toISOString().split('T')[0],estado:'APROBADO'}])}
                  className="gap-1 h-8 text-xs"><Plus className="w-3 h-3"/>Agregar</Button>
              </div>
              {vacaciones.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No hay vacaciones registradas</p>
              ) : vacaciones.map((v, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-secondary/20">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Desde</label>
                      <Input type="date" value={v.fecha_inicio} onChange={e=>setVacaciones(vs=>vs.map((x,j)=>j===i?{...x,fecha_inicio:e.target.value}:x))} className="h-8 text-sm"/>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Hasta</label>
                      <Input type="date" value={v.fecha_fin} onChange={e=>setVacaciones(vs=>vs.map((x,j)=>j===i?{...x,fecha_fin:e.target.value}:x))} className="h-8 text-sm"/>
                    </div>
                  </div>
                  <select value={v.estado} onChange={e=>setVacaciones(vs=>vs.map((x,j)=>j===i?{...x,estado:e.target.value}:x))}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                    <option value="APROBADO">Aprobado</option>
                    <option value="PENDIENTE">Pendiente</option>
                  </select>
                  <button onClick={()=>setVacaciones(vs=>vs.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              ))}
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
