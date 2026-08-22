# HAIR STYLE interface system

## Direction

HAIR STYLE is a high-contrast, task-first operational workbench for salon and barbershop staff who move between the counter, the chair, and a phone throughout the day. It must also work for older or low-confidence digital users: each screen leads with one plain-language question and exposes advanced information only when requested. It should feel precise, confident and premium without becoming ornamental.

Domain vocabulary: appointment book, time slots, service menu, station, client card, shift, chair, confirmation.

Color world: lacquer black, optical white, graphite, metallic gold and the logo's deep burgundy. Green and blue appear only as functional appointment states.

Signature: the gold appointment rail. A thin line and a small node identify current navigation, selected time, and active schedule context. Burgundy appears as a secondary brand signal.

Rejected defaults:

- Separate dark sidebar on a light canvas: navigation and content share one continuous surface.
- Gold gradients and glow: gold is flat, scarce, and reserved for selection or action.
- Pastel-tinted canvases or cards: surfaces stay neutral and high contrast.
- Identical KPI card grids: priority is expressed through scale, whitespace, and type rather than equal boxes.
- Dashboards that lead with charts: Inicio leads with “¿Qué necesitas hacer?”, then today’s next actions; business analysis is secondary.
- Dense mobile calendars as the default: mobile Agenda starts as a readable “Hoy” list and keeps the full calendar as an optional view.

## Tokens

- Lacquer `#080808`: primary dark canvas.
- Optical white `#F7F7F5`: primary light canvas.
- Graphite `#1B1B1B`: raised dark surface.
- Metallic gold `#C8A646`: brand action and current-position marker.
- Burgundy `#A40022`: secondary brand signature and destructive emphasis.
- Emerald `#24865A`: success/completed.
- Cobalt `#3976B9`: informational/in-progress.

Surfaces use subtle tonal shifts. Light mode adds a quiet layered shadow to raised elements; dark mode relies on low-opacity borders. Inputs are inset and slightly darker than their surrounding surface.

## Typography

- Display/brand: the interface sans stack in an extra-black, tightly tracked treatment for HAIR STYLE; editorial serif remains limited to selected campaign-scale headings.
- Interface/body: Avenir/Aptos variable system stack, 14–16px with weight and color doing most hierarchy work. The local stack keeps the application deterministic and offline-safe.
- Data: tabular numerals through the existing sans face.
- Type scale: 11, 14, 16, 18, 22, 28, 44.

## Layout and density

- Base spacing unit: 4px.
- Desktop navigation: 288px; the four common destinations remain clearly separated from secondary administration tools.
- Page width: 1440px maximum, 20–32px page padding depending on viewport.
- Controls: 44px desktop, 48px for primary tasks and touch confirmations.
- Radius: 8px controls, 12px cards, 16px panels/drawers.
- Motion: 120–240ms, transform and opacity only; reduced-motion always respected.

## Reusable patterns

- Primary button: 40px high, 10px radius, 14px/700, flat gold fill with black text, restrained 1px ring and short shadow.
- Input: 40px desktop / 44px mobile, 10px radius, inset control surface, 14px body.
- Card: 12px radius, quiet ring, no decorative top border; hierarchy comes from content.
- Navigation row: 48px high, 12px radius, 15px/600; active state uses the gold rail and node.
- Mobile bottom navigation: 72px plus safe area, 44px hit zones, active rail at the top edge.
- Task card: icon, verb-led 18–20px title and one short explanation. Never put metrics, menus or tertiary actions inside it.
- AI mutation confirmation: the assistant may prepare an operation, but the user sees a bordered summary with every material field and a 48px explicit confirmation button before any write.
- AI task bar: “Crear cita con IA” and the manual form fallback remain visible above the conversation; voice dictation is an optional adjacent input, never the only path.
- Guided conversation: ask for one missing appointment field at a time, preserve the draft between turns, accept ordinary Spanish date/time phrases, and never expose database identifiers or serialized objects.
- Authentication: keep the sign-in form and brand together in one centered panel; supporting copy stays secondary and fabricated operational data is not shown.
- Progressive disclosure: operational summaries can use `<details>` or a dedicated report page; advanced information never competes with the primary task.
