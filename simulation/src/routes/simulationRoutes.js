const express = require('express');
const router = express.Router();
const SupplyChainGraph = require('../graph/SupplyChainGraph');
const SimulationEngine = require('../engine/SimulationEngine');
const sampleData = require('../../data/sampleDataset.json');

// Get sample data
router.get('/sample', (req, res) => {
  res.json({ data: sampleData });
});

// Run simulation
router.post('/run', (req, res) => {
  try {
    const input = req.body && req.body.network ? req.body : sampleData;
    const engine = new SimulationEngine(input);
    const result = engine.run();
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Check if two nodes can connect
router.post('/graph/reachability', (req, res) => {
  try {
    const { fromNodeId, toNodeId, blockedNodes, blockedEdges } = req.body;
    const graph = SupplyChainGraph.fromJSON(req.body.network || sampleData.network);
    const isReachable = graph.isReachable(fromNodeId, toNodeId, { blockedNodes, blockedEdges });
    res.json({ success: true, fromNodeId, toNodeId, isReachable });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
