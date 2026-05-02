export interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
  category: string;
}

export interface TimeSlot {
  id: string;
  date: string;
  time: string;
  available: boolean;
}

export interface Appointment {
  id: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  duration: number;
  status: 'completed' | 'scheduled' | 'cancelled';
  clientName: string;
  clientEmail: string;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  createdAt: string;
}

export interface Professional {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  phone: string;
  avatar?: string;
  specialties: string[];
}

// Mock Services
export const mockServices: Service[] = [
  {
    id: '1',
    name: 'Hair Styling',
    duration: 60,
    price: 75,
    description: 'Professional hair cutting and styling',
    category: 'Hair',
  },
  {
    id: '2',
    name: 'Hair Coloring',
    duration: 90,
    price: 120,
    description: 'Full hair coloring service',
    category: 'Hair',
  },
  {
    id: '3',
    name: 'Facial Treatment',
    duration: 45,
    price: 85,
    description: 'Relaxing facial treatment',
    category: 'Spa',
  },
  {
    id: '4',
    name: 'Massage Therapy',
    duration: 60,
    price: 95,
    description: 'Swedish massage for relaxation',
    category: 'Wellness',
  },
  {
    id: '5',
    name: 'Manicure',
    duration: 30,
    price: 35,
    description: 'Classic manicure service',
    category: 'Nails',
  },
  {
    id: '6',
    name: 'Pedicure',
    duration: 45,
    price: 50,
    description: 'Complete pedicure service',
    category: 'Nails',
  },
];

// Mock Appointments
export const mockAppointments: Appointment[] = [
  {
    id: '1',
    serviceId: '1',
    serviceName: 'Hair Styling',
    date: '2024-05-10',
    time: '10:00 AM',
    duration: 60,
    status: 'completed',
    clientName: 'John Doe',
    clientEmail: 'john@example.com',
  },
  {
    id: '2',
    serviceId: '3',
    serviceName: 'Facial Treatment',
    date: '2024-05-15',
    time: '2:00 PM',
    duration: 45,
    status: 'scheduled',
    clientName: 'Jane Smith',
    clientEmail: 'jane@example.com',
    notes: 'Sensitive skin - use hypoallergenic products',
  },
  {
    id: '3',
    serviceId: '4',
    serviceName: 'Massage Therapy',
    date: '2024-05-20',
    time: '11:30 AM',
    duration: 60,
    status: 'scheduled',
    clientName: 'Mike Johnson',
    clientEmail: 'mike@example.com',
  },
  {
    id: '4',
    serviceId: '2',
    serviceName: 'Hair Coloring',
    date: '2024-05-05',
    time: '9:00 AM',
    duration: 90,
    status: 'cancelled',
    clientName: 'Sarah Davis',
    clientEmail: 'sarah@example.com',
  },
];

// Mock Clients
export const mockClients: Client[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1 (555) 123-4567',
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1 (555) 234-5678',
    createdAt: '2024-02-20',
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    phone: '+1 (555) 345-6789',
    createdAt: '2024-03-10',
  },
  {
    id: '4',
    name: 'Sarah Davis',
    email: 'sarah@example.com',
    phone: '+1 (555) 456-7890',
    createdAt: '2024-01-25',
  },
  {
    id: '5',
    name: 'Robert Wilson',
    email: 'robert@example.com',
    phone: '+1 (555) 567-8901',
    createdAt: '2024-04-05',
  },
];

// Mock Professionals
export const mockProfessionals: Professional[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    phone: '+1 (555) 111-1111',
    specialties: ['Management', 'Hair Styling'],
  },
  {
    id: '2',
    name: 'Sarah Hair Expert',
    email: 'sarah.expert@example.com',
    role: 'staff',
    phone: '+1 (555) 222-2222',
    specialties: ['Hair Styling', 'Hair Coloring'],
  },
  {
    id: '3',
    name: 'Emma Wellness',
    email: 'emma.wellness@example.com',
    role: 'staff',
    phone: '+1 (555) 333-3333',
    specialties: ['Massage Therapy', 'Wellness'],
  },
  {
    id: '4',
    name: 'Linda Spa',
    email: 'linda.spa@example.com',
    role: 'staff',
    phone: '+1 (555) 444-4444',
    specialties: ['Facial Treatment', 'Spa'],
  },
];

// Mock Time Slots
export const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const dates = ['2024-05-15', '2024-05-16', '2024-05-17', '2024-05-18'];
  const times = [
    '9:00 AM',
    '10:00 AM',
    '11:00 AM',
    '1:00 PM',
    '2:00 PM',
    '3:00 PM',
    '4:00 PM',
    '5:00 PM',
  ];

  dates.forEach((date) => {
    times.forEach((time) => {
      slots.push({
        id: `${date}-${time}`,
        date,
        time,
        available: Math.random() > 0.3,
      });
    });
  });

  return slots;
};

// Mock Dashboard Stats
export const mockDashboardStats = {
  totalAppointments: 24,
  completedAppointments: 18,
  upcomingAppointments: 4,
  cancelledAppointments: 2,
  totalClients: 5,
  totalRevenue: 4250,
  avgRating: 4.8,
};
