# Backend API contract

From the repository root, run `npm run dev` to start the API with automatic
restart on code changes, or `npm start` for a normal start. The API listens on
`PORT` (default `3000`). Before starting it, install/configure the database by
following [`database/README.md`](../database/README.md). All responses are JSON.
Success responses use
`{ "success": true, "data": ... }`; errors use
`{ "success": false, "error": { "code": "...", "message": "..." } }`.

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

## Retrieve a simulation

`GET /api/simulations/:id` returns the persisted run using the same result
fields, plus `completedAt`. Missing supply chains and run IDs return `404`;
invalid input returns `400`; unexpected server failures return `500` without
exposing internal error details.

The database persists run events and final state/metrics. It does not persist
the engine's per-step inventory timeline, so retrieval intentionally returns
the stored event history rather than a reconstructed timeline.
