# 🚚 SC Disruption — Supply Chain Disruption Simulator

## 📌 Overview

SC Disruption is a graph-based simulation platform that models how supply-chain failures propagate through interconnected **suppliers, warehouses, distribution centers, and retailers**.

Users can introduce disruptions and analyze their effects on inventory, orders, routes, costs, and recovery.

## 🎯 Problem Statement

A failure at one point in a supply chain can cause cascading delays, inventory shortages, stockouts, and increased costs.

SC Disruption simulates these scenarios and helps evaluate possible recovery strategies.

## 🚀 Key Features

### 🌐 Network Visualization

* Suppliers, warehouses, DCs, retailers
* Transportation routes
* Capacity and lead times
* Network dependencies

### 💥 Disruption Simulation

* Supplier failure
* Reduced capacity
* Warehouse/DC failure
* Route blockage
* Shipment delays

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

* Alternative suppliers
* Alternative routes
* Inventory redistribution
* Capacity reallocation
* Recovery strategy comparison

## 🧠 Technical Core

The supply chain is modeled as a **directed weighted graph**.

Algorithms include:

* BFS/DFS dependency traversal
* Failure propagation
* Reachability analysis
* Shortest-path routing
* Capacity-aware routing
* Alternative path discovery

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
Analyze Losses
      ↓
Generate Recovery Strategies
```

## 🛠️ Tech Stack

**Frontend:** React, TypeScript, Tailwind CSS, React Flow, Recharts
**Backend:** Node.js, Express, TypeScript, Socket.IO
**Database:** PostgreSQL, Prisma
**Infrastructure:** Docker, Redis, BullMQ

## 📁 Project Structure

```text
sc-disruption/
│
├── apps/
│   ├── web/                       # React frontend
│   │   ├── components/            # UI components
│   │   ├── pages/                 # Application pages
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── services/              # API & WebSocket services
│   │   └── main.tsx
│   │
│   └── api/                       # Node.js backend
│       ├── routes/                # API routes
│       ├── controllers/           # Request handlers
│       ├── services/              # Business logic
│       ├── middleware/            # Validation & middleware
│       └── server.ts
│
├── packages/
│   ├── simulation/                # Simulation engine
│   │   ├── engine/
│   │   ├── events/
│   │   └── state/
│   │
│   ├── graph/                     # Graph algorithms
│   │   ├── algorithms/
│   │   └── models/
│   │
│   ├── optimization/              # Recovery strategies
│   │   └── strategies/
│   │
│   ├── database/                  # Prisma & database models
│   │   └── prisma/
│   │
│   └── shared/                    # Shared types & utilities
│
├── workers/                       # Background simulation jobs
│   ├── simulation-worker/
│   └── optimization-worker/
│
├── tests/                         # Automated tests
│   ├── simulation/
│   ├── graph/
│   └── optimization/
│
├── docs/                          # Technical documentation
│   ├── architecture.md
│   ├── simulation.md
│   └── algorithms.md
│
├── docker-compose.yml
├── package.json
└── README.md
```

## ⚙️ Setup

```bash
git clone https://github.com/sharmaaaditi/sc-disruption.git
cd sc-disruption
npm install

docker compose up -d

npx prisma migrate dev
npm run dev
```

## 🏁 Conclusion

**SC Disruption** combines graph algorithms, event-driven simulation, inventory modeling, optimization, and real-time visualization to study supply-chain resilience under disruptions.
