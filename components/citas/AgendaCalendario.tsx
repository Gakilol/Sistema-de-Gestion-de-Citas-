// components/citas/AgendaCalendario.tsx
'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatColones } from '@/lib/utils';

interface AgendaCalendarioProps {
  citas: any[];
  empleados: any[];
  filtroEmpleado: string;
  scope: string;
  user: any;
  onEditCita: (cita: any) => void;
  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_SEMANA_ABR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Configuración de la cuadrícula de horas (de 7:00 a 20:00)
const HORA_INICIO = 7; // 7 AM
const HORA_FIN = 20;   // 8 PM
const TOTAL_HORAS = HORA_FIN - HORA_INICIO + 1;
const ALTURA_HORA_PX = 60; // 1 hora = 60px -> 1 minuto = 1px

export function AgendaCalendario({
  citas,
  empleados,
  filtroEmpleado,
  scope,
  user,
  onEditCita,
  selectedDateStr,
  setSelectedDateStr,
}: AgendaCalendarioProps) {
  const [vista, setVista] = useState<'dia' | '3dias' | 'semana'>('3dias');

  // Helper para convertir YYYY-MM-DD local a objeto Date de forma segura en zona horaria local
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Helper para formatear objeto Date a YYYY-MM-DD local
  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const fechaBase = useMemo(() => parseLocalDate(selectedDateStr), [selectedDateStr]);

  // Obtener rango de días según la vista seleccionada
  const diasAMostrar = useMemo(() => {
    const dias: Date[] = [];
    if (vista === 'dia') {
      dias.push(new Date(fechaBase));
    } else if (vista === '3dias') {
      for (let i = 0; i < 3; i++) {
        const d = new Date(fechaBase);
        d.setDate(fechaBase.getDate() + i);
        dias.push(d);
      }
    } else if (vista === 'semana') {
      // Obtener el lunes de la semana de la fecha base
      const d = new Date(fechaBase);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes es 1
      const lunes = new Date(d.setDate(diff));
      for (let i = 0; i < 7; i++) {
        const temp = new Date(lunes);
        temp.setDate(lunes.getDate() + i);
        dias.push(temp);
      }
    }
    return dias;
  }, [fechaBase, vista]);

  // Nombre del mes para mostrar en la cabecera
  const tituloCabecera = useMemo(() => {
    if (diasAMostrar.length === 0) return '';
    const primerDia = diasAMostrar[0];
    const ultimoDia = diasAMostrar[diasAMostrar.length - 1];
    
    if (primerDia.getMonth() === ultimoDia.getMonth()) {
      return `${MESES[primerDia.getMonth()]} ${primerDia.getFullYear()}`;
    }
    
    return `${MESES[primerDia.getMonth()]} - ${MESES[ultimoDia.getMonth()]} ${primerDia.getFullYear()}`;
  }, [diasAMostrar]);

  // Mover fecha base
  const cambiarFecha = (offset: number) => {
    const nuevaFecha = new Date(fechaBase);
    if (vista === 'dia') {
      nuevaFecha.setDate(fechaBase.getDate() + offset);
    } else if (vista === '3dias') {
      nuevaFecha.setDate(fechaBase.getDate() + offset * 3);
    } else if (vista === 'semana') {
      nuevaFecha.setDate(fechaBase.getDate() + offset * 7);
    }
    setSelectedDateStr(formatLocalDate(nuevaFecha));
  };

  const irAHoy = () => {
    setSelectedDateStr(formatLocalDate(new Date()));
  };

  // Convertir "HH:MM" a minutos desde la medianoche
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  // Formatear hora de 24h a 12h
  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'p. m.' : 'a. m.';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m} ${ampm}`;
  };

  // Generar lista de horas para la regla lateral
  const horasRegla = useMemo(() => {
    const lista = [];
    for (let i = HORA_INICIO; i <= HORA_FIN; i++) {
      const hStr = String(i).padStart(2, '0') + ':00';
      lista.push({
        raw: hStr,
        label: formatTime12h(hStr),
      });
    }
    return lista;
  }, []);

  // Filtrar citas para los días a mostrar
  const citasPorDia = useMemo(() => {
    const mapa: Record<string, any[]> = {};
    diasAMostrar.forEach((dia) => {
      const diaStr = formatLocalDate(dia);
      mapa[diaStr] = [];
    });

    citas.forEach((cita) => {
      const fechaCitaStr = new Date(cita.fecha).toISOString().split('T')[0];
      if (mapa[fechaCitaStr]) {
        mapa[fechaCitaStr].push(cita);
      }
    });

    return mapa;
  }, [citas, diasAMostrar]);

  return (
    <div className="flex flex-col h-[700px] border border-border/50 rounded-2xl bg-card overflow-hidden shadow-lg select-none">
      
      {/* CABECERA DEL CALENDARIO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-border/50 bg-secondary/10">
        
        {/* Controles de Navegación */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={irAHoy} className="font-semibold gap-1 text-xs">
            <CalendarIcon className="w-3.5 h-3.5" /> Hoy
          </Button>
          <div className="flex items-center border border-border rounded-lg bg-background">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" onClick={() => cambiarFecha(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold px-3 border-x border-border py-1 text-foreground min-w-[130px] text-center">
              {tituloCabecera}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" onClick={() => cambiarFecha(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Toggles de Vista */}
        <div className="flex bg-secondary/40 p-1 rounded-xl border border-border/40 self-start md:self-auto">
          {[
            { id: 'dia', label: 'Día' },
            { id: '3dias', label: '3 Días' },
            { id: 'semana', label: 'Semana' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setVista(tab.id as any)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-lg transition-all",
                vista === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm font-bold scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CUERPO DEL CALENDARIO CON SCROLL */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Encabezado de Columnas del Calendario */}
        <div className="flex border-b border-border/40 bg-secondary/5">
          {/* Espacio para la columna de horas */}
          <div className="w-16 md:w-20 shrink-0 border-r border-border/40" />
          
          {/* Columnas de los días */}
          <div className="flex-1 grid grid-flow-col auto-cols-fr overflow-x-auto select-none">
            {diasAMostrar.map((dia, idx) => {
              const esHoy = formatLocalDate(dia) === formatLocalDate(new Date());
              return (
                <div
                  key={idx}
                  className={cn(
                    "py-2.5 text-center border-r border-border/30 last:border-r-0 flex flex-col items-center justify-center min-w-[90px]",
                    esHoy && "bg-primary/5 text-primary"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    {DIAS_SEMANA_ABR[dia.getDay()]}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-extrabold w-8 h-8 flex items-center justify-center rounded-full mt-0.5",
                      esHoy && "bg-primary text-primary-foreground shadow-md"
                    )}
                  >
                    {dia.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cuadrícula de Tiempo con Scrollbar */}
        <div className="flex-1 overflow-y-auto relative flex">
          
          {/* Columna lateral de Horas */}
          <div className="w-16 md:w-20 shrink-0 border-r border-border/40 bg-secondary/5 select-none relative z-10">
            {horasRegla.map((hora, idx) => (
              <div
                key={idx}
                className="relative text-right pr-2 text-[10px] font-bold text-muted-foreground"
                style={{ height: `${ALTURA_HORA_PX}px` }}
              >
                {/* Posición vertical centrada de la etiqueta de la hora */}
                <span className="absolute -top-2 right-2.5 bg-card/90 px-1 rounded">
                  {hora.label.replace(':00', '').replace(' p. m.', ' PM').replace(' a. m.', ' AM')}
                </span>
              </div>
            ))}
          </div>

          {/* Cuadrícula de días y citas */}
          <div className="flex-1 grid grid-flow-col auto-cols-fr relative min-h-[780px]">
            
            {/* Líneas horizontales de fondo de cada hora */}
            <div className="absolute inset-0 pointer-events-none select-none">
              {Array.from({ length: TOTAL_HORAS }).map((_, idx) => (
                <div
                  key={idx}
                  className="border-b border-border/30 w-full"
                  style={{ height: `${ALTURA_HORA_PX}px` }}
                />
              ))}
            </div>

            {/* Renderizado de Columnas de Citas por Día */}
            {diasAMostrar.map((dia, dIdx) => {
              const diaStr = formatLocalDate(dia);
              const citasDia = citasPorDia[diaStr] || [];
              const esHoy = diaStr === formatLocalDate(new Date());

              return (
                <div
                  key={dIdx}
                  className={cn(
                    "relative border-r border-border/30 last:border-r-0 h-full min-w-[90px]",
                    esHoy && "bg-primary/[0.01]"
                  )}
                  style={{ height: `${TOTAL_HORAS * ALTURA_HORA_PX}px` }}
                >
                  
                  {/* Citas de este día */}
                  {citasDia.map((cita) => {
                    // Calcular posición vertical de la cita
                    const minInicio = timeToMinutes(cita.hora);
                    const minCero = HORA_INICIO * 60;
                    
                    // Si la cita empieza antes de la hora inicio o después de la hora fin
                    const topPx = Math.max(0, (minInicio - minCero) * (ALTURA_HORA_PX / 60));
                    const heightPx = Math.max(35, cita.duracion * (ALTURA_HORA_PX / 60));

                    // Color de la tarjeta de la cita
                    const catColor = cita.servicio?.categoriaRel?.color || '#3b82f6';
                    
                    return (
                      <div
                        key={cita.id}
                        onClick={() => onEditCita(cita)}
                        className="absolute left-1 right-1 p-1.5 rounded-lg border text-left cursor-pointer hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group active:scale-[0.98]"
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          backgroundColor: `${catColor}15`,
                          borderColor: `${catColor}35`,
                          color: catColor,
                        }}
                      >
                        {/* Indicador de color lateral */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                          style={{ backgroundColor: catColor }}
                        />

                        {/* Contenido de la Tarjeta de la Cita */}
                        <div className="pl-1.5 flex flex-col h-full justify-between overflow-hidden">
                          <div>
                            <p className="text-[10px] font-extrabold leading-tight text-foreground truncate group-hover:underline">
                              {cita.cliente_nombre}
                            </p>
                            <p className="text-[9px] font-semibold opacity-90 truncate mt-0.5">
                              {formatTime12h(cita.hora)} · {cita.duracion} min
                            </p>
                          </div>
                          
                          {/* Detalles adicionales si hay altura suficiente */}
                          {heightPx > 45 && (
                            <div className="flex flex-col gap-0.5 mt-0.5 opacity-80 text-[8px] font-medium truncate">
                              <span className="flex items-center gap-0.5 text-foreground/80 truncate">
                                <Scissors className="w-2.5 h-2.5 shrink-0" />
                                {cita.servicio?.nombre}
                              </span>
                              {scope === 'all' && (
                                <span className="flex items-center gap-0.5 text-foreground/75 truncate">
                                  <User className="w-2.5 h-2.5 shrink-0" />
                                  {cita.empleado?.nombre}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
