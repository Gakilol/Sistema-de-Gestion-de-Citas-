'use client';

import { useState } from 'react';
import { Users, Search, Plus, MoreVertical } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Footer } from '@/components/shared/footer';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { mockProfessionals } from '@/lib/mock-data';

export default function StaffPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStaff = mockProfessionals.filter((staff) =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.specialties.some((s) =>
      s.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="flex flex-col min-h-screen lg:flex-row">
      <AdminSidebar userRole="admin" />

      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  Staff Management
                </h1>
                <p className="text-muted-foreground">
                  Manage your team members and their schedules
                </p>
              </div>
              <Button className="mt-4 md:mt-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Staff Member
              </Button>
            </div>

            {/* Search */}
            <Card className="p-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name, email, or specialty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Total Staff
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {mockProfessionals.length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Administrators
                </p>
                <p className="text-3xl font-bold text-primary">
                  {mockProfessionals.filter((s) => s.role === 'admin').length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Staff Members
                </p>
                <p className="text-3xl font-bold text-accent">
                  {mockProfessionals.filter((s) => s.role === 'staff').length}
                </p>
              </Card>
            </div>

            {/* Staff Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStaff.map((staff) => (
                <Card key={staff.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">
                          {staff.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {staff.name}
                        </h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            staff.role === 'admin'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-secondary text-foreground'
                          }`}
                        >
                          {staff.role === 'admin' ? 'Administrator' : 'Staff'}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p>{staff.email}</p>
                    <p>{staff.phone}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">
                      Specialties
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {staff.specialties.map((specialty) => (
                        <span
                          key={specialty}
                          className="text-xs bg-secondary px-2 py-1 rounded"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Schedule
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {filteredStaff.length === 0 && (
              <Card className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  No staff members match your search
                </p>
              </Card>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
