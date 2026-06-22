'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { 
  Database, 
  CloudLightning, 
  Download, 
  Trash2, 
  RotateCcw, 
  Settings, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Info,
  Calendar,
  Lock,
  HardDrive
} from 'lucide-react';

interface BackupHistoryItem {
  id: string;
  fileName: string;
  storageProvider: string;
  sizeBytes: string | null;
  checksumSha256: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DELETED';
  type: 'MANUAL' | 'AUTOMATIC' | 'PRE_RESTORE';
  createdById: string | null;
  createdByRole: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface WorkerStatus {
  status: 'available' | 'unavailable';
  version?: string;
  lastJobAt?: string | null;
  queueStatus?: 'idle' | 'processing' | 'unavailable';
  error?: string;
}

export default function BackupsPage() {
  const { user } = useAuth();
  
  // Estados
  const [backups, setBackups] = useState<BackupHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ status: 'unavailable' });
  const [loadingWorker, setLoadingWorker] = useState(true);
  
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Configuración de Automatización
  const [diarioEnabled, setDiarioEnabled] = useState(true);
  const [retencionManual, setRetencionManual] = useState(10);
  const [retencionAutomatico, setRetencionAutomatico] = useState(15);
  const [retencionPreRestore, setRetencionPreRestore] = useState(5);

  // Modos mantenimiento
  const [mantenimientoActivo, setMantenimientoActivo] = useState(false);
  const [mensajeMantenimiento, setMensajeMantenimiento] = useState('');

  // Modales
  const [showRestoreModal, setShowRestoreModal] = useState<BackupHistoryItem | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [confirmFileText, setConfirmFileText] = useState('');
  const [understandLoss, setUnderstandLoss] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState<BackupHistoryItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingBackup, setDeletingBackup] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    fetchHistory();
    fetchWorkerStatus();
    fetchConfig();
  }, []);

  // Polling si hay algún backup procesándose
  useEffect(() => {
    const algunProcesando = backups.some(
      b => b.status === 'PENDING' || b.status === 'PROCESSING'
    );
    if (!algunProcesando) return;

    const interval = setInterval(() => {
      fetchHistory();
      fetchWorkerStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [backups]);

  // Obtener Historial
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/backups');
      if (!res.ok) throw new Error('Error al cargar historial.');
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo cargar el historial.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Obtener Estado del Worker
  const fetchWorkerStatus = async () => {
    try {
      setLoadingWorker(true);
      const res = await fetch('/api/worker/health');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWorkerStatus(data);
    } catch {
      setWorkerStatus({ status: 'unavailable', error: 'No se pudo comunicar con el Worker.' });
    } finally {
      setLoadingWorker(false);
    }
  };

  // Obtener Configuración
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/configuracion');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const config = data.config || {};
      
      setMantenimientoActivo(config.mantenimientoActivo || false);
      setMensajeMantenimiento(config.mensajeMantenimiento || '');
      
      const backupsConf = config.backups || {};
      setDiarioEnabled(backupsConf.diario?.enabled ?? true);
      
      const ret = backupsConf.retencion || {};
      setRetencionManual(ret.manual || 10);
      setRetencionAutomatico(ret.automatico || 15);
      setRetencionPreRestore(ret.preRestore || 5);
    } catch {
      toast.error('Error al cargar configuración de backups.');
    }
  };

  // Guardar Configuración
  const handleSaveSettings = async () => {
    setLoadingSettings(true);
    try {
      const body = {
        backups: {
          diario: { enabled: diarioEnabled },
          retencion: {
            manual: retencionManual,
            automatico: retencionAutomatico,
            preRestore: retencionPreRestore
          }
        }
      };

      const res = await fetch('/api/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('No se pudo guardar la configuración.');
      toast.success('Configuración de backups actualizada.');
      fetchConfig();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar la configuración.');
    } finally {
      setLoadingSettings(false);
    }
  };

  // Guardar Modo Mantenimiento Manual
  const handleToggleMantenimiento = async () => {
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mantenimientoActivo: !mantenimientoActivo,
          mensajeMantenimiento: !mantenimientoActivo ? mensajeMantenimiento || 'El sistema se encuentra en mantenimiento.' : ''
        }),
      });

      if (!res.ok) throw new Error();
      toast.success(!mantenimientoActivo ? 'Modo mantenimiento activado.' : 'Modo mantenimiento desactivado.');
      fetchConfig();
    } catch {
      toast.error('No se pudo modificar el estado de mantenimiento.');
    }
  };

  // Solicitar Backup Manual
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await fetch('/api/backups', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fallo al iniciar copia de seguridad.');
      }
      toast.success('Trabajo de copia de seguridad encolado exitosamente.');
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingBackup(false);
    }
  };

  // Iniciar Eliminación Lógica
  const handleDeleteBackup = async () => {
    if (!showDeleteModal) return;
    setDeletingBackup(true);
    try {
      const res = await fetch(`/api/backups/${showDeleteModal.id}?reason=${encodeURIComponent(deleteReason)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Error al encolar la eliminación.');
      toast.success('Respaldo programado para eliminación física.');
      setShowDeleteModal(null);
      setDeleteReason('');
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingBackup(false);
    }
  };

  // Iniciar Restauración
  const handleRestoreBackup = async () => {
    if (!showRestoreModal) return;
    
    if (confirmText !== 'RESTAURAR') {
      toast.error('Debe escribir exactamente "RESTAURAR" en la confirmación.');
      return;
    }
    if (confirmFileText !== showRestoreModal.fileName) {
      toast.error('El nombre de archivo ingresado no coincide.');
      return;
    }
    if (!understandLoss) {
      toast.error('Debe confirmar que entiende que perderá datos actuales.');
      return;
    }

    setRestoringBackup(true);
    try {
      const res = await fetch(`/api/backups/${showRestoreModal.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: confirmText,
          fileName: confirmFileText,
          understandDataLoss: understandLoss
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar la restauración.');

      toast.success('Flujo de restauración iniciado. Backup automático previo encolado.');
      setShowRestoreModal(null);
      setConfirmText('');
      setConfirmFileText('');
      setUnderstandLoss(false);
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRestoringBackup(false);
    }
  };

  // Helpers de renderizado
  const formatSize = (bytesStr: string | null) => {
    if (!bytesStr) return '0 B';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completado
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/20 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Procesando
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Pendiente
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Fallido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
            <Info className="w-3.5 h-3.5" /> Desconocido
          </span>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'MANUAL': return <span className="text-xs font-medium text-purple-400">Manual</span>;
      case 'AUTOMATIC': return <span className="text-xs font-medium text-blue-400">Automático</span>;
      case 'PRE_RESTORE': return <span className="text-xs font-medium text-amber-400">Pre-Restaurar</span>;
      default: return type;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[hsl(var(--border))] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8 text-amber-500" /> Copias de Seguridad
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Administración de respaldos de base de datos PostgreSQL en almacenamiento S3.
          </p>
        </div>

        {/* Estado del Worker Externo */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm min-w-[240px]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
            <CloudLightning className={`w-4 h-4 ${workerStatus.status === 'available' ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">Estado del Worker</span>
              <span className={`w-2 h-2 rounded-full ${workerStatus.status === 'available' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {workerStatus.status === 'available' 
                ? `Online (v${workerStatus.version || '1.0.0'})` 
                : 'Offline o no configurado'}
            </p>
          </div>
          <button 
            onClick={fetchWorkerStatus} 
            disabled={loadingWorker}
            className="p-1 rounded hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50"
            title="Refrescar estado del worker"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingWorker ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* RUTA PROTEGIDA EN FRONTEND */}
      {user?.rol !== 'ADMIN' && user?.rol !== 'TECH_SUPPORT' ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-rose-500/20 bg-rose-500/5 rounded-2xl">
          <XCircle className="w-12 h-12 text-rose-500 mb-3" />
          <h2 className="text-lg font-bold text-foreground">Acceso No Autorizado</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            Solo los administradores y personal de soporte técnico tienen permisos para gestionar copias de seguridad de la base de datos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA HISTORIAL DE BACKUPS (2/3 de ancho) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
              
              {/* Header de la Tabla */}
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] flex items-center justify-between">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-muted-foreground" /> Historial de Respaldos
                </h2>
                <button 
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] border border-[hsl(var(--border))] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Contenido de la Tabla */}
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                  <p className="text-sm text-muted-foreground">Cargando historial de copias...</p>
                </div>
              ) : backups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Database className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="font-semibold text-foreground">No se encontraron copias de seguridad</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    No hay respaldos activos registrados. Puedes crear tu primer respaldo manual usando el botón lateral.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                        <th className="px-5 py-3.5">Archivo / Fecha</th>
                        <th className="px-5 py-3.5">Tipo</th>
                        <th className="px-5 py-3.5">Tamaño</th>
                        <th className="px-5 py-3.5">Estado</th>
                        <th className="px-5 py-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {backups.map((backup) => (
                        <tr 
                          key={backup.id} 
                          className="hover:bg-[hsl(var(--muted)/0.15)] transition-colors group"
                        >
                          <td className="px-5 py-4 min-w-[220px]">
                            <p className="font-semibold text-foreground truncate max-w-[260px]" title={backup.fileName}>
                              {backup.fileName}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {new Date(backup.createdAt).toLocaleString()}
                            </p>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {getTypeLabel(backup.type)}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap font-medium text-foreground">
                            {formatSize(backup.sizeBytes)}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {getStatusBadge(backup.status)}
                            {backup.errorMessage && (
                              <p className="text-[10px] text-rose-500 mt-1 max-w-[180px] truncate" title={backup.errorMessage}>
                                {backup.errorMessage}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1.5 opacity-90 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                              
                              {/* Descargar (Solo completados) */}
                              {backup.status === 'COMPLETED' && (
                                <a
                                  href={`/api/backups/${backup.id}/download`}
                                  className="p-1.5 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] hover:text-foreground text-muted-foreground transition-colors"
                                  title="Descargar archivo .backup"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* Restaurar (Solo Soporte Técnico, Completados) */}
                              {backup.status === 'COMPLETED' && user?.rol === 'TECH_SUPPORT' && (
                                <button
                                  onClick={() => setShowRestoreModal(backup)}
                                  className="p-1.5 rounded-md border border-amber-500/20 hover:bg-amber-500/10 text-amber-500 transition-colors"
                                  title="Restaurar base de datos"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Eliminar (Solo si no está ya eliminándose/eliminado) */}
                              {backup.status !== 'PENDING' && backup.status !== 'PROCESSING' && (
                                <button
                                  onClick={() => setShowDeleteModal(backup)}
                                  className="p-1.5 rounded-md border border-rose-500/20 hover:bg-rose-500/10 text-rose-500 transition-colors"
                                  title="Eliminar copia de seguridad"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA LATERAL - ACCIONES Y CONFIGURACIONES (1/3 de ancho) */}
          <div className="space-y-6">
            
            {/* CARD CREAR COPIA DE SEGURIDAD MANUAL */}
            <div className="p-5 rounded-2xl border border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--muted)/0.2)] shadow-sm space-y-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-500" /> Operaciones Manuales
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Genera una copia de seguridad en tiempo real. Este proceso se enviará a la cola y se guardará de forma comprimida en almacenamiento S3.
              </p>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup || workerStatus.status !== 'available'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md hover:shadow-amber-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-[0.98]"
              >
                {creatingBackup ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Encolando...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" /> Crear copia de seguridad
                  </>
                )}
              </button>
              {workerStatus.status !== 'available' && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/15 text-[11px] text-rose-500 leading-normal">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>El worker de backups está offline. Las copias de seguridad manuales no se procesarán hasta que se restablezca.</span>
                </div>
              )}
            </div>

            {/* MODO MANTENIMIENTO MANUAL */}
            {user?.rol === 'TECH_SUPPORT' && (
              <div className="p-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm space-y-4">
                <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
                  <Lock className="w-5 h-5 text-amber-500" /> Modo Mantenimiento
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Activa el modo mantenimiento de forma manual para evitar que los usuarios creen o alteren citas antes de una intervención manual del sistema.
                </p>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Mensaje de mantenimiento opcional..."
                    value={mensajeMantenimiento}
                    onChange={(e) => setMensajeMantenimiento(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground"
                  />
                  <button
                    onClick={handleToggleMantenimiento}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
                      mantenimientoActivo 
                        ? 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600'
                        : 'bg-transparent text-foreground hover:bg-[hsl(var(--accent))] border-[hsl(var(--border))]'
                    }`}
                  >
                    {mantenimientoActivo ? 'Desactivar Mantenimiento' : 'Activar Mantenimiento'}
                  </button>
                </div>
              </div>
            )}

            {/* CONFIGURACIÓN DE RESPALDOS AUTOMÁTICOS */}
            <div className="p-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" /> Automatización
                </h3>
                {user?.rol === 'ADMIN' && (
                  <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-bold uppercase">Solo Lectura</span>
                )}
              </div>

              {/* Diario Enabled */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-bold text-foreground">Backup Automático Diario</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Crea un respaldo automático cada 24 horas.</p>
                </div>
                <input
                  type="checkbox"
                  checked={diarioEnabled}
                  disabled={user?.rol === 'ADMIN'}
                  onChange={(e) => setDiarioEnabled(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer disabled:opacity-50"
                />
              </div>

              <div className="space-y-3.5 pt-2 border-t border-[hsl(var(--border))]">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Límites de Retención
                </h4>
                
                {/* Manuales */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Copias Manuales:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={retencionManual}
                    disabled={user?.rol === 'ADMIN'}
                    onChange={(e) => setRetencionManual(parseInt(e.target.value) || 1)}
                    className="w-16 px-2.5 py-1 text-center font-semibold rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground"
                  />
                </div>
                
                {/* Automáticos */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Copias Automáticas:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={retencionAutomatico}
                    disabled={user?.rol === 'ADMIN'}
                    onChange={(e) => setRetencionAutomatico(parseInt(e.target.value) || 1)}
                    className="w-16 px-2.5 py-1 text-center font-semibold rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground"
                  />
                </div>

                {/* Pre-Restore */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Copias Pre-Restaurar:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={retencionPreRestore}
                    disabled={user?.rol === 'ADMIN'}
                    onChange={(e) => setRetencionPreRestore(parseInt(e.target.value) || 1)}
                    className="w-16 px-2.5 py-1 text-center font-semibold rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground"
                  />
                </div>
              </div>

              {/* Botón Guardar */}
              {user?.rol === 'TECH_SUPPORT' && (
                <button
                  onClick={handleSaveSettings}
                  disabled={loadingSettings}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[hsl(var(--accent))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent)/0.8)] hover:text-foreground text-foreground transition-all active:scale-[0.98]"
                >
                  {loadingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />} Guardar configuración
                </button>
              )}
            </div>
            
          </div>
        </div>
      )}

      {/* ─── MODAL DE ELIMINAR RESPALDO ─────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-foreground">Confirmar Eliminación</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-normal">
              Esta acción marcará el archivo <strong className="text-foreground font-bold break-all">{showDeleteModal.fileName}</strong> como eliminado y programará la eliminación física definitiva del archivo de S3.
            </p>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Motivo de la eliminación:</label>
              <input
                type="text"
                placeholder="Ej. Espacio en disco, obsoleto..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] focus:outline-none focus:ring-1 focus:ring-rose-500 text-foreground"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowDeleteModal(null);
                  setDeleteReason('');
                }}
                disabled={deletingBackup}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[hsl(var(--accent))] transition-colors text-muted-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteBackup}
                disabled={deletingBackup || !deleteReason}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {deletingBackup ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CRÍTICO DE RESTAURACIÓN (SOLO TECH_SUPPORT) ──────────────── */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg p-6 rounded-2xl border border-amber-500/30 bg-[hsl(var(--card))] shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center gap-3 text-amber-500 border-b border-[hsl(var(--border))] pb-3.5">
              <AlertTriangle className="w-8 h-8 shrink-0 animate-bounce" />
              <div>
                <h3 className="text-lg font-bold text-foreground">PELIGRO: Restauración de Base de Datos</h3>
                <p className="text-[10px] text-amber-500/80 mt-0.5 uppercase font-bold tracking-wider">Operación Destructiva</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-3 leading-relaxed">
              <p>
                Está a punto de restaurar la copia de seguridad:
                <strong className="block text-foreground bg-[hsl(var(--muted)/0.25)] border border-[hsl(var(--border))] p-2 rounded-lg mt-1 font-mono text-[11px] break-all">
                  {showRestoreModal.fileName}
                </strong>
              </p>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-500 space-y-1.5">
                <p className="font-bold">Por favor lea con atención antes de proceder:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Todos los datos actuales serán reemplazados por el contenido del respaldo elegido.</li>
                  <li>Se creará una copia de seguridad automática del estado actual antes de aplicar la restauración.</li>
                  <li>El sistema se configurará en modo mantenimiento automáticamente impidiendo accesos concurrentes.</li>
                  <li>La sesión activa del resto de usuarios se invalidará tras la restauración.</li>
                </ul>
              </div>
            </div>

            {/* Campos de confirmación obligatorios */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Escriba <span className="text-rose-500 font-extrabold font-mono">RESTAURAR</span> para continuar:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Escriba el nombre exacto del archivo de respaldo:
                </label>
                <input
                  type="text"
                  placeholder="Ej. backup-sistema-citas-..."
                  value={confirmFileText}
                  onChange={(e) => setConfirmFileText(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-foreground"
                />
              </div>

              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="understandLoss"
                  checked={understandLoss}
                  onChange={(e) => setUnderstandLoss(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="understandLoss" className="text-[11px] font-semibold text-foreground select-none cursor-pointer">
                  Confirmo que entiendo que perderé los datos cargados actualmente.
                </label>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2.5 border-t border-[hsl(var(--border))] pt-3.5">
              <button
                onClick={() => {
                  setShowRestoreModal(null);
                  setConfirmText('');
                  setConfirmFileText('');
                  setUnderstandLoss(false);
                }}
                disabled={restoringBackup}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[hsl(var(--accent))] transition-colors text-muted-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={
                  restoringBackup || 
                  confirmText !== 'RESTAURAR' || 
                  confirmFileText !== showRestoreModal.fileName || 
                  !understandLoss
                }
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-amber-500/10 active:scale-[0.98]"
              >
                {restoringBackup ? 'Iniciando flujo...' : 'Restaurar Base de Datos'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
