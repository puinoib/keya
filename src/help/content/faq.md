---
title: FAQ
description: Common questions about authentication, synchronization, and recovery.
updated: 2026-10-20
order: 5
---

## Is Keya free?

Yes. Keya is MIT-licensed open source with no subscription. Your cloud storage and API provider may charge separately.

## Does Keya send my keys anywhere?

Keya has no application backend or analytics. API testing sends your key to the configured endpoint, including custom endpoints. Tests can be manual or automatic if enabled in Settings → Keys. Automatic testing is disabled by default. Tests use provider metadata endpoints where available and normally do not invoke a model. Custom or metered endpoints may incur charges. Amazon Bedrock cannot be tested from the browser because it requires AWS request signing.

## Where is my data stored?

Encrypted vault contents live in `.keya` files in your chosen folder, or in files you explicitly export in fallback mode. IndexedDB stores the folder handle, cached vault summaries, and PRF biometric enrollment records. It is not a backup of the vault. See [Security](/docs/security).

## Why do I need to unlock after refreshing?

Keya no longer persists a recoverable master password for session restoration. Refreshing clears the in-memory session. Unlock with your password or an enrolled PRF-supported authenticator.

## Why did biometric unlock stop working?

Biometric unlock now requires WebAuthn PRF. Old records that stored an AES key alongside the encrypted password are removed. Use your master password and enroll again with a PRF-capable browser/authenticator. If storage upgrade is blocked, close other Keya tabs.

Clearing site data also removes the enrollment record. Authenticator credential synchronization does not synchronize Keya's site records; keep your master password available.

## I forgot my password. Can you reset it?

No. If enrolled biometric unlock still works, you may still access and export your data, but it is not a guaranteed recovery method. A `.keya` file alone cannot be recovered without its password. Keep passwords in a password manager.

## How do I use multiple vaults?

Choose another `.keya` file from the sidebar vault switcher and authenticate. Pending changes are saved before switching. Each vault has its own keys, groups, settings, and password. Creating a file with an existing name is rejected.

## My browser cannot pick a folder. What now?

Use a current Chrome or Edge browser for full workspace support. Without the directory picker, Keya offers a limited manual `.keya` file-open/export fallback. This does not provide full folder management or automatic in-place saving. Edits stay in memory until you use Export .keya; locking or switching is refused while unsaved changes exist. File writes in folder mode also require Web Locks support.

## Can I edit the same vault on multiple devices?

Use one device at a time and let cloud synchronization finish before moving to another. Keya coordinates same-origin tab writes and rejects detected external changes, but it does not provide distributed locking or merge edits. See [Backup & Restore](/docs/backup).

## Why will the vault not lock?

Locking first saves pending changes. If saving fails, Keya keeps the vault unlocked to avoid discarding your edits. Keep the page open, export an encrypted copy, and resolve the permission or conflict error. Protect access to your device while the vault remains unlocked.

## How do I change my master password?

Settings → General → Master Password → **Change**. Supply the current password and a new password meeting the displayed requirements. If biometrics are enabled, the UI then requests re-enrollment. Canceling that step can leave the password changed but biometric unlock needing re-enrollment. Backups made before the change still use the old password.

## How do I share a key?

Copy the key into an appropriate secret-sharing tool, or create a separate vault and share its encrypted file and password through separate channels. JSON exports contain plaintext keys; do not share them unintentionally.

## How do I report a bug?

Open an issue at [puinoib/keya](https://github.com/puinoib/keya). Include your browser version, reproduction steps, and expected versus actual behavior. Use synthetic test data; never attach real API keys, passwords, plaintext exports, or production vaults.
