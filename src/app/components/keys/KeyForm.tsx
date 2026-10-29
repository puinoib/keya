import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  getDefaultEndpointForProvider,
  providerIdForLabel,
  providerLabel,
} from '../../state/providers';
import { dateToExpiry } from '../../state/presentation';
import { hasDuplicateSecret, sortedGroups } from '../../state/view';
import type { AddKeyDraft } from '../../store/create-store';
import type { Provider } from '../../../core/payload/types';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { ApiTester, checkKind } from '../../lib/api-tester';
import type { TestResult } from '../../lib/api-tester';
import { describeTestResult } from '../../lib/test-feedback';
import { KeyFormFields, type KeyFieldValues } from './KeyFormFields';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface TestState {
  testing: boolean;
  result: TestResult | null;
}

const empty: KeyFieldValues = {
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
): KeyFieldValues {
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

function getEmptyForm(providers: readonly Provider[]): KeyFieldValues {
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
  const [form, setForm] = useState<KeyFieldValues>(empty);
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState<TestState>({
    testing: false,
    result: null,
  });
  // The draft test is async, and the form can be edited or reset under it.
  // A result may only be reported for the exact values it was started with.
  const formRef = useRef(form);
  formRef.current = form;

  const providers = view?.file.providers ?? [];
  const preferences = view?.preferences;
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

  const handleChange = (patch: Partial<KeyFieldValues>) => {
    setForm((f) => ({ ...f, ...patch }));
    // A different credential or destination makes the last result describe
    // something this form no longer asks for.
    if ('secret' in patch || 'endpoint' in patch) {
      setTestState({ testing: false, result: null });
    }
  };

  const handleProviderChange = (provider: string) => {
    const endpoint = getDefaultEndpointForProvider(provider, providers) ?? '';
    setForm((f) => ({ ...f, provider, endpoint }));
    setTestState({ testing: false, result: null });
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

  const handleSubmit = () => {
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
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New API Key or Token</DialogTitle>
        </DialogHeader>

        <KeyFormFields
          idPrefix="add-key"
          values={form}
          onChange={handleChange}
          onProviderChange={handleProviderChange}
          providers={providers}
          groups={view ? sortedGroups(view) : []}
          preferences={preferences}
          secretVisible={showKey}
          onToggleSecret={() => setShowKey((visible) => !visible)}
          testKind={formCheckKind}
          testing={testState.testing}
          onTest={handleTest}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          saveLabel="Save Key"
        />
      </DialogContent>
    </Dialog>
  );
}
