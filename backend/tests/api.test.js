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
    async loadSimulationInput(id) {
      if (id !== "chain-1") throw new Error("Supply chain not found");
      return { network, inventory: [], orders: [] };
    },
  };
  const simulationRepository = {
    async createScenario(scenario) {
      state.scenarios.push(scenario);
      return { id: "scenario-1" };
    },
    async createRun(run) {
      state.runs.set(run.id, { ...run, status: "RUNNING" });
      return state.runs.get(run.id);
    },
    async saveRunResult(runId, result) {
      state.savedResults.push({ runId, result });
      state.runs.set(runId, {
        ...state.runs.get(runId),
        status: result.status,
        metrics: { ...result.metrics, finalState: result.finalState },
        events: result.events,
      });
    },
    async markRunFailed(runId) {
      state.runs.set(runId, { ...state.runs.get(runId), status: "FAILED" });
    },
    async getRun(id) {
      return state.runs.get(id) || null;
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
});
