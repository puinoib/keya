---
title: Security
description: The file format, the key derivation, and the limits of local protection.
updated: 2026-03-01
order: 4
---

Keya encrypts vault contents on disk. It does not protect an unlocked vault against compromised application code, browser extensions, or the operating system. This is not a security audit.

## What the file contains

```text
preamble (54 bytes) | ciphertext (one AEAD message)
```

- **preamble:** magic `KEYA`, format version, Argon2id parameters, the 16-byte salt, and the 24-byte nonce. It is public: anyone with the file can read it.
- **ciphertext:** XChaCha20-Poly1305 over the payload with the *whole preamble* as associated data. There is no length field, so truncating or appending bytes fails authentication.

Encrypted: credential secrets, names, descriptions, endpoints, expiry dates, groups, custom provider recipes, and the vault's own name and icon.

Not encrypted: the file name, its size, and the preamble. The preamble deliberately carries no vault identifier, so nothing business-specific is visible before unlocking.

## Key derivation

The file key is `Argon2id(password)` — no pre-hash, no second secret mixed in. The default is 10 passes over 64 MiB, and unlocking runs it once in a worker; saving does not run it again.

- The salt belongs to the file. Renaming or copying the file keeps the same key; **changing the password** picks a new salt and rewrites everything.
- Every save generates a new nonce, checked against the one already on disk.
- A wrong password, a modified ciphertext, a truncated file, and an appended byte all fail the same way. They are deliberately indistinguishable.

## Sessions

The password is discarded as soon as the file key is derived. Nothing in the app retains it, and reloading requires it again — there is no warm session and no shared unlocked state between tabs.

Locking first saves pending changes. **If that save fails, locking is refused** and the vault stays open with the error visible; keep the page open and resolve it before leaving the device.

Biometric unlock wraps the password with a key derived by the authenticator through WebAuthn PRF; a device that cannot do PRF is refused rather than offered a weaker fallback. Auto lock and clipboard clearing are on-device conveniences: they cover the case where you walk away, not the case where code is already running in the page.

## Local data

The browser stores, unencrypted: the folder handle, the container registry (vault name, icon, key count), the check results for each key, the dismissals you made, approved destinations, and preferences. Clearing site data loses them; the vault file is unaffected.

Check results never contain the request, the headers, the response body, or the provider's own error text. They record an outcome and a controlled code, which is what the reminder text is generated from.

## Saving and synchronization

Writes are serialized across tabs, and each save is rejected if the file changed since it was read. Creating a vault with an existing name is rejected rather than overwriting.

This is not a distributed lock: another device using the same cloud folder can still write last. Use one device at a time per vault, and rely on versioned backups.

## Network

There is no Keya backend and no analytics. Network requests come only from a check you approved, and they go to the destination shown in the approval dialog. `http:` destinations cannot be approved permanently. Redirects are never followed.

Destinations you approve are stored on this device; importing a vault never grants network access.

## Backups and exports

An encrypted `.keya` copy is the backup format. **Export JSON** writes the same credentials as plaintext for moving them into other tools; that file is a secret, and deleting it is the only protection it has. Importing either format is not available yet.

If you change a password, older copies keep opening with the old one. Keya cannot revoke a copy that left the device.
