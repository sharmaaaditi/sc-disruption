# SC Disruption frontend

React and TypeScript interface for selecting a supply chain, configuring a
disruption, running the persisted simulation flow, and reviewing impact.

## Local development

```bash
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:3000`, so start the repository backend
from the project root in another terminal.

## Commands

- `npm run dev` starts Vite on port 5173.
- `npm run build` checks TypeScript and creates the production bundle.
- `npm run test` runs the frontend tests.

From the repository root, `npm run demo` builds the frontend and serves both
the dashboard and API at `http://127.0.0.1:3000`. The demo requires a seeded
local database and opens without a sign-in screen.
