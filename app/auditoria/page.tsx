'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Clock, Users, Calendar, Download, Loader2, AlertCircle, ArrowLeft, ArrowRight,
  Info, RefreshCw, CheckCircle, XCircle, ShieldAlert, Key, Database, Settings,
  Eye, Copy, Check, Filter, Layers, ListFilter
} from 'lucide-react';
import { toast } from 'sonner';

// Tab definitions
type AuditTab = 'resumen' | 'actividad' | 'seguridad' | 'cambios' | 'roles' | 'citas' | 'configuracion' | 'exportar';

const TABS: { id: AuditTab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen', label: 'Resumen', icon: Layers },
  { id: 'actividad', label: 'Actividad Reciente', icon: Clock },
  { id: 'seguridad', label: 'Seguridad', icon: ShieldAlert },
  { id: 'cambios', label: 'Cambios de Datos', icon: RefreshCw },
  { id: 'roles', label: 'Usuarios y Roles', icon: Users },
  { id: 'citas', label: 'Citas', icon: Calendar },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
  { id: 'exportar', label: 'Exportar Historial', icon: Download }
];

export default function AuditoriaPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Filters State
  const [tab, setTab] = useState<AuditTab>('resumen');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(20);
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Specific filters
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);

  // Data State
  const [summaryData, setSummaryData] = useState<any>(null);
  const [logsData, setLogsData] = useState<any>(null);
  const [securityData, setSecurityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal / Detail state
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch KPI Summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/auditoria/resumen');
      if (!res.ok) throw new Error('Error al cargar resumen');
      const data = await res.json();
      setSummaryData(data);
    } catch (e: any) {
      toast.error('No se pudo cargar el resumen de KPIs.');
    }
  }, []);

  // Fetch Security Stats
  const fetchSecurity = useCallback(async () => {
    try {
      const res = await fetch('/api/auditoria/seguridad');
      if (!res.ok) throw new Error('Error al cargar seguridad');
      const data = await res.json();
      setSecurityData(data);
    } catch (e: any) {
      toast.error('No se pudo cargar la auditoría de seguridad.');
    }
  }, []);

  // Fetch Logs (General Table with filters)
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query string
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        from: desde,
        to: hasta,
        ...(search ? { search } : {}),
        ...(moduleFilter ? { module: moduleFilter } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(errorsOnly ? { errorsOnly: 'true' } : {})
      });

      // Add preset tab filters
      if (tab === 'cambios') {
        params.append('criticalOnly', 'true');
      } else if (tab === 'roles') {
        params.set('module', 'USUARIOS');
      } else if (tab === 'citas') {
        params.set('module', 'CITAS');
      } else if (tab === 'configuracion') {
        params.set('module', 'CONFIGURACION');
      }

      const res = await fetch(`/api/auditoria/logs?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al obtener registros');
        return;
      }
      setLogsData(json);
    } catch (e: any) {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [tab, page, limit, desde, hasta, search, moduleFilter, actionFilter, statusFilter, roleFilter, errorsOnly]);
  // Reset page to 1 when filters, search terms, or tabs change
  useEffect(() => {
    setPage(1);
  }, [tab, search, moduleFilter, actionFilter, statusFilter, roleFilter, errorsOnly, desde, hasta]);

  // Fetch summaries or security data when tab changes
  useEffect(() => {
    if (user && (user.rol === 'ADMIN' || user.rol === 'TECH_SUPPORT')) {
      if (tab === 'resumen') {
        fetchSummary();
      } else if (tab === 'seguridad') {
        fetchSecurity();
      }
    }
  }, [tab, fetchSummary, fetchSecurity, user]);

  // Fetch logs when relevant query parameters or page change
  useEffect(() => {
    if (user && (user.rol === 'ADMIN' || user.rol === 'TECH_SUPPORT')) {
      if (tab !== 'resumen' && tab !== 'seguridad' && tab !== 'exportar') {
        fetchLogs();
      }
    }
  }, [tab, page, limit, desde, hasta, search, moduleFilter, actionFilter, statusFilter, roleFilter, errorsOnly, fetchLogs, user]);
  // Export Data Handler (CSV / XLSX / PDF)
  const handleExport = async (formato: 'csv' | 'xlsx' | 'pdf') => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams({
        formato,
        from: desde,
        to: hasta,
        ...(search ? { search } : {}),
        ...(moduleFilter ? { module: moduleFilter } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(errorsOnly ? { errorsOnly: 'true' } : {})
      });

      if (formato === 'pdf') {
        // Fetch raw data
        const res = await fetch(`/api/auditoria/exportar?${params}`);
        const data = await res.json();
        
        if (!res.ok) {
          toast.error(data.error || 'Error al exportar PDF');
          return;
        }

        // Dynamically load jsPDF on client
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF({ orientation: 'landscape' });
        
        // Header
        doc.setFontSize(16);
        doc.text('HAIR STYLE - Gestión de Barbería', 14, 15);
        doc.setFontSize(12);
        doc.text('Auditoría del Sistema - Reporte Oficial', 14, 22);
        doc.setFontSize(9);
        doc.text(`Rango: ${desde} a ${hasta}  |  Generado por: ${user?.email || 'Admin'}  |  Registros: ${data.logs.length}`, 14, 28);
        doc.line(14, 30, 282, 30);

        // Map logs to table rows
        const tableBody = data.logs.map((log: any) => [
          new Date(log.createdAt).toLocaleString('es-NI'),
          log.userName || log.userEmail || 'System',
          log.userRole || 'N/A',
          log.module,
          log.action,
          log.description || '',
          log.status,
          log.ipAddress || '—'
        ]);

        autoTable(doc, {
          startY: 33,
          head: [['Fecha y Hora', 'Usuario', 'Rol', 'Módulo', 'Acción', 'Descripción', 'Estado', 'IP']],
          body: tableBody,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [212, 160, 23] } // Gold Theme
        });

        doc.save(`auditoria_${desde}_to_${hasta}.pdf`);
        toast.success('Reporte PDF descargado con éxito.');
      } else {
        // Directly download CSV/Excel
        window.location.href = `/api/auditoria/exportar?${params}`;
        toast.success('Descarga iniciada con éxito.');
      }
    } catch (e: any) {
      toast.error('No se pudo generar la exportación.');
    } finally {
      setExportLoading(false);
    }
  };

  // Helper to copy text to clipboard safely
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('ID de evento copiado al portapapeles.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Show detailed logs info by fetching full detail by ID
  const openDetail = async (logId: string) => {
    try {
      const res = await fetch(`/api/auditoria/logs/${logId}`);
      if (!res.ok) throw new Error('Fallo al obtener detalle');
      const detail = await res.json();
      setSelectedLog(detail);
    } catch {
      toast.error('No se pudo obtener el detalle técnico del registro.');
    }
  };

  // Render Diff Table between beforeData and afterData
  const renderDiff = (before: any, after: any) => {
    if (!before && !after) return null;
    
    const keys = Array.from(new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {})
    ])).filter(key => key !== 'updatedAt' && key !== 'createdAt');

    return (
      <div className="border border-border/60 rounded-lg overflow-hidden mt-2">
        <table className="w-full text-xs text-left">
          <thead className="bg-secondary/50 text-muted-foreground uppercase text-[10px] font-bold">
            <tr className="border-b border-border/40">
              <th className="px-3 py-2">Campo</th>
              <th className="px-3 py-2">Antes</th>
              <th className="px-3 py-2">Después</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {keys.map(key => {
              const valBefore = before ? before[key] : undefined;
              const valAfter = after ? after[key] : undefined;
              
              // Skip if values match
              if (JSON.stringify(valBefore) === JSON.stringify(valAfter)) return null;

              const formatVal = (v: any) => {
                if (v === null || v === undefined) return <span className="text-muted-foreground/40 italic">nulo</span>;
                if (typeof v === 'object') return <pre className="max-w-[200px] overflow-x-auto whitespace-pre-wrap font-mono text-[9px]">{JSON.stringify(v, null, 2)}</pre>;
                if (typeof v === 'boolean') return v ? 'Verdadero' : 'Falso';
                return String(v);
              };

              return (
                <tr key={key} className="hover:bg-secondary/10">
                  <td className="px-3 py-2.5 font-semibold text-foreground">{key}</td>
                  <td className="px-3 py-2.5 text-red-600 dark:text-red-400 bg-red-500/5 whitespace-pre-wrap">{formatVal(valBefore)}</td>
                  <td className="px-3 py-2.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 whitespace-pre-wrap">{formatVal(valAfter)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Auth checks
  if (authLoading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando acceso de seguridad...</p>
        </div>
      </div>
    );
  }

  if (user && user.rol !== 'ADMIN' && user.rol !== 'TECH_SUPPORT') {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center border-border/50 shadow-xl space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Acceso Bloqueado</h2>
            <p className="text-sm text-muted-foreground">
              El módulo de Auditoría del Sistema contiene registros de seguridad restringidos únicamente a Administradores y Soporte Técnico.
            </p>
            <Button onClick={() => router.push('/dashboard')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Volver al Dashboard
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-6 space-y-6 overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Auditoría del Sistema</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historial completo de acciones administrativas, inicios de sesión y modificaciones de datos.
            </p>
          </div>
          <div className="flex items-center gap-2 self-stretch md:self-auto">
            {tab !== 'resumen' && tab !== 'seguridad' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs()}
                disabled={loading}
                className="gap-1.5 text-xs h-9"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                Actualizar Logs
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/20 no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border border-transparent',
                tab === t.id
                  ? 'bg-primary/10 text-primary border-primary/20 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* content panels */}
        {tab === 'resumen' && summaryData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 border-border/50 bg-card shadow-xs relative group">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Total Acciones</p>
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-3xl font-extrabold mt-2 tabular-nums">{summaryData.totalActions}</h3>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Registros totales guardados</p>
              </Card>
              <Card className="p-4 border-border/50 bg-card shadow-xs relative group">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Usuarios Activos (7d)</p>
                  <Users className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="text-3xl font-extrabold mt-2 tabular-nums">{summaryData.activeUsersCount}</h3>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Usuarios que operaron en el sistema</p>
              </Card>
              <Card className="p-4 border-border/50 bg-card shadow-xs relative group">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Logins Fallidos</p>
                  <Key className="w-4 h-4 text-red-500" />
                </div>
                <h3 className="text-3xl font-extrabold mt-2 text-red-500 tabular-nums">{summaryData.loginFailedCount}</h3>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Intentos de login no autorizados</p>
              </Card>
              <Card className="p-4 border-border/50 bg-card shadow-xs relative group">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Errores Críticos</p>
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                </div>
                <h3 className="text-3xl font-extrabold mt-2 text-orange-500 tabular-nums">{summaryData.criticalErrorsCount}</h3>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Acciones con estado fallido</p>
              </Card>
            </div>

            {/* Sub-KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 border-border/50 bg-card space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 border-b border-border/40 pb-2">
                  <Layers className="w-4 h-4 text-primary" /> Operaciones del Período
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Acciones Realizadas Hoy</p>
                    <p className="text-lg font-bold tabular-nums">{summaryData.actionsToday}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Acciones Realizadas esta Semana</p>
                    <p className="text-lg font-bold tabular-nums">{summaryData.actionsThisWeek}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cambios de Configuración</p>
                    <p className="text-lg font-bold tabular-nums">{summaryData.configChangesCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cambios de Roles</p>
                    <p className="text-lg font-bold tabular-nums">{summaryData.roleChangesCount}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-border/50 bg-card space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 border-b border-border/40 pb-2">
                  <Calendar className="w-4 h-4 text-primary" /> Histórico Citas & Exportaciones
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Citas Creadas</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{summaryData.citasCreatedCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Citas Canceladas</p>
                    <p className="text-lg font-bold text-red-500 tabular-nums">{summaryData.citasCancelledCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Citas Reprogramadas</p>
                    <p className="text-lg font-bold text-blue-500 tabular-nums">{summaryData.citasRescheduledCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Exportaciones de Auditoría</p>
                    <p className="text-lg font-bold text-indigo-500 tabular-nums">{summaryData.exportationsCount}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {tab === 'seguridad' && securityData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 border-border/50 bg-card relative">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Login Fallidos</p>
                <h3 className="text-3xl font-extrabold mt-2 text-red-500 tabular-nums">{securityData.stats.loginFailedCount}</h3>
              </Card>
              <Card className="p-4 border-border/50 bg-card relative">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Accesos No Autorizados</p>
                <h3 className="text-3xl font-extrabold mt-2 text-red-500 tabular-nums">{securityData.stats.unauthorizedAccessCount}</h3>
              </Card>
              <Card className="p-4 border-border/50 bg-card relative">
                <p className="text-xs font-semibold text-muted-foreground uppercase">APIs Bloqueadas</p>
                <h3 className="text-3xl font-extrabold mt-2 text-red-500 tabular-nums">{securityData.stats.forbiddenApiCount}</h3>
              </Card>
              <Card className="p-4 border-border/50 bg-card relative">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Límites de Petición Excedidos</p>
                <h3 className="text-3xl font-extrabold mt-2 text-orange-500 tabular-nums">{securityData.stats.rateLimitCount}</h3>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Suspicious IPs */}
              <Card className="p-5 border-border/50 bg-card space-y-4 lg:col-span-1">
                <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-500" /> IPs Bajo Sospecha (Login Fallidos)
                </h3>
                {securityData.suspiciousIps.length > 0 ? (
                  <div className="space-y-3">
                    {securityData.suspiciousIps.map((ipObj: any, index: number) => (
                      <div key={index} className="flex justify-between items-center bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg text-xs">
                        <span className="font-mono font-medium text-foreground">{ipObj.ipAddress}</span>
                        <span className="bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">{ipObj.count} fallos (24h)</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    No se detectan patrones de fuerza bruta en las últimas 24 horas.
                  </div>
                )}
              </Card>

              {/* Security events feed */}
              <Card className="p-5 border-border/50 bg-card space-y-4 lg:col-span-2">
                <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-2">
                  Eventos Críticos de Seguridad
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {securityData.recentEvents.map((ev: any) => (
                    <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-secondary/20 hover:bg-secondary/35 rounded-lg border border-border/30 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-600 font-bold font-mono text-[9px]">
                            {ev.action}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(ev.createdAt).toLocaleString('es-NI')}
                          </span>
                        </div>
                        <p className="text-foreground font-medium mt-1">{ev.description}</p>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        <p>{ev.userName || ev.userEmail || 'Desconocido'}</p>
                        <p className="font-mono mt-0.5">{ev.ipAddress}</p>
                      </div>
                    </div>
                  ))}
                  {securityData.recentEvents.length === 0 && (
                    <div className="py-16 text-center text-muted-foreground">
                      No hay registros críticos de seguridad en el rango actual.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Export / Historial Tab */}
        {tab === 'exportar' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="p-6 border-border/50 bg-card space-y-4 shadow-lg">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" /> Descargar Historial Completo
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure los filtros en el sidebar y el rango de fechas en la parte superior para generar la exportación de auditoría. Respete los límites máximos por descarga:
              </p>
              
              <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
                <div className="p-3 bg-secondary/40 border border-border/50 rounded-xl space-y-1">
                  <span className="font-bold text-foreground">CSV</span>
                  <p className="text-muted-foreground text-[10px]">Máx. 5,000 logs</p>
                </div>
                <div className="p-3 bg-secondary/40 border border-border/50 rounded-xl space-y-1">
                  <span className="font-bold text-foreground">Excel (.xlsx)</span>
                  <p className="text-muted-foreground text-[10px]">Máx. 5,000 logs</p>
                </div>
                <div className="p-3 bg-secondary/40 border border-border/50 rounded-xl space-y-1">
                  <span className="font-bold text-foreground">PDF</span>
                  <p className="text-muted-foreground text-[10px]">Máx. 1,000 logs</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border/40">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Desde</label>
                    <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Hasta</label>
                    <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 text-xs" />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <Button
                    onClick={() => handleExport('csv')}
                    disabled={exportLoading}
                    className="flex-1 text-xs"
                    variant="outline"
                  >
                    Exportar CSV
                  </Button>
                  <Button
                    onClick={() => handleExport('xlsx')}
                    disabled={exportLoading}
                    className="flex-1 text-xs"
                    variant="outline"
                  >
                    Exportar Excel
                  </Button>
                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={exportLoading}
                    className="flex-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                  >
                    {exportLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Exportar PDF
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* General Audit Logs Table View */}
        {tab !== 'resumen' && tab !== 'seguridad' && tab !== 'exportar' && (
          <div className="space-y-4">
            
            {/* Filters panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-secondary/20 p-3.5 rounded-xl border border-border/30">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Rango</span>
                <div className="flex gap-2">
                  <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 text-xs px-2" />
                  <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 text-xs px-2" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Búsqueda</span>
                <Input
                  type="text"
                  placeholder="Buscar usuario, acción..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Módulo</span>
                <select
                  value={moduleFilter}
                  onChange={e => setModuleFilter(e.target.value)}
                  className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Todos los módulos</option>
                  <option value="AUTH">AUTH</option>
                  <option value="USUARIOS">USUARIOS</option>
                  <option value="CLIENTES">CLIENTES</option>
                  <option value="CITAS">CITAS</option>
                  <option value="SERVICIOS">SERVICIOS</option>
                  <option value="CONFIGURACION">CONFIGURACION</option>
                  <option value="AUDITORIA">AUDITORIA</option>
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Estado</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Todos</option>
                  <option value="SUCCESS">Éxito</option>
                  <option value="FAILED">Error</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={errorsOnly}
                    onChange={e => setErrorsOnly(e.target.checked)}
                    className="rounded text-primary border-border bg-background w-3.5 h-3.5 focus:ring-primary"
                  />
                  <span>Sólo Errores</span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setModuleFilter('');
                    setActionFilter('');
                    setStatusFilter('');
                    setRoleFilter('');
                    setErrorsOnly(false);
                  }}
                  className="text-xs h-8 ml-auto hover:bg-secondary/55 text-muted-foreground"
                >
                  Limpiar
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card className="border-border/50 overflow-hidden shadow-sm bg-card">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Cargando registros del historial...</p>
                </div>
              ) : error ? (
                <div className="py-20 flex flex-col items-center justify-center text-center text-red-500 gap-2 px-4">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              ) : logsData?.logs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 text-muted-foreground">
                      <tr className="border-b border-border/40">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Fecha y Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Usuario</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Rol</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Módulo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Acción</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Descripción</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">IP Masked</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {logsData.logs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-secondary/15 transition-all text-xs">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString('es-NI')}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                            {log.userName || log.userEmail || <span className="text-muted-foreground/30 italic">Sistema</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {log.userRole ? (
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                                log.userRole === 'ADMIN' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                log.userRole === 'TECH_SUPPORT' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' :
                                'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                              )}>
                                {log.userRole}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">
                            {log.module}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-[10px] font-medium bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[250px] truncate text-muted-foreground" title={log.description}>
                            {log.description || '—'}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {log.status === 'SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold text-[9px]">
                                <CheckCircle className="w-2.5 h-2.5" /> ÉXITO
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full font-bold text-[9px]">
                                <XCircle className="w-2.5 h-2.5" /> ERROR
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                            {log.ipAddress || '—'}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDetail(log.id)}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-secondary/40 text-primary"
                                title="Ver detalles técnicos"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(log.id, log.id)}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-secondary/40 text-muted-foreground"
                                title="Copiar ID del evento"
                              >
                                {copiedId === log.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <Clock className="w-8 h-8 opacity-25" />
                  <p className="text-xs">No se encontraron registros de auditoría que coincidan con los filtros.</p>
                </div>
              )}
            </Card>

            {/* Pagination Controls */}
            {logsData?.pagination && logsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/20 pt-4 text-xs text-muted-foreground">
                <p>
                  Mostrando logs del {((page - 1) * limit) + 1} al {Math.min(page * limit, logsData.pagination.total)} de {logsData.pagination.total} registros
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="h-8 text-xs gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Anterior
                  </Button>
                  <span className="font-semibold text-foreground">
                    Página {page} de {logsData.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= logsData.pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="h-8 text-xs gap-1"
                  >
                    Siguiente <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Event Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <Card className="max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 border-border bg-card shadow-2xl relative space-y-4">
              <div className="flex items-start justify-between border-b border-border/40 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-primary/10 text-primary font-bold font-mono text-xs">
                      {selectedLog.action}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full font-bold text-[10px]",
                      selectedLog.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'
                    )}>
                      {selectedLog.status}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-foreground mt-1.5">{selectedLog.description}</h2>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-muted-foreground/60 hover:text-foreground text-sm font-bold border border-border/50 rounded-lg p-1.5 hover:bg-secondary/40 transition-all"
                >
                  Cerrar
                </button>
              </div>

              {/* Technical properties */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs border-b border-border/40 pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">ID de Evento</span>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[10px] font-mono text-foreground truncate max-w-[200px]">{selectedLog.id}</code>
                    <button onClick={() => copyToClipboard(selectedLog.id, 'modal-id')} className="text-muted-foreground hover:text-foreground">
                      {copiedId === 'modal-id' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Fecha y Hora</span>
                  <p className="text-foreground">{new Date(selectedLog.createdAt).toLocaleString('es-NI')}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Usuario</span>
                  <p className="text-foreground">{selectedLog.userName || selectedLog.userEmail || 'System (Ejecución Automática)'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Rol</span>
                  <p className="text-foreground">{selectedLog.userRole || 'N/A'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Módulo / Tipo Entidad</span>
                  <p className="text-foreground font-semibold">{selectedLog.module} {selectedLog.entityType ? `(${selectedLog.entityType})` : ''}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">IP Address</span>
                  <p className="text-foreground font-mono">{selectedLog.ipAddress || '—'}</p>
                </div>
                {selectedLog.userAgent && (
                  <div className="col-span-2 space-y-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">User Agent</span>
                    <p className="text-muted-foreground text-[10px] font-mono break-all leading-normal">{selectedLog.userAgent}</p>
                  </div>
                )}
                {selectedLog.errorMessage && (
                  <div className="col-span-2 p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-red-600 dark:text-red-400 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase">Mensaje de Error Técnico</span>
                    <p className="font-mono text-[10px] break-words">{selectedLog.errorMessage}</p>
                  </div>
                )}
              </div>

              {/* Data changes or Diff view */}
              <div className="space-y-3">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Comparación de Cambios</span>
                {selectedLog.beforeData || selectedLog.afterData ? (
                  renderDiff(selectedLog.beforeData, selectedLog.afterData)
                ) : selectedLog.metadata ? (
                  <div className="p-3 bg-secondary/30 rounded-lg">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Metadatos del Evento</span>
                    <pre className="font-mono text-[10px] text-foreground overflow-x-auto mt-1 p-2 bg-background border border-border/40 rounded whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Este evento no registra modificaciones de base de datos ni metadatos.</p>
                )}
              </div>
            </Card>
          </div>
        )}

      </main>
    </div>
  );
}
