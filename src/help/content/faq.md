---
title: FAQ
description: Common questions about cost, sync, recovery, and behavior.
updated: 2026-06-05
order: 5
---

## Is Keya free?

Yes. MIT-licensed open source. No subscription, no pro tier.

## Does Keya send my keys anywhere?

No. Keya is a static web app with no backend, no analytics. The only outbound traffic is the **Test Key** button, which sends a request to the provider you configured.

## Where is my data stored?

Two places, both on your machine:

1. **Vault files (`*.keya`)** in the workspace folder you picked.
2. **IndexedDB cache** (`keya-meta`) — stores workspace handle, vault summaries (name, icon, key count), and biometric credentials. Not a copy of your keys.

Deleting one does not delete the other.

## I forgot my master password. Can you reset it?

No. Without the password, the `.keya` file is useless ciphertext. **Store the master password in a password manager.**

## How do I use multiple vaults?

Open the vault switcher (top-left sidebar). All `.keya` files in your workspace folder appear there. Each vault has its own password, keys, and settings.

## My browser can't pick a folder. What now?

Keya needs the **File System Access API**, available in Chrome, Edge, Arc, Brave, and other Chromium browsers. Firefox and Safari don't support it.

Switch to a Chromium browser for setup, or use the file picker fallback to upload/download the vault file manually.

## Will my cloud drive conflict with itself?

Probably not, if you use Keya on **one device at a time per vault**. Cloud drives use last-write-wins — simultaneous edits on two devices can lose data.

## How does biometric unlock work?

It's a convenience, not a replacement for the master password. Keya stores a WebAuthn passkey in IndexedDB, scoped to the vault and device. It doesn't sync across devices. Clearing browser data removes it — re-enroll with the master password.

## How do I move Keya to a new computer?

1. Ensure the workspace folder syncs through your cloud drive.
2. Open Keya in a Chromium browser on the new machine.
3. Pick the same workspace folder, unlock each vault with the master password.

## Can I export a key to share with a teammate?

Not directly — Keya operates on whole vaults. Either create a separate vault and share the `.keya` file + password through different channels, or copy the key value into your team's secret manager.

## How do I report a bug?

Open an issue on GitHub. Include the browser version, expected vs actual behavior, and a scrubbed `.keya` file if data-related.

## Where's the source code?

See the GitHub link in the app footer. Everything is in one repository under MIT.

## How do I change my master password?

Settings → General → Master Password → **Change**. Enter your current password, then the new one (min 8 chars). If biometric unlock is active, it re-registers automatically.
