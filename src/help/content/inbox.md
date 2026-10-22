---
title: Inbox
description: What appears in the Inbox, and what archiving an item means.
updated: 2026-03-01
order: 3
---

The Inbox is computed from the vault plus what this device knows. Nothing about it is stored in the file, so the list is always current.

## What appears

From the vault:

- **Expires soon** — within seven days of the expiry.
- **Expired** — past the expiry.
- **Plaintext destination** — the request would go out over `http:`.

From this device only:

- **Never checked** — no check has run for the current configuration.
- **Last check failed** — the most recent result was a rejection or a failure.
- **Last check is stale** — the most recent result is more than thirty days old.

A provider that cannot be checked at all never produces the last three: "never checked" would be a permanent complaint about something impossible.

**View** opens the credential the item is about. Acting on the credential — extending the expiry, rotating the secret, changing the endpoint, running a check — removes the item on its own.

## Archiving

**Archive** dismisses the item for the fact it currently describes. It does not change the vault, and it does not stop the underlying situation from mattering.

The decision belongs to this device:

- switching to another device brings the item back once, so it can be re-reviewed there;
- clearing site data does the same.

Archived items stay visible under **Archived** at the bottom of the list, with the date you put them away. There is no separate undo: the item returns on its own once the underlying fact changes, because a dismissal only ever described the fact it was dismissed for.

A dismissal stops applying when the fact behind it changes. Moving an expiry to a new date, or a destination to a new host, brings the item back on its own; moving the expiry back to the value you dismissed restores the old decision.

## Checks and the Inbox

A successful check clears a previous "last check failed", so a later failure is reported again. Renaming a key, moving it to another group, or writing a new description never affects the Inbox; rotating the secret or changing the destination does.
