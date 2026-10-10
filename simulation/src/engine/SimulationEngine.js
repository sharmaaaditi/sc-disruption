/**
 * @file SimulationEngine.js
 * Discrete-event simulation engine for supply chain networks.
 * Models multi-echelon inventory depletion, replenishment lead times,
 * disruption failure propagation, route blockages, and recovery events.
 */

const SupplyChainGraph = require('../graph/SupplyChainGraph');
const {
  NodeType,
  DisruptionType,
  EventType,
  OrderStatus,
  ShipmentStatus,
} = require('../types/simulationTypes');

class SimulationEngine {
  /**
   * @param {Object} input - Simulation input contract
   * @param {Object} input.network - { nodes, edges }
   * @param {Array<Object>} input.inventory - [{ nodeId, productId, quantity }]
   * @param {Array<Object>} input.orders - [{ orderId, nodeId, productId, quantity, dueStep }]
   * @param {Array<Object>} [input.disruptions] - [{ id, type, targetId, startStep, duration, severity }]
   * @param {Object} [input.config] - Simulation run configuration
   */
  constructor(input) {
    if (!input || !input.network) {
      throw new Error('SimulationInput must contain a valid network');
    }

    this.runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.rawInput = input;

    // 1. Build Graph
    this.graph = SupplyChainGraph.fromJSON(input.network);

    // 2. Configuration
    const cfg = input.config || {};
    this.config = {
      totalSteps: typeof cfg.totalSteps === 'number' ? cfg.totalSteps : 10,
      replenishmentThreshold: typeof cfg.replenishmentThreshold === 'number' ? cfg.replenishmentThreshold : 30,
      reorderBatchSize: typeof cfg.reorderBatchSize === 'number' ? cfg.reorderBatchSize : 50,
      unitDelayPenalty: typeof cfg.unitDelayPenalty === 'number' ? cfg.unitDelayPenalty : 20,
      unitStockoutPenalty: typeof cfg.unitStockoutPenalty === 'number' ? cfg.unitStockoutPenalty : 50,
      unitTransportCost: typeof cfg.unitTransportCost === 'number' ? cfg.unitTransportCost : 1.0,
    };

    // 3. State: Inventories (nodeId -> productId -> quantity)
    /** @type {Map<string, Map<string, number>>} */
    this.inventory = new Map();
    for (const node of this.graph.getAllNodes()) {
      this.inventory.set(node.id, new Map());
    }

    if (Array.isArray(input.inventory)) {
      for (const item of input.inventory) {
        if (!this.inventory.has(item.nodeId)) {
          this.inventory.set(item.nodeId, new Map());
        }
        const currentQty = this.inventory.get(item.nodeId).get(item.productId) || 0;
        this.inventory.get(item.nodeId).set(item.productId, currentQty + (item.quantity || 0));
      }
    }

    // 4. State: Orders
    this.orders = (input.orders || []).map((o, idx) => ({
      orderId: o.orderId || `ord_${idx}`,
      nodeId: o.nodeId,
      productId: o.productId,
      demandedQuantity: o.quantity || 0,
      fulfilledQuantity: 0,
      remainingQuantity: o.quantity || 0,
      dueStep: typeof o.dueStep === 'number' ? o.dueStep : 0,
      status: OrderStatus.PENDING,
      product: o.product || null,
    }));

    // 5. State: Disruptions
    this.disruptions = (input.disruptions || []).map((d, idx) => ({
      id: d.id || `dis_${idx}`,
      type: d.type || DisruptionType.NODE_OUTAGE,
      targetId: d.targetId,
      startStep: typeof d.startStep === 'number' ? d.startStep : 0,
      duration: typeof d.duration === 'number' ? d.duration : 1,
      severity: typeof d.severity === 'number' ? d.severity : 1.0,
      description: d.description || '',
    }));

    // 6. State: In-transit Shipments
    /** @type {Array<Object>} */
    this.shipments = [];
    this.shipmentCounter = 0;

    // 7. Output tracking
    this.events = [];
    this.timeline = [];
    this.affectedNodes = new Set();
    this.affectedEdges = new Set();
    this.stockoutEventsCount = 0;
    this.transportCostTotal = 0;
    this.delayPenaltyTotal = 0;
    this.stockoutPenaltyTotal = 0;
  }

  /**
   * Log an event during simulation.
   * @private
   */
  _logEvent(step, type, targetType, targetId, message, data = {}) {
    this.events.push({
      step,
      type,
      targetType,
      targetId,
      message,
      data,
    });
  }

  /**
   * Helper to get inventory quantity.
   */
  getInventory(nodeId, productId) {
    if (!this.inventory.has(nodeId)) return 0;
    return this.inventory.get(nodeId).get(productId) || 0;
  }

  /**
   * Helper to set inventory quantity.
   */
  setInventory(nodeId, productId, qty) {
    if (!this.inventory.has(nodeId)) {
      this.inventory.set(nodeId, new Map());
    }
    this.inventory.get(nodeId).set(productId, Math.max(0, qty));
  }

  /**
   * Helper to adjust inventory quantity.
   */
  adjustInventory(nodeId, productId, delta) {
    const current = this.getInventory(nodeId, productId);
    const updated = Math.max(0, current + delta);
    this.setInventory(nodeId, productId, updated);
    return updated;
  }

  /**
   * Execute one simulation time-step.
   * @param {number} step - Current time step index
   */
  step(step) {
    // -------------------------------------------------------------
    // Phase 1: Disruption Activation & Recovery
    // -------------------------------------------------------------
    const activeDisruptions = [];
    const blockedNodes = new Set();
    const blockedEdges = new Set();

    for (const disruption of this.disruptions) {
      const endStep = disruption.startStep + disruption.duration;

      // Check Activation
      if (step === disruption.startStep) {
        this._logEvent(
          step,
          EventType.DISRUPTION_ACTIVATED,
          disruption.type === DisruptionType.EDGE_BLOCKAGE ? 'EDGE' : 'NODE',
          disruption.targetId,
          `Disruption "${disruption.id}" (${disruption.type}) activated. ${disruption.description}`.trim(),
          { disruption }
        );
      }

      // Check Resolution
      if (step === endStep) {
        this._logEvent(
          step,
          EventType.DISRUPTION_RESOLVED,
          disruption.type === DisruptionType.EDGE_BLOCKAGE ? 'EDGE' : 'NODE',
          disruption.targetId,
          `Disruption "${disruption.id}" resolved. Operations restored.`,
          { disruption }
        );
      }

      // Check Active Status
      if (step >= disruption.startStep && step < endStep) {
        activeDisruptions.push(disruption.id);

        if (
          disruption.type === DisruptionType.SUPPLIER_FAILURE ||
          disruption.type === DisruptionType.NODE_OUTAGE
        ) {
          blockedNodes.add(disruption.targetId);
          this.affectedNodes.add(disruption.targetId);
        } else if (disruption.type === DisruptionType.EDGE_BLOCKAGE) {
          blockedEdges.add(disruption.targetId);
          this.affectedEdges.add(disruption.targetId);
        }
      }
    }

    // -------------------------------------------------------------
    // Phase 2: Shipment Arrivals & Inbound Processing
    // -------------------------------------------------------------
    for (const shipment of this.shipments) {
      if (shipment.status === ShipmentStatus.IN_TRANSIT && shipment.arrivalStep <= step) {
        // If destination node is under outage, hold shipment
        if (blockedNodes.has(shipment.toNodeId)) {
          shipment.status = ShipmentStatus.HELD;
          this.affectedNodes.add(shipment.toNodeId);
        } else {
          // Deliver shipment into node inventory
          this.adjustInventory(shipment.toNodeId, shipment.productId, shipment.quantity);
          shipment.status = ShipmentStatus.DELIVERED;

          this._logEvent(
            step,
            EventType.SHIPMENT_ARRIVED,
            'SHIPMENT',
            shipment.id,
            `Shipment "${shipment.id}" arrived at node "${shipment.toNodeId}": +${shipment.quantity} units of product "${shipment.productId}".`,
            { shipment }
          );
        }
      } else if (
        shipment.status === ShipmentStatus.HELD &&
        !blockedNodes.has(shipment.toNodeId)
      ) {
        // Recover held shipment
        this.adjustInventory(shipment.toNodeId, shipment.productId, shipment.quantity);
        shipment.status = ShipmentStatus.DELIVERED;

        this._logEvent(
          step,
          EventType.SHIPMENT_ARRIVED,
          'SHIPMENT',
          shipment.id,
          `Held shipment "${shipment.id}" cleared and delivered to node "${shipment.toNodeId}": +${shipment.quantity} units.`,
          { shipment }
        );
      }
    }

    // -------------------------------------------------------------
    // Phase 3: Demand Fulfillment & Stockout Detection
    // -------------------------------------------------------------
    for (const order of this.orders) {
      if (order.remainingQuantity > 0 && order.dueStep <= step) {
        const destNode = order.nodeId;
        const availableStock = this.getInventory(destNode, order.productId);

        if (availableStock >= order.remainingQuantity) {
          // Full fulfillment
          const fulfilledAmount = order.remainingQuantity;
          this.adjustInventory(destNode, order.productId, -fulfilledAmount);
          order.fulfilledQuantity += fulfilledAmount;
          order.remainingQuantity = 0;
          order.status = (step === order.dueStep) ? OrderStatus.FULFILLED : OrderStatus.DELAYED;

          this._logEvent(
            step,
            EventType.ORDER_FULFILLED,
            'ORDER',
            order.orderId,
            `Order "${order.orderId}" fulfilled (${fulfilledAmount} units) at node "${destNode}".`,
            { order, fulfilledAmount }
          );
        } else if (availableStock > 0) {
          // Partial fulfillment
          const fulfilledAmount = availableStock;
          this.adjustInventory(destNode, order.productId, -fulfilledAmount);
          order.fulfilledQuantity += fulfilledAmount;
          order.remainingQuantity -= fulfilledAmount;
          order.status = OrderStatus.DELAYED;

          this.stockoutEventsCount++;
          this.affectedNodes.add(destNode);

          this._logEvent(
            step,
            EventType.STOCKOUT_OCCURRED,
            'NODE',
            destNode,
            `Partial stockout at node "${destNode}": could only fulfill ${fulfilledAmount} of ${order.demandedQuantity} units for order "${order.orderId}".`,
            { order, shortQty: order.remainingQuantity }
          );

          this._logEvent(
            step,
            EventType.ORDER_DELAYED,
            'ORDER',
            order.orderId,
            `Order "${order.orderId}" delayed at step ${step}. Remaining: ${order.remainingQuantity} units.`,
            { order }
          );
        } else {
          // Total stockout for this demand
          order.status = OrderStatus.DELAYED;
          this.stockoutEventsCount++;
          this.affectedNodes.add(destNode);

          this._logEvent(
            step,
            EventType.STOCKOUT_OCCURRED,
            'NODE',
            destNode,
            `Stockout at node "${destNode}" for product "${order.productId}". Zero inventory available for order "${order.orderId}".`,
            { order }
          );

          this._logEvent(
            step,
            EventType.ORDER_DELAYED,
            'ORDER',
            order.orderId,
            `Order "${order.orderId}" unfulfilled and delayed at step ${step}.`,
            { order }
          );
        }

        // Apply financial delay / shortage penalty per step
        if (order.remainingQuantity > 0) {
          this.delayPenaltyTotal += order.remainingQuantity * this.config.unitDelayPenalty;
          this.stockoutPenaltyTotal += order.remainingQuantity * this.config.unitStockoutPenalty;
        }
      }
    }

    // -------------------------------------------------------------
    // Phase 4: Supply Propagation & Replenishment
    // -------------------------------------------------------------
    // Nodes check inventory vs replenishment threshold
    const nodes = this.graph.getAllNodes();

    for (const node of nodes) {
      if (node.type === NodeType.SUPPLIER) continue; // Suppliers produce, not pull
      if (blockedNodes.has(node.id)) continue; // Inoperative node cannot order

      // Check inventory of each known product
      const productMap = this.inventory.get(node.id);
      if (!productMap) continue;

      for (const [productId, currentQty] of productMap.entries()) {
        // Calculate pending inbound supply
        const inboundQty = this.shipments
          .filter(
            (s) =>
              s.toNodeId === node.id &&
              s.productId === productId &&
              s.status === ShipmentStatus.IN_TRANSIT
          )
          .reduce((acc, s) => acc + s.quantity, 0);

        if (currentQty + inboundQty < this.config.replenishmentThreshold) {
          const neededQty = this.config.reorderBatchSize;

          // Find reachable upstream suppliers or distribution centers with stock
          const upstreamNodes = Array.from(
            this.graph.getUpstreamReachableNodes(node.id, {
              blockedNodes,
              blockedEdges,
            })
          ).filter((upId) => upId !== node.id);

          let candidateSupplier = null;
          let shortestPathInfo = null;

          for (const upId of upstreamNodes) {
            const upStock = this.getInventory(upId, productId);
            if (upStock > 0 && !blockedNodes.has(upId)) {
              // Check route path
              const pathResult = this.graph.findShortestPath(upId, node.id, {
                blockedNodes,
                blockedEdges,
              });

              if (pathResult) {
                if (!shortestPathInfo || pathResult.totalWeight < shortestPathInfo.totalWeight) {
                  shortestPathInfo = pathResult;
                  candidateSupplier = upId;
                }
              }
            }
          }

          // If operational candidate supplier found, dispatch shipment along next hop
          if (candidateSupplier && shortestPathInfo && shortestPathInfo.edges.length > 0) {
            const availableUpStock = this.getInventory(candidateSupplier, productId);
            const dispatchQty = Math.min(neededQty, availableUpStock);

            if (dispatchQty > 0) {
              this.adjustInventory(candidateSupplier, productId, -dispatchQty);

              // Edge along the shortest path (direct or first hop)
              const firstEdge = shortestPathInfo.edges[0];
              const travelTime = firstEdge.travelTime || 1;
              const arrivalStep = step + travelTime;

              const shipment = {
                id: `ship_${++this.shipmentCounter}`,
                fromNodeId: candidateSupplier,
                toNodeId: firstEdge.toNodeId,
                productId,
                quantity: dispatchQty,
                dispatchStep: step,
                arrivalStep,
                status: ShipmentStatus.IN_TRANSIT,
                edgeId: firstEdge.id,
              };

              this.shipments.push(shipment);

              // Transportation cost calculation
              const cost = dispatchQty * travelTime * this.config.unitTransportCost;
              this.transportCostTotal += cost;

              this._logEvent(
                step,
                EventType.REPLENISHMENT_ORDERED,
                'NODE',
                node.id,
                `Node "${node.id}" requested ${dispatchQty} units of "${productId}" from upstream node "${candidateSupplier}".`,
                { candidateSupplier, dispatchQty, productId }
              );

              this._logEvent(
                step,
                EventType.SHIPMENT_DISPATCHED,
                'SHIPMENT',
                shipment.id,
                `Shipment "${shipment.id}" dispatched from "${candidateSupplier}" to "${firstEdge.toNodeId}" (arriving step ${arrivalStep}).`,
                { shipment }
              );
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Phase 5: Timeline Snapshot
    // -------------------------------------------------------------
    const inventorySnapshot = {};
    for (const [nodeId, prodMap] of this.inventory.entries()) {
      inventorySnapshot[nodeId] = {};
      for (const [prodId, qty] of prodMap.entries()) {
        inventorySnapshot[nodeId][prodId] = qty;
      }
    }

    const inTransitCount = this.shipments.filter(
      (s) => s.status === ShipmentStatus.IN_TRANSIT
    ).length;

    this.timeline.push({
      step,
      inventories: inventorySnapshot,
      inTransitShipmentsCount: inTransitCount,
      activeDisruptions: [...activeDisruptions],
    });
  }

  /**
   * Run the complete simulation across all time steps.
   * @returns {Object} SimulationOutput
   */
  run() {
    for (let step = 0; step < this.config.totalSteps; step++) {
      this.step(step);
    }

    return this.getResults();
  }

  /**
   * Compute final summary metrics and return standardized SimulationOutput contract.
   * @returns {Object} SimulationOutput
   */
  getResults() {
    const totalDemand = this.orders.reduce((acc, o) => acc + o.demandedQuantity, 0);
    const totalFulfilledQuantity = this.orders.reduce((acc, o) => acc + o.fulfilledQuantity, 0);
    const totalShortageQuantity = this.orders.reduce((acc, o) => acc + o.remainingQuantity, 0);

    const ordersFulfilled = this.orders.filter(
      (o) => o.status === OrderStatus.FULFILLED && o.remainingQuantity === 0
    ).length;
    const ordersDelayed = this.orders.filter(
      (o) => o.status === OrderStatus.DELAYED || (o.remainingQuantity === 0 && o.fulfilledQuantity > 0 && o.status !== OrderStatus.FULFILLED)
    ).length;
    const ordersUnfulfilled = this.orders.filter((o) => o.remainingQuantity > 0).length;

    const fillRate = totalDemand > 0 ? Number((totalFulfilledQuantity / totalDemand).toFixed(4)) : 1.0;

    const financialImpact = {
      transportCost: Number(this.transportCostTotal.toFixed(2)),
      delayPenalty: Number(this.delayPenaltyTotal.toFixed(2)),
      stockoutPenalty: Number(this.stockoutPenaltyTotal.toFixed(2)),
      totalCost: Number(
        (this.transportCostTotal + this.delayPenaltyTotal + this.stockoutPenaltyTotal).toFixed(2)
      ),
    };

    return {
      runId: this.runId,
      status: 'COMPLETED',
      totalSteps: this.config.totalSteps,
      metrics: {
        ordersTotal: this.orders.length,
        ordersFulfilled,
        ordersDelayed,
        ordersUnfulfilled,
        totalDemand,
        totalFulfilledQuantity,
        totalShortageQuantity,
        fillRate,
        stockoutEventsCount: this.stockoutEventsCount,
        affectedNodes: Array.from(this.affectedNodes),
        affectedEdges: Array.from(this.affectedEdges),
        financialImpact,
      },
      events: this.events,
      timeline: this.timeline,
    };
  }
}

module.exports = SimulationEngine;
