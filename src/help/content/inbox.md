---
title: Inbox
description: What the Inbox shows, and how each item goes away.
category: Daily use
order: 6
---

The Inbox is computed from the vault, this device's check history, and the current time. The list itself is not stored anywhere, so there is nothing to sync: an expiry item is the same on every device, while a rejection is reported only on the device whose check produced it. This device's history is stored locally; it is not written into the file.

## What appears

Two rules, because only these are both time-sensitive and fixable:

- **Due soon** — within seven days of the expiry.
- **Expired** — past the expiry.
- **Rejected** — the newest check was answered with `401` or `403`.

## What does not appear

- **Plain http destinations.** That is a property of the configuration, not a task. The key itself shows a standing warning.
- **Never checked / not checked lately.** That is this device's own record, not a problem with the key. It lives in **Housekeeping**, collapsed and quiet, with a **Check all** button.
- **Network errors and timeouts.** The request never reached a verdict, so Keya will not claim the credential is bad. The key says "could not verify" instead.
- **A key whose provider cannot be checked at all.** Nothing is reported as failed where no request could have been made.
- **Archived keys.** Archiving removes a key from the Inbox and from checks.

## How an item goes away

There is nothing to dismiss or archive in the Inbox itself. An item stays until its fact changes:

- fix the expiry date, clear it, or archive the key;
- run a test that the provider accepts, or archive the key.

That is deliberate. A dismissal would be a decision stored on one device, so the same vault would show different lists on your laptop and your desktop. Instead, every item maps to something you can do to the vault.

The sidebar count shows only these items. It is normally zero, and that is the point.

## Housekeeping

This device's check history is its own. A new device knows nothing about checks you ran elsewhere, so it lists every checkable key as "never verified on this device". That is not a warning about the keys; it is an offer to check them. Nothing there is counted, announced, or badged.

A successful check clears a previous rejection, so a later rejection is reported again. **Check all** names every destination in a single prompt, then runs the same one-request approval for each key. Declining the prompt sends nothing.
