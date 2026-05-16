'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Scissors, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Login() {
  const router    = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [shake,    setShake]      = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas');
      toast.success('¡Bienvenido al sistema!');
      window.location.href = '/dashboard';
    } catch (err: any) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      toast.error(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Panel izquierdo — Branding */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-[hsl(var(--sidebar))] p-12 relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-primary/10 blur-3xl"/>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl"/>

        {/* Logo */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-xl">
            <Scissors className="w-5 h-5 text-white"/>
          </div>
          <div>
            <p className="text-[hsl(var(--sidebar-foreground))] font-bold text-lg leading-tight">HAIR STYLE</p>
            <p className="text-[hsl(var(--sidebar-primary))] text-xs tracking-widest uppercase">Salón & Barber</p>
          </div>
        </div>

        {/* Copy central */}
        <div className="z-10 space-y-4">
          <h1 className="text-4xl font-bold text-[hsl(var(--sidebar-foreground))] leading-tight">
            La mejor plataforma<br/>
            para tu <span className="text-[hsl(var(--sidebar-primary))]">barbería</span>
          </h1>
          <p className="text-[hsl(var(--sidebar-foreground)/0.6)] text-base leading-relaxed">
            Gestiona citas, clientes, empleados y reportes en un solo lugar. Más tiempo para lo que importa.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              { label: 'Citas sin conflictos', icon: '📅' },
              { label: 'Reportes detallados', icon: '📊' },
              { label: 'Historial de clientes', icon: '👤' },
              { label: 'Notificaciones WhatsApp', icon: '💬' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2 text-sm text-[hsl(var(--sidebar-foreground)/0.7)]">
                <span>{f.icon}</span>{f.label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[hsl(var(--sidebar-foreground)/0.3)] text-xs z-10">
          © 2025 HAIR STYLE Salón & Barber · Todos los derechos reservados
        </p>
      </div>

      {/* Panel derecho — Formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Fondo decorativo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/3 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"/>

        <div className={cn('w-full max-w-md z-10 transition-all', shake && 'animate-bounce')}>
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white"/>
            </div>
            <span className="font-bold text-foreground">HAIR STYLE</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Acceso al sistema</h2>
            <p className="text-muted-foreground mt-1 text-sm">Portal administrativo interno</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                <Input
                  type="email"
                  placeholder="admin@hairstyle.com"
                  className="pl-10 h-11 bg-card border-border/60 focus:border-primary"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 bg-card border-border/60 focus:border-primary"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold glow-gold" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/>
                  Verificando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Entrar al sistema
                  <ArrowRight className="w-4 h-4"/>
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground/50 mt-8">
            Sistema de uso interno · Solo personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}
