'use client';

import Link from 'next/link';
import { User, Mail, Phone, Camera, LogOut, ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function ClientProfile() {
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
            My Profile
          </h1>

          <div className="space-y-6">
            {/* Profile Picture */}
            <Card className="p-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center">
                  <User className="w-12 h-12 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Profile Picture
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Update your profile picture
                  </p>
                  <Button variant="outline" size="sm">
                    <Camera className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                </div>
              </div>
            </Card>

            {/* Personal Information */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-6">
                Personal Information
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    defaultValue="John Doe"
                    className="bg-secondary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    defaultValue="john@example.com"
                    className="bg-secondary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    defaultValue="+1 (555) 123-4567"
                    className="bg-secondary"
                  />
                </div>

                <Button className="w-full mt-6">Save Changes</Button>
              </div>
            </Card>

            {/* Notification Preferences */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-6">
                Notification Preferences
              </h3>

              <div className="space-y-4">
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      Email Reminders
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Receive email reminders before appointments
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      SMS Notifications
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Get SMS updates for your appointments
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      Marketing Emails
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Receive updates about new services and promotions
                    </p>
                  </div>
                </label>
              </div>
            </Card>

            {/* Danger Zone */}
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
  );
}
