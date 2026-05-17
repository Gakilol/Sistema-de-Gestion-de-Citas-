'use client';

import { useState, useEffect } from 'react';
import {
  Store, Clock, Bell, Palette, Save, CheckCircle2,
  Phone, MapPin, MessageCircle, Globe, RefreshCcw, DollarSign,
} from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'negocio',     label: 'Negocio',      icon: Store },
  { id: 'horarios',    label: 'Horarios',      icon: Clock },
  { id: 'divisa',      label: 'Divisa',        icon: DollarSign },
  { id: 'whatsapp',    label: 'WhatsApp',      icon: MessageCircle },
  { id: 'apariencia',  label: 'Apariencia',    icon: Palette },
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
  const { theme, setTheme } = useTheme();
  const [tab, setTab]       = useState('negocio');
  const [saved, setSaved]   = useState(false);

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

  // ── Divisa ──────────────────────────────────────────────────────────────
  const [divisa, setDivisa] = useState({ moneda: 'USD', tipoCambio: 36.5 });
  const [divisaSaving, setDivisaSaving] = useState(false);

  useEffect(() => {
    fetch('/api/divisa').then(r => r.json()).then(d => {
      if (d.moneda) setDivisa({ moneda: d.moneda, tipoCambio: d.tipoCambio ?? 36.5 });
    });
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
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally { setDivisaSaving(false); }
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    setSaved(true);
    toast.success('Configuración guardada');
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleDia = (dia: string) => {
    setHorarios(h => ({ ...h, [dia]: { ...h[dia], activo: !h[dia].activo } }));
  };

  const updateHorario = (dia: string, field: 'inicio'|'fin', val: string) => {
    setHorarios(h => ({ ...h, [dia]: { ...h[dia], [field]: val } }));
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
              <p className="text-sm text-muted-foreground">Personaliza tu sistema HAIR STYLE</p>
            </div>
            <Button onClick={handleSave} className={cn('gap-1.5', saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'glow-gold')}>
              {saved ? <CheckCircle2 className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
              {saved ? 'Guardado' : 'Guardar cambios'}
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit flex-wrap">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  tab === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <t.icon className="w-3.5 h-3.5"/> {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Negocio ─────────────────────────────────── */}
          {tab === 'negocio' && (
            <Card className="p-6 border-border/50 space-y-5">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Moneda</label>
                  <select value={negocio.moneda} onChange={e => setNegocio({ ...negocio, moneda: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="USD">USD — Dólar americano ($)</option>
                    <option value="NIO">NIO — Córdoba nicaragüense (C$)</option>
                    <option value="CRC">CRC — Colón costarricense (₡)</option>
                  </select>
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
              </div>
            </Card>
          )}

          {/* ── Tab: Horarios ────────────────────────────────── */}
          {tab === 'horarios' && (
            <Card className="p-6 border-border/50">
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
                          <Input type="time" value={h.inicio} onChange={e => updateHorario(key,'inicio',e.target.value)}
                            className="h-8 text-sm w-28"/>
                          <span className="text-muted-foreground text-xs">—</span>
                          <Input type="time" value={h.fin} onChange={e => updateHorario(key,'fin',e.target.value)}
                            className="h-8 text-sm w-28"/>
                          <span className="text-xs text-muted-foreground ml-2">
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
            </Card>
          )}

          {/* ── Tab: Divisa ──────────────────────────────────── */}
          {tab === 'divisa' && (
            <Card className="p-6 border-border/50 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary"/>
                <h2 className="font-semibold text-foreground">Tipo de Cambio de Divisa</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Configura la moneda del sistema y el tipo de cambio. Los reportes y precios se mostrarán convertidos según la moneda seleccionada.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Moneda del sistema</label>
                  <select value={divisa.moneda} onChange={e => setDivisa({ ...divisa, moneda: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="USD">USD — Dolar americano ($)</option>
                    <option value="NIO">NIO — Cordoba nicaragüense (C$)</option>
                    <option value="CRC">CRC — Colon costarricense (₡)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Tipo de cambio (por 1 USD)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={divisa.tipoCambio}
                    onChange={e => setDivisa({ ...divisa, tipoCambio: parseFloat(e.target.value) || 0 })}
                    placeholder="36.50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Ej: 36.50 significa 1 USD = 36.50 NIO</p>
                </div>
              </div>

              {/* Vista previa de conversión */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground mb-2">Vista previa de conversión</p>
                {[10, 25, 50, 100].map(usd => (
                  <div key={usd} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">USD ${usd}.00</span>
                    <span className="font-semibold text-primary">
                      {divisa.moneda === 'USD' ? `$ ${usd.toFixed(2)}`
                        : divisa.moneda === 'NIO' ? `C$ ${(usd * divisa.tipoCambio).toFixed(2)}`
                        : `₡ ${(usd * divisa.tipoCambio).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveDivisa} disabled={divisaSaving} className="gap-1.5 glow-gold">
                  {divisaSaving ? <RefreshCcw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                  {divisaSaving ? 'Guardando...' : 'Guardar tipo de cambio'}
                </Button>
              </div>
            </Card>
          )}

          {/* ── Tab: WhatsApp ──────────────────────────────────── */}
          {tab === 'whatsapp' && (
            <Card className="p-6 border-border/50 space-y-5">
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
            </Card>
          )}

          {/* ── Tab: Apariencia ──────────────────────────────── */}
          {tab === 'apariencia' && (
            <Card className="p-6 border-border/50 space-y-5">
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
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
