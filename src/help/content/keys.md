---
title: Keys & groups
description: Find, edit, archive, and organize credentials.
category: Daily use
order: 3
---

## The key list

Click a row to open its detail panel. The row shows the provider, the newest check result, and an expiry warning when one applies. The search box in the top bar covers the whole vault, including archived entries, so a retired key stays findable.

The list can be narrowed by provider, test result, and expiry. A group filter appears as a tag beside those menus. **Clear all** removes every filter and the search text.

## Adding and editing

**Add Key** and the detail panel's **Edit** use the same fields described in [Quick Start](/docs/quick-start). Editing is recorded in the vault and saved the same way as any other change. **Delete** asks for confirmation and removes the credential from the payload; older copies of the file still contain it.

Copying a secret is a best-effort convenience. Keya can clear the clipboard after a delay, but only if the value is still the one it wrote; a denial of clipboard access leaves it untouched. The delay is set in **Settings › General** — 15 seconds by default, up to one minute, or off.

## Archive

Archiving keeps the credential and its secret in the file, but removes it from the active list, from checks, and from the Inbox. The Archived list has its own view, and **Restore** puts a credential back. Archived entries still count toward the 1,000-key limit, so delete the ones you no longer need.

## Groups

Create groups in **Settings › Groups**. A group has a name and an icon, and the key form can assign a credential to one. Deleting a group does not delete its keys; they become ungrouped. Two groups may share a name; each keeps its own id.

## Limits

A vault holds at most 1,000 keys, 500 groups, and 200 custom providers. A secret may be up to 8,192 bytes, and names and descriptions have their own length caps. These are file-format limits, not UI suggestions: the payload is rejected rather than truncated.
