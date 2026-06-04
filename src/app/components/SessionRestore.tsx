import { useState, useEffect } from 'react';
import { Spinner } from '@phosphor-icons/react';
import { useStore } from '../store/useStore';
import { useAutoLock } from '../hooks/useAutoLock';
import { loadSession, clearSession } from '../lib/session';
import { FileStorage } from '../lib/storage';

export function SessionRestore({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setReady(true);
      return;
    }

    const { fileName, password } = session;
    FileStorage.openVault(fileName, password)
      .then((db) => {
        useStore.getState().unlock(db, password, fileName);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => setReady(true));
  }, []);

  useAutoLock();

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas-deepest">
        <Spinner className="size-6 animate-spin text-ink-quaternary" />
      </div>
    );
  }

  return <>{children}</>;
}
