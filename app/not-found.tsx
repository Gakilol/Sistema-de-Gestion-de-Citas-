'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-primary mb-4">404</p>
        <h1 className="text-2xl font-bold text-foreground mb-2">Página no encontrada</h1>
        <p className="text-muted-foreground mb-8">
          La página que buscas no existe o fue movida.
        </p>
        <Button asChild>
          <Link href="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Panel
          </Link>
        </Button>
      </div>
    </div>
  );
}
