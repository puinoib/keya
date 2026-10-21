---
title: Backup & Restore
description: Copies, conflicts, and what a password change does to old files.
updated: 2026-03-01
order: 5
---

## The file is the backup

A `.keya` file is self-contained: copy it anywhere, keep as many versions as you like, and open it again with its password. There is no server state to restore.

Your cloud drive can hold the folder. Keep in mind what that means:

- every save rewrites the whole file, so the drive uploads the whole file;
- a provider that keeps version history keeps **decryptable copies** of older versions;
- two devices writing the same folder produce a conflict copy, which is still a valid vault — it opens with the same password and describes the state at the time it was written.

## Conflicts

Before writing, Keya compares the file it read with the file on disk. If they differ, the save is refused and the edit stays in memory, visible as `save: dirty`.

Resolve it by exporting the current state before reopening, or by copying the file aside and reopening the vault. Never let two tabs work on the same vault: the second write will be refused for the same reason.

## Changing the password

Changing the password rewrites the whole file with a new salt: the old password stops working on the new file.

Older copies, including the ones in cloud version history, still open with the old password. Keya cannot revoke them, so treat a password change as "the file is new from here", not "the old copies are gone".

## Deleting

Deleting a credential from the vault removes it from the payload; the next save rewrites the file without it. Older copies still contain it.

Archiving is different: the credential stays in the file, keeps its secret, and **counts toward the 1,000-key limit**. Delete the entries you no longer need.
