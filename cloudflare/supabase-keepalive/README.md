# CantAlice: health checks independent of repository activity

The Cloudflare Worker `cantalice-supabase-keepalive` runs four times daily at
02:23, 08:23, 14:23 and 20:23 UTC. Its Cron Trigger runs on Cloudflare, without
GitHub Actions, Codex, or a computer left on. GitHub's 60-day repository
inactivity rule does not control this schedule.

Dashboard: https://dash.cloudflare.com/b3497f3b11052e0f41d66be9f113bd12/workers/services/view/cantalice-supabase-keepalive/production

Each run requests one public book ID from the existing `public.livros` table.
This checks real database access with RLS in place. It does not change data,
call paid AI functions, or log keys, book IDs, or private progress. Failed
HTTP, network, credential, and response checks fail the scheduled execution.
Invocation results and a short success message are available in Cloudflare
**Observability**. There is no email alert configured.

The Worker uses the existing account's Workers Free allocation. Four small
requests per day need no paid subscription or add-on. Supabase Free remains
subject to its activity policy; this maintains regular database activity,
without promising an availability SLA or immunity from future policy changes.

## Maintain or recreate

1. In Cloudflare **Workers & Pages**, open this Worker and choose **Edit code**.
   Paste `worker.mjs`, then **Deploy**.
2. In **Settings → Runtime variables and secrets**, configure
   `SUPABASE_ANON_KEY` with CantAlice's existing public anon/publishable key.
   Never supply a service-role key, secret key, or management access token.
   The anon JWT is checked for the `anon` role and this project's reference.
3. In **Settings → Trigger events → Cron triggers**, use
   `23 2,8,14,20 * * *`.
4. In **Domains**, disable the workers.dev and Preview URLs routes. The Worker
   needs no HTTP endpoint. Its HTTP handler also rejects requests without
   accessing Supabase.
5. Keep **Settings → Observability → Logs** enabled. To verify actual scheduled
   execution immediately, temporarily add `* * * * *` as a second Cron Trigger
   and save. Wait for an invocation in **Observability → Live** and confirm
   the database success message, then remove the temporary trigger and save.
   Trigger changes can take up to 15 minutes to propagate.

`wrangler.jsonc` records the same source and schedule for deployment with
Cloudflare's CLI if needed. Keep the public key in a runtime binding rather
than committing credentials. If the project's public key is rotated, update
this binding too.

## Verify locally

```sh
node --test cloudflare/supabase-keepalive/worker.test.mjs
```

The tests cover scheduled execution, privileged/missing-key rejection, HTTP
errors, bad responses, network errors, and HTTP requests that must not query
the database. A live test can call `checkDatabase` with the public key in the
`SUPABASE_ANON_KEY` environment variable.

The GitHub workflow remains as an additional check and a manual resume tool.
If GitHub later disables its schedule for repository inactivity, this
Cloudflare schedule keeps running independently.
