---
title: Backup & Restore
description: Preserve encrypted vaults and recover without overwriting unsaved changes.
updated: 2026-10-20
order: 7
---

## What to back up

Back up your `.keya` files and retain their master passwords separately in a password manager. Each file contains a vault's keys, groups, settings, and inbox. Prefer encrypted `.keya` exports; JSON exports expose keys in plaintext.

IndexedDB is not a backup of your vault contents. It holds the workspace handle, cached summaries, and biometric enrollment records. After clearing site data, choose your folder again, unlock with the password, and re-enroll biometrics if needed.

## Sync is not a backup

A cloud-synced workspace is convenient for moving between devices, but deletion, corruption, and unwanted edits can synchronize too. Maintain an independent, preferably versioned copy of the workspace.

Version history and retention vary by cloud provider, plan, and file type. Verify your provider's recovery options rather than assuming older versions are available.

Before switching devices:

1. Complete your changes and ensure no save error is showing. Locking successfully flushes pending changes.
2. Wait for the cloud client to finish uploading.
3. Wait for the other device to download the latest files before opening a vault.

Use one device at a time per vault. Keya does not merge concurrent edits.

## Restore or move to another device

1. Copy or synchronize your backed-up `.keya` files to a dedicated folder. Preserve existing files under different names before replacing anything.
2. Open Keya in a browser supporting the folder workflow.
3. Choose **Choose Sync Folder** and select that folder.
4. Open the vault and enter the password that protected that version.
5. Check its contents and optionally enroll PRF biometric unlock again.

A backup created before a password change still requires the old password. Password changes also create a `.keya.bak` copy of the previous file; this is not a versioned backup strategy, and later password changes can replace it. Restore a copy under a `.keya` filename to open it.

## Save errors and conflicts

Keya coordinates same-origin tab writes and checks for file changes since opening or saving. A detected external change stops the write instead of overwriting it. This does not prevent all races with a cloud client or another application.

If saving fails or a conflict is reported:

1. **Keep the page open.** Current edits may exist only in memory. A failed save also prevents locking, so protect access to the device.
2. Export the current vault as an encrypted `.keya` file to a separate location. Do not replace the conflicting original.
3. Back up the disk version and any cloud conflict copies separately.
4. Reopen the versions and compare the keys you need. Reconcile into a separate vault or carefully chosen copy.
5. Delete redundant copies only after verifying the result and its backup.

Permissions can also cause save failures. Restore access to the workspace, but preserve an export before reloading. Browsers without folder support require explicit Export .keya actions; keep track of which exported file is current.

## Recovery limits

| Situation | What to do |
|---|---|
| Forgotten password | There is no reset service. If enrolled biometric unlock still works, export accessibly while you can; otherwise recovery requires the password. |
| Deleted or corrupted file | Restore a verified backup or a provider-retained version. Keya cannot reconstruct missing contents. |
| Deleted a credential by mistake | Restore a backup or provider file version. Keya has no recycle bin; archiving is not deletion. |
| Folder deletion synchronized | Check your provider's trash/version history; synchronization may propagate the deletion rather than restore it. |
| Browser storage cleared | Existing vault files remain on disk. Choose the folder and unlock again with the password. |
| Device stolen while unlocked | Decrypted data may be accessible. Disk encryption in Keya does not protect an already unlocked app. |

## Test your backup

Periodically copy a backup to a separate folder, open it with the appropriate password, and verify the expected keys. Never test recovery by overwriting your only working copy.

See [Security](/docs/security) for the storage threat model and [Quick Start](/docs/quick-start) for workspace setup.
