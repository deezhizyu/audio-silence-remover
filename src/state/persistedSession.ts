import type { DetectionConfig, ExportAudioFormat } from '../audio/types';

const DATABASE_NAME = 'silence-remover';
const DATABASE_VERSION = 1;
const STORE_NAME = 'session';
const RECORD_KEY = 'current';

export interface PersistedSessionRecord {
  fileBlob: Blob;
  fileName: string;
  detectionConfig: DetectionConfig;
  exportFormat: ExportAudioFormat;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local session database.'));
  });
}

export async function savePersistedSession(record: PersistedSessionRecord): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record, RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the local session.'));
    });
  } finally {
    database.close();
  }
}

export async function loadPersistedSession(): Promise<PersistedSessionRecord | null> {
  const database = await openDatabase();
  try {
    return await new Promise<PersistedSessionRecord | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve((request.result as PersistedSessionRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Could not load the local session.'));
    });
  } finally {
    database.close();
  }
}

export async function clearPersistedSession(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not clear the local session.'));
    });
  } finally {
    database.close();
  }
}
