---
title: Welcome to Keya
description: A local vault for developer API keys and tokens.
updated: 2026-03-01
order: 1
---

Keya stores API keys and tokens in encrypted `.keya` files inside a folder you choose. There is no account system and no application backend: your cloud drive may synchronize the folder, and apart from the site analytics described in Security, nothing leaves the device except the provider requests you approve.

AI providers are the default focus, but Keya is not limited to them. Search, scraping, email, payments, cloud, and internal API credentials fit the same model; any service can be added as a custom provider with its own endpoint and check recipe.

## What you can do

- Keep separate vaults for different projects, one file each.
- Organize credentials with groups, and archive the ones you have retired.
- Track an expiry per credential: a calendar day, an exact instant, or nothing.
- Check a credential against its provider, with an explicit approval before anything is sent.
- Review the Inbox for expiring keys, plaintext destinations, and checks that failed or went stale.

Refreshing the page requires the master password again: Keya does not keep a warm session, and it does not store the password anywhere.

## Guides

- [Quick Start](/docs/quick-start) — choose a folder, create a vault, add a credential.
- [Inbox](/docs/inbox) — what triggers an alert, and what archiving one means.
- [Security](/docs/security) — the file format, the key derivation, and the limits.
- [Backup & Restore](/docs/backup) — copies, conflicts, and password changes.
- [FAQ](/docs/faq) — browsers, recovery, and known gaps.

Use a current Chrome or Edge: the folder workflow needs the File System Access API.
