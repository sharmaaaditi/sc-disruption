const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const { loadSimulationInput } = require("../repositories/supplyChainRepository");
const SimulationEngine = require("../../simulation/src/engine/SimulationEngine");
const prisma = require("../client");

after(async () => {
  await prisma.$disconnect();
});

test("database-loaded supply chain completes in SimulationEngine", async () => {
  const input = await loadSimulationInput("demo-supply-chain");
  const result = new SimulationEngine(input).run();

  assert.equal(result.status, "COMPLETED");
  assert.equal(result.totalSteps, 10);
  assert.equal(result.metrics.totalOrders, 1);
  assert.equal(result.metrics.totalDemand, 50);
  assert.equal(result.metrics.fulfilledQuantity, 50);
  assert.equal(result.metrics.remainingQuantity, 0);
});
