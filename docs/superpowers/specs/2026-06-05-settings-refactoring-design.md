# Settings Page Refactoring Design

Date: 2026-06-05

## Overview

Refactor the single-page settings into multiple sub-pages with a sidebar navigation, improving navigation, reducing content length, and providing more space for complex sections like Shortcuts and Providers.

## Goals

1. Better navigation - each setting as independent page with shareable URLs
2. Reduce content length - single page has too much scrolling
3. More space for complex sections - Shortcuts, Providers need larger display area

## Page Structure

| Path | Name | Content |
|------|------|---------|
| `/settings/general` | General | Vault name/icon, biometric unlock, auto-lock |
| `/settings/keys` | Keys | Auto-test on save, daily first-open test, clipboard detection |
| `/settings/providers` | Providers | Provider management (converted from Dialog to page) |
| `/settings/shortcuts` | Shortcuts | Keyboard shortcuts customization |
| `/settings/groups` | Groups | Group management |
| `/settings/about` | About | Help center link, version info, license |

## Layout Design

### Two-column layout with fixed sidebar

```
┌─────────────────────────────────────────────────┐
│  ← Back to app                                  │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  ⚙ General   │      Content area                │
│  🔑 Keys     │      (max-w-2xl mx-auto)         │
│  🌐 Providers│                                  │
│  ⌨ Shortcuts │                                  │
│  📁 Groups   │                                  │
│  ❓ About    │                                  │
│              │                                  │
│              │                                  │
└──────────────┴──────────────────────────────────┘
```

- Sidebar width: ~180px, fixed position
- Content area: adaptive width, centered content
- Sidebar style: icon + text, highlighted selected item

### Default Route

`/settings` redirects to `/settings/general`

## Route Structure

TanStack Router file-based routing:

```
routes/
├── _authenticated.settings.tsx          # Index, redirect to general
├── _authenticated.settings.general.tsx  # General page
├── _authenticated.settings.keys.tsx     # Keys page
├── _authenticated.settings.providers.tsx # Providers page
├── _authenticated.settings.shortcuts.tsx # Shortcuts page
├── _authenticated.settings.groups.tsx   # Groups page
├── _authenticated.settings.about.tsx    # About page
```

TanStack Router automatically handles `_authenticated.settings.*` as nested routes under `_authenticated.settings`.

## Component Structure

```
app/components/settings/
├── SettingsSidebar.tsx      # New: sidebar navigation
├── SettingsLayout.tsx       # Modified: includes sidebar + Outlet
├── GeneralPage.tsx          # New: Vault + Security settings
├── KeysPage.tsx             # New: Keys test-related settings
├── ProvidersPage.tsx        # New: Provider management (from Dialog)
├── ShortcutsPage.tsx        # New: Shortcuts settings
├── GroupsPage.tsx           # New: Groups management
├── AboutPage.tsx            # New: Help + version info
└── ManageProvidersDialog.tsx # Delete (or keep as backup)
```

## Implementation Steps

1. Create SettingsSidebar component
2. Update SettingsLayout to include sidebar
3. Create 6 page components (splitting current SettingsPage)
4. Create route files for each sub-page
5. Update index route to redirect to general
6. Convert ManageProvidersDialog content to ProvidersPage
7. Remove or archive old SettingsPage and ManageProvidersDialog

## Dependencies

- TanStack Router (already installed)
- Zustand store (already in use)
- Existing UI components (Input, Select, Toggle, Button)

## Notes

- Providers management changed from Dialog to dedicated page as requested
- Help section expanded to About page with version/license info
- Flat URL structure chosen for simplicity