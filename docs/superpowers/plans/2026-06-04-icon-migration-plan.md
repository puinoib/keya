# Icon Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all lucide-react icons with @phosphor-icons/react across the codebase

**Architecture:** Direct replacement using import statement updates. No compatibility layer. API-compatible (same props: className, size, strokeWidth).

**Tech Stack:** @phosphor-icons/react (replaces lucide-react), TypeScript, Vite

---

## File Structure

**Create:**
- None (no new files needed)

**Modify:**
- `package.json` - Update dependencies
- 19 component files - Replace import statements

---

## Task 1: Install Phosphor Icons

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @phosphor-icons/react**

```bash
pnpm add @phosphor-icons/react
```

Expected output: Package installed successfully

- [ ] **Step 2: Verify installation**

```bash
grep "@phosphor-icons/react" package.json
```

Expected: Output shows the dependency

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: install @phosphor-icons/react"
```

---

## Task 2: Replace imports in App.tsx

**Files:**
- Modify: `src/app/App.tsx:1`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Loader2 } from "lucide-react"
```

With:
```typescript
import { Spinner } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace all `Loader2` with `Spinner` in the component

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx
git commit -m "migrate: replace Loader2 with Spinner in App.tsx"
```

---

## Task 3: Replace imports in TopBar.tsx

**Files:**
- Modify: `src/app/components/layout/TopBar.tsx:3`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Search, Plus, Sun, Moon, Monitor, Download, Upload, FileKey, FileJson, MoreHorizontal } from "lucide-react"
```

With:
```typescript
import { MagnifyingGlass, Plus, Sun, Moon, Monitor, DownloadSimple, UploadSimple, FileKey, FileCode, DotsThree } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace all instances:
- `Search` → `MagnifyingGlass`
- `Download` → `DownloadSimple`
- `Upload` → `UploadSimple`
- `FileJson` → `FileCode`
- `MoreHorizontal` → `DotsThree`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/layout/TopBar.tsx
git commit -m "migrate: replace icons in TopBar.tsx"
```

---

## Task 4: Replace imports in SettingsPage.tsx

**Files:**
- Modify: `src/app/components/settings/SettingsPage.tsx:2`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Settings as SettingsIcon, Palette, Fingerprint, Loader2, FlaskConical, Server, Shield, ChevronRight } from "lucide-react"
```

With:
```typescript
import { Gear, Palette, Fingerprint, Spinner, Flask, HardDrives, Shield, CaretRight } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace all instances:
- `SettingsIcon` → `Gear`
- `Loader2` → `Spinner`
- `FlaskConical` → `Flask`
- `Server` → `HardDrives`
- `ChevronRight` → `CaretRight`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/settings/SettingsPage.tsx
git commit -m "migrate: replace icons in SettingsPage.tsx"
```

---

## Task 5: Replace imports in ManageProvidersDialog.tsx

**Files:**
- Modify: `src/app/components/settings/ManageProvidersDialog.tsx`

- [ ] **Step 1: Find import line**

```bash
grep -n "lucide-react" src/app/components/settings/ManageProvidersDialog.tsx
```

- [ ] **Step 2: Update import statement**

Replace:
```typescript
import { Plus, Trash2, Check, X, Eye, EyeOff } from "lucide-react"
```

With:
```typescript
import { Plus, Trash, Check, X, Eye, EyeSlash } from "@phosphor-icons/react"
```

- [ ] **Step 3: Update component usage**

Replace `Trash2` with `Trash` and `EyeOff` with `EyeSlash`

- [ ] **Step 4: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/app/components/settings/ManageProvidersDialog.tsx
git commit -m "migrate: replace icons in ManageProvidersDialog.tsx"
```

---

## Task 6: Replace imports in Sidebar.tsx

**Files:**
- Modify: `src/app/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { List, FolderOpen, Filter, X, Settings } from "lucide-react"
```

With:
```typescript
import { List, FolderOpen, Faders, X, Gear } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace `Filter` with `Faders` and `Settings` with `Gear`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/layout/Sidebar.tsx
git commit -m "migrate: replace icons in Sidebar.tsx"
```

---

## Task 7: Replace imports in SidebarSection.tsx

**Files:**
- Modify: `src/app/components/layout/SidebarSection.tsx`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { ChevronDown } from "lucide-react"
```

With:
```typescript
import { CaretDown } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace `ChevronDown` with `CaretDown`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/layout/SidebarSection.tsx
git commit -m "migrate: replace ChevronDown in SidebarSection.tsx"
```

---

## Task 8: Replace imports in SettingsLayout.tsx

**Files:**
- Modify: `src/app/components/layout/SettingsLayout.tsx`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { ArrowLeft } from "lucide-react"
```

With:
```typescript
import { ArrowLeft } from "@phosphor-icons/react"
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/components/layout/SettingsLayout.tsx
git commit -m "migrate: replace ArrowLeft in SettingsLayout.tsx"
```

---

## Task 9: Replace imports in KeysPage.tsx

**Files:**
- Modify: `src/app/components/keys/KeysPage.tsx`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Lock, X } from "lucide-react"
```

With:
```typescript
import { Lock, X } from "@phosphor-icons/react"
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/components/keys/KeysPage.tsx
git commit -m "migrate: replace icons in KeysPage.tsx"
```

---

## Task 10: Replace imports in KeyForm.tsx

**Files:**
- Modify: `src/app/components/keys/KeyForm.tsx:14`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Key, Eye, EyeOff, RotateCcw, FlaskConical, CheckCircle2, XCircle, Loader2, CalendarIcon, X } from "lucide-react"
```

With:
```typescript
import { Key, Eye, EyeSlash, ArrowCounterClockwise, Flask, CheckCircle, XCircle, Spinner, Calendar, X } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace all instances:
- `EyeOff` → `EyeSlash`
- `RotateCcw` → `ArrowCounterClockwise`
- `FlaskConical` → `Flask`
- `CheckCircle2` → `CheckCircle`
- `Loader2` → `Spinner`
- `CalendarIcon` → `Calendar`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/keys/KeyForm.tsx
git commit -m "migrate: replace icons in KeyForm.tsx"
```

---

## Task 11: Replace imports in WelcomePage.tsx

**Files:**
- Modify: `src/app/components/welcome/WelcomePage.tsx`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { FolderOpen, Loader2, Upload, AlertTriangle, Sun, Moon, Monitor, Plus, Info } from 'lucide-react'
```

With:
```typescript
import { FolderOpen, Spinner, UploadSimple, Warning, Sun, Moon, Monitor, Plus, Info } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace all instances:
- `Loader2` → `Spinner`
- `Upload` → `UploadSimple`
- `AlertTriangle` → `Warning`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/welcome/WelcomePage.tsx
git commit -m "migrate: replace icons in WelcomePage.tsx"
```

---

## Task 12: Replace imports in BiometricPrompt.tsx

**Files:**
- Modify: `src/app/components/vault/BiometricPrompt.tsx`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Fingerprint, Loader2, X } from 'lucide-react'
```

With:
```typescript
import { Fingerprint, Spinner, X } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace `Loader2` with `Spinner`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/vault/BiometricPrompt.tsx
git commit -m "migrate: replace icons in BiometricPrompt.tsx"
```

---

## Task 13: Replace imports in VaultCard.tsx

**Files:**
- Modify: `src/app/components/vault/VaultCard.tsx`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Lock } from 'lucide-react'
```

With:
```typescript
import { Lock } from "@phosphor-icons/react"
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/components/vault/VaultCard.tsx
git commit -m "migrate: replace Lock in VaultCard.tsx"
```

---

## Task 14: Replace imports in VaultSwitcher.tsx

**Files:**
- Modify: `src/app/components/vault/VaultSwitcher.tsx`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Lock, Plus, Cog, ArrowRightLeft, LogOut } from 'lucide-react'
```

With:
```typescript
import { Lock, Plus, Gear, ArrowsLeftRight, SignOut } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace all instances:
- `Cog` → `Gear`
- `ArrowRightLeft` → `ArrowsLeftRight`
- `LogOut` → `SignOut`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/vault/VaultSwitcher.tsx
git commit -m "migrate: replace icons in VaultSwitcher.tsx"
```

---

## Task 15: Replace imports in VaultPasswordDialog.tsx

**Files:**
- Modify: `src/app/components/vault/VaultPasswordDialog.tsx`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Loader2, ArrowRight, Lock, Fingerprint } from 'lucide-react'
```

With:
```typescript
import { Spinner, ArrowRight, Lock, Fingerprint } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace `Loader2` with `Spinner`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/vault/VaultPasswordDialog.tsx
git commit -m "migrate: replace icons in VaultPasswordDialog.tsx"
```

---

## Task 16: Replace imports in ManageGroupsDialog.tsx

**Files:**
- Modify: `src/app/components/groups/ManageGroupsDialog.tsx:9`

- [ ] **Step 1: Update import statement**

Replace:
```typescript
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"
```

With:
```typescript
import { Plus, Trash, PencilSimple, Check, X } from "@phosphor-icons/react"
```

- [ ] **Step 2: Update component usage**

Replace all instances:
- `Trash2` → `Trash`
- `Pencil` → `PencilSimple`

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/groups/ManageGroupsDialog.tsx
git commit -m "migrate: replace icons in ManageGroupsDialog.tsx"
```

---

## Task 17: Replace imports in KeyDetail.tsx

**Files:**
- Modify: `src/app/components/keys/KeyDetail.tsx`

- [ ] **Step 1: Find import line**

```bash
grep -n "lucide-react" src/app/components/keys/KeyDetail.tsx
```

- [ ] **Step 2: Update import statement**

Based on the line found, replace the lucide-react import with the appropriate phosphor-icons imports

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/keys/KeyDetail.tsx
git commit -m "migrate: replace icons in KeyDetail.tsx"
```

---

## Task 18: Replace imports in KeyList.tsx

**Files:**
- Modify: `src/app/components/keys/KeyList.tsx`

- [ ] **Step 1: Find import line**

```bash
grep -n "lucide-react" src/app/components/keys/KeyList.tsx
```

- [ ] **Step 2: Update import statement**

Based on the line found, replace the lucide-react import with the appropriate phosphor-icons imports

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/keys/KeyList.tsx
git commit -m "migrate: replace icons in KeyList.tsx"
```

---

## Task 19: Replace imports in UI components

**Files:**
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/toast.tsx`
- Modify: `src/components/ui/dialog.tsx`

- [ ] **Step 1: Update select.tsx import**

Replace:
```typescript
import { Check, ChevronDown } from "lucide-react"
```

With:
```typescript
import { Check, CaretDown } from "@phosphor-icons/react"
```

Replace `ChevronDown` with `CaretDown` in usage

- [ ] **Step 2: Update toast.tsx import**

Replace:
```typescript
import { X, CheckCircle2, XCircle } from "lucide-react"
```

With:
```typescript
import { X, CheckCircle, XCircle } from "@phosphor-icons/react"
```

Replace `CheckCircle2` with `CheckCircle` in usage

- [ ] **Step 3: Update dialog.tsx import**

Replace:
```typescript
import { X } from "lucide-react"
```

With:
```typescript
import { X } from "@phosphor-icons/react"
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/select.tsx src/components/ui/toast.tsx src/components/ui/dialog.tsx
git commit -m "migrate: replace icons in UI components"
```

---

## Task 20: Remove lucide-react dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify no remaining lucide-react imports**

```bash
grep -r "lucide-react" src/ --include="*.tsx" --include="*.ts"
```

Expected: No output (no lucide-react imports found)

- [ ] **Step 2: Remove lucide-react dependency**

```bash
pnpm remove lucide-react
```

- [ ] **Step 3: Verify removal**

```bash
grep "lucide-react" package.json
```

Expected: No output (lucide-react removed from dependencies)

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: remove lucide-react"
```

---

## Task 21: Final verification

**Files:**
- Test: All modified files

- [ ] **Step 1: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors

- [ ] **Step 2: Run build**

```bash
pnpm run build
```

Expected: Build succeeds without errors

- [ ] **Step 3: Start dev server for visual verification**

```bash
pnpm run dev
```

Manual verification: Open browser and check that all icons display correctly

- [ ] **Step 4: Run tests**

```bash
pnpm run test
```

Expected: All tests pass

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "complete: icon migration to phosphor-icons verified"
```

---

## Summary

**Total tasks:** 21  
**Estimated time:** 30-45 minutes  
**Files modified:** 20 files (1 package.json + 19 components)  
**Dependencies:** + @phosphor-icons/react, - lucide-react
