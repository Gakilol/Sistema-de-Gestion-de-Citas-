import { useEffect, useCallback, useRef } from 'react';

interface UpcomingCita {
  id: string;
  cliente_nombre: string;
  hora: string;
  fecha: string;
  servicio?: { nombre: string };
  empleado?: { nombre: string };
}

export function useBrowserNotifications(citas: UpcomingCita[] = []) {
  const notifiedSet = useRef<Set<string>>(new Set());

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  }, []);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });
        
        // Emite sonido ligero si es soportado
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.value = 587.33; // D5 note
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.3);
        } catch (e) {
          // Audio fallback silencioso
        }

        return notif;
      } catch (e) {
        console.error('Error al emitir notificación web:', e);
      }
    }
  }, []);

  // Monitor de proximidad de citas (revisa cada 30 segundos)
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const checkUpcoming = () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      citas.forEach((cita) => {
        // Normalizar fecha de la cita (YYYY-MM-DD)
        const citaFecha = typeof cita.fecha === 'string' 
          ? cita.fecha.split('T')[0] 
          : new Date(cita.fecha).toISOString().split('T')[0];

        if (citaFecha !== todayStr) return;

        const [h, m] = cita.hora.split(':').map(Number);
        const citaMinutes = h * 60 + m;
        const diffMinutes = citaMinutes - currentMinutes;

        // Notificar citas a 15 minutos o menos de iniciar (y aún no notificados)
        const key = `${cita.id}-15min`;
        if (diffMinutes > 0 && diffMinutes <= 15 && !notifiedSet.current.has(key)) {
          notifiedSet.current.add(key);
          sendNotification(`⏰ Próxima Cita en ${diffMinutes} min`, {
            body: `${cita.cliente_nombre} - ${cita.servicio?.nombre || 'Servicio'} con ${cita.empleado?.nombre || 'Profesional'} a las ${cita.hora}`,
            tag: key,
          });
        }
      });
    };

    checkUpcoming();
    const interval = setInterval(checkUpcoming, 30000);
    return () => clearInterval(interval);
  }, [citas, sendNotification]);

  return { requestPermission, sendNotification };
}
