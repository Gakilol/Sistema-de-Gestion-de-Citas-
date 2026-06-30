'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit, X, Search, MessageCircle, CheckCircle2, Minus, AlertTriangle, UserPlus, Calendar as CalendarIcon, List as ListIcon, Clock as ClockIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { TimeSelector } from '@/components/citas/TimeSelector';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn, formatColones } from '@/lib/utils';
import { urlWhatsAppConfirmacion } from '@/lib/whatsapp';
import { formatDBDate, getBusinessTodayString } from '@/lib/timezone';
import { useAuth } from '@/components/providers/auth-provider';
import { AgendaCalendario } from '@/components/citas/AgendaCalendario';

const getEmptyForm = () => ({
  cliente_id: '',
  cliente_nombre: '',
  cliente_telefono: '',
  servicio_id: '',
  servicio_ids: [] as string[],
  servicio_duraciones: [] as number[], // custom durations parallel to servicio_ids
  empleado_id: '',
  fecha: '',
  hora: '',
  notas: '',
});

const ESTADOS = ['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA', 'NO_SHOW', 'REPROGRAMADA'];
const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  EN_PROGRESO: 'En Progreso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  NO_SHOW: 'No se presentó',
  REPROGRAMADA: 'Reprogramada',
};
const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'badge-pendiente',
  CONFIRMADA: 'badge-confirmada',
  EN_PROGRESO: 'badge-en_progreso',
  COMPLETADA: 'badge-completada',
  CANCELADA: 'badge-cancelada',
  NO_SHOW: 'badge-cancelada',
  REPROGRAMADA: 'badge-reprogramada',
};

function fmtDate(d: string | Date) {
  return formatDBDate(d);
}

function getBusinessTomorrowString(): string {
  const todayStr = getBusinessTodayString();
  const [year, month, day] = todayStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

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

function isSameBusinessWeek(dateStr: string): boolean {
  const todayStr = getBusinessTodayString();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayDate = new Date(Date.UTC(ty, tm - 1, td));
  
  const dayOfWeek = todayDate.getUTCDay(); 
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const startOfWeek = new Date(todayDate);
  startOfWeek.setUTCDate(todayDate.getUTCDate() - diffToMonday);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
  
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetTime = Date.UTC(y, m - 1, d);
  
  return targetTime >= startOfWeek.getTime() && targetTime <= endOfWeek.getTime();
}

function isSameBusinessMonth(dateStr: string): boolean {
  const todayStr = getBusinessTodayString();
  const [ty, tm] = todayStr.split('-');
  const [y, m] = dateStr.split('-');
  return ty === y && tm === m;
}

function isWithinBusinessQuincena(dateStr: string): boolean {
  const todayStr = getBusinessTodayString();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayDate = new Date(Date.UTC(ty, tm - 1, td));
  
  const fifteenDaysAgo = new Date(todayDate);
  fifteenDaysAgo.setUTCDate(todayDate.getUTCDate() - 14);
  
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetTime = Date.UTC(y, m - 1, d);
  
  return targetTime >= fifteenDaysAgo.getTime() && targetTime <= todayDate.getTime();
}


function sortCitas(citasList: any[], ascending: boolean) {
  return [...citasList].sort((a, b) => {
    const dateA = a.fecha.split('T')[0] + 'T' + a.hora;
    const dateB = b.fecha.split('T')[0] + 'T' + b.hora;
    if (ascending) {
      return dateA.localeCompare(dateB);
    } else {
      return dateB.localeCompare(dateA);
    }
  });
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
  const [filtroSmart, setFiltroSmart] = useState('activas');
  const [filtroHistorialPeriodo, setFiltroHistorialPeriodo] = useState('todos');
  const [page, setPage]           = useState(1);

  // Modos de Vista y Scopes
  const [vistaModo, setVistaModo] = useState<'lista' | 'agenda' | 'disponibilidad'>('lista');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [selectedDateStr, setSelectedDateStr] = useState(getBusinessTodayString());

  // Estado local para disponibilidad integrada (Bloques de horario)
  const [empleadosDispData, setEmpleadosDispData] = useState<any[]>([]);
  const [loadingDisp, setLoadingDisp] = useState(false);

  const { user }                  = useAuth();
  const isAdmin                   = user?.rol === 'ADMIN';
  const isTechSupport             = user?.rol === 'TECH_SUPPORT';
  const canSeeAll                 = isAdmin || isTechSupport;

  // ─── Estado para modal inline de nuevo cliente ─────────────────────────
  const [showCrearCliente, setShowCrearCliente] = useState(false);
  const [formNuevoCliente, setFormNuevoCliente] = useState({ nombre: '', telefono: '', correo: '', notas: '' });
  const [savingCliente, setSavingCliente]       = useState(false);
  const [phoneValidCliente, setPhoneValidCliente] = useState(true);

  // Estado para el buscador inteligente de clientes
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [forzar, setForzar]       = useState(false);

  // Ref para cerrar el buscador de clientes al hacer click fuera
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Escuchar clicks fuera para cerrar el dropdown de clientes
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setClienteDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchCitas = async (scopeParam?: string, empParam?: string) => {
    setIsLoading(true);
    try {
      const activeScope = scopeParam || scope;
      const activeEmp = empParam !== undefined ? empParam : filtroEmpleado;
      const res  = await fetch(`/api/citas?scope=${activeScope}&empleado_id=${activeEmp}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener citas');
      setCitas(data.citas || []);
      setPage(1);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar citas');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBloques = async (selectedDate: string, empId?: string) => {
    setLoadingDisp(true);
    try {
      let url = `/api/bloques-horario?fecha=${selectedDate}`;
      if (empId) {
        url += `&empleado_id=${empId}`;
      } else if (user?.rol === 'EMPLEADO') {
        url += `&empleado_id=${user.id}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al obtener la disponibilidad');
      }
      const data = await res.json();
      setEmpleadosDispData(data.empleados || []);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar disponibilidad');
    } finally {
      setLoadingDisp(false);
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

  // Carga reactiva de citas en base al scope y filtro de empleado
  useEffect(() => {
    fetchCitas(scope, filtroEmpleado);
  }, [scope, filtroEmpleado]);

  // Carga reactiva de disponibilidad cuando cambia fecha de disponibilidad o filtro de empleado
  useEffect(() => {
    if (vistaModo === 'disponibilidad') {
      fetchBloques(selectedDateStr, filtroEmpleado);
    }
  }, [selectedDateStr, filtroEmpleado, vistaModo]);

  useEffect(() => {
    fetchCatalogos();
  }, []);

  const handleSearch = (val: string) => {
    setBusqueda(val);
    setPage(1);
  };

  const openCreate = () => {
    const activeServs = servicios.filter(s => s.activo);
    const activeEmps  = empleados.filter(e => e.activo);
    if (!activeServs.length || !activeEmps.length) {
      toast.error('Crea al menos un servicio y un empleado activos primero');
      return;
    }
    const emptyForm = getEmptyForm();
    if (user?.rol === 'EMPLEADO') {
      emptyForm.empleado_id = user.id;
    }
    setForm(emptyForm);
    setClienteBusqueda('');
    setForzar(false);
    setEditingId(null);
    setShowModal(true);
  };

  // ─── Crear cliente inline desde formulario de cita ──────────────────────
  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNuevoCliente.nombre.trim() || formNuevoCliente.nombre.trim().length < 2) {
      toast.error('El nombre es obligatorio (mínimo 2 caracteres)');
      return;
    }
    // El teléfono ya no es obligatorio, pero si se provee debe ser válido
    if (formNuevoCliente.telefono && !phoneValidCliente) {
      toast.error('Ingresa un teléfono válido o déjalo vacío');
      return;
    }
    setSavingCliente(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formNuevoCliente),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const nuevoCliente = data.cliente;
      // Añadir al inicio de la lista local sin recargar la página
      setClientesList((prev: any[]) => [nuevoCliente, ...prev]);
      // Seleccionar automáticamente el nuevo cliente en el formulario de cita
      setForm((prev: any) => ({
        ...prev,
        cliente_id: nuevoCliente.id,
        cliente_nombre: nuevoCliente.nombre,
        cliente_telefono: nuevoCliente.telefono || '',
      }));
      setClienteBusqueda(nuevoCliente.nombre);
      // Limpiar y cerrar el modal de creación
      setFormNuevoCliente({ nombre: '', telefono: '', correo: '', notas: '' });
      setPhoneValidCliente(true);
      setShowCrearCliente(false);
      toast.success(`Cliente "${nuevoCliente.nombre}" creado y seleccionado`);
    } catch (err: any) {
      toast.error(err.message || 'Error al crear cliente');
    } finally {
      setSavingCliente(false);
    }
  };


  // Clientes filtrados para el buscador inteligente
  const clientesFiltrados = useMemo(() => {
    const q = clienteBusqueda.toLowerCase().trim();
    if (!q) {
      // Mostrar primeros 8 clientes si la búsqueda está vacía
      return clientesList.slice(0, 8);
    }
    return clientesList.filter(c =>
      c.nombre?.toLowerCase().includes(q) ||
      (c.telefono && c.telefono.includes(q)) ||
      (c.correo && c.correo.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [clienteBusqueda, clientesList]);

  // Guardar filtro smart en sesión
  useEffect(() => {
    sessionStorage.setItem('citas_filtro_smart', filtroSmart);
  }, [filtroSmart]);

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
    if (!form.cliente_id) {
      toast.error('Debes seleccionar un cliente existente');
      return;
    }
    setSaving(true);
    const payload = {
      cliente_id: form.cliente_id || null,
      cliente_nombre: form.cliente_nombre,
      cliente_telefono: form.cliente_telefono || null,
      servicio_id: form.servicio_ids[0],
      servicio_ids: form.servicio_ids,
      servicios_seleccionados: form.servicio_ids.map((id: string, index: number) => ({
        id,
        duracion: form.servicio_duraciones[index] || 30
      })),
      empleado_id: form.empleado_id,
      fecha: form.fecha,
      hora: form.hora,
      notas: form.notas || null,
      forzar: forzar && isAdmin,
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
      setForzar(false);
      fetchCitas();
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
        fetchCitas();
        return;
      }
      toast.success(`Estado → ${ESTADO_LABEL[estado]}`);
    } catch {
      fetchCitas();
    }
  };

  // openEdit también resetea estado de forzar
  const openEdit = (c: any) => {
    const ids = Array.isArray(c.citaServicios) && c.citaServicios.length > 0
      ? c.citaServicios.map((cs: any) => cs.servicio_id)
      : (c.servicio_id ? [c.servicio_id] : []);

    const duraciones: number[] = [];
    if (Array.isArray(c.citaServicios) && c.citaServicios.length > 0) {
      c.citaServicios.forEach((cs: any) => { duraciones.push(cs.duracion); });
    } else if (c.servicio_id) {
      duraciones.push(c.duracion);
    }

    setForm({
      cliente_id:        c.cliente_id || '',
      cliente_nombre:    c.cliente_nombre,
      cliente_telefono:  c.cliente_telefono || '',
      servicio_id:       c.servicio_id || '',
      servicio_ids:      ids,
      servicio_duraciones: duraciones,
      empleado_id:       c.empleado_id,
      fecha:             new Date(c.fecha).toISOString().split('T')[0],
      hora:              c.hora,
      notas:             c.notas || '',
    });
    setClienteBusqueda(c.cliente_nombre || '');
    setForzar(false);
    setEditingId(c.id);
    setShowModal(true);
  };

  const filteredAndSortedCitas = useMemo(() => {
    let result = [...citas];
    const todayStr = getBusinessTodayString();
    
    // 1. Filtrar por búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      result = result.filter(c =>
        c.cliente_nombre.toLowerCase().includes(q) ||
        (c.cliente_telefono && c.cliente_telefono.includes(q)) ||
        (c.servicio?.nombre && c.servicio.nombre.toLowerCase().includes(q)) ||
        (c.citaServicios && c.citaServicios.some((cs: any) => cs.servicio?.nombre?.toLowerCase().includes(q)))
      );
    }
    
    // 2. Filtrar por Empleado
    if (filtroEmpleado) {
      result = result.filter(c => c.empleado_id === filtroEmpleado);
    }

    // 3. Filtrar por Estado específico
    if (filtroEstado) {
      result = result.filter(c => c.estado === filtroEstado);
    }
    
    // 4. Filtrar por Filtro Smart (solo si no hay filtro de estado manual)
    let isAscending = true;
    
    if (!filtroEstado) {
      if (filtroSmart === 'activas') {
        result = result.filter(c => ['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'REPROGRAMADA'].includes(c.estado));
        isAscending = true;
      } else if (filtroSmart === 'hoy') {
        result = result.filter(c => c.fecha.split('T')[0] === todayStr);
        isAscending = true;
      } else if (filtroSmart === 'manana') {
        const tomorrowStr = getBusinessTomorrowString();
        result = result.filter(c => c.fecha.split('T')[0] === tomorrowStr);
        isAscending = true;
      } else if (filtroSmart === 'semana') {
        result = result.filter(c => isSameBusinessWeek(c.fecha.split('T')[0]));
        isAscending = true;
      } else if (filtroSmart === 'mes') {
        result = result.filter(c => isSameBusinessMonth(c.fecha.split('T')[0]));
        isAscending = true;
      } else if (filtroSmart === 'historial') {
        if (filtroHistorialPeriodo === 'todos') {
          result = result.filter(c => ['COMPLETADA', 'CANCELADA'].includes(c.estado));
        } else {
          result = result.filter(c => c.estado === 'COMPLETADA');
          if (filtroHistorialPeriodo === 'diario') {
            result = result.filter(c => c.fecha.split('T')[0] === todayStr);
          } else if (filtroHistorialPeriodo === 'semanal') {
            result = result.filter(c => isSameBusinessWeek(c.fecha.split('T')[0]));
          } else if (filtroHistorialPeriodo === 'quincenal') {
            result = result.filter(c => isWithinBusinessQuincena(c.fecha.split('T')[0]));
          } else if (filtroHistorialPeriodo === 'mensual') {
            result = result.filter(c => isSameBusinessMonth(c.fecha.split('T')[0]));
          }
        }
        isAscending = false;

      } else if (filtroSmart === 'todas') {
        isAscending = false;
      }
    } else {
      isAscending = false;
    }
    
    // 5. Ordenar
    return sortCitas(result, isAscending);
  }, [citas, busqueda, filtroEmpleado, filtroEstado, filtroSmart]);

  // Paginación
  const totalPages = Math.ceil(filteredAndSortedCitas.length / PAGE_SIZE);
  const paginated  = filteredAndSortedCitas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const mainContent = (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestión de Citas</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {vistaModo === 'lista' && `${filteredAndSortedCitas.length} de `}
                {citas.length} cita{citas.length !== 1 ? 's' : ''} en total
              </p>
            </div>
            <Button onClick={openCreate} className="gap-1.5 glow-gold">
              <Plus className="w-4 h-4" /> Nueva Cita
            </Button>
          </div>

          {/* Barra de Vista e Integración de Scope */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/30 pb-4">
            {/* Selector de Pestaña Principal (Modo) */}
            <div className="flex bg-secondary/30 p-1 rounded-xl border border-border/50 self-start">
              <button
                type="button"
                onClick={() => setVistaModo('lista')}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  vistaModo === 'lista'
                    ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <ListIcon className="w-3.5 h-3.5" /> Lista de Citas
              </button>
              <button
                type="button"
                onClick={() => setVistaModo('agenda')}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  vistaModo === 'agenda'
                    ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <CalendarIcon className="w-3.5 h-3.5" /> Calendario / Agenda
              </button>
              <button
                type="button"
                onClick={() => setVistaModo('disponibilidad')}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  vistaModo === 'disponibilidad'
                    ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <ClockIcon className="w-3.5 h-3.5" /> Disponibilidad Personal
              </button>
            </div>

            {/* Switch de Scope (Mis Citas vs Ver Todas) */}
            {canSeeAll && vistaModo !== 'disponibilidad' && (
              <div className="flex bg-secondary/30 p-1 rounded-xl border border-border/50 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setScope('mine');
                    setFiltroEmpleado('');
                  }}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                    scope === 'mine'
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  Mis Citas
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                    scope === 'all'
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  Ver Todas
                </button>
              </div>
            )}
          </div>

          {/* VISTA DE LISTADO TRADICIONAL */}
          {vistaModo === 'lista' && (
            <div className="space-y-5">
              {/* Filtros Inteligentes (Tabs) */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5 p-1 bg-secondary/30 rounded-xl border border-border/50 w-full md:w-auto self-start">
                  {[
                    { id: 'activas', label: 'Activas' },
                    { id: 'hoy', label: 'Hoy' },
                    { id: 'manana', label: 'Mañana' },
                    { id: 'semana', label: 'Esta Semana' },
                    { id: 'mes', label: 'Este Mes' },
                    { id: 'historial', label: 'Historial' },
                    { id: 'todas', label: 'Todas' },
                  ].map(f => {
                    const isActive = filtroSmart === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setFiltroSmart(f.id);
                          sessionStorage.setItem('citas_filtro_smart', f.id);
                          setFiltroEstado(''); // reset manual state filter
                          setPage(1);
                        }}
                        className={cn(
                          "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        )}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-filtros para el Historial de Citas Completadas */}
                {filtroSmart === 'historial' && (
                  <div className="flex flex-wrap gap-1 p-1 bg-secondary/15 rounded-lg border border-border/30 w-full md:w-auto self-start">
                    {[
                      { id: 'todos', label: 'Todos' },
                      { id: 'diario', label: 'Diario (Hoy)' },
                      { id: 'semanal', label: 'Semanal' },
                      { id: 'quincenal', label: 'Quincenal (15 días)' },
                      { id: 'mensual', label: 'Mensual' },
                    ].map(p => {
                      const isActive = filtroHistorialPeriodo === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setFiltroHistorialPeriodo(p.id);
                            setPage(1);
                          }}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer",
                            isActive
                              ? "bg-card text-foreground shadow-sm border border-border/30"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                          )}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                )}

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
                    onChange={e => {
                      setFiltroEstado(e.target.value);
                      setFiltroSmart('todas');
                      setPage(1);
                    }}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[150px] cursor-pointer"
                  >
                    <option value="">Filtrar por estado</option>
                    {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                  </select>
                  
                  {/* Filtro por empleado sólo visible para Admin/Tech y si el scope es 'all' */}
                  {(user?.rol !== 'EMPLEADO' && scope === 'all') && (
                    <select
                      value={filtroEmpleado}
                      onChange={e => {
                        setFiltroEmpleado(e.target.value);
                        setPage(1);
                      }}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[150px] cursor-pointer"
                    >
                      <option value="">Todos los empleados</option>
                      {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* Listado */}
              <div className="space-y-4">
                {/* Vista Escritorio (Tabla) */}
                <Card className="hidden md:block border-border/50 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/70 text-secondary-foreground border-b border-border/50">
                        <tr>
                          {['Cliente', 'Servicios', 'Empleado', 'Fecha y Hora', 'Monto', 'Estado', 'Acciones'].map(h => (
                            <th key={h} className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading ? (
                          Array.from({ length: 5 }).map((_, idx) => (
                            <tr key={idx} className="border-b border-border/20 animate-pulse">
                              <td className="px-4 py-4">
                                <div className="skeleton h-4 w-28 mb-1.5" />
                                <div className="skeleton h-3 w-20" />
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex gap-1.5">
                                  <div className="skeleton h-5 w-24 rounded-full" />
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="skeleton h-4 w-24" />
                              </td>
                              <td className="px-4 py-4">
                                <div className="skeleton h-4 w-20 mb-1.5" />
                                <div className="skeleton h-3 w-16" />
                              </td>
                              <td className="px-4 py-4">
                                <div className="skeleton h-4 w-16" />
                              </td>
                              <td className="px-4 py-4">
                                <div className="skeleton h-6 w-20 rounded-full" />
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex gap-2">
                                  <div className="skeleton h-8 w-8 rounded-lg" />
                                  <div className="skeleton h-8 w-8 rounded-lg" />
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : paginated.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
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
                          const isPersonalizado = cita.citaServicios?.some((cs: any) => cs.duracion !== cs.servicio?.duracion);
                          return (
                            <tr key={cita.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-3.5">
                                <p className="font-medium text-foreground">{cita.cliente_nombre}</p>
                                {cita.cliente_telefono && <p className="text-xs text-muted-foreground">{cita.cliente_telefono}</p>}
                              </td>
                              <td className="px-4 py-3.5 text-muted-foreground">
                                {cita.citaServicios && cita.citaServicios.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                                    {cita.citaServicios.map((cs: any) => {
                                      const cat = cs.servicio?.categoriaRel;
                                      const catColor = cat?.color || '#6366f1';
                                      return (
                                        <span 
                                          key={cs.id} 
                                          className="text-xs px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1"
                                          style={{
                                            backgroundColor: `${catColor}15`,
                                            color: catColor,
                                            borderColor: `${catColor}30`
                                          }}
                                          title={cat ? `Categoría: ${cat.nombre}` : 'Sin categoría'}
                                        >
                                          {cat && (
                                            <span 
                                              className="w-1.5 h-1.5 rounded-full shrink-0" 
                                              style={{ backgroundColor: catColor }} 
                                            />
                                          )}
                                          {cs.servicio?.nombre}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  cita.servicio?.nombre ? (
                                    <span 
                                      className="text-xs px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 w-fit"
                                      style={{
                                        backgroundColor: `${cita.servicio?.categoriaRel?.color || '#6366f1'}15`,
                                        color: cita.servicio?.categoriaRel?.color || '#6366f1',
                                        borderColor: `${cita.servicio?.categoriaRel?.color || '#6366f1'}30`
                                      }}
                                    >
                                      {cita.servicio?.categoriaRel?.nombre && (
                                        <span 
                                          className="w-1.5 h-1.5 rounded-full shrink-0" 
                                          style={{ backgroundColor: cita.servicio?.categoriaRel?.color || '#6366f1' }} 
                                        />
                                      )}
                                      {cita.servicio?.nombre}
                                    </span>
                                  ) : '-'
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-muted-foreground">{cita.empleado?.nombre || '-'}</td>
                              <td className="px-4 py-3.5">
                                <p className="font-medium text-foreground">{fmtDate(cita.fecha)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {cita.hora} · {cita.duracion} min
                                  {isPersonalizado && (
                                    <span className="block text-[10px] text-amber-500 font-bold mt-0.5" title="Duración modificada manualmente">
                                      ⏱ personalizado
                                    </span>
                                  )}
                                </p>
                              </td>
                              <td className="px-4 py-3.5 font-semibold text-foreground whitespace-nowrap">
                                {formatColones(cita.monto)}
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
                                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => openEdit(cita)}>
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  {waUrl && (
                                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#25D366] hover:text-[#1ebe5a] hover:bg-[#25D366]/10 cursor-pointer">
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
                </Card>

                {/* Vista Móvil (Tarjetas Ricas) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <Card key={idx} className="p-4 border-border/40 bg-card animate-pulse space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="skeleton h-4 w-28" />
                          <div className="skeleton h-5 w-16 rounded-full" />
                        </div>
                        <div className="skeleton h-4 w-36 mb-1" />
                        <div className="skeleton h-3 w-28" />
                        <div className="flex justify-between items-center pt-2 border-t border-border/20">
                          <div className="skeleton h-3 w-20" />
                          <div className="flex gap-1.5">
                            <div className="skeleton h-7 w-14 rounded-md" />
                            <div className="skeleton h-7 w-16 rounded-md" />
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : paginated.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm bg-card border border-border/40 rounded-xl">
                      {busqueda || filtroEstado || filtroEmpleado ? 'Sin resultados para los filtros aplicados' : 'No hay citas registradas'}
                    </div>
                  ) : (
                    paginated.map((cita) => {
                      const waUrl = cita.cliente_telefono ? urlWhatsAppConfirmacion({
                        cliente_nombre: cita.cliente_nombre,
                        cliente_telefono: cita.cliente_telefono,
                        servicio: cita.servicio?.nombre || '',
                        empleado: cita.empleado?.nombre || '',
                        fecha: cita.fecha,
                        hora: cita.hora,
                      }) : null;
                      const isPersonalizado = cita.citaServicios?.some((cs: any) => cs.duracion !== cs.servicio?.duracion);
                      return (
                        <Card key={cita.id} className="p-4 border-border/45 bg-card/60 hover:bg-secondary/15 transition-colors space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-foreground text-sm">{cita.cliente_nombre}</p>
                              {cita.cliente_telefono && <p className="text-xs text-muted-foreground">{cita.cliente_telefono}</p>}
                            </div>
                            <select
                              value={cita.estado}
                              onChange={e => changeEstado(cita.id, e.target.value)}
                              className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer bg-transparent', ESTADO_BADGE[cita.estado])}
                            >
                              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground flex-col">
                              <span className="font-medium text-foreground text-[10px] uppercase tracking-wide">Servicios:</span>
                              {cita.citaServicios && cita.citaServicios.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-full">
                                  {cita.citaServicios.map((cs: any) => {
                                    const cat = cs.servicio?.categoriaRel;
                                    const catColor = cat?.color || '#6366f1';
                                    return (
                                      <span 
                                        key={cs.id}
                                        className="px-2 py-0.5 rounded text-[10px] border font-semibold flex items-center gap-1.5"
                                        style={{
                                          backgroundColor: `${catColor}12`,
                                          color: catColor,
                                          borderColor: `${catColor}25`
                                        }}
                                      >
                                        {cat && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />}
                                        {cs.servicio?.nombre}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                cita.servicio?.nombre ? (
                                  <span 
                                    className="px-2 py-0.5 rounded text-[10px] border font-semibold flex items-center gap-1.5 w-fit"
                                    style={{
                                      backgroundColor: `${cita.servicio?.categoriaRel?.color || '#6366f1'}12`,
                                      color: cita.servicio?.categoriaRel?.color || '#6366f1',
                                      borderColor: `${cita.servicio?.categoriaRel?.color || '#6366f1'}25`
                                    }}
                                  >
                                    {cita.servicio?.categoriaRel?.nombre && (
                                      <span 
                                        className="w-1.5 h-1.5 rounded-full shrink-0" 
                                        style={{ backgroundColor: cita.servicio?.categoriaRel?.color || '#6366f1' }} 
                                      />
                                    )}
                                    {cita.servicio?.nombre}
                                  </span>
                                ) : '-'
                              )}
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/10">
                              <p>Estilista: <span className="text-foreground font-semibold">{cita.empleado?.nombre || '-'}</span></p>
                              <p>Duración: <span className="text-foreground font-semibold">
                                {cita.duracion} min
                                {isPersonalizado && (
                                  <span className="ml-1 text-[10px] text-amber-500 font-bold" title="Duración modificada manualmente">
                                    (⏱ modificado)
                                  </span>
                                )}
                              </span></p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2.5 border-t border-border/30">
                            <div className="text-xs flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-primary">{fmtDate(cita.fecha)}</span>
                              <span className="text-muted-foreground">· {cita.hora}</span>
                              <span className="font-semibold text-foreground ml-1">{formatColones(cita.monto)}</span>
                            </div>
                            <div className="flex gap-1.5">
                              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1 cursor-pointer" onClick={() => openEdit(cita)}>
                                <Edit className="w-3.5 h-3.5" /> Editar
                              </Button>
                              {waUrl ? (
                                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1 border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/10 cursor-pointer">
                                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                  </Button>
                                </a>
                              ) : (
                                <Button variant="outline" size="sm" disabled className="h-7 px-2.5 text-xs gap-1 opacity-50 cursor-not-allowed">
                                  Sin Teléfono
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border border-border/50 rounded-xl bg-secondary/20">
                    <p className="text-xs text-muted-foreground">
                      Página {page} de {totalPages} · {filteredAndSortedCitas.length} resultados
                    </p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 text-xs">Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 text-xs">Siguiente</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA DE CALENDARIO / AGENDA */}
          {vistaModo === 'agenda' && (
            <div className="space-y-4">
              {/* Filtro por empleado para administradores en modo agenda */}
              {(canSeeAll && scope === 'all') && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 sm:max-w-xs">
                    <select
                      value={filtroEmpleado}
                      onChange={e => setFiltroEmpleado(e.target.value)}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-full cursor-pointer"
                    >
                      <option value="">Filtrar todos los estilistas</option>
                      {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </div>
                </div>
              )}
              
              <AgendaCalendario
                citas={citas}
                empleados={empleados}
                filtroEmpleado={filtroEmpleado}
                scope={scope}
                user={user}
                onEditCita={openEdit}
                selectedDateStr={selectedDateStr}
                setSelectedDateStr={setSelectedDateStr}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* VISTA DE DISPONIBILIDAD INTEGRADA */}
          {vistaModo === 'disponibilidad' && (
            <div className="space-y-6">
              
              {/* Controles superiores de Disponibilidad */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-secondary/35 p-1 rounded-xl border border-border/50 self-start">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => {
                      const [year, month, day] = selectedDateStr.split('-').map(Number);
                      const d = new Date(year, month - 1, day);
                      d.setDate(d.getDate() - 1);
                      setSelectedDateStr(d.toISOString().split('T')[0]);
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Input
                    type="date"
                    value={selectedDateStr}
                    onChange={e => setSelectedDateStr(e.target.value)}
                    className="h-8 text-xs font-semibold bg-transparent border-0 focus-visible:ring-0 w-32 cursor-pointer text-foreground pr-0"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => {
                      const [year, month, day] = selectedDateStr.split('-').map(Number);
                      const d = new Date(year, month - 1, day);
                      d.setDate(d.getDate() + 1);
                      setSelectedDateStr(d.toISOString().split('T')[0]);
                    }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 cursor-pointer hover:bg-primary/10 hover:text-primary transition-all" 
                    onClick={() => fetchBloques(selectedDateStr, filtroEmpleado)}
                    title="Actualizar"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                  </Button>
                </div>

                {user?.rol !== 'EMPLEADO' && (
                  <div className="relative flex-1 sm:max-w-xs">
                    <select
                      value={filtroEmpleado}
                      onChange={e => setFiltroEmpleado(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Todos los empleados</option>
                      {empleados.map(e => (
                        <option key={e.id} value={e.id}>{e.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Listado de Personal y Líneas Temporales */}
              <div className="grid grid-cols-1 gap-6">
                {loadingDisp ? (
                  Array.from({ length: 2 }).map((_, idx) => (
                    <Card key={idx} className="p-6 border-border/50 bg-card animate-pulse space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="skeleton h-5 w-40" />
                        <div className="skeleton h-5 w-48" />
                      </div>
                      <div className="skeleton h-10 w-full rounded-lg" />
                    </Card>
                  ))
                ) : empleadosDispData.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm bg-card border border-border/40 rounded-xl">
                    No hay estilistas o personal configurado en el sistema
                  </div>
                ) : (
                  empleadosDispData.map((item: any) => {
                    const emp = item.empleado;
                    const disp = item.disponibilidad;
                    const hasError = !!item.error;
                    
                    const isWorking = disp?.jornada?.activo;
                    const agendaTexto = isWorking
                      ? `Jornada: ${to12h(disp.jornada.inicio)} - ${to12h(disp.jornada.fin)}`
                      : disp?.motivo === 'De vacaciones' ? 'De vacaciones 🏖️' : 'Día libre / No laborable';

                    const ocupados = disp?.intervalosOcupados || [];

                    return (
                      <Card key={emp.id} className="p-6 border-border/40 bg-card/60 shadow-sm space-y-5">
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/30">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-foreground text-lg">{emp.nombre}</h3>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {emp.rol === 'ADMIN' ? 'Administrador' : 'Estilista'}
                              </span>
                            </div>
                            {emp.especialidad && <p className="text-xs text-muted-foreground mt-0.5">{emp.especialidad}</p>}
                          </div>
                          <div className="text-xs font-semibold text-right">
                            <span className={cn(
                              "px-3 py-1 rounded-full",
                              isWorking ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                            )}>
                              {agendaTexto}
                            </span>
                          </div>
                        </div>

                        {hasError ? (
                          <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-xs">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <p>{item.error}</p>
                          </div>
                        ) : !isWorking ? (
                          <div className="flex items-center justify-center p-6 rounded-xl border border-dashed border-border/60 bg-secondary/10">
                            <p className="text-xs text-muted-foreground font-semibold">No labora este día.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Bloques de Horas del Día</p>
                              <div className="flex flex-wrap gap-1 p-2 rounded-xl bg-secondary/15 border border-border/40">
                                {disp.bloques && disp.bloques.map((b: any, idx: number) => {
                                  const label = to12h(b.hora);
                                  
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
                                      title={`${label} - ${b.motivo}`}
                                    >
                                      {b.hora.endsWith(':00') ? (
                                        <span>{parseInt(b.hora.split(':')[0], 10) % 12 || 12}</span>
                                      ) : null}
                                      
                                      <div className="absolute bottom-full mb-1.5 hidden group-hover:block z-50 bg-popover border border-border text-popover-foreground text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                                        <p className="font-bold">{label}</p>
                                        <p className="text-muted-foreground">{b.motivo}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

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
                                        <ClockIcon className="w-3.5 h-3.5 shrink-0" />
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
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

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
                {/* ─── Selector Inteligente de Cliente ──────────────────── */}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Cliente *</label>
                {form.cliente_id ? (
                  /* Cliente ya seleccionado: mostrar tarjeta */
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/30">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-foreground">{form.cliente_nombre}</p>
                        {form.cliente_telefono && (
                          <p className="text-xs text-muted-foreground">{form.cliente_telefono}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev: any) => ({ ...prev, cliente_id: '', cliente_nombre: '', cliente_telefono: '' }));
                        setClienteBusqueda('');
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-md px-2 py-1 transition-colors"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  /* Buscador inteligente */
                  <div className="relative" ref={dropdownRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={clienteBusqueda}
                      onChange={e => {
                        setClienteBusqueda(e.target.value);
                        setClienteDropdownOpen(true);
                        setForm((prev: any) => ({ ...prev, cliente_id: '', cliente_nombre: '', cliente_telefono: '' }));
                      }}
                      onFocus={() => setClienteDropdownOpen(true)}
                      placeholder="Buscar por nombre, teléfono o correo..."
                      className="pl-9"
                      autoComplete="off"
                    />
                    {clienteDropdownOpen && (
                      <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border shadow-xl rounded-xl overflow-hidden">
                        {/* ─── Botón "+ Nuevo Cliente" siempre visible ───── */}
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 bg-primary/5 hover:bg-primary/10 border-b border-border/50 transition-colors group"
                          onClick={() => {
                            setClienteDropdownOpen(false);
                            setFormNuevoCliente({ nombre: clienteBusqueda, telefono: '', correo: '', notas: '' });
                            setPhoneValidCliente(false);
                            setShowCrearCliente(true);
                          }}
                        >
                          <span className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                            <UserPlus className="w-3.5 h-3.5 text-primary" />
                          </span>
                          <span className="text-sm font-semibold text-primary">+ Nuevo Cliente</span>
                        </button>

                        {clientesFiltrados.length > 0 ? (
                          <ul className="divide-y divide-border/40 max-h-48 overflow-y-auto">
                            {clientesFiltrados.map(c => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  className="w-full text-left px-4 py-2.5 hover:bg-secondary/40 transition-colors"
                                  onClick={() => {
                                    setForm((prev: any) => ({
                                      ...prev,
                                      cliente_id: c.id,
                                      cliente_nombre: c.nombre,
                                      cliente_telefono: c.telefono || '',
                                    }));
                                    setClienteBusqueda(c.nombre);
                                    setClienteDropdownOpen(false);
                                  }}
                                >
                                  <p className="text-sm font-semibold text-foreground">{c.nombre}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {[c.telefono, c.correo].filter(Boolean).join(' · ') || 'Sin contacto registrado'}
                                  </p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="px-4 py-4 text-center space-y-2">
                            <p className="text-sm font-semibold text-muted-foreground">No se encontró el cliente</p>
                            <p className="text-xs text-muted-foreground">Usa el botón de arriba para crearlo aquí mismo.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                      const s = servicios.find(srv => srv.id === val);
                      setForm((prev: any) => ({
                        ...prev,
                        servicio_ids: [...prev.servicio_ids, val],
                        servicio_duraciones: [...prev.servicio_duraciones, s ? s.duracion : 30],
                        hora: '' // Reset selected time
                      }));
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">+ Agregar servicio...</option>
                    {servicios
                      .filter(s => s.activo || form.servicio_ids.includes(s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.nombre} ({s.duracion} min)</option>
                      ))}
                  </select>

                  {form.servicio_ids.length > 0 && (
                    <div className="border border-border/60 rounded-lg p-2.5 space-y-2 bg-secondary/15">
                      {form.servicio_ids.map((id: string, index: number) => {
                        const s = servicios.find(srv => srv.id === id);
                        if (!s) return null;
                        const currentDur = form.servicio_duraciones[index] ?? s.duracion;
                        return (
                          <div key={`${id}-${index}`} className="flex flex-col gap-2 bg-card border border-border/40 p-2.5 rounded-md text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded-full">
                                  {index + 1}
                                </span>
                                <span className="font-medium text-foreground">{s.nombre}</span>
                                {currentDur !== s.duracion && (
                                  <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded font-semibold">
                                    ⏱ personalizado
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setForm((prev: any) => {
                                    const newIds = prev.servicio_ids.filter((_: string, idx: number) => idx !== index);
                                    const newDurs = prev.servicio_duraciones.filter((_: number, idx: number) => idx !== index);
                                    return {
                                      ...prev,
                                      servicio_ids: newIds,
                                      servicio_duraciones: newDurs,
                                      hora: '' // Reset selected time
                                    };
                                  });
                                }}
                                className="text-muted-foreground hover:text-red-500 p-0.5 rounded transition-colors"
                                title="Quitar servicio"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            {/* Control Manual de Duración */}
                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/20 flex-wrap sm:flex-nowrap">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Duración:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newVal = Math.max(5, currentDur - 5);
                                    setForm((prev: any) => {
                                      const newDurs = [...prev.servicio_duraciones];
                                      newDurs[index] = newVal;
                                      return {
                                        ...prev,
                                        servicio_duraciones: newDurs,
                                        hora: ''
                                      };
                                    });
                                  }}
                                  className="p-1 rounded bg-secondary/50 border border-border/50 hover:bg-secondary text-foreground active:scale-95 transition-all"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min="5"
                                  max="240"
                                  value={currentDur}
                                  onChange={(e) => {
                                    const val = Math.max(5, Math.min(240, Number(e.target.value) || 5));
                                    setForm((prev: any) => {
                                      const newDurs = [...prev.servicio_duraciones];
                                      newDurs[index] = val;
                                      return {
                                        ...prev,
                                        servicio_duraciones: newDurs,
                                        hora: ''
                                      };
                                    });
                                  }}
                                  className="w-12 h-7 text-xs text-center bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-bold text-foreground"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newVal = Math.min(240, currentDur + 5);
                                    setForm((prev: any) => {
                                      const newDurs = [...prev.servicio_duraciones];
                                      newDurs[index] = newVal;
                                      return {
                                        ...prev,
                                        servicio_duraciones: newDurs,
                                        hora: ''
                                      };
                                    });
                                  }}
                                  className="p-1 rounded bg-secondary/50 border border-border/50 hover:bg-secondary text-foreground active:scale-95 transition-all"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <span className="text-[10px] text-muted-foreground font-medium">min</span>
                              </div>
                              
                              {/* Presets rápidos */}
                              <div className="flex gap-1">
                                {[5, 10, 15, 30].map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => {
                                      const newVal = Math.min(240, currentDur + p);
                                      setForm((prev: any) => {
                                        const newDurs = [...prev.servicio_duraciones];
                                        newDurs[index] = newVal;
                                        return {
                                          ...prev,
                                          servicio_duraciones: newDurs,
                                          hora: ''
                                        };
                                      });
                                    }}
                                    className="px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold hover:bg-primary/10 active:scale-95 transition-all cursor-pointer"
                                  >
                                    +{p}m
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {(() => {
                        const totalDur = form.servicio_duraciones.reduce((sum: number, dur: number) => sum + dur, 0);
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
                    duracionTotal={form.servicio_duraciones.reduce((sum: number, dur: number) => sum + dur, 0)}
                    selectedTime={form.hora}
                    onTimeSelect={h => setForm((prev: any) => ({ ...prev, hora: h }))}
                  />
                </div>
              )}
              {form.servicio_ids.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3.5 text-sm">
                  <p>
                    <span className="text-muted-foreground">Duración total:</span>{' '}
                    <strong className="text-foreground">
                      {form.servicio_duraciones.reduce((sum: number, dur: number) => sum + dur, 0)}{' '}
                      minutos
                    </strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Precio estimado:</span>{' '}
                    <strong className="text-primary text-base font-bold">
                      {formatColones(
                        form.servicio_ids.reduce((sum: number, id: string) => {
                          const s = servicios.find(srv => srv.id === id);
                          return sum + (s?.precio ? Number(s.precio) : 0);
                        }, 0)
                      )}
                    </strong>
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Notas / Comentarios</label>
                <Input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones o peticiones especiales..." />
              </div>
              {/* Checkbox forzar agendamiento (solo para ADMIN cuando hay conflicto) */}
              {isAdmin && (
                <label className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={forzar}
                    onChange={e => setForzar(e.target.checked)}
                    className="mt-0.5 accent-amber-500 w-4 h-4 flex-shrink-0"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Forzar agendamiento (ignorar conflictos)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Solo disponible para administradores. Se registrará en la auditoría.</p>
                  </div>
                </label>
              )}
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
    </div>
  );

  return (
    <>
      {mainContent}

      {/* ─── Modal inline: Crear Nuevo Cliente ──────────────────────────────── */}
      {showCrearCliente && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-border/50">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground">Nuevo Cliente</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Se seleccionará automáticamente al guardar</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCrearCliente(false)}
                className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCrearCliente} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Nombre completo *
                </label>
                <Input
                  value={formNuevoCliente.nombre}
                  onChange={e => setFormNuevoCliente(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej. María González"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Teléfono <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
                </label>
                <PhoneInput
                  value={formNuevoCliente.telefono}
                  optional={true}
                  onChange={(formattedVal, isValid) => {
                    setFormNuevoCliente(prev => ({ ...prev, telefono: formattedVal }));
                    setPhoneValidCliente(isValid);
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Correo electrónico <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
                </label>
                <Input
                  type="email"
                  value={formNuevoCliente.correo}
                  onChange={e => setFormNuevoCliente(prev => ({ ...prev, correo: e.target.value }))}
                  placeholder="maria@ejemplo.com"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Notas <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
                </label>
                <textarea
                  value={formNuevoCliente.notas}
                  onChange={e => setFormNuevoCliente(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Alergias, preferencias, referencias..."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-border/30">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCrearCliente(false)}
                  disabled={savingCliente}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingCliente} className="glow-gold gap-1.5">
                  <UserPlus className="w-4 h-4" />
                  {savingCliente ? 'Creando...' : 'Crear y Seleccionar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
