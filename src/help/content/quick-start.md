---
title: Quick Start
description: Choose a workspace, create a vault, and save your first key.
updated: 2026-10-20
order: 2
---

## 1. Choose a workspace

Use a current Chrome or Edge browser for the folder-based workflow. Open Keya, enter the app from the landing page, and click **Choose Sync Folder**. Read the permission explanation, then select a dedicated folder and grant read/write access.

The folder can be local or managed by your cloud drive. Keya remembers its handle in browser storage, but the browser may ask you to grant permission again. Choosing a synced folder does not make simultaneous editing on different devices safe.

Browsers without a directory picker offer a limited manual `.keya` open/export fallback. Edits are not auto-downloaded; use Export .keya to save them. See [FAQ](/docs/faq).

## 2. Create a vault

On the workspace screen, choose **New Vault**, enter a name, and set and confirm a strong master password. Use a password manager to generate and retain it. Keya has no password-reset service.

The vault is saved as a `.keya` file. An existing filename is rejected rather than overwritten. Once a vault is open, the sidebar vault switcher lets you create or open another vault.

## 3. Add a credential

1. Click **Add Key**.
2. Enter a name and the API key or token, select the service, and review the endpoint. You may also add a description, group, and expiry date.
3. Optionally test connectivity. This sends the key to the configured endpoint. Tests use metadata endpoints where available; custom or metered endpoints may incur charges.
4. Click **Save Key**. Changes are auto-saved after a short delay in folder mode.

For a service that is not in the preset list, add it under Settings → Providers → **Add Custom Provider**, or choose **Custom** and enter its endpoint directly. Search APIs, scraping tools, email services, payment APIs, and internal endpoints all work this way.

If clipboard detection is enabled, adding a key may offer a candidate from your clipboard. Verify it before accepting. Custom endpoints receive your key, so use only endpoints you trust.

## 4. Find and manage keys

Use search and the sidebar filters to narrow the list by group, provider, connection status, or expiry. Select a key to view details, reveal or copy its value, test it, edit it, or delete it.

Clipboard clearing is best-effort; copied secrets can remain in clipboard history. JSON exports are plaintext. For backups, prefer encrypted `.keya` exports.

## 5. Lock and reopen

Use the **Lock** action in the top bar or vault switcher. Inactivity locking is configured in Settings → General and defaults to five minutes.

Locking and switching vaults first save pending changes. **If saving fails, locking is refused and the vault stays unlocked.** Keep the page open and export an encrypted copy before troubleshooting. Do not assume unsaved edits will survive closing or reloading the page.

After locking or refreshing, unlock with your master password or an enrolled PRF-supported authenticator. Passwords are not persisted for automatic session restoration.

## Settings

- **General:** vault name and icon, PRF biometric enrollment, inactivity interval, and master password changes.
- **Providers:** preset visibility and custom providers/endpoints for any API service.
- **Groups:** create, rename, or delete groups. Removing a group does not delete its keys.
- **Keys:** optional tests after saving or on first daily unlock, plus clipboard detection. Automatic tests are disabled by default.
- **Shortcuts:** inspect or customize keyboard shortcuts.

## Next steps

- Read [Security](/docs/security) for authentication and storage limits.
- Set up [Backup & Restore](/docs/backup) before relying on the vault.
- Check [Inbox](/docs/inbox) for expiry and connection-related alerts.
