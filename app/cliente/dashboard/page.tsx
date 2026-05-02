'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  Clock,
  LogOut,
  User,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppointmentCard } from '@/components/appointments/appointment-card';
import { mockAppointments } from '@/lib/mock-data';

export default function ClientDashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const upcomingAppointments = mockAppointments.filter(
    (apt) => apt.status === 'scheduled'
  );
  const pastAppointments = mockAppointments.filter(
    (apt) => apt.status === 'completed'
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <div className="flex-1 flex">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-20 left-4 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </Button>

        {/* Sidebar */}
        <aside
          className={`fixed md:relative left-0 top-16 md:top-0 h-screen w-64 bg-card border-r border-border z-30 transform transition-transform md:translate-x-0 ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">John Doe</p>
                <p className="text-xs text-muted-foreground">Premium Member</p>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-2">
            <Link
              href="/cliente/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
            >
              <Calendar className="w-5 h-5" />
              Dashboard
            </Link>
            <Link
              href="/cliente/book"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-secondary transition"
            >
              <Plus className="w-5 h-5" />
              Book Appointment
            </Link>
            <Link
              href="/cliente/profile"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-secondary transition"
            >
              <User className="w-5 h-5" />
              My Profile
            </Link>
            <Link
              href="/cliente/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-secondary transition"
            >
              <Settings className="w-5 h-5" />
              Settings
            </Link>
          </nav>

          <div className="absolute bottom-4 left-4 right-4">
            <Button variant="outline" className="w-full justify-start" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full md:w-auto overflow-auto">
          <div className="p-6 md:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Welcome back, John!
              </h1>
              <p className="text-muted-foreground">
                Manage your appointments and book new services
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Upcoming Appointments
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {upcomingAppointments.length}
                    </p>
                  </div>
                  <Calendar className="w-10 h-10 text-primary/20" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Past Appointments
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {pastAppointments.length}
                    </p>
                  </div>
                  <Clock className="w-10 h-10 text-accent/20" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Total Spent
                    </p>
                    <p className="text-3xl font-bold text-foreground">$325</p>
                  </div>
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">$</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Upcoming Appointments */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">
                  Upcoming Appointments
                </h2>
                <Button asChild>
                  <Link href="/cliente/book">
                    <Plus className="w-4 h-4 mr-2" />
                    Book New
                  </Link>
                </Button>
              </div>

              {upcomingAppointments.length > 0 ? (
                <div className="grid gap-4">
                  {upcomingAppointments.map((apt) => (
                    <AppointmentCard key={apt.id} appointment={apt} />
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    No upcoming appointments
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/cliente/book">Book Your First Appointment</Link>
                  </Button>
                </Card>
              )}
            </div>

            {/* Past Appointments */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Past Appointments
              </h2>

              {pastAppointments.length > 0 ? (
                <div className="grid gap-4">
                  {pastAppointments.map((apt) => (
                    <AppointmentCard key={apt.id} appointment={apt} />
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No past appointments</p>
                </Card>
              )}
            </div>
          </div>
        </main>

        {/* Mobile menu overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </div>

      <Footer />
    </div>
  );
}
