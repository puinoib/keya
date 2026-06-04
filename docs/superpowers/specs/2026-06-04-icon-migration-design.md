# Icon Migration Design: lucide-react → Phosphor Icons

**Date:** 2026-06-04  
**Status:** Approved  
**Type:** Library Migration

## Overview

Replace all `lucide-react` icons with `@phosphor-icons/react` across the entire codebase. This migration serves two goals: design consistency and team preference alignment.

## Current State

- **Library:** lucide-react v1.17.0
- **Usage:** 40 unique icons across 19 files
- **Scope:** All UI components and pages

## Target State

- **Library:** @phosphor-icons/react
- **Icon Styles:** Regular (default), Fill (status feedback), Duotone (reserved for special cases)
- **API:** Direct Phosphor imports, no compatibility layer

## Icon Mapping Table

| Lucide Icon | Phosphor Icon | Style | Purpose |
|-------------|---------------|-------|---------|
| AlertTriangle | Warning | fill | Warning states |
| ArrowLeft | ArrowLeft | regular | Navigation back |
| ArrowRight | ArrowRight | regular | Navigation forward |
| ArrowRightLeft | ArrowsLeftRight | regular | Bidirectional sync |
| CalendarIcon | Calendar | regular | Date picker |
| Cog | Gear | regular | Settings/Configuration |
| ChevronDown | CaretDown | regular | Expand/collapse |
| ChevronRight | CaretRight | regular | Navigate forward |
| Check | Check | regular | Confirm/complete |
| CheckCircle2 | CheckCircle | fill | Success state |
| Download | DownloadSimple | regular | Download action |
| Eye | Eye | regular | Show password |
| EyeOff | EyeSlash | regular | Hide password |
| FileJson | FileCode | regular | JSON/Code files |
| FileKey | FileKey | regular | Keya/Key files |
| Filter | Faders | regular | Filter keys |
| FlaskConical | Flask | regular | API testing |
| FolderOpen | FolderOpen | regular | Open/import |
| Fingerprint | Fingerprint | regular | Biometric auth |
| Info | Info | fill | Informational |
| Key | Key | regular | API keys |
| List | List | regular | View as list |
| Loader2 | Spinner | regular | Loading state |
| Lock | Lock | regular | Locked/secure |
| LogOut | SignOut | regular | Logout action |
| Monitor | Monitor | regular | System theme |
| Moon | Moon | regular | Dark theme |
| MoreHorizontal | DotsThree | regular | More options |
| Pencil | PencilSimple | regular | Edit action |
| Plus | Plus | regular | Add/create |
| RotateCcw | ArrowCounterClockwise | regular | Reset/undo |
| Search | MagnifyingGlass | regular | Search input |
| Server | HardDrives | regular | Provider servers |
| Settings | Gear | regular | Settings page |
| Shield | Shield | regular | Security section |
| Sun | Sun | regular | Light theme |
| Trash2 | Trash | regular | Delete action |
| Upload | UploadSimple | regular | Upload action |
| X | X | regular | Close/dismiss |
| XCircle | XCircle | fill | Error state |

## Affected Files

**UI Components (5 files):**
- src/components/ui/alert-dialog.tsx
- src/components/ui/dialog.tsx
- src/components/ui/select.tsx
- src/components/ui/toast.tsx
- (2 more)

**App Components (14 files):**
- src/app/App.tsx
- src/app/components/layout/TopBar.tsx
- src/app/components/settings/SettingsPage.tsx
- src/app/components/keys/KeyForm.tsx
- (10 more)

## Implementation Strategy

### Phase 1: Setup
1. Install `@phosphor-icons/react` package
2. Create icon mapping configuration
3. (Optional) Create git backup branch

### Phase 2: Migration
1. Replace all import statements using mapping table
2. Verify each file for correct replacements
3. Run TypeScript type checking

### Phase 3: Cleanup
1. Remove `lucide-react` dependency
2. Run build and verify
3. Visual QA check

## Style Application Rules

- **Regular:** Default for all functional icons
- **Fill:** Status feedback icons (CheckCircle, XCircle, Warning, Info)
- **Duotone:** Reserved for future use if needed

## API Compatibility

Both libraries share nearly identical component APIs:
- Same prop names (className, size, strokeWidth)
- Same tree-shaking import pattern
- No component wrapper needed

## Success Criteria

- [ ] Zero lucide-react imports in codebase
- [ ] All TypeScript checks pass
- [ ] Build succeeds without errors
- [ ] Visual QA confirms no broken icons
- [ ] Icon interactions work (hover, click, animations)
