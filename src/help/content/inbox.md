---
title: Inbox
description: Expiry, connectivity, and endpoint alerts for your saved keys.
updated: 2026-10-20
order: 3
---

The Inbox collects local alerts about keys that may need attention. It does not continuously monitor provider accounts or revoke expired keys.

## Alert types

- **Expired:** the configured expiry date has passed.
- **Expiring soon:** the key expires today or within seven days.
- **Connection failed:** the recorded connectivity test failed.
- **Never tested:** no test timestamp is recorded, or the key is marked untested.
- **Insecure endpoint:** the configured endpoint starts with `http://`.
- **Stale test:** the last recorded test was at least 30 days ago.

A key without an expiry date can still generate connection or endpoint alerts. A failed connection may reflect network, CORS, endpoint, or provider problems rather than an invalid credential.

Keys whose provider cannot be verified from the browser stay silent here: Keya does not record a failure it cannot prove, so it creates neither a failed-connection nor a stale-test alert for them. Reachability checks only confirm that an endpoint responds and do not count as credential verification.

## When alerts update

Keya checks alert rules on unlock and during key changes, including test-result updates. The rules use stored fields and test results; evaluating them does not itself call a provider API. Manual and enabled automatic tests are separate operations.

## Taking action

Open Inbox from the sidebar. Use **View key** to inspect, edit, or test the affected key. Archive an item to dismiss it. Archived entries remain available in the archive section.

When an issue disappears, open alerts are automatically archived as resolved. For example, a successful test resolves a connection-failed alert, and removing a key resolves its outstanding alerts.

**Current limitation:** archived items remain archived even if the same alert type recurs for the same key, including items automatically archived as resolved. An empty Inbox is therefore not proof that every key is healthy. Review current key details and test results as well.

## A useful routine

1. Rotate or update expired keys and check expiry dates after rotation.
2. Investigate failed tests before treating the key as invalid.
3. Replace insecure endpoints with a trusted HTTPS endpoint where supported.
4. Retest stale results when appropriate. Provider tests may be rate-limited, and custom metered endpoints may incur charges.

See [Quick Start](/docs/quick-start) for key management and [Security](/docs/security) for API-testing limits.
