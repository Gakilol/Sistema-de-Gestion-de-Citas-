'use client';

import { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, Scissors, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';

let autoLoginRequestStarted = false;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No fue posible iniciar sesión';
}

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [shake,    setShake]      = useState(false);
  const [isCheckingAutoLogin, setIsCheckingAutoLogin] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', rememberDevice: false });

  useEffect(() => {
    const checkAutoLogin = async () => {
      // Evitar que StrictMode o re-renders concurrentes disparen doble petición (lo cual invalidaría el token por rotación)
      if (autoLoginRequestStarted) return;
      autoLoginRequestStarted = true;

      try {
        const res = await fetch('/api/auth/auto-login', {
          method: 'POST',
          credentials: 'same-origin', // Garantizar el envío de cookies en el mismo origen
        });
        if (res.ok) {
          toast.success('¡Bienvenido de nuevo!');
          const searchParams = new URLSearchParams(window.location.search);
          const redirectPath = searchParams.get('redirect') || '/dashboard';
          window.location.href = redirectPath;
        } else {
          autoLoginRequestStarted = false; // Permitir reintento
          setIsCheckingAutoLogin(false);
        }
      } catch {
        autoLoginRequestStarted = false;
        setIsCheckingAutoLogin(false);
      }
    };
    checkAutoLogin();
  }, []);

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
      const searchParams = new URLSearchParams(window.location.search);
      const redirectPath = searchParams.get('redirect') || '/dashboard';
      window.location.href = redirectPath;
    } catch (err: unknown) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      toast.error(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  if (isCheckingAutoLogin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mb-6 flex size-14 animate-pulse items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          <Scissors className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Comprobando tu sesión</h2>
        <p className="mt-2 text-sm text-muted-foreground">Preparando tu espacio de trabajo…</p>
      </div>
    );
  }

  return (
    <AuthShell>
        <div className={cn('transition-transform', shake && 'translate-x-1')}>
          <div className="mb-8 border-l-2 border-primary pl-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Portal del equipo</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Bienvenido de nuevo</h2>
            <p className="mt-2 text-sm text-muted-foreground">Ingresa tus datos para abrir la agenda.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                <Input
                  id="login-email"
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
              <label htmlFor="login-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                <Input
                  id="login-password"
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
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-0 top-1/2 size-11 -translate-y-1/2 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <Link href="/olvide-contrasena" className="text-xs font-medium text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            {/* Recordar dispositivo */}
            <div className="flex items-center space-x-2 py-1">
              <Checkbox
                id="rememberDevice"
                checked={form.rememberDevice}
                onCheckedChange={(checked) => setForm({ ...form, rememberDevice: !!checked })}
              />
              <label
                htmlFor="rememberDevice"
                className="text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
              >
                Recordar este dispositivo por 60 días
              </label>
            </div>

            <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={isLoading}>
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

          <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
            Tus credenciales se verifican de forma segura.
          </p>
        </div>
    </AuthShell>
  );
}
