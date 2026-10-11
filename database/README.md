# Database integration checks

The integration tests use the PostgreSQL connection in `database/.env` and
expect the demo seed data to be present.

For a clean local database, apply the migrations and seed the demo records:

```bash
cd database
npx prisma migrate reset --force
node seed.js
npm test
```

`prisma migrate reset --force` drops the database schema and all data before
reapplying migrations. Run it only against a development database. Running
`node seed.js` again is safe and verifies seed idempotency.

When the simulation source is available under `simulation/`, run the
database-to-simulation integration check with:

```bash
node --test tests/simulation.integration.js
```
