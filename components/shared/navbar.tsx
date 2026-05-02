'use client';

import Link from 'next/link';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavbarProps {
  showLoginButton?: boolean;
  onLoginClick?: () => void;
}

export function Navbar({ showLoginButton = false, onLoginClick }: NavbarProps) {
  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:inline">
              AppointmentHub
            </span>
          </Link>

          {showLoginButton && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={onLoginClick}>
                Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
