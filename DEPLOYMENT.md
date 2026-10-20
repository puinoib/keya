# Deployment

Keya is a static site. `dist/` is uploaded to Cloudflare Workers static assets and served at `https://keya.one` by `worker/index.ts`, which wraps every response to add security and caching headers.

This file records how the deployed environment is wired. It describes the operator side, including settings that live in the Cloudflare dashboard and cannot be recovered from the repository.

## Pipeline

| Branch | Behaviour |
|---|---|
| `dev` | CI verifies. Nothing deploys. |
| `main` | CI verifies, then deploys to production. |

Promote work with a `dev` → `main` pull request using **Create a merge commit**, or merge locally:

```bash
git checkout main
git merge --no-ff dev
git push origin main
```

Squash and rebase merges are disabled on the repository. `dev` must stay an ancestor of `main`; squashing would make every later promotion re-introduce changes that already landed. After a promotion, bring `dev` back in line with `git merge --ff-only origin/main`.

Both promotion paths converge on one gate, which always runs on the commit about to ship:

- `.github/workflows/ci.yml` — `typecheck` → `test` → `build`. Typecheck runs before the build so a route change that was not committed with its regenerated `src/routeTree.gen.ts` fails, and the build step then fails when regenerating the tree would change the committed copy. Triggers on `dev` pushes and on pull requests to `main`.
- `.github/workflows/deploy.yml` — calls the same verification, downloads the artifact it produced, and deploys those exact bytes, so what ships is what was verified.

## Setup

Repository secrets, used only by the deploy job:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token from the "Edit Cloudflare Workers" template, scoped to the account and zone that host the site |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID for the same account |

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

## Constraints

- **The content security policy is load-bearing.** `script-src` must keep `'wasm-unsafe-eval'` because libsodium-wrappers-sumo compiles WebAssembly at runtime; without it unlocking and encryption fail. `connect-src` cannot be narrowed to known hosts because provider connectivity tests call endpoints the user supplies. `permissions-policy` must keep the `publickey-credentials-*` and `clipboard-*` entries for biometric unlock and key copying. `font-src 'self'` only permits same-origin font files, so `vite.config.ts` keeps fonts out of Vite's data: URI inlining; inlined subsets would be blocked and log a CSP violation on every load.
- **The production hostname is permanent.** Biometric unlock uses WebAuthn with `rpId = location.hostname`, so every registered credential is bound to the exact hostname. Serving production from a different hostname invalidates all of them.
- **There is no second origin.** `workers_dev = false` keeps the app off `*.workers.dev`. IndexedDB (which holds the vault directory handle), sessionStorage and WebAuthn credentials are all per-origin.
- **`run_worker_first = true` is required.** Without it Cloudflare serves matching static files before the Worker runs, and the headers never reach them.

## Version traceability

Each deploy is tagged with the commit it came from. Cloudflare records it in the version annotations, visible under Workers & Pages → `keya` → Deployments:

```
workers/tag     <full commit SHA>
workers/message main@<full commit SHA>
```

## Rollback

Cloudflare keeps previous Worker versions. A dashboard rollback or `wrangler rollback` restores service in seconds, but Git still holds the bad commit, so the next `main` push ships it again. Treat a rollback as temporary and follow it with `git revert` and a normal promotion.
