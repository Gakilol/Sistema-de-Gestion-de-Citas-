'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Phone, 
  MessageSquare, 
  Sparkles, 
  AlertCircle,
  Loader2,
  CalendarCheck
} from 'lucide-react';

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion: number;
  categoria: string | null;
  activo: boolean;
}

interface Empleado {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  especialidad: string | null;
  activo: boolean;
}

interface BloqueHora {
  hora: string;
  disponible: boolean;
  motivo?: string;
}

export default function BookingPortal() {
  const router = useRouter();
  
  // Estados de datos
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  // Estados del Wizard
  const [paso, setPaso] = useState<number>(1);
  const [servicioSel, setServicioSel] = useState<Servicio | null>(null);
  const [empleadoSel, setEmpleadoSel] = useState<Empleado | 'any' | null>(null);
  const [fechaSel, setFechaSel] = useState<string>(''); // YYYY-MM-DD
  const [horaSel, setHoraSel] = useState<string>('');
  
  // Datos del Cliente
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteNotas, setClienteNotas] = useState('');
  
  // Estados de disponibilidad en tiempo real
  const [bloquesDisponibles, setBloquesDisponibles] = useState<BloqueHora[]>([]);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [empleadoAsignadoAny, setEmpleadoAsignadoAny] = useState<Empleado | null>(null);

  // Estado de envío de la cita
  const [enviandoReserva, setEnviandoReserva] = useState(false);
  const [reservaExitosa, setReservaExitosa] = useState<any | null>(null);

  // Cargar catálogos iniciales
  useEffect(() => {
    async function cargarDatos() {
      try {
        const [resServ, resEmp] = await Promise.all([
          fetch('/api/servicios'),
          fetch('/api/empleados')
        ]);

        if (!resServ.ok || !resEmp.ok) {
          throw new Error('No se pudo cargar el catálogo de reservas. Intenta de nuevo más tarde.');
        }

        const dataServ = await resServ.json();
        const dataEmp = await resEmp.json();

        // Filtrar solo elementos activos
        setServicios((dataServ.servicios || []).filter((s: Servicio) => s.activo !== false));
        setEmpleados((dataEmp.empleados || []).filter((e: Empleado) => e.activo !== false));
      } catch (err: any) {
        setErrorGlobal(err.message || 'Error al conectar con el servidor.');
      } finally {
        setCargandoCatalogos(false);
      }
    }
    cargarDatos();
  }, []);

  // Calcular disponibilidad en tiempo real al cambiar Profesional, Servicio o Fecha
  useEffect(() => {
    if (!fechaSel || !servicioSel || !empleadoSel) {
      setBloquesDisponibles([]);
      return;
    }

    const sId = servicioSel.id;
    const eSel = empleadoSel;

    async function obtenerDisponibilidad() {
      setCargandoDisponibilidad(true);
      setBloquesDisponibles([]);
      setEmpleadoAsignadoAny(null);

      try {
        if (eSel === 'any') {
          // Consultar disponibilidad para cada empleado activo y unificar
          const promesas = empleados.map(emp => 
            fetch(`/api/empleados/${emp.id}/disponibilidad?fecha=${fechaSel}&servicio_id=${sId}`)
              .then(async res => {
                if (!res.ok) return { id: emp.id, disponible: false, bloques: [] };
                const data = await res.json();
                return { id: emp.id, disponible: data.disponible, bloques: data.bloques || [] };
              })
              .catch(() => ({ id: emp.id, disponible: false, bloques: [] }))
          );

          const resultados = await Promise.all(promesas);
          
          // Crear un mapa consolidado de horas y si hay al menos uno disponible
          const bloquesUnificados: { [hora: string]: { disponible: boolean; empleadosDisponibles: string[] } } = {};
          
          resultados.forEach(res => {
            res.bloques.forEach((b: any) => {
              if (!bloquesUnificados[b.hora]) {
                bloquesUnificados[b.hora] = { disponible: false, empleadosDisponibles: [] };
              }
              if (b.disponible) {
                bloquesUnificados[b.hora].disponible = true;
                bloquesUnificados[b.hora].empleadosDisponibles.push(res.id);
              }
            });
          });

          const listaBloques: BloqueHora[] = Object.keys(bloquesUnificados)
            .sort()
            .map(hora => ({
              hora,
              disponible: bloquesUnificados[hora].disponible,
              motivo: bloquesUnificados[hora].disponible ? undefined : 'No hay estilistas libres en este horario'
            }));

          setBloquesDisponibles(listaBloques);
        } else {
          // Consultar disponibilidad del empleado seleccionado
          const res = await fetch(`/api/empleados/${eSel.id}/disponibilidad?fecha=${fechaSel}&servicio_id=${sId}`);
          if (!res.ok) throw new Error('Error al calcular horarios disponibles.');
          const data = await res.json();
          setBloquesDisponibles(data.bloques || []);
        }
      } catch (err: any) {
        console.error('Error calculando disponibilidad:', err);
      } finally {
        setCargandoDisponibilidad(false);
      }
    }

    obtenerDisponibilidad();
  }, [fechaSel, empleadoSel, servicioSel, empleados]);

  // Si seleccionó 'any' y elige una hora, determinar qué empleado se le asignará automáticamente
  const seleccionarHora = async (hora: string) => {
    setHoraSel(hora);
    
    if (empleadoSel === 'any' && servicioSel) {
      const sId = servicioSel.id;
      // Buscar qué empleado está libre en esa hora
      let asignado: Empleado | null = null;
      for (const emp of empleados) {
        try {
          const res = await fetch(`/api/empleados/${emp.id}/disponibilidad?fecha=${fechaSel}&servicio_id=${sId}`);
          if (res.ok) {
            const data = await res.json();
            const bloque = (data.bloques || []).find((b: any) => b.hora === hora && b.disponible);
            if (bloque) {
              asignado = emp;
              break;
            }
          }
        } catch (e) {
          // ignorar error e intentar con el siguiente
        }
      }
      setEmpleadoAsignadoAny(asignado);
    }
  };

  // Crear la cita pública
  const handleReservar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNombre.trim() || !clienteTelefono.trim()) {
      return;
    }

    const finalEmpleadoId = empleadoSel === 'any' 
      ? (empleadoAsignadoAny?.id || empleados[0]?.id)
      : empleadoSel!.id;

    if (!finalEmpleadoId) {
      alert('Error: No se pudo asignar un profesional disponible.');
      return;
    }

    setEnviandoReserva(true);

    try {
      const res = await fetch('/api/public/reservar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cliente_nombre: clienteNombre,
          cliente_telefono: clienteTelefono,
          servicio_id: servicioSel!.id,
          empleado_id: finalEmpleadoId,
          fecha: fechaSel,
          hora: horaSel,
          notas: clienteNotas,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar tu reserva.');
      }

      setReservaExitosa(data.cita);
    } catch (err: any) {
      alert(err.message || 'Error inesperado.');
    } finally {
      setEnviandoReserva(false);
    }
  };

  // Obtener los próximos 30 días para agendamiento (excluyendo domingos si se desea)
  const getProximosDias = () => {
    const dias = [];
    const hoy = new Date();
    
    for (let i = 0; i < 30; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      
      const diaSemana = fecha.getDay();
      const stringFecha = fecha.toISOString().split('T')[0];
      
      // Formato bonito
      const opcionesDia: Intl.DateTimeFormatOptions = { weekday: 'short' };
      const opcionesNum: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
      
      dias.push({
        value: stringFecha,
        diaNombre: fecha.toLocaleDateString('es-ES', opcionesDia).toUpperCase(),
        diaNumero: fecha.toLocaleDateString('es-ES', opcionesNum),
        esDomingo: diaSemana === 0
      });
    }
    return dias;
  };

  const proximosDias = getProximosDias();

  if (cargandoCatalogos) {
    return (
      <div className="min-h-screen bg-[#0a0a0d] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 text-[#d4af37] animate-spin mb-4" />
        <p className="text-neutral-400 animate-pulse font-medium">Cargando la experiencia HAIR STYLE...</p>
      </div>
    );
  }

  if (errorGlobal) {
    return (
      <div className="min-h-screen bg-[#0a0a0d] flex flex-col items-center justify-center text-white p-6">
        <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-2xl max-w-md text-center backdrop-blur-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-200 mb-2">Error de Conexión</h2>
          <p className="text-neutral-400 text-sm mb-6">{errorGlobal}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-[#d4af37] hover:bg-[#bfa030] text-black font-semibold py-3 px-6 rounded-xl transition duration-300 shadow-lg shadow-[#d4af37]/20"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Pantalla final de éxito
  if (reservaExitosa) {
    return (
      <div className="min-h-screen bg-[#0a0a0d] flex items-center justify-center p-4 select-none">
        <div className="w-full max-w-xl bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#d4af37]/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#d4af37]/10 rounded-full blur-3xl" />

          <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">¡Cita Recibida con Éxito!</h1>
          <p className="text-[#d4af37] font-semibold text-sm uppercase tracking-widest mb-6">Estado: PENDIENTE DE CONFIRMACIÓN</p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left mb-8 space-y-4">
            <div className="flex items-start gap-4">
              <Scissors className="w-5 h-5 text-neutral-400 mt-1" />
              <div>
                <p className="text-neutral-400 text-xs uppercase tracking-wider">Servicio</p>
                <p className="text-white font-medium text-lg">{reservaExitosa.servicio?.nombre}</p>
                <p className="text-neutral-500 text-xs">{reservaExitosa.duracion} minutos</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <User className="w-5 h-5 text-neutral-400 mt-1" />
              <div>
                <p className="text-neutral-400 text-xs uppercase tracking-wider">Profesional Asignado</p>
                <p className="text-white font-medium text-lg">{reservaExitosa.empleado?.nombre}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Calendar className="w-5 h-5 text-neutral-400 mt-1" />
              <div>
                <p className="text-neutral-400 text-xs uppercase tracking-wider">Fecha y Hora</p>
                <p className="text-white font-semibold text-lg">
                  {new Date(reservaExitosa.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                </p>
                <p className="text-[#d4af37] font-bold text-lg">{reservaExitosa.hora}</p>
              </div>
            </div>
          </div>

          <p className="text-neutral-400 text-sm mb-8 leading-relaxed max-w-md mx-auto">
            Hemos registrado tu solicitud correctamente. Nuestro equipo revisará la disponibilidad y te enviará una confirmación en los próximos minutos.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-[#d4af37] hover:bg-[#bfa030] text-black font-bold py-3.5 px-6 rounded-xl transition duration-300 shadow-lg shadow-[#d4af37]/20"
            >
              Agendar otra Cita
            </button>
            <button
              onClick={() => router.push('/login')}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3.5 px-6 rounded-xl transition duration-300"
            >
              Panel de Administración
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0d] text-white flex flex-col font-sans relative overflow-hidden select-none">
      {/* Luces de fondo decorativas premium */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#d4af37]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-neutral-900/40 rounded-full blur-[120px] pointer-events-none" />

      {/* HEADER */}
      <header className="border-b border-white/10 backdrop-blur-md bg-black/30 sticky top-0 z-50 transition duration-300">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#d4af37]/15 border border-[#d4af37]/35 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#d4af37]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-[#d4af37] bg-clip-text text-transparent">
                HAIR STYLE
              </h1>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest">Salón & Barbería</p>
            </div>
          </div>

          <button 
            onClick={() => router.push('/login')}
            className="text-xs bg-white/5 hover:bg-[#d4af37]/10 border border-white/10 hover:border-[#d4af37]/30 text-neutral-300 hover:text-[#d4af37] px-4 py-2 rounded-xl transition duration-300 font-medium"
          >
            Acceso Personal
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center">
        
        {/* Wizard Progression Bar */}
        <div className="w-full max-w-xl mb-10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Paso {paso} de 4</span>
            <span className="text-xs text-[#d4af37] font-semibold">
              {paso === 1 && "Selección de Servicio"}
              {paso === 2 && "Selección de Profesional"}
              {paso === 3 && "Elegir Fecha & Hora"}
              {paso === 4 && "Confirmar Reserva"}
            </span>
          </div>
          
          <div className="h-1.5 bg-white/5 border border-white/5 rounded-full overflow-hidden flex gap-1">
            <div className={`h-full transition-all duration-500 rounded-full ${paso >= 1 ? 'bg-[#d4af37] w-1/4' : 'bg-neutral-800 w-0'}`} />
            <div className={`h-full transition-all duration-500 rounded-full ${paso >= 2 ? 'bg-[#d4af37] w-1/4' : 'bg-neutral-800 w-0'}`} />
            <div className={`h-full transition-all duration-500 rounded-full ${paso >= 3 ? 'bg-[#d4af37] w-1/4' : 'bg-neutral-800 w-0'}`} />
            <div className={`h-full transition-all duration-500 rounded-full ${paso >= 4 ? 'bg-[#d4af37] w-1/4' : 'bg-neutral-800 w-0'}`} />
          </div>
        </div>

        {/* COMPONENTES DE PASOS */}
        <div className="w-full">
          
          {/* PASO 1: SELECCIÓN DE SERVICIO */}
          {paso === 1 && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto mb-8">
                <h2 className="text-3xl font-extrabold tracking-tight mb-2">¿Qué servicio deseas reservar?</h2>
                <p className="text-neutral-400 text-sm">Elige uno de nuestros servicios exclusivos para barbería y peluquería.</p>
              </div>

              {servicios.length === 0 ? (
                <div className="text-center p-12 bg-white/5 border border-white/10 rounded-2xl">
                  <Scissors className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                  <p className="text-neutral-400">No hay servicios disponibles en este momento.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {servicios.map((serv) => (
                    <div
                      key={serv.id}
                      onClick={() => {
                        setServicioSel(serv);
                        setPaso(2);
                      }}
                      className={`group border rounded-2xl p-5 cursor-pointer transition duration-300 bg-white/5 backdrop-blur-md flex flex-col justify-between relative overflow-hidden ${
                        servicioSel?.id === serv.id 
                          ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/5 bg-[#d4af37]/5' 
                          : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div>
                        {serv.categoria && (
                          <span className="text-[10px] bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#d4af37] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-widest inline-block mb-3">
                            {serv.categoria}
                          </span>
                        )}
                        <h3 className="text-lg font-bold text-white mb-2 tracking-tight group-hover:text-[#d4af37] transition duration-300">
                          {serv.nombre}
                        </h3>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-4">
                          {serv.descripcion || 'Sin descripción detallada.'}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
                        <span className="text-neutral-400 text-xs font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
                          {serv.duracion} minutos
                        </span>
                        <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-[#d4af37] group-hover:translate-x-1 transition duration-300" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PASO 2: SELECCIÓN DE PROFESIONAL */}
          {paso === 2 && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto mb-8">
                <h2 className="text-3xl font-extrabold tracking-tight mb-2">¿Quién deseas que te atienda?</h2>
                <p className="text-neutral-400 text-sm">Elige uno de nuestros talentosos estilistas y barberos.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                
                {/* Opción Cualquier Profesional */}
                <div
                  onClick={() => {
                    setEmpleadoSel('any');
                    setPaso(3);
                  }}
                  className={`group border rounded-2xl p-6 cursor-pointer text-center transition duration-300 bg-white/5 backdrop-blur-md relative overflow-hidden flex flex-col items-center justify-center ${
                    empleadoSel === 'any'
                      ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/5 bg-[#d4af37]/5'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="w-16 h-16 bg-[#d4af37]/15 border border-[#d4af37]/35 text-[#d4af37] rounded-full flex items-center justify-center mb-4 transition duration-300 group-hover:scale-105">
                    <User className="w-8 h-8" />
                  </div>
                  
                  <h3 className="text-lg font-bold text-white group-hover:text-[#d4af37] transition duration-300">
                    Cualquiera libre
                  </h3>
                  <p className="text-neutral-400 text-xs mt-1 leading-relaxed">
                    Te asignaremos automáticamente al estilista disponible que mejor se adapte.
                  </p>
                </div>

                {empleados.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => {
                      setEmpleadoSel(emp);
                      setPaso(3);
                    }}
                    className={`group border rounded-2xl p-6 cursor-pointer text-center transition duration-300 bg-white/5 backdrop-blur-md relative overflow-hidden flex flex-col items-center justify-center ${
                      typeof empleadoSel === 'object' && empleadoSel?.id === emp.id 
                        ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/5 bg-[#d4af37]/5' 
                        : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="w-16 h-16 bg-white/5 border border-white/10 text-neutral-300 rounded-full flex items-center justify-center mb-4 font-bold text-xl uppercase transition duration-300 group-hover:scale-105 group-hover:border-[#d4af37]/55 group-hover:text-[#d4af37]">
                      {emp.nombre.substring(0, 2)}
                    </div>
                    
                    <h3 className="text-lg font-bold text-white group-hover:text-[#d4af37] transition duration-300 tracking-tight">
                      {emp.nombre}
                    </h3>
                    {emp.especialidad && (
                      <span className="text-[10px] bg-white/5 border border-white/10 text-neutral-400 font-semibold px-2 py-0.5 rounded-full mt-2">
                        {emp.especialidad}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-start mt-6">
                <button
                  onClick={() => setPaso(1)}
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition duration-300 font-semibold text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Volver a Servicios
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: FECHA Y HORA DE LA CITA */}
          {paso === 3 && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto mb-8">
                <h2 className="text-3xl font-extrabold tracking-tight mb-2">¿Cuándo te gustaría venir?</h2>
                <p className="text-neutral-400 text-sm">Selecciona uno de los próximos días y elige el horario de tu preferencia.</p>
              </div>

              {/* Selector Horizontal de Fechas */}
              <div className="space-y-3">
                <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#d4af37]" /> Selecciona un Día
                </label>
                
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
                  {proximosDias.map((dia) => (
                    <button
                      key={dia.value}
                      disabled={dia.esDomingo}
                      onClick={() => {
                        setFechaSel(dia.value);
                        setHoraSel('');
                      }}
                      className={`flex-shrink-0 snap-start w-20 py-3.5 rounded-2xl flex flex-col items-center justify-center border transition duration-300 ${
                        dia.esDomingo 
                          ? 'border-transparent bg-neutral-900/20 text-neutral-600 cursor-not-allowed opacity-40'
                          : fechaSel === dia.value
                            ? 'border-[#d4af37] bg-[#d4af37]/15 text-white shadow-lg'
                            : 'border-white/10 bg-white/5 hover:border-white/20 text-neutral-300'
                      }`}
                    >
                      <span className="text-[10px] font-extrabold tracking-widest">{dia.diaNombre}</span>
                      <span className="text-lg font-bold mt-1 tracking-tight">{dia.diaNumero.split(' ')[0]}</span>
                      <span className="text-[9px] uppercase font-bold text-neutral-500 mt-0.5">{dia.diaNumero.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de Horas */}
              {fechaSel && (
                <div className="space-y-3 border-t border-white/5 pt-6 mt-6">
                  <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-4">
                    <Clock className="w-3.5 h-3.5 text-[#d4af37]" /> Horarios Disponibles
                  </label>

                  {cargandoDisponibilidad ? (
                    <div className="text-center py-10">
                      <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin mx-auto mb-2" />
                      <p className="text-neutral-400 text-xs">Consultando disponibilidad en tiempo real...</p>
                    </div>
                  ) : bloquesDisponibles.length === 0 ? (
                    <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl">
                      <AlertCircle className="w-8 h-8 text-neutral-500 mx-auto mb-3" />
                      <p className="text-neutral-400 text-sm">Este profesional no tiene agenda disponible para este día o el salón se encuentra cerrado.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {bloquesDisponibles.map((bloque) => (
                        <button
                          key={bloque.hora}
                          disabled={!bloque.disponible}
                          onClick={() => seleccionarHora(bloque.hora)}
                          className={`py-3 rounded-xl border font-semibold text-sm transition duration-300 ${
                            !bloque.disponible
                              ? 'border-transparent bg-neutral-900/20 text-neutral-600 cursor-not-allowed opacity-30'
                              : horaSel === bloque.hora
                                ? 'border-[#d4af37] bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-105'
                                : 'border-white/10 bg-white/5 text-neutral-200 hover:border-white/30 hover:bg-white/10'
                          }`}
                        >
                          {bloque.hora}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Botones de navegación del paso 3 */}
              <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-8">
                <button
                  onClick={() => setPaso(2)}
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition duration-300 font-semibold text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Volver
                </button>

                <button
                  disabled={!fechaSel || !horaSel}
                  onClick={() => setPaso(4)}
                  className={`flex items-center gap-1 px-5 py-2.5 rounded-xl font-bold text-sm transition duration-300 ${
                    fechaSel && horaSel
                      ? 'bg-[#d4af37] hover:bg-[#bfa030] text-black shadow-lg shadow-[#d4af37]/15'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* PASO 4: DATOS DEL CLIENTE Y CONFIRMACIÓN */}
          {paso === 4 && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto mb-8">
                <h2 className="text-3xl font-extrabold tracking-tight mb-2">Tus datos de Reserva</h2>
                <p className="text-neutral-400 text-sm">Completa tus datos de contacto para agendar la cita.</p>
              </div>

              <div className="grid md:grid-cols-5 gap-8 items-start">
                
                {/* Formulario */}
                <form onSubmit={handleReservar} className="md:col-span-3 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      Nombre Completo *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Carlos Pérez"
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#d4af37] text-white rounded-xl py-3 px-4 outline-none transition duration-300 placeholder-neutral-600 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#d4af37]" /> Teléfono de Contacto *
                    </label>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. 5512345678"
                      value={clienteTelefono}
                      onChange={(e) => setClienteTelefono(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#d4af37] text-white rounded-xl py-3 px-4 outline-none transition duration-300 placeholder-neutral-600 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#d4af37]" /> Indicaciones o notas
                    </label>
                    <textarea
                      placeholder="e.g. Algún detalle o estilo que desees anticipar."
                      rows={3}
                      value={clienteNotas}
                      onChange={(e) => setClienteNotas(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#d4af37] text-white rounded-xl py-3 px-4 outline-none transition duration-300 placeholder-neutral-600 text-sm resize-none"
                    />
                  </div>

                  <button
                    disabled={enviandoReserva || !clienteNombre.trim() || !clienteTelefono.trim()}
                    type="submit"
                    className={`w-full py-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition duration-300 mt-6 ${
                      enviandoReserva || !clienteNombre.trim() || !clienteTelefono.trim()
                        ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                        : 'bg-[#d4af37] hover:bg-[#bfa030] text-black shadow-lg shadow-[#d4af37]/20 scale-100 active:scale-95'
                    }`}
                  >
                    {enviandoReserva ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" /> Procesando tu Reserva...
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="w-5 h-5 text-black" /> Solicitar Reserva
                      </>
                    )}
                  </button>
                </form>

                {/* Resumen Lateral */}
                <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-5">
                  <h3 className="text-xs text-[#d4af37] font-extrabold uppercase tracking-widest border-b border-white/5 pb-3">
                    Resumen de tu Cita
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Servicio</p>
                      <p className="text-white font-semibold text-sm mt-0.5">{servicioSel?.nombre}</p>
                      <p className="text-neutral-500 text-xs mt-0.5">{servicioSel?.duracion} minutos</p>
                    </div>

                    <div>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Profesional</p>
                      <p className="text-white font-semibold text-sm mt-0.5">
                        {empleadoSel === 'any' ? (
                          <span className="flex items-center gap-1 text-[#d4af37]">
                            <User className="w-3.5 h-3.5" />
                            {empleadoAsignadoAny?.nombre || 'Asignación automática'}
                          </span>
                        ) : (
                          empleadoSel?.nombre
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Fecha y Hora</p>
                      <p className="text-white font-semibold text-sm mt-0.5">
                        {fechaSel ? new Date(fechaSel + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) : ''}
                      </p>
                      <p className="text-[#d4af37] font-bold text-sm mt-0.5">{horaSel}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 text-[10px] text-neutral-400 space-y-1.5 leading-relaxed">
                    <p className="flex items-start gap-1">
                      <span className="text-[#d4af37]">•</span> La cita se agendará en estado **Pendiente** de confirmación.
                    </p>
                    <p className="flex items-start gap-1">
                      <span className="text-[#d4af37]">•</span> Te enviaremos una notificación al número proporcionado.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón de volver */}
              <div className="flex justify-start border-t border-white/5 pt-6 mt-8">
                <button
                  onClick={() => setPaso(3)}
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition duration-300 font-semibold text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Volver a Fecha & Hora
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-neutral-500 mt-12 bg-black/10">
        <p>© 2026 HAIR STYLE Salón & Barbería. Reservados todos los derechos.</p>
        <p className="mt-1 text-neutral-600">Pure Scheduling Experience • Timezone-Independent Availability Engine</p>
      </footer>
    </div>
  );
}
