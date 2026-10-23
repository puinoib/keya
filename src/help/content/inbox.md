---
title: Inbox
description: What the Inbox shows, and how each item goes away.
updated: 2026-03-02
order: 3
---

The Inbox is computed from the vault plus what this device knows. Nothing about it is stored in the file and nothing is stored on the device, so the list is always current — and the same file shows the same list on every device.

## What appears

Only two things, because only two are both time-sensitive and fixable:

- **Expires soon** — within seven days of the expiry.
- **Expired** — past the expiry.
- **Rejected** — the newest check was answered with "this credential is not accepted" (401 or 403).

## What does not appear

- **Plain http destinations.** That is a property of the configuration, not a task. The key itself shows a standing warning.
- **Never checked / not checked lately.** That is this device's own record, not a problem with the key. It lives in **Housekeeping**, collapsed and quiet, with a **Check all** button.
- **Network errors and timeouts.** The request never reached a verdict, so Keya will not claim the credential is bad. The key says "could not verify" instead.
- **A key whose provider cannot be checked at all.** Nothing is reported as failed where no request could have been made.

## How an item goes away

There is nothing to dismiss or archive. An item stays until its fact changes:

- fix the expiry date, or archive the key;
- run a check that the provider accepts, or archive the key.

That is deliberate. A dismissal would be a decision stored on one device, so the same vault would show different lists on your laptop and your desktop. Instead, every item maps to something you can do to the vault.

The sidebar count shows only these items. It is normally zero, and that is the point.

## Housekeeping

This device's check history is its own. A new device knows nothing about checks you ran elsewhere, so it lists every checkable key as "never verified on this device". That is not a warning about the keys; it is an offer to check them. Nothing there is counted, announced or badged.

A successful check clears a previous rejection, so a later rejection is reported again.
