import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { PRESET_PROVIDERS } from '../../../core/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash, Check, X } from '@phosphor-icons/react';

export function ManageProvidersDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db, updateSettings } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');

  if (!db) return null;
  const settings = db.getSettings();
  const disabled = new Set(settings.disabled_providers ?? []);
  const customs = settings.custom_providers ?? [];

  const allNames = new Set([
    ...PRESET_PROVIDERS,
    ...customs.map((cp) => cp.name),
  ]);

  const toggleProvider = (name: string) => {
    const updated = disabled.has(name)
      ? settings.disabled_providers.filter((n: string) => n !== name)
      : [...settings.disabled_providers, name];
    updateSettings({ disabled_providers: updated });
  };

  const addCustom = () => {
    const name = newName.trim();
    if (!name || !newEndpoint.trim() || allNames.has(name)) return;
    updateSettings({
      custom_providers: [...customs, { name, endpoint: newEndpoint.trim() }],
    });
    setNewName('');
    setNewEndpoint('');
    setIsAdding(false);
  };

  const removeCustom = (name: string) => {
    updateSettings({
      custom_providers: customs.filter((cp) => cp.name !== name),
      disabled_providers: settings.disabled_providers.filter(
        (n: string) => n !== name
      ),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Providers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2 max-h-[60vh] overflow-y-auto">
          {/* Preset Providers */}
          <div className="space-y-1.5">
            <p className="text-xs text-ink-quaternary font-medium">Preset</p>
            {PRESET_PROVIDERS.map((p) => {
              const isDisabled = disabled.has(p);
              return (
                <div
                  key={p}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-surface-2 border border-line-2"
                >
                  <span
                    className={`flex-1 text-xs ${isDisabled ? 'text-ink-quaternary line-through' : 'text-ink-secondary'}`}
                  >
                    {p}
                  </span>
                  <button
                    onClick={() => toggleProvider(p)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                      isDisabled
                        ? 'text-ink-quaternary hover:text-ink-secondary'
                        : 'text-accent-bright hover:text-accent'
                    }`}
                  >
                    {isDisabled ? 'Enable' : 'Disable'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Custom Providers */}
          <div className="space-y-1.5">
            <p className="text-xs text-ink-quaternary font-medium">Custom</p>
            {customs.map((cp) => {
              const isDisabled = disabled.has(cp.name);
              return (
                <div
                  key={cp.name}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-2 border border-line-2"
                >
                  <span
                    className={`text-xs ${isDisabled ? 'text-ink-quaternary line-through' : 'text-ink-secondary'}`}
                  >
                    {cp.name}
                  </span>
                  <span className="text-xs text-ink-quaternary font-mono truncate flex-1">
                    {cp.endpoint}
                  </span>
                  <button
                    onClick={() => toggleProvider(cp.name)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                      isDisabled
                        ? 'text-ink-quaternary hover:text-ink-secondary'
                        : 'text-accent-bright hover:text-accent'
                    }`}
                  >
                    {isDisabled ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => removeCustom(cp.name)}
                    className="text-ink-quaternary hover:text-danger transition-colors"
                  >
                    <Trash className="size-3" />
                  </button>
                </div>
              );
            })}

            {isAdding ? (
              <div className="space-y-2 p-3 rounded-md bg-surface-2 border border-accent/30">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Provider name"
                  className="h-8 text-xs"
                  autoFocus
                />
                <Input
                  value={newEndpoint}
                  onChange={(e) => setNewEndpoint(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="h-8 text-xs font-mono"
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={addCustom}
                    disabled={
                      !newName.trim() ||
                      !newEndpoint.trim() ||
                      allNames.has(newName.trim())
                    }
                  >
                    <Check className="size-3.5" /> Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAdding(false)}
                  >
                    <X className="size-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors"
              >
                <Plus className="size-3.5" /> Add Custom Provider
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
