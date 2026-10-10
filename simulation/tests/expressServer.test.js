const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

describe('Express server tests', () => {
  let server;
  let url;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        url = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET / returns status', async () => {
    const res = await fetch(`${url}/`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.message);
  });

  it('GET /api/simulation/sample returns sample dataset', async () => {
    const res = await fetch(`${url}/api/simulation/sample`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.data);
  });

  it('POST /api/simulation/run runs simulation', async () => {
    const res = await fetch(`${url}/api/simulation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.result.status, 'COMPLETED');
  });
});
