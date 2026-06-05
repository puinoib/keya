---
title: Security
description: How Keya encrypts your data and what it does — and does not — protect.
updated: 2026-06-05
order: 4
---

This page describes the actual cryptography in use and the threat model it covers. It is intentionally specific: you should be able to read the code and verify every claim.

## What is encrypted

Everything inside a `.keya` file is encrypted. The plaintext is a JSON document with your keys, groups, settings, and metadata. The ciphertext, plus a small unencrypted header, is what gets written to disk.

What is **not** encrypted:

- The file name (e.g. `personal.keya`).
- File timestamps visible in your file system.
- The fact that you have a `.keya` file at all.

If you need to hide the existence of a vault, use a hidden folder or a VeraCrypt container — Keya only protects the contents.

## Cipher suite

| Layer | Algorithm | Parameters |
|---|---|---|
| Key derivation | **Argon2id** (ALG_ARGON2ID13) | ops=3, mem=64 MB, 32-byte output |
| Authenticated encryption | **XChaCha20-Poly1305** (libsodium `crypto_secretbox`) | 24-byte nonce per file |
| Integrity | **HMAC-SHA256** | 32-byte tag, covers the full pre-tag content |

Argon2id gives you memory-hard password stretching — brute force against a strong master password is bounded by both CPU time and RAM. XChaCha20-Poly1305 is the same AEAD used by WireGuard, with a 192-bit nonce that makes random reuse practically impossible. HMAC-SHA256 is computed over the header, the encryption parameters, and the ciphertext, and is verified before decryption. A tampered file fails closed: it does not decrypt and does not corrupt the rest of your data.

## The `.keya` file format

```
┌──────────────┬──────────────┬─────────────┬──────────┬──────────┐
│ Header (128B) │ EncParams    │ PayloadLen  │ Payload  │ HMAC     │
│               │ (96B)        │ (4B)        │ (N)      │ (32B)    │
└──────────────┴──────────────┴─────────────┴──────────┴──────────┘
```

- **Header (128B)** — magic bytes `KEYA`, format version, vault UUID, creation and update timestamps.
- **EncParams (96B)** — Argon2id settings, the per-vault salt, the XChaCha nonce.
- **PayloadLen (4B)** — big-endian length of the ciphertext.
- **Payload (N)** — XChaCha20-Poly1305 ciphertext of the UTF-8 JSON.
- **HMAC (32B)** — HMAC-SHA256 over everything before it.

The salt and nonce are fresh for every save. That means re-saving a vault with no changes still produces a different file — there is no deterministic leak.

## Where the master password fits

The master password is the only secret that opens a vault. It never leaves the browser. It is fed into Argon2id to derive the 32-byte symmetric key for that vault, and the symmetric key is held in memory only while the vault is unlocked.

Three consequences follow:

1. **No password reset.** We can't reset it because we don't have it. We also can't decrypt anything without it.
2. **No server-side validation.** Keya has no server, so there is nothing to attack on the server side.
3. **Weak passwords are the weakest link.** Argon2id slows down guessing, but it doesn't make `password123` safe. Use a 16+ character password or four random words.

## What biometric unlock does — and doesn't

Biometric unlock (Touch ID, Windows Hello, Android fingerprint, etc.) is implemented as a **WebAuthn passkey** stored in IndexedDB and scoped to the specific vault's UUID. The passkey signs a challenge from Keya, and on success Keya fills in the master password from its in-memory copy.

The master password is still required. Biometric is a convenience for unlocking a vault you could already unlock with the password. The passkey is bound to the device and browser that enrolled it — it is not synced.

If you wipe the device or clear site data, you must unlock with the master password and re-enroll biometrics.

## Session behavior

When you unlock a vault, Keya stores the master password in `sessionStorage` under the key `keya-session`. This is what lets the app survive a page reload without prompting you again.

- The session is per-tab. Closing the tab clears it.
- The session is per-origin. A different domain cannot read it.
- The session is **not** `localStorage`. It does not survive browser restart.
- Locking the vault (`Lock` button, vault switcher, or auto-lock timer) purges the session immediately.

The `auto_lock_minutes` setting in **Settings** controls inactivity-based locking. The default is 5 minutes. Setting it to 0 disables auto-lock, but every reload still requires unlock.

## What Keya does not do

It is worth being explicit:

- **No network calls except your explicit Test Key requests.** No telemetry, no update checks, no error reporting.
- **No clipboard persistence.** The clipboard is cleared 15 seconds after you copy a key. This is best-effort — if another app is holding the clipboard at that moment, the clear is a no-op.
- **No key recovery.** We can't help you past a forgotten password.
- **No multi-user access control.** A vault is a single file with a single password. Sharing a vault means sharing the file and the password, full stop.
- **No protection against a compromised device.** If your machine has a keylogger, a screen capture, or a malicious browser extension, Keya's encryption does not save you. The threat model assumes your OS, browser, and clipboard are trustworthy.

## Recommendations

A few habits that meaningfully raise the bar:

1. **Use a long, unique master password.** Generated and stored in your password manager.
2. **Lock the app when stepping away.** `Cmd/Ctrl+L` is a habit worth building.
3. **Back up the `.keya` file separately** from the device that creates it. See [Backup &amp; Restore](/help/backup).
4. **Audit your browser extensions.** A password manager extension or a clipboard manager can read what you copy. Keya encrypts the file on disk; it cannot protect against a co-located attacker in the browser.
5. **Keep the browser up to date.** Web platform security moves fast; the File System Access API and WebAuthn both rely on the browser's process isolation.
