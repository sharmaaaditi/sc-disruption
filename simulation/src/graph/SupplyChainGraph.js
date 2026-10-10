/**
 * @file SupplyChainGraph.js
 * Directed graph data structure modeling the supply chain network topology,
 * adjacency lists, traversal algorithms (BFS/DFS), reachability checks,
 * and shortest-path routing with dynamic failure avoidance.
 */

class SupplyChainGraph {
  constructor() {
    /** @type {Map<string, Object>} */
    this.nodes = new Map();

    /** @type {Map<string, Object>} */
    this.edges = new Map();

    /** @type {Map<string, Object[]>} outgoing edges per nodeId */
    this.outgoing = new Map();

    /** @type {Map<string, Object[]>} incoming edges per nodeId */
    this.incoming = new Map();
  }

  /**
   * Add a node to the network.
   * @param {Object} node
   * @param {string} node.id
   * @param {string} node.name
   * @param {string} node.type
   */
  addNode(node) {
    if (!node || !node.id) {
      throw new Error('Node must have a valid id');
    }
    this.nodes.set(node.id, { ...node });
    if (!this.outgoing.has(node.id)) {
      this.outgoing.set(node.id, []);
    }
    if (!this.incoming.has(node.id)) {
      this.incoming.set(node.id, []);
    }
    return this;
  }

  /**
   * Add a directed edge between two nodes.
   * @param {Object} edge
   * @param {string} edge.id
   * @param {string} edge.fromNodeId
   * @param {string} edge.toNodeId
   * @param {number} [edge.travelTime=1]
   * @param {number} [edge.distance=0]
   */
  addEdge(edge) {
    if (!edge || !edge.id || !edge.fromNodeId || !edge.toNodeId) {
      throw new Error('Edge must contain id, fromNodeId, and toNodeId');
    }

    const normalizedEdge = {
      ...edge,
      travelTime: typeof edge.travelTime === 'number' && edge.travelTime >= 0 ? edge.travelTime : 1,
      distance: typeof edge.distance === 'number' ? edge.distance : 0,
    };

    this.edges.set(normalizedEdge.id, normalizedEdge);

    if (!this.outgoing.has(normalizedEdge.fromNodeId)) {
      this.outgoing.set(normalizedEdge.fromNodeId, []);
    }
    this.outgoing.get(normalizedEdge.fromNodeId).push(normalizedEdge);

    if (!this.incoming.has(normalizedEdge.toNodeId)) {
      this.incoming.set(normalizedEdge.toNodeId, []);
    }
    this.incoming.get(normalizedEdge.toNodeId).push(normalizedEdge);

    return this;
  }

  hasNode(nodeId) {
    return this.nodes.has(nodeId);
  }

  hasEdge(edgeId) {
    return this.edges.has(edgeId);
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  getEdge(edgeId) {
    return this.edges.get(edgeId);
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

  getDownstreamNeighbors(nodeId) {
    const outgoing = this.getOutgoingEdges(nodeId);
    return outgoing.map((e) => this.getNode(e.toNodeId)).filter(Boolean);
  }

  getUpstreamNeighbors(nodeId) {
    const incoming = this.getIncomingEdges(nodeId);
    return incoming.map((e) => this.getNode(e.fromNodeId)).filter(Boolean);
  }

  /**
   * Validates network structural integrity.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];
    for (const [edgeId, edge] of this.edges.entries()) {
      if (!this.nodes.has(edge.fromNodeId)) {
        errors.push(`Edge "${edgeId}" references non-existent fromNodeId "${edge.fromNodeId}"`);
      }
      if (!this.nodes.has(edge.toNodeId)) {
        errors.push(`Edge "${edgeId}" references non-existent toNodeId "${edge.toNodeId}"`);
      }
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Breadth-First Search traversal downstream from a start node.
   * @param {string} startNodeId
   * @param {Function} [visitorFn] callback (node, depth)
   * @returns {string[]} visited node IDs in order
   */
  bfs(startNodeId, visitorFn) {
    if (!this.nodes.has(startNodeId)) return [];

    const visited = new Set();
    const queue = [{ id: startNodeId, depth: 0 }];
    const order = [];

    visited.add(startNodeId);

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      const node = this.getNode(id);
      order.push(id);

      if (visitorFn) {
        visitorFn(node, depth);
      }

      for (const edge of this.getOutgoingEdges(id)) {
        if (!visited.has(edge.toNodeId) && this.nodes.has(edge.toNodeId)) {
          visited.add(edge.toNodeId);
          queue.push({ id: edge.toNodeId, depth: depth + 1 });
        }
      }
    }

    return order;
  }

  /**
   * Depth-First Search traversal downstream from a start node.
   * @param {string} startNodeId
   * @param {Function} [visitorFn] callback (node, depth)
   * @returns {string[]} visited node IDs in order
   */
  dfs(startNodeId, visitorFn) {
    if (!this.nodes.has(startNodeId)) return [];

    const visited = new Set();
    const order = [];

    const traverse = (nodeId, depth) => {
      visited.add(nodeId);
      order.push(nodeId);
      const node = this.getNode(nodeId);

      if (visitorFn) {
        visitorFn(node, depth);
      }

      for (const edge of this.getOutgoingEdges(nodeId)) {
        if (!visited.has(edge.toNodeId) && this.nodes.has(edge.toNodeId)) {
          traverse(edge.toNodeId, depth + 1);
        }
      }
    };

    traverse(startNodeId, 0);
    return order;
  }

  /**
   * Helper to normalize blocked nodes/edges into Set.
   * @private
   */
  _toSet(items) {
    if (!items) return new Set();
    if (items instanceof Set) return items;
    if (Array.isArray(items)) return new Set(items);
    return new Set([items]);
  }

  /**
   * Check reachability between two nodes, optionally avoiding blocked nodes and edges.
   * @param {string} fromId
   * @param {string} toId
   * @param {Object} [options]
   * @param {Set<string>|string[]} [options.blockedNodes]
   * @param {Set<string>|string[]} [options.blockedEdges]
   * @returns {boolean}
   */
  isReachable(fromId, toId, options = {}) {
    if (fromId === toId) return true;
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return false;

    const blockedNodes = this._toSet(options.blockedNodes);
    const blockedEdges = this._toSet(options.blockedEdges);

    if (blockedNodes.has(fromId) || blockedNodes.has(toId)) return false;

    const visited = new Set([fromId]);
    const queue = [fromId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === toId) return true;

      for (const edge of this.getOutgoingEdges(current)) {
        if (blockedEdges.has(edge.id)) continue;
        const neighbor = edge.toNodeId;
        if (blockedNodes.has(neighbor)) continue;

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          if (neighbor === toId) return true;
          queue.push(neighbor);
        }
      }
    }

    return false;
  }

  /**
   * Get all downstream reachable nodes from a given starting node.
   * @param {string} startNodeId
   * @param {Object} [options]
   * @returns {Set<string>}
   */
  getDownstreamReachableNodes(startNodeId, options = {}) {
    const reachable = new Set();
    if (!this.nodes.has(startNodeId)) return reachable;

    const blockedNodes = this._toSet(options.blockedNodes);
    const blockedEdges = this._toSet(options.blockedEdges);

    if (blockedNodes.has(startNodeId)) return reachable;

    const queue = [startNodeId];
    reachable.add(startNodeId);

    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of this.getOutgoingEdges(current)) {
        if (blockedEdges.has(edge.id)) continue;
        const target = edge.toNodeId;
        if (blockedNodes.has(target)) continue;

        if (!reachable.has(target)) {
          reachable.add(target);
          queue.push(target);
        }
      }
    }

    return reachable;
  }

  /**
   * Get all upstream reachable nodes (suppliers/warehouses that can feed targetNodeId).
   * @param {string} targetNodeId
   * @param {Object} [options]
   * @returns {Set<string>}
   */
  getUpstreamReachableNodes(targetNodeId, options = {}) {
    const reachable = new Set();
    if (!this.nodes.has(targetNodeId)) return reachable;

    const blockedNodes = this._toSet(options.blockedNodes);
    const blockedEdges = this._toSet(options.blockedEdges);

    if (blockedNodes.has(targetNodeId)) return reachable;

    const queue = [targetNodeId];
    reachable.add(targetNodeId);

    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of this.getIncomingEdges(current)) {
        if (blockedEdges.has(edge.id)) continue;
        const source = edge.fromNodeId;
        if (blockedNodes.has(source)) continue;

        if (!reachable.has(source)) {
          reachable.add(source);
          queue.push(source);
        }
      }
    }

    return reachable;
  }

  /**
   * Dijkstra shortest path between two nodes.
   * @param {string} fromId
   * @param {string} toId
   * @param {Object} [options]
   * @param {'travelTime'|'distance'} [options.weightProp='travelTime']
   * @param {Set<string>|string[]} [options.blockedNodes]
   * @param {Set<string>|string[]} [options.blockedEdges]
   * @returns {{ path: string[], edges: Object[], totalWeight: number } | null}
   */
  findShortestPath(fromId, toId, options = {}) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;

    const weightProp = options.weightProp === 'distance' ? 'distance' : 'travelTime';
    const blockedNodes = this._toSet(options.blockedNodes);
    const blockedEdges = this._toSet(options.blockedEdges);

    if (blockedNodes.has(fromId) || blockedNodes.has(toId)) return null;

    if (fromId === toId) {
      return { path: [fromId], edges: [], totalWeight: 0 };
    }

    const distances = new Map();
    const previous = new Map(); // nodeId -> { prevNodeId, edge }
    const unvisited = new Set(this.nodes.keys());

    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, Infinity);
    }
    distances.set(fromId, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with lowest distance
      let current = null;
      let lowestDist = Infinity;
      for (const nodeId of unvisited) {
        const d = distances.get(nodeId);
        if (d < lowestDist) {
          lowestDist = d;
          current = nodeId;
        }
      }

      if (current === null || lowestDist === Infinity) break;
      if (current === toId) break;

      unvisited.delete(current);

      for (const edge of this.getOutgoingEdges(current)) {
        if (blockedEdges.has(edge.id)) continue;
        const neighbor = edge.toNodeId;
        if (!unvisited.has(neighbor) || blockedNodes.has(neighbor)) continue;

        const weight = typeof edge[weightProp] === 'number' ? edge[weightProp] : 1;
        const alt = distances.get(current) + weight;

        if (alt < distances.get(neighbor)) {
          distances.set(neighbor, alt);
          previous.set(neighbor, { prevNodeId: current, edge });
        }
      }
    }

    if (distances.get(toId) === Infinity) return null;

    // Reconstruct path
    const path = [];
    const pathEdges = [];
    let curr = toId;

    while (curr !== fromId) {
      path.unshift(curr);
      const step = previous.get(curr);
      if (!step) return null;
      pathEdges.unshift(step.edge);
      curr = step.prevNodeId;
    }
    path.unshift(fromId);

    return {
      path,
      edges: pathEdges,
      totalWeight: distances.get(toId),
    };
  }

  /**
   * Find all simple paths between fromId and toId.
   * Useful for evaluating multi-route redundancy and fallback scenarios.
   * @param {string} fromId
   * @param {string} toId
   * @param {Object} [options]
   * @param {number} [options.maxPaths=20]
   * @param {Set<string>|string[]} [options.blockedNodes]
   * @param {Set<string>|string[]} [options.blockedEdges]
   * @returns {Array<{ path: string[], edges: Object[], totalWeight: number }>}
   */
  findAllPaths(fromId, toId, options = {}) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return [];

    const blockedNodes = this._toSet(options.blockedNodes);
    const blockedEdges = this._toSet(options.blockedEdges);
    const maxPaths = options.maxPaths || 20;

    if (blockedNodes.has(fromId) || blockedNodes.has(toId)) return [];

    const results = [];

    const dfs = (currentId, visited, currentPath, currentEdges, currentWeight) => {
      if (results.length >= maxPaths) return;

      if (currentId === toId) {
        results.push({
          path: [...currentPath],
          edges: [...currentEdges],
          totalWeight: currentWeight,
        });
        return;
      }

      for (const edge of this.getOutgoingEdges(currentId)) {
        if (blockedEdges.has(edge.id)) continue;
        const neighbor = edge.toNodeId;
        if (visited.has(neighbor) || blockedNodes.has(neighbor)) continue;

        visited.add(neighbor);
        currentPath.push(neighbor);
        currentEdges.push(edge);

        dfs(
          neighbor,
          visited,
          currentPath,
          currentEdges,
          currentWeight + (edge.travelTime || 1)
        );

        currentEdges.pop();
        currentPath.pop();
        visited.delete(neighbor);
      }
    };

    const initialVisited = new Set([fromId]);
    dfs(fromId, initialVisited, [fromId], [], 0);

    return results;
  }

  /**
   * Serialize graph to plain JSON object.
   */
  toJSON() {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    };
  }

  /**
   * Instantiate graph from raw nodes & edges.
   * @param {{ nodes: Object[], edges: Object[] }} data
   */
  static fromJSON(data) {
    const graph = new SupplyChainGraph();
    if (!data) return graph;

    if (Array.isArray(data.nodes)) {
      for (const node of data.nodes) {
        graph.addNode(node);
      }
    }

    if (Array.isArray(data.edges)) {
      for (const edge of data.edges) {
        graph.addEdge(edge);
      }
    }

    return graph;
  }
}

module.exports = SupplyChainGraph;
