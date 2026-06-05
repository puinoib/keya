---
title: Backup & Restore
description: How to back up, restore, and migrate your Keya vaults.
updated: 2025-06-05
order: 5
---

# Backup & Restore

Keya stores your data in `.keya` files inside the workspace folder you picked on first launch. The file is the backup. If you have the file and the master password, you have everything.

## What to back up

Just the workspace folder. Every `.keya` file in that folder is an independent, fully self-contained vault. The folder also includes any future vault files you create — they will all be backed up the same way.

You do **not** need to back up IndexedDB. The IndexedDB cache only stores metadata (vault names, icons, key counts) and biometric credentials. If you wipe it, Keya rebuilds the metadata the next time you open each vault, and you just re-enroll biometrics per device.

## Pick a synced folder for the workspace

The simplest and most reliable backup is to make the workspace folder live inside a cloud-synced directory from day one. Common choices:

- **iCloud Drive** — `~/Library/Mobile Documents/iCloud~Drive/Keya` on macOS, or the iCloud Drive folder in Finder.
- **Dropbox** — `~/Dropbox/Keya`.
- **Nutstore** — `~/Nutstore/Keya` (popular in China).
- **OneDrive** — `~/OneDrive/Keya`.

Pick **one** synced location per workspace. Pointing Keya at a folder that lives in two different sync services will produce conflicts, not safety.

The rest of this guide assumes your workspace is in a synced folder. If it isn't, you can still back up by copying the folder manually — see the offline section below.

## Routine backup

Once the workspace is in a synced folder, your cloud drive client is your backup. There is nothing to schedule, no export button to click, no third-party backup software to configure. Every save writes the new vault content to the same file, and your cloud client uploads it.

Two things worth knowing:

- **Most cloud clients upload on a short delay**, usually a few seconds. If you save a key, switch off your laptop immediately, and your house burns down, you may lose the last save. Unlikely, but real.
- **Some cloud clients keep a version history.** iCloud Drive, Dropbox, and OneDrive all retain prior versions of a file for 30 days or more. If you accidentally save a corrupted vault, you can usually roll back from the cloud client's web UI. Keya does not provide a UI for this; it's a feature of the cloud.

## Restore on the same device

If Keya loses its connection to the workspace — say you cleared browser data, or you switched browsers — the `.keya` files are still on disk. To restore:

1. Open Keya in a Chromium-based browser.
2. Click **Open Folder** and pick the same workspace folder.
3. The vault switcher will list every `.keya` in the folder. Open one and enter the master password.

That's it. The IndexedDB cache rebuilds itself as you open each vault.

## Move to a new device

1. **Make sure the cloud sync has finished** on the old device. Open the cloud client's UI and confirm the workspace folder is up to date.
2. **Sign in to the same cloud service** on the new device and wait for the workspace folder to sync down.
3. **Open Keya** in a Chromium-based browser on the new device.
4. **Pick the workspace folder** when prompted.
5. **Open each vault** with its master password. Re-enroll biometrics on the new device if you want them.

If the new device is offline for a while, you can pre-stage the `.keya` files by copying them over with a USB stick and pointing Keya at a local copy. They'll still sync up once the cloud catches up.

## Offline backup (no cloud drive)

If you'd rather not use a cloud drive, the workflow is:

1. Periodically copy the workspace folder to another location — an external drive, a USB stick, a NAS, an S3 bucket, an encrypted DMG.
2. The copy is encrypted at rest by virtue of being a `.keya` file. You can leave it in a "less trusted" location without the master password being exposed.
3. To restore, copy the folder back to a location accessible to your browser and pick it as the workspace.

A reasonable cadence is weekly for light users, daily for heavy users. Automate it with `rsync`, Time Machine, or whatever you're already using for other files.

## Sync conflicts

Cloud drives resolve simultaneous edits to the same file with last-write-wins. If you open the same vault on two devices at once, the second save overwrites the first.

The honest mitigation: **don't use the same vault on two devices at the same time.** Switch devices, let the cloud sync, then continue.

If you do get a conflict — usually visible as a `personal (Conflict 2026-06-04).keya` file alongside the original — both files are still valid vaults. Open both, copy the keys you care about into a fresh vault, and delete the loser.

## Disaster scenarios

| Scenario | Outcome |
|---|---|
| Forgot master password | **Unrecoverable.** The `.keya` file is encrypted with that exact password. No backdoor. |
| `.keya` file deleted from cloud, no local copy | **Lost.** Re-create the vault. |
| `.keya` file corrupted (partial write, disk failure) | **Lost unless you have a previous version.** Cloud clients usually keep 30 days of version history — check the web UI. |
| Workspace folder deleted from one device, but the cloud still has it | Recovered automatically. The cloud client will re-download on the affected device. |
| Browser data cleared | **No data loss.** The `.keya` files are on disk. Re-open the workspace folder, unlock each vault with the master password. |
| Device stolen while vault is unlocked | **Uncertain.** The session lives in `sessionStorage` and is cleared on tab close, but a thief with the unlocked browser and no lock screen may have access. Always lock the vault before walking away. |

## A quarterly drill

Most people discover their backup is broken the day they need it. Save yourself the surprise:

1. Once a quarter, copy a `.keya` file to a fresh folder.
2. Open Keya in a different browser (or a private window).
3. Pick the copy's folder.
4. Confirm you can unlock with the master password and see all your keys.
5. Delete the test copy.

If the drill fails, fix the backup chain before something real breaks.

## Related

- [Quick Start](/help/quick-start) — the workspace folder is set up here.
- [Security](/help/security) — what encryption actually protects, and against what.
- [FAQ](/help/faq) — see the "My browser can't pick a folder" entry for File System Access API requirements.
