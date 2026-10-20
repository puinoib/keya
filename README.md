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

Chrome or Edge is recommended for folder-based use. Browsers without the directory picker have a limited manual file-open/download fallback, not the full workspace workflow. File writing requires Web Locks support. WebAuthn PRF availability depends on both the browser and authenticator. Browser security APIs require a secure context such as HTTPS or localhost.

## Security and persistence

- Vault payloads use **Argon2id** and **XChaCha20-Poly1305** through libsodium. The current format is implemented in [`src/core/schema.ts`](src/core/schema.ts); see the [security article](src/help/content/security.md) for details and limitations.
- Passwords are not persisted for session restoration. **Reloading requires unlocking again** with the master password or enrolled PRF authentication.
- Biometric enrollment requires PRF; there is no stored-key fallback for unsupported authenticators.
- Edits are auto-saved after a debounce. Locking and switching flush pending changes. If saving fails, locking is refused to preserve unsaved data; **the vault remains unlocked** until the problem is resolved.
- Writes are coordinated between same-origin tabs and checked for external file changes. Cloud clients and other devices do not share that lock. Use one device at a time per vault, and keep independent backups.
- API tests send the key to its configured endpoint. Automatic testing is optional and disabled by default. Provider requests may incur charges; an endpoint's response is not a universal proof of key validity.
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

`wrangler.toml` configures Cloudflare static assets from `dist/` with SPA fallback. Service Worker/offline support is not currently implemented.

## User guides

- [Quick Start](src/help/content/quick-start.md)
- [Security](src/help/content/security.md)
- [Backup & Restore](src/help/content/backup.md)
- [Inbox](src/help/content/inbox.md)
- [FAQ](src/help/content/faq.md)

These articles are also available in the running app at `/docs`.

## License

[MIT](LICENSE)
