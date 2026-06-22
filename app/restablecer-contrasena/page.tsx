'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ArrowLeft, Scissors, Eye, EyeOff, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password strength checks
  const hasMinLength = password.length >= 6;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  useEffect(() => {
    if (!token) {
      toast.error('Token de restablecimiento no válido o ausente');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Token inválido. Por favor solicita un nuevo enlace.');
      return;
    }

    if (!hasMinLength) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al restablecer la contraseña');

      setSuccess(true);
      toast.success('Contraseña actualizada exitosamente');
      setTimeout(() => {
        router.push('/login');
      }, 4000);
    } catch (err: any) {
      toast.error(err.message || 'Error al restablecer la contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md z-10">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 mb-8 lg:hidden">
        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
          <Scissors className="w-4 h-4 text-white"/>
        </div>
        <span className="font-bold text-foreground">HAIR STYLE</span>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Establece tu nueva contraseña</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Asegúrate de usar una contraseña segura que puedas recordar.
        </p>
      </div>

      {!token ? (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-4 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <div className="space-y-1">
            <h4 className="font-semibold text-foreground text-sm">Enlace inválido o incompleto</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              El enlace utilizado no contiene un token de seguridad válido. Vuelve a solicitar un enlace de recuperación.
            </p>
          </div>
          <Link href="/olvide-contrasena" className="block">
            <Button variant="outline" size="sm" className="w-full text-xs">
              Solicitar nueva recuperación
            </Button>
          </Link>
        </div>
      ) : !success ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
              Nueva contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
              <Input
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                className="pl-10 pr-10 h-11 bg-card border-border/60 focus:border-primary"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={isLoading}
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

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
              Confirmar contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
              <Input
                type={showConfirmPass ? 'text' : 'password'}
                placeholder="Repite la contraseña"
                className="pl-10 pr-10 h-11 bg-card border-border/60 focus:border-primary"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
              </button>
            </div>
          </div>

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <div className="p-3 bg-secondary/20 rounded-lg border border-border/50 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Requisitos de seguridad
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", hasMinLength ? "bg-emerald-500" : "bg-muted")} />
                  <span className={hasMinLength ? "text-foreground" : "text-muted-foreground"}>Mínimo 6 caracteres</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", hasNumber ? "bg-emerald-500" : "bg-muted")} />
                  <span className={hasNumber ? "text-foreground" : "text-muted-foreground"}>Al menos un número</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", hasSpecial ? "bg-emerald-500" : "bg-muted")} />
                  <span className={hasSpecial ? "text-foreground" : "text-muted-foreground"}>Carácter especial</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", passwordsMatch ? "bg-emerald-500" : "bg-muted")} />
                  <span className={passwordsMatch ? "text-foreground" : "text-muted-foreground"}>Coinciden</span>
                </div>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-sm font-semibold glow-gold" disabled={isLoading || !passwordsMatch || !hasMinLength}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/>
                Actualizando contraseña...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Restablecer contraseña
                <ShieldCheck className="w-4 h-4"/>
              </span>
            )}
          </Button>

          <div className="text-center pt-2">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5"/>
              Cancelar y volver a login
            </Link>
          </div>
        </form>
      ) : (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 animate-pulse">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">¡Contraseña restablecida!</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tu contraseña ha sido restablecida exitosamente. Serás redirigido al portal de acceso en unos segundos.
            </p>
          </div>
          <div className="pt-4 border-t border-border/50">
            <Link href="/login" className="block w-full">
              <Button className="w-full h-11 text-sm font-semibold glow-gold">
                Ir al inicio de sesión inmediatamente
              </Button>
            </Link>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground/50 mt-8">
        Sistema de uso interno · Solo personal autorizado
      </p>
    </div>
  );
}

export default function RestablecerContrasena() {
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
            Restablece tu<br/>
            acceso de <span className="text-[hsl(var(--sidebar-primary))]">seguridad</span>
          </h1>
          <p className="text-[hsl(var(--sidebar-foreground)/0.6)] text-base leading-relaxed">
            Ingresa y confirma tu nueva contraseña. Esta cambiará de inmediato en la base de datos para todas tus sesiones futuras.
          </p>
        </div>

        {/* Footer */}
        <p className="text-[hsl(var(--sidebar-foreground)/0.3)] text-xs z-10">
          &copy; 2025 HAIR STYLE Salón & Barber · Todos los derechos reservados
        </p>
      </div>

      {/* Panel derecho — Formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Fondo decorativo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/3 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"/>

        <Suspense fallback={
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando formulario...</p>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
