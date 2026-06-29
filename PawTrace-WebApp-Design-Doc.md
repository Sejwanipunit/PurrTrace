# PawTrace — Mobile Web App Design & Build Document (React, one-shot)

> **For the agent building this:** This is the single source of truth. Build the **entire**
> mobile-first web app in **one pass** — every screen functional, the map working, the forms working,
> mock data wired in, responsive, accessible, with dark mode and PWA. Do **not** stop after a subset
> of screens or hand back a partial app. Match the visual design below exactly: every color, radius,
> font, and component spec here is final — derive all styling from these tokens, invent nothing new.
> When something isn't specified, follow the brand: warm, playful, hopeful, calm under stress.

---

## 1. What we're building

**PawTrace** — a community lost-&-found pet app. People report missing pets, report sightings of
strays/found pets, browse a map and feed of nearby cases, and help reunite pets with their owners.

- **Platform:** Mobile-first responsive web app (PWA-installable). Designed for a ~390px phone
  viewport first; on larger screens, center the app in a max-width column so it still looks right.
- **Emotional range:** hopeful and playful by default; calm, clear, and direct in urgent moments
  (a pet just went missing).
- **Audience:** pet owners and animal-loving neighbors, all ages, non-technical.

---

## 2. Tech stack (fixed — do not substitute)

- **React 18 + Vite + TypeScript.**
- **Routing:** `react-router-dom` v6.
- **Styling:** plain CSS with **CSS custom properties** (the tokens in §4), one global `tokens.css` +
  `base.css`, plus a co-located `.css` file per component. No UI kit (no MUI/Chakra/Tailwind) — it
  will fight the custom design.
- **State:** React Context (`AppStore`) holding pets, filters, and the current user. No Redux.
- **Map:** **Leaflet** (`leaflet` + `react-leaflet`) with free **OpenStreetMap raster tiles**
  (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`). No API key. Custom markers via
  `L.divIcon` styled per §6. (Do not use MapLibre/Mapbox/Google — they need keys or extra config and
  break one-shot builds.)
- **Data:** a **mock data layer** (`src/data/mockPets.ts`) behind a typed service
  (`src/data/petsService.ts`) returning Promises, so a real backend can swap in later.
- **PWA:** `vite-plugin-pwa` (`registerType: 'autoUpdate'`) with a web manifest (name "PawTrace",
  theme color `#6FB833`, background `#FBFAF5`) and an app icon.
- **Icons:** inline SVG, stroke width ~2.2–2.6. `lucide-react` is acceptable.

**Dependencies & setup the agent should run:**
```bash
npm create vite@latest pawtrace -- --template react-ts
cd pawtrace
npm i react-router-dom leaflet react-leaflet lucide-react
npm i -D vite-plugin-pwa
# import 'leaflet/dist/leaflet.css' once in main.tsx
npm run dev
```

---

## 3. Fonts

Load from Google Fonts in `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700;6..12,800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- **Fredoka** — display & headings (rounded, playful). Restraint; weights 500/600.
- **Nunito Sans** — body & UI. Weights 400/600/700/800.
- **JetBrains Mono** — *only* for data that should look precise: microchip IDs, GPS coordinates.

---

## 4. Design tokens (paste into `:root` in `tokens.css`)

```css
:root{
  /* Sprout — primary / brand (green) */
  --sprout-50:#EFF9E6; --sprout-100:#D9F1C2; --sprout-200:#BFE899; --sprout-300:#A2DC6E;
  --sprout-400:#88CF4C; --sprout-500:#6FB833; --sprout-600:#579522; --sprout-700:#43741B;
  --sprout-800:#325616; --sprout-900:#213A10;
  /* Sunbeam — secondary / highlight (yellow) */
  --sun-50:#FEFBE6; --sun-100:#FCF5B9; --sun-200:#FAEC86; --sun-300:#F7E153;
  --sun-400:#F5D827; --sun-500:#ECC50E; --sun-600:#C29D0A; --sun-700:#8C7107;
  /* Lagoon — accent / trust / info (teal) */
  --lagoon-50:#E7F5F2; --lagoon-100:#C2E7E0; --lagoon-300:#6BC6B8; --lagoon-500:#3EA094;
  --lagoon-700:#2A736A; --lagoon-900:#19443F;
  /* Coral — Lost / urgent / error */
  --coral-50:#FDEEE9; --coral-100:#FBD3C6; --coral-300:#F59478; --coral-500:#F2603C;
  --coral-700:#C2421F;
  /* Warm neutrals */
  --cream:#FBFAF5; --surface:#FFFFFF; --sand:#F3F0E7; --border:#E6E1D5;
  --bark-900:#2A271F; --bark-700:#4A463B; --bark-500:#6E6857; --bark-300:#A9A28E;
  /* Functional */
  --error:#E5453A; --warning:#F0A020; --info:#3EA094; --success:#2EA84F;
  /* Radius */
  --r-xs:8px; --r-sm:12px; --r-md:16px; --r-lg:20px; --r-xl:28px; --r-pill:999px;
  /* Spacing (4px grid) */
  --s-xs:4px; --s-sm:8px; --s-md:16px; --s-lg:24px; --s-xl:32px; --s-2xl:48px; --s-3xl:64px;
  /* Shadows (warm, soft) */
  --sh-1:0 1px 3px rgba(42,39,31,.06);
  --sh-2:0 4px 12px rgba(42,39,31,.08);
  --sh-3:0 12px 28px rgba(42,39,31,.12);
}
```

**Base styles:** `body { background: var(--cream); color: var(--bark-900);
font-family: 'Nunito Sans', sans-serif; }`. Headings use `'Fredoka', sans-serif`. Never use pure
black/white text — `--bark-900` on light, `--cream` on dark.

### Status → color mapping (the core of the app)

| Status | Dot/accent | Tinted bg | Text |
|---|---|---|---|
| **Lost** | `--coral-500` | `--coral-50` | `--coral-700` |
| **Found** | `--sprout-500` | `--sprout-50` | `--sprout-700` |
| **Searching** | `--sun-400` | `--sun-100` | `--sun-700` |
| **Reunited** | `--lagoon-500` | `--lagoon-50` | `--lagoon-700` |

---

## 5. Type scale

| Role | Font / weight | Size / line-height | Tracking | Use |
|---|---|---|---|---|
| Display | Fredoka 600 | 40 / 48px | -0.5 | Big screen titles |
| Headline | Fredoka 500 | 28 / 36px | — | Screen headers |
| Title | Fredoka 500 | 20 / 28px | — | Card names, section heads |
| Body L | Nunito Sans 400 | 16 / 24px | — | Default body |
| Body M | Nunito Sans 400 | 14 / 20px | — | Secondary text |
| Body S | Nunito Sans 400 | 13 / 18px | — | Captions, breed lines |
| Label | Nunito Sans 800 | 14 / 20px | +0.4 | Buttons, badges (uppercase ok) |
| Mono | JetBrains Mono 500 | 12–13px | — | Chip IDs, coordinates |

---

## 6. Component specs

Generously rounded, soft-shadowed, bouncy on press
(`transition: transform .15s cubic-bezier(.34,1.56,.64,1)`; `:active { transform: scale(.98) }`).
Honor `@media (prefers-reduced-motion: reduce)` — disable transforms/animations there.

- **Button — primary:** pill (`--r-pill`), `--sprout-500` bg, white text, Label type. Hover/press →
  `--sprout-600`, lift `translateY(-2px)`. Main positive action.
- **Button — report lost / destructive:** pill, `--coral-500` bg, white text, glow
  `0 8px 20px rgba(242,96,60,.35)`. **Reserved** for reporting a lost pet and destructive actions.
- **Button — secondary:** `--surface` bg, `--sprout-700` text, `1.5px solid --sprout-300` border.
- **Button — text/tertiary:** transparent, `--bark-700` text; hover bg `--sand`.
- **FAB:** 58–60px, `--r-xl` squircle (not a circle — part of the look), `--coral-500`, white plus
  icon, `--sh-3`. Bottom-right above the nav. Hover: slight rotate+scale.
- **Status badge:** pill, tinted bg + 6px colored dot + matching text color (table §4), Label type, ~11–13px.
- **Filter chip:** pill; off = `--surface` + `1.5px --border`; on = `--sprout-500` + white. Horizontal
  scroll row, hidden scrollbar. **Functional** — actually filters the feed.
- **Pet card (feed, horizontal):** `--surface`, `1px --border`, `--r-lg`, `--sh-1`. Left: 78px thumb
  (`--r-md`). Right: name (Title), breed (Body S, `--bark-500`), meta row (Body M bold, `--bark-700`),
  status badge top-right. Whole card is a link to `/pet/:id`.
- **Pet card (grid, vertical):** photo block on top (170px) with badge top-left + heart top-right; body below.
- **Text field:** `--surface`, `1.5px --border`, `--r-md`, ~13px padding. Focus: border `--sprout-500`
  + ring `0 0 0 4px var(--sprout-100)`. Label above in Label type, `--bark-700`. Show inline validation
  errors in `--coral-700` below the field.
- **Alert banner:** `--coral-50` bg, `1px --coral-100`, `4px solid --coral-500` left border, `--r-md`.
  Circular `--coral-500` icon, Title (Fredoka 600, `--coral-700`) + Body S. For "lost pet nearby".
- **Bottom nav:** fixed bottom, `--surface`, `1px --border` top. 4 items: Home, Map, Search, Profile.
  Active = `--sprout-600` icon+label + `--sprout-50` pill. Safe area:
  `padding-bottom: max(20px, env(safe-area-inset-bottom))`.
- **Map pin (Leaflet `divIcon`):** teardrop (`border-radius:50% 50% 50% 0; rotate(45deg)`), 38px, white
  2.5px border, `--sh-2`, icon counter-rotated inside. Color by status: Lost=coral (add a soft CSS
  pulse ring), Found=sprout, Last-seen=sun.
- **Bottom sheet (map detail):** `--surface`, top corners 24px, grip handle, status badges, a sheet
  pet-card, two actions (secondary "Directions" + primary "I've seen [name]"). Slides up when a pin is tapped.
- **Toast:** small pill, `--bark-900` bg, `--cream` text, for confirmations ("Reunited 🎉").

### Signature element — the **paw-path** 🐾
A dashed trail of paw-print SVGs — the brand's connective tissue. Reuse it:
1. **Section dividers** between content blocks.
2. **Journey tracker** — 3 nodes joined by a dashed line: *Reported lost → Spotted nearby → Reunited*.
   Done = `--sprout-500` filled; current = `--sun-400`; future = outlined.
3. **On the map** — dashed paw trail connecting "last seen" to the lost pin (a Leaflet `polyline` with a
   dashArray, or overlaid paw markers).

Paw SVG:
```html
<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="16" rx="6" ry="5"/><circle cx="5" cy="9" r="2.4"/><circle cx="19" cy="9" r="2.4"/><circle cx="9" cy="5" r="2.2"/><circle cx="15" cy="5" r="2.2"/></svg>
```

---

## 7. Screens & routes

App lives in a centered column (`max-width: 440px; margin-inline: auto; position: relative`) so it
looks right on desktop too. Fixed bottom nav on the main tabs. **All routes must be implemented and
reachable.**

| Route | Screen | Must include |
|---|---|---|
| `/` | **Home feed** | Greeting header + avatar; search bar (routes to `/search`); filter chips (All / Dogs / Cats / 5km / Today) that actually filter; "lost pet nearby" alert banner; feed of pet cards (all four statuses); coral FAB → `/report`. |
| `/map` | **Map** | Leaflet map centered on user/mock location; status-colored pins (lost pulses); paw-path from last-seen to lost; tap pin → bottom sheet detail with actions. |
| `/search` | **Search** | Text input filtering by name/breed/area + the filter chips; pet-card results list; empty state. |
| `/pet/:id` | **Pet detail** | Hero photo + status badge; name/breed/age; **journey tracker** (paw-path); description; small last-seen Leaflet snippet w/ mono coordinates; "I've seen this pet" primary CTA; report-sighting link; owner contact (revealed on tap). |
| `/report` | **Report lost pet** | 3-step flow with paw-path progress (1 photo → 2 details → 3 location/confirm). Fields below; validation; reserved **coral** "Report [name] as lost" CTA; on submit add to store, toast, route to the new pet's detail. |
| `/report-sighting/:id?` | **Report sighting** | Lighter flow: optional photo, location, note; primary green CTA; on submit append a sighting + toast. |
| `/profile` | **Profile** | User's reported pets, sightings, **reunited count celebrated** (🎉); a few settings toggles incl. dark mode. |

Every list/map/detail screen needs **loading, empty, and error** states (see §8 voice).

---

## 8. Voice & copy

Words are design material. Calm, helpful-neighbor tone. Sentence case. Plain verbs.

- **Name the action, not the system:** "Report a sighting", not "Submit". Button label and the
  resulting confirmation share vocabulary: "Mark as reunited" → toast "Reunited 🎉".
- **Errors guide, don't apologize:** "We couldn't find that area — try a nearby landmark," not
  "Oops! Something went wrong."
- **Empty states invite action:** "No pets reported nearby — that's good news. Be the first to help
  if something changes."
- Keep urgent copy short and literal. Frame even a Lost listing toward the goal: getting home.

---

## 9. Data model (TypeScript)

```ts
type PetStatus = 'lost' | 'found' | 'searching' | 'reunited';
type Species   = 'dog' | 'cat' | 'other';

interface Pet {
  id: string;
  name: string;            // 'Buddy', or 'Unknown tabby' for strays
  species: Species;
  breed?: string;
  ageYears?: number;
  status: PetStatus;
  photoUrl?: string;       // use picsum/placeholder or gradient blocks if none
  description?: string;
  microchipId?: string;    // render in mono
  lastSeen: { lat: number; lng: number; label: string; at: string }; // at = ISO
  distanceKm?: number;
  sightings: Sighting[];
  reportedBy: string;
  createdAt: string;
}
interface Sighting {
  id: string; petId: string; lat: number; lng: number;
  note?: string; photoUrl?: string; at: string; reportedBy: string;
}
interface User { id: string; name: string; avatarUrl?: string; reunitedCount: number; }
```

Ship `mockPets.ts` with **~8 varied pets** (at least one of each status, a stray with no collar, and
one reunited "after 3 days" with neighbor credit), coordinates clustered around one city
(e.g. Bengaluru: 12.97, 77.59) so the map looks populated. `petsService.ts` exposes
`listPets()`, `getPet(id)`, `addPet(p)`, `addSighting(s)`, `markReunited(id)` as async functions.

---

## 10. File structure

```
src/
  main.tsx                // import leaflet css + register PWA + mount
  App.tsx                 // BrowserRouter + AppStore + layout shell + bottom nav
  styles/ tokens.css  base.css
  components/
    Button.tsx  Badge.tsx  Chip.tsx  PetCard.tsx  AlertBanner.tsx
    BottomNav.tsx  Fab.tsx  PawPath.tsx  JourneyTracker.tsx  PetMap.tsx  Toast.tsx
  screens/
    HomeFeed.tsx  MapScreen.tsx  SearchScreen.tsx
    PetDetail.tsx  ReportLost.tsx  ReportSighting.tsx  Profile.tsx
  data/ mockPets.ts  petsService.ts
  lib/ distance.ts  time.ts        // 'last seen 2h ago'
  context/ AppStore.tsx
```

---

## 11. Quality floor (non-negotiable)

- **Mobile-first & responsive:** correct at 360–430px; centered column on larger screens.
- **Safe areas:** respect `env(safe-area-inset-*)` for nav and FAB.
- **Accessibility:** visible keyboard focus (sprout ring), semantic landmarks, `aria-label`s on
  icon-only buttons, ≥44px tap targets, AA contrast (use the text-on-light tokens; never put text on
  `--sun-400`).
- **Reduced motion:** honor `prefers-reduced-motion`.
- **Dark mode:** warm, not cold. Toggle on Profile, persisted to `localStorage`, applied via a
  `[data-theme="dark"]` attribute overriding the tokens. Background `#1C1A14`, surface `#26241C`,
  text `#ECE8DD`; primary → `--sprout-400`, error → `--coral-300`.
- **Leaflet:** import `leaflet/dist/leaflet.css`; fix the default-marker icon path issue by using
  custom `divIcon`s (so no broken marker images).

---

## 12. One-shot build order

Generate the whole app in a single pass, in this order, then verify the checklist. This is a build
*sequence*, not a set of stopping points — don't pause for approval between items.

1. Scaffold Vite React-TS, install deps (§2), wire `tokens.css` + `base.css` + fonts + PWA.
2. `AppStore` context + `mockPets.ts` + `petsService.ts` + `lib` helpers.
3. Shared components (§6), including `PawPath`, `JourneyTracker`, `PetMap`, `Toast`.
4. App shell: centered column, routes for **all** screens, bottom nav, FAB.
5. Build every screen in §7 with real behavior (filtering, map pins + sheet, the 3-step report flow
   with validation, sighting flow, profile with dark-mode toggle).
6. Empty/loading/error states, dark mode, accessibility pass, PWA manifest + icon.

### Definition of Done (all must be true)
- [ ] Every route in §7 renders and is reachable from the UI.
- [ ] Filter chips and search actually filter the list.
- [ ] Map shows status-colored pins; tapping one opens the bottom sheet; paw-path is visible.
- [ ] "Report lost pet" 3-step flow validates, adds a pet to the store, toasts, and navigates to it.
- [ ] "Report sighting" appends a sighting and toasts.
- [ ] Profile shows a celebrated reunited count and a working dark-mode toggle (persisted).
- [ ] Looks warm, rounded, friendly; paw-path present; coral reserved only for lost/destructive.
- [ ] Responsive 360–430px, centered on desktop; keyboard focus visible; reduced motion respected.
- [ ] `npm run build` succeeds; app is installable as a PWA.

> If a result doesn't look warm, rounded, and friendly with the paw-path present, it's not done.
