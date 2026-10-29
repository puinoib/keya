import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { DownloadSimple, UploadSimple, Warning } from '@phosphor-icons/react';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { exportJsonCopy, exportKeyaCopy } from '@/app/lib/vault-export';
import { readLastExport } from '@/app/lib/export-history';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogRoot,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function describeExportedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
}

/**
 * The vault file's way in and out, plus the device's copy of its knowledge.
 * Nothing here edits the payload.
 */
export function DataPage() {
  const { view, forgetDeviceState } = useStore(
    useShallow((s) => ({
      view: s.view,
      forgetDeviceState: s.forgetDeviceState,
    }))
  );
  const vaultId = view?.vaultId;
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    setLastExport(vaultId ? readLastExport(vaultId) : null);
  }, [vaultId]);

  const refreshLastExport = () => {
    if (vaultId) setLastExport(readLastExport(vaultId));
  };

  return (
    <>
      <div className="space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <DownloadSimple className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Export
            </span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
            <div className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Encrypted copy
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  A .keya file you can put anywhere and open with the same
                  password. The only backup format.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (await exportKeyaCopy()) refreshLastExport();
                }}
                className="shrink-0 rounded-md border border-line bg-surface-3 px-2.5 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-surface-4"
              >
                Export .keya
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Plain-text exchange
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Every key, provider and group as JSON. Not a backup: it
                  contains the secrets in clear text.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (await exportJsonCopy()) refreshLastExport();
                }}
                className="shrink-0 rounded-md border border-line bg-surface-3 px-2.5 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-surface-4"
              >
                Export JSON
              </button>
            </div>
          </div>
          <p className="mt-2 text-right text-[11px] text-ink-quaternary">
            {lastExport
              ? `Last export from this device: ${describeExportedAt(lastExport)}`
              : 'No export from this device yet'}
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <UploadSimple className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Import
            </span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-xs font-medium text-ink-primary">
              Import is not available yet
            </p>
            <p className="text-xs text-ink-quaternary mt-0.5">
              Keya cannot merge a .keya file or a JSON export into this vault.
              To move to another vault, open it from the vault menu; opening
              replaces the current session rather than adding to it. See{' '}
              {/* A plain anchor reloads the app, and no unlocked session
                  survives a reload: reading this help page would cost the
                  reader their master password. */}
              <Link
                to="/docs/$slug"
                params={{ slug: 'backup' }}
                className="text-accent hover:underline"
              >
                Backup &amp; Restore
              </Link>{' '}
              for what the file does and does not guarantee.
            </p>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Warning className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              This device
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 p-3">
            <div>
              <p className="text-xs font-medium text-ink-primary">
                Forget this vault's device data
              </p>
              <p className="text-xs text-ink-quaternary mt-0.5">
                Deletes this device's check results, cached allowances and
                biometric binding for this vault. Preferences, themes and
                shortcuts stay. The .keya file is not touched.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmForget(true)}
              disabled={forgetting}
              className="shrink-0 rounded-md border border-danger/30 px-2.5 py-1.5 text-xs text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
            >
              Forget
            </button>
          </div>
        </section>
      </div>

      <AlertDialogRoot open={confirmForget} onOpenChange={setConfirmForget}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this device's data?</AlertDialogTitle>
            <AlertDialogDescription>
              Check results, cached allowances and the biometric binding for
              this vault are deleted from this device. The .keya file stays
              exactly as it is, and nothing is sent anywhere.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setForgetting(true);
                try {
                  await forgetDeviceState();
                  toast.success('Device data forgotten');
                } catch (error) {
                  toast.error('Could not forget this device\u2019s data', {
                    description:
                      error instanceof Error ? error.message : undefined,
                  });
                } finally {
                  setForgetting(false);
                }
              }}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Forget device data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </>
  );
}
