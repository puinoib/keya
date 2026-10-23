---
title: Vaults, folders & export
description: Multiple vaults, the workspace folder, and the single-file fallback.
category: Getting started
order: 7
---

## One file, one vault

A vault is a single `.keya` file. Keya scans the workspace folder one level deep: every `.keya` file directly inside it appears in the vault switcher. Nested folders are ignored.

The switcher at the top of the sidebar shows the current vault. It lists the other vaults in the folder, opens a password prompt to switch, and offers **New Vault**, **Change Sync Folder…**, **Settings**, and **Lock**. Switching vaults saves and locks the current one first.

Vaults are never merged. Opening a second file puts it beside the first, with its own password, providers, groups, and keys.

## Saving and locking

In folder mode, edits are coalesced and written to the file shortly after you make them. Locking asks the pending save to finish before the vault closes. If that save fails, locking is refused and the vault stays open with the error visible; keep the page open and resolve it before leaving the device.

A reload is a new unlock: the password is not kept anywhere. Auto lock uses the same save-before-lock rule.

## Changing the folder

**Change Sync Folder…** saves the current vault, locks it, and forgets the current folder handle. You then choose the new folder on the welcome screen. The `.keya` files are not moved.

## Browsers without folder access

Firefox and Safari do not implement the File System Access API. In those browsers Keya can open one `.keya` file and export a replacement, but it cannot write back to a folder.

In this fallback, edits are not downloaded automatically. The top bar shows **Unsaved — export .keya to save**, and **Export .keya** produces the file that becomes the save. There is no background write, no external-change check, and no ability to keep a second vault beside the first. Switching to another vault with unsaved changes is refused until you export them.

## Export

**Settings › Data** and the download menu in the top bar offer the same two exports:

- **Export .keya** writes an encrypted copy of the current vault. In folder mode this is a copy, not a save; in the single-file fallback it is the save.
- **Export JSON** writes the vault's keys, providers, and groups as plain text after a confirmation. The file is a secret, it carries no device state, and deleting it is the only protection it has.

The Data page also records when this browser last exported a copy. Keya has no importer for either format. To move or restore a vault, copy its `.keya` file into the folder and open it with its password. See [Backup & Restore](/docs/backup).
