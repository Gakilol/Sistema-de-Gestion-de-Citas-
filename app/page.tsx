'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock,
  Calendar,
  Users,
  Zap,
  BarChart3,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Home() {
  const router = useRouter();
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-20 bg-gradient-to-br from-background to-secondary">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance">
              Professional Appointment Management
            </h1>
            <p className="text-xl text-muted-foreground mb-12 text-balance max-w-2xl mx-auto">
              Streamline your scheduling with our modern appointment management platform.
              Perfect for salons, clinics, consulting firms, and service-based businesses.
            </p>
          </div>

          {/* Role Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Client Card */}
            <Card
              className={`p-8 transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                hoveredRole === 'client'
                  ? 'ring-2 ring-primary shadow-lg'
                  : 'hover:shadow-md'
              }`}
              onMouseEnter={() => setHoveredRole('client')}
              onMouseLeave={() => setHoveredRole(null)}
              onClick={() => router.push('/cliente/login')}
            >
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
                  <Calendar className="w-7 h-7 text-accent" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">I&apos;m a Client</h2>
                <p className="text-muted-foreground mb-6">
                  Book and manage your appointments with ease
                </p>
                <ul className="text-left space-y-2 mb-6 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-accent">✓</span> Browse available services
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent">✓</span> Book appointments online
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent">✓</span> View appointment history
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent">✓</span> Reschedule anytime
                  </li>
                </ul>
                <Button
                  className="w-full group"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/cliente/login');
                  }}
                >
                  Continue as Client
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition" />
                </Button>
              </div>
            </Card>

            {/* Professional Card */}
            <Card
              className={`p-8 transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                hoveredRole === 'professional'
                  ? 'ring-2 ring-primary shadow-lg'
                  : 'hover:shadow-md'
              }`}
              onMouseEnter={() => setHoveredRole('professional')}
              onMouseLeave={() => setHoveredRole(null)}
              onClick={() => router.push('/personal/login')}
            >
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <BarChart3 className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">I&apos;m a Professional</h2>
                <p className="text-muted-foreground mb-6">
                  Manage your business and clients efficiently
                </p>
                <ul className="text-left space-y-2 mb-6 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-primary">✓</span> Advanced dashboard
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">✓</span> Manage clients
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">✓</span> Set availability
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">✓</span> View analytics
                  </li>
                </ul>
                <Button
                  className="w-full group"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/personal/login');
                  }}
                >
                  Continue as Professional
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-card border-b border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-foreground mb-16">
            Why Choose AppointmentHub?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Clock,
                title: 'Save Time',
                description: 'Automate scheduling and reduce manual coordination',
              },
              {
                icon: Users,
                title: 'Build Relationships',
                description: 'Keep clients organized and connected',
              },
              {
                icon: Zap,
                title: 'Instant Notifications',
                description: 'Real-time updates for appointments',
              },
              {
                icon: BarChart3,
                title: 'Track Performance',
                description: 'Analytics and insights for your business',
              },
              {
                icon: Lock,
                title: 'Secure & Reliable',
                description: 'Enterprise-grade security for your data',
              },
              {
                icon: Calendar,
                title: 'Flexible Scheduling',
                description: 'Customize your availability and pricing',
              },
            ].map((feature, i) => (
              <Card key={i} className="p-6 hover:shadow-md transition">
                <feature.icon className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-foreground mb-16">
            Perfect For
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              'Salons & Spas',
              'Medical Clinics',
              'Consulting Firms',
              'Beauty Services',
              'Fitness Studios',
              'Legal Services',
              'Photography Studios',
              'Coaching Services',
            ].map((service, i) => (
              <Card key={i} className="p-6 text-center hover:bg-secondary transition">
                <p className="text-foreground font-medium">{service}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
