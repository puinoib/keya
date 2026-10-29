# Keya

A local-first API credential manager for developers. Keep API keys and tokens in encrypted `.keya` files, organize them into vaults and groups, and run manual checks against your configured providers.

AI providers are the default focus, but Keya is not limited to AI. Search, scraping, email, payments, cloud, and internal API credentials fit the same model. Any service can be added as a custom provider.

Keya is a static web application with no application backend or account system. You choose where vault files live; synchronization is handled by your own cloud drive.

## Features

- Multiple password-protected vaults in a workspace folder
- Key search, ordered groups, provider/result/expiry filters, and archiving
- Preset AI and developer-platform providers, plus custom providers for any API service with an optional check recipe
- Manual **Test key** checks with a one-shot destination approval; results distinguish **Verified** from **Reachable**
- Provider allowance card where the provider exposes a readable metadata endpoint
- Inbox for due or expired keys and rejected checks; housekeeping offers checks this device has not run lately without treating them as failures
- PRF-based WebAuthn biometric unlock where supported
- Auto lock, configurable clipboard clearing, customizable keyboard shortcuts, and light/dark themes
- Encrypted `.keya` export and plaintext JSON export; import is not available
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

- Vault payloads use **Argon2id** and **XChaCha20-Poly1305** through libsodium. The format lives in [`src/core/format/`](src/core/format) and the payload model in [`src/core/payload/`](src/core/payload); see the [security article](src/help/content/security.md) for details and limitations.
- Passwords are not persisted for session restoration. **Reloading requires unlocking again** with the master password or enrolled PRF authentication.
- Biometric enrollment requires PRF; there is no stored-key fallback for unsupported authenticators.
- Edits are auto-saved after a debounce. Locking and switching flush pending changes. If saving fails, locking is refused to preserve unsaved data; **the vault remains unlocked** until the problem is resolved.
- Writes are coordinated between same-origin tabs and checked for external file changes. Cloud clients and other devices do not share that lock. Use one device at a time per vault, and keep independent backups.
- **Test key** sends one `GET` request to the provider's check target, with the credential in the slot its recipe names. Every test needs a fresh approval that shows the exact destination; nothing is persisted that could act as a standing permission. There is no automatic or scheduled checking.
- A custom provider uses the check recipe configured in Settings → Providers. With no recipe, Keya sends nothing and the key cannot be tested. A provider that blocks browser requests fails with a network error, which is not proof the credential is invalid.
- A successful response is **Reachable** unless the endpoint requires the credential, in which case it can be **Verified**. Custom or metered endpoints may incur charges, so prefer a cheap metadata endpoint where the provider offers one.
- Usage lookups read the provider's own allowance metadata on demand. The address is shown before the key is sent, and plain `http:` endpoints are refused. The figures are cached for this tab only, never written to the vault.
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

Production is `https://keya.one`, served by a Cloudflare Worker from the static build in `dist/`. The build needs only Node and pnpm; there are no runtime secrets. There is one branch, `main`, and no CI: pushing deploys nothing, and shipping is an explicit `wrangler deploy` from a machine with a Cloudflare login. `worker/index.ts` adds response headers and asset caching around the static assets.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the pre-deploy checklist, the credentials Wrangler needs, and the constraints the deployed configuration depends on.

## User guides

- [Quick Start](src/help/content/quick-start.md)
- [Keys & Groups](src/help/content/keys.md)
- [Checks & Usage](src/help/content/checks.md)
- [Providers](src/help/content/providers.md)
- [Inbox](src/help/content/inbox.md)
- [Vaults, Folders & Export](src/help/content/vaults.md)
- [Settings & Shortcuts](src/help/content/settings.md)
- [Security](src/help/content/security.md)
- [Backup & Restore](src/help/content/backup.md)
- [FAQ](src/help/content/faq.md)

These articles are also available in the running app at `/docs`.

## Design docs

- [`docs/keya-format.md`](docs/keya-format.md) — the `.keya` bytes, payload model, validation and fingerprints, plus a one-page overview in appendix D.
- [`docs/keya-runtime.md`](docs/keya-runtime.md) — what the app does with that data: probing, reminders, device state, save/lock, biometrics.

## License

[MIT](LICENSE)
