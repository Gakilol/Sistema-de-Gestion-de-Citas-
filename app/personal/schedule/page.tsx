'use client';

import { Calendar, Clock, Plus } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Footer } from '@/components/shared/footer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SchedulePage() {
  const workingHours = [
    { day: 'Monday', start: '09:00 AM', end: '05:00 PM', available: true },
    { day: 'Tuesday', start: '09:00 AM', end: '05:00 PM', available: true },
    { day: 'Wednesday', start: '09:00 AM', end: '05:00 PM', available: true },
    { day: 'Thursday', start: '09:00 AM', end: '05:00 PM', available: true },
    { day: 'Friday', start: '09:00 AM', end: '03:00 PM', available: true },
    { day: 'Saturday', start: '10:00 AM', end: '02:00 PM', available: true },
    { day: 'Sunday', start: '-', end: '-', available: false },
  ];

  return (
    <div className="flex flex-col min-h-screen lg:flex-row">
      <AdminSidebar userRole="staff" />

      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  My Schedule
                </h1>
                <p className="text-muted-foreground">
                  Manage your availability and working hours
                </p>
              </div>
              <Button className="mt-4 md:mt-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Time Off
              </Button>
            </div>

            {/* Working Hours */}
            <Card className="p-6 mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Working Hours
              </h2>

              <div className="space-y-4">
                {workingHours.map((schedule) => (
                  <div
                    key={schedule.day}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-secondary/50 transition"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        {schedule.day}
                      </h3>
                      {schedule.available ? (
                        <p className="text-sm text-muted-foreground">
                          {schedule.start} - {schedule.end}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Day off
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Time Off */}
            <Card className="p-6 mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Scheduled Time Off
              </h2>

              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">
                  No scheduled time off
                </p>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Request Time Off
                </Button>
              </div>
            </Card>

            {/* Quick Notes */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Schedule Notes
              </h2>
              <textarea
                className="w-full p-4 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                placeholder="Add any special notes about your schedule..."
                defaultValue="I prefer morning appointments for consultations."
              />
              <Button className="mt-4">Save Notes</Button>
            </Card>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
