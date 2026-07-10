'use client';

import { useState, useEffect } from 'react';
import {
  Store, Clock, Bell, Palette, Save, CheckCircle2,
  Phone, MapPin, MessageCircle, Globe, RefreshCcw,
  Laptop, Smartphone, Trash2, LogOut, Settings,
} from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'negocio',     label: 'Negocio',      icon: Store, roles: ['ADMIN', 'TECH_SUPPORT'] },
  { id: 'horarios',    label: 'Horarios',      icon: Clock, roles: ['ADMIN', 'TECH_SUPPORT'] },
  { id: 'whatsapp',    label: 'WhatsApp',      icon: MessageCircle, roles: ['ADMIN', 'TECH_SUPPORT'] },
  { id: 'apariencia',  label: 'Apariencia',    icon: Palette, roles: ['ADMIN', 'TECH_SUPPORT'] },
  { id: 'dispositivos', label: 'Sesiones y Dispositivos', icon: Laptop, roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'] },
];

const DIAS = [
  { key: 'lunes',     label: 'Lunes' },
  { key: 'martes',    label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves',    label: 'Jueves' },
  { key: 'viernes',   label: 'Viernes' },
  { key: 'sabado',    label: 'Sábado' },
  { key: 'domingo',   label: 'Domingo' },
];

export function formatTo12h(timeStr: string): string {
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

const TIME_OPTIONS = Array.from({ length: 48 }).map((_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const val = `${String(h).padStart(2, '0')}:${m}`;
  return {
    value: val,
    label: formatTo12h(val)
  };
});

const defaultHorarios: Record<string, { activo: boolean; inicio: string; fin: string }> = {
  lunes:     { activo: true,  inicio: '08:00', fin: '18:00' },
  martes:    { activo: true,  inicio: '08:00', fin: '18:00' },
  miercoles: { activo: true,  inicio: '08:00', fin: '18:00' },
  jueves:    { activo: true,  inicio: '08:00', fin: '18:00' },
  viernes:   { activo: true,  inicio: '08:00', fin: '18:00' },
  sabado:    { activo: true,  inicio: '08:00', fin: '14:00' },
  domingo:   { activo: false, inicio: '09:00', fin: '13:00' },
};

export default function Configuracion() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [tab, setTab]       = useState('horarios');
  const [saved, setSaved]   = useState(false);
  const isTechSupport = false;

  const [negocio, setNegocio] = useState({
    nombre: 'HAIR STYLE',
    subtitulo: 'Salón & Barber',
    telefono: '',
    whatsapp: '',
    direccion: '',
    web: '',
    moneda: 'USD',
    zona_horaria: 'America/Managua',
  });

  const [horarios, setHorarios] = useState(defaultHorarios);

  const [waConfig, setWaConfig] = useState({
    numero: '',
    confirmar: true,
    recordatorio: true,
    cancelacion: true,
    msgExtra: '',
  });

  const [apariencia, setApariencia] = useState({
    tema: 'system',
    branding: true,
  });

  // ── Divisa ──────────────────────────────────────────────────────────────
  const [divisa, setDivisa] = useState({ moneda: 'USD', tipoCambio: 36.5 });
  const [divisaSaving, setDivisaSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Dispositivos Recordados ─────────────────────────────────────────────
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [loadingDispositivos, setLoadingDispositivos] = useState(false);

  const fetchDispositivos = async () => {
    setLoadingDispositivos(true);
    try {
      const res = await fetch('/api/auth/dispositivos');
      if (res.ok) {
        const data = await res.json();
        setDispositivos(data);
      }
    } catch (err) {
      console.error('Error al cargar dispositivos:', err);
    } finally {
      setLoadingDispositivos(false);
    }
  };

  const handleRevokeDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/auth/dispositivos?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Sesión revocada exitosamente');
        const revoked = dispositivos.find(d => d.id === id);
        if (revoked?.isCurrent) {
          window.location.href = '/login';
        } else {
          fetchDispositivos();
        }
      } else {
        toast.error('No se pudo revocar el dispositivo');
      }
    } catch (err) {
      toast.error('Error al revocar el dispositivo');
    }
  };

  const handleRevokeAllDevices = async () => {
    if (!confirm('¿Estás seguro de que deseas cerrar sesión en todos los dispositivos?')) return;
    try {
      const res = await fetch('/api/auth/dispositivos?all=true', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Todas las sesiones revocadas');
        window.location.href = '/login';
      } else {
        toast.error('No se pudieron revocar los dispositivos');
      }
    } catch (err) {
      toast.error('Error al revocar los dispositivos');
    }
  };

  // Ajustar la pestaña activa según el rol del usuario
  useEffect(() => {
    if (user && user.rol === 'EMPLEADO') {
      setTab('dispositivos');
    }
  }, [user]);

  // Cargar dispositivos al cambiar a la pestaña de dispositivos
  useEffect(() => {
    if (tab === 'dispositivos') {
      fetchDispositivos();
    }
  }, [tab]);

  useEffect(() => {
    // Cargar la configuración general
    fetch('/api/configuracion')
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          if (d.config.negocio && Object.keys(d.config.negocio).length > 0) setNegocio(d.config.negocio);
          if (d.config.horarios && Object.keys(d.config.horarios).length > 0) setHorarios(d.config.horarios);
          if (d.config.whatsapp && Object.keys(d.config.whatsapp).length > 0) setWaConfig(d.config.whatsapp);
          if (d.config.apariencia && Object.keys(d.config.apariencia).length > 0) setApariencia(d.config.apariencia);
          if (d.config.negocio?.moneda) setDivisa(prev => ({ ...prev, moneda: d.config.negocio.moneda, tipoCambio: d.config.negocio.tipoCambio ?? 36.5 }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveDivisa = async () => {
    setDivisaSaving(true);
    try {
      const res = await fetch('/api/divisa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(divisa),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Tipo de cambio guardado');
      setNegocio(prev => ({ ...prev, moneda: divisa.moneda, tipoCambio: divisa.tipoCambio }));
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally { setDivisaSaving(false); }
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaved(true);
    try {
      const payload = {
        negocio: {
          ...negocio,
          tipoCambio: divisa.tipoCambio,
        },
        horarios,
        whatsapp: waConfig,
        apariencia,
      };
      const res = await fetch('/api/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success('Configuración guardada');
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
      setSaved(false);
    }
  };

  const toggleDia = (dia: string) => {
    setHorarios(h => ({ ...h, [dia]: { ...h[dia], activo: !h[dia].activo } }));
  };

  const updateHorario = (dia: string, field: 'inicio'|'fin', val: string) => {
    setHorarios(h => ({ ...h, [dia]: { ...h[dia], [field]: val } }));
  };

  const getHeaderInfo = () => {
    switch (tab) {
      case 'negocio':
        return {
          title: 'Configuración del Negocio',
          desc: 'Gestiona la información de contacto, ubicación y divisa de HAIR STYLE',
        };
      case 'whatsapp':
        return {
          title: 'Configuración de WhatsApp',
          desc: 'Configura notificaciones, recordatorios y mensajes automáticos',
        };
      case 'apariencia':
        return {
          title: 'Apariencia del Sistema',
          desc: 'Personaliza el modo de color y el tema del portal administrativo',
        };
      case 'dispositivos':
        return {
          title: 'Sesiones y Dispositivos',
          desc: 'Administra los dispositivos que tienen acceso guardado de 60 días a tu cuenta',
        };
      case 'horarios':
      default:
        return {
          title: 'Horarios de Apertura',
          desc: 'Gestiona el horario de atención general de HAIR STYLE',
        };
    }
  };

  const headerInfo = getHeaderInfo();
  const visibleTabs = TABS.filter(t => t.roles.includes(user?.rol ?? 'EMPLEADO'));

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{headerInfo.title}</h1>
              <p className="text-sm text-muted-foreground">{headerInfo.desc}</p>
            </div>
            {tab !== 'dispositivos' && (
              isTechSupport ? (
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  Modo Solo Lectura
                </span>
              ) : (
                <Button onClick={handleSave} className={cn('gap-1.5', saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'glow-gold')}>
                  {saved ? <CheckCircle2 className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
                  {saved ? 'Guardado' : 'Guardar cambios'}
                </Button>
              )
            )}
          </div>

          {/* Selector de pestañas */}
          {visibleTabs.length > 1 && (
            <div className="flex border-b border-border/50 overflow-x-auto gap-2 pb-1 scrollbar-none mb-2">
              {visibleTabs.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer',
                      isActive
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 dark:bg-amber-500/20'
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Tab: Negocio ─────────────────────────────────── */}
          {tab === 'negocio' && (
            <Card className="p-6 border-border/50">
              <fieldset disabled={isTechSupport} className="space-y-5 disabled:opacity-90">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="w-4 h-4 text-primary"/>
                  <h2 className="font-semibold text-foreground">Información del Negocio</h2>
                </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nombre del negocio</label>
                  <Input value={negocio.nombre} onChange={e => setNegocio({ ...negocio, nombre: e.target.value })} placeholder="HAIR STYLE"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Subtítulo</label>
                  <Input value={negocio.subtitulo} onChange={e => setNegocio({ ...negocio, subtitulo: e.target.value })} placeholder="Salón & Barber"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    <Phone className="w-3 h-3 inline mr-1"/>Teléfono
                  </label>
                  <Input value={negocio.telefono} onChange={e => setNegocio({ ...negocio, telefono: e.target.value })} placeholder="2222-3333"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    <MessageCircle className="w-3 h-3 inline mr-1"/>WhatsApp del negocio
                  </label>
                  <Input value={negocio.whatsapp} onChange={e => setNegocio({ ...negocio, whatsapp: e.target.value })} placeholder="50588880000"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  <MapPin className="w-3 h-3 inline mr-1"/>Dirección
                </label>
                <Input value={negocio.direccion} onChange={e => setNegocio({ ...negocio, direccion: e.target.value })} placeholder="Managua, Nicaragua"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  <Globe className="w-3 h-3 inline mr-1"/>Sitio web (opcional)
                </label>
                <Input value={negocio.web} onChange={e => setNegocio({ ...negocio, web: e.target.value })} placeholder="https://hairstyle.com"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Zona horaria</label>
                <select value={negocio.zona_horaria} onChange={e => setNegocio({ ...negocio, zona_horaria: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="America/Managua">Managua, Nicaragua (UTC-6)</option>
                  <option value="America/Costa_Rica">San José, Costa Rica (UTC-6)</option>
                  <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
                </select>
              </div>
              </fieldset>
            </Card>
          )}

          {/* ── Tab: Horarios ────────────────────────────────── */}
          {tab === 'horarios' && (
            <Card className="p-6 border-border/50">
              <fieldset disabled={isTechSupport} className="space-y-5 disabled:opacity-90">
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="w-4 h-4 text-primary"/>
                  <h2 className="font-semibold text-foreground">Horario General del Salón</h2>
                </div>
              <p className="text-xs text-muted-foreground mb-4">
                Este es el horario general de apertura. Los horarios individuales de cada empleado se configuran en su perfil.
              </p>
              <div className="space-y-3">
                {DIAS.map(({ key, label }) => {
                  const h = horarios[key];
                  return (
                    <div key={key} className={cn('flex items-center gap-4 p-3 rounded-xl border transition-all',
                      h.activo ? 'border-border/50 bg-card' : 'border-border/30 bg-secondary/20 opacity-60')}>
                      <button onClick={() => toggleDia(key)}
                        className={cn('w-10 h-5 rounded-full relative transition-all flex-shrink-0',
                          h.activo ? 'bg-primary' : 'bg-border')}>
                        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm',
                          h.activo ? 'left-5' : 'left-0.5')}/>
                      </button>
                      <span className={cn('w-24 text-sm font-medium flex-shrink-0',
                        h.activo ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                      {h.activo ? (
                        <div className="flex items-center gap-2 flex-1">
                          <select
                            value={h.inicio}
                            onChange={e => updateHorario(key, 'inicio', e.target.value)}
                            className="h-9 text-sm w-36 rounded-lg border border-border bg-background px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {TIME_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <span className="text-muted-foreground text-xs">—</span>
                          <select
                            value={h.fin}
                            onChange={e => updateHorario(key, 'fin', e.target.value)}
                            className="h-9 text-sm w-36 rounded-lg border border-border bg-background px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {TIME_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <span className="text-xs text-muted-foreground ml-2 font-medium">
                            {(() => {
                              const [hi, mi] = h.inicio.split(':').map(Number);
                              const [hf, mf] = h.fin.split(':').map(Number);
                              const mins = (hf * 60 + mf) - (hi * 60 + mi);
                              return mins > 0 ? `${Math.floor(mins/60)}h ${mins%60}m` : '';
                            })()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Cerrado</span>
                      )}
                    </div>
                  );
                })}
              </div>
              </fieldset>
            </Card>
          )}



          {/* ── Tab: WhatsApp ──────────────────────────────────── */}
          {tab === 'whatsapp' && (
            <Card className="p-6 border-border/50">
              <fieldset disabled={isTechSupport} className="space-y-5 disabled:opacity-90">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-[#25D366]"/>
                  <h2 className="font-semibold text-foreground">Configuración de WhatsApp</h2>
                </div>
              <div className="bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl p-4 text-sm text-foreground">
                <p className="font-medium mb-1">✅ Sistema usando enlaces wa.me (gratuito)</p>
                <p className="text-muted-foreground text-xs">Los botones de WhatsApp en citas generan enlace directo sin necesidad de API externa.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Número del salón (con código de país)</label>
                <Input value={waConfig.numero} onChange={e => setWaConfig({ ...waConfig, numero: e.target.value })}
                  placeholder="50588880000 (505 = Nicaragua, 506 = Costa Rica)"/>
                <p className="text-xs text-muted-foreground mt-1">Sin guiones ni espacios. Ej: 50588880000</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Mensajes automáticos activos</p>
                <div className="space-y-2">
                  {[
                    { key: 'confirmar',     label: 'Confirmación de cita',   desc: 'Al crear/confirmar una cita' },
                    { key: 'recordatorio',  label: 'Recordatorio de cita',    desc: 'Para recordar la cita al cliente' },
                    { key: 'cancelacion',   label: 'Cancelación de cita',     desc: 'Al cancelar una cita' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-secondary/20">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setWaConfig(c => ({ ...c, [item.key]: !c[item.key as keyof typeof c] }))}
                        className={cn('w-10 h-5 rounded-full relative transition-all flex-shrink-0',
                          waConfig[item.key as keyof typeof waConfig] ? 'bg-primary' : 'bg-border')}>
                        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm',
                          waConfig[item.key as keyof typeof waConfig] ? 'left-5' : 'left-0.5')}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Mensaje adicional (opcional)</label>
                <textarea value={waConfig.msgExtra} onChange={e => setWaConfig({ ...waConfig, msgExtra: e.target.value })}
                  placeholder="Agrega un mensaje personalizado al final de cada notificación..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"/>
              </div>
              </fieldset>
            </Card>
          )}

          {/* ── Tab: Apariencia ──────────────────────────────── */}
          {tab === 'apariencia' && (
            <Card className="p-6 border-border/50">
              <fieldset disabled={isTechSupport} className="space-y-5 disabled:opacity-90">
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-primary"/>
                  <h2 className="font-semibold text-foreground">Apariencia del Sistema</h2>
                </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Modo de color</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { val: 'light',  label: 'Claro',   preview: 'bg-white border-2', text: 'text-gray-800' },
                    { val: 'dark',   label: 'Oscuro',  preview: 'bg-gray-900 border-2', text: 'text-gray-100' },
                    { val: 'system', label: 'Sistema', preview: 'bg-gradient-to-br from-white to-gray-900 border-2', text: 'text-gray-500' },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setTheme(opt.val)}
                      className={cn('p-4 rounded-xl border-2 transition-all text-center',
                        theme === opt.val ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80')}>
                      <div className={cn('w-full h-10 rounded-lg mb-2', opt.preview, theme===opt.val?'border-primary':'border-border')}/>
                      <p className={cn('text-xs font-medium', theme===opt.val?'text-primary':'text-muted-foreground')}>{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-1">Branding activo</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">✂️</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground">HAIR STYLE</p>
                    <p className="text-xs text-primary">Salón & Barber</p>
                  </div>
                </div>
              </div>
              </fieldset>
            </Card>
          )}

          {/* ── Tab: Dispositivos Recordados ─────────────────── */}
          {tab === 'dispositivos' && (
            <Card className="p-6 border-border/50">
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-primary"/>
                    <h2 className="font-semibold text-foreground">Dispositivos y Sesiones Guardadas</h2>
                  </div>
                  {dispositivos.length > 0 && (
                    <Button 
                      variant="destructive" 
                      onClick={handleRevokeAllDevices}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Cerrar sesión en todos los dispositivos
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Estas son las sesiones que tienen la opción "Recordar este dispositivo" activa. Tienen una duración máxima de 60 días desde su último uso y te permiten acceder al sistema automáticamente sin ingresar contraseña.
                </p>

                {loadingDispositivos ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/>
                    <p className="text-xs text-muted-foreground">Cargando dispositivos...</p>
                  </div>
                ) : dispositivos.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-border/50 rounded-xl">
                    <Laptop className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">No tienes otros dispositivos recordados</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Activa "Recordar este dispositivo" al iniciar sesión</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dispositivos.map((device) => {
                      const isMobile = device.deviceName.toLowerCase().includes('iphone') || device.deviceName.toLowerCase().includes('android') || device.deviceName.toLowerCase().includes('ipad');
                      const DeviceIcon = isMobile ? Smartphone : Laptop;
                      
                      return (
                        <div key={device.id} className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all",
                          device.isCurrent 
                            ? "border-primary/45 bg-primary/3" 
                            : "border-border/50 bg-secondary/10"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center border",
                              device.isCurrent 
                                ? "bg-primary/10 border-primary/20 text-primary" 
                                : "bg-card border-border/50 text-muted-foreground"
                            )}>
                              <DeviceIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">{device.deviceName}</span>
                                {device.isCurrent && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    Este dispositivo
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground/75 mt-0.5">
                                <span>IP: {device.ipAddress}</span>
                                <span className="hidden sm:inline">•</span>
                                <span>Primer login: {new Date(device.createdAt).toLocaleDateString()}</span>
                                <span className="hidden sm:inline">•</span>
                                <span>Último uso: {new Date(device.lastUsedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevokeDevice(device.id)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title={device.isCurrent ? "Cerrar sesión actual" : "Cerrar sesión en este dispositivo"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
