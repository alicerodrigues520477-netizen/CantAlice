// Runs on Cloudflare, independently of GitHub Actions and any local computer.
const PROJECT_REF = 'kpdmrcvtqeomxmosjvuf';
const ENDPOINT = `https://${PROJECT_REF}.supabase.co/rest/v1/livros?select=id&limit=1`;

function publicKey(env) {
  const key = env.SUPABASE_ANON_KEY?.trim();
  if (key?.startsWith('sb_publishable_')) return key;
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.role === 'anon' && payload.ref === PROJECT_REF) return key;
  } catch { /* Reject missing, malformed, or privileged credentials. */ }
  throw new Error('Configure the CantAlice public anon/publishable key; never use an admin key.');
}

export async function checkDatabase(env) {
  const response = await fetch(ENDPOINT, {
    headers: { apikey: publicKey(env), 'Cache-Control': 'no-cache' },
    cache: 'no-store',
    // Cloudflare supports manual/follow; reject redirects via the status check.
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(`CantAlice database health check failed: HTTP ${response.status}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0]?.id !== 'string') {
    throw new Error('CantAlice public book catalog returned an unexpected response.');
  }
  // Do not log the key, response body, book ID, or private user progress.
  console.log('CantAlice database health check passed: HTTP 200, public catalog readable.');
}

export default {
  async scheduled(_event, env) {
    // A rejected promise makes failed cron executions visible in Cloudflare.
    await checkDatabase(env);
  },
  fetch() {
    // Scheduled execution only; HTTP visitors cannot trigger database queries.
    return new Response('Scheduled database health check.\n', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  },
};
