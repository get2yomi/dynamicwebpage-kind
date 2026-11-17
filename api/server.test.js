// Basic tests run by CI (npm test). They run WITHOUT MySQL and check the API degrades gracefully.
const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('./server');

test('API works without MySQL', async (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const probe = await fetch(`${base}/healthz`);
  assert.strictEqual(probe.status, 200);

  const health = await (await fetch(`${base}/api/health`)).json();
  assert.strictEqual(health.database, 'not configured');

  const sub = await fetch(`${base}/api/subscribers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com' }),
  });
  assert.strictEqual(sub.status, 503);
});
