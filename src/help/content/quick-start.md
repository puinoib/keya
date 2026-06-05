---
title: Quick Start
description: Set up a folder, create a vault, and add your first API key.
order: 2
---

# Quick Start

This walkthrough takes you from a fresh install to a working vault with one API key inside. Plan for about two minutes.

## Before you start

- Use a **Chromium-based browser** (Chrome, Edge, Arc, Brave). The folder picker relies on the File System Access API, which Firefox and Safari do not ship. If you're stuck on Firefox, see [the FAQ entry on unsupported browsers](/help/faq).
- Pick a **synced folder** for your workspace — iCloud Drive, Dropbox, Nutstore, OneDrive, or a plain local folder. The folder holds your `.keya` files, and choosing a synced folder is what makes multi-device work later.

## 1. Choose a workspace folder

The first time you open Keya you'll land on the welcome screen. Click **Open Folder** and grant access to the folder you want to use. Keya stores a handle to that folder in IndexedDB so it can read and write your vault files without re-asking on every reload.

> A good workspace is a single dedicated folder, not your entire Documents. Something like `~/iCloud Drive/Keya` keeps things tidy and limits what Keya can see.

## 2. Create your first vault

1. Click the **vault name** in the top-left of the sidebar to open the switcher.
2. Pick **New Vault**.
3. Type a master password and confirm it.

There is **no password recovery**. The encryption is designed so that nobody — not Keya, not you from a different machine — can open a vault without the exact password. Store it in a password manager.

A strong password is the foundation of the whole model. Aim for 16+ characters, or four random words.

## 3. Add your first API key

The Keys page is the default landing view after unlock.

1. Click **+ New Key** in the top-right of the list.
2. Fill in the form:
   - **Name** — a human label, like `Production OpenAI`. Required.
   - **API Key** — paste the actual key. Use the eye icon to reveal it for a moment. Required.
   - **Provider** — pick from the preset list (OpenAI, Anthropic, Google, Groq, DeepSeek, Moonshot, Zhipu, Baidu, Mistral, Cohere, Together, OpenRouter, SiliconFlow, Azure) or a custom provider you've added in Settings. Switching the provider auto-fills a sensible Endpoint.
   - **Endpoint** — defaults to the provider's standard base URL. Override it for proxies or private deployments. The ↺ icon resets the field to the default.
   - **Expiration** — optional. Useful for keys you rotate on a schedule. The detail panel shows an **Expired** or **Nd left** badge when this is set.
   - **Group** — optional folder-like organization. Leave on `Ungrouped` if you're starting fresh; you can add groups in Settings.
   - **Description** — free-form notes. Shows up in the detail panel.
3. Hit **Test** to send a no-cost probe to the provider's API. The result pill under the form turns green with a latency number, or red with the error message.
4. Click **Save Key**. If `Auto-test on save` is enabled in Settings, Keya will re-test in the background and update the badge.

## 4. Read a key back

Click any row to slide open the detail panel on the right. From there you can:

- **Reveal** the key value (eye icon) — it stays masked otherwise.
- **Copy** to clipboard. The clipboard is **cleared automatically after 15 seconds** so a stray paste elsewhere doesn't leak it.
- **Test** the key again.
- **Edit** fields.
- **Delete** the key with a confirm dialog.

## 5. Search and filter

The top of the Keys page has a search box that matches against name, provider, description, and the key value itself. As you type, filter tags appear above the list — click the × on a tag to clear that filter, or **Clear all** to reset.

You can also filter by **group** (including an `Ungrouped` bucket), **test result** (`Success`, `Failed`, `Untested`), and **expiry status** (`Expired`, `Expiring Soon`).

## 6. Lock up

- Click the **Lock** button in the top-right of the Keys page, or
- Pick **Lock** from the vault switcher, or
- Wait — Settings has an `Auto-lock` timer (default 5 minutes) that locks the vault after inactivity.

Locking purges the in-memory key and the `sessionStorage` session. The vault file on disk stays encrypted. Unlocking again requires the master password unless you're in the same browser tab and the session is still warm.

## Daily habits that pay off

- **Treat the master password like a root password.** If you lose it, the vault is gone. There is no reset email.
- **Use the workspace folder in a synced cloud drive.** That's how you get free, end-to-end-encrypted multi-device access — Keya never talks to a server, but your cloud does.
- **Test keys after rotating them.** The `Success` / `Failed` connection badges and expiry warnings are how you spot a key that quietly expired or got revoked.

## What's next?

- Read the [Security](/help/security) page to understand what's actually protecting your data.
- Skim the [FAQ](/help/faq) for the questions people ask most.
- Set up [Backup &amp; Restore](/help/backup) once you have more than a couple of keys.
