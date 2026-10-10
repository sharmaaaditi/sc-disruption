const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const SupplyChainGraph = require('../src/graph/SupplyChainGraph');

describe('SupplyChainGraph tests', () => {
  function getSample() {
    const g = new SupplyChainGraph();
    g.addNode({ id: 'sup-1', name: 'Supplier', type: 'SUPPLIER' });
    g.addNode({ id: 'wh-1', name: 'Warehouse', type: 'WAREHOUSE' });
    g.addNode({ id: 'ret-1', name: 'Retailer', type: 'RETAILER' });

    g.addEdge({ id: 'e1', fromNodeId: 'sup-1', toNodeId: 'wh-1', travelTime: 2 });
    g.addEdge({ id: 'e2', fromNodeId: 'wh-1', toNodeId: 'ret-1', travelTime: 1 });
    return g;
  }

  it('adds nodes and edges correctly', () => {
    const g = getSample();
    assert.equal(g.getAllNodes().length, 3);
    assert.equal(g.getAllEdges().length, 2);
  });

  it('runs BFS traversal', () => {
    const g = getSample();
    const order = g.bfs('sup-1');
    assert.deepEqual(order, ['sup-1', 'wh-1', 'ret-1']);
  });

  it('checks reachability with blocked nodes', () => {
    const g = getSample();
    assert.equal(g.isReachable('sup-1', 'ret-1'), true);
    assert.equal(g.isReachable('sup-1', 'ret-1', { blockedNodes: ['wh-1'] }), false);
  });

  it('finds shortest path', () => {
    const g = getSample();
    const pathInfo = g.findShortestPath('sup-1', 'ret-1');
    assert.ok(pathInfo);
    assert.deepEqual(pathInfo.path, ['sup-1', 'wh-1', 'ret-1']);
    assert.equal(pathInfo.totalWeight, 3);
  });
});
