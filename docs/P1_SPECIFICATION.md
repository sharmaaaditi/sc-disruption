# 📐 P1 Specification: Supply Chain Graph & Simulation Engine Interfaces

## 1. Overview
This document defines the formal interfaces, data structures, and algorithmic contracts for **Person 1 (P1)** in the **SC Disruption** platform.

It covers:
- **Graph Representation**: Directed multigraph modeling nodes (Suppliers, Warehouses, DCs, Retailers) and edges (Transportation routes).
- **Disruption Model**: Standardized disruption events, failure injection, and recovery parameters.
- **Simulation Input & Output Formats**: Data contracts aligning P1 (Simulation Engine) with P3 (Prisma Database Models) and P2/P4 (API & Scenarios).
- **Supply Propagation & Event Flow**: Rules for discrete time-step execution, lead times, inventory depletion, stockout detection, and recovery.

---

## 2. Graph Representation

The supply chain is represented as a directed graph $G = (V, E)$.

### 2.1 Node Definition (`V`)
Each node represents an entity in the supply chain echelon.

```typescript
type NodeType = 
  | 'SUPPLIER'
  | 'WAREHOUSE'
  | 'DISTRIBUTION_CENTER'
  | 'RETAILER';

interface Node {
  id: string;               // Unique node identifier (matches Prisma Node.id)
  name: string;             // Display name (e.g., "Supplier North", "Dallas DC")
  type: NodeType;           // Echelon tier
  capacity?: number;        // Optional storage/throughput limit (units)
  leadTime?: number;        // Internal processing/handling steps (default: 0)
}
```

### 2.2 Edge Definition (`E`)
Each edge represents a directed transportation or distribution route from node $u$ to node $v$.

```typescript
interface Edge {
  id: string;               // Unique route identifier (matches Prisma Edge.id)
  fromNodeId: string;       // Origin node id
  toNodeId: string;         // Destination node id
  distance?: number;        // Physical distance (km / miles)
  travelTime: number;       // Lead time in discrete simulation steps (default: 1)
  capacity?: number;        // Max throughput units per time step (optional)
  costPerUnit?: number;     // Transport cost per unit shipped (optional)
}
```

### 2.3 Graph Adjacency & Traversal Capabilities
The graph data structure supports:
- **Adjacency Lists**: Outgoing edges `outgoing: Map<string, Edge[]>` and incoming edges `incoming: Map<string, Edge[]>`.
- **Breadth-First Search (BFS)**: Downstream flow exploration and shortest-hop traversal.
- **Depth-First Search (DFS)**: Deep dependency chains and topological ordering.
- **Reachability Analysis**: `isReachable(fromId, toId, { blockedNodes, blockedEdges })`.
- **Shortest Path Routing**: Dijkstra's algorithm weighted by `travelTime` or `distance`, with dynamic avoidance of disrupted/blocked nodes and routes.
- **Alternative Path Discovery**: Multi-path fallback when primary routes are severed.

---

## 3. Disruption Model

Disruptions simulate adverse events impacting nodes or transportation routes over time.

### 3.1 Disruption Types
- `SUPPLIER_FAILURE`: Halts or reduces supply generation at a supplier node.
- `NODE_OUTAGE`: Complete shutdown of a node (warehouse/DC/retailer). Inbound and outbound shipments cannot process; inventory is locked.
- `EDGE_BLOCKAGE`: Route blockage (e.g., canal closure, port congestion, road closure). No shipments can traverse the edge.
- `CAPACITY_REDUCTION`: Throughput capacity of a node or edge is diminished by a fractional severity.
- `DELAY`: Transit time on a route increases by a specified number of steps.

### 3.2 Disruption Schema
```typescript
type DisruptionType = 
  | 'SUPPLIER_FAILURE'
  | 'NODE_OUTAGE'
  | 'EDGE_BLOCKAGE'
  | 'CAPACITY_REDUCTION'
  | 'DELAY';

interface Disruption {
  id: string;               // Unique disruption identifier
  type: DisruptionType;     // Type of failure
  targetId: string;         // Affected Node ID or Edge ID
  startStep: number;        // Step index where disruption begins (0-indexed, inclusive)
  duration: number;         // Duration in steps
  severity?: number;        // 0.0 (no impact) to 1.0 (100% complete failure). Default: 1.0
  description?: string;     // Human-readable summary (e.g., "Suez Canal Blockage")
}
```

---

## 4. Simulation Input & Output Contracts

### 4.1 Simulation Input Contract
Matches the data produced by P3's `loadSimulationInput(supplyChainId)` combined with scenario disruption parameters:

```typescript
interface SimulationInput {
  network: {
    nodes: Node[];
    edges: Edge[];
  };
  inventory: Array<{
    nodeId: string;
    productId: string;
    quantity: number;
    product?: {
      name: string;
      sku: string;
    };
  }>;
  orders: Array<{
    orderId: string;
    nodeId: string;
    productId: string;
    quantity: number;
    dueStep?: number;       // Step at which order is demanded (default: 0)
    status?: string;        // 'PENDING' | 'FULFILLED' | 'DELAYED'
    product?: {
      name: string;
      sku: string;
    };
  }>;
  disruptions?: Disruption[];
  config?: {
    totalSteps: number;           // Total simulation steps (e.g., 10)
    replenishmentThreshold?: number; // Reorder threshold (default: 50)
    reorderBatchSize?: number;    // Batch size when ordering upstream (default: 100)
    unitDelayPenalty?: number;    // Financial penalty per delayed unit per step ($)
    unitStockoutPenalty?: number; // Financial penalty per unfulfilled unit ($)
    unitTransportCost?: number;   // Transport cost per unit per step ($)
  };
}
```

### 4.2 Simulation Output Contract
```typescript
interface SimulationMetrics {
  ordersTotal: number;
  ordersFulfilled: number;
  ordersDelayed: number;
  ordersUnfulfilled: number;
  totalDemand: number;
  totalFulfilledQuantity: number;
  totalShortageQuantity: number;
  fillRate: number;               // totalFulfilledQuantity / totalDemand (0.0 to 1.0)
  stockoutEventsCount: number;
  affectedNodes: string[];        // Unique node IDs impacted by disruptions/stockouts
  affectedEdges: string[];        // Unique edge IDs impacted by blockages
  financialImpact: {
    transportCost: number;
    delayPenalty: number;
    stockoutPenalty: number;
    totalCost: number;
  };
}

interface SimulationEvent {
  step: number;
  type: 
    | 'DISRUPTION_ACTIVATED'
    | 'DISRUPTION_RESOLVED'
    | 'SHIPMENT_DISPATCHED'
    | 'SHIPMENT_ARRIVED'
    | 'ORDER_FULFILLED'
    | 'ORDER_DELAYED'
    | 'STOCKOUT_OCCURRED'
    | 'REPLENISHMENT_ORDERED';
  targetType: 'NODE' | 'EDGE' | 'ORDER' | 'SHIPMENT';
  targetId: string;
  message: string;
  data?: Record<string, any>;
}

interface StepSnapshot {
  step: number;
  inventories: Record<string, Record<string, number>>; // nodeId -> productId -> qty
  inTransitShipmentsCount: number;
  activeDisruptions: string[];                        // Array of active disruption IDs
}

interface SimulationOutput {
  runId: string;
  status: 'COMPLETED' | 'FAILED';
  totalSteps: number;
  metrics: SimulationMetrics;
  events: SimulationEvent[];
  timeline: StepSnapshot[];
}
```

---

## 5. Discrete Time-Step Simulation Algorithm

At each time step $t \in [0, \text{totalSteps} - 1]$:

```text
Step Lifecycle:
1. Disruption Lifecycle:
   - If t == disruption.startStep => activate disruption, apply restrictions.
   - If t == disruption.startStep + duration => resolve disruption, restore node/edge.

2. Shipment Arrival & Inbound Handling:
   - For all in-transit shipments where arrivalStep <= t:
     - If destination node is not under NODE_OUTAGE:
       - Deliver inventory: destInventory += shipment.quantity.
       - Emit SHIPMENT_ARRIVED event.
     - Else:
       - Hold shipment in transit (delayed due to node outage).

3. Order Demand & Fulfillment:
   - For active orders with dueStep <= t:
     - Check local inventory at order.nodeId.
     - If available >= order.remainingQty:
       - Fulfill order, deduct inventory.
       - Emit ORDER_FULFILLED event.
     - Else if available > 0:
       - Partially fulfill order, deduct inventory.
       - Emit ORDER_DELAYED event.
     - Else (available == 0):
       - Record stockout.
       - Emit STOCKOUT_OCCURRED and ORDER_DELAYED events.

4. Upstream Replenishment & Supply Propagation:
   - Nodes needing replenishment inspect reachable upstream suppliers/warehouses.
   - Path search uses graph.findShortestPath() excluding blocked edges and failed nodes.
   - If an operational upstream node has inventory:
     - Dispatch shipment along outgoing route.
     - Deduct from upstream node inventory.
     - arrivalStep = t + edge.travelTime.
     - Emit SHIPMENT_DISPATCHED event.
   - If supplier is under SUPPLIER_FAILURE:
     - Supplier production is 0; dispatch fails; downstream starvation propagates.

5. Metrics & Snapshot:
   - Calculate step penalties and append step inventory snapshot to timeline.
```
