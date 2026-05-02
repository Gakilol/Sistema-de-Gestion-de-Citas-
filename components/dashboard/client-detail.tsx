'use client';

import { Client } from '@/lib/mock-data';
import { X, Mail, Phone, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ClientDetailProps {
  client: Client;
  onClose?: () => void;
  onMessage?: () => void;
  onCall?: () => void;
}

export function ClientDetail({
  client,
  onClose,
  onMessage,
  onCall,
}: ClientDetailProps) {
  return (
    <Card className="p-6 max-w-md">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
            <span className="text-lg font-bold text-primary">
              {client.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{client.name}</h3>
            <p className="text-sm text-muted-foreground">Client since {new Date(client.createdAt).getFullYear()}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3 mb-6 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <a href={`mailto:${client.email}`} className="text-sm text-primary hover:underline">
            {client.email}
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <a href={`tel:${client.phone}`} className="text-sm text-primary hover:underline">
            {client.phone}
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Joined {new Date(client.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCall}>
          <Phone className="w-4 h-4 mr-2" />
          Call
        </Button>
        <Button size="sm" className="flex-1" onClick={onMessage}>
          <Mail className="w-4 h-4 mr-2" />
          Message
        </Button>
      </div>
    </Card>
  );
}
