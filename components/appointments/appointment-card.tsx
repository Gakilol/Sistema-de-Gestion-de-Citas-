'use client';

import { Appointment } from '@/lib/mock-data';
import { Calendar, Clock, User, MapPin, MoreVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AppointmentCardProps {
  appointment: Appointment;
  isAdmin?: boolean;
}

export function AppointmentCard({
  appointment,
  isAdmin = false,
}: AppointmentCardProps) {
  const statusColors = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <Card className="p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground text-lg">
            {appointment.serviceName}
          </h3>
          <div
            className={`inline-block mt-2 px-3 py-1 rounded-full text-sm border ${
              statusColors[appointment.status]
            }`}
          >
            {appointment.status.charAt(0).toUpperCase() +
              appointment.status.slice(1)}
          </div>
        </div>
        <Button variant="ghost" size="sm">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4" />
          <span>{appointment.date}</span>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4" />
          <span>
            {appointment.time} ({appointment.duration} min)
          </span>
        </div>
        {isAdmin ? (
          <div className="flex items-center gap-3">
            <User className="w-4 h-4" />
            <span>{appointment.clientName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4" />
            <span>At the Studio</span>
          </div>
        )}
      </div>

      {appointment.notes && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Notes:</strong> {appointment.notes}
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        {appointment.status === 'scheduled' && (
          <>
            <Button variant="outline" size="sm" className="flex-1">
              Reschedule
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-destructive">
              Cancel
            </Button>
          </>
        )}
        {appointment.status === 'completed' && (
          <Button variant="outline" size="sm" className="w-full">
            Rebook
          </Button>
        )}
      </div>
    </Card>
  );
}
