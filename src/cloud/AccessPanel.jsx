import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, currentSession } from "./storage.js";
import { venueStore } from "../stores/venue.js";
export default function AccessPanel({ state }) {
  const [access, setAccess] = useState(null), [error, setError] = useState(""), [link, setLink] = useState(""), [qr, setQr] = useState("");
  const [name, setName] = useState(""), [role, setRole] = useState("umpire"), [presetId, setPresetId] = useState("");
  const [screen, setScreen] = useState({ name: "Main screen", courts: "", categories: [], finals: false });
  const [usage, setUsage] = useState(null), [busy, setBusy] = useState(false), [destination, setDestination] = useState("");
  const [notice, setNotice] = useState("");
  const load = async () => { const [a, u] = await Promise.all([api("access"), api("usage")]); setAccess(a); setUsage(u); };
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  useEffect(() => { setQr(""); if (link) QRCode.toDataURL(link, { width: 240 }).then(setQr).catch(() => {}); }, [link]);
  const run = async fn => {
    setBusy(true); setError(""); setNotice("");
    try { const result = await fn(); if (result?.url) setLink(result.url); await load(); setNotice("Changes saved."); return result; }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const umpireName = id => access?.profiles.find(p => p.id === id)?.name || "Unassigned";
  return <section className="panel settings-panel cloud-access" aria-busy={busy}>
    <h2>Cloud access & screens</h2><p>Every device connects directly to this website. Your organizer laptop can be closed.</p>
    <small>Event ID: {currentSession().eventId}</small>
    <p className="access-feedback" role="status">{busy ? "Working…" : notice}</p>
    {error && <p role="alert" className="score-error">{error}</p>}
    <form onSubmit={e => { e.preventDefault(); run(() => api("invite", { name, role, preset: presetId })); }}>
      <h3 id="access-invite">Invite a device</h3><div className="access-row">
        <label className="access-field">Staff / screen name<input aria-label="Staff name" placeholder="e.g. Court 1 umpire" value={name} onChange={e => setName(e.target.value)} required/></label>
        <label className="access-field">Invitation role<select aria-label="Invitation role" value={role} onChange={e => setRole(e.target.value)}><option value="umpire">Umpire</option><option value="organizer">Additional organizer</option><option value="display">Read-only display</option></select></label>
        {role === "display" && <select aria-label="Display preset" required value={presetId} onChange={e => setPresetId(e.target.value)}><option value="">Choose screen preset</option>{access?.presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <button disabled={busy}>{busy ? "Working…" : "Create invitation / QR"}</button>
      </div><small>Staff invitations expire in 15 minutes and work once. Display links are shareable for 30 days and can be revoked.</small>
    </form>
    {link && <div className="private-link"><strong>Share only with the intended person</strong><p>{link}</p>{qr && <img alt="Invitation QR code" src={qr}/>}<button onClick={() => navigator.clipboard.writeText(link).then(() => setNotice("Private link copied.")).catch(() => setError("Copy the link manually."))}>Copy link</button><button onClick={() => setLink("")}>Hide</button></div>}
    <div><h3 id="access-scoring">Scoring control</h3><p>Umpires can manage all event matches, start games on a free court, and claim scoring control from their match desk.</p>
      {state.matches.filter(m => m.status === "live").map(m => <div className="access-row" key={m.id}>
        <span>Court {m.court} · {state.teams.find(t => t.id === m.a)?.name} vs {state.teams.find(t => t.id === m.b)?.name}</span>
        <button disabled={busy} onClick={() => run(() => api("transfer", { matchId: m.id }))}>Release controller</button>
        <button disabled={busy} onClick={() => {
          if (confirm("Restart point scoring at 0–0 under current rules? Audit history and unresolved offline actions are retained. Use the match desk to enter a corrected final score instead if needed."))
            run(() => api("transfer", { matchId: m.id, reset: true }));
        }}>Reconcile / restart at 0–0</button>
      </div>)}
    </div>
    <form onSubmit={e => { e.preventDefault(); run(() => api("preset", { ...screen, courts: screen.courts.split(",").map(n => +n.trim()).filter(n => n > 0) })); }}>
      <h3 id="access-screens">Screen presets</h3><div className="access-row">
        <select aria-label="Edit preset" value={screen.id || ""} onChange={e => {
          const p = access.presets.find(p => p.id === e.target.value);
          setScreen(p ? { ...p, courts: p.courts.join(",") } : { name: "Main screen", courts: "", categories: [], finals: false });
        }}><option value="">New preset</option>{access?.presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <label className="access-field">Screen name<input aria-label="Screen name" value={screen.name} onChange={e => setScreen({ ...screen, name: e.target.value })} required/></label>
        <label className="access-field">Courts (blank = all)<input aria-label="Screen courts" placeholder="e.g. 1,2,3" value={screen.courts} onChange={e => setScreen({ ...screen, courts: e.target.value })}/></label>
        <label><input type="checkbox" checked={screen.finals} onChange={e => setScreen({ ...screen, finals: e.target.checked })}/>Finals live scores only</label>
      </div><div className="access-row">{state.tournaments.map(t => <label key={t.id}><input type="checkbox" checked={screen.categories.includes(t.id)} onChange={e => setScreen({ ...screen, categories: e.target.checked ? [...screen.categories, t.id] : screen.categories.filter(id => id !== t.id) })}/>{t.name}</label>)}</div>
      <small>No categories selected means all categories. Court filters apply to the Live scores widget; standings and brackets retain their category context.</small>
      <div className="access-row"><button type="button" onClick={async () => {
        await venueStore.persist.rehydrate();
        const { selection, savedLayouts } = venueStore.getState();
        setScreen({ ...screen, layout: { selection, savedLayouts } });
      }}>Use this browser’s saved display layout</button><button disabled={busy}>Save screen preset</button></div>
    </form>
    <div><h3 id="access-revoke">Access revocation</h3>{currentSession().role !== "owner" && <p className="help-text">Only the primary owner can revoke owner access.</p>}{access?.profiles.map(p => <div className="access-row" key={p.id}><span>{p.name} · {p.role}</span><button disabled={busy || p.id === currentSession().profile || (p.role === "owner" && currentSession().role !== "owner")} onClick={() => run(() => api("revoke", { profile: p.id }))}>Revoke sessions & links</button></div>)}
      {access?.sessions.filter(s => !s.revoked).map(s => <div className="access-row" key={s.id}><span>{umpireName(s.profile)} · session {s.id.slice(0, 8)} {s.id === currentSession().sessionId ? "(this browser)" : ""}</span><button disabled={busy || (s.role === "owner" && currentSession().role !== "owner")} onClick={() => run(() => api("revoke", { sessionId: s.id }))}>Revoke session</button></div>)}
      {currentSession().role === "owner" && <button disabled={busy} onClick={() => run(() => api("recovery", {}))}>Replace private recovery link</button>}
    </div>
    <div><h3 id="access-unresolved">Unresolved scoring work</h3><p>Review the audit, then correct the match using the existing match desk or restart point scoring. Stale actions are never applied automatically.</p>
      {access?.rejected.map(r => <div key={r.id} className="access-row"><span>{r.match.slice(0, 8)} · {r.reason}<details><summary>Action evidence</summary><pre>{r.payload}</pre></details></span><button disabled={busy} onClick={() => {
        const note = prompt("Record your reconciliation decision (for example: score corrected in match desk):");
        if (note) run(() => api("reconcile", { id: r.id, note }));
      }}>Record decision</button></div>)}
      {!access?.rejected.length && <p>No unresolved submissions received by the server.</p>}
    </div>
    <div><h3 id="access-backup">Usage & backup</h3><p>{usage?.acceptedActions ?? "—"} accepted actions · {usage?.connectedSockets ?? "—"} live connections · {usage ? (usage.databaseBytes / 1048576).toFixed(2) : "—"} MB event storage.</p><small>{usage?.note}</small><div className="access-row"><a href={`/api/export?eventId=${currentSession().eventId}&sessionId=${currentSession().sessionId}`} download>Download event and scoring audit backup</a><button onClick={() => run(load)}>Refresh usage</button></div></div>
    {currentSession().role === "owner" && !state.tournaments.length && <div><h3>Import existing local event</h3><p>Only an empty destination is accepted. Keep your original JSON export and local SQLite backup.</p><input aria-label="Confirm destination event ID" placeholder="Paste this destination event ID" value={destination} onChange={e => setDestination(e.target.value)}/><input aria-label="Import event backup" type="file" accept=".json" disabled={busy || destination !== currentSession().eventId} onChange={e => {
      const file = e.target.files[0]; if (file) run(async () => api("import", { destination, backup: JSON.parse(await file.text()) }));
    }}/></div>}
    <button onClick={async () => { await api("logout", {}); window.dispatchEvent(new Event("shuttle-revoked")); }}>Sign out of this browser</button>
  </section>;
}
