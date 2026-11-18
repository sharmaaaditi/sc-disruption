# Backend API contract

From the repository root, run `npm run dev` to start the API with automatic
restart on code changes, or `npm start` for a normal start. The API listens on
`PORT` (default `3000`). Before starting it, install/configure the database by
following [`database/README.md`](../database/README.md). All responses are JSON.
Success responses use
`{ "success": true, "data": ... }`; errors use
`{ "success": false, "error": { "code": "...", "message": "..." } }`.

## CORS and Cross-Origin Access

The backend provides built-in CORS middleware to support browser clients such as
the P1 React frontend.

- Allowed origins are configured via the `CORS_ORIGINS` environment variable as a
  comma-separated list of origins (e.g. `http://localhost:5173,http://localhost:3000`).
- If `CORS_ORIGINS` is not defined or empty, the API defaults to safe local development
  origins: `http://localhost:5173`, `http://localhost:3000`, `http://127.0.0.1:5173`,
  and `http://127.0.0.1:3000`.
- Browser preflight (`OPTIONS`) requests are intercepted and answered with HTTP `204`
  and appropriate CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`,
  `Access-Control-Allow-Headers`, `Access-Control-Max-Age`) for authorized origins.
  Requests from unapproved origins receive HTTP `403` with no CORS headers.
- Unrestricted wildcards (`*`) are disallowed to protect API endpoints and sensitive data.

### Local development setup

When developing the frontend locally on Vite / React (port `5173`), requests are
permitted by default. For custom local ports or production hosts, define `CORS_ORIGINS`:

```bash
export CORS_ORIGINS="http://localhost:5173,http://localhost:8080,https://app.example.com"
npm run dev
```

## Health

`GET /api/health` returns `{ "status": "ok" }` inside `data`.

## List supply chains

`GET /api/supply-chains` returns the supply chains and their nodes in `data`.

## Start a simulation

`POST /api/supply-chains/:id/simulations` starts and persists a run for the
identified supply chain. The request must include at least one disruption:

```json
{
  "name": "Primary supplier outage",
  "disruptions": [
    {
      "type": "SUPPLIER_FAILURE",
      "targetId": "supplier-a",
      "startStep": 1,
      "duration": 3
    }
  ],
  "config": {
    "totalSteps": 10,
    "replenishmentThreshold": 30,
    "reorderBatchSize": 50
  }
}
```

`name` and `config` are optional; `totalSteps` defaults to `10`. Configuration
values must be positive integers. Disruption types currently accepted are
`SUPPLIER_FAILURE`, `NODE_OUTAGE`, and `EDGE_BLOCKAGE`. The target must belong
to the selected supply chain, and supplier failures must target supplier nodes.
Steps are zero-based, and a disruption is active from `startStep` through
`startStep + duration - 1`.

A successful request returns HTTP `201` and a `data` object containing `runId`,
`scenarioId`, `status`, `totalSteps`, `metrics`, `finalState`, and `events`.

## Simulation history

`GET /api/supply-chains/:id/simulations` returns saved simulation runs for the
selected supply chain in `data`, along with pagination details in `pagination`.

### Query parameters

- `status` (optional): Filter runs by status (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`).
- `limit` (optional): Validated result limit (positive integer from `1` to `100`, default `10`).
- `cursor` (optional): Stable cursor (`runId`) returning runs following that run.

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "run-id",
      "runId": "run-id",
      "scenarioId": "scenario-id",
      "scenarioName": "Primary supplier outage",
      "status": "COMPLETED",
      "totalSteps": 10,
      "startedAt": "2026-11-14T10:00:00.000Z",
      "completedAt": "2026-11-14T10:00:01.000Z",
      "metrics": {
        "totalOrders": 1,
        "totalDemand": 50,
        "fulfilledQuantity": 50,
        "remainingQuantity": 0,
        "stockoutEvents": 0,
        "stockouts": 0,
        "delayedOrders": 0,
        "additionalCost": 0,
        "recoveryTime": 0,
        "affectedNodes": [],
        "affectedEdges": []
      }
    }
  ],
  "pagination": {
    "limit": 10,
    "nextCursor": null,
    "hasMore": false
  }
}
```

Invalid supply chain IDs return `400` (`INVALID_REQUEST`) or `404` (`SUPPLY_CHAIN_NOT_FOUND`).
Invalid filters return `400` (`INVALID_FILTER`).
Invalid limits return `400` (`INVALID_LIMIT`).

## Retrieve a simulation

`GET /api/simulations/:id` returns the persisted run using the same result
fields, plus `completedAt`. Missing supply chains and run IDs return `404`;
invalid input returns `400`; unexpected server failures return `500` without
exposing internal error details.

The database persists run events and final state/metrics. It does not persist
the engine's per-step inventory timeline, so retrieval intentionally returns
the stored event history rather than a reconstructed timeline.

## Database API integration testing

An automated end-to-end integration test (`backend/tests/databaseIntegration.test.js`)
verifies the complete flow:

Node API -> PostgreSQL/Prisma -> Simulation Engine -> Saved Run -> Retrieval API

To safeguard development and user data, this test runs against an isolated test
database configured via `DATABASE_URL_TEST`. It creates uniquely named test records
and cleans up only those records upon test completion.

### Local setup and execution

1. Create a dedicated test database (e.g. `sc_disruption_test`) in PostgreSQL.
2. Apply migrations to the test database:
   ```bash
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sc_disruption_test?schema=public" npx prisma migrate deploy --schema=database/prisma/schema.prisma
   ```
3. Run the integration test:
   ```bash
   DATABASE_URL_TEST="postgresql://USER:PASSWORD@localhost:5432/sc_disruption_test?schema=public" npm run test:integration
   ```
   Or run the full test suite including the database integration test:
   ```bash
   DATABASE_URL_TEST="postgresql://USER:PASSWORD@localhost:5432/sc_disruption_test?schema=public" npm test
   ```
