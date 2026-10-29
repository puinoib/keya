import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import {
  getDefaultEndpointForProvider,
  getProviderSections,
  providerIdForLabel,
  providerLabel,
} from '../../state/providers';
import { dateToExpiry } from '../../state/presentation';
import { hasDuplicateSecret, sortedGroups } from '../../state/view';
import type { AddKeyDraft } from '../../store/create-store';
import type { Provider } from '../../../core/payload/types';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { ProviderLogo } from '@/app/components/ui/provider-logo';
import { ApiTester, checkKind } from '../../lib/api-tester';
import type { TestResult } from '../../lib/api-tester';
import {
  describeTestResult,
  getTestActionHint,
  getTestActionLabel,
} from '../../lib/test-feedback';
import { DayPicker } from './DayPicker';
import { GroupSelect } from './GroupSelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select';
import {
  FloppyDisk,
  Eye,
  EyeSlash,
  ArrowCounterClockwise,
  Flask,
  Spinner,
  Calendar,
  X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface FormData {
  name: string;
  secret: string;
  /** The picker works in labels; the id is resolved when saving. */
  provider: string;
  endpoint: string;
  description: string;
  groupId: string | null;
  /** What the day picker shows. */
  expiry: Date | undefined;
}

interface TestState {
  testing: boolean;
  result: TestResult | null;
}

const empty: FormData = {
  name: '',
  secret: '',
  provider: 'OpenAI',
  endpoint: '',
  description: '',
  groupId: null,
  expiry: undefined,
};

function toFormData(
  draft: AddKeyDraft,
  providers: readonly Provider[]
): FormData {
  return {
    name: draft.name,
    secret: draft.secret,
    provider: providerLabel(draft.providerId, providers),
    endpoint: draft.endpoint,
    description: draft.description,
    groupId: draft.groupId,
    expiry: undefined,
  };
}

function getEmptyForm(providers: readonly Provider[]): FormData {
  return {
    ...empty,
    endpoint: getDefaultEndpointForProvider(empty.provider, providers) ?? '',
  };
}

export function KeyForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { addKey, view, addKeyDraft, clearAddKeyDraft } = useStore(
    useShallow((s) => ({
      addKey: s.addKey,
      view: s.view,
      addKeyDraft: s.addKeyDraft,
      clearAddKeyDraft: s.clearAddKeyDraft,
    }))
  );
  const [form, setForm] = useState<FormData>(empty);
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState<TestState>({
    testing: false,
    result: null,
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  // The draft test is async, and the form can be edited or reset under it.
  // A result may only be reported for the exact values it was started with.
  const formRef = useRef(form);
  formRef.current = form;

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

  const providers = view?.file.providers ?? [];
  const preferences = view?.preferences;
  const providerSections = getProviderSections(preferences, providers);
  const defaultEndpoint = getDefaultEndpointForProvider(
    form.provider,
    providers
  );
  const formCheckKind = checkKind(
    providerIdForLabel(form.provider, providers),
    form.endpoint,
    providers
  );

  useEffect(() => {
    if (!open || !defaultEndpoint) return;
    setForm((f) => (f.endpoint ? f : { ...f, endpoint: defaultEndpoint }));
  }, [open, defaultEndpoint]);

  // The form is reset when the dialog opens, not whenever the provider list
  // happens to be rebuilt: a background refresh must not erase typed input.
  const providersRef = useRef(providers);
  providersRef.current = providers;

  useEffect(() => {
    if (!open) return;
    const current = providersRef.current;
    if (addKeyDraft) {
      const draftForm = toFormData(addKeyDraft, current);
      setForm({
        ...draftForm,
        endpoint:
          draftForm.endpoint ||
          getDefaultEndpointForProvider(draftForm.provider, current) ||
          '',
      });
      setShowKey(false);
      setTestState({ testing: false, result: null });
      return;
    }
    setForm(getEmptyForm(current));
    setShowKey(false);
    setTestState({ testing: false, result: null });
  }, [open, addKeyDraft]);

  const handleProviderChange = (provider: string | null) => {
    if (!provider) return;
    const endpoint = getDefaultEndpointForProvider(provider, providers) ?? '';
    setForm((f) => ({ ...f, provider, endpoint }));
    setTestState({ testing: false, result: null });
  };

  const handleResetEndpoint = () => {
    if (defaultEndpoint) {
      setForm((f) => ({ ...f, endpoint: defaultEndpoint }));
    }
  };

  const handleTest = async () => {
    if (!form.secret) return;
    const started = {
      providerId: providerIdForLabel(form.provider, providers),
      endpoint: form.endpoint,
      secret: form.secret,
    };
    setTestState({ testing: true, result: null });
    const result = await ApiTester.testDraft({ ...started, providers });

    // Another key, another destination or another secret means the result
    // describes a request this form no longer asks for. Drop it instead of
    // reporting the previous credential's verdict against the current one.
    const latest = formRef.current;
    const superseded =
      latest.secret !== started.secret ||
      latest.endpoint !== started.endpoint ||
      providerIdForLabel(latest.provider, providers) !== started.providerId;

    setTestState({ testing: false, result: superseded ? null : result });
    if (superseded) return;

    const feedback = describeTestResult(result, latest.name || latest.provider);
    toast[result.success ? 'success' : 'error'](feedback.title, {
      description: feedback.description,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.secret) return;
    if (view && hasDuplicateSecret(view, form.secret.trim())) {
      // §5.3: the same token in two environments is legitimate. Warn, do not
      // block the entry.
      toast.warning('This credential is already saved', {
        description:
          'Keya keeps both because the same token may be used twice.',
      });
    }

    const created = addKey({
      name: form.name,
      secret: form.secret,
      providerId: providerIdForLabel(form.provider, providers),
      endpoint: form.endpoint,
      description: form.description,
      groupId: form.groupId,
      expiry: dateToExpiry(form.expiry),
    });

    if (!created) {
      // `addKey` already reported the real reason (limit, invalid values, or a
      // locked vault); the duplicate case is handled above.
      toast.error('The key was not saved.');
      return;
    }

    const keyName = form.name;
    const newKeyId = created.id;
    setForm(empty);
    clearAddKeyDraft();
    setTestState({ testing: false, result: null });
    onClose();
    navigate({ to: '/keys', search: { select: newKeyId } });

    toast.success('Key saved', { description: keyName });
  };

  const handleClose = () => {
    setForm(getEmptyForm(providers));
    clearAddKeyDraft();
    setTestState({ testing: false, result: null });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New API Key or Token</DialogTitle>
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
              placeholder="e.g. Production Firecrawl"
              required
            />
          </div>

          {/* Key Value */}
          <div className="space-y-1.5">
            <Label htmlFor="secret" className="text-xs">
              API Key or Token <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <AutoResizeTextarea
                id="secret"
                name="api-key-secret"
                autoComplete="off"
                data-form-type="other"
                data-lpignore="true"
                spellCheck={false}
                value={form.secret}
                masked={!showKey}
                onChange={(e) => {
                  setForm((f) => ({ ...f, secret: e.target.value }));
                  setTestState({ testing: false, result: null });
                }}
                placeholder="sk-... or your API token"
                className="pr-9 font-mono text-sm break-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide credential' : 'Show credential'}
                className="absolute right-2 top-2 size-6 flex items-center justify-center
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
              Service / Provider
            </Label>
            <Select value={form.provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <span className="inline-flex items-center gap-1.5 truncate">
                  {form.provider && (
                    <ProviderLogo
                      provider={form.provider}
                      className="size-3.5"
                    />
                  )}
                  {form.provider}
                </span>
              </SelectTrigger>
              <SelectContent>
                {providerSections.map((section) => (
                  <SelectGroup key={section.id}>
                    <SelectLabel>{section.label}</SelectLabel>
                    {section.providers.map((p) => (
                      <SelectItem key={p} value={p}>
                        <div className="flex items-center gap-2">
                          <ProviderLogo provider={p} className="size-3.5" />
                          <span>{p}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
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
                  !form.expiry ? 'text-ink-quaternary' : 'text-ink-secondary'
                }
              >
                {form.expiry
                  ? format(form.expiry, 'MMM d, yyyy')
                  : 'Pick a date'}
              </span>
              {form.expiry && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setForm((f) => ({ ...f, expiry: undefined }));
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
                  value={form.expiry}
                  onChange={(d) => {
                    setForm((f) => ({ ...f, expiry: d }));
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
            <GroupSelect
              groups={view ? sortedGroups(view) : []}
              value={form.groupId}
              onChange={(groupId) => setForm((f) => ({ ...f, groupId }))}
            />
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
              placeholder="What is this credential used for?"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" size="sm">
              <FloppyDisk className="size-3.5" />
              Save Key
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!form.secret || testState.testing}
              title={getTestActionHint(formCheckKind)}
            >
              {testState.testing ? (
                <Spinner className="size-3.5 animate-spin" />
              ) : (
                <Flask className="size-3.5" />
              )}
              {getTestActionLabel(formCheckKind)}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              <X className="size-3.5" />
              Cancel
            </Button>
          </div>

          {formCheckKind !== 'credential' && (
            <p className="text-[11px] leading-relaxed text-ink-quaternary">
              {getTestActionHint(formCheckKind)}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
