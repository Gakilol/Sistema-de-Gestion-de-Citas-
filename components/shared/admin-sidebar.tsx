'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Calendar,
  Users,
  Settings,
  LogOut,
  Scissors,
  LayoutDashboard,
  BarChart3,
  UserRound,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  Sparkles,
  Clock,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface MenuItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  badge?: string;
  isNew?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

// ─── Toggle Tema ─────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycles = [
    { value: 'light', icon: Sun,     label: 'Claro' },
    { value: 'dark',  icon: Moon,    label: 'Oscuro' },
    { value: 'system', icon: Monitor, label: 'Sistema' },
  ];

  const current = cycles.find((c) => c.value === theme) ?? cycles[2];
  const next    = cycles[(cycles.indexOf(current) + 1) % cycles.length];
  const Icon    = current.icon;

  return (
    <button
      onClick={() => setTheme(next.value)}
      title={`Modo: ${current.label}. Clic para cambiar a ${next.label}`}
      className={cn(
        'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium',
        'text-[hsl(var(--sidebar-foreground)/0.7)] hover:text-[hsl(var(--sidebar-foreground))]',
        'hover:bg-[hsl(var(--sidebar-accent))] transition-all duration-200 group'
      )}
    >
      <span className={cn(
        'flex items-center justify-center w-7 h-7 rounded-md',
        'bg-[hsl(var(--sidebar-accent))] group-hover:bg-[hsl(var(--sidebar-primary)/0.15)] transition-colors'
      )}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="flex-1 text-left">{current.label}</span>
      <ChevronRight className="w-3 h-3 opacity-40 rotate-90" />
    </button>
  );
}

// ─── Avatar con iniciales ─────────────────────────────────────────────────
function UserAvatar({ nombre, rol }: { nombre: string; rol: string }) {
  const initials = nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const roleColors: Record<string, string> = {
    ADMIN:    'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
    EMPLEADO: 'bg-gradient-to-br from-slate-400 to-slate-600 text-white',
  };

  const roleLabels: Record<string, string> = {
    ADMIN:    'Administrador',
    EMPLEADO: 'Empleado',
  };

  return (
    <div className="flex items-center gap-3 px-3 py-4 border-b border-[hsl(var(--sidebar-border))]">
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg',
        roleColors[rol] ?? roleColors.EMPLEADO
      )}>
        {initials || <UserRound className="w-4 h-4" />}
      </div>
      <div className="overflow-hidden flex-1 min-w-0">
        <p className="font-semibold text-[hsl(var(--sidebar-foreground))] text-sm truncate leading-tight">
          {nombre || 'Cargando...'}
        </p>
        <p className="text-[10px] font-medium text-[hsl(var(--sidebar-primary))] tracking-wide mt-0.5">
          {roleLabels[rol] ?? rol}
        </p>
      </div>
    </div>
  );
}

// ─── Datos del Menú ────────────────────────────────────────────────────────
const menuGroups: MenuGroup[] = [
  {
    label: 'Principal',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['ADMIN', 'EMPLEADO'],
      },
    ],
  },
  {
    label: 'Gestión',
    items: [
      {
        title: 'Citas',
        href: '/citas',
        icon: Calendar,
        roles: ['ADMIN', 'EMPLEADO'],
      },
      {
        title: 'Clientes',
        href: '/clientes',
        icon: Users,
        roles: ['ADMIN', 'EMPLEADO'],
        isNew: true,
      },
    ],
  },
  {
    label: 'Administración',
    items: [
      {
        title: 'Servicios',
        href: '/servicios',
        icon: Scissors,
        roles: ['ADMIN'],
      },
      {
        title: 'Personal',
        href: '/empleados',
        icon: UserRound,
        roles: ['ADMIN'],
      },
      {
        title: 'Reportes',
        href: '/reportes',
        icon: BarChart3,
        roles: ['ADMIN'],
        isNew: true,
      },
      {
        title: 'Configuración',
        href: '/configuracion',
        icon: Settings,
        roles: ['ADMIN'],
      },
    ],
  },
];

// ─── Inner Sidebar Content ─────────────────────────────────────────────────
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--sidebar))]">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-[hsl(var(--sidebar-border))] flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-amber-500/30 transition-all">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[hsl(var(--sidebar-foreground))] font-bold text-sm leading-tight tracking-tight">
              HAIR STYLE
            </p>
            <p className="text-[hsl(var(--sidebar-primary))] text-[10px] font-medium tracking-widest uppercase">
              Salón & Barber
            </p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-[hsl(var(--sidebar-foreground)/0.5)] hover:text-[hsl(var(--sidebar-foreground))] transition-colors lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User info */}
      {user && <UserAvatar nombre={user.nombre} rol={user.rol} />}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((item) =>
            item.roles.includes(user?.rol ?? 'EMPLEADO')
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--sidebar-foreground)/0.35)]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                        isActive
                          ? 'bg-[hsl(var(--sidebar-primary)/0.15)] text-[hsl(var(--sidebar-primary))]'
                          : 'text-[hsl(var(--sidebar-foreground)/0.65)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
                      )}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[hsl(var(--sidebar-primary))] rounded-r-full" />
                      )}

                      <span className={cn(
                        'flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-all',
                        isActive
                          ? 'bg-[hsl(var(--sidebar-primary)/0.2)]'
                          : 'bg-[hsl(var(--sidebar-accent))] group-hover:bg-[hsl(var(--sidebar-primary)/0.1)]'
                      )}>
                        <item.icon className="w-3.5 h-3.5" />
                      </span>

                      <span className="flex-1">{item.title}</span>

                      {item.isNew && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[hsl(var(--sidebar-primary)/0.2)] text-[hsl(var(--sidebar-primary))]">
                          <Sparkles className="w-2 h-2" />
                          Nuevo
                        </span>
                      )}

                      {item.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[hsl(var(--sidebar-border))] space-y-1 flex-shrink-0">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium',
            'text-[hsl(var(--sidebar-foreground)/0.55)] hover:text-red-500',
            'hover:bg-red-500/10 transition-all duration-200 group'
          )}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-md bg-[hsl(var(--sidebar-accent))] group-hover:bg-red-500/10 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </span>
          Cerrar Sesión
        </button>

        {/* Version */}
        <p className="text-center text-[10px] text-[hsl(var(--sidebar-foreground)/0.2)] pt-1 pb-0.5">
          HAIR STYLE v1.2.0
        </p>
      </div>
    </div>
  );
}

// ─── Mobile Header ─────────────────────────────────────────────────────────
function MobileHeader({ onOpen }: { onOpen: () => void }) {
  const pathname = usePathname();
  const pageNames: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/citas': 'Citas',
    '/clientes': 'Clientes',
    '/servicios': 'Servicios',
    '/empleados': 'Personal',
    '/reportes': 'Reportes',
    '/configuracion': 'Configuración',
  };
  const currentPage = pageNames[pathname] ?? 'HAIR STYLE';

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[hsl(var(--sidebar))] border-b border-[hsl(var(--sidebar-border))] flex items-center gap-3 px-4">
      <button
        onClick={onOpen}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[hsl(var(--sidebar-foreground)/0.7)] hover:text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-600 rounded-md flex items-center justify-center">
          <Scissors className="w-3 h-3 text-white" />
        </div>
        <span className="text-[hsl(var(--sidebar-foreground))] font-bold text-sm">{currentPage}</span>
      </div>
    </div>
  );
}

// ─── Export Principal ──────────────────────────────────────────────────────
export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 h-screen sticky top-0 overflow-hidden border-r border-[hsl(var(--sidebar-border))]">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <MobileHeader onOpen={() => setMobileOpen(true)} />

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 shadow-2xl animate-in slide-in-from-left duration-250">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
