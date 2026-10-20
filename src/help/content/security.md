---
title: Security
description: Encryption, authentication, and the limits of local protection.
updated: 2026-10-20
order: 6
---

Keya encrypts vault contents on disk. It does not protect an unlocked vault against compromised application code, browser extensions, or the operating system. This is not a claim of an independent security audit.

## What is encrypted

The payload contains API keys, groups, settings, inbox items, and vault metadata, including archived credentials. Archiving keeps the secret in the vault; only permanent deletion removes it from the current payload. File names, file sizes, and the binary header are not encrypted. The header includes the vault UUID and timestamps.

IndexedDB separately stores the workspace directory handle and cached vault summaries, including names, icons, and key counts. These summaries are not encrypted. PRF biometric enrollment also stores a credential ID, PRF salt, nonce, and encrypted master password; the PRF-derived encryption key is not stored.

## Current file format

```text
Header (128B) | HeaderHash (32B) | EncParams (96B) | PayloadLen (4B) | Payload (N)
```

- **Header:** magic `KEYA`, version 1, flags, vault UUID, timestamps, random master seed, and reserved bytes.
- **HeaderHash:** unkeyed SHA-256 over the header, encryption parameters, and payload length. This detects accidental corruption; it is not an HMAC or authentication of the header against a malicious editor.
- **EncParams:** Argon2id algorithm and resource settings, salt, and encryption nonce.
- **PayloadLen:** unsigned 32-bit little-endian ciphertext length.
- **Payload:** XChaCha20-Poly1305 authenticated ciphertext of JSON padded with spaces to a 4096-byte boundary.

Current saves pre-hash the password with SHA-256, run Argon2id with `ops=10` and `mem=67108864` bytes (64 MiB), then hash the master seed together with the derived key to obtain the encryption key. Each save generates a fresh master seed, 16-byte salt, and 24-byte nonce.

Payload authentication uses libsodium's XChaCha20-Poly1305 AEAD API. The header is not passed as AEAD additional authenticated data. After decryption, Keya validates the database shape and checks that the payload vault ID matches the header. The source of truth is `src/core/schema.ts` and `src/core/crypto.ts`.

## Passwords and sessions

The unlocked app holds the password and decrypted data in memory so it can display and save the vault. It does not persist the password in sessionStorage or localStorage for restoration. Old recoverable session records are discarded.

**Reloading requires authentication again.** There is no warm session restoration or shared unlocked state across tabs. Keep your master password in a password manager; Keya has no password-reset service.

Locking first attempts to save pending changes. On success it clears the active vault and password from application state. This is not a guarantee of secure erasure of all copies from JavaScript memory.

**If saving fails, locking is refused and the vault remains unlocked.** Keep the page open, export an encrypted copy, and resolve the error before leaving the device. The default inactivity timeout is five minutes; choose an available interval in Settings → General.

## Biometric unlock

Biometric unlock requires a WebAuthn authenticator supporting the **PRF extension**. Keya derives an AES-GCM key from PRF output using HKDF, and uses it to encrypt or decrypt the stored master password. Authenticator credentials are managed by the browser/authenticator, not stored as private keys in Keya's IndexedDB.

If PRF is unavailable or evaluation fails during enrollment, Keya refuses registration instead of storing a fallback encryption key. A passkey can be created successfully while still not supporting PRF: support depends on the browser, operating system, and passkey storage provider. In Chrome, **Your Chrome profile** may not return PRF even when Google Password Manager or iCloud Keychain does. If enrollment fails after choosing where to save the passkey, choose Google Password Manager or iCloud Keychain and try again. Legacy records that stored a key beside the ciphertext are removed during the storage upgrade or when encountered. Close older Keya tabs if an upgrade is blocked.

An enrolled credential and its Keya site record are needed for biometric unlock. Do not rely on them as your only recovery method. Clearing site data requires password unlock and re-enrollment. Credential availability or synchronization depends on the authenticator and browser; Keya does not synchronize its enrollment records.

## Saving and synchronization

Same-origin tabs coordinate file writes using Web Locks. Keya compares the current file against the revision it opened or last saved, and rejects detected external modifications. Creating a vault with an existing filename is rejected.

These checks do not lock cloud clients or other devices, merge conflicting edits, or eliminate every race with external writers. Use one device at a time per vault and keep versioned backups. See [Backup & Restore](/docs/backup).

## Network requests and clipboard

Keya has no application backend or analytics. Loading the app still retrieves its static assets. Manual API tests and enabled automatic tests send keys to the configured provider endpoint. Review custom endpoints carefully and prefer HTTPS. Tests use provider metadata endpoints where available; custom or metered endpoints may incur charges. Amazon Bedrock is not testable from the browser because it requires AWS request signing; NVIDIA NIM and Baseten are not testable because they send no cross-origin headers.

Copied keys leave the app's encrypted storage boundary. The key detail copy action attempts to clear the clipboard after 15 seconds, but browser permissions, page closure, and clipboard history can prevent effective removal. Do not rely on clipboard clearing for secrecy.

JSON exports contain plaintext keys, including archived ones. Encrypted `.keya` exports are preferable for backup. Neither format should be attached to a public bug report with real secrets inside.
