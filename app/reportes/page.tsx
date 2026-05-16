'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, DollarSign, Users, Scissors, Download, Calendar, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'ingresos',  label: 'Ingresos',   icon: DollarSign },
  { id: 'citas',     label: 'Citas',       icon: Calendar },
  { id: 'empleados', label: 'Empleados',   icon: Users },
];

const PIE_COLORS = ['#d4a017','#10b981','#3b82f6','#a855f7','#f97316','#06b6d4'];
const ESTADO_LABEL: Record<string,string> = {
  PENDIENTE:'Pendiente', CONFIRMADA:'Confirmada', EN_PROGRESO:'En Progreso',
  COMPLETADA:'Completada', CANCELADA:'Cancelada', REPROGRAMADA:'Reprogramada',
};

function fmtUSD(n:number) {
  return new Intl.NumberFormat('es-NI',{style:'currency',currency:'USD'}).format(n);
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active||!payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl border border-border/50">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p:any,i:number)=>(
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{background:p.color}}/>
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{p.name==='Ingresos'?fmtUSD(p.value):p.value}</span>
        </div>
      ))}
    </div>
  );
}

// Preset de fechas
function getPreset(preset: string) {
  const now  = new Date();
  const fmt  = (d:Date) => d.toISOString().split('T')[0];
  const map: Record<string,[string,string]> = {
    '7d':  [fmt(new Date(Date.now()-6*864e5)), fmt(now)],
    '30d': [fmt(new Date(Date.now()-29*864e5)),fmt(now)],
    'mes': [fmt(new Date(now.getFullYear(),now.getMonth(),1)), fmt(now)],
    '3m':  [fmt(new Date(now.getFullYear(),now.getMonth()-2,1)), fmt(now)],
  };
  return map[preset] ?? map['30d'];
}

export default function Reportes() {
  const [tab, setTab]           = useState('ingresos');
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [preset, setPreset]     = useState('30d');
  const [[desde, hasta], setRango] = useState<[string,string]>(getPreset('30d'));

  const fetchData = useCallback(async (tipo:string, d:string, h:string) => {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/reportes?tipo=${tipo}&desde=${d}&hasta=${h}`);
      const json = await res.json();
      setData(json);
    } finally { setLoading(false); }
  }, []);

  useEffect(()=>{ fetchData(tab,desde,hasta); }, [tab, desde, hasta, fetchData]);

  const applyPreset = (p:string) => {
    const rango = getPreset(p);
    setPreset(p); setRango(rango);
  };

  const handleExportCSV = () => {
    if (!data) return;
    let rows: string[][] = [];
    let headers: string[] = [];

    if (tab==='ingresos' && data.data) {
      headers = ['Fecha','Ingresos (USD)'];
      rows = data.data.map((r:any)=>[r.fecha, r.ingresos.toFixed(2)]);
    } else if (tab==='empleados' && data.data) {
      headers = ['Empleado','Especialidad','Citas','Ingresos (USD)'];
      rows = data.data.map((r:any)=>[r.nombre,r.especialidad,r.citas,r.ingresos.toFixed(2)]);
    }

    if (!rows.length) return;
    const csv = [headers, ...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`reporte-${tab}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar/>
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 page-enter">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
              <p className="text-sm text-muted-foreground">Análisis y estadísticas del negocio</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <Download className="w-3.5 h-3.5"/> Exportar CSV
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  tab===t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <t.icon className="w-3.5 h-3.5"/>{t.label}
              </button>
            ))}
          </div>

          {/* Rango de fechas */}
          <Card className="p-4 border-border/50">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                {[{k:'7d',l:'7 días'},{k:'30d',l:'30 días'},{k:'mes',l:'Este mes'},{k:'3m',l:'3 meses'}].map(p=>(
                  <button key={p.k} onClick={()=>applyPreset(p.k)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      preset===p.k?'bg-primary text-primary-foreground':'bg-secondary text-muted-foreground hover:text-foreground')}>
                    {p.l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Input type="date" value={desde} onChange={e=>{setPreset('');setRango([e.target.value,hasta]);}} className="h-8 text-xs w-36"/>
                <span className="text-muted-foreground text-xs">—</span>
                <Input type="date" value={hasta} onChange={e=>{setPreset('');setRango([desde,e.target.value]);}} className="h-8 text-xs w-36"/>
              </div>
            </div>
          </Card>

          {/* Contenido */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin"/>
            </div>
          ) : !data ? null : (

            <>
              {/* TAB: Ingresos */}
              {tab==='ingresos'&&(
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-5 border-border/50 card-accent-gold">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ingresos Totales</p>
                      <p className="text-3xl font-bold text-foreground">{fmtUSD(data.resumen?.total??0)}</p>
                    </Card>
                    <Card className="p-5 border-border/50 card-accent-emerald">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Citas Completadas</p>
                      <p className="text-3xl font-bold text-foreground">{data.resumen?.citas??0}</p>
                    </Card>
                  </div>
                  <Card className="p-5 border-border/50">
                    <h2 className="text-sm font-semibold mb-4">Ingresos por día</h2>
                    {data.data?.length>0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={data.data}>
                          <defs>
                            <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#d4a017" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#d4a017" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                          <XAxis dataKey="fecha" tick={{fontSize:10,fill:'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fontSize:10,fill:'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                          <Tooltip content={<ChartTooltip/>}/>
                          <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#d4a017" strokeWidth={2} fill="url(#gI)" dot={{r:3,fill:'#d4a017',strokeWidth:0}} activeDot={{r:5}}/>
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">Sin datos en el período seleccionado</p>}
                  </Card>
                </div>
              )}

              {/* TAB: Citas */}
              {tab==='citas'&&data&&(
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="p-5 border-border/50">
                    <h2 className="text-sm font-semibold mb-4">Por Estado</h2>
                    {data.porEstado?.length>0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={data.porEstado} dataKey="cantidad" nameKey="estado" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}
                            label={({estado,cantidad})=>`${ESTADO_LABEL[estado]??estado}: ${cantidad}`} labelLine={false}>
                            {data.porEstado.map((_:any,i:number)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                          </Pie>
                          <Tooltip formatter={(v,n)=>[v,ESTADO_LABEL[n as string]??n]}
                            contentStyle={{borderRadius:10,border:'1px solid hsl(var(--border))',background:'hsl(var(--card))',fontSize:12}}/>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">Sin datos</p>}
                  </Card>

                  <Card className="p-5 border-border/50">
                    <h2 className="text-sm font-semibold mb-4">Servicios más solicitados</h2>
                    {data.porServicio?.length>0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data.porServicio} layout="vertical" margin={{left:0}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false}/>
                          <XAxis type="number" tick={{fontSize:10,fill:'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false}/>
                          <YAxis type="category" dataKey="nombre" tick={{fontSize:10,fill:'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false} width={90}/>
                          <Tooltip content={<ChartTooltip/>}/>
                          <Bar dataKey="cantidad" name="Citas" fill="#3b82f6" radius={[0,4,4,0]} maxBarSize={20}/>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">Sin datos</p>}
                  </Card>

                  <Card className="p-5 border-border/50 lg:col-span-2">
                    <h2 className="text-sm font-semibold mb-4">Citas por Empleado</h2>
                    {data.porEmpleado?.length>0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={data.porEmpleado}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                          <XAxis dataKey="nombre" tick={{fontSize:11,fill:'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fontSize:11,fill:'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false}/>
                          <Tooltip content={<ChartTooltip/>}/>
                          <Bar dataKey="citas" name="Citas" fill="#d4a017" radius={[4,4,0,0]} maxBarSize={50}/>
                          <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4,4,0,0]} maxBarSize={50}/>
                          <Legend wrapperStyle={{fontSize:11}}/>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm text-center py-10">Sin datos</p>}
                  </Card>
                </div>
              )}

              {/* TAB: Empleados */}
              {tab==='empleados'&&data?.data&&(
                <Card className="border-border/50 overflow-hidden">
                  <div className="p-5 border-b border-border/50">
                    <h2 className="text-sm font-semibold">Productividad del Personal</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/70">
                      <tr>
                        {['#','Empleado','Especialidad','Citas','Ingresos generados'].map(h=>(
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((e:any,i:number)=>(
                        <tr key={i} className="border-t border-border/40 hover:bg-secondary/20 transition-colors">
                          <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{i+1}</td>
                          <td className="px-5 py-3.5 font-semibold text-foreground">{e.nombre}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{e.especialidad}</td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">{e.citas}</span>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-emerald-500 dark:text-emerald-400">{fmtUSD(e.ingresos)}</td>
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
