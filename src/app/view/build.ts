/**
 * Builds the synchronous view the screens render from the asynchronous core.
 *
 * Everything here is derived: the payload, this device's latest observation per
 * key, the dismissals, and the local preferences. The store rebuilds it after
 * every change, so components never wait on IndexedDB or hold a second copy of
 * the truth.
 */

import type { KeyaFile } from '../../core/payload/types';
import type { RecipePlan } from '../../core/presets/classify';
import type { Observation } from '../../core/runtime/observations';
import type {
  BusinessDismissal,
  ObservationDismissal,
} from '../../core/runtime/dismissals';
import { businessAlerts, observationAlerts } from '../../core/reminders';
import type { Reminder } from '../../core/reminders';
import type { Preferences } from '../storage/local/state';
import { groupToView, keyToView, providerToView } from './convert';
import { getDaysSince, getDaysUntilExpiry } from './status';
import type { ApiKey, Group, InboxItem, Settings, VaultData } from './types';

export interface ViewInput {
  file: KeyaFile;
  /** Latest observation per key under the current binding. */
  observations: Map<string, Observation>;
  /** Current binding and plan per key, when the recipe can run. */
  bindings: Map<string, { binding: string; plan: RecipePlan }>;
  dismissals: {
    business: BusinessDismissal[];
    observation: ObservationDismissal[];
  };
  preferences: Preferences;
  now: Date;
  timeZone: string;
}

const TYPE_OF_RULE: Record<Reminder['rule'], InboxItem['type']> = {
  expiry_upcoming: 'key_expiry_upcoming',
  expiry_expired: 'key_expiry_expired',
  insecure_endpoint: 'insecure_endpoint',
  never_probed: 'never_tested',
  probe_failed: 'connection_failed',
  probe_stale: 'stale_test',
};

export function buildSettings(
  file: KeyaFile,
  preferences: Preferences
): Settings {
  return {
    auto_lock_minutes: preferences.auto_lock_minutes,
    auto_test_on_save: preferences.auto_probe_on_save,
    auto_test_daily: preferences.auto_probe_daily,
    clipboard_detection_on_add: preferences.clipboard_detection_on_add,
    custom_providers: file.providers.map(providerToView),
    disabled_providers: preferences.hidden_presets,
  };
}

/** One inbox row per computed reminder, plus one per live dismissal. */
export function buildInbox(input: ViewInput): InboxItem[] {
  const { file, observations, bindings } = input;
  const byId = new Map(file.keys.map((key) => [key.id, key]));

  const business = businessAlerts(file, {
    now: input.now,
    timeZone: input.timeZone,
  });
  const observation = observationAlerts(
    file,
    (key) => bindings.get(key.id)?.binding ?? null,
    [...observations.values()],
    { now: input.now, timeZone: input.timeZone }
  );

  const dismissedBusiness = new Set(
    input.dismissals.business.map(
      (entry) => `${entry.key_id}|${entry.rule}|${entry.condition}`
    )
  );
  const dismissedObservation = new Set(
    input.dismissals.observation.map(
      (entry) => `${entry.key_id}|${entry.rule}|${entry.binding}`
    )
  );

  const items: InboxItem[] = [];

  for (const reminder of [...business, ...observation]) {
    const key = byId.get(reminder.key_id);
    if (!key) continue;

    const dismissed =
      reminder.kind === 'business'
        ? dismissedBusiness.has(
            `${reminder.key_id}|${reminder.rule}|${reminder.condition}`
          )
        : dismissedObservation.has(
            `${reminder.key_id}|${reminder.rule}|${reminder.binding}`
          );

    const latest = observations.get(key.id);
    const metadata = {
      key_name: key.name,
      provider: keyToView(key, file, latest).provider,
      expires_at: key.expiry?.value,
      days_until_expiry: key.expiry
        ? (getDaysUntilExpiry(key.expiry.value, input.now) ?? undefined)
        : undefined,
      checked_at: latest?.finished_at ?? null,
      error_message: describeFailure(latest),
      endpoint: key.endpoint ?? undefined,
      days_since_test:
        getDaysSince(latest?.finished_at ?? null, input.now) ?? undefined,
    };

    const stamp =
      reminder.kind === 'business' ? null : (latest?.finished_at ?? null);

    items.push({
      id: `${reminder.rule}:${reminder.key_id}`,
      type: TYPE_OF_RULE[reminder.rule],
      entity_id: reminder.key_id,
      status: dismissed ? 'archived' : 'open',
      archive_reason: dismissed ? 'user' : null,
      created_at: stamp ?? input.now.toISOString(),
      updated_at: stamp ?? input.now.toISOString(),
      archived_at: dismissed ? input.now.toISOString() : null,
      metadata,
    });
  }

  return items;
}

function describeFailure(observation: Observation | undefined): string | null {
  if (!observation) return null;
  switch (observation.outcome) {
    case 'auth_failed':
      return 'the service rejected the credential';
    case 'forbidden':
      return 'the credential lacks permission';
    case 'rate_limited':
      return 'the service is rate limiting requests';
    case 'server_error':
      return 'the service returned an error';
    case 'failed':
      return observation.detail_code === 'unexpected_html'
        ? 'the address answered with a web page'
        : 'the request was answered with an unexpected status';
    case 'timeout':
      return 'the request did not finish in time';
    case 'network':
      return 'the request could not be completed';
    default:
      return null;
  }
}

export class ViewDatabase {
  private readonly data: VaultData;

  constructor(data: VaultData) {
    this.data = data;
  }

  getData(): VaultData {
    return this.data;
  }

  getApiKeys(): ApiKey[] {
    return this.data.api_keys;
  }

  getActiveApiKeys(): ApiKey[] {
    return this.data.api_keys.filter((key) => !key.archived_at);
  }

  getArchivedApiKeys(): ApiKey[] {
    return this.data.api_keys
      .filter((key) => Boolean(key.archived_at))
      .sort((left, right) => {
        const delta =
          new Date(right.archived_at ?? 0).getTime() -
          new Date(left.archived_at ?? 0).getTime();
        return delta !== 0
          ? delta
          : new Date(right.updated_at).getTime() -
              new Date(left.updated_at).getTime();
      });
  }

  getApiKey(id: string): ApiKey | undefined {
    return this.data.api_keys.find((key) => key.id === id);
  }

  hasDuplicateApiKeyValue(value: string, excludeId?: string): boolean {
    return this.data.api_keys.some(
      (key) => !key.archived_at && key.key === value && key.id !== excludeId
    );
  }

  searchKeys(query: string, keys: ApiKey[] = this.data.api_keys): ApiKey[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return keys;
    return keys.filter(
      (key) =>
        key.name.toLowerCase().includes(needle) ||
        key.description.toLowerCase().includes(needle) ||
        key.provider.toLowerCase().includes(needle)
    );
  }

  getGroups(): Group[] {
    return [...this.data.groups].sort(
      (left, right) => left.order - right.order
    );
  }

  getSettings(): Settings {
    return this.data.settings;
  }

  getInboxItems(): InboxItem[] {
    return this.data.inbox;
  }

  getOpenInboxItems(): InboxItem[] {
    return this.data.inbox.filter((item) => item.status === 'open');
  }
}

export function buildDatabase(input: ViewInput): ViewDatabase {
  const { file } = input;
  const data: VaultData = {
    vault_id: file.vault.id,
    created_at: file.vault.created_at,
    updated_at: file.vault.content_updated_at,
    name: file.vault.name,
    icon: file.vault.icon,
    api_keys: file.keys.map((key) =>
      keyToView(key, file, input.observations.get(key.id))
    ),
    groups: file.groups.map(groupToView),
    settings: buildSettings(file, input.preferences),
    inbox: buildInbox(input),
  };

  return new ViewDatabase(data);
}
