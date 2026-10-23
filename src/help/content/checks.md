---
title: Checks & usage
description: What a test sends, what its result means, and where usage numbers come from.
category: Daily use
order: 4
---

## Test key

**Test key** in the list or the detail panel sends one `GET` request to the provider's check target, with the credential placed in the slot the recipe names. A preset recipe is fixed data; a custom provider uses the recipe configured in [Settings › Providers](/docs/providers).

Every test needs a fresh approval. A toast shows the exact URL that will be reached, and the request is sent only after **Send**. A plain `http:` destination uses **Send in clear text** and is confirmed every time. Nothing is remembered that could act as a standing permission, and closing the toast or letting it time out sends nothing. Locking the vault also aborts a test that is already in flight.

## What the result means

- **Verified** — the provider's endpoint requires the credential, so a 2xx proves the credential was accepted.
- **Reachable** — the endpoint answered, but the request does not prove anything about the credential. This is the honest ceiling for a generic recipe.
- **Failed** — Keya recorded a controlled outcome. Only `401` and `403` mean the provider rejected the credential; a network error, a timeout, rate limiting, or an unexpected response does not.

A failed request is never described as an invalid key. The browser cannot distinguish a missing CORS header, DNS failure, TLS problem, or being offline, and Keya does not follow redirects, so a `301` can look like a network failure.

## Providers that cannot be checked

Some provider and key combinations have no request a browser can make. Examples are a provider with no configured check, a recipe whose target is unusable, and Amazon Bedrock API keys whose only read-only model listing is regional. These show **Cannot verify** and send nothing. The key is still stored and usable outside Keya.

A plain `http:` endpoint is checkable, but the key travels in clear text. The key detail keeps a standing warning, and the Inbox does not treat it as a task.

## Usage and allowances

The **Usage** card on a key's detail panel reads the provider's own allowance metadata. It is not a Keya estimate, and Keya never invents a financial figure.

- **Check usage** (or **Refresh**) asks the provider once. The click approves that exact request; no separate destination dialog is shown, and nothing is stored in the vault.
- The figures are cached for this tab only: current for about 15 minutes, shown with a stale warning afterwards, and dropped after 24 hours or when the tab closes. A cached failure is never replayed.
- The collapsed card shows the tightest window first. Expanding it lists every window the provider reports, with the provider's reset time when it states one.
- Usage is refused for a plain `http:` endpoint because the key would travel in clear text.
- Only providers with a known metadata endpoint are supported. Today that is OpenCode Go; other providers either show why they cannot report usage or show no card at all.

Usage responses never enter the `.keya` file, the Inbox, or another device.

## Where results live

Check results and the check history are device state, stored unencrypted in this browser and tied to the current credential and destination. A result recorded for an older secret or endpoint is ignored. Deleting or archiving a key drops its local result. See [Security](/docs/security) for what else is stored, and [Inbox](/docs/inbox) for the only two results that become tasks.
