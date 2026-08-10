'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Calendar,
  CalendarDays,
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
  Menu,
  X,
  Tag,
  UserX,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface MenuItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  badge?: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

// ─── Toggle Tema ─────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycles = [
    { value: 'light',  icon: Sun,     label: 'Claro' },
    { value: 'dark',   icon: Moon,    label: 'Oscuro' },
    { value: 'system', icon: Monitor, label: 'Sistema' },
  ];

  const current = mounted
    ? (cycles.find((c) => c.value === theme) ?? cycles[2])
    : cycles[2];

  const next = cycles[(cycles.indexOf(current) + 1) % cycles.length];
  const Icon = current.icon;

  return (
    <button
      onClick={() => setTheme(next.value)}
      title={mounted ? `Modo: ${current.label}. Clic para cambiar a ${next.label}` : ''}
      className={cn(
        'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium',
        'text-[hsl(var(--sidebar-foreground)/0.65)] hover:text-[hsl(var(--sidebar-foreground))]',
        'hover:bg-[hsl(var(--sidebar-accent))] transition-all duration-200 group'
      )}
    >
      <span className={cn(
        'flex items-center justify-center w-7 h-7 rounded-md',
        'bg-[hsl(var(--sidebar-accent))] group-hover:bg-[hsl(var(--sidebar-primary)/0.12)] transition-colors'
      )}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="flex-1 text-left">{current.label}</span>
      <ChevronRight className="w-3 h-3 opacity-35 rotate-90" />
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
    ADMIN:        'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
    EMPLEADO:     'bg-gradient-to-br from-slate-400 to-slate-600 text-white',
    TECH_SUPPORT: 'bg-gradient-to-br from-cyan-500 to-cyan-700 text-white',
  };

  const roleLabels: Record<string, string> = {
    ADMIN:        'Administrador',
    EMPLEADO:     'Empleado',
    TECH_SUPPORT: 'Soporte Técnico',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[hsl(var(--sidebar-border))]">
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
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
        roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'],
      },
    ],
  },
  {
    label: 'Gestión',
    items: [
      {
        title: 'Agenda',
        href: '/citas',
        icon: Calendar,
        roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'],
      },
      {
        title: 'Clientes',
        href: '/clientes',
        icon: Users,
        roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'],
      },
      {
        title: 'Clientes Inactivos',
        href: '/clientes-inactivos',
        icon: UserX,
        roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'],
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
        roles: ['ADMIN', 'TECH_SUPPORT'],
      },
      {
        title: 'Categorías',
        href: '/categorias',
        icon: Tag,
        roles: ['ADMIN', 'TECH_SUPPORT'],
      },
      {
        title: 'Personal',
        href: '/empleados',
        icon: UserRound,
        roles: ['ADMIN', 'TECH_SUPPORT'],
      },
      {
        title: 'Reportes',
        href: '/reportes',
        icon: BarChart3,
        roles: ['ADMIN', 'TECH_SUPPORT'],
      },
      {
        title: 'Configuración',
        href: '/configuracion',
        icon: Settings,
        roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'],
      },
      {
        title: 'Auditoría',
        href: '/auditoria',
        icon: ShieldCheck,
        roles: ['ADMIN', 'TECH_SUPPORT'],
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
            <div key={group.label} className="mb-3">
              <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--sidebar-foreground)/0.3)] mb-0.5">
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
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                        isActive
                          ? 'bg-[hsl(var(--sidebar-primary)/0.12)] text-[hsl(var(--sidebar-primary))]'
                          : 'text-[hsl(var(--sidebar-foreground)/0.60)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
                      )}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[hsl(var(--sidebar-primary))] rounded-r-full" />
                      )}

                      <span className={cn(
                        'flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 transition-all',
                        isActive
                          ? 'bg-[hsl(var(--sidebar-primary)/0.18)]'
                          : 'bg-[hsl(var(--sidebar-accent))] group-hover:bg-[hsl(var(--sidebar-primary)/0.08)]'
                      )}>
                        <item.icon className="w-3.5 h-3.5" />
                      </span>

                      <span className="flex-1">{item.title}</span>

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
      <div className="px-3 py-2.5 border-t border-[hsl(var(--sidebar-border))] space-y-0.5 flex-shrink-0">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium',
            'text-[hsl(var(--sidebar-foreground)/0.50)] hover:text-red-400',
            'hover:bg-red-500/8 transition-all duration-200 group'
          )}
        >
          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[hsl(var(--sidebar-accent))] group-hover:bg-red-500/10 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </span>
          Cerrar Sesión
        </button>

        {/* Version */}
        <p className="text-center text-[9px] text-[hsl(var(--sidebar-foreground)/0.2)] pt-1.5">
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
    '/dashboard':          'Dashboard',
    '/citas':              'Agenda',
    '/clientes':           'Clientes',
    '/clientes-inactivos': 'Clientes Inactivos',
    '/servicios':          'Servicios',
    '/categorias':         'Categorías',
    '/empleados':          'Personal',
    '/reportes':           'Reportes',
    '/configuracion':      'Configuración',
    '/auditoria':          'Auditoría',
  };
  const currentPage = pageNames[pathname] ?? 'HAIR STYLE';

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[hsl(var(--sidebar)/0.97)] border-b border-[hsl(var(--sidebar-border))] flex items-center gap-3 px-3 sm:px-4 pt-safe backdrop-blur-xl shadow-[0_8px_30px_hsl(225_30%_3%/0.22)]">
      <button
        onClick={onOpen}
        aria-label="Abrir menú de navegación"
        className="w-11 h-11 min-w-11 min-h-11 flex items-center justify-center rounded-xl text-[hsl(var(--sidebar-foreground)/0.72)] hover:text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] active:scale-95 transition-all"
      >
        <Menu className="w-6 h-6" strokeWidth={1.8} />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="w-9 h-9 flex-shrink-0 bg-primary rounded-xl flex items-center justify-center shadow-[0_6px_18px_hsl(var(--primary)/0.2)] text-primary-foreground">
          <CalendarDays className="w-5 h-5" strokeWidth={2.2} />
        </div>
        <span className="truncate text-[hsl(var(--sidebar-foreground))] font-extrabold text-base tracking-tight">{currentPage}</span>
      </div>
      <Link
        href="/configuracion"
        aria-label="Abrir perfil y configuración"
        className="flex size-11 items-center justify-center rounded-xl text-[hsl(var(--sidebar-foreground)/0.68)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))] active:scale-95 transition-all"
      >
        <UserRound className="size-6" strokeWidth={1.7} />
      </Link>
    </header>
  );
}

// ─── Export Principal ──────────────────────────────────────────────────────
function MobileBottomNav({ onOpen }: { onOpen: () => void }) {
  const pathname = usePathname();
  const items = [
    { title: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
    { title: 'Agenda', href: '/citas', icon: Calendar },
    { title: 'Clientes', href: '/clientes', icon: Users },
  ];

  return (
    <nav
      data-mobile-bottom-nav
      aria-label="Navegación principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar)/0.98)] px-2 pb-safe shadow-[0_-14px_34px_hsl(225_30%_3%/0.28)] backdrop-blur-xl"
    >
      <div className="grid h-[4.5rem] grid-cols-4 items-stretch">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors',
                isActive
                  ? 'text-[hsl(var(--sidebar-primary))]'
                  : 'text-[hsl(var(--sidebar-foreground)/0.58)] active:bg-[hsl(var(--sidebar-accent))]'
              )}
            >
              <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.3 : 1.8} />
              <span className="truncate">{item.title}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpen}
          aria-label="Abrir todos los módulos"
          className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-[hsl(var(--sidebar-foreground)/0.58)] active:bg-[hsl(var(--sidebar-accent))]"
        >
          <Menu className="h-6 w-6" strokeWidth={1.8} />
          <span>Más</span>
        </button>
      </div>
    </nav>
  );
}

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 xl:w-64 flex-shrink-0 h-screen sticky top-0 overflow-hidden border-r border-[hsl(var(--sidebar-border))] shadow-[12px_0_36px_hsl(225_30%_3%/0.18)]">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <MobileHeader onOpen={() => setMobileOpen(true)} />
      <MobileBottomNav onOpen={() => setMobileOpen(true)} />

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 shadow-2xl animate-in slide-in-from-left duration-250 pb-safe pt-safe">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}

