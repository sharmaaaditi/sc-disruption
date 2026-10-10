/**
 * @file index.js
 * Primary entry point for the supply chain simulation package.
 */

const SupplyChainGraph = require('./graph/SupplyChainGraph');
const SimulationEngine = require('./engine/SimulationEngine');
const types = require('./types/simulationTypes');

/**
 * Convenience runner to execute a simulation from input data.
 * @param {Object} input - SimulationInput
 * @returns {Object} SimulationOutput
 */
function runSimulation(input) {
  const engine = new SimulationEngine(input);
  return engine.run();
}

const simulationRoutes = require('./routes/simulationRoutes');

module.exports = {
  SupplyChainGraph,
  SimulationEngine,
  runSimulation,
  simulationRoutes,
  ...types,
};
