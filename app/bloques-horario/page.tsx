// app/bloques-horario/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, User, Clock, AlertCircle, ChevronLeft, ChevronRight, RefreshCcw, Search, Sparkles } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { getBusinessTodayString } from '@/lib/timezone';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Helper local para convertir "HH:MM" a formato 12 horas AM/PM
function to12h(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${m} ${ampm}`;
}

export default function BloquesHorario() {
  const { user } = useAuth();
  const [fecha, setFecha] = useState(getBusinessTodayString());
  const [filtroEmpleado, setFiltroEmpleado] = useState('');
  const [empleadosData, setEmpleadosData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar disponibilidad
  const fetchBloques = async (selectedDate: string, empId?: string) => {
    setIsLoading(true);
    try {
      let url = `/api/bloques-horario?fecha=${selectedDate}`;
      if (empId) {
        url += `&empleado_id=${empId}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al obtener la disponibilidad');
      }
      const data = await res.json();
      setEmpleadosData(data.empleados || []);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar bloques de horario');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBloques(fecha, filtroEmpleado);
  }, [fecha, filtroEmpleado]);

  // Cambiar día con botones
  const cambiarDia = (offset: number) => {
    const [year, month, day] = fecha.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + offset);
    setFecha(d.toISOString().split('T')[0]);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 page-enter">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Disponibilidad del Personal</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Visualiza los bloques horarios y jornada laboral diaria</p>
            </div>
            
            {/* Control de Fecha */}
            <div className="flex items-center gap-2 bg-secondary/35 p-1 rounded-xl border border-border/50 self-start">
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => cambiarDia(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="relative">
                <Input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="h-8 text-xs font-semibold bg-transparent border-0 focus-visible:ring-0 w-32 cursor-pointer text-foreground pr-0"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => cambiarDia(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 cursor-pointer hover:bg-primary/10 hover:text-primary transition-all" 
                onClick={() => fetchBloques(fecha, filtroEmpleado)}
                title="Actualizar"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Filtro de Empleado */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={filtroEmpleado}
                onChange={e => setFiltroEmpleado(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos los empleados</option>
                {/* Usar una lista única de empleados de los datos cargados */}
                {Array.from(new Map(empleadosData.map(item => [item.empleado.id, item.empleado])).values()).map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Listado de Empleados y sus Líneas Temporales */}
          <div className="grid grid-cols-1 gap-6">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <Card key={idx} className="p-6 border-border/50 bg-card animate-pulse space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="skeleton h-5 w-40" />
                      <div className="skeleton h-4 w-28" />
                    </div>
                    <div className="skeleton h-5 w-48" />
                  </div>
                  <div className="skeleton h-10 w-full rounded-lg" />
                </Card>
              ))
            ) : empleadosData.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm bg-card border border-border/40 rounded-xl">
                No hay estilistas o personal configurado en el sistema
              </div>
            ) : (
              empleadosData.map((item: any) => {
                const emp = item.empleado;
                const disp = item.disponibilidad;
                const hasError = !!item.error;
                
                // Formatear jornada
                const isWorking = disp?.jornada?.activo;
                const jornadaTexto = isWorking
                  ? `Jornada del estilista: ${to12h(disp.jornada.inicio)} - ${to12h(disp.jornada.fin)}`
                  : disp?.motivo === 'De vacaciones' ? 'De vacaciones 🏖️' : 'Sin jornada configurada (Día libre)';

                // Intervalos ocupados para listar detalles
                const ocupados = disp?.intervalosOcupados || [];

                return (
                  <Card key={emp.id} className="p-6 border-border/40 bg-card/65 hover:bg-card hover:border-border/60 transition-all duration-300 shadow-sm space-y-5">
                    
                    {/* Encabezado Estilista */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/30">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground text-lg">{emp.nombre}</h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {emp.rol === 'ADMIN' ? 'Administrador' : 'Estilista'}
                          </span>
                        </div>
                        {emp.especialidad && (
                          <p className="text-xs text-muted-foreground mt-0.5">{emp.especialidad}</p>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-right">
                        <span className={cn(
                          "px-3 py-1 rounded-full",
                          isWorking ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                        )}>
                          {jornadaTexto}
                        </span>
                      </div>
                    </div>

                    {/* Timeline de bloques */}
                    {hasError ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p>{item.error}</p>
                      </div>
                    ) : !isWorking ? (
                      <div className="flex items-center justify-center p-6 rounded-xl border border-dashed border-border/60 bg-secondary/10">
                        <p className="text-xs text-muted-foreground font-semibold">No se programaron citas para este día.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Bloques visuales */}
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Línea de tiempo del día</p>
                          <div className="flex flex-wrap gap-1 p-2 rounded-xl bg-secondary/15 border border-border/40">
                            {disp.bloques && disp.bloques.map((b: any, idx: number) => {
                              const label = to12h(b.hora);
                              let tooltipText = `${label} - ${b.motivo}`;
                              
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    "h-8 flex-1 min-w-[32px] rounded-md flex items-center justify-center text-[9px] font-bold transition-all relative group cursor-help select-none",
                                    b.disponible
                                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 hover:bg-emerald-500/30"
                                      : b.motivo.toLowerCase().includes('cita')
                                      ? "bg-red-500/15 text-red-600 border border-red-500/25 hover:bg-red-500/30"
                                      : "bg-amber-500/15 text-amber-600 border border-amber-500/25 hover:bg-amber-500/30"
                                  )}
                                  title={tooltipText}
                                >
                                  {b.hora.endsWith(':00') ? (
                                    <span>{parseInt(b.hora.split(':')[0], 10) % 12 || 12}</span>
                                  ) : null}
                                  
                                  {/* Tooltip personalizado */}
                                  <div className="absolute bottom-full mb-1.5 hidden group-hover:block z-50 bg-popover border border-border text-popover-foreground text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                                    <p className="font-bold">{label}</p>
                                    <p className="text-muted-foreground">{b.motivo}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Detalle de Reservas/Bloqueos */}
                        {ocupados.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actividades Programadas</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {ocupados.map((o: any, idx: number) => {
                                const startStr = `${Math.floor(o.inicio / 60)}:${String(o.inicio % 60).padStart(2, '0')}`;
                                const endStr = `${Math.floor(o.fin / 60)}:${String(o.fin % 60).padStart(2, '0')}`;
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className={cn(
                                      "flex items-center gap-3 p-2.5 rounded-lg border text-xs font-medium",
                                      o.motivo.toLowerCase().includes('cita')
                                        ? "bg-red-500/5 border-red-500/15 text-red-600 dark:text-red-400"
                                        : "bg-amber-500/5 border-amber-500/15 text-amber-600 dark:text-amber-400"
                                    )}
                                  >
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    <div className="flex-1">
                                      <p className="font-bold">{o.motivo}</p>
                                      <p className="text-[10px] opacity-80">{to12h(startStr)} - {to12h(endStr)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {ocupados.length === 0 && (
                          <p className="text-xs text-emerald-500 font-semibold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> Todo el día disponible para citas.
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
