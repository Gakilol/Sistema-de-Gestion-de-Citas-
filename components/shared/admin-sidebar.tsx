'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  BarChart3,
  Calendar,
  CalendarClock,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Scissors,
  Settings,
  ShieldCheck,
  Sun,
  Tag,
  UserRound,
  Users,
  UserX,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface MenuItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: 'Lo más usado',
    items: [
      { title: 'Inicio', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'] },
      { title: 'Agenda', href: '/citas', icon: Calendar, roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'] },
      { title: 'Asistente', href: '/ia', icon: Sparkles, roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'] },
      { title: 'Clientes', href: '/clientes', icon: Users, roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'] },
    ],
  },
  {
    label: 'Más herramientas',
    items: [
      { title: 'Servicios', href: '/servicios', icon: Scissors, roles: ['ADMIN', 'TECH_SUPPORT'] },
      { title: 'Categorías', href: '/categorias', icon: Tag, roles: ['ADMIN', 'TECH_SUPPORT'] },
      { title: 'Personal', href: '/empleados', icon: UserRound, roles: ['ADMIN', 'TECH_SUPPORT'] },
      { title: 'Reportes', href: '/reportes', icon: BarChart3, roles: ['ADMIN', 'TECH_SUPPORT'] },
      { title: 'Clientes inactivos', href: '/clientes-inactivos', icon: UserX, roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'] },
      { title: 'Configuración', href: '/configuracion', icon: Settings, roles: ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'] },
      { title: 'Auditoría', href: '/auditoria', icon: ShieldCheck, roles: ['ADMIN', 'TECH_SUPPORT'] },
    ],
  },
];

const pageNames: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/citas': 'Agenda',
  '/ia': 'Asistente IA',
  '/clientes': 'Clientes',
  '/clientes-inactivos': 'Clientes inactivos',
  '/servicios': 'Servicios',
  '/categorias': 'Categorías',
  '/empleados': 'Personal',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
  '/auditoria': 'Auditoría',
};

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  EMPLEADO: 'Empleado',
  TECH_SUPPORT: 'Soporte técnico',
};

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
}

function getPageName(pathname: string) {
  const route = Object.keys(pageNames)
    .sort((a, b) => b.length - a.length)
    .find((href) => isCurrentPath(pathname, href));

  return route ? pageNames[route] : BRAND.productName;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-[11px] border border-primary/25 bg-primary/10 text-primary">
        <CalendarClock className="size-[18px]" strokeWidth={1.8} />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-sidebar bg-primary" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block text-[19px] font-black leading-none tracking-[-0.045em] text-sidebar-foreground">
            {BRAND.productName}
          </span>
          <span className="mt-1 block truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {BRAND.descriptor}
          </span>
        </span>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const cycles = [
    { value: 'light', icon: Sun, label: 'Claro' },
    { value: 'dark', icon: Moon, label: 'Oscuro' },
    { value: 'system', icon: Monitor, label: 'Sistema' },
  ];
  const current = mounted ? (cycles.find((option) => option.value === theme) ?? cycles[2]) : cycles[2];
  const next = cycles[(cycles.indexOf(current) + 1) % cycles.length];
  const Icon = current.icon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      aria-label={mounted ? `Tema ${current.label}. Cambiar a ${next.label}` : 'Cambiar tema'}
      className="group flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-semibold text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sidebar-ring/45"
    >
      <Icon className="size-4" strokeWidth={1.8} />
      <span className="flex-1 text-left">Tema {current.label.toLowerCase()}</span>
      <ChevronRight className="size-3.5 rotate-90 opacity-45" />
    </button>
  );
}

function UserCard({ nombre, rol }: { nombre: string; rol: string }) {
  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <Link
      href="/configuracion"
      className="group mx-3 flex items-center gap-3 rounded-xl border border-sidebar-border/70 bg-card/55 p-2.5 transition-[background-color,border-color,transform] duration-150 hover:border-primary/20 hover:bg-card active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sidebar-ring/45"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/12 text-xs font-extrabold text-primary">
        {initials || <UserRound className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold leading-tight text-sidebar-foreground">{nombre}</span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {roleLabels[rol] ?? rol}
        </span>
      </span>
      <ChevronRight className="size-3.5 text-muted-foreground/60 transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-20 shrink-0 items-center justify-between px-5">
        <Link href="/dashboard" onClick={onClose} aria-label={`Ir al dashboard de ${BRAND.productName}`}>
          <BrandMark />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="flex size-10 items-center justify-center rounded-[10px] text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sidebar-ring/45"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 pb-3 pt-3">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(user?.rol ?? 'EMPLEADO'));
          if (visibleItems.length === 0) return null;

          return (
            <section key={group.label} aria-labelledby={`nav-${group.label}`} className="mb-5">
              <h2 id={`nav-${group.label}`} className="mb-2 px-3 text-xs font-bold text-muted-foreground/75">
                {group.label}
              </h2>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isCurrentPath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sidebar-ring/45',
                        active
                          ? 'bg-sidebar-accent text-sidebar-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/65 hover:text-sidebar-foreground',
                      )}
                    >
                      {active && (
                        <span aria-hidden="true" className="absolute inset-y-2 left-0 w-px bg-primary">
                          <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-sidebar" />
                        </span>
                      )}
                      <item.icon className={cn('size-[17px] shrink-0', active ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-sidebar-foreground')} strokeWidth={active ? 2 : 1.7} />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border/70 px-3 pb-3 pt-2.5">
        {user && <div className="-mx-3 mb-2"><UserCard nombre={user.nombre} rol={user.rol} /></div>}
        <ThemeToggle />
        <button
          type="button"
          onClick={handleLogout}
          className="group flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-semibold text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-destructive/8 hover:text-destructive active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-destructive/35"
        >
          <LogOut className="size-4" strokeWidth={1.8} />
          <span>Cerrar sesión</span>
        </button>
        <p className="px-3 pt-2 text-[9px] font-semibold tracking-[0.08em] text-muted-foreground/45">
          {BRAND.productName} v{BRAND.version}
        </p>
      </div>
    </div>
  );
}

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  const pathname = usePathname();

  return (
    <header className="pt-safe fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b border-sidebar-border/70 bg-sidebar/94 px-3 backdrop-blur-xl lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Abrir menú de navegación"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sidebar-ring/45"
      >
        <Menu className="size-5" strokeWidth={1.8} />
      </button>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary">{BRAND.productName}</span>
        <span className="block truncate text-sm font-bold text-sidebar-foreground">{getPageName(pathname)}</span>
      </div>
      <Link
        href="/configuracion"
        aria-label="Abrir perfil y configuración"
        className="flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sidebar-ring/45"
      >
        <UserRound className="size-5" strokeWidth={1.7} />
      </Link>
    </header>
  );
}

function MobileBottomNav({ onOpen }: { onOpen: () => void }) {
  const pathname = usePathname();
  const items = [
    { title: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
    { title: 'Agenda', href: '/citas', icon: Calendar },
    { title: 'Asistente', href: '/ia', icon: Sparkles },
  ];

  return (
    <nav data-mobile-bottom-nav aria-label="Navegación rápida" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border/75 bg-sidebar/96 px-2 backdrop-blur-xl md:hidden">
      <div className="grid h-[4.5rem] grid-cols-4">
        {items.map((item) => {
          const active = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring/45',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {active && <span aria-hidden="true" className="absolute inset-x-4 top-0 h-px bg-primary"><span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-sidebar" /></span>}
              <item.icon className="size-[21px]" strokeWidth={active ? 2.1 : 1.7} />
              <span className="truncate">{item.title}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpen}
          aria-label="Abrir todos los módulos"
          className="flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring/45"
        >
          <Menu className="size-[21px]" strokeWidth={1.7} />
          <span>Más</span>
        </button>
      </div>
    </nav>
  );
}

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[18rem] shrink-0 overflow-hidden border-r border-sidebar-border/70 bg-sidebar lg:flex">
        <SidebarContent />
      </aside>

      <MobileHeader onOpen={() => setMobileOpen(true)} />
      <MobileBottomNav onOpen={() => setMobileOpen(true)} />

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] animate-in fade-in duration-150 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="pb-safe pt-safe fixed inset-y-0 left-0 z-50 w-72 overflow-hidden border-r border-sidebar-border bg-sidebar shadow-2xl animate-in slide-in-from-left duration-200 lg:hidden">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
