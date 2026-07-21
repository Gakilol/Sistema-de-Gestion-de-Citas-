'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Edit, Trash2, X, Search, MessageCircle, CheckCircle2, Minus, AlertTriangle, UserPlus, UserCheck, Calendar as CalendarIcon, List as ListIcon, Clock as ClockIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { TimeSelector } from '@/components/citas/TimeSelector';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn, formatTo12h } from '@/lib/utils';
import { urlWhatsAppConfirmacion, urlWhatsAppRecordatorio } from '@/lib/whatsapp';
import { formatDBDate, getBusinessTodayString, getDefaultBookingDate, getDefaultAgendaDate } from '@/lib/timezone';
import { useAuth } from '@/components/providers/auth-provider';
import { AgendaCalendario } from '@/components/citas/AgendaCalendario';
import { CitaResumenModal } from '@/components/citas/CitaResumenModal';
import { CitaDetalleBottomSheet } from '@/components/citas/CitaDetalleBottomSheet';
import { CitaCreadaConfirmacion } from '@/components/citas/CitaCreadaConfirmacion';

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

import { formatHora12h } from '@/lib/time-utils';

// Helper local para convertir "HH:MM" a formato 12 horas AM/PM
function to12h(timeStr: string): string {
  return formatHora12h(timeStr);
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

function CitasContent() {
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
  const [vistaModo, setVistaModo] = useState<'lista' | 'agenda'>('agenda');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  // Fecha predeterminada: hoy antes de las 18:30 CR, mañana desde las 18:30.
  // getDefaultAgendaDate() usa America/Costa_Rica vía Intl — funciona igual
  // en localhost, Vercel (UTC), iOS, Android y usuarios de otro país.
  const [selectedDateStr, setSelectedDateStr] = useState(getDefaultAgendaDate());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [citaToDelete, setCitaToDelete] = useState<any>(null);
  const [deleteOrigen, setDeleteOrigen] = useState<'agenda' | 'lista'>('agenda');
  const [isDeleting, setIsDeleting] = useState(false);
  const [citaResumen, setCitaResumen] = useState<any>(null);
  const [citaCreada, setCitaCreada] = useState<any>(null);
  // Overrides optimistas para posición visual de citas siendo movidas/redimensionadas
  const [localCitaOverrides, setLocalCitaOverrides] = useState<Record<string, { fecha?: string; hora?: string; duracion?: number; empleado_id?: string }>>({});

  const { user }                  = useAuth();


  const isAdmin                   = user?.rol === 'ADMIN';
  const isTechSupport             = user?.rol === 'TECH_SUPPORT';
  const canSeeAll                 = isAdmin || isTechSupport;

  const searchParams = useSearchParams();

  useEffect(() => {
    if (servicios.length > 0 && empleados.length > 0 && clientesList.length > 0) {
      const qClienteId = searchParams.get('clienteId');
      const qServicioId = searchParams.get('servicioId');
      const qEmpleadoId = searchParams.get('empleadoId');

      if (qClienteId || qServicioId || qEmpleadoId) {
        const client = clientesList.find(c => c.id === qClienteId);
        const employee = empleados.find(e => e.id === qEmpleadoId);
        const service = servicios.find(s => s.id === qServicioId);

        const newForm = { ...getEmptyForm() };
        newForm.fecha = getDefaultBookingDate();

        if (client) {
          newForm.cliente_id = client.id;
          newForm.cliente_nombre = client.nombre;
          newForm.cliente_telefono = client.telefono || '';
          setClienteBusqueda(client.nombre);
        }

        if (employee) {
          newForm.empleado_id = employee.id;
        } else {
          if (user?.rol === 'EMPLEADO') {
            newForm.empleado_id = user.id || '';
          } else {
            const isLogueadoAgendable = empleados.some(e => e.id === user?.id);
            if (isLogueadoAgendable && user?.id) {
              newForm.empleado_id = user.id;
            } else {
              newForm.empleado_id = empleados[0]?.id || '';
            }
          }
        }

        if (service) {
          newForm.servicio_id = service.id;
          newForm.servicio_ids = [service.id];
          newForm.servicio_duraciones = [service.duracion];
        }

        setForm(newForm);
        setEditingId(null);
        setForzar(false);
        setShowModal(true);

        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, servicios, empleados, clientesList, user]);

  // ─── Estado para modal inline de nuevo cliente ─────────────────────────
  const [showCrearCliente, setShowCrearCliente] = useState(false);
  const [formNuevoCliente, setFormNuevoCliente] = useState({ nombre: '', telefono: '', correo: '', notas: '' });
  const [savingCliente, setSavingCliente]       = useState(false);
  const [phoneValidCliente, setPhoneValidCliente] = useState(true);

  // Estado para el buscador inteligente de clientes
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [forzar, setForzar]       = useState(false);
  const [showOverlapModal, setShowOverlapModal] = useState(false);
  const [overlapConflicts, setOverlapConflicts] = useState<any[]>([]);
  const [selectedOverlapReason, setSelectedOverlapReason] = useState('Cliente en tiempo de espera');
  const [customOverlapReason, setCustomOverlapReason] = useState('');

  useEffect(() => {
    if (showModal || showCrearCliente || showOverlapModal || showDeleteModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal, showCrearCliente, showOverlapModal, showDeleteModal]);

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


  const fetchCatalogos = async () => {
    const [sR, eR, cR] = await Promise.all([
      fetch('/api/servicios'),
      fetch('/api/empleados?schedulable=true'),
      fetch('/api/clientes')
    ]);
    const sD = await sR.json();
    const eD = await eR.json();
    const cD = await cR.json();
    
    setServicios(sD.servicios || []);
    setEmpleados(eD.empleados || []);
    setClientesList(cD.clientes || []);
  };

  useEffect(() => {
    if (user?.rol === 'TECH_SUPPORT') {
      setScope('all');
    }
  }, [user]);

  // Carga reactiva de citas en base al scope y filtro de empleado
  useEffect(() => {
    fetchCitas(scope, filtroEmpleado);
  }, [scope, filtroEmpleado]);


  useEffect(() => {
    fetchCatalogos();
  }, []);

  const handleSearch = (val: string) => {
    setBusqueda(val);
    setPage(1);
  };

  const openCreate = () => {
    const activeServs = servicios.filter(s => s.activo);
    if (!activeServs.length || !empleados.length) {
      toast.error('Crea al menos un servicio y un empleado activos primero');
      return;
    }
    const emptyForm = getEmptyForm();
    emptyForm.fecha = getDefaultBookingDate();
    
    // Seleccionar por defecto el colaborador logueado si es agendable (o si es Empleado, forzosamente él mismo), de lo contrario el primero disponible
    if (user?.rol === 'EMPLEADO') {
      emptyForm.empleado_id = user.id || '';
    } else {
      const isLogueadoAgendable = empleados.some(e => e.id === user?.id);
      if (isLogueadoAgendable && user?.id) {
        emptyForm.empleado_id = user.id;
      } else {
        emptyForm.empleado_id = empleados[0]?.id || '';
      }
    }

    setForm(emptyForm);
    setClienteBusqueda('');
    setForzar(false);
    setEditingId(null);
    setShowModal(true);
  };

  const openCreateFromSlot = ({ date, time, empleadoId, durationMinutes }: { date: string; time: string; empleadoId: string; durationMinutes: number }) => {
    const activeServs = servicios.filter(s => s.activo);
    if (!activeServs.length || !empleados.length) {
      toast.error('Crea al menos un servicio y un empleado activos primero');
      return;
    }
    const emptyForm = getEmptyForm();
    emptyForm.fecha = date;
    emptyForm.hora = time;
    emptyForm.empleado_id = empleadoId;
    emptyForm.servicio_id = '';
    emptyForm.servicio_ids = [];
    emptyForm.servicio_duraciones = durationMinutes ? [durationMinutes] : [];
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

  const handleSubmit = async (e?: React.FormEvent, bypassOverlap = false) => {
    if (e) e.preventDefault();
    if (saving) return;
    if (!form.servicio_ids || form.servicio_ids.length === 0) {
      toast.error('Selecciona al menos un servicio');
      return;
    }
    if (!form.hora) {
      toast.error('Selecciona una hora');
      return;
    }
    if (!form.cliente_id && !form.cliente_nombre?.trim()) {
      toast.error('Debes seleccionar o ingresar un cliente');
      return;
    }
    setSaving(true);
    const reasonText = selectedOverlapReason === 'Otro' ? customOverlapReason : selectedOverlapReason;
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
      allowOverlap: bypassOverlap,
      overlapReason: bypassOverlap ? reasonText : null,
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
        if (res.status === 409 && d.type === 'SCHEDULE_OVERLAP') {
          setOverlapConflicts(d.conflicts || []);
          setShowOverlapModal(true);
          setSaving(false);
          return;
        }
        throw new Error(d.error);
      }
      const d = await res.json();
      if (d.warning) {
        toast.warning(d.warning, { duration: 8000 });
      }
      toast.success(editingId ? 'Cita actualizada' : 'Cita creada exitosamente');
      setShowModal(false);
      setShowOverlapModal(false);
      setForzar(false);
      if (!editingId && d.cita) setCitaCreada(d.cita);
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

  const confirmDelete = (cita: any, origen: 'agenda' | 'lista') => {
    const hasPermission = user?.rol === 'ADMIN' || user?.rol === 'TECH_SUPPORT' || (user?.rol === 'EMPLEADO' && cita.created_by === user.id);
    if (!hasPermission) {
      toast.error('No tienes permiso para eliminar esta cita');
      return;
    }
    setCitaToDelete(cita);
    setDeleteOrigen(origen);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (!citaToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/citas/${citaToDelete.id}?origen=${deleteOrigen}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar la cita');
      }
      toast.success('Cita eliminada exitosamente');
      setShowDeleteModal(false);
      setCitaToDelete(null);
      setShowModal(false);
      fetchCitas();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar la cita');
    } finally {
      setIsDeleting(false);
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

  // ─── Mover / Redimensionar cita desde el calendario (Drag & Drop / Resize) ──
  const handleMoveCita = async (params: {
    citaId: string;
    fecha: string;
    hora: string;
    empleadoId: string;
    duracion: number;
    clientUpdatedAt: string;
  }): Promise<{ error?: string; type?: string; conflicts?: any[] } | void> => {
    const { citaId, fecha, hora, empleadoId, duracion, clientUpdatedAt } = params;

    // ── 1. Snapshot anterior (para posible rollback) ──────────────────────────
    const citaAnterior = citas.find(c => c.id === citaId);
    if (!citaAnterior) return { error: 'Cita no encontrada en el estado local' };

    const prevOverride = localCitaOverrides[citaId];
    const prevFecha = citaAnterior._overrideFecha || new Date(citaAnterior.fecha).toISOString().split('T')[0];
    const prevHora  = prevOverride?.hora      ?? citaAnterior.hora;
    const prevDur   = prevOverride?.duracion  ?? citaAnterior.duracion;
    const prevEmpId = prevOverride?.empleado_id ?? citaAnterior.empleado_id;

    // ── 2. Optimistic UI ─────────────────────────────────────────────────────
    setLocalCitaOverrides(prev => ({
      ...prev,
      [citaId]: { fecha, hora, duracion, empleado_id: empleadoId },
    }));

    try {
      const res = await fetch(`/api/citas/${citaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          hora,
          empleado_id: empleadoId,
          duracion,
          clientUpdatedAt,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // ── Rollback ─────────────────────────────────────────────────────────
        setLocalCitaOverrides(prev => ({
          ...prev,
          [citaId]: { fecha: prevFecha, hora: prevHora, duracion: prevDur, empleado_id: prevEmpId },
        }));

        if (res.status === 409 && data.type === 'CONCURRENT_EDIT') {
          toast.error('⚡ Esta cita fue modificada por otra persona. Recargando...', { duration: 5000 });
          fetchCitas();
          return { error: data.message, type: 'CONCURRENT_EDIT' };
        }

        if (res.status === 409 && data.type === 'SCHEDULE_OVERLAP') {
          toast.warning(
            `⚠️ Solapamiento: ${data.message || 'El horario se cruza con otra cita.'}`,
            { duration: 6000 }
          );
          return { error: data.message, type: 'SCHEDULE_OVERLAP', conflicts: data.conflicts };
        }

        const errorMsg = data.error || 'Error al actualizar la cita';
        toast.error(errorMsg, { id: `move-cita-error-${citaId}` });
        return { error: errorMsg };
      }

      // ── Éxito: actualizar el array de citas con los nuevos valores ────────
      if (data.warning) {
        toast.warning(data.warning, { duration: 8000 });
      }

      // Actualizar cita en el estado local con los datos reales del servidor
      setCitas(prev => prev.map(c => {
        if (c.id !== citaId) return c;
        return {
          ...c,
          hora: data.cita?.hora ?? hora,
          duracion: data.cita?.duracion ?? duracion,
          empleado_id: data.cita?.empleado_id ?? empleadoId,
          updated_at: data.cita?.updated_at ?? c.updated_at,
          // Actualizar la fecha como ISO string con la nueva fecha
          fecha: data.cita?.fecha ?? c.fecha,
        };
      }));

      // Limpiar el override optimista ya que el estado real fue confirmado
      setLocalCitaOverrides(prev => {
        const next = { ...prev };
        delete next[citaId];
        return next;
      });

      return; // éxito, sin error
    } catch (err: any) {
      // ── Rollback en caso de error de red ─────────────────────────────────
      setLocalCitaOverrides(prev => ({
        ...prev,
        [citaId]: { fecha: prevFecha, hora: prevHora, duracion: prevDur, empleado_id: prevEmpId },
      }));
      toast.error('Error de conexión al actualizar la cita');
      return { error: err.message };
    }
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
    <div className="flex min-h-screen bg-background overflow-x-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-5 page-enter overflow-x-hidden">

          {/* Header */}
          <div className="flex flex-row items-center justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Gestión de Citas</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {vistaModo === 'lista' && `${filteredAndSortedCitas.length} de `}
                {citas.length} cita{citas.length !== 1 ? 's' : ''} en total
              </p>
            </div>
            <Button onClick={openCreate} className="gap-1.5 glow-gold h-9 px-3 text-xs sm:text-sm shrink-0 min-h-[38px]">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nueva Cita</span><span className="sm:hidden">Nueva</span>
            </Button>
          </div>

          {/* Barra de Vista e Integración de Scope (Fila Única en Móvil y Escritorio) */}
          <div className="flex flex-row items-center justify-between gap-1 sm:gap-2.5 border-b border-border/30 pb-2 sm:pb-3 w-full flex-nowrap overflow-x-auto no-scrollbar">
            {/* Selector de Pestaña Principal (Modo) */}
            <div className="flex bg-secondary/30 p-0.5 rounded-xl border border-border/50 shrink-0">
              <button
                type="button"
                onClick={() => setVistaModo('lista')}
                className={cn(
                  "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer min-h-[32px] sm:min-h-[34px]",
                  vistaModo === 'lista'
                    ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <ListIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span>Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setVistaModo('agenda')}
                className={cn(
                  "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer min-h-[32px] sm:min-h-[34px]",
                  vistaModo === 'agenda'
                    ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <CalendarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span>Agenda</span>
              </button>
            </div>

            {/* Switch de Scope (Mis Citas vs Ver Todas / Ver mi agenda vs Ver agenda de todos) */}
            {canSeeAll && (
              <div className="flex bg-secondary/30 p-0.5 rounded-xl border border-border/50 shadow-inner shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setScope('mine');
                    setFiltroEmpleado('');
                  }}
                  className={cn(
                    "px-2 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer min-h-[32px] sm:min-h-[34px] whitespace-nowrap",
                    scope === 'mine'
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  {vistaModo === 'agenda' ? 'Mi agenda' : 'Mis Citas'}
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={cn(
                    "px-2 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer min-h-[32px] sm:min-h-[34px] whitespace-nowrap",
                    scope === 'all'
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  {vistaModo === 'agenda' ? 'Agenda de todos' : 'Ver Todas'}
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
                          {['Cliente', 'Servicios', 'Empleado', 'Fecha y Hora', 'Estado', 'Acciones'].map(h => (
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
                            <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                              {busqueda || filtroEstado || filtroEmpleado ? 'Sin resultados para los filtros aplicados' : 'No hay citas registradas'}
                            </td>
                          </tr>
                        ) : paginated.map((cita) => {
                          const waUrl = cita.cliente_telefono
                            ? (cita.estado === 'PENDIENTE'
                                ? urlWhatsAppRecordatorio({
                                    cliente_nombre: cita.cliente_nombre,
                                    cliente_telefono: cita.cliente_telefono,
                                    servicio: cita.servicio?.nombre || '',
                                    empleado: cita.empleado?.nombre || '',
                                    empleado_id: cita.empleado_id,
                                    empleado_email: cita.empleado?.correo || null,
                                    empleado_titulo: cita.empleado?.tituloCliente || null,
                                    fecha: cita.fecha,
                                    hora: cita.hora,
                                  })
                                : urlWhatsAppConfirmacion({
                                    cliente_nombre: cita.cliente_nombre,
                                    cliente_telefono: cita.cliente_telefono,
                                    servicio: cita.servicio?.nombre || '',
                                    empleado: cita.empleado?.nombre || '',
                                    empleado_id: cita.empleado_id,
                                    empleado_email: cita.empleado?.correo || null,
                                    empleado_titulo: cita.empleado?.tituloCliente || null,
                                    fecha: cita.fecha,
                                    hora: cita.hora,
                                  })
                              )
                            : null;
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
                                  {to12h(cita.hora)} · {cita.duracion} min
                                  {isPersonalizado && (
                                    <span className="block text-[10px] text-amber-500 font-bold mt-0.5" title="Duración modificada manualmente">
                                      ⏱ personalizado
                                    </span>
                                  )}
                                </p>
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
                                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => openEdit(cita)} title="Editar Cita">
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  {(user?.rol === 'ADMIN' || user?.rol === 'TECH_SUPPORT' || (user?.rol === 'EMPLEADO' && cita.created_by === user.id)) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                      onClick={() => confirmDelete(cita, 'lista')}
                                      title="Eliminar Cita"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                  {waUrl && (
                                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#25D366] hover:text-[#1ebe5a] hover:bg-[#25D366]/10 cursor-pointer" title="Contactar por WhatsApp">
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
                      const waUrl = cita.cliente_telefono
                            ? (cita.estado === 'PENDIENTE'
                                ? urlWhatsAppRecordatorio({
                                    cliente_nombre: cita.cliente_nombre,
                                    cliente_telefono: cita.cliente_telefono,
                                    servicio: cita.servicio?.nombre || '',
                                    empleado: cita.empleado?.nombre || '',
                                    empleado_id: cita.empleado_id,
                                    empleado_email: cita.empleado?.correo || null,
                                    empleado_titulo: cita.empleado?.tituloCliente || null,
                                    fecha: cita.fecha,
                                    hora: cita.hora,
                                  })
                                : urlWhatsAppConfirmacion({
                                    cliente_nombre: cita.cliente_nombre,
                                    cliente_telefono: cita.cliente_telefono,
                                    servicio: cita.servicio?.nombre || '',
                                    empleado: cita.empleado?.nombre || '',
                                    empleado_id: cita.empleado_id,
                                    empleado_email: cita.empleado?.correo || null,
                                    empleado_titulo: cita.empleado?.tituloCliente || null,
                                    fecha: cita.fecha,
                                    hora: cita.hora,
                                  })
                              )
                            : null;
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
                              <span className="text-muted-foreground">· {to12h(cita.hora)}</span>
                            </div>
                            <div className="flex gap-1.5 flex-wrap justify-end">
                              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1 cursor-pointer" onClick={() => openEdit(cita)}>
                                <Edit className="w-3.5 h-3.5" /> Editar
                              </Button>
                              {(user?.rol === 'ADMIN' || user?.rol === 'TECH_SUPPORT' || (user?.rol === 'EMPLEADO' && cita.created_by === user.id)) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
                                  onClick={() => confirmDelete(cita, 'lista')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                </Button>
                              )}
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
                onViewCita={(cita) => setCitaResumen(cita)}
                onSlotClick={openCreateFromSlot}
                onMoveCita={handleMoveCita}
                localCitaOverrides={localCitaOverrides}
                selectedDateStr={selectedDateStr}
                setSelectedDateStr={setSelectedDateStr}
                isLoading={isLoading}
                isModalOpen={showModal}
              />
            </div>
          )}

        </div>
      </main>

      {/* Modal Principal de Cita */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <Card className="w-full max-w-lg p-0 relative max-h-[90dvh] sm:max-h-[90vh] flex flex-col border-border/50 shadow-2xl rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl overflow-hidden bg-card">
            
            {/* Tirador táctil superior para móvil */}
            <div className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-0 sm:hidden shrink-0" />

            {/* Header del modal */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/40 shrink-0 bg-secondary/10">
              <h2 className="text-base sm:text-lg font-bold text-foreground">{editingId ? 'Editar Cita' : 'Nueva Cita'}</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-11 w-11 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form id="cita-form" onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 gap-3.5">

                {/* ─── Selector Inteligente de Cliente ──────────────────── */}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Cliente *</label>
                {form.cliente_id || form.cliente_nombre ? (
                  /* Cliente seleccionado (registrado u ocasional) */
                  <div className={cn(
                    "flex items-center justify-between gap-2 p-3 rounded-xl border transition-all",
                    form.cliente_id 
                      ? "bg-emerald-500/8 border-emerald-500/30" 
                      : "bg-amber-500/8 border-amber-500/30"
                  )}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {form.cliente_id ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-foreground truncate">{form.cliente_nombre}</p>
                          {!form.cliente_id && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0">
                              cliente ocasional
                            </span>
                          )}
                        </div>
                        {form.cliente_telefono ? (
                          <p className="text-xs text-muted-foreground">{form.cliente_telefono}</p>
                        ) : !form.cliente_id ? (
                          <p className="text-xs text-muted-foreground">Sin teléfono o correo registrado</p>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev: any) => ({ ...prev, cliente_id: '', cliente_nombre: '', cliente_telefono: '' }));
                        setClienteBusqueda('');
                      }}
                      className="min-h-11 text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-md px-3 py-1 transition-colors shrink-0"
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
                        {/* ─── Acciones de Creación / Agendamiento Rápido ───── */}
                        <div className="p-2 bg-muted/20 border-b border-border/50 flex flex-row flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="flex-1 min-w-[120px] text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-lg px-2.5 py-2 flex items-center justify-center gap-1.5 transition-colors group shrink-0"
                            onClick={() => {
                              setClienteDropdownOpen(false);
                              setFormNuevoCliente({ nombre: clienteBusqueda, telefono: '', correo: '', notas: '' });
                              setPhoneValidCliente(false);
                              setShowCrearCliente(true);
                            }}
                          >
                            <UserPlus className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">+ Nuevo Cliente</span>
                          </button>

                          <button
                            type="button"
                            disabled={!clienteBusqueda.trim()}
                            className="flex-1 min-w-[140px] text-xs font-semibold text-foreground bg-secondary hover:bg-secondary/80 border border-border/60 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2.5 py-2 flex items-center justify-center gap-1.5 transition-colors group shrink-0"
                            onClick={() => {
                              const nombreLimpio = clienteBusqueda.trim();
                              if (!nombreLimpio) return;
                              setForm((prev: any) => ({
                                ...prev,
                                cliente_id: '',
                                cliente_nombre: nombreLimpio,
                                cliente_telefono: '',
                              }));
                              setClienteDropdownOpen(false);
                            }}
                            title={!clienteBusqueda.trim() ? "Escriba un nombre en el buscador primero" : "Agendar cita utilizando solo el nombre"}
                          >
                            <UserCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="truncate">Agendar solo con nombre</span>
                          </button>
                        </div>

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
                      setForm((prev: any) => {
                        const isFirstWithSlotDuration = prev.servicio_ids.length === 0 && prev.servicio_duraciones.length === 1;
                        const newDurations = isFirstWithSlotDuration
                          ? [prev.servicio_duraciones[0]]
                          : [...prev.servicio_duraciones, s ? s.duracion : 30];
                        return {
                          ...prev,
                          servicio_ids: [...prev.servicio_ids, val],
                          servicio_duraciones: newDurations,
                        };
                      });
                    }}
                      className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">+ Agregar servicio...</option>
                    {servicios
                      .filter(s => s.activo || form.servicio_ids.includes(s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.nombre} ({s.duracion} min)</option>
                      ))}
                  </select>

                  {form.servicio_ids.length > 0 ? (
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
                                      };
                                    });
                                  }}
                                  className="size-11 rounded bg-secondary/50 border border-border/50 hover:bg-secondary text-foreground active:scale-95 transition-all"
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
                                      };
                                    });
                                  }}
                                  className="h-11 w-14 text-xs text-center bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-bold text-foreground"
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
                                      };
                                    });
                                  }}
                                  className="size-11 rounded bg-secondary/50 border border-border/50 hover:bg-secondary text-foreground active:scale-95 transition-all"
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
                  ) : (
                    <div className="p-3 border border-dashed border-border/60 rounded-lg text-xs text-muted-foreground italic text-center bg-secondary/10">
                      No se ha seleccionado ningún servicio. Selecciona al menos uno.
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
                  disabled={user?.rol === 'EMPLEADO'}
                  className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  <option value="">Seleccionar empleado...</option>
                  {/* Permitimos el empleado actual si estamos editando, e incluimos solo empleados ACTIVOS y no Soporte Técnico para nuevas citas */}
                  {empleados
                    .filter(e => (e.activo && e.rol !== 'TECH_SUPPORT') || e.id === form.empleado_id)
                    .map(e => (
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
                  className="min-h-11"
                />
              </div>
              {form.fecha && form.empleado_id && (
                <div className="bg-secondary/30 border border-border/50 rounded-xl p-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-3">Selecciona la Hora *</label>
                  <TimeSelector
                    empleadoId={form.empleado_id}
                    fecha={form.fecha}
                    servicioId={form.servicio_ids[0]}
                    duracionTotal={form.servicio_duraciones.reduce((sum: number, dur: number) => sum + dur, 0)}
                    selectedTime={form.hora}
                    onTimeSelect={h => setForm((prev: any) => ({ ...prev, hora: h }))}
                    excludeCitaId={editingId}
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
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Notas / Comentarios</label>
                <Input className="min-h-11" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones o peticiones especiales..." />
              </div>
            </form>

            {/* Sticky Bottom Actions Bar */}
              <div className="shrink-0 border-t border-border/40 p-4 sm:p-5 bg-card pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 z-30">
              <div>
                {editingId && (() => {
                  const currentCita = citas.find(c => c.id === editingId);
                  const canDelete = user?.rol === 'ADMIN' || user?.rol === 'TECH_SUPPORT' || (user?.rol === 'EMPLEADO' && currentCita?.created_by === user.id);
                  if (canDelete) {
                    return (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => confirmDelete(currentCita, 'agenda')}
                        className="cursor-pointer font-bold gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground h-11 text-xs sm:text-sm px-3"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Eliminar Cita</span>
                        <span className="sm:hidden">Eliminar</span>
                      </Button>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex items-center gap-2.5 ml-auto">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="h-11 px-4 text-sm font-semibold cursor-pointer">
                  Cancelar
                </Button>
                <Button type="submit" form="cita-form" disabled={saving} className="glow-gold h-11 px-5 text-sm font-bold cursor-pointer">
                  {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear Cita')}
                </Button>
              </div>
            </div>
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
        <div className="fixed inset-0 bg-black/75 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-full max-w-md bg-card border border-border/50 rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[90vh] pb-safe overflow-hidden">
            
            {/* Tirador táctil superior para móvil */}
            <div className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-0 sm:hidden shrink-0" />

            {/* Header */}
            <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-border/50 shrink-0">
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
            <form onSubmit={handleCrearCliente} className="min-h-0 p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
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

              <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
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

      {/* ─── Modal: Confirmación de Traslape Controlado ────────────────────────── */}
      {showOverlapModal && (
        <div className="fixed inset-0 bg-black/75 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card border border-border/50 rounded-t-2xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[90vh] pb-safe">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-border/50 bg-amber-500/5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground">Advertencia de Traslape</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Existe una cita en este horario. ¿Desea crearla como cita intercalada?</p>
              </div>
              <button
                type="button"
                onClick={() => setShowOverlapModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain custom-scrollbar">
              <div className="text-sm space-y-2.5">
                <p className="text-muted-foreground leading-relaxed">
                  Este horario se cruza con la siguiente cita del mismo profesional:
                </p>

                {overlapConflicts.map((c, idx) => (
                  <div key={c.appointmentId || idx} className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-1.5 shadow-inner">
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Cita en Conflicto</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-2 text-xs">
                      <span className="text-muted-foreground font-semibold">Cliente: <span className="font-bold text-foreground">{c.clientName}</span></span>
                      <span className="text-muted-foreground font-semibold">Servicio: <span className="font-semibold text-foreground">{c.serviceName}</span></span>
                      <span className="text-muted-foreground font-semibold">Horario: <span className="font-semibold text-foreground tabular-nums">{to12h(c.startTime)} - {to12h(c.endTime)}</span></span>
                      <span className="text-muted-foreground font-semibold">Profesional: <span className="font-semibold text-foreground">{c.professionalName}</span></span>
                    </div>
                  </div>
                ))}

                <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/20 pt-3">
                  ¿Desea crearla como cita intercalada? Confirme si el profesional puede atender ambas citas por tiempos de espera, servicios rápidos o traslape controlado.
                </p>
              </div>

              {/* Selector de Motivos */}
              <div className="space-y-2 border-t border-border/20 pt-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">
                  Selecciona el Motivo
                </label>
                <select
                  value={selectedOverlapReason}
                  onChange={e => setSelectedOverlapReason(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="Cliente en tiempo de espera">Cliente en tiempo de espera</option>
                  <option value="Servicio rápido">Servicio rápido</option>
                  <option value="Tinte/decoloración en proceso">Tinte/decoloración en proceso</option>
                  <option value="Confirmado manualmente por el profesional">Confirmado manualmente por el profesional</option>
                  <option value="Otro">Otro (especificar abajo)</option>
                </select>
              </div>

              {selectedOverlapReason === 'Otro' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">
                    Especificar motivo *
                  </label>
                  <Input
                    value={customOverlapReason}
                    onChange={e => setCustomOverlapReason(e.target.value)}
                    placeholder="Ej. Tiempo libre del estilista..."
                    required
                  />
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 p-4 sm:p-5 border-t border-border/30 bg-secondary/10 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowOverlapModal(false)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowOverlapModal(false);
                }}
                className="w-full sm:w-auto text-foreground"
              >
                Cambiar horario
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit(undefined, true)}
                disabled={saving || (selectedOverlapReason === 'Otro' && !customOverlapReason.trim())}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 border-amber-600 hover:border-amber-700 text-white font-bold"
              >
                {saving ? 'Guardando...' : 'Guardar como cita intercalada'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Confirmación de Eliminación de Cita ────────────────────────── */}
      {showDeleteModal && citaToDelete && (
        <div className="fixed inset-0 bg-black/75 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border/50 rounded-t-2xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[90vh] pb-safe">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-border/50 bg-destructive/5 shrink-0">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Confirmar Eliminación</h3>
                <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer</p>
              </div>
            </div>

            {/* Content */}
            <div className="min-h-0 p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
              <p className="text-sm text-foreground font-medium">
                ¿Seguro que deseas eliminar esta cita?
              </p>

              {/* Detail list formatted beautifully */}
              <div className="rounded-xl border border-border/60 bg-secondary/15 p-4 space-y-2.5">
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider">Cliente:</span>
                  <span className="col-span-2 text-foreground font-bold">{citaToDelete.cliente_nombre}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider">Profesional:</span>
                  <span className="col-span-2 text-foreground font-medium">{citaToDelete.empleado?.nombre || 'No asignado'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider">Fecha:</span>
                  <span className="col-span-2 text-foreground font-medium">{fmtDate(citaToDelete.fecha)}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider">Hora:</span>
                  <span className="col-span-2 text-foreground font-medium">{to12h(citaToDelete.hora)} ({citaToDelete.duracion} min)</span>
                </div>
                {citaToDelete.notas && (
                  <div className="grid grid-cols-3 gap-1.5 text-xs border-t border-border/20 pt-2">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider">Notas:</span>
                    <span className="col-span-2 text-muted-foreground italic">{citaToDelete.notas}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 bg-secondary/10 border-t border-border/50 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setCitaToDelete(null);
                }}
                disabled={isDeleting}
                className="cursor-pointer flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={executeDelete}
                disabled={isDeleting}
                className="cursor-pointer font-bold gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm flex-1 sm:flex-none"
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar Cita'}
              </Button>
            </div>
          </div>
        </div>
      )}



      {/* Bottom Sheet de Detalle de Cita */}
      <CitaDetalleBottomSheet
        open={!!citaResumen}
        onOpenChange={(open) => {
          if (!open) setCitaResumen(null);
        }}
        cita={citaResumen}
        user={user}
        onEdit={(cita) => {
          setCitaResumen(null);
          openEdit(cita);
        }}
      />

      <CitaCreadaConfirmacion
        cita={citaCreada}
        open={!!citaCreada}
        onClose={() => setCitaCreada(null)}
        onEdit={(cita) => {
          setCitaCreada(null);
          openEdit(cita);
        }}
      />
    </>
  );
}

export default function Citas() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
          <p className="text-sm text-muted-foreground">Cargando citas...</p>
        </div>
      </div>
    }>
      <CitasContent />
    </Suspense>
  );
}
