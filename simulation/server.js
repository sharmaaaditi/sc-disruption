/**
 * @file server.js
 * Simple, beginner-friendly Express server to test and run the simulation engine.
 * Run with: node simulation/server.js
 */

const express = require('express');
const simulationRoutes = require('./src/routes/simulationRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing for incoming requests
app.use(express.json());

// Friendly welcome route
app.get('/', (req, res) => {
  res.json({
    name: '🚚 Supply Chain Disruption Simulator (P1 Engine)',
    status: 'Running',
    endpoints: {
      'GET /api/simulation/sample': 'Get sample network and simulation dataset',
      'POST /api/simulation/run': 'Run simulation with custom or sample data',
      'POST /api/simulation/graph/reachability': 'Test reachability between nodes',
      'POST /api/simulation/graph/shortest-path': 'Calculate shortest delivery path',
    },
    quickTip: 'Send a POST request to /api/simulation/run with an empty body to test with sample data!',
  });
});

// Mount simulation routes
app.use('/api/simulation', simulationRoutes);

// Start server only if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Simulation Express server running at: http://localhost:${PORT}`);
    console.log(` Try visiting http://localhost:${PORT} in your browser or curl`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
