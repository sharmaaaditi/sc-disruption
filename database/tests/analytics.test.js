const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { after, before, test } = require("node:test");
const testDbUrl = process.env.DATABASE_URL_TEST;

if (!testDbUrl) {
  test("analytics persistence requires DATABASE_URL_TEST", { skip: true }, () => {});
} else {
  process.env.DATABASE_URL_TEST = testDbUrl;
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
  const testId = randomUUID().slice(0, 8);
  const supplyChainId = `analytics-chain-${testId}`;
  const scenarioName = `Supplier A outage ${testId}`;
  const runId = `analytics-run-${testId}`;
  const run2Id = `analytics-run-2-${testId}`;
  let scenarioId;

  before(async () => {
    await prisma.supplyChain.create({
      data: { id: supplyChainId, name: `Analytics test chain ${testId}` },
    });
    const scenario = await createScenario({
      supplyChainId,
      name: scenarioName,
      disruptions: [
        {
          id: `analytics-disruption-${testId}`,
          type: "SUPPLIER_FAILURE",
          targetId: "supplier-a",
          startStep: 1,
          duration: 3,
        },
      ],
    });
    scenarioId = scenario.id;
  });

  after(async () => {
    const runIds = [runId, run2Id];
    await prisma.simulationEvent.deleteMany({ where: { runId: { in: runIds } } });
    await prisma.simulationMetric.deleteMany({ where: { runId: { in: runIds } } });
    await prisma.simulationRun.deleteMany({ where: { id: { in: runIds } } });
    if (scenarioId) {
      await prisma.disruption.deleteMany({ where: { scenarioId } });
      await prisma.scenario.deleteMany({ where: { id: scenarioId } });
    }
    await prisma.supplyChain.deleteMany({ where: { id: supplyChainId } });
    await prisma.$disconnect();
  });

test("scenario stores its disruption definition", async () => {
  const scenario = await getScenario(scenarioId);

  assert.equal(scenario.disruptions.length, 1);
  assert.equal(scenario.disruptions[0].targetId, "supplier-a");
  assert.equal(scenario.disruptions[0].duration, 3);

  const stored = await getScenario(scenario.id);
  assert.equal(stored.name, scenarioName);
  assert.equal(stored.runs.length, 0);
});

test("run result persists ordered events and impact metrics", async () => {
  const run = await createRun({
    id: runId,
    scenarioId,
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
  await saveRunResult(runId, {
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

  const stored = await getRun(runId);
  assert.equal(stored.events.length, 1);
  assert.equal(stored.events[0].message, "Replacement event");
  assert.equal(stored.metrics.totalOrders, 1);
});

test("listRunsBySupplyChain filters by supply chain and status with pagination", async () => {
  const run2 = await createRun({
    id: run2Id,
    scenarioId,
    totalSteps: 5,
  });
  await saveRunResult(run2.id, {
    status: "FAILED",
    metrics: { totalOrders: 0 },
    events: [],
  });

  // Query all runs for the isolated test supply chain
  const allRuns = await listRunsBySupplyChain(supplyChainId);
  assert.equal(allRuns.runs.length, 2);

  // Filter by status COMPLETED
  const completed = await listRunsBySupplyChain(supplyChainId, { status: "COMPLETED" });
  assert.ok(completed.runs.every((r) => r.status === "COMPLETED"));

  // Filter by status FAILED
  const failed = await listRunsBySupplyChain(supplyChainId, { status: "FAILED" });
  assert.ok(failed.runs.every((r) => r.status === "FAILED"));

  // Limit and pagination
  const paged = await listRunsBySupplyChain(supplyChainId, { limit: 1 });
  assert.equal(paged.runs.length, 1);
  assert.equal(paged.hasMore, true);
  assert.ok(paged.nextCursor);

  const nextPage = await listRunsBySupplyChain(supplyChainId, {
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
}
