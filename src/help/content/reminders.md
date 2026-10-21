---
title: Reminders
description: What triggers an alert, and what dismissing one means.
updated: 2026-03-01
order: 3
---

Reminders are computed from the vault plus what this device knows. Nothing is stored in the file except the vault itself, so the list is always current.

## What triggers a reminder

From the vault:

- **Expires soon** — within seven days of the expiry.
- **Expired** — past the expiry.
- **Plaintext destination** — the request would go out over `http:`.

From this device only:

- **Never checked** — no check has run for the current configuration.
- **Last check failed** — the most recent result was a rejection or a failure.
- **Last check is old** — the most recent result is more than thirty days old.

A provider that cannot be checked at all never produces the last three: “never checked” would be a permanent complaint about something impossible.

## Dismissing

**Dismiss** silences a reminder for the fact it currently describes. It does not change the vault.

The decision belongs to this device, which has two consequences worth knowing:

- switching to another device brings the reminder back once, so it can be re-reviewed there;
- clearing site data does the same.

Dismissals are inspected and undone in **Silenced** next to the reminder list. Restoring one shows the reminder again immediately — an alert you cannot find again would be a one-way door.

A dismissal stops applying when the fact behind it changes. Moving an expiry to a new date, or a destination to a new host, brings the reminder back on its own; moving the expiry back to the value you dismissed restores the old decision.

## Checks and reminders

A successful check clears a previous “last check failed”, so a later failure is reported again. Renaming a key, moving it to another group, or writing a new description never affects reminders; rotating the secret or changing the destination does.
