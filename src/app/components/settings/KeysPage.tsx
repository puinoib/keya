import { useStore } from '../../store/useStore';

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200
        ${checked ? 'bg-accent' : 'bg-surface-3'}
        ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200
        ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

export function KeysPage() {
  const { view, updateSettings } = useStore();
  const preferences = view?.preferences;

  if (!preferences) return null;

  return (
    <>
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-6">
        Keys
      </h1>

      <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
        <div className="flex items-center justify-between p-3">
          <div>
            <p className="text-xs font-medium text-ink-primary">
              Auto-Test on Save
            </p>
            <p className="text-xs text-ink-quaternary mt-0.5">
              Test keys after saving
            </p>
          </div>
          <Toggle
            checked={!!preferences.auto_probe_on_save}
            onChange={() =>
              updateSettings({
                auto_probe_on_save: !preferences.auto_probe_on_save,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3">
          <div>
            <p className="text-xs font-medium text-ink-primary">
              Daily Auto-Test
            </p>
            <p className="text-xs text-ink-quaternary mt-0.5">
              Test all keys on first daily launch
            </p>
          </div>
          <Toggle
            checked={!!preferences.auto_probe_daily}
            onChange={() =>
              updateSettings({
                auto_probe_daily: !preferences.auto_probe_daily,
              })
            }
          />
        </div>
      </div>
    </>
  );
}
