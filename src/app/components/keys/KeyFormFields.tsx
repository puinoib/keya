/**
 * The field set shared by "add key" and "edit key".
 *
 * Both dialogs collect the same seven values and the same one-shot check, and
 * they used to keep two copies of that markup. Only the surrounding dialog,
 * the initial values and what saving means differ, so those stay with the
 * parents and everything inside the form lives here.
 */

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowCounterClockwise,
  Calendar,
  Eye,
  EyeSlash,
  Flask,
  FloppyDisk,
  Spinner,
  X,
} from '@phosphor-icons/react';
import type { Group, Provider } from '../../../core/payload/types';
import type { Preferences } from '../../storage/local/state';
import {
  getDefaultEndpointForProvider,
  getProviderSections,
} from '../../state/providers';
import type { TestKind } from '../../lib/api-tester';
import { getTestActionHint, getTestActionLabel } from '../../lib/test-feedback';
import { ProviderLogo } from '@/app/components/ui/provider-logo';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Button } from '@/components/ui/button';
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
import { DayPicker } from './DayPicker';
import { GroupSelect } from './GroupSelect';

export interface KeyFieldValues {
  name: string;
  secret: string;
  /** The picker works in labels; the id is resolved by the parent on save. */
  provider: string;
  endpoint: string;
  description: string;
  groupId: string | null;
  /** What the day picker shows. */
  expiry: Date | undefined;
}

export interface KeyFormFieldsProps {
  /** Keeps the two dialogs' DOM ids apart when both are mounted. */
  idPrefix: string;
  values: KeyFieldValues;
  onChange: (patch: Partial<KeyFieldValues>) => void;
  /** The parents differ on how a provider change affects the endpoint. */
  onProviderChange: (provider: string) => void;
  providers: readonly Provider[];
  groups: Group[];
  preferences: Preferences | undefined;
  secretVisible: boolean;
  onToggleSecret: () => void;
  testKind: TestKind;
  testing: boolean;
  onTest: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  saveLabel: string;
}

export function KeyFormFields({
  idPrefix,
  values,
  onChange,
  onProviderChange,
  providers,
  groups,
  preferences,
  secretVisible,
  onToggleSecret,
  testKind,
  testing,
  onTest,
  onSubmit,
  onCancel,
  saveLabel,
}: KeyFormFieldsProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCalendar) return;
    const handler = (event: MouseEvent) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node)
      ) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalendar]);

  const providerSections = getProviderSections(preferences, providers);
  const defaultEndpoint = getDefaultEndpointForProvider(
    values.provider,
    providers
  );
  const nameId = `${idPrefix}-name`;
  const secretId = `${idPrefix}-secret`;
  const providerId = `${idPrefix}-provider`;
  const endpointId = `${idPrefix}-endpoint`;
  const expiryId = `${idPrefix}-expiry`;
  const groupId = `${idPrefix}-group`;
  const descriptionId = `${idPrefix}-description`;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-4 mt-2"
    >
      <div className="space-y-1.5">
        {/* The asterisk sits beside the label, not inside it: `required`
            already tells assistive technology the field is mandatory, and a
            "*" in the label text does not. */}
        <div className="flex items-center gap-1">
          <Label htmlFor={nameId} className="text-xs">
            Name
          </Label>
          <span aria-hidden className="text-xs text-red-500">
            *
          </span>
        </div>
        <Input
          id={nameId}
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="e.g. Production Firecrawl"
          required
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor={secretId} className="text-xs">
            API Key or Token
          </Label>
          <span aria-hidden className="text-xs text-red-500">
            *
          </span>
        </div>
        <div className="relative">
          <AutoResizeTextarea
            id={secretId}
            name="api-key-secret"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            spellCheck={false}
            value={values.secret}
            masked={!secretVisible}
            onChange={(event) => onChange({ secret: event.target.value })}
            placeholder="sk-... or your API token"
            className="pr-9 font-mono text-sm break-all"
            required
          />
          <button
            type="button"
            onClick={onToggleSecret}
            aria-label={secretVisible ? 'Hide credential' : 'Show credential'}
            className="absolute right-2 top-2 size-6 flex items-center justify-center
                       rounded text-ink-quaternary hover:text-ink-secondary transition-colors"
          >
            {secretVisible ? (
              <EyeSlash className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={providerId} className="text-xs">
          Service / Provider
        </Label>
        <Select
          value={values.provider}
          onValueChange={(value) => {
            if (value) onProviderChange(value);
          }}
        >
          <SelectTrigger id={providerId}>
            <span className="inline-flex items-center gap-1.5 truncate">
              {values.provider && (
                <ProviderLogo provider={values.provider} className="size-3.5" />
              )}
              {values.provider}
            </span>
          </SelectTrigger>
          <SelectContent>
            {providerSections.map((section) => (
              <SelectGroup key={section.id}>
                <SelectLabel>{section.label}</SelectLabel>
                {section.providers.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    <div className="flex items-center gap-2">
                      <ProviderLogo provider={provider} className="size-3.5" />
                      <span>{provider}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={endpointId} className="text-xs">
            Endpoint
          </Label>
          {defaultEndpoint && (
            <button
              type="button"
              onClick={() => onChange({ endpoint: defaultEndpoint })}
              className="text-ink-quaternary hover:text-accent-bright transition-colors"
              title="Reset to default"
              aria-label="Reset to the default endpoint"
            >
              <ArrowCounterClockwise className="size-3" />
            </button>
          )}
        </div>
        <Input
          id={endpointId}
          value={values.endpoint}
          onChange={(event) => onChange({ endpoint: event.target.value })}
          placeholder={defaultEndpoint || 'https://api.example.com/v1'}
          className="font-mono text-xs"
        />
      </div>

      <div className="relative" ref={calendarRef}>
        <Label htmlFor={expiryId} className="text-xs">
          Expiration
        </Label>
        {/* Two controls, not a button inside a button: a nested
            `role="button"` cannot be focused, so clearing would be mouse-only. */}
        <div className="mt-1.5 flex h-9 w-full items-center rounded-md border border-line bg-transparent transition-colors hover:bg-surface-4 focus-within:ring-1 focus-within:ring-accent-bright">
          <button
            type="button"
            id={expiryId}
            onClick={() => setShowCalendar((current) => !current)}
            className="inline-flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md px-3 text-left text-xs font-normal hover:text-ink-primary"
          >
            <Calendar className="size-3.5 shrink-0" />
            <span
              className={
                !values.expiry ? 'text-ink-quaternary' : 'text-ink-secondary'
              }
            >
              {values.expiry
                ? format(values.expiry, 'MMM d, yyyy')
                : 'Pick a date'}
            </span>
          </button>
          {values.expiry && (
            <button
              type="button"
              aria-label="Clear expiration"
              title="Clear expiration"
              onClick={() => onChange({ expiry: undefined })}
              className="mr-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded text-ink-quaternary hover:text-ink-secondary"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        {showCalendar && (
          <div className="absolute top-full left-0 mt-1 z-50 rounded-lg border border-line bg-canvas-raised shadow-elevated">
            <DayPicker
              value={values.expiry}
              onChange={(date) => {
                onChange({ expiry: date });
                setShowCalendar(false);
              }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={groupId} className="text-xs">
          Group
        </Label>
        <GroupSelect
          id={groupId}
          groups={groups}
          value={values.groupId}
          onChange={(next) => onChange({ groupId: next })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={descriptionId} className="text-xs">
          Description
        </Label>
        <Input
          id={descriptionId}
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="What is this credential used for?"
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" size="sm">
          <FloppyDisk className="size-3.5" />
          {saveLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTest}
          disabled={!values.secret || testing}
          title={getTestActionHint(testKind)}
        >
          {testing ? (
            <Spinner className="size-3.5 animate-spin" />
          ) : (
            <Flask className="size-3.5" />
          )}
          {getTestActionLabel(testKind)}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-3.5" />
          Cancel
        </Button>
      </div>

      {testKind !== 'credential' && (
        <p className="text-[11px] leading-relaxed text-ink-quaternary">
          {getTestActionHint(testKind)}
        </p>
      )}
    </form>
  );
}
