/**
 * @file simulationEngine.test.js
 * Unit tests for SimulationEngine discrete time-step execution,
 * supplier failure/recovery, supply propagation, and metric calculations.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const SimulationEngine = require('../src/engine/SimulationEngine');
const { runSimulation } = require('../src/index');
const sampleData = require('../data/sampleDataset.json');

describe('SimulationEngine Execution (P1 Day 3)', () => {
  it('should initialize and execute baseline simulation without disruption', () => {
    // Clone baseline input without disruptions
    const input = JSON.parse(JSON.stringify(sampleData));
    input.disruptions = [];
    input.config.totalSteps = 6;

    const result = runSimulation(input);

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.totalSteps, 6);
    assert.ok(result.metrics);
    assert.ok(result.timeline.length === 6);
    assert.equal(result.metrics.ordersTotal, 3);
  });

  it('should activate and resolve disruption events and record affected nodes', () => {
    const input = JSON.parse(JSON.stringify(sampleData));
    // Disruption: Supplier sup-1 fails at step 2 for 3 steps (resolves at step 5)
    input.disruptions = [
      {
        id: 'dis-sup-1',
        type: 'SUPPLIER_FAILURE',
        targetId: 'sup-1',
        startStep: 2,
        duration: 3,
        description: 'Primary supplier outage',
      },
    ];
    input.config.totalSteps = 7;

    const engine = new SimulationEngine(input);
    const result = engine.run();

    assert.equal(result.status, 'COMPLETED');

    // Verify activation event
    const actEvent = result.events.find(
      (e) => e.type === 'DISRUPTION_ACTIVATED' && e.targetId === 'sup-1'
    );
    assert.ok(actEvent, 'Should log DISRUPTION_ACTIVATED event');
    assert.equal(actEvent.step, 2);

    // Verify resolution event
    const resEvent = result.events.find(
      (e) => e.type === 'DISRUPTION_RESOLVED' && e.targetId === 'sup-1'
    );
    assert.ok(resEvent, 'Should log DISRUPTION_RESOLVED event');
    assert.equal(resEvent.step, 5);

    // Verify affectedNodes includes sup-1
    assert.ok(result.metrics.affectedNodes.includes('sup-1'));
  });

  it('should detect stockout downstream when supplier fails and inventory is depleted', () => {
    const testInput = {
      network: {
        nodes: [
          { id: 'sup-x', name: 'Supplier X', type: 'SUPPLIER' },
          { id: 'wh-x', name: 'Warehouse X', type: 'WAREHOUSE' },
          { id: 'ret-x', name: 'Retailer X', type: 'RETAILER' },
        ],
        edges: [
          { id: 'e1', fromNodeId: 'sup-x', toNodeId: 'wh-x', travelTime: 1 },
          { id: 'e2', fromNodeId: 'wh-x', toNodeId: 'ret-x', travelTime: 1 },
        ],
      },
      inventory: [
        { nodeId: 'sup-x', productId: 'p1', quantity: 500 },
        { nodeId: 'wh-x', productId: 'p1', quantity: 20 },
        { nodeId: 'ret-x', productId: 'p1', quantity: 10 },
      ],
      orders: [
        { orderId: 'ord-1', nodeId: 'ret-x', productId: 'p1', quantity: 10, dueStep: 0 },
        { orderId: 'ord-2', nodeId: 'ret-x', productId: 'p1', quantity: 50, dueStep: 2 },
      ],
      disruptions: [
        {
          id: 'dis-fail',
          type: 'SUPPLIER_FAILURE',
          targetId: 'sup-x',
          startStep: 0,
          duration: 5,
        },
      ],
      config: {
        totalSteps: 6,
        replenishmentThreshold: 20,
        reorderBatchSize: 30,
        unitDelayPenalty: 10,
        unitStockoutPenalty: 50,
      },
    };

    const engine = new SimulationEngine(testInput);
    const result = engine.run();

    // Order 1 at step 0 is fulfilled (inventory had 10).
    // Order 2 at step 2 demands 50. Inventory at ret-x is 0 and wh-x only had 20, and sup-x is failed.
    // So stockout must occur.
    const stockoutEvents = result.events.filter((e) => e.type === 'STOCKOUT_OCCURRED');
    assert.ok(stockoutEvents.length > 0, 'Stockout event should be detected');
    assert.ok(result.metrics.stockoutEventsCount > 0);
    assert.ok(result.metrics.totalShortageQuantity > 0);
    assert.ok(result.metrics.financialImpact.stockoutPenalty > 0);
    assert.ok(result.metrics.affectedNodes.includes('ret-x'));
  });

  it('should propagate supply through multi-echelon lead times when operational', () => {
    const supplyInput = {
      network: {
        nodes: [
          { id: 's1', name: 'Supplier', type: 'SUPPLIER' },
          { id: 'w1', name: 'Warehouse', type: 'WAREHOUSE' },
        ],
        edges: [
          { id: 'edge-s-w', fromNodeId: 's1', toNodeId: 'w1', travelTime: 2 },
        ],
      },
      inventory: [
        { nodeId: 's1', productId: 'pA', quantity: 200 },
        { nodeId: 'w1', productId: 'pA', quantity: 5 }, // below threshold (20)
      ],
      orders: [],
      disruptions: [],
      config: {
        totalSteps: 4,
        replenishmentThreshold: 20,
        reorderBatchSize: 50,
      },
    };

    const engine = new SimulationEngine(supplyInput);
    const result = engine.run();

    // At step 0, w1 has 5 < 20, orders 50 from s1.
    // Dispatched at step 0, travelTime = 2, so arrival is step 2.
    const dispatched = result.events.find((e) => e.type === 'SHIPMENT_DISPATCHED');
    assert.ok(dispatched);
    assert.equal(dispatched.step, 0);

    const arrived = result.events.find((e) => e.type === 'SHIPMENT_ARRIVED');
    assert.ok(arrived);
    assert.equal(arrived.step, 2);

    // Check inventory at step 2 or later
    const endInventoryW1 = result.timeline[3].inventories['w1']['pA'];
    assert.equal(endInventoryW1, 55); // 5 initial + 50 arrived
  });
});
