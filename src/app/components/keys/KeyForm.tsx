import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { useStore } from '../../store/useStore';
import {
  ENDPOINT_DEFAULTS,
  getProvidersForDropdown,
} from '../../../core/types';
import { ApiTester } from '../../lib/api-tester';
import { DayPicker } from './DayPicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Key,
  Eye,
  EyeSlash,
  ArrowCounterClockwise,
  Flask,
  CheckCircle,
  XCircle,
  Spinner,
  Calendar,
  X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface FormData {
  name: string;
  key_value: string;
  provider: string;
  endpoint: string;
  description: string;
  group_id: string | null;
  expires_at: Date | undefined;
}

interface TestState {
  testing: boolean;
  result: { success: boolean; latency_ms: number; error?: string } | null;
}

const empty: FormData = {
  name: '',
  key_value: '',
  provider: 'OpenAI',
  endpoint: '',
  description: '',
  group_id: null,
  expires_at: undefined,
};

export function KeyForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addKey, updateKey, db } = useStore();
  const [dialogPortalContainer, setDialogPortalContainer] =
    useState<HTMLElement | null>(null);
  const [form, setForm] = useState<FormData>(empty);
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState<TestState>({
    testing: false,
    result: null,
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e: MouseEvent) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(e.target as Node)
      ) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalendar]);

  const settings = db?.getSettings();
  const providers = getProvidersForDropdown(settings);
  const defaultEndpoint =
    ENDPOINT_DEFAULTS[form.provider.toLowerCase()] ??
    settings?.custom_providers?.find((cp) => cp.name === form.provider)
      ?.endpoint;

  const currentGroup = form.group_id
    ? db?.getGroups().find((g) => g.id === form.group_id)
    : null;
  const groupDisplay = currentGroup
    ? `${currentGroup.icon} ${currentGroup.name}`
    : 'Ungrouped';

  const handleProviderChange = (provider: string) => {
    const endpoint =
      ENDPOINT_DEFAULTS[provider.toLowerCase()] ??
      settings?.custom_providers?.find((cp) => cp.name === provider)
        ?.endpoint ??
      '';
    setForm((f) => ({ ...f, provider, endpoint }));
    setTestState({ testing: false, result: null });
  };

  const handleResetEndpoint = () => {
    if (defaultEndpoint) {
      setForm((f) => ({ ...f, endpoint: defaultEndpoint }));
    }
  };

  const handleTest = async () => {
    if (!form.key_value) return;
    setTestState({ testing: true, result: null });
    const result = await ApiTester.testRaw(
      form.provider,
      form.endpoint,
      form.key_value
    );
    setTestState({ testing: false, result });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.key_value) return;

    const created = addKey({
      name: form.name,
      key: form.key_value,
      provider: form.provider,
      endpoint: form.endpoint,
      description: form.description,
      group_id: form.group_id,
      expires_at: form.expires_at ? form.expires_at.toISOString() : null,
      last_tested: testState.result ? new Date().toISOString() : null,
      test_status: testState.result?.success
        ? 'success'
        : testState.result
          ? 'failed'
          : null,
      test_latency_ms: testState.result?.latency_ms ?? null,
    });

    const provider = form.provider;
    const endpoint = form.endpoint;
    const keyValue = form.key_value;
    const keyName = form.name;
    setForm(empty);
    setTestState({ testing: false, result: null });
    onClose();

    toast.success('Key saved', { description: keyName });

    // Auto-test on save
    if (settings?.auto_test_on_save && created) {
      ApiTester.testRaw(provider, endpoint, keyValue).then((result) => {
        updateKey(created.id, {
          last_tested: new Date().toISOString(),
          test_status: result.success ? 'success' : 'failed',
          test_latency_ms: result.latency_ms ?? null,
        });
      });
    }
  };

  const handleClose = () => {
    setForm(empty);
    setTestState({ testing: false, result: null });
    onClose();
  };

  const handleDialogContentRef = (node: HTMLDivElement | null) => {
    setDialogPortalContainer(node?.parentElement ?? null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent ref={handleDialogContentRef} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New API Key</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Production OpenAI"
              required
            />
          </div>

          {/* Key Value */}
          <div className="space-y-1.5">
            <Label htmlFor="key_value" className="text-xs">
              API Key <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="key_value"
                type={showKey ? 'text' : 'password'}
                value={form.key_value}
                onChange={(e) => {
                  setForm((f) => ({ ...f, key_value: e.target.value }));
                  setTestState({ testing: false, result: null });
                }}
                placeholder="sk-..."
                className="pr-9 font-mono text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center
                           rounded text-ink-quaternary hover:text-ink-secondary transition-colors"
              >
                {showKey ? (
                  <EyeSlash className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <Label htmlFor="provider" className="text-xs">
              Provider
            </Label>
            <Select value={form.provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-1.5">
            <Label
              htmlFor="endpoint"
              className="text-xs flex items-center gap-1.5"
            >
              Endpoint
              {defaultEndpoint && (
                <button
                  type="button"
                  onClick={handleResetEndpoint}
                  className="text-ink-quaternary hover:text-accent-bright transition-colors"
                  title="Reset to default"
                >
                  <ArrowCounterClockwise className="size-3" />
                </button>
              )}
            </Label>
            <Input
              id="endpoint"
              value={form.endpoint}
              onChange={(e) =>
                setForm((f) => ({ ...f, endpoint: e.target.value }))
              }
              placeholder={defaultEndpoint || 'https://api.example.com/v1'}
              className="font-mono text-xs"
            />
          </div>

          {/* Expiration */}
          <div className="relative" ref={calendarRef}>
            <Label className="text-xs">Expiration</Label>
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className="mt-1.5 w-full inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-normal border border-line bg-transparent hover:bg-surface-4 hover:text-ink-primary transition-colors justify-start text-left"
            >
              <Calendar className="size-3.5 shrink-0" />
              <span
                className={
                  !form.expires_at
                    ? 'text-ink-quaternary'
                    : 'text-ink-secondary'
                }
              >
                {form.expires_at
                  ? format(form.expires_at, 'MMM d, yyyy')
                  : 'Pick a date'}
              </span>
              {form.expires_at && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setForm((f) => ({ ...f, expires_at: undefined }));
                  }}
                  className="ml-auto text-ink-quaternary hover:text-ink-secondary"
                >
                  <X className="size-3" />
                </span>
              )}
            </button>
            {showCalendar && (
              <div className="absolute top-full left-0 mt-1 z-50 rounded-lg border border-line bg-canvas-raised shadow-elevated">
                <DayPicker
                  value={form.expires_at}
                  onChange={(d) => {
                    setForm((f) => ({ ...f, expires_at: d }));
                    setShowCalendar(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Group */}
          <div className="space-y-1.5">
            <Label htmlFor="group" className="text-xs">
              Group
            </Label>
            <Select
              value={form.group_id ?? '__none__'}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  group_id: v === '__none__' ? null : v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Ungrouped">{groupDisplay}</SelectValue>
              </SelectTrigger>
              <SelectContent container={dialogPortalContainer}>
                <SelectItem value="__none__">Ungrouped</SelectItem>
                {db?.getGroups().map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.icon} {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Description
            </Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="What's this key for?"
            />
          </div>

          {/* Test Result */}
          {testState.result && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
                testState.result.success
                  ? 'bg-success/10 text-success-bright'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              {testState.result.success ? (
                <CheckCircle className="size-3.5" />
              ) : (
                <XCircle className="size-3.5" />
              )}
              <span>
                {testState.result.success
                  ? `Available (${testState.result.latency_ms}ms)`
                  : testState.result.error || 'Connection failed'}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" size="sm">
              <Key className="size-3.5" />
              Save Key
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!form.key_value || testState.testing}
            >
              {testState.testing ? (
                <Spinner className="size-3.5 animate-spin" />
              ) : (
                <Flask className="size-3.5" />
              )}
              Test
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
