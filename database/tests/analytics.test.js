const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const prisma = require("../client");
const {
  createScenario,
  createRun,
  getImpactSummary,
  getRun,
  getScenario,
  saveRunResult,
  listRunsBySupplyChain,
} = require("../repositories/simulationRepository");

before(async () => {
  await prisma.simulationEvent.deleteMany();
  await prisma.simulationMetric.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.disruption.deleteMany();
  await prisma.scenario.deleteMany();
});

after(async () => {
  await prisma.simulationEvent.deleteMany();
  await prisma.simulationMetric.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.disruption.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.$disconnect();
});

test("scenario stores its disruption definition", async () => {
  const scenario = await createScenario({
    supplyChainId: "demo-supply-chain",
    name: "Supplier A outage",
    disruptions: [
      {
        id: "analytics-disruption-1",
        type: "SUPPLIER_FAILURE",
        targetId: "supplier-a",
        startStep: 1,
        duration: 3,
      },
    ],
  });

  assert.equal(scenario.disruptions.length, 1);
  assert.equal(scenario.disruptions[0].targetId, "supplier-a");
  assert.equal(scenario.disruptions[0].duration, 3);

  const stored = await getScenario(scenario.id);
  assert.equal(stored.name, "Supplier A outage");
  assert.equal(stored.runs.length, 0);
});

test("run result persists ordered events and impact metrics", async () => {
  const scenario = await prisma.scenario.findFirstOrThrow({
    where: { name: "Supplier A outage" },
  });
  const run = await createRun({
    id: "analytics-run-1",
    scenarioId: scenario.id,
    totalSteps: 5,
  });

  await saveRunResult(run.id, {
    status: "COMPLETED",
    metrics: {
      totalOrders: 2,
      totalDemand: 70,
      fulfilledQuantity: 50,
      remainingQuantity: 20,
      stockoutEvents: 3,
      stockouts: 1,
      delayedOrders: 1,
      additionalCost: 0,
      recoveryTime: 3,
      affectedNodes: ["supplier-a", "retailer-a"],
      affectedEdges: [],
    },
    finalState: {
      inventory: [{ nodeId: "retailer-a", productId: "product-a", quantity: 0 }],
      orders: [{ orderId: "order-1", status: "DELAYED" }],
    },
    events: [
      {
        step: 1,
        type: "DISRUPTION_ACTIVATED",
        targetType: "NODE",
        targetId: "supplier-a",
        message: "Supplier failed",
      },
      {
        step: 2,
        type: "STOCKOUT_OCCURRED",
        targetType: "NODE",
        targetId: "retailer-a",
        message: "Retailer stocked out",
      },
      {
        step: 4,
        type: "DISRUPTION_RESOLVED",
        targetType: "NODE",
        targetId: "supplier-a",
        message: "Supplier recovered",
      },
    ],
  });

  const stored = await getRun(run.id);
  assert.equal(stored.status, "COMPLETED");
  assert.ok(stored.completedAt);
  assert.deepEqual(stored.events.map((event) => event.step), [1, 2, 4]);
  assert.equal(stored.metrics.remainingQuantity, 20);
  assert.equal(stored.metrics.stockouts, 1);
  assert.deepEqual(stored.metrics.affectedNodes, ["supplier-a", "retailer-a"]);
  assert.equal(stored.metrics.finalState.orders[0].status, "DELAYED");

  const impact = await getImpactSummary(run.id);
  assert.equal(impact.runId, run.id);
  assert.equal(impact.timeline[1].type, "STOCKOUT_OCCURRED");
  assert.equal(impact.metrics.recoveryTime, 3);
  assert.equal(await getImpactSummary("missing-run"), null);
});

test("saving a run result again replaces events without duplicates", async () => {
  await saveRunResult("analytics-run-1", {
    status: "COMPLETED",
    metrics: { totalOrders: 1 },
    events: [
      {
        step: 0,
        type: "DISRUPTION_ACTIVATED",
        targetType: "NODE",
        targetId: "supplier-a",
        message: "Replacement event",
      },
    ],
  });

  const stored = await getRun("analytics-run-1");
  assert.equal(stored.events.length, 1);
  assert.equal(stored.events[0].message, "Replacement event");
  assert.equal(stored.metrics.totalOrders, 1);
});

test("listRunsBySupplyChain filters by supply chain and status with pagination", async () => {
  const scenario = await prisma.scenario.findFirstOrThrow({
    where: { name: "Supplier A outage" },
  });

  const run2 = await createRun({
    id: "analytics-run-2",
    scenarioId: scenario.id,
    totalSteps: 5,
  });
  await saveRunResult(run2.id, {
    status: "FAILED",
    metrics: { totalOrders: 0 },
    events: [],
  });

  // Query all runs for demo-supply-chain
  const allRuns = await listRunsBySupplyChain("demo-supply-chain");
  assert.ok(allRuns.runs.length >= 2);

  // Filter by status COMPLETED
  const completed = await listRunsBySupplyChain("demo-supply-chain", { status: "COMPLETED" });
  assert.ok(completed.runs.every((r) => r.status === "COMPLETED"));

  // Filter by status FAILED
  const failed = await listRunsBySupplyChain("demo-supply-chain", { status: "FAILED" });
  assert.ok(failed.runs.every((r) => r.status === "FAILED"));

  // Limit and pagination
  const paged = await listRunsBySupplyChain("demo-supply-chain", { limit: 1 });
  assert.equal(paged.runs.length, 1);
  assert.equal(paged.hasMore, true);
  assert.ok(paged.nextCursor);

  const nextPage = await listRunsBySupplyChain("demo-supply-chain", {
    limit: 1,
    cursor: paged.nextCursor,
  });
  assert.equal(nextPage.runs.length, 1);
  assert.notEqual(nextPage.runs[0].id, paged.runs[0].id);

  // Non-matching supply chain returns empty runs
  const otherChain = await listRunsBySupplyChain("non-existent-supply-chain");
  assert.equal(otherChain.runs.length, 0);
  assert.equal(otherChain.hasMore, false);
});
