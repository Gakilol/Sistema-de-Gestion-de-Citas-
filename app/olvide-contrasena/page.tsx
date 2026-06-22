'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Scissors, Send, Eye, EyeOff, Lock, CheckCircle2, ShieldCheck, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function OlvideContrasena() {
  const router = useRouter();
  
  // Asistente multi-paso: 1 = Email, 2 = Código OTP, 3 = Nueva Contraseña, 4 = Éxito
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  
  // Paso 2: Código OTP
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [expireTimer, setExpireTimer] = useState(600); // 10 minutos
  const [resendTimer, setResendTimer] = useState(60); // 60 segundos

  // Paso 3: Nueva Contraseña
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Paso 4: Redirección automática
  const [redirectCount, setRedirectCount] = useState(5);

  // Requisitos de seguridad para la contraseña
  const hasMinLength = password.length >= 6;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isPasswordValid = hasMinLength && hasNumber && hasSpecial && passwordsMatch;

  // Temporizadores para el paso 2
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 2) {
      interval = setInterval(() => {
        setExpireTimer((prev) => (prev > 0 ? prev - 1 : 0));
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step]);

  // Redirección en paso 4
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 4) {
      interval = setInterval(() => {
        setRedirectCount((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            router.push('/login');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, router]);

  // Formatear temporizador (MM:SS)
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Enviar correo con código
  const handleRequestCode = async (e: React.FormEvent) => {
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
      if (!res.ok) throw new Error(data.error || 'Error al enviar código');

      setStep(2);
      setExpireTimer(600); // reiniciar 10 mins
      setResendTimer(60); // reiniciar 60 segs
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
      toast.success('Código de verificación enviado');
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar la solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  // Reenviar código
  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reenviar código');

      setExpireTimer(600);
      setResendTimer(60);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
      toast.success('Código reenviado correctamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al reenviar el código');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar cambio en cajas de código OTP
  const handleOtpChange = (index: number, val: string) => {
    // Solo permitir números
    if (val !== '' && !/^[0-9]$/.test(val)) return;

    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Mover foco al siguiente input si se ingresó un dígito
    if (val !== '' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Manejar tecla Backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        otpInputsRef.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  // Manejar pegado de código (Paste)
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const digits = pastedData.split('');
    setOtp(digits);
    otpInputsRef.current[5]?.focus();
  };

  // Verificar código
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      toast.error('Debes ingresar el código de 6 dígitos');
      return;
    }

    if (expireTimer === 0) {
      toast.error('El código ha expirado. Por favor solicita uno nuevo.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código inválido');

      toast.success('Código verificado correctamente');
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || 'Código incorrecto o expirado');
    } finally {
      setIsLoading(false);
    }
  };

  // Restablecer contraseña
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      toast.error('Asegúrate de que la contraseña cumpla con los requisitos de seguridad');
      return;
    }

    setIsLoading(true);
    try {
      const code = otp.join('');
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: code, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar contraseña');

      toast.success('Contraseña actualizada exitosamente');
      setStep(4);
    } catch (err: any) {
      toast.error(err.message || 'Error al restablecer contraseña');
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
            Acceso seguro<br/>
            y <span className="text-[hsl(var(--sidebar-primary))]">protegido</span>
          </h1>
          <p className="text-[hsl(var(--sidebar-foreground)/0.6)] text-base leading-relaxed">
            Hemos mejorado nuestra seguridad. Ahora recibirás un código OTP de 6 dígitos de corta duración en tu correo para validar de forma fehaciente tu identidad antes de cambiar la contraseña.
          </p>
        </div>

        {/* Footer */}
        <p className="text-[hsl(var(--sidebar-foreground)/0.3)] text-xs z-10">
          &copy; {new Date().getFullYear()} HAIR STYLE Salón & Barber · Todos los derechos reservados
        </p>
      </div>

      {/* Panel derecho — Formulario interactivo */}
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

          {/* PASO 1: Solicitar Código */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Recuperar contraseña</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Ingresa tu correo registrado para recibir un código de verificación de 6 dígitos.
                </p>
              </div>

              <form onSubmit={handleRequestCode} className="space-y-5">
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
                      Enviando código...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Enviar código de verificación
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
            </div>
          )}

          {/* PASO 2: Verificar Código (OTP) */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Cambiar correo
                </button>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                    <Key className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Código de Verificación</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ingresa el código enviado a <strong className="text-foreground/90">{email}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block text-center">
                    Código de 6 dígitos
                  </label>
                  <div className="flex justify-between gap-2.5">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { otpInputsRef.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={handleOtpPaste}
                        disabled={isLoading || expireTimer === 0}
                        className={cn(
                          "w-12 h-14 text-center text-xl font-bold rounded-xl border bg-card text-foreground transition-all outline-none",
                          digit 
                            ? "border-primary ring-1 ring-primary/30" 
                            : "border-border/60 focus:border-primary/70 focus:ring-1 focus:ring-primary/20",
                          expireTimer === 0 && "opacity-50 border-destructive"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className={cn(
                    "font-medium",
                    expireTimer < 60 ? "text-destructive font-semibold animate-pulse" : "text-muted-foreground"
                  )}>
                    {expireTimer > 0 ? `Expira en: ${formatTime(expireTimer)}` : 'Código expirado'}
                  </span>
                  
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendTimer > 0 || isLoading}
                    className={cn(
                      "font-semibold transition-colors flex items-center gap-1",
                      resendTimer > 0 
                        ? "text-muted-foreground cursor-not-allowed" 
                        : "text-primary hover:text-primary-hover cursor-pointer"
                    )}
                  >
                    {resendTimer > 0 ? `Reenviar en ${resendTimer}s` : 'Reenviar código'}
                  </button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 text-sm font-semibold glow-gold" 
                  disabled={isLoading || otp.join('').length !== 6 || expireTimer === 0}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/>
                      Verificando...
                    </span>
                  ) : (
                    <span>Verificar Código</span>
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* PASO 3: Nueva Contraseña */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Establece tu nueva contraseña</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Crea una contraseña segura para proteger el acceso a tu cuenta.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-5">
                {/* Nueva Contraseña */}
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

                {/* Confirmar Contraseña */}
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

                {/* Indicador de Fortaleza */}
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

                <Button 
                  type="submit" 
                  className="w-full h-11 text-sm font-semibold glow-gold" 
                  disabled={isLoading || !isPasswordValid}
                >
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
                    Cancelar y volver a login
                  </Link>
                </div>
              </form>
            </div>
          )}

          {/* PASO 4: Éxito */}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">¡Contraseña restablecida!</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tu contraseña ha sido restablecida exitosamente. Serás redirigido al portal de acceso en unos instantes.
                </p>
                <p className="text-xs text-primary/80 font-medium">
                  Redireccionando en {redirectCount} segundos...
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
      </div>
    </div>
  );
}
