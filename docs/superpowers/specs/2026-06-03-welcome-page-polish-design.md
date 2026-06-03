# Welcome Page UI Polish Design

## Goal
Polish the `/` welcome page (all 3 modes: home, unlock, new) with visual and UX improvements while maintaining the existing Linear design system and single-card layout.

## Approach: Incremental Polish (Option A)

### 1. Layout & Sizing
- `max-w-xs` (320px) → `max-w-sm` (384px) — prevent vault name truncation
- Logo area `mb-8` → `mb-6` — more compact header
- List spacing `space-y-2.5` → `space-y-2`

### 2. Mode Transition Animations
- Wrap mode content in `<div key={mode} className="animate-fade-in">`
- Uses existing `animate-fade-in` keyframe (0.2s ease-out, opacity + translateY)
- No new dependencies needed
- Applies to all transitions: home↔unlock, home↔new

### 3. Empty State Improvement
- Replace plain text "No vaults found" with dashed-border card containing:
  - Folder icon
  - "No vaults yet" title
  - "Create your first vault to get started" subtitle
- The "New Vault" button remains visible below

### 4. Error Handling Cleanup
- Remove duplicate `error` rendering at WelcomePage line 226
- VaultPasswordDialog already handles its own errors
- WelcomePage `error` state stays for Choose Folder flow only

### 5. Footer Visibility
- Show "Your keys stay on your device" + GitHub link only in `home` mode
- Hide in unlock/new modes to reduce visual noise

### 6. VaultCard Hover Effect
- Add `hover:-translate-y-[1px] hover:shadow-elevated` on hover
- Keep existing `transition-colors` → change to `transition-all duration-150`

## Files to Modify
- `src/app/components/welcome/WelcomePage.tsx` — main page, all changes above
- `src/app/components/vault/VaultCard.tsx` — hover micro-animation
- No changes to VaultPasswordDialog, CSS, or Tailwind config
