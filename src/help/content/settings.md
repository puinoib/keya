---
title: Settings & shortcuts
description: This device, the vault, the catalog, and the keyboard.
category: Settings & help
order: 8
---

Settings is split by what the change belongs to.

## General

This page holds device preferences, so switching vaults keeps them.

- **Theme** — System, Light, or Dark. **System** follows the operating system.
- **Auto Lock** — lock after 1, 2, 5, 10, 15, or 30 minutes without mouse, keyboard, touch, or scroll activity. The default is 5 minutes. Locking still tries to save first; a refused save leaves the vault open and reports the problem instead of discarding edits.
- **Clear copied keys** — remove a copied credential from the clipboard after 15 seconds, 30 seconds, or 1 minute, or turn the delay off. It is never cleared if you copied something else in the meantime.

## Vault

This page is part of the open vault.

- **Identity** — the vault's name and icon. Both are stored inside the `.keya` file, so every copy shows them.
- **Location** — the folder name and file name. A browser exposes only those, not a full path.
- **Biometric Unlock** — available when the browser and authenticator support WebAuthn PRF. Enabling asks for the master password again; it is used for that gesture only and is not kept. The authenticator wraps the password, so a device that cannot do PRF is not offered a weaker fallback. Disabling removes the binding on this device.
- **Master Password** — **Change** rewrites the whole file with a new salt and a new password. The old password stops working on the new file, but older copies — including cloud version history — keep opening with the old one. Keya rebinds biometric unlock on this device right after the change; if you cancel that prompt, the binding is gone and you can enable it again here. See [Security](/docs/security).

## Data

This page is the file's way in and out.

- **Export .keya** writes an encrypted copy. In folder mode this is a copy, not a save; in the single-file fallback it is the save.
- **Export JSON** writes every key, provider, and group as plain text after a confirmation. It is not a backup.
- **Last export from this device** records when this browser last wrote either copy. It is device state, not part of the file.
- **Import** is not available: Keya cannot merge a `.keya` file or a JSON export into the open vault.
- **Forget this vault's device data** deletes this machine's check results, cached allowances, and biometric binding for the open vault. Preferences, themes, and shortcuts stay. The `.keya` file is untouched, nothing is sent anywhere, and the file still opens with its password.

See [Backup & Restore](/docs/backup) for copies and conflicts.

## Shortcuts

**Settings › Shortcuts** records a new combination, disables an action, resets one shortcut, or resets all of them. A combination already used by another action is refused with the conflicting action's name.

The defaults are:

| Action | Default |
|---|---|
| Focus search | `/` |
| Add key | `N` |
| Lock vault | `Mod` + `Shift` + `L` |
| Keyboard shortcuts | `Shift` + `/` |
| Go to Keys / Inbox / Settings | `Mod` + `1` / `2` / `3` |
| Next / previous key | `J` / `K` (or arrow keys) |
| Open detail | `Enter` |
| Copy / edit / test / reveal | `C` / `E` / `T` / `V` |
| Delete key | `Delete` |
| Close detail | `Esc` |

`Mod` is `⌘` on macOS and `Ctrl` elsewhere. Disabled actions still work through the buttons.

## Groups

**Settings › Groups** creates, renames, reorders, and deletes groups. The order here is the order in the sidebar. Deleting a group keeps its keys: they move to Ungrouped.

## About

**Settings › About** links to this help center, the security notes, the product homepage, and the source repository, and shows the application version and license.
