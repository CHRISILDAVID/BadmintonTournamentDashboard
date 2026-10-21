// Maintainer only. The secret is read from the environment, never argv or logs.
const [origin, owner, mode] = process.argv.slice(2);
if (!origin || !owner || !process.env.SHUTTLE_PROVISIONING_SECRET) {
  console.error("Usage: npm run provision -- https://shuttlehub.<subdomain>.workers.dev stable-owner-id\nSet SHUTTLE_PROVISIONING_SECRET in the environment first.");
  process.exit(1);
}
const r = await fetch(new URL(mode === "--recover" ? "/api/maintainer-recovery" : "/api/provision", origin), { method: "POST",
  headers: { Authorization: `Bearer ${process.env.SHUTTLE_PROVISIONING_SECRET}`, "Content-Type": "application/json" },
  body: JSON.stringify({ owner }) });
const result = await r.json();
if (!r.ok) { console.error(result.error); process.exit(1); }
console.log("Private, single-use setup link (expires in 24 hours). Send privately to the intended organizer:");
console.log(result.setupUrl);
