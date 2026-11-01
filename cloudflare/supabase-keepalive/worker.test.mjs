import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { checkDatabase } from './worker.mjs';

const key = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: 'anon', ref: 'kpdmrcvtqeomxmosjvuf' }))}.test`;
const env = { SUPABASE_ANON_KEY: key };

test('scheduled execution reads the fixed public catalog with no cache', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (...args) => {
    requests.push(args);
    return Response.json([{ id: 'public-book-id' }]);
  });
  await worker.scheduled({}, env);
  assert.equal(requests.length, 1);
  const [url, options] = requests[0];
  assert.equal(url, 'https://kpdmrcvtqeomxmosjvuf.supabase.co/rest/v1/livros?select=id&limit=1');
  assert.equal(options.headers.apikey, key);
  assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'error');
});

test('missing and privileged credentials never reach the network', async (t) => {
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected request'); });
  for (const badKey of ['', 'sb_secret_admin', `e30.${btoa(JSON.stringify({ role: 'service_role' }))}.sig`]) {
    await assert.rejects(checkDatabase({ SUPABASE_ANON_KEY: badKey }), /never use an admin key/);
  }
  assert.equal(network.mock.callCount(), 0);
});

test('HTTP failures propagate as failed scheduled executions', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }));
  await assert.rejects(worker.scheduled({}, env), /HTTP 503/);
});

test('malformed or empty catalog responses fail', async (t) => {
  for (const body of [[], {}, [{ unexpected: true }]]) {
    const network = t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(checkDatabase(env), /unexpected response/);
    network.mock.restore();
  }
});

test('network failures propagate', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network unavailable'); });
  await assert.rejects(checkDatabase(env), /network unavailable/);
});

test('HTTP visitors cannot run the database check', async (t) => {
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected request'); });
  assert.equal(worker.fetch().status, 404);
  assert.equal(network.mock.callCount(), 0);
});
