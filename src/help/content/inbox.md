---
title: Inbox
description: Expiry reminders that surface automatically when keys need attention.
updated: 2026-06-05
order: 3
---

The Inbox tracks API keys that are about to expire or have already expired. Items appear and disappear automatically — you don't need to add anything manually.

Open it from the sidebar (first item), or press `Cmd/Ctrl+2`.

## How items appear

Keya scans your vault whenever you unlock, add, edit, or delete a key. An inbox item is created when:

- **Expired** — the key's expiry date has passed.
- **Expiring soon** — the key expires within 7 days.

Keys without an expiry date never generate inbox items.

## Two states

| State | Meaning |
|---|---|
| **Open** | Needs your attention. Shown in the "Open reminders" section. |
| **Archived** | You've handled it, or the issue resolved itself. |

Three metric cards at the top show the current count: **Open**, **Critical** (expired), and **Archived**.

## Taking action

Each open reminder has two buttons:

- **View key** — jumps to the Keys page with that key selected, so you can update, rotate, or test it.
- **Archive** — dismisses the reminder. Use this after you've handled the key.

Items are archived one at a time. There is no bulk action.

## Auto-archive

If you fix the underlying issue — extend the expiry date, remove the expiry, or delete the key — the corresponding reminder is **archived automatically** with a "resolved" label. You don't need to dismiss it manually.

Archived items show how they were closed: "Archived automatically after the issue was resolved" or "Archived by you."

## Notifications

When new reminders appear during unlock, Keya shows a toast notification in the corner with the count. Click **Open Inbox** in the toast to jump straight there. Silent syncs (after editing a key) don't trigger notifications — only new items do.

## Workflow

1. Check the Inbox when the sidebar badge shows a count.
2. For each expired key: rotate it, update the expiry, or archive if no longer needed.
3. For each expiring-soon key: plan a rotation before it stops working.
4. Archive reminders as you handle them.

## Related

- [Vault Health Audit](/help/health) — broader vault analysis beyond expiry.
- [Quick Start](/help/quick-start) — setting expiry dates on keys.
