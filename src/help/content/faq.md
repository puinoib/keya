---
title: FAQ
description: Common questions about cost, sync, recovery, and behavior.
updated: 2025-06-05
order: 3
---

# FAQ

## Is Keya free?

Yes. Keya is MIT-licensed open source. No subscription, no pro tier, no "team" plan.

## Does Keya send my keys anywhere?

No. Keya is a static web app. It has no backend, no analytics, and no remote calls other than the ones you explicitly make — the **Test Key** button sends a request to the provider you configured, and that's the only outbound traffic.

## Where exactly is my data stored?

Two places, both on your machine:

1. **Vault files (`*.keya`)** in the workspace folder you picked. These are the actual encrypted blobs. Move them like any other file.
2. **Cached metadata in IndexedDB** — the database name is `keya-meta`. It caches the workspace handle, a small summary per vault (name, icon, key count, last update), and biometric credentials if you opted in. The cache is not a copy of your keys.

Deleting the IndexedDB cache does not delete your `.keya` files. Deleting the `.keya` files does not delete the IndexedDB cache.

## I forgot my master password. Can you reset it?

No. The whole security model depends on nobody being able to decrypt your vault without that exact password — including us. Without the password, the `.keya` file is a useless block of ciphertext.

If you have a backup of the `.keya` file from a time you remember the password, restore that file. Otherwise the data is gone. **Store the master password in a password manager.**

## How do I use multiple vaults?

Open the vault switcher in the top-left of the sidebar. You'll see all `.keya` files in your workspace folder, plus a **New Vault** option. Switching prompts for the target vault's master password. Active vaults are tagged in the list.

Vaults are independent — they have separate master passwords, separate key lists, separate settings.

## My browser can't pick a folder. What now?

Keya needs the **File System Access API** to read and write to a workspace folder. That's currently shipped in Chrome, Edge, Arc, Brave, and other Chromium-based browsers. Firefox and Safari do not support it.

You have two options:

1. **Switch to a Chromium-based browser** for the initial setup. After the first unlock, the session is kept in `sessionStorage` for the duration of the tab, so you can keep using Keya in a Chromium browser without re-picking the folder on every reload.
2. **Use the file picker fallback.** Some browsers expose an upload-style picker that downloads the vault file. Save it to your synced folder manually, then point Keya at that folder once you switch browsers.

## Will my cloud drive conflict with itself?

Your cloud drive is the source of cross-device sync — Keya itself doesn't sync anything. iCloud Drive, Dropbox, Nutstore, and OneDrive all use a last-write-wins model, which means simultaneous edits on two devices can lose one of the writes.

The honest answer: **use Keya on one device at a time per vault.** That's the safest pattern. If you have to share a vault across machines, finish all your edits on machine A, wait for the cloud to sync, then open the same vault on machine B.

## How does biometric unlock work?

Biometric unlock is a convenience for the master password, not a replacement for it. When you register a fingerprint or face, Keya stores a WebAuthn passkey scoped to that specific vault. The next time you open the same vault on the same device, you can unlock with a tap.

Biometric credentials are per-device — enrolling on your laptop doesn't enroll your phone. The passkey is stored in IndexedDB on the device that enrolled it, and is not synced to the cloud.

## What is a "provider"?

A provider is a label that bundles a name with a default API endpoint, so the key form can pre-fill the URL. Keya ships with presets: OpenAI, Anthropic, Google, Groq, DeepSeek, Moonshot, Zhipu, Baidu, Mistral, Cohere, Together, OpenRouter, SiliconFlow, and Azure.

You can add **custom providers** in Settings for anything else (private deployments, self-hosted gateways, OpenAI-compatible APIs). The label is purely organizational — the **Test** button sends a request to whatever Endpoint you typed, regardless of the provider.

## How do I move Keya to a new computer?

1. Make sure the workspace folder is syncing through your cloud drive. It will appear on the new machine.
2. Install Keya (or open the URL) in a Chromium-based browser on the new machine.
3. Pick the same workspace folder.
4. Each `.keya` will appear in the vault switcher. Unlock with the master password.

If you didn't use a cloud drive, copy the `.keya` files manually and put them in a folder on the new machine.

## Can I export a single key to share with a teammate?

Not directly. Keya operates on whole vaults, not individual keys. The practical options:

- **Create a separate vault** with the key, share the `.keya` file through a channel you trust, and tell the recipient the master password through a different one.
- **Copy the key value** from the detail panel and paste it into your team's existing secret manager.

Both approaches assume the receiving party uses an end-to-end channel for the password. Never email a `.keya` file and the password in the same message.

## How do I report a bug or request a feature?

Open an issue on the GitHub repository. Include:

- Browser and version
- A description of the expected vs actual behavior
- A minimal `.keya` (or scrubbed version) if the issue is data-related

## Where's the source code?

See the GitHub link in the project footer. Everything — encryption, file format, UI — is in one repository under MIT.

---

## Settings

### How do I change my master password?

Settings → General → Master Password → **Change**. You'll need to enter your current password, then the new one (minimum 8 characters). Keya shows a strength meter — aim for **Strong** (four bars).

If biometric unlock is active, Keya re-registers your biometric credential automatically after the password change.

### How do groups work?

Groups are optional tags for organizing keys — like folders but flatter. Keya starts with two built-in groups: **Production** and **Development**.

To manage groups, go to Settings → Groups → **Manage Groups**. You can:
- **Add** a group with a name and an emoji icon.
- **Rename** an existing group inline.
- **Delete** a group (keys in that group become ungrouped, they are not deleted).

Assign a group when adding or editing a key. On the Keys page, use the filter bar to show only keys in a specific group.

### How do I disable a provider or add a custom one?

Settings → Providers.

- **Disable a preset** — toggle off any provider you don't use. It won't appear in the provider dropdown when adding a key, but existing keys keep their provider label.
- **Add a custom provider** — click **Add Custom Provider** at the bottom, enter a name and endpoint URL. This is useful for self-hosted gateways, OpenAI-compatible APIs, or corporate proxies.

### What do the Keys settings do?

Settings → Keys has three toggles:

| Setting | What it does |
|---|---|
| **Auto-Test on Save** | Runs a connection test every time you save a key |
| **Daily First-Open Test** | Tests all keys automatically the first time you open Keya each day |
| **Detect Clipboard on Add** | When you click "Add Key", pre-fills the key field if it detects an API key pattern on your clipboard |

### What keyboard shortcuts are available?

Settings → Shortcuts shows the full list. The defaults:

- `/` — focus search
- `N` — add a new key
- `Cmd/Ctrl+Shift+L` — lock vault
- `J` / `K` or arrow keys — navigate between keys
- `Enter` — open key detail
- `C` — copy key value
- `E` — edit, `T` — test, `V` — reveal, `Delete` — delete

Click any shortcut row to re-record it with your preferred key combo. Conflicts are caught automatically. Use **Reset all** to go back to defaults.
