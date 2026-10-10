/**
 * @file expressServer.test.js
 * Unit test for Express simulation API endpoints.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

describe('Express Simulation API Routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET / should return friendly welcome message', async () => {
    const res = await fetch(`${baseUrl}/`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.status, 'Running');
    assert.ok(data.endpoints);
  });

  it('GET /api/simulation/sample should return sample dataset', async () => {
    const res = await fetch(`${baseUrl}/api/simulation/sample`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.ok(json.data);
    assert.ok(json.data.network.nodes.length > 0);
  });

  it('POST /api/simulation/run should execute simulation and return results', async () => {
    const res = await fetch(`${baseUrl}/api/simulation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // uses sample data
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.result.status, 'COMPLETED');
    assert.ok(json.result.metrics);
  });

  it('POST /api/simulation/graph/reachability should test node connectivity', async () => {
    const res = await fetch(`${baseUrl}/api/simulation/graph/reachability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromNodeId: 'sup-1',
        toNodeId: 'ret-1',
      }),
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.isReachable, true);
  });
});
