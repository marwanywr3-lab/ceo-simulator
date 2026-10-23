/** Read-only backup cache. It is never submitted as authoritative economic state. */
export function cacheSave(id: string, value: unknown) {
  if (!("indexedDB" in window)) return;
  const req = indexedDB.open("ceo-simulator-cache", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("saves");
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction("saves", "readwrite");
    tx.objectStore("saves").put(value, id);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  };
  req.onerror = () => {
    /* server save is authoritative */
  };
}

export function removeCachedSaves(ids: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      resolve();
      return;
    }
    const request = indexedDB.open("ceo-simulator-cache", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("saves");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("saves", "readwrite");
      for (const id of ids) transaction.objectStore("saves").delete(id);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
}
