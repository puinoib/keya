# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Keya** is a secure API key management app for AI developers. Encrypted local `.keya` files, multi-vault support, biometric auth, API connectivity testing. Zero backend — all data synced via user's cloud storage (iCloud, Nutstore, Dropbox).

Encryption: Argon2id KDF + XChaCha20-Poly1305 via libsodium.

## Development Commands

```bash
pnpm dev              # Start dev server (http://localhost:5173)
pnpm build            # Production build
pnpm typecheck        # TypeScript type checking (tsc -b)
pnpm test             # Run tests once
pnpm test:watch       # Run tests in watch mode
pnpm vitest run src/core/__tests__/database.test.ts  # Run single test file
pnpm vitest run -t "test name"                       # Run tests matching name
pnpm lint             # Biome check
pnpm lint:fix         # Biome fix
pnpm format           # Biome format
pnpm check            # Biome check + format combined
```

## Tech Stack

React 19 · TypeScript ~6.0 · Vite 8 · TanStack Router (file-based) · Zustand 5 · Tailwind CSS 4 · libsodium-wrappers-sumo · React Hook Form + Zod 4 · Vitest 4 · Biome 2 · Phosphor Icons · Sonner

Path alias: `@` → `./src` (configured in vite.config.ts and tsconfig.app.json)

## Architecture

### Layer Dependency Rule

```
src/core/ → pure business logic, zero UI/browser dependencies, can become @keya/core npm package
src/app/  → UI + app logic, imports from core but NOT vice versa
```

`app/` → `core/` ✅ | `core/` → `app/` ❌

### Workspace States (useStore)

Three states: `welcome` (no vault) → `locked` (session exists, vault locked) → `unlocked` (vault decrypted).

Check: `useStore.getState().workspaceState`

Auto-save: state mutations trigger `scheduleSave()` with 500ms debounce → `FileStorage.saveVault()`.

### Multi-Vault

User selects workspace folder via `showDirectoryPicker()`. Multiple `.keya` files per folder. IndexedDB caches vault metadata without decryption.

```typescript
await FileStorage.setupWorkspace();
const files = await FileStorage.listVaultFiles();
const db = await FileStorage.openVault(fileName, password);
```

### Session Persistence

Session stored in `sessionStorage` via `session.ts`. `SessionRestore` component handles auto-restore on app load.

### TanStack Router (file-based)

- `__root.tsx` — root layout (ThemeSync, SessionRestore, Toaster, BiometricPromptLayer)
- `_authenticated.tsx` — auth guard layout, redirects to `/` if no session
- `_authenticated/keys` — key management
- `_authenticated/settings` — settings layout with nested routes (general, groups, providers, shortcuts, about)
- `_authenticated/health` — health audit page
- `_authenticated/inbox` — inbox for expiry alerts
- `help.index.tsx` / `help.$slug.tsx` — help center

Protected route pattern:
```typescript
export const Route = createFileRoute('/_authenticated/keys')({
  beforeLoad: () => {
    if (!loadSession()) throw redirect({ to: '/' });
  },
  component: () => <KeysPage />
});
```

### Data Model

**ApiKey** — core entity:
```typescript
interface ApiKey {
  id: string; name: string; description: string;
  provider: string; endpoint: string; key: string;
  group_id: string | null;
  expires_at: string | null;
  connection_check: ConnectionCheck;  // { status, checked_at, latency_ms, error_message }
  created_at: string; updated_at: string;
}
```

**Settings** — vault-level preferences (theme managed separately in localStorage):
```typescript
interface Settings {
  auto_lock_minutes: number;  // 0 = never
  auto_test_on_save: boolean;
  auto_test_daily: boolean;
  clipboard_detection_on_add: boolean;
  custom_providers: CustomProvider[];
  disabled_providers: string[];
}
```

**InboxItem** — proactive alerts (key expiry upcoming/expired), synced via `collectExpiryAlerts` + `syncInboxWithAlerts`.

### .keya Binary Format

`[Header 128B] [EncParams 96B] [PayloadLen 4B] [Payload N] [HMAC 32B]`
- Header: magic "KEYA", version 1, UUID, timestamps
- EncParams: Argon2id (ops=3, mem=64MB), salt, nonce
- Payload: encrypted UTF-8 JSON (KeyaDatabase)
- HMAC-SHA256 integrity

## Conventions

- **Language**: Respond in Chinese, code comments in English
- **Minimal changes**: Keep modifications focused, avoid over-engineering
- **Code reuse**: Watch cyclomatic complexity, reuse existing modules
- **Components**: organized by feature (`keys/`, `vault/`, `settings/`), not by type
- **Linting**: Biome (not ESLint). 2-space indent, single quotes, 80 char width. `noExplicitAny` off.
- **Tests**: `__tests__/` alongside source. Vitest, import `{ describe, it, expect } from 'vitest'`.
