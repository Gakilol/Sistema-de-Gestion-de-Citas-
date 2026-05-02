'use client';

import { useState } from 'react';
import { Users, Search, Plus, Mail, Phone, MoreVertical } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Footer } from '@/components/shared/footer';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { mockClients } from '@/lib/mock-data';

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = mockClients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
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
                  Clients
                </h1>
                <p className="text-muted-foreground">
                  Manage your client database
                </p>
              </div>
              <Button className="mt-4 md:mt-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </div>

            {/* Search */}
            <Card className="p-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name, email, or phone..."
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
                  Total Clients
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {mockClients.length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  This Month
                </p>
                <p className="text-3xl font-bold text-primary">2</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Active This Week
                </p>
                <p className="text-3xl font-bold text-accent">3</p>
              </Card>
            </div>

            {/* Clients Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Name
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Phone
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Joined
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b border-border hover:bg-secondary/50 transition"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">
                                {client.name.charAt(0)}
                              </span>
                            </div>
                            <span className="font-medium text-foreground">
                              {client.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {client.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {client.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-sm">
                          {new Date(client.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredClients.length === 0 && (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    No clients match your search
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
