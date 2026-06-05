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
  const { db, updateSettings } = useStore();
  const settings = db?.getSettings();

  if (!settings) return null;

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
            checked={!!settings.auto_test_on_save}
            onChange={() =>
              updateSettings({
                auto_test_on_save: !settings.auto_test_on_save,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3">
          <div>
            <p className="text-xs font-medium text-ink-primary">
              Daily First-Open Test
            </p>
            <p className="text-xs text-ink-quaternary mt-0.5">
              Test all keys only on the first time you open Keya each day
            </p>
          </div>
          <Toggle
            checked={!!settings.auto_test_daily}
            onChange={() =>
              updateSettings({
                auto_test_daily: !settings.auto_test_daily,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3">
          <div>
            <p className="text-xs font-medium text-ink-primary">
              Detect Clipboard on Add
            </p>
            <p className="text-xs text-ink-quaternary mt-0.5">
              When you click Add Key, try to detect an OpenAI key from the
              clipboard first
            </p>
          </div>
          <Toggle
            checked={!!settings.clipboard_detection_on_add}
            onChange={() =>
              updateSettings({
                clipboard_detection_on_add:
                  !settings.clipboard_detection_on_add,
              })
            }
          />
        </div>
      </div>
    </>
  );
}
