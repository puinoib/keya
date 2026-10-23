import { useStore } from '../../store/useStore';
import {
  ClipboardText,
  Moon,
  Monitor,
  Shield,
  Sun,
} from '@phosphor-icons/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const THEME_OPTIONS = [
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

const CLIPBOARD_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15 secs' },
  { value: 30, label: '30 secs' },
  { value: 60, label: '60 secs' },
];

/**
 * Device preferences. Everything here applies to this browser, not to the
 * vault, so switching vaults changes none of it.
 */
export function GeneralPage() {
  const { view, updateSettings, theme, setTheme } = useStore();
  const preferences = view?.preferences;
  const clipboardSeconds = preferences?.clipboard_clear_seconds ?? 15;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sun className="size-3.5 text-ink-quaternary" />
          <span className="text-xs font-medium text-ink-secondary">
            Appearance
          </span>
        </div>
        <div className="rounded-lg border border-line bg-surface-2 p-3">
          <p className="text-xs font-medium text-ink-primary">Theme</p>
          <p className="text-xs text-ink-quaternary mt-0.5">
            Applies to this browser. System follows your operating system.
          </p>
          <div
            role="group"
            aria-label="Theme"
            className="mt-2 grid grid-cols-3 gap-1 rounded-md border border-line bg-canvas-base p-1"
          >
            {THEME_OPTIONS.map((option) => {
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
                    selected
                      ? 'bg-accent text-white'
                      : 'text-ink-tertiary hover:bg-surface-3 hover:text-ink-secondary'
                  }`}
                >
                  <option.icon className="size-3.5" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="size-3.5 text-ink-quaternary" />
          <span className="text-xs font-medium text-ink-secondary">
            Security
          </span>
        </div>
        <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
          <div className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs font-medium text-ink-primary">Auto Lock</p>
              <p className="text-xs text-ink-quaternary mt-0.5">
                Lock after inactivity
              </p>
            </div>
            <Select
              value={String(preferences?.auto_lock_minutes ?? 5)}
              onValueChange={(v) =>
                updateSettings({ auto_lock_minutes: Number(v) })
              }
            >
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue>
                  {preferences?.auto_lock_minutes ?? 5}
                  {(preferences?.auto_lock_minutes ?? 5) > 1 ? ' mins' : ' min'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 5, 10, 15, 30].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m}
                    {m > 1 ? ' mins' : ' min'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardText className="size-3.5 text-ink-quaternary" />
          <span className="text-xs font-medium text-ink-secondary">
            Privacy
          </span>
        </div>
        <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
          <div className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs font-medium text-ink-primary">
                Clear copied keys
              </p>
              <p className="text-xs text-ink-quaternary mt-0.5">
                Remove a copied credential from the clipboard after a delay. It
                is never cleared if you copied something else in the meantime.
              </p>
            </div>
            <Select
              value={String(clipboardSeconds)}
              onValueChange={(v) =>
                updateSettings({ clipboard_clear_seconds: Number(v) })
              }
            >
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue>
                  {CLIPBOARD_OPTIONS.find(
                    (option) => option.value === clipboardSeconds
                  )?.label ?? '15 secs'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CLIPBOARD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}
