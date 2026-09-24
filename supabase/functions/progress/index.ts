// Supabase Edge Function: per-user progress storage for CantAlice.
//
// Auth model: the caller proves ownership of a Spotify account by sending that
// account's access token in the `x-spotify-token` header. We call Spotify /me
// to resolve the user id, then read/write only that user's row using the
// service role (which bypasses RLS — the table is otherwise locked down).
//
// Deploy:  supabase functions deploy progress
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-spotify-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const spotifyToken = req.headers.get('x-spotify-token')
    if (!spotifyToken) return json({ error: 'missing spotify token' }, 401)

    // Resolve & verify the Spotify identity.
    const me = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${spotifyToken}` },
    })
    if (!me.ok) return json({ error: 'invalid spotify token' }, 401)
    const profile = (await me.json()) as { id?: string }
    const userId = profile.id
    if (!userId) return json({ error: 'no user id' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('progress')
        .select('data')
        .eq('spotify_user_id', userId)
        .maybeSingle()
      if (error) {
        // Don't echo internal database errors to the browser.
        console.error('progress select failed:', error.message)
        return json({ error: 'database error' }, 500)
      }
      return json({ data: data?.data ?? null })
    }

    if (req.method === 'POST') {
      // Cap the blob size: a legit library (songs + vocab + history) is tens of
      // KB; anything near the cap is abuse or a client bug, not real progress.
      const raw = await req.text().catch(() => '')
      if (raw.length > 1_000_000) return json({ error: 'payload too large' }, 413)
      let body: { data?: unknown } = {}
      try {
        body = JSON.parse(raw) as { data?: unknown }
      } catch {
        /* treated as empty */
      }
      const { error } = await supabase.from('progress').upsert({
        spotify_user_id: userId,
        data: body.data ?? {},
        updated_at: new Date().toISOString(),
      })
      if (error) {
        console.error('progress upsert failed:', error.message)
        return json({ error: 'database error' }, 500)
      }
      return json({ ok: true })
    }

    return json({ error: 'method not allowed' }, 405)
  } catch (e) {
    console.error('progress error:', e)
    return json({ error: 'internal error' }, 500)
  }
})
