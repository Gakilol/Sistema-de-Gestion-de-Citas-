import { useEffect, useState } from 'react';
import { Loader2, Clock, CalendarX2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // asumiendo que existe

interface TimeBlock {
  hora: string;
  disponible: boolean;
  motivo: string;
}

interface TimeSelectorProps {
  empleadoId: string;
  fecha: string;
  servicioId: string;
  selectedTime: string;
  onTimeSelect: (time: string) => void;
}

export function TimeSelector({ empleadoId, fecha, servicioId, selectedTime, onTimeSelect }: TimeSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [bloques, setBloques] = useState<TimeBlock[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!empleadoId || !fecha) {
      setBloques([]);
      return;
    }

    const fetchDisponibilidad = async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ fecha });
        if (servicioId) query.append('servicio_id', servicioId);
        
        const res = await fetch(`/api/empleados/${empleadoId}/disponibilidad?${query.toString()}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Error al cargar disponibilidad');
        }

        if (!data.disponible && data.bloques.length === 0) {
          setError(data.motivo || 'No disponible este día');
          setBloques([]);
        } else {
          setBloques(data.bloques || []);
        }
      } catch (err: any) {
        setError(err.message);
        setBloques([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDisponibilidad();
  }, [empleadoId, fecha, servicioId]);

  if (!empleadoId || !fecha) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl text-muted-foreground bg-secondary/10">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm text-center">Selecciona un empleado y una fecha para ver los horarios disponibles.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-border rounded-xl bg-secondary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Calculando espacios disponibles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-red-200 bg-red-50/50 rounded-xl text-red-600">
        <CalendarX2 className="w-8 h-8 mb-2 opacity-80" />
        <p className="font-semibold text-center">{error}</p>
        <p className="text-xs text-red-500 mt-1">Intenta seleccionando otra fecha.</p>
      </div>
    );
  }

  if (bloques.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-border rounded-xl bg-secondary/10 text-muted-foreground">
        <CalendarX2 className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm font-medium">No hay horarios registrados para este día.</p>
      </div>
    );
  }

  // Separar en mañana y tarde para mejor visualización (opcional)
  const mañana = bloques.filter(b => parseInt(b.hora.split(':')[0]) < 13);
  const tarde = bloques.filter(b => parseInt(b.hora.split(':')[0]) >= 13);

  const renderGrid = (blocks: TimeBlock[]) => (
    <div className="grid grid-cols-4 gap-2">
      {blocks.map((bloque) => {
        const isSelected = selectedTime === bloque.hora;
        return (
          <button
            key={bloque.hora}
            type="button"
            disabled={!bloque.disponible}
            onClick={() => onTimeSelect(bloque.hora)}
            title={bloque.motivo}
            className={cn(
              "py-2 px-1 text-sm font-medium rounded-lg transition-all duration-200 flex flex-col items-center justify-center border",
              bloque.disponible 
                ? isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-md transform scale-105"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-sm"
                : "bg-red-50 text-red-400 border-red-100 cursor-not-allowed opacity-60"
            )}
          >
            <span>{bloque.hora}</span>
            {!bloque.disponible && (
              <span className="text-[9px] mt-0.5 leading-none opacity-80 text-center truncate w-full px-1">
                {bloque.motivo === 'Tiempo insuficiente' ? 'Corto' : bloque.motivo}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {mañana.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Mañana
          </h4>
          {renderGrid(mañana)}
        </div>
      )}
      
      {tarde.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Tarde / Noche
          </h4>
          {renderGrid(tarde)}
        </div>
      )}
    </div>
  );
}
