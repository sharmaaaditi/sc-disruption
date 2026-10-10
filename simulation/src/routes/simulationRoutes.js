/**
 * @file simulationRoutes.js
 * Beginner-friendly Express router for running supply chain simulations
 * and querying network graph reachability.
 */

const express = require('express');
const router = express.Router();
const SupplyChainGraph = require('../graph/SupplyChainGraph');
const SimulationEngine = require('../engine/SimulationEngine');
const sampleDataset = require('../../data/sampleDataset.json');

/**
 * GET /api/simulation/sample
 * Returns sample supply chain data for testing.
 */
router.get('/sample', (req, res) => {
  res.json({
    message: 'Sample supply chain dataset loaded successfully',
    data: sampleDataset,
  });
});

/**
 * POST /api/simulation/run
 * Runs the simulation with given input, or falls back to sample data.
 */
router.post('/run', (req, res) => {
  try {
    // If request body has network data, use it; otherwise use sample data
    const inputData = (req.body && req.body.network) ? req.body : sampleDataset;

    // Create the simulation engine and run it
    const engine = new SimulationEngine(inputData);
    const result = engine.run();

    res.json({
      success: true,
      message: 'Simulation completed successfully',
      result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to run simulation',
      error: error.message,
    });
  }
});

/**
 * POST /api/graph/reachability
 * Checks if a downstream node is reachable from an upstream node.
 * Body: { network, fromNodeId, toNodeId, blockedNodes, blockedEdges }
 */
router.post('/graph/reachability', (req, res) => {
  try {
    const { network, fromNodeId, toNodeId, blockedNodes, blockedEdges } = req.body;

    const graphData = network || sampleDataset.network;
    const graph = SupplyChainGraph.fromJSON(graphData);

    const isReachable = graph.isReachable(fromNodeId, toNodeId, {
      blockedNodes,
      blockedEdges,
    });

    res.json({
      success: true,
      fromNodeId,
      toNodeId,
      isReachable,
      blockedNodes: blockedNodes || [],
      blockedEdges: blockedEdges || [],
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/graph/shortest-path
 * Finds the shortest path between two nodes in the network.
 * Body: { network, fromNodeId, toNodeId, blockedNodes, blockedEdges }
 */
router.post('/graph/shortest-path', (req, res) => {
  try {
    const { network, fromNodeId, toNodeId, blockedNodes, blockedEdges } = req.body;

    const graphData = network || sampleDataset.network;
    const graph = SupplyChainGraph.fromJSON(graphData);

    const pathResult = graph.findShortestPath(fromNodeId, toNodeId, {
      blockedNodes,
      blockedEdges,
    });

    if (!pathResult) {
      return res.status(404).json({
        success: false,
        message: `No available path found between ${fromNodeId} and ${toNodeId}`,
      });
    }

    res.json({
      success: true,
      fromNodeId,
      toNodeId,
      path: pathResult.path,
      totalTravelTime: pathResult.totalWeight,
      edges: pathResult.edges,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
