---
title: FAQ
description: Browsers, recovery, and the known gaps in this build.
category: Settings & help
order: 11
---

## Which browsers work?

Chrome and Edge for the folder workflow, because it needs the File System Access API. Firefox and Safari cannot open a folder, but they can open one `.keya` file and export a replacement. Edits in that fallback are not saved automatically; **Export .keya** is the save. See [Vaults, folders & export](/docs/vaults).

## I forgot my password. Can you reset it?

No. There is no recovery key, no server, and no backdoor. The password is the only input to the key derivation.

## Why do I have to type it again after a reload?

The password is discarded as soon as the file is unlocked. Keya does not keep it in memory between sessions, in session storage, or anywhere on disk, so a reload is a new unlock. This is the intended trade: nothing to recover, nothing to leak.

## Why does a check say "Reachable" instead of "Verified"?

A `GET` that returns 2xx only proves the service answered. Unless the preset knows that its endpoint requires the credential, the honest conclusion is "the request was accepted". Only endpoints with real authentication semantics can be reported as **Verified**. See [Checks & usage](/docs/checks).

## A check fails with "could not complete the request". Is my key wrong?

Probably not. The browser cannot distinguish a missing CORS header, a DNS failure, a TLS problem, or being offline, so all of them are reported the same way. A timeout is also not a verdict on the credential. Configure the exact final endpoint — Keya does not follow redirects, so a `301` to a trailing slash looks like a network failure.

## Why does the Inbox look the same on every device?

Because the expiry and rejection rules are computed from the file, this device's checks, and the current time — there is no "dismissed" record anywhere. An item goes away when you fix the fact behind it (change the date, pass a check) or archive the key.

The one thing that differs between devices is Housekeeping: each device knows only about the checks it ran itself, so a new device offers to check everything once. See [Inbox](/docs/inbox).

## Why is there no automatic checking?

Every request that carries a credential needs a click. A standing permission stored on the device could stand in for that click after a copied file or a changed destination, so Keya does not keep one. Keys checked by hand are the whole feature.

## What is not in this build?

- Importing `.keya` files or JSON exports. There is no importer, and none is planned: a second vault is opened from the welcome screen and lives beside the first rather than being merged into it.
- Automatic or scheduled checks.
- A biometric fallback that does not require WebAuthn PRF.

Anything stored in this build is in the `.keya` file or in this browser's storage; nothing else leaves the device.
