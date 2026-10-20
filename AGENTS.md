# Working on Keya

Keya is a local-first API key manager: a React web app storing encrypted `.keya` files in a user-selected folder. Cloud synchronization belongs to the user's storage provider, not Keya.

## Conventions

- Respond in Chinese; write code comments in English.
- Keep changes focused. Reuse existing modules and feature-based component organization.
- Use pnpm, Biome (not ESLint), and Vitest. Scripts and dependency versions are authoritative in `package.json`; formatting rules live in `biome.json`.
- Use `python3` when Python is needed.
- Add regression tests alongside source in `__tests__/`. Pass explicit dates or mock the clock for time-dependent behavior.
- Run relevant tests, `pnpm typecheck`, and `pnpm build` after code changes. Check changed files with Biome; report pre-existing failures separately.

## Architecture boundaries

- `src/core/`: portable data model, validation, cryptography, file format, and alert rules. No imports from the application layer or browser-specific storage/UI APIs.
- `src/app/`: UI, Zustand state, browser storage, WebAuthn, and provider API testing. May import core.
- `src/components/ui/`: shared UI primitives.
- `src/routes/`: TanStack file-based routes. `src/routeTree.gen.ts` is generated; change route source files instead.
- `src/help/content/`: user-facing Markdown loaded by the app at `/docs`. Keep it aligned with behavior changes.

## Read the implementation at the relevant boundary

| Task | Starting points |
|---|---|
| Encryption or `.keya` format | `src/core/crypto.ts`, `src/core/schema.ts`, `src/core/validators.ts` and core tests |
| Save, lock, switch, import, or password change | `src/app/store/useStore.ts`, `src/app/lib/storage.ts`, `src/app/components/layout/TopBar.tsx` |
| Authentication or refresh behavior | `src/app/lib/session.ts`, `src/app/lib/biometric.ts`, `src/main.tsx`, `src/app/hooks/useAutoLock.ts`, `src/routes/_authenticated.tsx` |
| Inbox rules | `src/core/inbox.ts`, `src/core/key-status.ts` and their tests |
| Provider requests | `src/app/lib/api-tester.ts`; distinguish connectivity from credential validity |
| Deployed response headers or caching | `worker/index.ts`, `wrangler.toml`; the CSP keeps `'wasm-unsafe-eval'` for libsodium and allows user-supplied endpoints in `connect-src` |
| Help content | `src/help/lib/manifest.ts`, `src/help/content/*.md` and help tests |

## Branches and deployment

- `dev` is the integration branch: pushing there runs verification and deploys nothing. `main` deploys to production (`https://keya.one`) on every push, after the same verification, so treat any commit on `main` as shipped.
- Promote with a `dev` → `main` pull request using a merge commit, or `git merge --no-ff dev` locally. Squash and rebase merges are disabled. `dev` must stay an ancestor of `main`.
- `src/routeTree.gen.ts` is committed. CI typechecks before building so a stale route tree fails instead of being regenerated silently, and then fails if the build would change the committed file. Commit the regenerated file whenever routes change.
- `wrangler.toml` owns deployment: `dist/` static assets, SPA fallback, `workers_dev = false`, and the `keya.one` custom domain. The Worker, the zone, and the custom domain must live in one Cloudflare account.
- `worker/index.ts` is the only server-side code. It exists to attach security and caching headers that the assets layer cannot set, and `run_worker_first = true` sends static files through it. Keep the comments there accurate when changing the policy: the CSP needs `'wasm-unsafe-eval'` for libsodium, and the permissions policy needs WebAuthn and clipboard entries.
- `keya.one` is a permanent hostname. Biometric unlock uses WebAuthn with `rpId = location.hostname`, so changing it invalidates every credential users registered. Treat that like a `.keya` format change: a compatibility decision, not a configuration tweak.

## Security and data safety

- Never persist plaintext passwords or encryption keys alongside the secrets they decrypt. Session storage does not restore an unlocked session; refresh requires authentication.
- Biometric unlock requires WebAuthn PRF. Unsupported or failed PRF must not downgrade to a stored AES key.
- Preserve the save queue and `flushSave()` lifecycle when changing lock, switch, import, or password updates. Saving failure must remain visible and must not silently discard unsaved data.
- File writes use Web Locks and revision checks. Creating a vault must reject existing filenames; saving must reject detected external changes. These checks do not provide distributed locking against cloud clients.
- Bind asynchronous results to the vault that initiated them; do not apply stale results to the currently selected vault.
- Treat `.keya` as a persistent user format: assess compatibility and migration before changing serialization or validation. The implementation, not old documentation, defines the current format.
- Keep real keys and passwords out of logs, tests, screenshots, and commits. Use synthetic fixtures. JSON exports contain plaintext secrets.
- Describe actual security limits. Local encryption does not protect an unlocked app from compromised same-origin code, browser extensions, or the operating system.
