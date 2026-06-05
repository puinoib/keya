import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAutoLock } from '../hooks/useAutoLock';
import { loadSession, clearSession } from '../lib/session';
import { FileStorage } from '../lib/storage';

export function SessionRestore({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (!session) return;

      const { fileName, password } = session;
      try {
        const db = await FileStorage.openVault(fileName, password);
        await useStore.getState().unlock(db, password, fileName);
      } catch {
        clearSession();
      }
    })();
  }, []);

  useAutoLock();

  return <>{children}</>;
}
