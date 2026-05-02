'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Clock,
  Users,
  Calendar,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface AdminSidebarProps {
  userRole?: string;
}

export function AdminSidebar({ userRole = 'admin' }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems =
    userRole === 'admin'
      ? [
        { href: '/personal/dashboard', label: 'Dashboard', icon: BarChart3 },
        { href: '/personal/appointments', label: 'Appointments', icon: Calendar },
        { href: '/personal/clients', label: 'Clients', icon: Users },
        { href: '/personal/staff', label: 'Staff', icon: Users },
        { href: '/personal/services', label: 'Services', icon: Clock },
        { href: '/personal/settings', label: 'Settings', icon: Settings },
      ]
      : [
        { href: '/personal/my-appointments', label: 'My Appointments', icon: Calendar },
        { href: '/personal/schedule', label: 'My Schedule', icon: Clock },
        { href: '/personal/settings', label: 'Settings', icon: Settings },
      ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-40 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <Menu />}
      </Button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 z-30 lg:relative lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold text-sidebar-foreground">
              AppointmentHub
            </h2>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive(href)
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <Button variant="outline" className="w-full justify-start" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
