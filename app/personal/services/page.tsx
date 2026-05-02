'use client';

import { useState } from 'react';
import { Clock, Plus, Edit2, Trash2, Search } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Footer } from '@/components/shared/footer';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ServiceCard } from '@/components/appointments/service-card';
import { mockServices } from '@/lib/mock-data';

export default function ServicesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredServices = mockServices.filter((service) =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = [...new Set(mockServices.map((s) => s.category))];

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
                  Services
                </h1>
                <p className="text-muted-foreground">
                  Manage your service catalog
                </p>
              </div>
              <Button className="mt-4 md:mt-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </div>

            {/* Search and Filter */}
            <Card className="p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Total Services
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {mockServices.length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Categories
                </p>
                <p className="text-3xl font-bold text-primary">
                  {categories.length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Avg Duration
                </p>
                <p className="text-3xl font-bold text-accent">
                  {Math.round(
                    mockServices.reduce((acc, s) => acc + s.duration, 0) /
                      mockServices.length
                  )}{' '}
                  min
                </p>
              </Card>
            </div>

            {/* Services List by Category */}
            <div className="space-y-8">
              {categories.map((category) => {
                const categoryServices = filteredServices.filter(
                  (s) => s.category === category
                );
                return (
                  <div key={category}>
                    <h2 className="text-2xl font-bold text-foreground mb-4">
                      {category}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryServices.map((service) => (
                        <div
                          key={service.id}
                          className="relative"
                        >
                          <ServiceCard service={service} />
                          <div className="absolute top-6 right-6 flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="bg-white/90 hover:bg-white"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="bg-white/90 hover:bg-white text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredServices.length === 0 && (
              <Card className="p-12 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  No services match your search
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
