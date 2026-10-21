/**
 * Provider recipes and groups.
 *
 * The recipe editor is where a custom provider becomes "checkable": target,
 * where the credential goes, and the constant headers the real request needs.
 * Nothing here is free-form — every field maps to a validated format value, and
 * a rejection from the transaction layer is shown instead of swallowed.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVault } from '@/app/store/vault';
import { MAX_STATIC_HEADERS } from '@/core/payload/limits';
import type {
  Group,
  ProbeAuth,
  Provider,
  StaticHeader,
} from '@/core/payload/types';

type AuthMode = ProbeAuth['mode'];

interface ProviderDraft {
  id: string | null;
  name: string;
  description: string;
  defaultEndpoint: string;
  probeEnabled: boolean;
  target: string;
  authMode: AuthMode;
  headerName: string;
  queryParam: string;
  headers: StaticHeader[];
}

const emptyProvider = (): ProviderDraft => ({
  id: null,
  name: '',
  description: '',
  defaultEndpoint: '',
  probeEnabled: true,
  target: 'models',
  authMode: 'bearer',
  headerName: 'x-api-key',
  queryParam: 'key',
  headers: [],
});

function providerDraftFrom(provider: Provider): ProviderDraft {
  const probe = provider.probe;
  const auth = probe?.auth;
  return {
    id: provider.id,
    name: provider.name,
    description: provider.description,
    defaultEndpoint: provider.default_endpoint ?? '',
    probeEnabled: probe !== null,
    target: probe?.target ?? '',
    authMode: auth?.mode ?? 'bearer',
    headerName: auth?.mode === 'header' ? auth.name : 'x-api-key',
    queryParam: auth?.mode === 'query' ? auth.param : 'key',
    headers: probe?.headers ?? [],
  };
}

export function SettingsPanel() {
  const payload = useVault((state) => state.payload);
  const error = useVault((state) => state.error);

  const [providerDraft, setProviderDraft] = useState<ProviderDraft | null>(
    null
  );
  const [groupName, setGroupName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  if (!payload) return null;

  const saveProvider = async () => {
    if (!providerDraft) return;
    if (!providerDraft.name.trim()) {
      setNotice('A provider name is required.');
      return;
    }

    let auth: ProbeAuth = { mode: 'bearer' };
    if (providerDraft.authMode === 'header') {
      auth = { mode: 'header', name: providerDraft.headerName.trim() };
    } else if (providerDraft.authMode === 'query') {
      auth = { mode: 'query', param: providerDraft.queryParam.trim() };
    } else if (providerDraft.authMode === 'basic') {
      auth = { mode: 'basic' };
    }

    const provider: Provider = {
      id: providerDraft.id ?? `custom:${crypto.randomUUID()}`,
      name: providerDraft.name.trim(),
      description: providerDraft.description,
      default_endpoint: providerDraft.defaultEndpoint.trim() || null,
      probe: providerDraft.probeEnabled
        ? {
            target: providerDraft.target.trim(),
            auth,
            headers: providerDraft.headers
              .filter((header) => header.name.trim() && header.value.trim())
              .map((header) => ({
                name: header.name.trim().toLowerCase(),
                value: header.value.trim(),
              })),
          }
        : null,
    };

    setNotice(null);
    await useVault.getState().saveProvider(provider);
    if (useVault.getState().error) return;
    setProviderDraft(null);
    await useVault.getState().save();
  };

  const removeProvider = async (providerId: string) => {
    await useVault.getState().removeProvider(providerId);
    if (useVault.getState().error) return;
    await useVault.getState().save();
  };

  const addGroup = async () => {
    const name = groupName.trim();
    if (!name) return;
    const group: Group = {
      id: crypto.randomUUID(),
      name,
      icon: '',
      order: payload.groups.length,
    };
    await useVault.getState().saveGroup(group);
    if (useVault.getState().error) return;
    setGroupName('');
    await useVault.getState().save();
  };

  const moveGroup = async (index: number, direction: -1 | 1) => {
    const ids = payload.groups.map((group) => group.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await useVault.getState().reorderGroups(ids);
    if (useVault.getState().error) return;
    await useVault.getState().save();
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-primary">
            Custom providers ({payload.providers.length})
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setProviderDraft(emptyProvider());
              setNotice(null);
            }}
          >
            New provider
          </Button>
        </div>

        <ul className="space-y-1 text-sm">
          {payload.providers.map((provider) => (
            <li
              key={provider.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-primary">
                  {provider.name}
                </p>
                <p className="truncate text-xs text-ink-secondary">
                  {provider.default_endpoint ?? 'no default endpoint'} ·{' '}
                  {describeProbe(provider)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setProviderDraft(providerDraftFrom(provider))}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void removeProvider(provider.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
          {payload.providers.length === 0 && (
            <li className="text-xs text-ink-secondary">
              No custom providers yet. Presets ship with the app.
            </li>
          )}
        </ul>

        {(notice || error) && (
          <p className="text-xs text-danger">{notice ?? error}</p>
        )}
        {error === 'provider_in_use' && (
          <p className="text-xs text-ink-secondary">
            This provider is still referenced by a key. Change that key first.
          </p>
        )}
      </div>

      {providerDraft && (
        <article className="space-y-2 rounded-md border border-line bg-surface-2 p-4 text-sm">
          <h3 className="font-medium text-ink-primary">
            {providerDraft.id ? 'Edit provider' : 'New provider'}
          </h3>

          <Label htmlFor="provider-name">Name</Label>
          <Input
            id="provider-name"
            value={providerDraft.name}
            onChange={(event) =>
              setProviderDraft({ ...providerDraft, name: event.target.value })
            }
          />

          <Label htmlFor="provider-description">Description</Label>
          <Input
            id="provider-description"
            value={providerDraft.description}
            onChange={(event) =>
              setProviderDraft({
                ...providerDraft,
                description: event.target.value,
              })
            }
          />

          <Label htmlFor="provider-endpoint">Default endpoint</Label>
          <Input
            id="provider-endpoint"
            value={providerDraft.defaultEndpoint}
            placeholder="https://gateway.example.com/v1"
            onChange={(event) =>
              setProviderDraft({
                ...providerDraft,
                defaultEndpoint: event.target.value,
              })
            }
          />
          <p className="text-xs text-ink-secondary">
            Copied into a key when you create it. Existing keys keep their own
            endpoint — this is never used as a fallback.
          </p>

          <label className="flex items-center gap-2 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={providerDraft.probeEnabled}
              onChange={(event) =>
                setProviderDraft({
                  ...providerDraft,
                  probeEnabled: event.target.checked,
                })
              }
            />
            This provider can be checked
          </label>

          {providerDraft.probeEnabled && (
            <>
              <Label htmlFor="probe-target">Target</Label>
              <Input
                id="probe-target"
                value={providerDraft.target}
                placeholder="models, or an absolute URL"
                onChange={(event) =>
                  setProviderDraft({
                    ...providerDraft,
                    target: event.target.value,
                  })
                }
              />

              <Label htmlFor="probe-auth">Credential goes in</Label>
              <select
                id="probe-auth"
                className="h-9 w-full rounded-md border border-line bg-surface-4 px-2 text-sm text-ink-primary"
                value={providerDraft.authMode}
                onChange={(event) =>
                  setProviderDraft({
                    ...providerDraft,
                    authMode: event.target.value as AuthMode,
                  })
                }
              >
                <option value="bearer">Authorization: Bearer</option>
                <option value="basic">Authorization: Basic</option>
                <option value="header">A header</option>
                <option value="query">A query parameter</option>
              </select>

              {providerDraft.authMode === 'header' && (
                <>
                  <Label htmlFor="probe-header-name">Header name</Label>
                  <Input
                    id="probe-header-name"
                    value={providerDraft.headerName}
                    onChange={(event) =>
                      setProviderDraft({
                        ...providerDraft,
                        headerName: event.target.value,
                      })
                    }
                  />
                </>
              )}

              {providerDraft.authMode === 'query' && (
                <>
                  <Label htmlFor="probe-query-param">Query parameter</Label>
                  <Input
                    id="probe-query-param"
                    value={providerDraft.queryParam}
                    onChange={(event) =>
                      setProviderDraft({
                        ...providerDraft,
                        queryParam: event.target.value,
                      })
                    }
                  />
                </>
              )}

              <Label>Constant headers</Label>
              <div className="space-y-1">
                {providerDraft.headers.map((header, index) => (
                  <div key={index} className="flex gap-1">
                    <Input
                      aria-label={`header name ${index + 1}`}
                      value={header.name}
                      placeholder="anthropic-version"
                      onChange={(event) =>
                        setProviderDraft({
                          ...providerDraft,
                          headers: providerDraft.headers.map(
                            (entry, position) =>
                              position === index
                                ? { ...entry, name: event.target.value }
                                : entry
                          ),
                        })
                      }
                    />
                    <Input
                      aria-label={`header value ${index + 1}`}
                      value={header.value}
                      placeholder="2023-06-01"
                      onChange={(event) =>
                        setProviderDraft({
                          ...providerDraft,
                          headers: providerDraft.headers.map(
                            (entry, position) =>
                              position === index
                                ? { ...entry, value: event.target.value }
                                : entry
                          ),
                        })
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setProviderDraft({
                          ...providerDraft,
                          headers: providerDraft.headers.filter(
                            (_, position) => position !== index
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={providerDraft.headers.length >= MAX_STATIC_HEADERS}
                  onClick={() =>
                    setProviderDraft({
                      ...providerDraft,
                      headers: [
                        ...providerDraft.headers,
                        { name: '', value: '' },
                      ],
                    })
                  }
                >
                  Add header
                </Button>
              </div>
              <p className="text-xs text-ink-secondary">
                Constants only — never put a credential here. The credential
                belongs in the slot above, and `authorization` is reserved.
              </p>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={() => void saveProvider()}>Save</Button>
            <Button variant="ghost" onClick={() => setProviderDraft(null)}>
              Cancel
            </Button>
          </div>
        </article>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-ink-primary">
          Groups ({payload.groups.length})
        </h2>
        <ul className="space-y-1 text-sm">
          {payload.groups.map((group, index) => (
            <li
              key={group.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2"
            >
              <span className="text-ink-primary">
                {group.name}{' '}
                <span className="text-xs text-ink-secondary">
                  order {group.order}
                </span>
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => void moveGroup(index, -1)}
                >
                  Up
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={index === payload.groups.length - 1}
                  onClick={() => void moveGroup(index, 1)}
                >
                  Down
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await useVault.getState().removeGroup(group.id);
                    if (useVault.getState().error) return;
                    await useVault.getState().save();
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <Input
            aria-label="New group name"
            value={groupName}
            placeholder="New group"
            onChange={(event) => setGroupName(event.target.value)}
          />
          <Button onClick={() => void addGroup()}>Add</Button>
        </div>
        <p className="text-xs text-ink-secondary">
          Deleting a group keeps its keys and ungroups them.
        </p>
      </div>
    </section>
  );
}

function describeProbe(provider: Provider): string {
  const probe = provider.probe;
  if (!probe) return 'cannot be checked';
  const auth = probe.auth;
  const where =
    auth.mode === 'header'
      ? `header ${auth.name}`
      : auth.mode === 'query'
        ? `query ${auth.param}`
        : auth.mode === 'basic'
          ? 'Basic'
          : 'Bearer';
  const extra =
    probe.headers.length > 0 ? ` + ${probe.headers.length} headers` : '';
  return `GET ${probe.target} · ${where}${extra}`;
}
