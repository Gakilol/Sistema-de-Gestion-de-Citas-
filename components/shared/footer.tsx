'use client';

import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="mb-6">
              <Logo width={180} height={60} />
            </div>
            <p className="text-sm text-muted-foreground">
              Sistema profesional de gestión para barberías y salones premium.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Servicios</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-primary transition">Cortes de Cabello</Link></li>
              <li><Link href="#" className="hover:text-primary transition">Cuidado de Barba</Link></li>
              <li><Link href="#" className="hover:text-primary transition">Tratamientos Premium</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Empresa</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-primary transition">Nosotros</Link></li>
              <li><Link href="#" className="hover:text-primary transition">Ubicación</Link></li>
              <li><Link href="#" className="hover:text-primary transition">Contacto</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-primary transition">Privacidad</Link></li>
              <li><Link href="#" className="hover:text-primary transition">Términos de Servicio</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
            <p>© {currentYear} HAIR STYLE Salón & Barber. Todos los derechos reservados.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="#" className="hover:text-primary transition">Instagram</Link>
              <Link href="#" className="hover:text-primary transition">Facebook</Link>
              <Link href="#" className="hover:text-primary transition">WhatsApp</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
