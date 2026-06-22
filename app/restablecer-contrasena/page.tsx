'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RestablecerContrasena() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/olvide-contrasena');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Redireccionando a la página de recuperación...</p>
      </div>
    </div>
  );
}
