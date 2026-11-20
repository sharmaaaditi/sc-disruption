# 🚚 SC Disruption — Supply Chain Disruption Simulator

## 📌 Overview

SC Disruption is a graph-based simulation platform that models how supply-chain failures propagate through interconnected **suppliers, warehouses, distribution centers, and retailers**.

The current MVP lets users choose a saved network, run a supplier disruption, and inspect persisted inventory, order, metric, and event results. Recovery optimization and account authentication are planned follow-up work.

## 🎯 Problem Statement

A failure at one point in a supply chain can cause cascading delays, inventory shortages, stockouts, and increased costs.

SC Disruption shows how a disruption affects order fulfilment, inventory, and recovery time.

## 🚀 Key Features

### 🌐 Network Visualization

* Suppliers, warehouses, distribution centers, and retailers
* Facility map with arrows for the routes stored in PostgreSQL

Detailed route and capacity visualizations remain planned.

### 💥 Disruption Simulation

* Supplier failure
* Warehouse/DC outage and route-blockage engine inputs
* Inventory, order, and stockout impact calculation

### ⚙️ Simulation Engine

* Event-driven simulation
* Failure propagation
* Inventory depletion
* Order delays
* Stockout detection

### 📊 Impact Analysis

* Affected nodes
* Delayed orders
* Stockouts
* Recovery time

### 🔄 Recovery & Optimization

Recovery strategy comparison is planned. The current engine reports recovery timing and impact metrics but does not yet generate alternative strategies.

## 🧠 Technical Core

The supply chain is modeled as a **directed weighted graph**.

Algorithms include:

* Breadth-first and depth-first traversal
* Upstream reachability and shortest-path helpers
* Step-by-step inventory, order, and disruption processing

Capacity-aware routing and alternative-path optimization are planned extensions.

## 🔄 How It Works

```text
Create Network
      ↓
Add Products & Inventory
      ↓
Create Orders
      ↓
Inject Disruption
      ↓
Run Simulation
      ↓
Propagate Impact
      ↓
Analyze Impact
```

## 🛠️ Tech Stack

**Frontend:** React, TypeScript, Vite, React Flow, Recharts, GSAP
**Backend:** Node.js and Express
**Database:** PostgreSQL, Prisma
**Infrastructure:** Local Node.js and PostgreSQL services

Redis, BullMQ, Socket.IO, Docker orchestration, and background workers are not
part of the current checked-in MVP.

## 📁 Project Structure

```text
sc-disruption-app/
├── backend/                       # Express API and service layer
├── database/                      # Prisma schema, migrations, repositories
├── simulation/                    # Graph and simulation engine
├── frontend/                      # React/Vite application
├── docs/                          # API and design documentation
├── package.json
└── README.md
```

## ⚙️ Setup

Use Node.js 22.12+ (or a compatible newer LTS) and a running local PostgreSQL
server. Create a database, then set the connection in `database/.env` as
described in the [database setup guide](database/README.md).

```bash
git clone https://github.com/sharmaaaditi/sc-disruption.git
cd sc-disruption
npm ci
npm ci --prefix frontend
npm ci --prefix database --ignore-scripts
(cd database && npx prisma generate && npx prisma migrate deploy && node seed.js)
npm run demo
```

Open [the local demo](http://127.0.0.1:3000). One terminal serves both the
dashboard and the API. After the first setup, run `npm run demo` whenever
you want to start the app. The demo binds to your own machine and requires
no sign-in.

For development with live reload, run `npm run dev` and
`npm run frontend:dev` in separate terminals.

## Demo and viva walkthrough

1. Select **Demo Supply Chain** and trace the arrows from Supplier A
   through the warehouse and distribution center to Retailer A.
2. Select **Supplier A**, start at step **1**, set duration to **3**,
   and run for **10** steps. Open the event timeline and show activation
   at step 1 and recovery at step 4.
3. Explain the result. The retailer starts with 100 units and the order
   needs 50, so the disruption activates but the retailer still fulfils
   all 50 units without a delay.
4. Try a duration of **10** with the same 10-step window. Recovery is due
   at step 11, outside the run, so the timeline has no recovery event.
   The recovery metric uses zero when the run ends before recovery.

For the viva, describe the data flow in one sentence: React sends the
scenario to Express, Prisma reads the network and inventory from PostgreSQL,
the JavaScript engine advances one step at a time, and Prisma saves the run,
events, and metrics before the results come back to the dashboard.

## Checks

```bash
npm test
npm run frontend:test
npm run frontend:build
```

Set `DATABASE_URL_TEST` to a separate migrated PostgreSQL database to run
the API persistence test. See the [API testing instructions](docs/api.md#database-api-integration-testing).

## 🏁 Conclusion

**SC Disruption** currently combines graph algorithms, event-driven simulation,
database persistence, and a browser dashboard to study supply-chain resilience
under disruptions. Optimization workers, real-time messaging, and account
authentication are planned rather than current features.
