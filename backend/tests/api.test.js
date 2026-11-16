const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const createApp = require("../app");

const network = {
  nodes: [
    { id: "supplier-1", type: "SUPPLIER" },
    { id: "warehouse-1", type: "WAREHOUSE" },
  ],
  edges: [{ id: "edge-1", fromNodeId: "supplier-1", toNodeId: "warehouse-1" }],
};

function createTestContext({ engine = () => successfulResult } = {}) {
  const state = { scenarios: [], runs: new Map(), engineInputs: [], savedResults: [] };
  const supplyChainRepository = {
    async getAllSupplyChains() {
      return [{ id: "chain-1", name: "Test chain" }];
    },
    async getSupplyChain(id) {
      if (id !== "chain-1") return null;
      return { id: "chain-1", name: "Test chain" };
    },
    async loadSimulationInput(id) {
      if (id !== "chain-1") throw new Error("Supply chain not found");
      return { network, inventory: [], orders: [] };
    },
  };
  const simulationRepository = {
    async createScenario(scenario) {
      const created = { id: `scenario-${state.scenarios.length + 1}`, ...scenario };
      state.scenarios.push(created);
      return created;
    },
    async createRun(run) {
      const scenario = state.scenarios.find((s) => s.id === run.scenarioId) || {
        id: run.scenarioId,
        supplyChainId: "chain-1",
        name: "Test scenario",
      };
      state.runs.set(run.id, {
        ...run,
        status: "RUNNING",
        startedAt: new Date(),
        scenario,
      });
      return state.runs.get(run.id);
    },
    async saveRunResult(runId, result) {
      state.savedResults.push({ runId, result });
      state.runs.set(runId, {
        ...state.runs.get(runId),
        status: result.status,
        completedAt: new Date(),
        metrics: { ...result.metrics, finalState: result.finalState },
        events: result.events,
      });
    },
    async markRunFailed(runId) {
      state.runs.set(runId, { ...state.runs.get(runId), status: "FAILED", completedAt: new Date() });
    },
    async getRun(id) {
      return state.runs.get(id) || null;
    },
    async listRunsBySupplyChain(supplyChainId, { status, limit = 10, cursor } = {}) {
      const scenarioMap = new Map(state.scenarios.map((s) => [s.id, s]));
      let runs = Array.from(state.runs.values()).filter((run) => {
        const scenario = scenarioMap.get(run.scenarioId) || run.scenario;
        return scenario && scenario.supplyChainId === supplyChainId;
      });
      if (status) {
        runs = runs.filter((run) => run.status === status);
      }
      runs.sort((a, b) => {
        const timeDiff = new Date(b.startedAt || 0) - new Date(a.startedAt || 0);
        if (timeDiff !== 0) return timeDiff;
        return (b.id || "").localeCompare(a.id || "");
      });
      let startIndex = 0;
      if (cursor) {
        const idx = runs.findIndex((r) => r.id === cursor);
        if (idx >= 0) {
          startIndex = idx + 1;
        }
      }
      const page = runs.slice(startIndex, startIndex + limit + 1);
      const hasMore = page.length > limit;
      const items = hasMore ? page.slice(0, limit) : page;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;
      return { runs: items, hasMore, nextCursor };
    },
  };
  const app = createApp({
    supplyChainRepository,
    simulationRepository,
    simulationRunner(input) {
      state.engineInputs.push(input);
      return engine(input);
    },
    logger: { error() {} },
  });
  return { app, state };
}

const successfulResult = {
  runId: "engine-run",
  status: "COMPLETED",
  totalSteps: 4,
  metrics: { totalOrders: 1, delayedOrders: 0 },
  finalState: { inventory: [], orders: [] },
  events: [{ step: 0, type: "DISRUPTION_ACTIVATED", targetType: "NODE", targetId: "supplier-1" }],
};

describe("backend API", () => {
  let server;
  let url;

  before(async () => {
    const { app } = createTestContext();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("reports health and lists supply chains", async () => {
    const health = await fetch(`${url}/api/health`);
    assert.deepEqual(await health.json(), { success: true, data: { status: "ok" } });

    const chains = await fetch(`${url}/api/supply-chains`);
    assert.deepEqual((await chains.json()).data, [{ id: "chain-1", name: "Test chain" }]);
  });

  it("validates the request and returns persisted simulation results", async () => {
    const context = createTestContext();
    const instance = context.app.listen(0);
    await new Promise((resolve) => instance.once("listening", resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${instance.address().port}/api/supply-chains/chain-1/simulations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Supplier outage",
          disruptions: [{ type: "SUPPLIER_FAILURE", targetId: "supplier-1", startStep: 1, duration: 2 }],
          config: { totalSteps: 4 },
        }),
      });
      const payload = await response.json();
      assert.equal(response.status, 201);
      assert.equal(payload.data.status, "COMPLETED");
      assert.equal(payload.data.totalSteps, 4);
      assert.equal(context.state.engineInputs[0].disruptions[0].startStep, 1);
      assert.equal(context.state.scenarios[0].name, "Supplier outage");
      assert.equal(context.state.savedResults.length, 1);

      const result = await fetch(`http://127.0.0.1:${instance.address().port}/api/simulations/${payload.data.runId}`);
      const retrieved = await result.json();
      assert.equal(result.status, 200);
      assert.equal(retrieved.data.runId, payload.data.runId);
      assert.deepEqual(retrieved.data.finalState, successfulResult.finalState);
      assert.equal(retrieved.data.events.length, 1);
    } finally {
      instance.closeAllConnections();
      await new Promise((resolve) => instance.close(resolve));
    }
  });

  it("returns useful errors for invalid input and missing resources", async () => {
    const context = createTestContext();
    const instance = context.app.listen(0);
    await new Promise((resolve) => instance.once("listening", resolve));
    try {
      const base = `http://127.0.0.1:${instance.address().port}`;
      const invalid = await fetch(`${base}/api/supply-chains/chain-1/simulations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disruptions: [{ type: "SUPPLIER_FAILURE", targetId: "warehouse-1", startStep: 0, duration: 1 }] }),
      });
      assert.equal(invalid.status, 400);
      assert.equal((await invalid.json()).error.code, "INVALID_DISRUPTION_TARGET");

      const missingChain = await fetch(`${base}/api/supply-chains/missing/simulations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disruptions: [{ type: "SUPPLIER_FAILURE", targetId: "supplier-1", startStep: 0, duration: 1 }] }),
      });
      assert.equal(missingChain.status, 404);
      assert.equal((await missingChain.json()).error.code, "SUPPLY_CHAIN_NOT_FOUND");

      const missingRun = await fetch(`${base}/api/simulations/missing-run`);
      assert.equal(missingRun.status, 404);
      assert.equal((await missingRun.json()).error.code, "SIMULATION_NOT_FOUND");
    } finally {
      instance.closeAllConnections();
      await new Promise((resolve) => instance.close(resolve));
    }
  });

  it("returns stable errors for malformed JSON and engine failures", async () => {
    const base = `http://127.0.0.1:${server.address().port}`;
    const malformed = await fetch(`${base}/api/supply-chains/chain-1/simulations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, "INVALID_JSON");

    const context = createTestContext({ engine: () => { throw new Error("secret internal detail"); } });
    const instance = context.app.listen(0);
    await new Promise((resolve) => instance.once("listening", resolve));
    try {
      const failed = await fetch(`http://127.0.0.1:${instance.address().port}/api/supply-chains/chain-1/simulations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disruptions: [{ type: "SUPPLIER_FAILURE", targetId: "supplier-1", startStep: 0, duration: 1 }] }),
      });
      assert.equal(failed.status, 500);
      assert.equal((await failed.json()).error.code, "INTERNAL_SERVER_ERROR");
      assert.equal(context.state.runs.values().next().value.status, "FAILED");
    } finally {
      instance.closeAllConnections();
      await new Promise((resolve) => instance.close(resolve));
    }
  });

  it("lists simulation history with status filtering, limits, and cursor pagination", async () => {
    const context = createTestContext();
    const instance = context.app.listen(0);
    await new Promise((resolve) => instance.once("listening", resolve));
    try {
      const base = `http://127.0.0.1:${instance.address().port}`;

      // Run two simulations
      const runRes1 = await fetch(`${base}/api/supply-chains/chain-1/simulations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Run 1",
          disruptions: [{ type: "SUPPLIER_FAILURE", targetId: "supplier-1", startStep: 0, duration: 1 }],
          config: { totalSteps: 2 },
        }),
      });
      const run1 = (await runRes1.json()).data;

      const runRes2 = await fetch(`${base}/api/supply-chains/chain-1/simulations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Run 2",
          disruptions: [{ type: "SUPPLIER_FAILURE", targetId: "supplier-1", startStep: 0, duration: 1 }],
          config: { totalSteps: 2 },
        }),
      });
      const run2 = (await runRes2.json()).data;

      // Add a third run marked as FAILED directly in mock
      context.state.runs.set("failed-run", {
        id: "failed-run",
        scenarioId: context.state.scenarios[0].id,
        status: "FAILED",
        totalSteps: 2,
        startedAt: new Date(Date.now() - 10000),
        completedAt: new Date(),
        scenario: context.state.scenarios[0],
      });

      // 1. Fetch all simulations for chain-1
      const historyRes = await fetch(`${base}/api/supply-chains/chain-1/simulations`);
      assert.equal(historyRes.status, 200);
      const historyPayload = await historyRes.json();
      assert.equal(historyPayload.success, true);
      assert.ok(Array.isArray(historyPayload.data));
      assert.equal(historyPayload.data.length, 3);
      assert.ok(historyPayload.data[0].runId);
      assert.ok(historyPayload.data[0].status);
      assert.equal(historyPayload.pagination.limit, 10);
      assert.equal(historyPayload.pagination.hasMore, false);

      // 2. Filter by status=COMPLETED
      const completedRes = await fetch(`${base}/api/supply-chains/chain-1/simulations?status=COMPLETED`);
      assert.equal(completedRes.status, 200);
      const completedPayload = await completedRes.json();
      assert.equal(completedPayload.data.length, 2);
      assert.ok(completedPayload.data.every((r) => r.status === "COMPLETED"));

      // 3. Filter by status=FAILED
      const failedRes = await fetch(`${base}/api/supply-chains/chain-1/simulations?status=FAILED`);
      assert.equal(failedRes.status, 200);
      const failedPayload = await failedRes.json();
      assert.equal(failedPayload.data.length, 1);
      assert.equal(failedPayload.data[0].runId, "failed-run");

      // 4. Test pagination limit=1
      const page1Res = await fetch(`${base}/api/supply-chains/chain-1/simulations?limit=1`);
      assert.equal(page1Res.status, 200);
      const page1Payload = await page1Res.json();
      assert.equal(page1Payload.data.length, 1);
      assert.equal(page1Payload.pagination.limit, 1);
      assert.equal(page1Payload.pagination.hasMore, true);
      assert.ok(page1Payload.pagination.nextCursor);

      // 5. Test cursor for page 2
      const page2Res = await fetch(`${base}/api/supply-chains/chain-1/simulations?limit=1&cursor=${page1Payload.pagination.nextCursor}`);
      assert.equal(page2Res.status, 200);
      const page2Payload = await page2Res.json();
      assert.equal(page2Payload.data.length, 1);
      assert.notEqual(page2Payload.data[0].runId, page1Payload.data[0].runId);
    } finally {
      instance.closeAllConnections();
      await new Promise((resolve) => instance.close(resolve));
    }
  });

  it("validates simulation history queries and returns clear errors", async () => {
    const context = createTestContext();
    const instance = context.app.listen(0);
    await new Promise((resolve) => instance.once("listening", resolve));
    try {
      const base = `http://127.0.0.1:${instance.address().port}`;

      // Missing supply chain returns 404
      const missingChain = await fetch(`${base}/api/supply-chains/non-existent/simulations`);
      assert.equal(missingChain.status, 404);
      assert.equal((await missingChain.json()).error.code, "SUPPLY_CHAIN_NOT_FOUND");

      // Invalid status filter returns 400
      const invalidStatus = await fetch(`${base}/api/supply-chains/chain-1/simulations?status=UNKNOWN`);
      assert.equal(invalidStatus.status, 400);
      assert.equal((await invalidStatus.json()).error.code, "INVALID_FILTER");

      // Invalid limit returns 400
      const zeroLimit = await fetch(`${base}/api/supply-chains/chain-1/simulations?limit=0`);
      assert.equal(zeroLimit.status, 400);
      assert.equal((await zeroLimit.json()).error.code, "INVALID_LIMIT");

      const negLimit = await fetch(`${base}/api/supply-chains/chain-1/simulations?limit=-5`);
      assert.equal(negLimit.status, 400);
      assert.equal((await negLimit.json()).error.code, "INVALID_LIMIT");

      const textLimit = await fetch(`${base}/api/supply-chains/chain-1/simulations?limit=abc`);
      assert.equal(textLimit.status, 400);
      assert.equal((await textLimit.json()).error.code, "INVALID_LIMIT");

      const overLimit = await fetch(`${base}/api/supply-chains/chain-1/simulations?limit=101`);
      assert.equal(overLimit.status, 400);
      assert.equal((await overLimit.json()).error.code, "INVALID_LIMIT");

      // Invalid cursor returns 400
      const emptyCursor = await fetch(`${base}/api/supply-chains/chain-1/simulations?cursor=%20%20`);
      assert.equal(emptyCursor.status, 400);
      assert.equal((await emptyCursor.json()).error.code, "INVALID_REQUEST");
    } finally {
      instance.closeAllConnections();
      await new Promise((resolve) => instance.close(resolve));
    }
  });

  it("handles CORS headers and preflight for allowed and rejected origins", async () => {
    // 1. Default configuration: localhost allowed, external origin rejected
    const defaultContext = createTestContext();
    const instance1 = defaultContext.app.listen(0);
    await new Promise((resolve) => instance1.once("listening", resolve));
    try {
      const base = `http://127.0.0.1:${instance1.address().port}`;

      // Allowed origin GET request
      const allowedRes = await fetch(`${base}/api/health`, {
        headers: { Origin: "http://localhost:5173" },
      });
      assert.equal(allowedRes.status, 200);
      assert.equal(allowedRes.headers.get("access-control-allow-origin"), "http://localhost:5173");
      assert.equal(allowedRes.headers.get("vary"), "Origin");

      // Rejected origin GET request
      const rejectedRes = await fetch(`${base}/api/health`, {
        headers: { Origin: "http://malicious-website.com" },
      });
      assert.equal(rejectedRes.status, 200);
      assert.equal(rejectedRes.headers.get("access-control-allow-origin"), null);

      // Preflight OPTIONS for allowed origin
      const preflightAllowed = await fetch(`${base}/api/supply-chains/chain-1/simulations`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type",
        },
      });
      assert.equal(preflightAllowed.status, 204);
      assert.equal(preflightAllowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
      assert.ok(preflightAllowed.headers.get("access-control-allow-methods").includes("POST"));
      assert.ok(preflightAllowed.headers.get("access-control-allow-headers").includes("Content-Type"));

      // Preflight OPTIONS for rejected origin
      const preflightRejected = await fetch(`${base}/api/supply-chains/chain-1/simulations`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://malicious-website.com",
          "Access-Control-Request-Method": "POST",
        },
      });
      assert.equal(preflightRejected.status, 403);
      assert.equal(preflightRejected.headers.get("access-control-allow-origin"), null);
    } finally {
      instance1.closeAllConnections();
      await new Promise((resolve) => instance1.close(resolve));
    }

    // 2. Custom comma-separated origins
    const customApp = createApp({
      supplyChainRepository: { async getAllSupplyChains() { return []; } },
      simulationRepository: {},
      logger: { error() {} },
      corsOrigins: "https://frontend.company.com, https://staging.company.com",
    });
    const instance2 = customApp.listen(0);
    await new Promise((resolve) => instance2.once("listening", resolve));
    try {
      const base = `http://127.0.0.1:${instance2.address().port}`;

      const res1 = await fetch(`${base}/api/health`, {
        headers: { Origin: "https://frontend.company.com" },
      });
      assert.equal(res1.status, 200);
      assert.equal(res1.headers.get("access-control-allow-origin"), "https://frontend.company.com");

      const res2 = await fetch(`${base}/api/health`, {
        headers: { Origin: "https://staging.company.com" },
      });
      assert.equal(res2.status, 200);
      assert.equal(res2.headers.get("access-control-allow-origin"), "https://staging.company.com");

      const res3 = await fetch(`${base}/api/health`, {
        headers: { Origin: "http://localhost:5173" },
      });
      assert.equal(res3.status, 200);
      assert.equal(res3.headers.get("access-control-allow-origin"), null);
    } finally {
      instance2.closeAllConnections();
      await new Promise((resolve) => instance2.close(resolve));
    }
  });
});
