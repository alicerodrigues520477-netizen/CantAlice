#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo '::error::SUPABASE_URL and SUPABASE_ANON_KEY must be configured.'
  exit 1
fi

# Catch credentials accidentally pointing at a different project.
if [[ "${SUPABASE_URL%/}" != 'https://kpdmrcvtqeomxmosjvuf.supabase.co' ]]; then
  echo '::error::SUPABASE_URL does not point to the CantAlice project.'
  exit 1
fi

# RLS remains enabled. Discard the response; no user progress enters CI logs.
# Fail on HTTP errors as well as DNS/network errors, with bounded retries.
curl --fail --silent --show-error \
  --connect-timeout 10 --max-time 30 \
  --retry 3 --retry-delay 5 --retry-all-errors \
  --output /dev/null \
  "${SUPABASE_URL%/}/rest/v1/progress?select=spotify_user_id&limit=1" \
  --header "apikey: $SUPABASE_ANON_KEY" \
  --write-out 'Supabase REST database check: HTTP %{http_code}\n'

echo '### Supabase REST database check passed' >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
