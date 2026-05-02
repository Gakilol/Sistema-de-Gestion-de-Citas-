'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ServiceCard } from '@/components/appointments/service-card';
import { Service, mockServices, generateTimeSlots } from '@/lib/mock-data';

type BookingStep = 'service' | 'date' | 'confirmation';

export default function BookAppointment() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots] = useState(generateTimeSlots());

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setCurrentStep('date');
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleConfirm = () => {
    setCurrentStep('confirmation');
  };

  const handleComplete = () => {
    router.push('/cliente/dashboard');
  };

  const availableDates = [
    ...new Set(timeSlots.filter((s) => s.available).map((s) => s.date)),
  ];
  const availableTimes =
    selectedDate &&
    timeSlots.filter((s) => s.date === selectedDate && s.available);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <div className="flex-1 px-4 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center gap-4">
              {['Service', 'Date & Time', 'Confirmation'].map(
                (label, index) => (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                        index === 0 && currentStep === 'service'
                          ? 'bg-primary text-primary-foreground'
                          : index === 1 && currentStep === 'date'
                            ? 'bg-primary text-primary-foreground'
                            : index === 2 && currentStep === 'confirmation'
                              ? 'bg-primary text-primary-foreground'
                              : index < ['service', 'date', 'confirmation'].indexOf(currentStep)
                                ? 'bg-emerald-500 text-white'
                                : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {index < ['service', 'date', 'confirmation'].indexOf(currentStep) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={
                        index <
                        ['service', 'date', 'confirmation'].indexOf(currentStep)
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                    >
                      {label}
                    </span>
                    {index < 2 && (
                      <div
                        className={`hidden md:block h-0.5 w-12 ${
                          index <
                          ['service', 'date', 'confirmation'].indexOf(
                            currentStep
                          )
                            ? 'bg-emerald-500'
                            : 'bg-border'
                        }`}
                      />
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Back Button */}
          {currentStep !== 'service' && (
            <Button
              variant="ghost"
              className="mb-6"
              onClick={() => {
                if (currentStep === 'date') setCurrentStep('service');
                else if (currentStep === 'confirmation')
                  setCurrentStep('date');
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}

          {/* Service Selection */}
          {currentStep === 'service' && (
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Select a Service
              </h1>
              <p className="text-muted-foreground mb-8">
                Choose from our available services
              </p>

              <div className="grid gap-6">
                {mockServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onSelect={handleServiceSelect}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Date & Time Selection */}
          {currentStep === 'date' && selectedService && (
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Select Date & Time
              </h1>
              <p className="text-muted-foreground mb-8">
                Available slots for {selectedService.name}
              </p>

              {/* Service Summary */}
              <Card className="p-4 mb-8 bg-secondary">
                <p className="font-semibold text-foreground">
                  {selectedService.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedService.duration} minutes • ${selectedService.price}
                </p>
              </Card>

              <div>
                <h3 className="font-semibold text-foreground mb-4">
                  Available Dates
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                  {availableDates.map((date) => (
                    <Card
                      key={date}
                      className={`p-4 text-center cursor-pointer transition ${
                        selectedDate === date
                          ? 'ring-2 ring-primary bg-primary/5'
                          : 'hover:bg-secondary'
                      }`}
                      onClick={() => handleDateSelect(date)}
                    >
                      <p className="font-semibold text-foreground">
                        {new Date(date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(date).toLocaleDateString('en-US', {
                          weekday: 'short',
                        })}
                      </p>
                    </Card>
                  ))}
                </div>

                {selectedDate && (
                  <>
                    <h3 className="font-semibold text-foreground mb-4">
                      Available Times
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                      {(availableTimes || []).map((slot) => (
                        <Button
                          key={slot.id}
                          variant={
                            selectedTime === slot.time ? 'default' : 'outline'
                          }
                          className="justify-center"
                          onClick={() => handleTimeSelect(slot.time)}
                        >
                          {slot.time}
                        </Button>
                      ))}
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleConfirm}
                      disabled={!selectedTime}
                    >
                      Continue to Confirmation
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Confirmation */}
          {currentStep === 'confirmation' &&
            selectedService &&
            selectedDate &&
            selectedTime && (
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-8">
                  Confirm Your Booking
                </h1>

                <Card className="p-8 mb-8 bg-emerald-50 border-emerald-200">
                  <div className="flex items-start gap-4">
                    <Check className="w-6 h-6 text-emerald-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-emerald-900">
                        Ready to book?
                      </h3>
                      <p className="text-sm text-emerald-700">
                        Review your appointment details below
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 mb-8">
                  <div className="space-y-4">
                    <div className="flex justify-between pb-4 border-b border-border">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-semibold text-foreground">
                        {selectedService.name}
                      </span>
                    </div>
                    <div className="flex justify-between pb-4 border-b border-border">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-semibold text-foreground">
                        {selectedService.duration} minutes
                      </span>
                    </div>
                    <div className="flex justify-between pb-4 border-b border-border">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-semibold text-foreground">
                        {new Date(selectedDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between pb-4 border-b border-border">
                      <span className="text-muted-foreground">Time</span>
                      <span className="font-semibold text-foreground">
                        {selectedTime}
                      </span>
                    </div>
                    <div className="flex justify-between pt-4 text-lg">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="font-bold text-primary">
                        ${selectedService.price}
                      </span>
                    </div>
                  </div>
                </Card>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCurrentStep('date')}
                  >
                    Change Time
                  </Button>
                  <Button className="flex-1" onClick={handleComplete}>
                    Confirm Booking
                  </Button>
                </div>
              </div>
            )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
