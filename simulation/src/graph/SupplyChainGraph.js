class SupplyChainGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.outgoing = new Map();
    this.incoming = new Map();
  }

  addNode(node) {
    if (!node || !node.id) return this;
    this.nodes.set(node.id, node);
    if (!this.outgoing.has(node.id)) this.outgoing.set(node.id, []);
    if (!this.incoming.has(node.id)) this.incoming.set(node.id, []);
    return this;
  }

  addEdge(edge) {
    if (!edge || !edge.id || !edge.fromNodeId || !edge.toNodeId) return this;

    const route = {
      ...edge,
      travelTime: edge.travelTime || 1,
      distance: edge.distance || 0,
    };

    this.edges.set(route.id, route);

    if (!this.outgoing.has(route.fromNodeId)) this.outgoing.set(route.fromNodeId, []);
    this.outgoing.get(route.fromNodeId).push(route);

    if (!this.incoming.has(route.toNodeId)) this.incoming.set(route.toNodeId, []);
    this.incoming.get(route.toNodeId).push(route);

    return this;
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getEdge(id) {
    return this.edges.get(id);
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getAllEdges() {
    return Array.from(this.edges.values());
  }

  getOutgoingEdges(nodeId) {
    return this.outgoing.get(nodeId) || [];
  }

  getIncomingEdges(nodeId) {
    return this.incoming.get(nodeId) || [];
  }

  // Simple check to make sure edges connect existing nodes
  validate() {
    const errors = [];
    for (const [id, edge] of this.edges.entries()) {
      if (!this.nodes.has(edge.fromNodeId)) {
        errors.push(`Edge ${id} has missing fromNode ${edge.fromNodeId}`);
      }
      if (!this.nodes.has(edge.toNodeId)) {
        errors.push(`Edge ${id} has missing toNode ${edge.toNodeId}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  // Breadth-first search
  bfs(startId) {
    if (!this.nodes.has(startId)) return [];
    const visited = new Set([startId]);
    const queue = [startId];
    const result = [];

    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      for (const edge of this.getOutgoingEdges(current)) {
        if (!visited.has(edge.toNodeId) && this.nodes.has(edge.toNodeId)) {
          visited.add(edge.toNodeId);
          queue.push(edge.toNodeId);
        }
      }
    }

    return result;
  }

  // Depth-first search
  dfs(startId) {
    if (!this.nodes.has(startId)) return [];
    const visited = new Set();
    const result = [];

    const walk = (nodeId) => {
      visited.add(nodeId);
      result.push(nodeId);

      for (const edge of this.getOutgoingEdges(nodeId)) {
        if (!visited.has(edge.toNodeId) && this.nodes.has(edge.toNodeId)) {
          walk(edge.toNodeId);
        }
      }
    };

    walk(startId);
    return result;
  }

  // Check if fromId can reach toId, skipping blocked nodes or edges
  isReachable(fromId, toId, options = {}) {
    if (fromId === toId) return true;
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return false;

    const blockedNodes = new Set(options.blockedNodes || []);
    const blockedEdges = new Set(options.blockedEdges || []);

    if (blockedNodes.has(fromId) || blockedNodes.has(toId)) return false;

    const visited = new Set([fromId]);
    const queue = [fromId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === toId) return true;

      for (const edge of this.getOutgoingEdges(current)) {
        if (blockedEdges.has(edge.id)) continue;
        const nextNode = edge.toNodeId;
        if (blockedNodes.has(nextNode)) continue;

        if (!visited.has(nextNode)) {
          visited.add(nextNode);
          if (nextNode === toId) return true;
          queue.push(nextNode);
        }
      }
    }

    return false;
  }

  // Get all downstream nodes that can be reached
  getDownstreamReachableNodes(startId, options = {}) {
    const reachable = new Set();
    if (!this.nodes.has(startId)) return reachable;

    const blockedNodes = new Set(options.blockedNodes || []);
    const blockedEdges = new Set(options.blockedEdges || []);
    if (blockedNodes.has(startId)) return reachable;

    const queue = [startId];
    reachable.add(startId);

    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of this.getOutgoingEdges(current)) {
        if (blockedEdges.has(edge.id)) continue;
        const next = edge.toNodeId;
        if (blockedNodes.has(next)) continue;

        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }

    return reachable;
  }

  // Get all upstream nodes that can supply this node
  getUpstreamReachableNodes(targetId, options = {}) {
    const reachable = new Set();
    if (!this.nodes.has(targetId)) return reachable;

    const blockedNodes = new Set(options.blockedNodes || []);
    const blockedEdges = new Set(options.blockedEdges || []);
    if (blockedNodes.has(targetId)) return reachable;

    const queue = [targetId];
    reachable.add(targetId);

    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of this.getIncomingEdges(current)) {
        if (blockedEdges.has(edge.id)) continue;
        const prev = edge.fromNodeId;
        if (blockedNodes.has(prev)) continue;

        if (!reachable.has(prev)) {
          reachable.add(prev);
          queue.push(prev);
        }
      }
    }

    return reachable;
  }

  // Find shortest route by travel time
  findShortestPath(fromId, toId, options = {}) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;

    const blockedNodes = new Set(options.blockedNodes || []);
    const blockedEdges = new Set(options.blockedEdges || []);

    if (blockedNodes.has(fromId) || blockedNodes.has(toId)) return null;
    if (fromId === toId) return { path: [fromId], edges: [], totalWeight: 0 };

    const dist = new Map();
    const prev = new Map();
    const unvisited = new Set(this.nodes.keys());

    for (const id of this.nodes.keys()) {
      dist.set(id, Infinity);
    }
    dist.set(fromId, 0);

    while (unvisited.size > 0) {
      let current = null;
      let minDistance = Infinity;

      for (const id of unvisited) {
        if (dist.get(id) < minDistance) {
          minDistance = dist.get(id);
          current = id;
        }
      }

      if (!current || minDistance === Infinity) break;
      if (current === toId) break;

      unvisited.delete(current);

      for (const edge of this.getOutgoingEdges(current)) {
        if (blockedEdges.has(edge.id)) continue;
        const next = edge.toNodeId;
        if (!unvisited.has(next) || blockedNodes.has(next)) continue;

        const weight = edge.travelTime || 1;
        const alt = dist.get(current) + weight;

        if (alt < dist.get(next)) {
          dist.set(next, alt);
          prev.set(next, { prevId: current, edge });
        }
      }
    }

    if (dist.get(toId) === Infinity) return null;

    const path = [];
    const pathEdges = [];
    let curr = toId;

    while (curr !== fromId) {
      path.unshift(curr);
      const step = prev.get(curr);
      if (!step) return null;
      pathEdges.unshift(step.edge);
      curr = step.prevId;
    }
    path.unshift(fromId);

    return {
      path,
      edges: pathEdges,
      totalWeight: dist.get(toId),
    };
  }

  toJSON() {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    };
  }

  static fromJSON(data) {
    const graph = new SupplyChainGraph();
    if (!data) return graph;

    if (Array.isArray(data.nodes)) {
      for (const n of data.nodes) graph.addNode(n);
    }
    if (Array.isArray(data.edges)) {
      for (const e of data.edges) graph.addEdge(e);
    }

    return graph;
  }
}

module.exports = SupplyChainGraph;
