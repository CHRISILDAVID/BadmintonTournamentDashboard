let opening;
function database() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open("shuttlehub-cloud-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("records");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(new Error("Device storage unavailable. No point was recorded.")); };
  });
  return opening;
}
export async function read(key) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records"), request = tx.objectStore("records").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not read saved scoring work."));
  });
}
export async function write(key, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite", { durability: "strict" });
    try { tx.objectStore("records").put(value, key); }
    catch { tx.abort(); reject(new Error("Device storage failed. This change was NOT recorded. Free storage before continuing.")); return; }
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(new Error("Device storage failed. This change was NOT recorded. Free storage before continuing."));
  });
}
export async function list(prefix) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const values = [], tx = db.transaction("records");
    const request = tx.objectStore("records").openCursor(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) { values.push(cursor.value); cursor.continue(); }
      else resolve(values);
    };
    request.onerror = () => reject(new Error("Could not read pending scoring work."));
  });
}
export const namespace = session => `${session.eventId}:${session.sessionId}`;
export const currentSession = () => globalThis.__shuttleSession;
export const cloudEnabled = () => !!currentSession()?.cloud;
export function scopedFetch(url, options = {}) {
  const s = currentSession();
  return fetch(url, { ...options, headers: { ...options.headers, ...(s ? { "X-Shuttle-Event": s.eventId, "X-Shuttle-Session": s.sessionId } : {}) } }).then(response => {
    if (response.status === 401) window.dispatchEvent(new Event("shuttle-revoked"));
    return response;
  });
}
export async function api(path, body) {
  const r = await (path === "redeem" || path === "me" ? fetch : scopedFetch)(`/api/${path}`, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await r.json();
  if (r.status === 401) window.dispatchEvent(new Event("shuttle-revoked"));
  if (!r.ok) throw Object.assign(new Error(result.error || "Cloud unavailable. Pending work is retained."), { status: r.status });
  return result;
}
