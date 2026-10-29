# Deployment

Keya is a static site. `dist/` is uploaded to Cloudflare Workers static assets and served at `https://keya.one` by `worker/index.ts`, which wraps every response to add security and caching headers.

This file records how the deployed environment is wired. It describes the operator side, including settings that live in the Cloudflare dashboard and cannot be recovered from the repository.

## Pipeline

Deployment runs from a developer machine. The repository no longer carries GitHub Actions workflows, so a push verifies nothing and deploys nothing; the only thing that ships is an explicit `wrangler deploy` (below).

There is one branch: `main`. Work is committed to it directly, and nothing deploys on a push — the deploy is the explicit command below, run from a clean `main` checkout. There is no `dev` branch, no promotion merge and no branch ancestry to preserve.

Because no CI gate runs, the gate is a checklist that must pass on the commit about to ship, from a clean tree:

```bash
pnpm typecheck   # tsc -b
pnpm test        # vitest run
pnpm lint        # biome check
pnpm build       # vite build, which also regenerates src/routeTree.gen.ts
git status --short   # must be empty before deploying
```

`src/routeTree.gen.ts` is committed. The build rewrites it, so a route change that was not committed shows up as a dirty file after `pnpm build`; commit it before deploying. Typecheck runs before the build for the same reason: a stale generated tree fails there first.

## Setup

Wrangler authenticates as the operator: `wrangler login`, or `CLOUDFLARE_API_TOKEN` in the deploying shell. There are no repository secrets, because no CI job runs.

| Credential | Value |
|---|---|
| Wrangler login, or `CLOUDFLARE_API_TOKEN` | Token from the "Edit Cloudflare Workers" template, scoped to the account and zone that host the site |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID for the same account, when the credential can see more than one |

The Worker, the zone, and the custom domain must all live in one Cloudflare account. Cloudflare rejects cross-account custom domains with error 1014, and `workers.dev` cannot be used as a cross-account CNAME target either.

The first deploy creates the apex DNS record and issues the certificate, which takes minutes.

### Dashboard state not in this repository

These are zone settings. Recreating the zone means setting them again:

- **Always Use HTTPS** enabled, so plain HTTP redirects to HTTPS.
- The custom domain binding for the zone apex. It is declared in `wrangler.toml` and created by Wrangler on deploy, but it is owned by the zone.
- **Cloudflare Web Analytics** (RUM). Cloudflare injects its beacon into HTML responses at the edge when this is enabled for the zone. It is not part of `dist/` and no code in this repository adds it; the content security policy allows it so browsers stay quiet. Disable the zone feature, then drop `static.cloudflareinsights.com` and `cloudflareinsights.com` from the policy.

## Local commands

```bash
pnpm cf:deploy:dry   # build, then validate the Wrangler config without uploading
pnpm cf:deploy       # build and deploy from your machine, using your own Wrangler login
```

The `cf:` prefix is deliberate: `pnpm deploy` resolves to pnpm's own built-in command, not a script.

Neither script tags the version. To keep "which commit is live" answerable, deploy the production build with the tag and message attached (run from a clean `main`):

```bash
pnpm build
npx wrangler deploy \
  --tag "$(git rev-parse HEAD)" \
  --message "main@$(git rev-parse HEAD)"
```

## Constraints

- **The content security policy is load-bearing.** `script-src` must keep `'wasm-unsafe-eval'` because libsodium-wrappers-sumo compiles WebAssembly at runtime; without it unlocking and encryption fail. `connect-src` cannot be narrowed to known hosts because provider connectivity tests call endpoints the user supplies. `permissions-policy` must keep the `publickey-credentials-*` and `clipboard-*` entries for biometric unlock and key copying. `font-src 'self'` only permits same-origin font files, so `vite.config.ts` keeps fonts out of Vite's data: URI inlining; inlined subsets would be blocked and log a CSP violation on every load.
- **The production hostname is permanent.** Biometric unlock uses WebAuthn with `rpId = location.hostname`, so every registered credential is bound to the exact hostname. Serving production from a different hostname invalidates all of them.
- **There is no second origin.** `workers_dev = false` keeps the app off `*.workers.dev`. IndexedDB (which holds the vault directory handle), sessionStorage and WebAuthn credentials are all per-origin.
- **`run_worker_first = true` is required.** Without it Cloudflare serves matching static files before the Worker runs, and the headers never reach them.

## Version traceability

Each deploy is tagged with the commit it came from, via `--tag`/`--message` in the command above. Cloudflare records it in the version annotations, visible under Workers & Pages → `keya` → Deployments:

```
workers/tag     <full commit SHA>
workers/message main@<full commit SHA>
```

A deploy run without those flags uploads the same bytes but leaves the version unidentifiable, so treat the flags as part of the deploy, not as decoration.

## Rollback

Cloudflare keeps previous Worker versions. A dashboard rollback or `wrangler rollback` restores service in seconds, but Git still holds the bad commit, so the next deploy from a checkout that contains it ships it again. Treat a rollback as temporary and follow it with `git revert` and a fresh deploy.
