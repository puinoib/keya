---
title: Security
description: The file format, the key derivation, and the limits of local protection.
category: Security & data
order: 9
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

Biometric unlock wraps the password with a key derived by the authenticator through WebAuthn PRF; a device that cannot do PRF is refused rather than offered a weaker fallback. Auto lock and clipboard clearing are on-device conveniences: they cover the case where you walk away, not the case where code is already running in the page. Clipboard clearing defaults to 15 seconds and can be changed or turned off in Settings › General; it only clears when the copied value is still unchanged.

## Local data

The browser stores, unencrypted:

- the folder handle;
- the container registry (file name, vault name, icon, key count);
- check results and the device key that binds them to a credential and destination;
- preferences such as auto lock, clipboard clearing, hidden presets, and theme;
- allowance snapshots in this tab's `sessionStorage` for up to 24 hours.

Clearing site data loses them; the vault file is unaffected. Nothing about an approved destination is stored: approvals exist only in memory for the current unlock.

Check results never contain the request, the headers, the response body, or the provider's own error text. They record an outcome and a controlled code, which is what the Inbox and key copy are generated from.

**Forget this vault's device data** (Settings › Data) deletes this machine's check results, cached usage numbers, and the biometric binding for the open vault. Preferences, themes, and shortcuts stay. Clearing this browser's site data deletes the same state for every vault on this device. In both cases the `.keya` file is untouched — nothing is sent anywhere, and the file still opens with its password.

## Network

There is no Keya backend and no account system. The deployed site can also load Cloudflare Web Analytics, the zone's RUM beacon: it is injected at the edge, is not part of this repository, and can be switched off in the Cloudflare dashboard.

Beyond that, network requests come only from something you asked for:

- a **Test key**, which first shows the exact address the credential will reach;
- a **usage query**, which shows the allowance address first and then authorizes that one request;
- a **housekeeping batch**, which names every destination once and then runs one request per key.

Nothing is sent on a schedule, and no approval outlives the click that gave it. `http:` endpoints are confirmed for every send, and usage queries refuse them outright because the key would travel in clear text. Redirects are never followed.

## Saving and synchronization

Writes are serialized across tabs, and each save is rejected if the file changed since it was read. Creating a vault with an existing file name is rejected rather than overwriting.

This is not a distributed lock: another device using the same cloud folder can still write last. Use one device at a time per vault, and rely on versioned backups. See [Backup & Restore](/docs/backup).

## Backups and exports

An encrypted `.keya` copy is the backup format. **Export JSON** writes the vault's keys, providers, and groups as plaintext for moving them into other tools; that file is a secret, and deleting it is the only protection it has. It carries no device state — no preferences, check results, or approvals. Keya cannot read either export back: to restore or move a vault, copy the `.keya` file into the folder and open it with its password.

A password change does not revoke older copies. [Backup & Restore](/docs/backup) covers copies, conflicts, and password changes.
