# NovaCita interface system

## Direction

NovaCita is a calm, editorial workbench for salon and barbershop staff who move between the counter, the chair, and a phone throughout the day. The interface should feel precise, warm, and composed: closer to a well-organized appointment book on a dark wood counter than a generic SaaS dashboard.

Domain vocabulary: appointment book, time slots, service menu, station, client card, shift, chair, confirmation.

Color world: warm ink, porcelain, tracing paper, aged brass/copper, bottle green, burgundy, steel blue.

Signature: the copper appointment rail. A thin line and a small node identify current navigation, selected time, and active schedule context. It is the one recurring expressive gesture; everything else stays quiet.

Rejected defaults:

- Separate dark sidebar on a light canvas: navigation and content share one continuous surface.
- Gold gradients and glow: copper is flat, scarce, and reserved for selection or action.
- Identical KPI card grids: priority is expressed through scale, whitespace, and type rather than equal boxes.

## Tokens

- Ink `#171411`: primary dark canvas.
- Porcelain `#f7f4ef`: primary light canvas.
- Paper `#eee8df`: quiet light surface/control.
- Copper `#b86f3d`: brand action and current-position marker.
- Bottle `#3f765f`: success/completed.
- Burgundy `#9d4655`: destructive/cancelled.
- Steel `#4f7183`: informational/in-progress.

Surfaces use subtle tonal shifts. Light mode adds a quiet layered shadow to raised elements; dark mode relies on low-opacity borders. Inputs are inset and slightly darker than their surrounding surface.

## Typography

- Display/brand: Bodoni/Didot editorial stack, used only for the product mark and high-level editorial moments.
- Interface/body: Avenir/Aptos variable system stack, 14–16px with weight and color doing most hierarchy work. The local stack keeps the application deterministic and offline-safe.
- Data: tabular numerals through the existing sans face.
- Type scale: 11, 14, 16, 18, 22, 28, 44.

## Layout and density

- Base spacing unit: 4px.
- Desktop navigation: 272px; content remains the focal area.
- Page width: 1440px maximum, 20–32px page padding depending on viewport.
- Controls: 40px desktop, 44px touch devices.
- Radius: 8px controls, 12px cards, 16px panels/drawers.
- Motion: 120–240ms, transform and opacity only; reduced-motion always respected.

## Reusable patterns

- Primary button: 40px high, 10px radius, 14px/650, copper fill, restrained 1px ring and short shadow.
- Input: 40px desktop / 44px mobile, 10px radius, inset control surface, 14px body.
- Card: 12px radius, quiet ring, no decorative top border; hierarchy comes from content.
- Navigation row: 40px high, 10px radius, 14px/600; active state uses the copper rail and node.
- Mobile bottom navigation: 72px plus safe area, 44px hit zones, active rail at the top edge.
