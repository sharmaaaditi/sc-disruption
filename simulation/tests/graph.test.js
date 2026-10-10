/**
 * @file graph.test.js
 * Unit tests for SupplyChainGraph creation, adjacency representation,
 * traversal, reachability, and shortest-path routing.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const SupplyChainGraph = require('../src/graph/SupplyChainGraph');

describe('SupplyChainGraph Foundations (P1 Day 2)', () => {
  function createSampleGraph() {
    const graph = new SupplyChainGraph();

    // Nodes
    graph.addNode({ id: 'sup-1', name: 'Supplier A', type: 'SUPPLIER' });
    graph.addNode({ id: 'sup-2', name: 'Supplier B', type: 'SUPPLIER' });
    graph.addNode({ id: 'wh-1', name: 'Warehouse 1', type: 'WAREHOUSE' });
    graph.addNode({ id: 'dc-1', name: 'Distribution Center 1', type: 'DISTRIBUTION_CENTER' });
    graph.addNode({ id: 'ret-1', name: 'Retailer 1', type: 'RETAILER' });
    graph.addNode({ id: 'ret-2', name: 'Retailer 2', type: 'RETAILER' });

    // Edges
    graph.addEdge({ id: 'e1', fromNodeId: 'sup-1', toNodeId: 'wh-1', travelTime: 2, distance: 100 });
    graph.addEdge({ id: 'e2', fromNodeId: 'sup-2', toNodeId: 'wh-1', travelTime: 4, distance: 200 });
    graph.addEdge({ id: 'e3', fromNodeId: 'wh-1', toNodeId: 'dc-1', travelTime: 1, distance: 50 });
    graph.addEdge({ id: 'e4', fromNodeId: 'dc-1', toNodeId: 'ret-1', travelTime: 1, distance: 30 });
    graph.addEdge({ id: 'e5', fromNodeId: 'dc-1', toNodeId: 'ret-2', travelTime: 2, distance: 60 });
    graph.addEdge({ id: 'e6', fromNodeId: 'wh-1', toNodeId: 'ret-1', travelTime: 3, distance: 120 }); // bypass route

    return graph;
  }

  it('should create graph and maintain adjacency representation', () => {
    const graph = createSampleGraph();

    assert.equal(graph.getAllNodes().length, 6);
    assert.equal(graph.getAllEdges().length, 6);

    const outgoingFromWh = graph.getOutgoingEdges('wh-1');
    assert.equal(outgoingFromWh.length, 2);
    assert.ok(outgoingFromWh.some((e) => e.toNodeId === 'dc-1'));
    assert.ok(outgoingFromWh.some((e) => e.toNodeId === 'ret-1'));

    const incomingToWh = graph.getIncomingEdges('wh-1');
    assert.equal(incomingToWh.length, 2);
    assert.ok(incomingToWh.some((e) => e.fromNodeId === 'sup-1'));
    assert.ok(incomingToWh.some((e) => e.fromNodeId === 'sup-2'));
  });

  it('should validate graph integrity correctly', () => {
    const graph = createSampleGraph();
    const validation = graph.validate();
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);

    // Add an edge with non-existent node
    graph.addEdge({ id: 'bad-edge', fromNodeId: 'wh-1', toNodeId: 'ghost-node', travelTime: 1 });
    const invalidCheck = graph.validate();
    assert.equal(invalidCheck.valid, false);
    assert.ok(invalidCheck.errors[0].includes('ghost-node'));
  });

  it('should execute BFS and DFS traversals downstream', () => {
    const graph = createSampleGraph();

    const bfsOrder = graph.bfs('sup-1');
    assert.equal(bfsOrder[0], 'sup-1');
    assert.ok(bfsOrder.includes('wh-1'));
    assert.ok(bfsOrder.includes('dc-1'));
    assert.ok(bfsOrder.includes('ret-1'));

    const dfsOrder = graph.dfs('sup-1');
    assert.equal(dfsOrder[0], 'sup-1');
    assert.equal(dfsOrder.length, 5); // sup-1, wh-1, dc-1, ret-1, ret-2 (excludes sup-2)
  });

  it('should analyze reachability and support blocked nodes and edges', () => {
    const graph = createSampleGraph();

    // Normal reachability
    assert.equal(graph.isReachable('sup-1', 'ret-1'), true);
    assert.equal(graph.isReachable('sup-1', 'ret-2'), true);
    assert.equal(graph.isReachable('ret-1', 'sup-1'), false); // directed

    // Reachable downstream
    const downstream = graph.getDownstreamReachableNodes('wh-1');
    assert.ok(downstream.has('dc-1'));
    assert.ok(downstream.has('ret-1'));
    assert.ok(downstream.has('ret-2'));
    assert.ok(!downstream.has('sup-1'));

    // Reachable upstream
    const upstream = graph.getUpstreamReachableNodes('ret-1');
    assert.ok(upstream.has('dc-1'));
    assert.ok(upstream.has('wh-1'));
    assert.ok(upstream.has('sup-1'));
    assert.ok(upstream.has('sup-2'));

    // Block dc-1 (node failure): should still reach ret-1 via bypass route e6 (wh-1 -> ret-1)
    assert.equal(graph.isReachable('sup-1', 'ret-1', { blockedNodes: ['dc-1'] }), true);
    // But cannot reach ret-2 since ret-2 only connects through dc-1
    assert.equal(graph.isReachable('sup-1', 'ret-2', { blockedNodes: ['dc-1'] }), false);

    // Block bypass edge e6 as well: now ret-1 is also unreachable when dc-1 is blocked
    assert.equal(
      graph.isReachable('sup-1', 'ret-1', { blockedNodes: ['dc-1'], blockedEdges: ['e6'] }),
      false
    );
  });

  it('should compute shortest paths with Dijkstra and re-route around disruptions', () => {
    const graph = createSampleGraph();

    // Shortest path by travelTime:
    // sup-1 -> wh-1 (2) -> dc-1 (1) -> ret-1 (1) = total 4
    // Bypass: sup-1 -> wh-1 (2) -> ret-1 (3) = total 5
    const path1 = graph.findShortestPath('sup-1', 'ret-1');
    assert.ok(path1);
    assert.equal(path1.totalWeight, 4);
    assert.deepEqual(path1.path, ['sup-1', 'wh-1', 'dc-1', 'ret-1']);

    // Block edge e3 (wh-1 -> dc-1): should automatically find bypass route e6
    const reroutedPath = graph.findShortestPath('sup-1', 'ret-1', { blockedEdges: ['e3'] });
    assert.ok(reroutedPath);
    assert.equal(reroutedPath.totalWeight, 5);
    assert.deepEqual(reroutedPath.path, ['sup-1', 'wh-1', 'ret-1']);

    // Block wh-1 entirely: no path exists from sup-1 to ret-1
    const blockedPath = graph.findShortestPath('sup-1', 'ret-1', { blockedNodes: ['wh-1'] });
    assert.equal(blockedPath, null);
  });

  it('should support serialization to and from JSON', () => {
    const original = createSampleGraph();
    const json = original.toJSON();

    const restored = SupplyChainGraph.fromJSON(json);
    assert.equal(restored.getAllNodes().length, original.getAllNodes().length);
    assert.equal(restored.getAllEdges().length, original.getAllEdges().length);
    assert.equal(restored.isReachable('sup-1', 'ret-1'), true);
  });
});
