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
