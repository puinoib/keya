---
title: Vault Health Audit
description: Understand your vault's health score, metrics, and findings.
updated: 2026-06-05
order: 4
---

The Health page runs a **local audit** of your vault — nothing is sent anywhere. It scans for expired keys, failed tests, stale endpoints, and grouping issues, then produces a score and a list of actionable findings.

Open it from the sidebar, or press `Cmd/Ctrl+3`.

## Health score

The score ranges from **0 to 100**. It starts at 100 and drops as issues are found:

| Severity | Base penalty |
|---|---|
| Critical | 18 + affected keys (up to 10) |
| Warning | 8 + affected keys (up to 10) |
| Suggestion | 3 + affected keys (up to 10) |

A vault with no keys scores 100 by default. The score updates live — fix an issue, and the score recovers immediately.

Color coding: **green** (85+), **amber** (60–84), **red** (< 60).

## Metrics

Five cards at the top give you a quick snapshot:

- **Keys** — total count.
- **Providers** — unique providers in use.
- **Failed tests** — keys whose last connectivity test failed.
- **Expiring soon** — keys expiring within 7 days.
- **Ungrouped** — keys not assigned to any group.

## Charts

Four sections break down your vault from different angles. Each chart segment is clickable and navigates to the Keys page with the relevant filter applied.

**Provider Distribution** — horizontal bars showing how your keys spread across providers. Click a provider to filter.

**Connection Health** — stacked bar of Success / Failed / Untested. Click a segment to filter by test status.

**Expiry Posture** — stacked bar of Expired / Expiring / Valid / No expiry. Click Expired or Expiring to filter.

**Group Coverage** — grouped vs ungrouped ratio.

## Findings

Below the charts, every detected issue appears as a finding card. Each card shows the severity, a description, the number of affected keys, and an action button that takes you to the filtered Keys page.

### Critical

| Finding | Meaning |
|---|---|
| Expired keys | Key's expiry date has passed. |
| Failed tests | Last connectivity test returned an error. |
| Insecure endpoints | Endpoint uses `http://` instead of `https://`. |

### Warning

| Finding | Meaning |
|---|---|
| Expiring soon | Key expires within 7 days. |
| No expiry set | Key has no expiration date — easy to forget rotation. |
| Never tested | Key has never been connectivity-tested. |

### Suggestion

| Finding | Meaning |
|---|---|
| Stale tests | Last test was 30+ days ago. |
| Stale updates | Key hasn't been updated in 90+ days. |
| Ungrouped keys | Key isn't in any group. |
| Invalid endpoints | Endpoint URL can't be parsed. |
| Placeholder endpoints | Endpoint contains `localhost`, `example.com`, or `replace`. |
| Provider concentration | Single provider covers 60%+ of keys (vault needs 5+ keys to trigger). |

## Workflow

1. Check the score. If it's green, you're in good shape.
2. Scan findings from top to bottom — critical ones first.
3. Click the action button on a finding to jump to the relevant keys.
4. Fix the issue (update the key, rotate it, test it, assign a group).
5. Return to Health — the score updates automatically.

## Related

- [Inbox](/help/inbox) — expiry reminders that surface automatically.
- [Quick Start](/help/quick-start) — adding, testing, and managing keys.
