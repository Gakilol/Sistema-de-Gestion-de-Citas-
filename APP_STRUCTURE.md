# AppointmentHub - Project Structure

## Overview
Professional appointment management platform with dual portals for clients and business professionals.

## Directory Structure

```
/app
  /cliente                   # Client portal
    /login                   # Client login page
    /register                # Client registration
    /dashboard               # Client main dashboard
    /book                    # Appointment booking flow
    /profile                 # Client profile management
    /settings                # Client settings
  
  /personal                  # Professional portal
    /login                   # Professional login
    /dashboard               # Admin/professional dashboard
    /appointments            # Appointments management
    /clients                 # Client database management
    /staff                   # Staff management (admin only)
    /services                # Service catalog management
    /my-appointments         # Employee appointments view
    /schedule                # Employee schedule management
    /settings                # Professional settings

/components
  /ui                        # shadcn/ui components (pre-built)
    /button, /card, /input, etc.
  
  /shared                    # Shared components across portals
    /navbar.tsx              # Navigation bar
    /footer.tsx              # Footer component
    /admin-sidebar.tsx       # Admin sidebar navigation
  
  /appointments              # Appointment-related components
    /appointment-card.tsx    # Display appointment details
    /service-card.tsx        # Service display card
    /calendar-picker.tsx     # Calendar selection component
  
  /dashboard                 # Dashboard specific components
    /stats-card.tsx          # Statistics display card
    /client-detail.tsx       # Client information panel

/lib
  /mock-data.ts              # Mock data for development
  /utils.ts                  # Utility functions (pre-built)

/public                      # Static assets
```

## Key Features

### Client Portal
- **Login & Registration**: Email-based authentication UI
- **Dashboard**: Overview of appointments, booking history
- **Booking Flow**: Service selection → Date/Time selection → Confirmation
- **Profile**: Personal information management
- **Settings**: Notification preferences and account management

### Professional Portal
- **Admin Dashboard**: Key metrics, upcoming appointments, client list
- **Appointments Management**: View, filter, search all appointments
- **Client Management**: Complete client database with contact info
- **Services Management**: Create, edit, delete services by category
- **Staff Management**: Team member management with specialties
- **Employee Views**: Basic appointment and schedule views for staff
- **Settings**: Business info, hours, payment configuration

## Component Architecture

### Reusable Components
- `AppointmentCard`: Display appointment with status and actions
- `ServiceCard`: Show service details with pricing and duration
- `StatsCard`: Dashboard statistics with trend indicators
- `CalendarPicker`: Interactive calendar for date selection
- `AdminSidebar`: Responsive navigation for admin areas
- `Navbar`: Top navigation bar
- `Footer`: Footer with links and info

### UI Components (shadcn/ui)
- Button
- Card
- Input
- All standard form and layout components

## Mock Data Structure

### Services
- Hair Styling, Hair Coloring, Facial Treatment
- Massage Therapy, Manicure, Pedicure
- Each with duration, price, category, description

### Appointments
- Status: scheduled, completed, cancelled
- Linked to services and clients
- Timestamps and duration tracking

### Clients
- Name, email, phone, creation date
- Used across both portals

### Professionals
- Admins and staff members
- Specialties and contact information
- Role-based access control

## Navigation Flow

```
/ (Landing Page)
├── /cliente (Client Portal)
│   ├── /login
│   ├── /register
│   ├── /dashboard
│   ├── /book
│   ├── /profile
│   └── /settings
│
└── /personal (Professional Portal)
    ├── /login
    ├── /dashboard
    ├── /appointments
    ├── /clients
    ├── /staff
    ├── /services
    ├── /my-appointments (staff)
    ├── /schedule (staff)
    └── /settings
```

## Styling System

### Design Tokens
- **Primary**: Deep blue (#4F46E5) - Main brand color
- **Accent**: Cyan (#0891B2) - Highlights and interactive elements
- **Secondary**: Light blue gray (#F0F4F8) - Background accents
- **Neutrals**: White, grays, dark blue-gray

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Sidebar collapses on mobile with menu toggle
- Grid layouts adapt from 1 → 2 → 3+ columns

## State Management

Currently uses:
- React useState for local component state
- React hooks for component logic
- Props passing for inter-component communication
- Mock data simulates API responses

## Future Integration Points

To connect to a real backend:

1. **Replace mock-data.ts**: Connect to actual API endpoints
2. **Add authentication**: Implement real auth (Supabase, NextAuth.js, etc.)
3. **Add API routes**: Create /api endpoints for data mutations
4. **Add form submission**: Wire up form handlers to API calls
5. **Add real-time updates**: Implement WebSocket or polling
6. **Add database integration**: Connect to PostgreSQL, MongoDB, etc.

## Available Pages

### Public
- `/` - Landing page with role selection

### Client Portal
- `/cliente/login` - Login page
- `/cliente/register` - Registration page
- `/cliente/dashboard` - Main dashboard
- `/cliente/book` - Booking flow
- `/cliente/profile` - Profile page
- `/cliente/settings` - Settings page

### Professional Portal
- `/personal/login` - Professional login
- `/personal/dashboard` - Admin dashboard
- `/personal/appointments` - All appointments
- `/personal/clients` - Client management
- `/personal/staff` - Staff management
- `/personal/services` - Service management
- `/personal/my-appointments` - Staff view
- `/personal/schedule` - Staff schedule
- `/personal/settings` - Settings

## Getting Started

1. Install dependencies: `pnpm install`
2. Run dev server: `pnpm dev`
3. Open http://localhost:3000
4. Click on role to navigate to respective portal
5. Use demo credentials visible on login pages

## Technologies Used

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Icons**: Lucide React
- **Language**: TypeScript
- **Database**: Mock data (ready for integration)
