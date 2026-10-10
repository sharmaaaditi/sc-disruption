const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { runSimulation } = require('../src/index');
const sampleData = require('../data/sampleDataset.json');

describe('SimulationEngine tests', () => {
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
});
