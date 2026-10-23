---
title: Providers
description: Presets, custom providers, and the check recipe.
category: Daily use
order: 5
---

## Presets

Open **Settings › Providers** to see the built-in providers grouped by category. A toggle removes a preset from the add-key picker; existing keys keep their provider and their check recipe. Turning it back on restores it to the picker.

Presets are data in this build. Their default endpoint and check recipe are fixed; changing either one is an application change, not a preference.

## Custom providers

Add a custom provider for any service that is not a preset, including search, scraping, email, payments, cloud, and internal APIs. A custom provider has:

- **Name** — the label shown in the picker and on keys.
- **Description** — optional context.
- **Default endpoint** — prefilled into a new key's endpoint field. It is a convenience; the key stores the endpoint that is actually used.

A custom provider may also carry a check recipe:

- **Reachability only** — currently leaves the provider without a probe. Keya sends nothing for it, so keys cannot be tested.
- **Bearer token** — `Authorization: Bearer <secret>`.
- **Basic auth** — the secret as the password in Basic authentication.
- **x-api-key header** — the secret in `x-api-key`.
- **Custom header** — the secret in a header you name.
- **Query parameter** — the secret in a query parameter you name.
- **Path** — empty for the endpoint itself, a path starting with `/`, or an absolute URL.

Header and query-parameter names are restricted to letters, digits, dot, underscore, and hyphen. Invalid recipes are refused when saved. A custom provider with no probe cannot be tested; Keya sends nothing and the key says so.

Renaming a custom provider keeps existing keys attached to it. Removing one leaves those keys pointing at no provider, so they display as **Custom** until reassigned.

## Endpoints

The endpoint stored on a key is the base address used to build a check or usage request. A preset fills in its default, and the reset button in the key form restores that default. An endpoint with a query string is rejected; the credential slot may add its own query parameter.

## Plain http

A custom provider can point at an `http:` endpoint. Keya allows the key and the check, but every send needs a fresh clear-text approval, and usage queries are refused. Prefer `https:` for anything that leaves the device.
