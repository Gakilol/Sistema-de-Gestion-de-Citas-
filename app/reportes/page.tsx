'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, Users, Download, Calendar, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'citas',     label: 'Citas',       icon: Calendar },
  { id: 'empleados', label: 'Empleados',   icon: Users },
];

const PIE_COLORS = ['#d4a017', '#10b981', '#3b82f6', '#a855f7', '#f97316', '#06b6d4'];
const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  EN_PROGRESO: 'En Progreso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  REPROGRAMADA: 'Reprogramada',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl border border-border/50">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// Preset de fechas
function getPreset(preset: string) {
  const now  = new Date();
  const fmt  = (d: Date) => d.toISOString().split('T')[0];
  const map: Record<string, [string, string]> = {
    '7d':  [fmt(new Date(Date.now() - 6 * 864e5)), fmt(now)],
    '30d': [fmt(new Date(Date.now() - 29 * 864e5)), fmt(now)],
    'mes': [fmt(new Date(now.getFullYear(), now.getMonth(), 1)), fmt(now)],
    '3m':  [fmt(new Date(now.getFullYear(), now.getMonth() - 2, 1)), fmt(now)],
  };
  return map[preset] ?? map['30d'];
}

export default function Reportes() {
  const [tab, setTab]           = useState('citas');
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [preset, setPreset]     = useState('30d');
  const [[desde, hasta], setRango] = useState<[string, string]>(getPreset('30d'));

  const fetchData = useCallback(async (tipo: string, d: string, h: string) => {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/reportes?tipo=${tipo}&desde=${d}&hasta=${h}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(tab, desde, hasta);
  }, [tab, desde, hasta, fetchData]);

  const applyPreset = (p: string) => {
    const rango = getPreset(p);
    setPreset(p);
    setRango(rango);
  };

  // ─── Exportar PDF ──────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!data) return;

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const fechaGenerado = new Date().toLocaleDateString('es-NI', { day: '2-digit', month: 'long', year: 'numeric' });

    // Encabezado
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('HAIR STYLE - Reporte de Reservas', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Período: ${desde} al ${hasta}`, 14, 26);
    doc.text(`Generado: ${fechaGenerado}`, 14, 32);
    doc.line(14, 36, 196, 36);

    if (tab === 'empleados' && data.data) {
      doc.setFontSize(13);
      doc.setTextColor(40, 40, 40);
      doc.text('Productividad del Personal', 14, 45);

      autoTable(doc, {
        startY: 52,
        head: [['#', 'Empleado', 'Especialidad', 'Citas Atendidas']],
        body: data.data.map((r: any, i: number) => [
          i + 1, r.nombre, r.especialidad, r.citas,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [212, 160, 23], textColor: 255 },
        alternateRowStyles: { fillColor: [250, 248, 240] },
      });
    } else if (tab === 'citas') {
      doc.setFontSize(13);
      doc.setTextColor(40, 40, 40);
      doc.text('Resumen de Citas', 14, 45);

      if (data.porEstado?.length > 0) {
        autoTable(doc, {
          startY: 52,
          head: [['Estado', 'Cantidad']],
          body: data.porEstado.map((r: any) => [ESTADO_LABEL[r.estado] ?? r.estado, r.cantidad]),
          theme: 'grid',
          headStyles: { fillColor: [212, 160, 23], textColor: 255 },
        });
      }

      if (data.porEmpleado?.length > 0) {
        const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text('Por Empleado', 14, finalY + 10);
        autoTable(doc, {
          startY: finalY + 16,
          head: [['Empleado', 'Citas']],
          body: data.porEmpleado.map((r: any) => [r.nombre, r.citas]),
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        });
      }
    }

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(`Página ${i} de ${totalPages} - HAIR STYLE Salon & Barber`, 14, doc.internal.pageSize.height - 8);
    }

    doc.save(`reporte-${tab}-${desde}-${hasta}.pdf`);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
              <p className="text-sm text-muted-foreground">Análisis y estadísticas de agendamiento</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Exportar PDF
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  tab === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>

          {/* Rango de fechas */}
          <Card className="p-4 border-border/50">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                {[{ k: '7d', l: '7 días' }, { k: '30d', l: '30 días' }, { k: 'mes', l: 'Este mes' }, { k: '3m', l: '3 meses' }].map(p => (
                  <button
                    key={p.k}
                    onClick={() => applyPreset(p.k)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      preset === p.k ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Input type="date" value={desde} onChange={e => { setPreset(''); setRango([e.target.value, hasta]); }} className="h-8 text-xs w-36" />
                <span className="text-muted-foreground text-xs">—</span>
                <Input type="date" value={hasta} onChange={e => { setPreset(''); setRango([desde, e.target.value]); }} className="h-8 text-xs w-36" />
              </div>
            </div>
          </Card>

          {/* Contenido */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : !data ? null : (
            <>
              {/* TAB: Citas */}
              {tab === 'citas' && data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="p-5 border-border/50">
                    <h2 className="text-sm font-semibold mb-4">Por Estado</h2>
                    {data.porEstado?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={data.porEstado}
                            dataKey="cantidad"
                            nameKey="estado"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            paddingAngle={3}
                            label={({ estado, cantidad }) => `${ESTADO_LABEL[estado] ?? estado}: ${cantidad}`}
                            labelLine={false}
                          >
                            {data.porEstado.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip
                            formatter={(v, n) => [v, ESTADO_LABEL[n as string] ?? n]}
                            contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">Sin datos</p>}
                  </Card>

                  <Card className="p-5 border-border/50">
                    <h2 className="text-sm font-semibold mb-4">Servicios más solicitados</h2>
                    {data.porServicio?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data.porServicio} layout="vertical" margin={{ left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={90} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="cantidad" name="Citas" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">Sin datos</p>}
                  </Card>

                  <Card className="p-5 border-border/50 lg:col-span-2">
                    <h2 className="text-sm font-semibold mb-4">Citas por Empleado</h2>
                    {data.porEmpleado?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={data.porEmpleado}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="citas" name="Citas" fill="#d4a017" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">Sin datos</p>}
                  </Card>
                </div>
              )}

              {/* TAB: Empleados */}
              {tab === 'empleados' && data?.data && (
                <Card className="border-border/50 overflow-hidden">
                  <div className="p-5 border-b border-border/50">
                    <h2 className="text-sm font-semibold">Productividad del Personal</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/70">
                      <tr>
                        {['#', 'Empleado', 'Especialidad', 'Citas Atendidas'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((e: any, i: number) => (
                        <tr key={i} className="border-t border-border/40 hover:bg-secondary/20 transition-colors">
                          <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{i + 1}</td>
                          <td className="px-5 py-3.5 font-semibold text-foreground">{e.nombre}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{e.especialidad}</td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">{e.citas}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
