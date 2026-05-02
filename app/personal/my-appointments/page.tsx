'use client';

import Link from 'next/link';
import { Calendar, Clock, User } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Footer } from '@/components/shared/footer';
import { Card } from '@/components/ui/card';
import { AppointmentCard } from '@/components/appointments/appointment-card';
import { mockAppointments } from '@/lib/mock-data';

export default function MyAppointmentsPage() {
  const scheduledAppointments = mockAppointments.filter(
    (apt) => apt.status === 'scheduled'
  );
  const completedAppointments = mockAppointments.filter(
    (apt) => apt.status === 'completed'
  );

  return (
    <div className="flex flex-col min-h-screen lg:flex-row">
      <AdminSidebar userRole="staff" />

      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <div className="p-6 md:p-8 max-w-6xl mx-auto w-full">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-2">
                My Appointments
              </h1>
              <p className="text-muted-foreground">
                View and manage your scheduled appointments
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Upcoming
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {scheduledAppointments.length}
                    </p>
                  </div>
                  <Calendar className="w-10 h-10 text-primary/20" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Completed
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {completedAppointments.length}
                    </p>
                  </div>
                  <Clock className="w-10 h-10 text-accent/20" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Total Clients
                    </p>
                    <p className="text-3xl font-bold text-foreground">5</p>
                  </div>
                  <User className="w-10 h-10 text-primary/20" />
                </div>
              </Card>
            </div>

            {/* Upcoming Appointments */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Upcoming Appointments
              </h2>

              {scheduledAppointments.length > 0 ? (
                <div className="grid gap-4">
                  {scheduledAppointments.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      isAdmin={true}
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    No upcoming appointments
                  </p>
                </Card>
              )}
            </div>

            {/* Completed Appointments */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Completed Appointments
              </h2>

              {completedAppointments.length > 0 ? (
                <div className="grid gap-4">
                  {completedAppointments.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      isAdmin={true}
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    No completed appointments
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
