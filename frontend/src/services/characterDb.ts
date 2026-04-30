// src/services/characterDb.ts

const DB_NAME = 'MaeveCharacterDB';
const STORE_NAME = 'characters';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveCharacterFile = async (file: File | Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(file, 'custom_vrm'); // 'custom_vrm' is the key

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getCharacterFile = async (): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('custom_vrm');

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

//  Add this new function
export const deleteCharacterFile = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // We are using the character name/ID as the key. 
    // Ideally, we should store multiple files with unique keys, 
    // but for now, we are deleting the 'custom_vrm' entry if that's what you use.
    // If you want to support multiple custom characters in DB, we need to change how we store them.
    // For this specific request based on your previous code (single custom slot 'custom_vrm'):
    
    const request = store.delete('custom_vrm'); 

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
