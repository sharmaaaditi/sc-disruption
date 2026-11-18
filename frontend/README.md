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

## Authorization development mode

Production authorization waits for P2's authenticated-user endpoint. For local
interface development only, copy `.env.example` to `.env.local` and set
`VITE_DEMO_ROLE` to `VIEWER`, `ANALYST`, or `ADMIN`. The variable is intentionally
unset by default and must not be treated as backend security.
