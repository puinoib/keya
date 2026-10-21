/**
 * Unlock or create a vault, using the v2 core.
 *
 * Deliberately small: this screen exists to prove the new stack end to end
 * before the rest of the UI is migrated. It shows what the locked state can
 * know — a container fingerprint and, when registered, a name and key count.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVault } from '@/app/store/next-vault';
import {
  describePasswordVerdict,
  judgePassword,
} from '@/app/lib/password-policy';
import type { ContainerRecord } from '@/app/storage/local/state';

export function UnlockScreen() {
  const workspaceName = useVault((state) => state.workspaceName);
  const files = useVault((state) => state.files);
  const containers = useVault((state) => state.containers);
  const busy = useVault((state) => state.busy);
  const error = useVault((state) => state.error);

  const [selected, setSelected] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [fileName, setFileName] = useState('my-keys.keya');
  const [vaultName, setVaultName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && files.length === 1) setSelected(files[0]);
  }, [files, selected]);

  const byName = new Map(
    containers.map((record) => [record.file_name, record])
  );

  const unlock = async () => {
    if (!selected) return;
    const ok = await useVault.getState().unlock(selected, password);
    if (ok) setPassword('');
  };

  const create = async () => {
    const verdict = await judgePassword(password);
    if (!verdict.ok) {
      setNotice(describePasswordVerdict(verdict));
      return;
    }
    setNotice(null);
    await useVault
      .getState()
      .createVault(fileName, password, { name: vaultName, icon: '🔑' });
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink-primary">Keya</h1>
        <p className="text-sm text-ink-secondary">
          {workspaceName
            ? `Folder: ${workspaceName}`
            : 'Choose the folder that holds your .keya files.'}
        </p>
      </header>

      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => void useVault.getState().pickWorkspace()}
        >
          {workspaceName ? 'Change folder' : 'Choose folder'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => void useVault.getState().refreshFiles()}
        >
          Refresh
        </Button>
      </div>

      {files.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-ink-primary">Vaults</h2>
          <ul className="space-y-1">
            {files.map((file) => {
              const record = byName.get(file);
              return (
                <li key={file}>
                  <button
                    type="button"
                    onClick={() => setSelected(file)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selected === file
                        ? 'border-accent bg-surface-4'
                        : 'border-line bg-surface-2'
                    }`}
                  >
                    <span className="font-medium text-ink-primary">
                      {record
                        ? `${record.icon} ${record.name}`
                        : 'Unknown file'}
                    </span>
                    <span className="ml-2 text-xs text-ink-secondary">
                      {file}
                      {record ? ` · ${record.key_count} keys` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2 rounded-md border border-line bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-ink-primary">
          {creating ? 'Create a vault' : 'Unlock'}
        </h2>

        {creating && (
          <>
            <Label htmlFor="fileName">File name</Label>
            <Input
              id="fileName"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder="my-keys.keya"
            />
            <Label htmlFor="vaultName">Vault name</Label>
            <Input
              id="vaultName"
              value={vaultName}
              onChange={(event) => setVaultName(event.target.value)}
              placeholder="Work"
            />
          </>
        )}

        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          autoComplete={creating ? 'new-password' : 'current-password'}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void (creating ? create() : unlock());
          }}
        />

        <div className="flex gap-2 pt-1">
          {creating ? (
            <>
              <Button disabled={busy} onClick={() => void create()}>
                Create
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={!selected || busy}
                onClick={() => void unlock()}
              >
                Unlock
              </Button>
              <Button variant="ghost" onClick={() => setCreating(true)}>
                New vault
              </Button>
            </>
          )}
        </div>

        {notice && <p className="text-xs text-danger">{notice}</p>}
        {error && (
          <p className="text-xs text-danger">{describeFailure(error)}</p>
        )}
        {busy && <p className="text-xs text-ink-secondary">Working…</p>}
      </section>
    </main>
  );
}

function describeFailure(failure: string): string {
  switch (failure) {
    case 'auth_failed':
      return 'Wrong password, or the file was modified.';
    case 'file_too_short':
      return 'The file is incomplete.';
    case 'bad_magic':
      return 'This is not a Keya file.';
    case 'unsupported_version':
      return 'This file version is not supported.';
    case 'kdf_out_of_range':
      return 'The file header has unsupported parameters.';
    case 'invalid_payload':
      return 'The file contents do not match the current format.';
    case 'missing_file':
      return 'The file no longer exists.';
    case 'no_workspace':
      return 'Choose a folder first.';
    case 'permission_denied':
      return 'Write permission for the folder was denied.';
    case 'kdf_busy':
      return 'Another tab is unlocking. Try again in a moment.';
    default:
      return failure;
  }
}

export type { ContainerRecord };
