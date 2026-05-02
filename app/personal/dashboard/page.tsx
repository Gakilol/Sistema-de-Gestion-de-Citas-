'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Footer } from '@/components/shared/footer';
import { Card } from '@/components/ui/card';
import { AppointmentCard } from '@/components/appointments/appointment-card';
import { mockAppointments, mockDashboardStats, mockClients } from '@/lib/mock-data';

export default function AdminDashboard() {
  const upcomingAppointments = mockAppointments
    .filter((apt) => apt.status === 'scheduled')
    .slice(0, 3);

  const statCards = [
    {
      label: 'Total Appointments',
      value: mockDashboardStats.totalAppointments,
      icon: Calendar,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Completed',
      value: mockDashboardStats.completedAppointments,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Total Clients',
      value: mockDashboardStats.totalClients,
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Total Revenue',
      value: `$${mockDashboardStats.totalRevenue}`,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen lg:flex-row">
      <AdminSidebar userRole="admin" />

      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          {/* Main Content */}
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Dashboard
              </h1>
              <p className="text-muted-foreground">
                Welcome back! Here&apos;s your business overview.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.label} className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {stat.label}
                        </p>
                        <p className="text-3xl font-bold text-foreground">
                          {stat.value}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Upcoming Appointments */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-foreground">
                    Upcoming Appointments
                  </h2>
                  <Link
                    href="/personal/appointments"
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    View All
                  </Link>
                </div>

                <div className="space-y-4">
                  {upcomingAppointments.length > 0 ? (
                    upcomingAppointments.map((apt) => (
                      <AppointmentCard
                        key={apt.id}
                        appointment={apt}
                        isAdmin={true}
                      />
                    ))
                  ) : (
                    <Card className="p-12 text-center">
                      <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">
                        No upcoming appointments
                      </p>
                    </Card>
                  )}
                </div>
              </div>

              {/* Quick Links & Recent Activity */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <Card className="p-6">
                  <h3 className="font-semibold text-foreground mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <Link
                      href="/personal/appointments"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                    >
                      <Calendar className="w-4 h-4" />
                      View Appointments
                    </Link>
                    <Link
                      href="/personal/clients"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                    >
                      <Users className="w-4 h-4" />
                      Manage Clients
                    </Link>
                    <Link
                      href="/personal/services"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                    >
                      <Clock className="w-4 h-4" />
                      Manage Services
                    </Link>
                  </div>
                </Card>

                {/* Recent Clients */}
                <Card className="p-6">
                  <h3 className="font-semibold text-foreground mb-4">
                    Recent Clients
                  </h3>
                  <div className="space-y-3">
                    {mockClients.slice(0, 5).map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center gap-3 pb-3 border-b border-border last:border-0"
                      >
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {client.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {client.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {client.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Business Rating */}
                <Card className="p-6 bg-accent/5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">
                      Average Rating
                    </h3>
                    <span className="text-2xl font-bold text-primary">
                      {mockDashboardStats.avgRating}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={`text-lg ${
                          i < Math.floor(mockDashboardStats.avgRating)
                            ? 'text-yellow-400'
                            : 'text-muted'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
