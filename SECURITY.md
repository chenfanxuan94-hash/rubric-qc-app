# Security & dependency notes

## Secrets / API keys
- Real secrets live ONLY in environment variables, never in the repo:
  - **Vercel** → Project → Settings → Environment Variables (this powers the live site)
  - **Local dev** → `.env.local` on your machine (gitignored, never committed)
- `.env`, `.env.*` are gitignored; only `.env.local.example` (a no-secret template) is tracked.
- **Rotating a key:** update it in Vercel + redeploy, update local `.env.local`, then **revoke the OLD key in console.anthropic.com** — replacing the value does not disable the old key.

## Dependencies (supply-chain)
- All dependencies are **pinned to exact versions** (no `^` ranges) so nothing drifts to an
  unexpected (possibly compromised) release.
- `package-lock.json` is committed; it carries **sha512 integrity hashes** for every package.
- **Install with `npm ci`** (not `npm install`) for deploys/CI — it installs exactly what the
  lockfile specifies and fails if anything doesn't match the integrity hash.
- `npm audit` is clean (0 vulnerabilities) as of this version. Re-run `npm audit` periodically.
- `overrides.postcss` forces a patched postcss (build-time CSS tool) regardless of transitive specs.

## Current pinned versions
- next 15.5.19, react 18.3.1, react-dom 18.3.1
- @anthropic-ai/sdk 0.69.0, @supabase/supabase-js 2.107.0
- override: postcss 8.5.15
