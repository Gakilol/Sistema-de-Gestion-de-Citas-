# AppointmentHub - Quick Start Guide

## Overview
Professional appointment management platform ready to deploy. Features separate portals for clients and business professionals with full UI/UX implementation.

## Installation

### Prerequisites
- Node.js 18+ 
- pnpm (or npm/yarn)

### Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open browser
http://localhost:3000
```

## Navigation Guide

### Main Landing Page
- **URL**: http://localhost:3000
- Click "I'm a Client" or "I'm a Professional" to enter respective portals

## Client Portal Access

### Demo Credentials
- **Email**: client@example.com
- **Password**: demo123

### Client Portal URLs
| Page | URL | Purpose |
|------|-----|---------|
| Login | `/cliente/login` | Client authentication |
| Register | `/cliente/register` | New account creation |
| Dashboard | `/cliente/dashboard` | View appointments, stats |
| Book Appointment | `/cliente/book` | Browse services & book |
| Profile | `/cliente/profile` | Manage personal info |
| Settings | `/cliente/settings` | Notification preferences |

### Client Features
- ✓ View upcoming & past appointments
- ✓ Book appointments with 3-step wizard
- ✓ Reschedule/cancel appointments
- ✓ Manage profile information
- ✓ Configure notifications

## Professional Portal Access

### Demo Credentials
- **Email**: admin@example.com
- **Password**: demo123

### Professional Portal URLs
| Page | URL | Purpose |
|------|-----|---------|
| Login | `/personal/login` | Professional authentication |
| Dashboard | `/personal/dashboard` | KPI overview, quick actions |
| Appointments | `/personal/appointments` | Manage all appointments |
| Clients | `/personal/clients` | Client database |
| Services | `/personal/services` | Service catalog management |
| Staff | `/personal/staff` | Team member management |
| My Appointments | `/personal/my-appointments` | Staff view |
| My Schedule | `/personal/schedule` | Availability management |
| Settings | `/personal/settings` | Business configuration |

### Admin Features
- ✓ Dashboard with key metrics
- ✓ Complete appointment management
- ✓ Client database with filtering
- ✓ Service catalog by category
- ✓ Staff management
- ✓ Business settings

## Key Pages & Features

### Landing Page (`/`)
- Professional hero section
- Role selection cards
- Feature highlights
- Service categories
- Call-to-action buttons

### Client Booking Flow
1. **Service Selection** - Browse and select service
2. **Date & Time Selection** - Pick available slot
3. **Confirmation** - Review and confirm booking

### Admin Dashboard
- Key statistics cards
- Upcoming appointments widget
- Quick actions sidebar
- Recent clients list
- Business rating display

## Component Usage Examples

### Using ServiceCard
```tsx
import { ServiceCard } from '@/components/appointments/service-card';

<ServiceCard 
  service={service}
  onSelect={handleSelect}
/>
```

### Using StatsCard
```tsx
import { StatsCard } from '@/components/dashboard/stats-card';

<StatsCard
  label="Total Revenue"
  value="$4,250"
  icon={DollarSign}
  color="green"
  trend={{ value: 12, isPositive: true }}
/>
```

### Using CalendarPicker
```tsx
import { CalendarPicker } from '@/components/appointments/calendar-picker';

<CalendarPicker
  selectedDate={selectedDate}
  onDateSelect={handleDateSelect}
  availableDates={availableDates}
/>
```

## Mock Data Overview

### Available Services (6 total)
- Hair Styling ($75, 60 min)
- Hair Coloring ($120, 90 min)
- Facial Treatment ($85, 45 min)
- Massage Therapy ($95, 60 min)
- Manicure ($35, 30 min)
- Pedicure ($50, 45 min)

### Sample Appointments (4 total)
- Status: scheduled, completed, or cancelled
- Across different services
- Multiple dates/times

### Registered Clients (5 total)
- Full contact information
- Join dates
- Used in client management

### Team Members (4 total)
- 1 Admin, 3 Staff
- Specialties assigned
- Contact info

## Customization Guide

### Change Business Name
Edit `APP_STRUCTURE.md` and search files for "AppointmentHub"

### Add More Services
Edit `/lib/mock-data.ts` - `mockServices` array

### Add More Appointments
Edit `/lib/mock-data.ts` - `mockAppointments` array

### Change Color Scheme
Edit `/app/globals.css` - CSS custom properties (--primary, --accent, etc.)

### Modify Services Categories
Edit `/lib/mock-data.ts` - Service category field

## Responsive Breakpoints

- **Mobile**: < 640px (full width layouts)
- **Tablet**: 640px - 768px (2-column layouts)
- **Desktop**: ≥ 768px (3-4 column layouts)

All pages are optimized for mobile-first design with collapsible navigation.

## File Structure

```
/app                      # Next.js app routes
/components               # Reusable React components
  /ui                    # shadcn/ui components
  /shared                # Navbar, Footer, Sidebar
  /appointments          # Appointment-specific
  /dashboard             # Admin dashboard components
/lib                      # Utilities and mock data
/public                   # Static assets
```

## Deployment

### Vercel (Recommended)
```bash
git add .
git commit -m "Initial commit"
git push origin main
```
Then connect to Vercel project in dashboard.

### Docker
```bash
docker build -t appointmenthub .
docker run -p 3000:3000 appointmenthub
```

## Next Steps for Production

1. **Replace Mock Data**
   - Connect to real database (PostgreSQL, MongoDB, etc.)
   - Implement API endpoints in `/api` routes

2. **Add Real Authentication**
   - Use Supabase Auth, NextAuth.js, or similar
   - Replace demo credentials

3. **Add Payment Processing**
   - Integrate Stripe for appointments
   - Implement subscription tiers

4. **Add Email Notifications**
   - Send appointment confirmations
   - Reminder emails

5. **Add Real-time Updates**
   - WebSocket for live appointment updates
   - Calendar synchronization

6. **Deploy**
   - Set up environment variables
   - Configure database connection
   - Deploy to Vercel/AWS/Digital Ocean

## Troubleshooting

### Sidebar Not Toggling
- Ensure you're on desktop for persistent sidebar
- Mobile shows menu toggle in top-left

### Appointments Not Showing
- Check `/lib/mock-data.ts` for appointment data
- Verify appointment status matches filter

### Services Not Displaying
- Verify services exist in `mockServices` array
- Check category filtering logic

### Styling Not Applied
- Clear `.next` folder: `rm -rf .next`
- Restart dev server: `pnpm dev`

## Support & Documentation

- **APP_STRUCTURE.md** - Complete file structure
- **RESPONSIVE_DESIGN.md** - Mobile/responsive guide
- **Component files** - JSDoc comments throughout

## License
This template is ready for commercial use and modification.
