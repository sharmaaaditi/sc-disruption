# Database

The database layer uses PostgreSQL and Prisma. Install PostgreSQL and create a
local database, then configure its connection in `database/.env` (keep this file
local and do not commit credentials):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sc_disruption?schema=public"
```

From the repository root, install the database package, apply migrations, and
load the demo data:

```bash
npm ci --prefix database
cd database
npx prisma migrate deploy
node seed.js
npm test
```

`migrate deploy` applies the checked-in migrations without dropping existing
data. For a new database, it creates the schema from those migrations. The
seed is safe to run repeatedly and provides one demo supply chain with four
nodes, three directed edges, two products, five inventory records, and one
50-unit order due at step 1.

## Structure and repository

The Prisma schema models `SupplyChain` and its `Node`s, directed `Edge`s,
`Product`s, per-node `Inventory`, and `Order`/`OrderItem` records. The SQL
migrations in `prisma/migrations/` are the source of truth for setting up the
schema.

`repositories/supplyChainRepository.js` is the database access layer used by
the backend. It provides supply-chain lookup, creation, and listing, plus
`loadSimulationInput()`, which maps a supply chain into the simulation
contract: `{ network: { nodes, edges }, inventory, orders }`.

Run the simulation integration check separately when the SimulationEngine
source is available in `simulation/src/engine/SimulationEngine.js`:

```bash
node --test tests/simulation.integration.js
```
