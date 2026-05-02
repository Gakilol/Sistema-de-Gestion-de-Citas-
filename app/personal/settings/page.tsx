'use client';

import { Settings, LogOut } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function AdminSettings() {
  return (
    <div className="flex flex-col min-h-screen lg:flex-row">
      <AdminSidebar userRole="admin" />

      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <div className="p-6 md:p-8 max-w-2xl mx-auto w-full">
            <h1 className="text-4xl font-bold text-foreground mb-8">
              Settings
            </h1>

            <div className="space-y-6">
              {/* Business Information */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold text-foreground mb-6">
                  Business Information
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Business Name
                    </label>
                    <Input
                      type="text"
                      defaultValue="Beauty & Wellness Studio"
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Business Email
                    </label>
                    <Input
                      type="email"
                      defaultValue="admin@example.com"
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Business Phone
                    </label>
                    <Input
                      type="tel"
                      defaultValue="+1 (555) 111-1111"
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Address
                    </label>
                    <Input
                      type="text"
                      defaultValue="123 Main St, City, State 12345"
                      className="bg-secondary"
                    />
                  </div>

                  <Button className="w-full mt-6">Save Business Info</Button>
                </div>
              </Card>

              {/* Business Hours */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold text-foreground mb-6">
                  Business Hours
                </h3>

                <div className="space-y-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(
                    (day) => (
                      <div key={day} className="flex items-center gap-4">
                        <div className="w-24 font-medium text-foreground">
                          {day}
                        </div>
                        <Input
                          type="time"
                          defaultValue="09:00"
                          className="bg-secondary w-32"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          defaultValue="17:00"
                          className="bg-secondary w-32"
                        />
                      </div>
                    )
                  )}
                  <Button className="w-full mt-6">Save Hours</Button>
                </div>
              </Card>

              {/* Payment Settings */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold text-foreground mb-6">
                  Payment Settings
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Stripe API Key
                    </label>
                    <Input
                      type="password"
                      placeholder="sk_test_..."
                      className="bg-secondary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm text-emerald-700">
                      Payment processing is configured
                    </p>
                    <span className="text-emerald-600">✓</span>
                  </div>

                  <Button className="w-full">Update Payment Info</Button>
                </div>
              </Card>

              {/* Account Section */}
              <Card className="p-6 border-red-200 bg-red-50">
                <h3 className="text-xl font-semibold text-red-900 mb-4">
                  Account
                </h3>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                  >
                    Change Password
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive justify-start"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
