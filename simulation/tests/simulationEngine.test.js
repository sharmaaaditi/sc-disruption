const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { runSimulation } = require('../src/index');
const sampleData = require('../data/sampleDataset.json');

describe('SimulationEngine tests', () => {
  function handCalculatedInput(overrides = {}) {
    return {
      network: {
        nodes: [
          { id: 'sup-1', type: 'SUPPLIER' },
          { id: 'ret-1', type: 'RETAILER' },
        ],
        edges: [
          { id: 'edge-1', fromNodeId: 'sup-1', toNodeId: 'ret-1', travelTime: 1 },
        ],
      },
      inventory: [
        { nodeId: 'sup-1', productId: 'prod-1', quantity: 100 },
        { nodeId: 'ret-1', productId: 'prod-1', quantity: 10 },
      ],
      orders: [
        { orderId: 'order-1', nodeId: 'ret-1', productId: 'prod-1', quantity: 15, dueStep: 0 },
      ],
      disruptions: [],
      config: {
        totalSteps: 1,
        replenishmentThreshold: 1,
        reorderBatchSize: 10,
      },
      ...overrides,
    };
  }

  it('runs basic simulation without errors', () => {
    const input = JSON.parse(JSON.stringify(sampleData));
    input.config.totalSteps = 5;

    const res = runSimulation(input);
    assert.equal(res.status, 'COMPLETED');
    assert.equal(res.totalSteps, 5);
    assert.ok(res.metrics.totalOrders > 0);
  });

  it('handles supplier failure disruption', () => {
    const input = JSON.parse(JSON.stringify(sampleData));
    input.disruptions = [
      {
        id: 'dis-1',
        type: 'SUPPLIER_FAILURE',
        targetId: 'sup-1',
        startStep: 1,
        duration: 3,
      },
    ];

    const res = runSimulation(input);
    assert.equal(res.status, 'COMPLETED');
    assert.ok(res.metrics.affectedNodes.includes('sup-1'));
    assert.ok(res.events.some((e) => e.type === 'DISRUPTION_ACTIVATED'));
    assert.ok(res.events.some((e) => e.type === 'DISRUPTION_RESOLVED'));
  });

  it('matches a hand-calculated partial stockout', () => {
    const res = runSimulation(handCalculatedInput());
    const order = res.finalState.orders[0];
    const retailerStock = res.finalState.inventory.find(
      (item) => item.nodeId === 'ret-1' && item.productId === 'prod-1'
    );

    assert.equal(order.fulfilledQuantity, 10);
    assert.equal(order.remainingQuantity, 5);
    assert.equal(order.status, 'DELAYED');
    assert.equal(retailerStock.quantity, 0);
    assert.equal(res.metrics.totalDemand, 15);
    assert.equal(res.metrics.fulfilledQuantity, 10);
    assert.equal(res.metrics.remainingQuantity, 5);
    assert.equal(res.metrics.delayedOrders, 1);
    assert.equal(res.metrics.stockouts, 1);
  });

  it('queues orders at an offline retailer until it reopens', () => {
    const input = handCalculatedInput({
      orders: [{ orderId: 'order-1', nodeId: 'ret-1', productId: 'prod-1', quantity: 5, dueStep: 0 }],
      disruptions: [{ id: 'outage', type: 'NODE_OUTAGE', targetId: 'ret-1', startStep: 0, duration: 2 }],
      config: { totalSteps: 2 },
    });

    const offline = runSimulation(input);
    assert.equal(offline.metrics.fulfilledQuantity, 0);
    assert.equal(offline.metrics.remainingQuantity, 5);
    assert.equal(offline.metrics.delayedOrders, 1);
    assert.equal(offline.metrics.stockouts, 0);
    assert.equal(offline.timeline[1].inventory['ret-1']['prod-1'], 10);
    assert.deepEqual(offline.events.filter((event) => event.targetId === 'order-1').map(({type}) => type), ['ORDER_DELAYED']);

    const recovered = runSimulation({ ...input, config: { totalSteps: 3 } });
    assert.equal(recovered.metrics.fulfilledQuantity, 5);
    assert.equal(recovered.metrics.remainingQuantity, 0);
    assert.equal(recovered.metrics.delayedOrders, 1);
    assert.equal(recovered.events.find(({ type }) => type === 'ORDER_FULFILLED').step, 2);
  });

  it('does not count the same unresolved stockout as multiple stockouts', () => {
    const input = handCalculatedInput({
      inventory: [
        { nodeId: 'sup-1', productId: 'prod-1', quantity: 0 },
        { nodeId: 'ret-1', productId: 'prod-1', quantity: 0 },
      ],
      config: { totalSteps: 3, replenishmentThreshold: 1, reorderBatchSize: 10 },
    });

    const res = runSimulation(input);

    assert.equal(res.metrics.stockoutEvents, 3);
    assert.equal(res.metrics.stockouts, 1);
    assert.equal(res.metrics.delayedOrders, 1);
  });

  it('reports recovery only when it occurs inside the simulation window', () => {
    const recovered = runSimulation(
      handCalculatedInput({
        disruptions: [
          { id: 'dis-1', type: 'SUPPLIER_FAILURE', targetId: 'sup-1', startStep: 0, duration: 2 },
        ],
        config: { totalSteps: 3, replenishmentThreshold: 1, reorderBatchSize: 10 },
      })
    );
    const unresolved = runSimulation(
      handCalculatedInput({
        disruptions: [
          { id: 'dis-2', type: 'SUPPLIER_FAILURE', targetId: 'sup-1', startStep: 0, duration: 3 },
        ],
        config: { totalSteps: 3, replenishmentThreshold: 1, reorderBatchSize: 10 },
      })
    );

    assert.equal(recovered.metrics.recoveryTime, 2);
    assert.equal(unresolved.metrics.recoveryTime, 0);
  });
});
