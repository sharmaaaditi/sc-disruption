const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { after, before, describe, it } = require("node:test");

const testDbUrl = process.env.DATABASE_URL_TEST;

describe("Real database API integration test", () => {
  if (!testDbUrl) {
    it("skips integration test when DATABASE_URL_TEST is not configured", { skip: true }, () => {});
    return;
  }

  process.env.DATABASE_URL_TEST = testDbUrl;

  const prisma = require("../../database/client");
  const createApp = require("../app");

  let server;
  let url;
  const testId = randomUUID().slice(0, 8);
  const supplyChainId = `test-sc-${testId}`;
  const supplierId = `test-supplier-${testId}`;
  const warehouseId = `test-warehouse-${testId}`;
  const edgeId = `test-edge-${testId}`;
  const productId = `test-prod-${testId}`;
  const productSku = `SKU-${testId}`;
  const orderId = `test-order-${testId}`;
  const orderItemId = `test-orderitem-${testId}`;

  before(async () => {
    // 1. Create uniquely named test records in PostgreSQL
    await prisma.supplyChain.create({
      data: {
        id: supplyChainId,
        name: `Integration Test SC ${testId}`,
      },
    });

    await prisma.node.createMany({
      data: [
        {
          id: supplierId,
          name: `Supplier ${testId}`,
          type: "SUPPLIER",
          supplyChainId,
        },
        {
          id: warehouseId,
          name: `Warehouse ${testId}`,
          type: "WAREHOUSE",
          supplyChainId,
        },
      ],
    });

    await prisma.edge.create({
      data: {
        id: edgeId,
        fromNodeId: supplierId,
        toNodeId: warehouseId,
        distance: 10,
        travelTime: 1,
      },
    });

    await prisma.product.create({
      data: {
        id: productId,
        name: `Product ${testId}`,
        sku: productSku,
      },
    });

    await prisma.inventory.createMany({
      data: [
        {
          nodeId: supplierId,
          productId,
          quantity: 100,
        },
        {
          nodeId: warehouseId,
          productId,
          quantity: 20,
        },
      ],
    });

    await prisma.order.create({
      data: {
        id: orderId,
        nodeId: warehouseId,
        status: "PENDING",
        dueStep: 1,
      },
    });

    await prisma.orderItem.create({
      data: {
        id: orderItemId,
        orderId,
        productId,
        quantity: 10,
      },
    });

    // 2. Start the real Node API with PostgreSQL/Prisma
    const app = createApp({ logger: { error() {} } });
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up ONLY records created by this test
    const scenarios = await prisma.scenario.findMany({
      where: { supplyChainId },
      select: { id: true },
    });
    const scenarioIds = scenarios.map((s) => s.id);

    const runs = await prisma.simulationRun.findMany({
      where: { scenarioId: { in: scenarioIds } },
      select: { id: true },
    });
    const runIds = runs.map((r) => r.id);

    if (runIds.length > 0) {
      await prisma.simulationEvent.deleteMany({ where: { runId: { in: runIds } } });
      await prisma.simulationMetric.deleteMany({ where: { runId: { in: runIds } } });
      await prisma.simulationRun.deleteMany({ where: { id: { in: runIds } } });
    }

    if (scenarioIds.length > 0) {
      await prisma.disruption.deleteMany({ where: { scenarioId: { in: scenarioIds } } });
      await prisma.scenario.deleteMany({ where: { id: { in: scenarioIds } } });
    }

    await prisma.orderItem.deleteMany({ where: { id: orderItemId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.inventory.deleteMany({
      where: { nodeId: { in: [supplierId, warehouseId] } },
    });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.edge.deleteMany({ where: { id: edgeId } });
    await prisma.node.deleteMany({ where: { supplyChainId } });
    await prisma.supplyChain.deleteMany({ where: { id: supplyChainId } });

    await prisma.$disconnect();
  });

  it("completes full flow: API -> PostgreSQL/Prisma -> SimulationEngine -> DB persistence -> retrieval API", async () => {
    const listRes = await fetch(`${url}/api/supply-chains`);
    assert.equal(listRes.status, 200);
    const { data: chains } = await listRes.json();
    const chain = chains.find(({ id }) => id === supplyChainId);
    assert.ok(chain);
    assert.deepEqual(chain.edges, [{
      id: edgeId, fromNodeId: supplierId, toNodeId: warehouseId, distance: 10, travelTime: 1,
    }]);

    // 1. Start simulation through HTTP API
    const startRes = await fetch(`${url}/api/supply-chains/${supplyChainId}/simulations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `Live Flow Run ${testId}`,
        disruptions: [
          {
            type: "SUPPLIER_FAILURE",
            targetId: supplierId,
            startStep: 1,
            duration: 2,
          },
        ],
        config: {
          totalSteps: 5,
        },
      }),
    });

    assert.equal(startRes.status, 201);
    const startPayload = await startRes.json();
    assert.equal(startPayload.success, true);
    const runData = startPayload.data;
    assert.ok(runData.runId);
    assert.ok(runData.scenarioId);
    assert.equal(runData.status, "COMPLETED");
    assert.equal(runData.totalSteps, 5);
    assert.ok(runData.metrics);
    assert.ok(Array.isArray(runData.events));

    // 2. Confirm scenario, run, events, and metrics are persisted in PostgreSQL
    const dbScenario = await prisma.scenario.findUnique({
      where: { id: runData.scenarioId },
      include: { disruptions: true },
    });
    assert.ok(dbScenario);
    assert.equal(dbScenario.supplyChainId, supplyChainId);
    assert.equal(dbScenario.name, `Live Flow Run ${testId}`);
    assert.equal(dbScenario.disruptions.length, 1);
    assert.equal(dbScenario.disruptions[0].targetId, supplierId);

    const dbRun = await prisma.simulationRun.findUnique({
      where: { id: runData.runId },
    });
    assert.ok(dbRun);
    assert.equal(dbRun.scenarioId, runData.scenarioId);
    assert.equal(dbRun.status, "COMPLETED");
    assert.equal(dbRun.totalSteps, 5);
    assert.ok(dbRun.completedAt);

    const dbEvents = await prisma.simulationEvent.findMany({
      where: { runId: runData.runId },
      orderBy: [{ step: "asc" }, { sequence: "asc" }],
    });
    assert.ok(dbEvents.length > 0);
    assert.equal(dbEvents.length, runData.events.length);

    const dbMetrics = await prisma.simulationMetric.findUnique({
      where: { runId: runData.runId },
    });
    assert.ok(dbMetrics);
    assert.equal(dbMetrics.runId, runData.runId);
    assert.equal(dbMetrics.totalOrders, runData.metrics.totalOrders);

    // 3. Retrieve the run through the retrieval API and compare
    const getRes = await fetch(`${url}/api/simulations/${runData.runId}`);
    assert.equal(getRes.status, 200);
    const getPayload = await getRes.json();
    assert.equal(getPayload.success, true);
    const retrieved = getPayload.data;
    assert.equal(retrieved.runId, runData.runId);
    assert.equal(retrieved.scenarioId, runData.scenarioId);
    assert.equal(retrieved.status, "COMPLETED");
    assert.equal(retrieved.totalSteps, 5);
    assert.ok(retrieved.completedAt);
    assert.deepEqual(retrieved.metrics, runData.metrics);
    assert.equal(retrieved.events.length, runData.events.length);

    // 4. Test simulation history endpoint added in Task 1
    const historyRes = await fetch(`${url}/api/supply-chains/${supplyChainId}/simulations`);
    assert.equal(historyRes.status, 200);
    const historyPayload = await historyRes.json();
    assert.equal(historyPayload.success, true);
    assert.ok(Array.isArray(historyPayload.data));
    assert.equal(historyPayload.data.length, 1);
    assert.equal(historyPayload.data[0].runId, runData.runId);
    assert.equal(historyPayload.data[0].scenarioName, `Live Flow Run ${testId}`);
    assert.equal(historyPayload.data[0].status, "COMPLETED");
    assert.deepEqual(historyPayload.data[0].metrics, runData.metrics);

    // Filter status=COMPLETED
    const historyCompleted = await fetch(
      `${url}/api/supply-chains/${supplyChainId}/simulations?status=COMPLETED`
    );
    assert.equal(historyCompleted.status, 200);
    const completedData = (await historyCompleted.json()).data;
    assert.equal(completedData.length, 1);
    assert.equal(completedData[0].runId, runData.runId);

    // Filter status=FAILED (should be 0 right now)
    const historyFailed = await fetch(
      `${url}/api/supply-chains/${supplyChainId}/simulations?status=FAILED`
    );
    assert.equal(historyFailed.status, 200);
    const failedData = (await historyFailed.json()).data;
    assert.equal(failedData.length, 0);

    // 5. Confirm failed engine runs are recorded as failed
    const failingApp = createApp({
      simulationRunner() {
        throw new Error("Deliberate engine failure for testing");
      },
      logger: { error() {} },
    });
    const failingServer = failingApp.listen(0);
    await new Promise((resolve) => failingServer.once("listening", resolve));
    try {
      const failPostRes = await fetch(
        `http://127.0.0.1:${failingServer.address().port}/api/supply-chains/${supplyChainId}/simulations`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: `Failing Engine Run ${testId}`,
            disruptions: [
              {
                type: "SUPPLIER_FAILURE",
                targetId: supplierId,
                startStep: 0,
                duration: 1,
              },
            ],
            config: { totalSteps: 3 },
          }),
        }
      );
      assert.equal(failPostRes.status, 500);
      const failPayload = await failPostRes.json();
      assert.equal(failPayload.error.code, "INTERNAL_SERVER_ERROR");

      // Verify the failed run was recorded as FAILED in PostgreSQL
      const failedDbRun = await prisma.simulationRun.findFirst({
        where: {
          scenario: { supplyChainId },
          status: "FAILED",
        },
      });
      assert.ok(failedDbRun);
      assert.equal(failedDbRun.status, "FAILED");
      assert.ok(failedDbRun.completedAt);
      const failedRunDetails = await fetch(`${url}/api/simulations/${failedDbRun.id}`);
      assert.equal(failedRunDetails.status, 200);
      const { data: failedRun } = await failedRunDetails.json();
      assert.equal(failedRun.status, "FAILED");
      assert.equal(failedRun.metrics, null);
      assert.equal(failedRun.finalState, null);

      // Verify history API returns both runs and filters FAILED correctly
      const historyWithFailed = await fetch(
        `${url}/api/supply-chains/${supplyChainId}/simulations`
      );
      assert.equal(historyWithFailed.status, 200);
      assert.equal((await historyWithFailed.json()).data.length, 2);

      const historyOnlyFailed = await fetch(
        `${url}/api/supply-chains/${supplyChainId}/simulations?status=FAILED`
      );
      assert.equal(historyOnlyFailed.status, 200);
      const failedRuns = (await historyOnlyFailed.json()).data;
      assert.equal(failedRuns.length, 1);
      assert.equal(failedRuns[0].runId, failedDbRun.id);
      assert.equal(failedRuns[0].status, "FAILED");
    } finally {
      failingServer.closeAllConnections();
      await new Promise((resolve) => failingServer.close(resolve));
    }
  });
});
