'use client';

import Link from 'next/link';
import { Settings, ArrowLeft, Lock, Globe, Bell } from 'lucide-react';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ClientSettings() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <div className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/cliente/dashboard"
            className="inline-flex items-center text-primary hover:underline mb-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>

          <h1 className="text-4xl font-bold text-foreground mb-8">
            Settings
          </h1>

          <div className="space-y-6">
            {/* General Settings */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    General Settings
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Manage your language, timezone, and display preferences
                  </p>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
              </div>
            </Card>

            {/* Privacy Settings */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Privacy & Security
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Control who can see your profile and manage blocked users
                  </p>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="block">
                      Privacy Settings
                    </Button>
                    <Button variant="outline" size="sm" className="block">
                      Change Password
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Notification Settings */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Bell className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Notifications
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Choose how and when you want to be notified about
                    appointments
                  </p>
                  <Button variant="outline" size="sm">
                    Manage Notifications
                  </Button>
                </div>
              </div>
            </Card>

            {/* Connected Accounts */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Connected Accounts
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Manage your connected social media and calendar accounts
              </p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  Google Calendar
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Apple Calendar
                </Button>
              </div>
            </Card>

            {/* Data & Privacy */}
            <Card className="p-6 border-blue-200 bg-blue-50">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">
                Data & Privacy
              </h3>
              <p className="text-blue-700 text-sm mb-4">
                Download your data or delete your account permanently
              </p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="block">
                  Download My Data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="block text-destructive hover:text-destructive"
                >
                  Delete Account
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
