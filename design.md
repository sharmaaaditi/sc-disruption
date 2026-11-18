# SC Disruption interface contract

## Product goal

The frontend gives an operations analyst one clear path: choose a saved supply
chain, inspect its network, configure a disruption, run the simulation, and
understand the saved impact without reading raw JSON.

The interface must describe the current product honestly. It does not present
optimization, live workers, or advanced recovery comparison as implemented
features until matching backend behavior exists.

## Ownership and integration boundary

- P1 owns the React interface, simulation presentation, and authorization
  policy.
- P2 owns identity verification, login, logout, and the authenticated-user API.
- P3 and P4 own Prisma schema and persistence changes.
- The frontend consumes the existing supply-chain and simulation endpoints.
- Production authorization stays closed until P2 provides a verified user.
  Development may use an explicit `VITE_DEMO_ROLE` value; it is never enabled
  by default in production.

## Access policy

| Capability | Viewer | Analyst | Admin |
| --- | --- | --- | --- |
| View supply chains | Yes | Yes | Yes |
| Inspect saved results | Yes | Yes | Yes |
| Start a simulation | No | Yes | Yes |
| Change user roles | No | No | Yes |

Frontend gates improve clarity but are not the security boundary. The backend
must enforce the same rules after authentication lands.

## Visual direction

The application uses a dark operations-room canvas with warm paper panels,
electric cyan for network state, safety orange for active disruption, and lime
for recovery. The tone is editorial and technical rather than futuristic.

### Tokens

- Canvas: `#071319`
- Raised surface: `#10252d`
- Paper surface: `#e8efe9`
- Primary text on dark: `#f4f7f2`
- Secondary text on dark: `#9fb1b5`
- Ink on paper: `#102127`
- Signal cyan: `#34d6c6`
- Warning orange: `#ff8a3d`
- Recovery lime: `#b8e34a`
- Failure coral: `#ff647c`
- Display type: Geist, with a system sans fallback
- Data type: IBM Plex Mono, with a monospace fallback

Spacing follows a 4px base. Interactive targets are at least 44px high. Focus
rings use signal cyan with a visible offset on both dark and light surfaces.

## Page structure

1. A compact navigation bar carries project identity, API health, and user role.
2. An asymmetric hero explains the selected network and current operating mode.
3. A dense twelve-column workspace pairs the network canvas with disruption
   controls and four impact metrics.
4. A pinned results chapter presents status, inventory impact, and the ordered
   event timeline.
5. A final action area allows an authorized analyst to run another scenario.

## Motion and accessibility

- Network edges draw in once on entry.
- Result cards stack as a run becomes available.
- The results heading may pin on wide screens while the timeline scrolls.
- `prefers-reduced-motion` disables pinning, drawing, stacking, and auto motion.
- All controls remain keyboard reachable and every status change is announced
  through a polite live region.
- Color never carries status alone; text labels and shapes are always present.

## Responsive behavior

- At 1200px and above the network and controls use an 8/4 split.
- Below 900px they stack, with controls before results.
- Below 600px metrics become a two-column grid, navigation wraps, and the
  network uses a horizontally scrollable minimum canvas rather than shrinking
  labels into unreadable text.

## API assumptions

- `GET /api/health`
- `GET /api/supply-chains`
- `POST /api/supply-chains/:id/simulations`
- `GET /api/simulations/:id`
- Future P2 contract: `GET /api/auth/me`, `POST /api/auth/login`, and
  `POST /api/auth/logout`

API errors are displayed in plain language while retaining the server error
code for troubleshooting. The app does not invent metrics when the API omits
them; unknown values display as not available.
