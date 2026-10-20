# Keya

A local-first API key manager for AI developers. Keep keys in encrypted `.keya` files, organize them into vaults and groups, and test connectivity to your configured providers.

Keya is a static web application with no application backend or account system. You choose where vault files live; synchronization is handled by your own cloud drive.

## Features

- Multiple password-protected vaults in a workspace folder
- Key search, groups, provider filters, and expiry tracking
- Manual and optional automatic API connectivity tests
- Inbox alerts for expiry, connection failures, insecure endpoints, and missing or stale tests
- Optional clipboard detection when adding keys
- PRF-based WebAuthn biometric unlock where supported
- Inactivity locking, keyboard shortcuts, and light/dark themes
- Encrypted `.keya` import/export and plaintext JSON import/export
- Built-in help at `/docs`

## Run locally

Use Node.js **20.19+ within Node 20, or 22.12+**, and pnpm (Vite 8's Node requirement).

```bash
git clone https://github.com/puinoib/keya.git
cd keya
pnpm install
pnpm dev
```

Open the URL printed by Vite. From the landing page, start the app, choose a dedicated workspace folder, and create a vault with a strong, unique master password.

Chrome or Edge is recommended for folder-based use. Browsers without the directory picker have a limited manual `.keya` open/export fallback, not the full workspace workflow; edits are not auto-downloaded. File writing requires Web Locks support. WebAuthn PRF availability depends on both the browser and authenticator. Browser security APIs require a secure context such as HTTPS or localhost.

## Security and persistence

- Vault payloads use **Argon2id** and **XChaCha20-Poly1305** through libsodium. The current format is implemented in [`src/core/schema.ts`](src/core/schema.ts); see the [security article](src/help/content/security.md) for details and limitations.
- Passwords are not persisted for session restoration. **Reloading requires unlocking again** with the master password or enrolled PRF authentication.
- Biometric enrollment requires PRF; there is no stored-key fallback for unsupported authenticators.
- Edits are auto-saved after a debounce. Locking and switching flush pending changes. If saving fails, locking is refused to preserve unsaved data; **the vault remains unlocked** until the problem is resolved.
- Writes are coordinated between same-origin tabs and checked for external file changes. Cloud clients and other devices do not share that lock. Use one device at a time per vault, and keep independent backups.
- API tests send the key to its configured endpoint. Automatic testing is optional and disabled by default. Tests use provider metadata endpoints where available; custom or metered endpoints may incur charges. A successful HTTP response is not universal proof of key validity.
- JSON exports are **unencrypted**. Protect or delete them after use.

There is no password-reset service. Keep the master password in a password manager. Encryption protects stored vault contents, not an unlocked app running on a compromised browser or device. Do not treat this project as independently security-audited.

## Development

React · TypeScript · Vite · TanStack Router · Zustand · Tailwind CSS · libsodium · Vitest · Biome

```bash
pnpm dev          # Development server
pnpm typecheck    # TypeScript checks
pnpm test         # Unit tests
pnpm test:watch   # Watch tests
pnpm lint         # Biome checks
pnpm lint:fix     # Apply Biome fixes
pnpm build        # Build to dist/
pnpm preview      # Preview production build
```

`pnpm check` also applies Biome changes; it is not a read-only check.

| Location | Purpose |
|---|---|
| `src/core/` | Portable data model, encryption, serialization, alert rules |
| `src/app/` | Application UI, browser integrations, state and save lifecycle |
| `src/components/ui/` | Shared UI components |
| `src/routes/` | File-based routes; generated route tree is not edited manually |
| `src/help/` | In-app documentation, rendering and search |

See [AGENTS.md](AGENTS.md) for repository conventions. For file-format changes, inspect existing serialization tests and plan compatibility before modifying the format.

## Deployment

Production is `https://keya.one`, served by a Cloudflare Worker configured in `wrangler.toml` from the static build in `dist/`. The build needs only Node and pnpm; there are no runtime secrets and no application server.

`worker/index.ts` is the only server-side code. It forwards every request to the static assets binding and adds response headers the assets layer cannot express: a content security policy, clickjacking and MIME-sniffing protection, HSTS, a permissions policy, and long-lived caching for the content-hashed files under `/assets/`. `run_worker_first = true` is what makes those headers apply to static files as well; without it Cloudflare serves matching assets before the Worker runs.

| Branch | Purpose |
|---|---|
| `dev` | Integration branch. Push here for CI checks; nothing is deployed. |
| `main` | Production. Every push verifies, then deploys. |

Promote work with a `dev` → `main` pull request using **Create a merge commit**, or merge locally:

```bash
git checkout main
git merge --no-ff dev
git push origin main
```

Do not squash. `dev` must stay an ancestor of `main`, otherwise every later promotion re-introduces changes that already landed.

`.github/workflows/ci.yml` runs `build` → `typecheck` → `test` on `dev` pushes and on pull requests to `main`. The build runs first because the TanStack Router plugin generates the gitignored `src/routeTree.gen.ts`, and `typecheck` fails on a clean checkout without it. `.github/workflows/deploy.yml` calls that same verification, downloads the artifact it produced, and deploys that exact build.

Secrets required by the deploy job:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token from the "Edit Cloudflare Workers" template, scoped to the account and zone that host `keya.one` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID for the same account |

The Worker, the `keya.one` zone, and its custom domain must all be in one Cloudflare account; Cloudflare rejects cross-account custom domains.

Local checks before pushing:

```bash
pnpm cf:deploy:dry   # build, then validate the Wrangler config without uploading
pnpm cf:deploy       # build and deploy from your machine, using your own Wrangler login
```

Use the `cf:` prefix rather than a bare `deploy` script name: `pnpm deploy` resolves to pnpm's own built-in command, not a script.

### Deployment constraints

- **The content security policy is not cosmetic.** `script-src` must keep `'wasm-unsafe-eval'`: libsodium-wrappers-sumo compiles WebAssembly at runtime, so removing it breaks unlocking and encryption. `connect-src` cannot be narrowed to known hosts because provider connectivity tests call endpoints the user supplies. `permissions-policy` must keep the `publickey-credentials-*` and `clipboard-*` entries for biometric unlock and key copying.
- **`keya.one` is permanent.** Biometric unlock uses WebAuthn with `rpId = location.hostname`, so every registered credential is bound to the exact hostname. Serving production from another hostname invalidates all of them.
- **No second origin.** `workers_dev = false` keeps the app off `*.workers.dev`. IndexedDB (which holds the vault directory handle), sessionStorage and WebAuthn credentials are all per-origin.
- **Rollback.** Cloudflare keeps previous Worker versions for an immediate rollback, but Git still holds the bad commit, so the next `main` push would ship it again. Follow an emergency rollback with `git revert` and a normal promotion.
- **Zone settings still live outside the repository.** Always Use HTTPS and the DNS/certificate binding for the custom domain are Cloudflare dashboard state. Recreating the zone means setting them again.
- Service Worker/offline support is not currently implemented.

## User guides

- [Quick Start](src/help/content/quick-start.md)
- [Security](src/help/content/security.md)
- [Backup & Restore](src/help/content/backup.md)
- [Inbox](src/help/content/inbox.md)
- [FAQ](src/help/content/faq.md)

These articles are also available in the running app at `/docs`.

## License

[MIT](LICENSE)
