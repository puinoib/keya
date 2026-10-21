/**
 * The IndexedDB database that holds PRF-wrapped credentials.
 *
 * Kept separate from the vault registry so a cleared biometric record never
 * takes the display summaries with it, and vice versa.
 */

export const BIOMETRIC_STORE = 'biometric';

const DB_NAME = 'keya-meta';
const DB_VERSION = 2;

export function openMetaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BIOMETRIC_STORE)) {
        db.createObjectStore(BIOMETRIC_STORE, { keyPath: 'vault_id' });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onblocked = () =>
      reject(new Error('Close other Keya tabs to upgrade secure storage.'));
    request.onerror = () => reject(request.error);
  });
}
