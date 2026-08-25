import type { AppState } from '@/lib/types';

const DATABASE_NAME = 'shaneweb-large-data';
const STORE_NAME = 'note-images';
const ALL_IMAGES_KEY = 'all';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });
}

export async function readStoredNoteImages(): Promise<unknown | null> {
  const database = await openDatabase();
  try {
    return await new Promise<unknown | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(ALL_IMAGES_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read note images'));
    });
  } finally {
    database.close();
  }
}

export async function writeStoredNoteImages(images: AppState['noteImages']) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(images, ALL_IMAGES_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error ?? new Error('Unable to save note images'),
      );
      transaction.onabort = () => reject(
        transaction.error ?? new Error('Unable to save note images'),
      );
    });
  } finally {
    database.close();
  }
}

/** Keeps large data URLs out of localStorage's small per-origin quota. */
export function stateWithoutNoteImages(state: AppState): AppState {
  return { ...state, noteImages: {} };
}
