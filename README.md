# 🚚 SC Disruption — Supply Chain Disruption Simulator

## 📌 Overview

SC Disruption is a graph-based simulation platform that models how supply-chain failures propagate through interconnected **suppliers, warehouses, distribution centers, and retailers**.

The current MVP lets users choose a saved network, run a supplier disruption, and inspect persisted inventory, order, metric, and event results. Recovery optimization and account authentication are planned follow-up work.

## 🎯 Problem Statement

A failure at one point in a supply chain can cause cascading delays, inventory shortages, stockouts, and increased costs.

SC Disruption simulates these scenarios and helps evaluate possible recovery strategies.

## 🚀 Key Features

### 🌐 Network Visualization

* Suppliers, warehouses, distribution centers, and retailers
* Facility map for the saved network
* Network data loaded from the database API

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
* Additional costs
* Recovery time

### 🔄 Recovery & Optimization

Recovery strategy comparison is planned. The current engine reports recovery timing and impact metrics but does not yet generate alternative strategies.

## 🧠 Technical Core

The supply chain is modeled as a **directed weighted graph**.

Algorithms include:

* BFS/DFS dependency traversal
* Failure propagation
* Reachability analysis
* Shortest-path routing
* Shortest-path and reachability helpers

Capacity-aware routing and alternative-path optimization are planned extensions.

Optimization considers:

`Transportation Cost + Delay Penalty + Stockout Penalty + Recovery Time`

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

```bash
git clone https://github.com/sharmaaaditi/sc-disruption.git
cd sc-disruption
npm ci
npm ci --prefix frontend

# Configure PostgreSQL and database/.env first; see database/README.md.
npm run dev
npm run frontend:dev
```

## 🏁 Conclusion

**SC Disruption** currently combines graph algorithms, event-driven simulation,
database persistence, and a browser dashboard to study supply-chain resilience
under disruptions. Optimization workers, real-time messaging, and account
authentication are planned rather than current features.
