"""Resume the existing CantAlice project, without modifying data or billing."""

import json
import os
import time
import urllib.error
import urllib.request

PROJECT_REF = 'kpdmrcvtqeomxmosjvuf'
API_URL = f'https://api.supabase.com/v1/projects/{PROJECT_REF}'


def request(path='', payload=None):
    token = os.environ.get('SUPABASE_ACCESS_TOKEN', '').strip()
    if not token:
        raise RuntimeError('SUPABASE_ACCESS_TOKEN is missing.')
    req = urllib.request.Request(
        API_URL + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        # Never log credentials, project configuration, or arbitrary API bodies.
        raise RuntimeError(f'Supabase Management API returned HTTP {exc.code}.') from None
    except urllib.error.URLError:
        raise RuntimeError('Supabase Management API network request failed.') from None


def main():
    project = request()
    if project.get('id', project.get('ref')) != PROJECT_REF:
        raise RuntimeError('Unexpected project identity; refusing to resume.')
    status = project.get('status')
    print(f'CantAlice project {PROJECT_REF}: {status}', flush=True)
    if status == 'INACTIVE':
        request('/restore', {})
        print('Resume requested for the existing paused project.', flush=True)
    elif status not in {'ACTIVE_HEALTHY', 'RESTORING', 'COMING_UP'}:
        raise RuntimeError(f'Unexpected project status {status}; inspect the dashboard.')

    for attempt in range(60):
        status = request().get('status')
        print(f'Health check {attempt + 1}: {status}', flush=True)
        if status == 'ACTIVE_HEALTHY':
            break
        if status not in {'RESTORING', 'COMING_UP', 'INACTIVE', 'ACTIVE_UNHEALTHY'}:
            raise RuntimeError(f'Resume did not complete: {status}')
        time.sleep(10)
    else:
        raise RuntimeError('Timed out waiting for ACTIVE_HEALTHY.')

    result = request('/database/query/read-only', {'query': 'select 1 as healthy'})
    if result != [{'healthy': 1}]:
        raise RuntimeError('Unexpected database health query result.')
    print('Read-only database query passed: SELECT 1 = 1.', flush=True)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as out:
            out.write(f'### CantAlice project restored/verified\n\n'
                      f'Project `{PROJECT_REF}` is `ACTIVE_HEALTHY`; read-only SQL passed.\n')


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as exc:
        raise SystemExit(f'::error::{exc}')
