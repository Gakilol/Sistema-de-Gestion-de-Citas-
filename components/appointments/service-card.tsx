'use client';

import { Service } from '@/lib/mock-data';
import { Clock, DollarSign, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ServiceCardProps {
  service: Service;
  onSelect?: (service: Service) => void;
}

export function ServiceCard({ service, onSelect }: ServiceCardProps) {
  return (
    <Card className="p-6 hover:shadow-md transition cursor-pointer group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="inline-block px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm mb-2">
            {service.category}
          </div>
          <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition">
            {service.name}
          </h3>
        </div>
      </div>

      <p className="text-muted-foreground text-sm mb-4">
        {service.description}
      </p>

      <div className="flex items-center gap-6 mb-6 py-4 border-y border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">{service.duration} min</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">${service.price}</span>
        </div>
      </div>

      <Button
        className="w-full group/btn"
        onClick={() => onSelect?.(service)}
      >
        Book Now
        <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition" />
      </Button>
    </Card>
  );
}
