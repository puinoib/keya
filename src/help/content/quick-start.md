---
title: Quick Start
description: Choose a folder, create a vault, and add a credential.
updated: 2026-03-01
order: 2
---

## 1. Choose a folder

Open the app and select **Choose folder**. Keya remembers the folder handle, but browsers still ask for permission again after a reload or a restart.

Every `.keya` file in that folder is a vault. Nested folders are not scanned.

## 2. Create a vault

**New vault** asks for a file name, a vault name, and a master password.

The password is the only thing protecting the file. It is judged when you create it or change it — length in characters, and whether it looks guessable — but never on unlock, because files written earlier must keep opening. There is no recovery: a forgotten password means the file stays closed.

## 3. Add a credential

**New key** takes:

- **Name** and **description** — what this credential is for.
- **Provider** — a preset, a custom provider, or *Unassigned*. Unassigned is a real state: you can store the secret before you know where it is used.
- **Endpoint** — the service's base address, without a query string. Leave it empty if you do not know it; the credential is still stored.
- **Secret** — the token itself. It is stored inside the encrypted payload.
- **Group** — optional.
- **Expiry** — a calendar day (expires at the end of that day in *your* timezone), an exact instant (the same moment everywhere), or nothing.

Changes are written to the file shortly after you make them. The header shows `save: dirty` until they land.

## 4. Check it (optional)

**Check now** sends a `GET` request to the provider's target with the credential in the slot the recipe names.

The first check asks for approval and shows the exact destination. **Always allow this destination** remembers it for that key; **Just once** allows a single request. Plaintext `http:` destinations can only be approved once.

A successful check means one of two different things, and Keya keeps them apart:

- *request accepted* — the endpoint answered 2xx; this does not prove the credential is valid;
- *credential accepted* — the provider's endpoint requires the credential, so a 2xx does prove it.

A failed request, a timeout, or a blocked cross-origin answer is never reported as an invalid credential.
