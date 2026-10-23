---
title: Quick Start
description: Choose a folder, create a vault, and add a credential.
category: Getting started
order: 2
---

## 1. Choose a folder

Open the app and select **Choose Sync Folder**. Pick a folder reserved for Keya. The browser asks for permission again after a reload or a restart.

Every `.keya` file directly inside that folder is a vault. Nested folders are not scanned.

To point Keya at another folder later, open the vault menu at the top of the sidebar and choose **Change Sync Folder…**. Keya saves and locks the current vault first, then returns to the welcome screen for the new folder. The `.keya` files themselves stay where they are.

## 2. Create a vault

**New Vault** asks for a vault name and a master password. The file name is derived from the vault name; when no name is entered, Keya generates one. A file with an existing name is rejected rather than overwritten.

The password is the only thing protecting the file. It is judged when you create it or change it — length in characters, and whether it looks guessable — but never on unlock, because files written earlier must keep opening. There is no recovery: a forgotten password means the file stays closed.

## 3. Add a credential

**Add Key** opens the credential form:

- **Name** and **description** — what this credential is for.
- **Service / Provider** — a preset, a custom provider, or **Custom** for a credential you have not assigned yet.
- **Endpoint** — the service's base address. Leave it empty if you do not know it; the credential is still stored.
- **API Key or Token** — the secret itself. It is stored inside the encrypted payload.
- **Group** — optional.
- **Expiration** — a calendar day. It expires at the end of that day in *your* timezone, or never when left empty.

In folder mode, changes are written to the file shortly after you make them. In the single-file fallback there is no writable file: **Export .keya** is the save. See [Vaults, folders & export](/docs/vaults).

## 4. Test it (optional)

**Test key** sends a `GET` request to the provider's target with the credential in the slot the recipe names.

Every test asks for approval and shows the exact destination. **Send** allows that one request; **Send in clear text** does the same for a plain `http:` destination, which is never remembered. The approval expires after about twenty seconds, and cancelling sends nothing.

A successful test means one of two different things, and Keya keeps them apart:

- **Reachable** — the endpoint answered 2xx; this does not prove the credential is valid;
- **Verified** — the provider's endpoint requires the credential, so a 2xx does prove it.

A failed request, a timeout, or a blocked cross-origin answer is never reported as an invalid credential. [Checks & usage](/docs/checks) explains the outcomes, the providers that cannot be checked, and the usage card.
