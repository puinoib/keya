# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Keya** is a secure API key management application designed for AI developers. It provides encrypted local file storage with multi-vault support, biometric authentication, and API connectivity testing.

### Core Philosophy
- **User owns data**: All data stored in local `.keya` files, synced via user's cloud storage (iCloud, Nutstore, Dropbox)
- **Encryption first**: Argon2id KDF + XChaCha20-Poly1305 (same level as KeePass/Bitwarden)
- **Zero backend**: No server contact, no API costs
- **Open source**: MIT license, fully auditable

## Development Commands

```bash
# Development
pnpm dev              # Start dev server

# Build & Type Check  
pnpm build            # Production build
pnpm typecheck        # TypeScript type checking

# Testing
pnpm test             # Run tests once
pnpm test:watch       # Run tests in watch mode

# Linting & Formatting (Biome, not ESLint)
pnpm lint             # Check for issues
pnpm lint:fix         # Fix auto-fixable issues
pnpm format           # Format code
pnpm check            # Check + format in one command
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19 |
| Language | TypeScript | ~6.0 |
| Build | Vite | 8.x |
| Router | TanStack Router | 1.x |
| State | Zustand | 5.x |
| Styling | Tailwind CSS | 4.x |
| Crypto | libsodium-wrappers-sumo | latest |
| Forms | React Hook Form + Zod | latest |
| Testing | Vitest | 4.x |
| Linting | Biome | 2.x |
| Icons | Phosphor Icons | 2.x |
| Toast | Sonner | 2.x |

## Project Structure

```
keya/
├── src/
│   ├── core/                   # Core business logic (conceptually @keya/core)
│   │   ├── crypto.ts          # Encryption/decryption (libsodium)
│   │   ├── database.ts        # Database CRUD operations
│   │   ├── schema.ts          # .keya binary file format
│   │   ├── types.ts           # TypeScript types & constants
│   │   ├── index.ts           # Public API exports
│   │   └── __tests__/         # Core unit tests
│   │
│   ├── app/                   # Application layer (UI + app logic)
│   │   ├── components/        # UI components organized by feature
│   │   │   ├── keys/         # Key management (KeyList, KeyForm, KeyDetail)
│   │   │   ├── groups/       # Group management
│   │   │   ├── settings/     # Settings pages
│   │   │   ├── vault/        # Vault components (VaultCard, VaultSwitcher)
│   │   │   ├── welcome/      # Welcome/onboarding
│   │   │   ├── layout/       # AppLayout, TopBar, Sidebar
│   │   │   ├── SessionRestore.tsx
│   │   │   ├── ThemeSync.tsx
│   │   │   └── BiometricPromptLayer.tsx
│   │   ├── lib/              # Application-specific libraries
│   │   │   ├── storage.ts    # File I/O (File System Access API)
│   │   │   ├── session.ts    # Session persistence (sessionStorage)
│   │   │   ├── biometric.ts  # WebAuthn biometric auth
│   │   │   └── api-tester.ts # API connectivity testing
│   │   ├── store/            # Zustand state management
│   │   │   └── useStore.ts   # Global app state
│   │   └── hooks/            # Custom React hooks
│   │
│   ├── routes/               # TanStack Router (file-based routing)
│   │   ├── __root.tsx       # Root layout with providers
│   │   ├── _authenticated.tsx  # Auth guard layout
│   │   ├── index.tsx        # Welcome page
│   │   ├── _authenticated/keys.tsx
│   │   ├── _authenticated/settings.tsx
│   │   ├── help.$slug.tsx   # Dynamic help article route
│   │   └── help.index.tsx   # Help center index
│   │
│   ├── help/                # Help center system
│   │   ├── components/      # Help UI (HelpLayout, HelpSearch)
│   │   ├── content/         # Markdown articles
│   │   ├── lib/             # Search, markdown parsing
│   │   └── __tests__/       # Help system tests
│   │
│   ├── lib/                 # General utilities
│   │   ├── utils.ts         # Helper functions (cn, etc.)
│   │   └── mask.ts          # Key masking utilities
│   │
│   ├── components/          # Shared UI components (shadcn/ui)
│   │   └── ui/             # Reusable UI components
│   │
│   ├── main.tsx            # Entry point
│   ├── routeTree.gen.ts   # Auto-generated route tree
│   └── index.css          # Global styles
│
├── public/                 # Static assets
├── biome.json             # Biome configuration
├── vite.config.ts         # Vite + TanStack Router plugin
└── package.json
```

## Architecture Patterns

### Directory Structure Philosophy

**`src/core/`** - Pure business logic, zero UI dependencies
- Can be extracted to `@keya/core` npm package in future
- No imports from `src/app/` or browser-specific APIs
- Defines .keya file format and encryption operations

**`src/app/`** - Application code that imports from core
- All UI components live here
- Can import from `src/core/` but not vice versa
- Contains app-specific logic (storage, session, biometric)

**Reference Rule**: `app/` → `core/` ✅ | `core/` → `app/` ❌

### Workspace States

The app has three states managed in `useStore`:
- **welcome** - No vault loaded (show WelcomePage for vault selection)
- **locked** - Session exists but vault locked (show unlock prompt)  
- **unlocked** - Vault decrypted and accessible

Check current state: `useStore.getState().workspaceState`

### Multi-Vault Architecture

- **Workspace folder** - User selects a sync folder via `showDirectoryPicker()`
- **Vault files** - Multiple `.keya` files in workspace folder
- **IndexedDB storage** - Caches vault metadata (name, icon, keyCount) without decryption
- **Vault switching** - `VaultSwitcher` component lets users switch between vaults

```typescript
// Storage pattern
await FileStorage.setupWorkspace();           // Select folder
const files = await FileStorage.listVaultFiles();  // List .keya files
const db = await FileStorage.openVault(fileName, password);  // Decrypt
```

### Session Persistence

When vault is unlocked:
```typescript
saveSession(fileName, encryptedPassword);     // Store in sessionStorage
```

On page load:
```typescript
const session = loadSession();                // Restore from sessionStorage
if (session) {
  const db = await FileStorage.openVault(session.fileName, session.password);
}
```

`SessionRestore` component handles auto-restore on app initialization.

### Auto-save Debouncing

State changes in `useStore` trigger `scheduleSave()`:
- Debounces file writes by 500ms
- Prevents excessive I/O during rapid edits
- Uses `FileStorage.saveVault()` for actual write

### .keya File Format

Binary structure:
```
[Header (128B)] [EncParams (96B)] [PayloadLen (4B)] [Payload (N)] [HMAC (32B)]
```

- **Header**: Magic "KEYA", version 1, vault UUID, timestamps
- **EncParams**: Argon2id settings (ops=3, mem=64MB), salt, nonce
- **Payload**: Encrypted UTF-8 JSON (KeyaDatabase)
- **HMAC**: HMAC-SHA256 for integrity verification

Encryption: Argon2id KDF → XChaCha20-Poly1305 → libsodium

### TanStack Router

File-based routing with special prefixes:
- `__root.tsx` - Root layout (wraps all routes, renders providers)
- `_authenticated.tsx` - Layout route (auth guard, renders `<Outlet />`)
- `$slug` - Dynamic route parameter (e.g., `help.$slug.tsx`)

Route access pattern:
```typescript
// Protected route
export const Route = createFileRoute('/_authenticated/keys')({
  beforeLoad: () => {
    const session = loadSession();
    if (!session) throw redirect({ to: '/' });
  },
  component: () => <KeysPage />
});
```

### Data Model

**ApiKey** - Core entity for API keys
```typescript
interface ApiKey {
  id: string;                    // UUID
  name: string;                  // Display name
  description: string;           // Usage notes
  provider: string;              // OpenAI / Anthropic / Custom
  endpoint: string;              // API base URL
  key: string;                   // The actual API key (encrypted)
  group_id: string | null;       // Associated group
  expires_at: string | null;     // ISO timestamp
  last_tested: string | null;    // ISO timestamp
  test_status: 'success' | 'failed' | null;
  test_latency_ms: number | null;
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
}
```

**Group** - Organizational categories (formerly "categories")
```typescript
interface Group {
  id: string;
  name: string;      // e.g., "Production", "Development"
  icon: string;      // emoji
  order: number;    // display order
}
```

**Settings** - User preferences
```typescript
interface Settings {
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US';
  auto_lock_minutes: number;     // 0 = never
  auto_test_on_save: boolean;
  custom_providers: CustomProvider[];  // User-defined providers
  disabled_providers: string[];        // Hidden preset providers
}
```

### Testing Strategy

- **Unit tests**: `__tests__/` directories alongside source files
- **Test framework**: Vitest with `describe`, `it`, `expect`
- **Coverage**: Core logic (crypto, database, schema) has comprehensive tests

Run tests: `pnpm test` or `pnpm test:watch`

### Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| Directory Picker | ✅ | ❌ | ❌ |
| File Picker | ✅ | ✅ | ✅ |
| WebAuthn | ✅ | ✅ | ✅ |
| PWA Install | ✅ | ✅ | ✅ |

**Fallback**: `FileStorage.saveViaDownload()` for browsers without Directory Picker API.

### Important Conventions

- **Python**: Use `python3` instead of `python`
- **Language**: Respond in Chinese, but code comments in English
- **Minimal changes**: Keep modifications focused, avoid over-engineering
- **Code reuse**: Watch cyclomatic complexity, reuse existing modules
- **Reference patterns**: Use `src/core/` pattern for portable business logic

### Component Organization

Components are organized by feature, not type:
- ✅ `src/app/components/keys/KeyList.tsx`
- ✅ `src/app/components/vault/VaultSwitcher.tsx`
- ❌ Avoid: `src/app/components/List.tsx` (too generic)

This makes features easier to find and maintain.
