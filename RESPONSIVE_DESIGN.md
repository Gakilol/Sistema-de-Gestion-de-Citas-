# Responsive Design Guide

## Overview
AppointmentHub is built with a mobile-first responsive design approach, ensuring excellent user experience across all devices.

## Breakpoints

Using Tailwind CSS responsive prefixes:
- **sm**: 640px (tablets)
- **md**: 768px (larger tablets)
- **lg**: 1024px (desktops)
- **xl**: 1280px (large desktops)

## Mobile Optimizations

### Navigation
- **Mobile**: Hamburger menu with collapsible sidebar
- **Tablet/Desktop**: Full sidebar always visible
- Toggle button: `md:hidden` for mobile, `lg:relative` for desktop

### Sidebar Behavior
```
Mobile (<768px):
- Fixed position overlay
- Slides in from left
- Click outside to close
- Menu toggle in top-left

Desktop (≥768px):
- Relative position
- Always visible
- Takes up fixed width (256px)
- Never collapses
```

### Grid Layouts
- **Mobile**: 1 column (full width)
- **Tablet**: 2 columns (md:grid-cols-2)
- **Desktop**: 3-4 columns (lg:grid-cols-3, lg:grid-cols-4)

Example:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Grid items */}
</div>
```

### Tables
- **Mobile**: Horizontal scroll with overflow
- **Tablet/Desktop**: Full table display
- Cards as fallback for mobile tables

## Component Responsive Patterns

### Navbar
- Always sticky at top
- Logo text hidden on mobile
- Compact on mobile, expanded on desktop

### Footer
- Stacked on mobile (1 column)
- 4 columns on desktop (md:grid-cols-4)
- Center aligned text on mobile

### Forms
- Full width on mobile
- Grid columns on desktop
- Labels always above inputs

### Cards
- Padding: `p-4` mobile, `p-6` desktop
- Margins: `gap-4` mobile, `gap-6` desktop

### Buttons
- Full width in forms/mobile context
- Inline on desktop
- Touch-friendly size: min 44px height

## Spacing Scale

Used throughout for consistency:
- **Gaps**: gap-2, gap-3, gap-4, gap-6, gap-8
- **Padding**: p-3, p-4, p-6, p-8
- **Margins**: mb-2, mb-4, mb-6, mb-8

## Typography

- **Body text line-height**: leading-relaxed (1.625)
- **Headings**: text-balance for better wrapping
- **Font sizes**: Responsive where needed

Example:
```tsx
<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
  Title
</h1>
```

## Touch Targets

- Minimum touch target: 44x44px (mobile)
- Buttons: min-h-10 (40px)
- Links/tap areas: adequate spacing

## Common Responsive Patterns

### Full Width Content
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>
```

### Two Column Layout
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  {/* Left */}
  {/* Right */}
</div>
```

### Sidebar + Content
```tsx
<div className="flex flex-col lg:flex-row">
  <aside className="w-64">
    {/* Sidebar */}
  </aside>
  <main className="flex-1">
    {/* Content */}
  </main>
</div>
```

### Hide on Mobile
```tsx
<div className="hidden lg:block">
  {/* Only visible on desktop */}
</div>

<div className="lg:hidden">
  {/* Only visible on mobile */}
</div>
```

## Testing Checklist

- [ ] Mobile (iPhone SE: 375px)
- [ ] Tablet (iPad: 768px)
- [ ] Desktop (1024px+)
- [ ] Touch interactions work
- [ ] Text is readable (min 16px)
- [ ] Forms are usable
- [ ] Images scale properly
- [ ] No horizontal scroll
- [ ] Navigation works on all sizes
- [ ] Sidebar toggles work

## Performance on Mobile

- Lazy load images
- Minimize JavaScript on initial load
- Use CSS Grid and Flexbox (GPU accelerated)
- Avoid fixed-size containers
- Test with slow 3G networks

## Accessibility + Responsive

- Always maintain focus indicators
- Ensure text contrast on all backgrounds
- Use semantic HTML
- Test with screen readers at all sizes
- Form labels always associated with inputs

## Current Implementation Status

✓ Landing page - fully responsive
✓ Client portal - mobile optimized
✓ Admin portal - responsive sidebar
✓ Forms - mobile-friendly
✓ Navigation - adaptive menu
✓ Cards - flexible layouts
✓ Tables - responsive scroll/card view
✓ Modals - full-width on mobile

## Future Enhancements

- Add more touch-gesture support
- Optimize images with webp format
- Implement progressive web app features
- Add print-friendly stylesheets
