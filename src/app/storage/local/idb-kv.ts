/**
 * IndexedDB implementation of the local key/value port.
 *
 * One object store of `key → value`, which is all the local state needs. Values
 * include `CryptoKey` instances (the device HMAC key); structured clone keeps
 * them non-extractable across the round trip.
 */

import type { KeyValuePort } from './state';

const DB_NAME = 'keya-local';
const DB_VERSION = 1;
const STORE = 'state';

export class IndexedDbKeyValue implements KeyValuePort {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error('Close other Keya tabs to upgrade local storage.'));
    });
    return this.db;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE, 'readonly')
        .objectStore(STORE)
        .get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /** Prefix scan with a bounded key range, not a full read. */
  async keys(prefix: string): Promise<string[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const store = db.transaction(STORE, 'readonly').objectStore(STORE);
      const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
      const request = store.getAllKeys(range);
      request.onsuccess = () =>
        resolve((request.result as IDBValidKey[]).map(String));
      request.onerror = () => reject(request.error);
    });
  }
}
