export const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
export async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}
export async function secretMatches(provided, expected) {
  const encoder = new TextEncoder();
  const hashes = await Promise.all([provided, expected].map(value =>
    crypto.subtle.digest("SHA-256", encoder.encode(value))));
  return crypto.subtle.timingSafeEqual(hashes[0], hashes[1]);
}
export const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: {
  "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", ...headers,
} });
export function check(condition, message, status = 400) {
  if (!condition) throw Object.assign(new Error(message), { status });
}
export const manager = session => check(["owner", "organizer"].includes(session.role), "Organizer access required.", 403);
export const cookie = request => {
  const value = request.headers.get("Cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("sh_session="))?.slice(11) || "";
  const [eventId, secret] = value.split(".");
  return { eventId, secret };
};
export const sessionCookie = (eventId, secret, age = 60 * 60 * 24 * 30) =>
  `sh_session=${eventId}.${secret}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
export async function readJson(request, limit = 16384) {
  check(Number(request.headers.get("Content-Length") || 0) <= limit, "Request too large.", 413);
  const reader = request.body?.getReader(), chunks = [];
  let size = 0;
  if (reader) for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); check(false, "Request too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { check(false, "Invalid JSON."); }
}
