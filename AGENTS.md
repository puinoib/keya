# Working on Keya

Keya is a local-first API key manager: a React web app storing encrypted `.keya` files in a user-selected folder. Cloud synchronization belongs to the user's storage provider, not Keya.

## Positioning

- Keya stores API keys and tokens for developers. AI providers are the default focus, not the product boundary: search, scraping, email, payments, cloud, and internal API credentials belong here too.
- Keep copy, presets, and docs consistent with that. Do not describe Keya as AI-only, and do not widen it into a general password manager.

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
| Encryption, byte layout, KDF | `src/core/format/{constants,preamble,container,kdf}.ts`, frozen vector in `src/core/__tests__/container.test.ts` |
| Payload model and validation | `src/core/payload/{types,limits,validate,normalize,serialize}.ts`; the spec is `docs/keya-format.md` (not in git) |
| Derived keys (consent, freshness) | `src/core/fingerprint/index.ts`; vectors in `src/core/__tests__/appendix-c-fingerprints.test.ts` |
| Edits, timestamps, ordering | `src/core/payload/edits.ts` (pure transactions) and `src/app/vault/vault.ts` (who applies them) |
| Save, lock, password change, clone | `src/app/vault/vault.ts`; write matrix and I17 in the spec §3.6 |
| Workspace folder and file access | `src/app/storage/{workspace,browser,platform}.ts` |
| Device-local state | `src/app/storage/local/{state,idb-kv}.ts` (containers, observations, dismissals, grants, prefs, device key) |
| Probe request and interpretation | `src/core/probe/request.ts`, `src/app/probe/{execute,check}.ts`; a generic recipe may only claim `request/ok`, never credential validity |
| Presets | `src/core/presets/{data,classify}.ts`; presets are data, so changing a target invalidates grants |
| Reminders | `src/core/reminders.ts`, `src/core/runtime/*`; dismissals are device-local and bound to a fact fingerprint |
| UI | `src/app/components/*` and `src/app/store/useStore.ts` (the browser binding) |
| Store behaviour and tests | `src/app/store/create-store.ts` is the factory; `useStore.ts` only supplies the real adapters. Tests build a store with in-memory dependencies |
| Screen data | `src/app/state/{view,presentation,providers}.ts`: one derived snapshot over the payload plus device state, and the copy/label rules the screens share. Screens read this; nothing here is written back |
| JSON export | `src/app/lib/export-json.ts` and `docs/export-json.md`; it uses the payload's own field names and never carries device state |
| Deployed response headers or caching | `worker/index.ts`, `wrangler.toml`; the CSP keeps `'wasm-unsafe-eval'` for libsodium and allows user-supplied endpoints in `connect-src` |
| Help content | `src/help/lib/manifest.ts`, `src/help/content/*.md` and help tests |

## Branches and deployment

- `dev` is the integration branch: pushing there runs verification and deploys nothing. `main` deploys to production on every push, after the same verification, so treat any commit on `main` as shipped.
- Promote with a `dev` -> `main` pull request using a merge commit, or `git merge --no-ff dev` locally. Never squash: `dev` must stay an ancestor of `main`.
- `src/routeTree.gen.ts` is committed. CI typechecks before building and fails when the build would change the committed tree, so commit the regenerated file whenever routes change.
- `wrangler.toml` and `worker/index.ts` own the deployed configuration. Read [DEPLOYMENT.md](DEPLOYMENT.md) before changing either: the content security policy and the permissions policy contain entries whose removal breaks unlocking, provider tests, biometrics or clipboard access, and the production hostname is fixed.

## Security and data safety

- Never persist plaintext passwords or encryption keys alongside the secrets they decrypt. The password is discarded once the file key exists; nothing restores an unlocked session, so a refresh requires authentication.
- Saving copies `version`, `kdf_*` and `salt` verbatim and only rotates the nonce. Never regenerate a container field on the save path: there is no password there, and the result would be a file nobody can open.
- Preserve the write queue and `Vault.flush()` lifecycle when changing lock, password or cloning. A failed save keeps the payload dirty and visible; a lock that cannot flush must be cancelled.
- File writes use Web Locks and digest checks. Creating a vault must reject existing filenames; saving must reject detected external changes. These checks do not provide distributed locking against cloud clients.
- Authorize every request by its own `send_fingerprint`. Automatic checks need a persistent grant; plaintext targets can only get single-use approvals. A generic recipe tops out at `request/ok`.
- Bind asynchronous results to the session and binding that produced them; a result for a rotated secret or a changed destination must be discarded, not stored.
- `.keya` is a persistent user format with no migration path: unknown fields and unknown versions are rejected. Changing the payload is a format decision — update `docs/keya-format.md` in the same change.
- Keep real keys and passwords out of logs, tests, screenshots, and commits. Use synthetic fixtures. Never persist provider error text; keep to the controlled `detail_code`.
- Describe actual security limits. Local encryption does not protect an unlocked app from compromised same-origin code, browser extensions, or the operating system.
