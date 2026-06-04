# Keya

> Your Key Guardian — Secure API Key Management for AI Developers

**Status**: ✅ Development Complete (Multi-vault, Biometric Auth, Help Center)

**License**: MIT (Open Source)

---

## What is Keya?

Keya is a secure API key management application designed specifically for AI developers. It provides encrypted local file storage with multi-vault support, biometric authentication, and API connectivity testing.

### Key Features

- 🔐 **Secure Encrypted Storage** - Military-grade encryption (Argon2id + XChaCha20-Poly1305)
- 🗄️ **Multi-Vault Support** - Separate vaults for work, personal, team projects
- 🧪 **API Connectivity Testing** - Test API key validity with one click
- 🏷️ **Groups & Organization** - Organize keys by provider, environment, or purpose
- 🔍 **Search & Filter** - Quickly find keys by name, provider, or description
- 👆 **Biometric Unlock** - Touch ID / Face ID support (WebAuthn)
- 💾 **Cloud Sync Ready** - Works with iCloud, Nutstore, Dropbox, or any cloud storage
- 🌐 **Zero Backend** - All data stored locally, no server costs
- 📚 **Built-in Help Center** - Comprehensive documentation and guides
- 🔒 **Auto-lock** - Configurable automatic locking after inactivity

### What Problem Does It Solve?

AI developers typically have 5-20+ API keys (OpenAI, Anthropic, Cohere, etc.) scattered across `.env` files, notes, and chat history. Keya centralizes these keys in one secure, searchable location with connectivity testing.

---

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Modern browser (Chrome/Edge recommended for full features)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/keya.git
cd keya

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open `http://localhost:5173` in your browser.

### Building for Production

```bash
# Build the application
pnpm build

# Preview production build
pnpm preview
```

### Running Tests

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch
```

---

## .keya File Format

Keya uses a custom binary file format for encrypted storage:

```
┌─────────────────────────────────────────────┐
│  HEADER (128 bytes)                          │
│  ├─ Magic:      4B   "KEYA"                 │
│  ├─ Version:    2B   1 (uint16 LE)          │
│  ├─ FileID:     16B  UUID                   │
│  ├─ Created:    8B   Unix timestamp         │
│  └─ Modified:   8B   Unix timestamp         │
├─────────────────────────────────────────────┤
│  ENCRYPTION PARAMS (96 bytes)                │
│  ├─ KDF:        Argon2id                    │
│  ├─ OpsLimit:   3                           │
│  ├─ MemLimit:   65536 (64 MB)               │
│  ├─ Salt:       16B                         │
│  └─ Nonce:      24B                         │
├─────────────────────────────────────────────┤
│  PAYLOAD (variable)                          │
│  └─ Encrypted JSON (UTF-8)                   │
├─────────────────────────────────────────────┤
│  HMAC (32 bytes)                              │
│  └─ HMAC-SHA256 for integrity                │
└─────────────────────────────────────────────┘
```

### Encryption Details

| Component | Algorithm | Parameters |
|-----------|-----------|------------|
| Key Derivation | Argon2id | ops=3, mem=64MB |
| Encryption | XChaCha20-Poly1305 | libsodium |
| Integrity | HMAC-SHA256 | - |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 |
| **Language** | TypeScript ~6.0 |
| **Build** | Vite 8.x |
| **Router** | TanStack Router 1.x |
| **State** | Zustand 5.x |
| **Styling** | Tailwind CSS 4.x |
| **Crypto** | libsodium-wrappers-sumo |
| **Forms** | React Hook Form + Zod |
| **Testing** | Vitest 4.x |
| **Linting** | Biome 2.x |

---

## Project Structure

```
keya/
├── src/
│   ├── core/                   # Core business logic (@keya/core)
│   │   ├── crypto.ts          # Encryption/decryption
│   │   ├── database.ts        # Database CRUD operations
│   │   ├── schema.ts          # .keya file format
│   │   ├── types.ts           # TypeScript types
│   │   └── index.ts          # Public API
│   │
│   ├── app/                   # Application layer
│   │   ├── components/       # UI components by feature
│   │   │   ├── keys/        # Key management
│   │   │   ├── groups/      # Group management
│   │   │   ├── vault/       # Vault components
│   │   │   ├── welcome/     # Onboarding
│   │   │   └── layout/      # App layout
│   │   ├── lib/             # App-specific libraries
│   │   │   ├── storage.ts   # File I/O
│   │   │   ├── session.ts   # Session management
│   │   │   ├── biometric.ts # WebAuthn
│   │   │   └── api-tester.ts# API testing
│   │   └── store/           # Zustand state
│   │
│   ├── routes/              # TanStack Router
│   │   ├── __root.tsx      # Root layout
│   │   ├── _authenticated.tsx  # Auth guard
│   │   └── index.tsx       # Welcome page
│   │
│   └── help/                # Help center
│       ├── content/         # Markdown articles
│       ├── components/      # Help UI
│       └── lib/            # Search, parsing
│
├── public/                 # Static assets
├── biome.json             # Biome config
└── vite.config.ts         # Vite config
```

---

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

# Linting & Formatting
pnpm lint             # Check for issues
pnpm lint:fix         # Fix auto-fixable issues
pnpm format           # Format code
pnpm check            # Check + format in one command
```

---

## Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| **Directory Picker** | ✅ Full support | ❌ Not supported | ❌ Not supported |
| **File Picker** | ✅ Full support | ✅ Full support | ✅ Full support |
| **WebAuthn** | ✅ Full support | ✅ Full support | ✅ Full support |
| **PWA Install** | ✅ Full support | ✅ Full support | ✅ Full support |

**Note**: Chrome/Edge provides the best experience with directory picker for seamless vault management. Firefox/Safari users can still use Keya with manual file selection.

---

## Supported Providers

Keya includes preset configurations for popular AI/ML providers:

- OpenAI
- Anthropic (Claude)
- Google (Gemini)
- Groq
- DeepSeek
- Moonshot (Kimi)
- Zhipu (GLM)
- Baidu (ERNIE)
- Mistral
- Cohere
- Together AI
- OpenRouter
- SiliconFlow
- Azure OpenAI

Custom providers can be added in settings.

---

## Security Features

### Encryption
- **Argon2id** key derivation with configurable parameters
- **XChaCha20-Poly1305** authenticated encryption
- **Random salt** for each vault file
- **HMAC-SHA256** integrity verification

### Session Management
- Session persisted in browser sessionStorage only
- Auto-lock after configurable inactivity period
- Manual lock button available
- Session cleared on browser close

### Biometric Authentication
- WebAuthn-based biometric unlock (Touch ID / Face ID)
- Optional per-vault enrollment
- Fallback to password always available

### API Key Protection
- Keys masked by default (e.g., `sk-...abc123`)
- Toggle visibility with click
- Auto-hide after 3 seconds
- No network requests except explicit API testing

---

## Architecture

### Workspace States
1. **welcome** - No vault loaded, shows vault selection
2. **locked** - Session exists but vault locked, shows unlock prompt
3. **unlocked** - Vault decrypted and accessible

### Multi-Vault Support
- Select a workspace folder (e.g., iCloud Drive, Nutstore)
- Create multiple vaults as separate `.keya` files
- Vault switcher for quick switching between vaults
- Vault metadata cached for fast display without decryption

### Auto-save
- Changes auto-saved with 500ms debouncing
- Prevents excessive I/O during rapid edits
- Manual save via Ctrl/Cmd + S

---

## License

MIT License - see LICENSE file for details.

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Keya — Your Key Guardian** 🔐
