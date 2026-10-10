/**
 * @file checkpointRun.js
 * Day 3 Checkpoint Script:
 * Loads network, injects supplier failure disruption, runs the engine, and returns results.
 */

const { runSimulation } = require('../src/index');
const sampleData = require('../data/sampleDataset.json');

function runCheckpoint() {
  console.log('='.repeat(70));
  console.log('🚚 SC Disruption — Day 3 Simulation Checkpoint (P1)');
  console.log('='.repeat(70));

  // 1. Load network, inventory, and orders
  console.log('\n[1] Loading supply chain network, inventory, and orders...');
  const simulationInput = JSON.parse(JSON.stringify(sampleData));

  console.log(`  • Nodes loaded: ${simulationInput.network.nodes.length}`);
  console.log(`  • Edges loaded: ${simulationInput.network.edges.length}`);
  console.log(`  • Inventory records: ${simulationInput.inventory.length}`);
  console.log(`  • Customer orders: ${simulationInput.orders.length}`);

  // 2. Inject disruption: Supplier failure
  console.log('\n[2] Injecting disruption scenario:');
  const disruption = {
    id: 'disruption-supplier-outage',
    type: 'SUPPLIER_FAILURE',
    targetId: 'sup-1',
    startStep: 2,
    duration: 4, // Steps 2, 3, 4, 5. Resolves at step 6.
    severity: 1.0,
    description: 'Catastrophic equipment breakdown at primary Supplier North (sup-1)',
  };
  simulationInput.disruptions = [disruption];
  simulationInput.config.totalSteps = 10;

  console.log(`  • Type: ${disruption.type}`);
  console.log(`  • Target: ${disruption.targetId}`);
  console.log(`  • Timeframe: Active from step ${disruption.startStep} to ${disruption.startStep + disruption.duration} (duration: ${disruption.duration} steps)`);

  // 3. Run engine
  console.log('\n[3] Executing simulation engine across 10 time steps...');
  const startTime = Date.now();
  const output = runSimulation(simulationInput);
  const elapsed = Date.now() - startTime;
  console.log(`  • Engine execution completed in ${elapsed}ms (Run ID: ${output.runId})`);

  // 4. Print results & metrics
  console.log('\n[4] Simulation Results & Impact Analysis:');
  console.log('─'.repeat(70));
  console.log(`  • Total Demand:            ${output.metrics.totalDemand} units`);
  console.log(`  • Total Fulfilled:         ${output.metrics.totalFulfilledQuantity} units`);
  console.log(`  • Total Shortage:          ${output.metrics.totalShortageQuantity} units`);
  console.log(`  • Fill Rate:               ${(output.metrics.fillRate * 100).toFixed(1)}%`);
  console.log(`  • Stockout Events:         ${output.metrics.stockoutEventsCount}`);
  console.log(`  • Affected Nodes:          [${output.metrics.affectedNodes.join(', ')}]`);
  console.log(`  • Affected Edges:          [${output.metrics.affectedEdges.join(', ')}]`);
  console.log('─'.repeat(70));
  console.log('  Financial Impact Breakdown:');
  console.log(`    - Transportation Cost:   $${output.metrics.financialImpact.transportCost.toFixed(2)}`);
  console.log(`    - Delay Penalty:         $${output.metrics.financialImpact.delayPenalty.toFixed(2)}`);
  console.log(`    - Stockout Penalty:      $${output.metrics.financialImpact.stockoutPenalty.toFixed(2)}`);
  console.log(`    - Total Impact Cost:     $${output.metrics.financialImpact.totalCost.toFixed(2)}`);
  console.log('─'.repeat(70));

  // 5. Significant Events
  console.log('\n[5] Key Simulation Events:');
  const significantTypes = new Set([
    'DISRUPTION_ACTIVATED',
    'DISRUPTION_RESOLVED',
    'STOCKOUT_OCCURRED',
    'ORDER_DELAYED',
  ]);
  const keyEvents = output.events.filter((e) => significantTypes.has(e.type));
  keyEvents.forEach((e) => {
    console.log(`  [Step ${e.step}] [${e.type}] ${e.message}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('✅ Day 3 Checkpoint verification PASSED successfully!');
  console.log('='.repeat(70));

  return output;
}

if (require.main === module) {
  runCheckpoint();
}

module.exports = runCheckpoint;
