---
title: Welcome to Keya
description: Guides to local vaults, authentication, and safe backups.
updated: 2026-10-20
order: 1
---

Keya stores API keys and tokens in encrypted `.keya` files in a folder you control. It has no account system or application backend. Your cloud drive can synchronize files; provider connectivity tests send keys to their configured endpoints.

AI providers are the default focus, but Keya is not limited to AI. Search, scraping, email, payments, cloud, and internal API credentials fit the same model. Any service can be added as a custom provider with its own endpoint.

## What you can do

- Create separate vaults for different projects.
- Organize keys with groups, search, and filters.
- Add preset AI and platform providers, or any custom API service.
- Test connectivity manually or enable optional automatic tests.
- Review expiry, connection, and endpoint alerts in Inbox.
- Unlock with a master password or enrolled PRF-supported biometric authentication.

Refreshing requires authentication again. Changes are auto-saved in folder mode, but errors and file conflicts need attention. Keep independent backups rather than relying on synchronization alone.

## Guides

- [Quick Start](/docs/quick-start) — choose a folder, create a vault, and add a credential.
- [Security](/docs/security) — encryption, PRF authentication, and protection limits.
- [Backup & Restore](/docs/backup) — preserve versions and handle save conflicts.
- [Inbox](/docs/inbox) — understand alerts and their current limitations.
- [FAQ](/docs/faq) — browser support, refresh behavior, and recovery.

Start with a current Chrome or Edge browser for the full folder-based workflow. Always keep your master password available independently of biometric unlock.
