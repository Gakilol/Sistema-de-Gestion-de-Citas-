'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';

export default function RestablecerContrasena() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/olvide-contrasena');
  }, [router]);

  return (
    <AuthShell
      asideTitle="Recupera el acceso sin perder el ritmo."
      asideDescription="Te llevamos al proceso seguro de verificación para proteger la cuenta y la agenda."
    >
      <div className="surface-panel flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Preparando la recuperación</h1>
          <p className="mt-1 text-sm text-muted-foreground">Te estamos llevando al formulario seguro…</p>
        </div>
      </div>
    </AuthShell>
  );
}
