'use client';

import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';

interface NavbarProps {
  showLoginButton?: boolean;
  onLoginClick?: () => void;
}

export function Navbar({ showLoginButton = false, onLoginClick }: NavbarProps) {
  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Logo />

          {showLoginButton && (
            <div className="flex gap-3">
              <Button variant="default" onClick={onLoginClick} className="font-semibold shadow-md">
                Iniciar Sesión
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
