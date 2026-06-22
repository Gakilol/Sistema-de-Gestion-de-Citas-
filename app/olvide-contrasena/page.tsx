'use client';

import { useState } from 'react';
import { Mail, ArrowLeft, Scissors, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';

export default function OlvideContrasena() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('El correo electrónico es requerido');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar solicitud');
      
      setSuccess(true);
      toast.success('Solicitud enviada correctamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la solicitud');
    } finally {
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
            Recupera el acceso<br/>
            a tu <span className="text-[hsl(var(--sidebar-primary))]">cuenta</span>
          </h1>
          <p className="text-[hsl(var(--sidebar-foreground)/0.6)] text-base leading-relaxed">
            Te enviaremos un correo con un enlace temporal para que puedas restablecer tu contraseña y volver a ingresar al sistema de forma segura.
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

        <div className="w-full max-w-md z-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white"/>
            </div>
            <span className="font-bold text-foreground">HAIR STYLE</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">¿Olvidaste tu contraseña?</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Ingresa tu correo registrado para recibir las instrucciones de restablecimiento.
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                  Correo electrónico de la cuenta
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                  <Input
                    type="email"
                    placeholder="ejemplo@hairstyle.com"
                    className="pl-10 h-11 bg-card border-border/60 focus:border-primary"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 text-sm font-semibold glow-gold" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/>
                    Enviando correo...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Enviar enlace de recuperación
                    <Send className="w-4 h-4"/>
                  </span>
                )}
              </Button>

              <div className="text-center pt-2">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5"/>
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                <Send className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Correo enviado</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Si el correo electrónico <strong>{email}</strong> está asociado a una cuenta activa en el sistema, recibirás un enlace de restablecimiento en unos momentos.
                </p>
                <p className="text-xs text-muted-foreground/75 leading-relaxed pt-2">
                  No olvides revisar también tu bandeja de spam o correo no deseado.
                </p>
              </div>
              <div className="pt-4 border-t border-border/50">
                <Link href="/login">
                  <Button variant="outline" className="w-full h-11 text-sm font-semibold">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver al inicio de sesión
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground/50 mt-8">
            Sistema de uso interno · Solo personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}
