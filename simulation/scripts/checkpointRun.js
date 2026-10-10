const { runSimulation } = require('../src/index');
const sampleData = require('../data/sampleDataset.json');

function main() {
  console.log('Running supply chain simulation test...');

  const input = JSON.parse(JSON.stringify(sampleData));

  // Add a supplier failure disruption
  input.disruptions = [
    {
      id: 'supplier-down',
      type: 'SUPPLIER_FAILURE',
      targetId: 'sup-1',
      startStep: 2,
      duration: 3,
    },
  ];

  const result = runSimulation(input);

  console.log('Simulation complete!');
  console.log('Total steps:', result.totalSteps);
  console.log('Orders total:', result.metrics.totalOrders);
  console.log('Total demand:', result.metrics.totalDemand);
  console.log('Fulfilled quantity:', result.metrics.fulfilledQuantity);
  console.log('Stockouts count:', result.metrics.stockoutEvents);
  console.log('Affected nodes:', result.metrics.affectedNodes);
}

if (require.main === module) {
  main();
}

module.exports = main;
