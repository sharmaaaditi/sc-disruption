const SupplyChainGraph = require('../graph/SupplyChainGraph');
const { NodeType, DisruptionType, EventType } = require('../types/simulationTypes');

class SimulationEngine {
  constructor(input) {
    if (!input || !input.network) {
      throw new Error('Simulation input needs a network');
    }

    this.runId = 'run_' + Date.now();
    this.graph = SupplyChainGraph.fromJSON(input.network);

    const cfg = input.config || {};
    this.totalSteps = cfg.totalSteps || 10;
    this.replenishThreshold = cfg.replenishmentThreshold || 30;
    this.batchSize = cfg.reorderBatchSize || 50;

    // Setup inventory map: nodeId -> productId -> qty
    this.inventory = new Map();
    for (const node of this.graph.getAllNodes()) {
      this.inventory.set(node.id, new Map());
    }

    if (Array.isArray(input.inventory)) {
      for (const item of input.inventory) {
        if (!this.inventory.has(item.nodeId)) {
          this.inventory.set(item.nodeId, new Map());
        }
        const current = this.inventory.get(item.nodeId).get(item.productId) || 0;
        this.inventory.get(item.nodeId).set(item.productId, current + (item.quantity || 0));
      }
    }

    // Copy orders with progress tracking
    this.orders = (input.orders || []).map((o, index) => ({
      orderId: o.orderId || 'ord_' + index,
      nodeId: o.nodeId,
      productId: o.productId,
      demandedQuantity: o.quantity || 0,
      fulfilledQuantity: 0,
      remainingQuantity: o.quantity || 0,
      dueStep: o.dueStep || 0,
      status: 'PENDING',
    }));

    this.disruptions = input.disruptions || [];
    this.shipments = [];
    this.shipmentIdCounter = 0;
    this.events = [];
    this.timeline = [];
    this.affectedNodes = new Set();
    this.affectedEdges = new Set();
    this.stockoutCount = 0;
  }

  logEvent(step, type, targetType, targetId, message) {
    this.events.push({ step, type, targetType, targetId, message });
  }

  getStock(nodeId, productId) {
    if (!this.inventory.has(nodeId)) return 0;
    return this.inventory.get(nodeId).get(productId) || 0;
  }

  setStock(nodeId, productId, qty) {
    if (!this.inventory.has(nodeId)) {
      this.inventory.set(nodeId, new Map());
    }
    this.inventory.get(nodeId).set(productId, Math.max(0, qty));
  }

  step(currentStep) {
    const blockedNodes = new Set();
    const blockedEdges = new Set();
    const activeDisruptions = [];

    // 1. Check disruptions
    for (const d of this.disruptions) {
      const endStep = d.startStep + d.duration;

      if (currentStep === d.startStep) {
        this.logEvent(
          currentStep,
          EventType.DISRUPTION_ACTIVATED,
          d.type === DisruptionType.EDGE_BLOCKAGE ? 'EDGE' : 'NODE',
          d.targetId,
          `Disruption started on ${d.targetId}`
        );
      }

      if (currentStep === endStep) {
        this.logEvent(
          currentStep,
          EventType.DISRUPTION_RESOLVED,
          d.type === DisruptionType.EDGE_BLOCKAGE ? 'EDGE' : 'NODE',
          d.targetId,
          `Disruption ended on ${d.targetId}`
        );
      }

      if (currentStep >= d.startStep && currentStep < endStep) {
        activeDisruptions.push(d.id);
        if (d.type === DisruptionType.EDGE_BLOCKAGE) {
          blockedEdges.add(d.targetId);
          this.affectedEdges.add(d.targetId);
        } else {
          blockedNodes.add(d.targetId);
          this.affectedNodes.add(d.targetId);
        }
      }
    }

    // 2. Deliver in-transit shipments
    for (const s of this.shipments) {
      if (s.status === 'IN_TRANSIT' && s.arrivalStep <= currentStep) {
        if (!blockedNodes.has(s.toNodeId)) {
          const currentStock = this.getStock(s.toNodeId, s.productId);
          this.setStock(s.toNodeId, s.productId, currentStock + s.quantity);
          s.status = 'DELIVERED';

          this.logEvent(
            currentStep,
            EventType.SHIPMENT_ARRIVED,
            'SHIPMENT',
            s.id,
            `Shipment ${s.id} arrived at ${s.toNodeId} (+${s.quantity} units)`
          );
        }
      }
    }

    // 3. Fulfill customer orders
    for (const order of this.orders) {
      if (order.remainingQuantity > 0 && order.dueStep <= currentStep) {
        const available = this.getStock(order.nodeId, order.productId);

        if (available >= order.remainingQuantity) {
          this.setStock(order.nodeId, order.productId, available - order.remainingQuantity);
          order.fulfilledQuantity += order.remainingQuantity;
          order.remainingQuantity = 0;
          order.status = currentStep === order.dueStep ? 'FULFILLED' : 'DELAYED';

          this.logEvent(
            currentStep,
            EventType.ORDER_FULFILLED,
            'ORDER',
            order.orderId,
            `Order ${order.orderId} fulfilled at ${order.nodeId}`
          );
        } else if (available > 0) {
          this.setStock(order.nodeId, order.productId, 0);
          order.fulfilledQuantity += available;
          order.remainingQuantity -= available;
          order.status = 'DELAYED';
          this.stockoutCount++;
          this.affectedNodes.add(order.nodeId);

          this.logEvent(
            currentStep,
            EventType.STOCKOUT_OCCURRED,
            'NODE',
            order.nodeId,
            `Partial stockout at ${order.nodeId} for order ${order.orderId}`
          );
        } else {
          order.status = 'DELAYED';
          this.stockoutCount++;
          this.affectedNodes.add(order.nodeId);

          this.logEvent(
            currentStep,
            EventType.STOCKOUT_OCCURRED,
            'NODE',
            order.nodeId,
            `Stockout at ${order.nodeId} for order ${order.orderId}`
          );
        }
      }
    }

    // 4. Replenishment: reorder from upstream nodes when stock is low
    for (const node of this.graph.getAllNodes()) {
      if (node.type === NodeType.SUPPLIER) continue;
      if (blockedNodes.has(node.id)) continue;

      const products = this.inventory.get(node.id);
      if (!products) continue;

      for (const [productId, currentStock] of products.entries()) {
        const inTransitStock = this.shipments
          .filter(
            (s) => s.toNodeId === node.id && s.productId === productId && s.status === 'IN_TRANSIT'
          )
          .reduce((sum, s) => sum + s.quantity, 0);

        if (currentStock + inTransitStock < this.replenishThreshold) {
          const upstreamNodes = Array.from(
            this.graph.getUpstreamReachableNodes(node.id, { blockedNodes, blockedEdges })
          ).filter((id) => id !== node.id);

          let chosenSupplier = null;
          let bestPath = null;

          for (const upId of upstreamNodes) {
            const stock = this.getStock(upId, productId);
            if (stock > 0 && !blockedNodes.has(upId)) {
              const path = this.graph.findShortestPath(upId, node.id, {
                blockedNodes,
                blockedEdges,
              });
              if (path && (!bestPath || path.totalWeight < bestPath.totalWeight)) {
                bestPath = path;
                chosenSupplier = upId;
              }
            }
          }

          if (chosenSupplier && bestPath && bestPath.edges.length > 0) {
            const supplierStock = this.getStock(chosenSupplier, productId);
            const sendQty = Math.min(this.batchSize, supplierStock);

            if (sendQty > 0) {
              this.setStock(chosenSupplier, productId, supplierStock - sendQty);
              const edge = bestPath.edges[0];
              const travelTime = edge.travelTime || 1;

              this.shipmentIdCounter++;
              const shipment = {
                id: 'ship_' + this.shipmentIdCounter,
                fromNodeId: chosenSupplier,
                toNodeId: edge.toNodeId,
                productId,
                quantity: sendQty,
                dispatchStep: currentStep,
                arrivalStep: currentStep + travelTime,
                status: 'IN_TRANSIT',
              };

              this.shipments.push(shipment);

              this.logEvent(
                currentStep,
                EventType.SHIPMENT_DISPATCHED,
                'SHIPMENT',
                shipment.id,
                `Dispatched ${sendQty} units from ${chosenSupplier} to ${edge.toNodeId}`
              );
            }
          }
        }
      }
    }

    // 5. Save step snapshot
    const snapshot = {};
    for (const [nodeId, prodMap] of this.inventory.entries()) {
      snapshot[nodeId] = {};
      for (const [prodId, qty] of prodMap.entries()) {
        snapshot[nodeId][prodId] = qty;
      }
    }

    this.timeline.push({
      step: currentStep,
      inventory: snapshot,
      activeDisruptions: [...activeDisruptions],
    });
  }

  run() {
    for (let step = 0; step < this.totalSteps; step++) {
      this.step(step);
    }

    const totalDemand = this.orders.reduce((sum, o) => sum + o.demandedQuantity, 0);
    const fulfilledQuantity = this.orders.reduce((sum, o) => sum + o.fulfilledQuantity, 0);
    const remainingQuantity = this.orders.reduce((sum, o) => sum + o.remainingQuantity, 0);

    return {
      runId: this.runId,
      status: 'COMPLETED',
      totalSteps: this.totalSteps,
      metrics: {
        totalOrders: this.orders.length,
        totalDemand,
        fulfilledQuantity,
        remainingQuantity,
        stockoutEvents: this.stockoutCount,
        affectedNodes: Array.from(this.affectedNodes),
        affectedEdges: Array.from(this.affectedEdges),
      },
      events: this.events,
      timeline: this.timeline,
    };
  }
}

module.exports = SimulationEngine;
