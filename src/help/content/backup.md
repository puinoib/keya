---
title: Backup & Restore
description: Copies, conflicts, and what a password change does to old files.
category: Security & data
order: 10
---

## The file is the backup

A `.keya` file is self-contained: copy it anywhere, keep as many versions as you like, and open it again with its password. There is no server state to restore.

Your cloud drive can hold the folder. Keep in mind what that means:

- every save rewrites the whole file, so the drive uploads the whole file;
- a provider that keeps version history keeps **decryptable copies** of older versions;
- two devices writing the same folder produce a conflict copy, which is still a valid vault — it opens with the same password and describes the state at the time it was written.

## Conflicts

Before writing, Keya compares the file it read with the file on disk. If they differ, the save is refused and the edit stays in memory, visible in the top bar as **Not saved — retry**.

To keep those edits:

1. Use **Export .keya** and save the downloaded file.
2. Put that copy into the workspace folder under a different file name.
3. Reopen the vault from the folder and confirm the edits are there.
4. Deal with the other copy separately; never assume Keya merged them.

Never let two tabs work on the same vault: the second write is refused for the same reason.

## Changing the password

Changing the password rewrites the whole file with a new salt: the old password stops working on the new file.

Older copies, including the ones in cloud version history, still open with the old password. Keya cannot revoke them, so treat a password change as "the file is new from here", not "the old copies are gone".

## Deleting and archiving

**Delete** removes a credential from the payload; the next save rewrites the file without it. Older copies still contain it.

**Archive** is different: the credential stays in the file, keeps its secret, and counts toward the 1,000-key limit. It is excluded from checks and from the Inbox. Delete the entries you no longer need.

## Export and restore

**Settings › Data** and the download menu in the top bar offer both exports:

- **Export .keya** writes an encrypted copy. In folder mode this is a copy, not a save. In the single-file fallback it is the save.
- **Export JSON** writes keys, providers, and groups as plain text. It is not an import format, and Keya cannot read it back.

The Data page also records the last export from this browser. To restore or move a vault, copy its `.keya` file into the workspace folder and open it with its password. Importing a file into an open vault is not built and is not planned; a second vault lives beside the first.

See [Vaults, folders & export](/docs/vaults) for the workspace and single-file fallback, and [Security](/docs/security) for the format and its limits.
