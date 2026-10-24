import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import StartupLoading from "../components/StartupLoading.jsx";
import MaintainerHistory from "./MaintainerHistory.jsx";
import { maintainerRequest as request } from "./maintainer-api.js";

export default function Maintainer() {
  const [session, setSession] = useState(undefined), [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [owner, setOwner] = useState(""), [directory, setDirectory] = useState(null);
  const [grant, setGrant] = useState(null), [qr, setQr] = useState("");
  const [tab, setTab] = useState("access");
  function lock() { setSession(null); setDirectory(null); setGrant(null); setQr(""); setSecret(""); setTab("access"); }
  async function load(after = "") {
    setDirectory(await request(`maintainer/owners${after ? `?after=${encodeURIComponent(after)}` : ""}`));
  }
  async function run(action) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (e) { if (e.status === 401) lock(); setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const next = await request("maintainer/session");
        if (active) { setSession(next); await load(); }
      } catch (e) { if (active) { lock(); if (e.status !== 401) setError(e.message); } }
    }
    checkSession(); window.addEventListener("focus", checkSession);
    return () => { active = false; window.removeEventListener("focus", checkSession); };
  }, []);
  useEffect(() => {
    let active = true; setQr("");
    if (grant) QRCode.toDataURL(grant.setupUrl, { width: 240, margin: 2 }).then(value => active && setQr(value)).catch(() => {});
    return () => { active = false; };
  }, [grant]);
  async function unlock(e) {
    e.preventDefault();
    const submitted = secret; setSecret("");
    await run(async () => { const next = await request("maintainer/session", { secret: submitted }); setSession(next); await load(); });
  }
  async function issue(identifier, recover = false) {
    if (recover && !window.confirm(`Restore access for ${identifier}? This replaces earlier setup and recovery links. Opening the new link revokes the previous primary-organizer sessions. Verify the recipient before sharing it.`)) return;
    await run(async () => {
      setGrant(null);
      const result = await request(recover ? "maintainer-recovery" : "provision", { owner: identifier });
      setGrant({ ...result, owner: identifier, recover }); setOwner("");
      // A directory refresh failure must not discard a successfully issued link.
      try { await load(); } catch { setNotice("Link created. Refresh the directory when the connection returns."); }
    });
  }
  async function logout(all = false) {
    if (all && !window.confirm("Lock maintainer tools on every browser? Organizer and umpire sessions will stay active.")) return;
    await run(async () => { await request(all ? "maintainer/logout-all" : "maintainer/logout", {}); lock(); });
  }
  async function revoke(identifier) {
    if (!window.confirm(`Remove organizer access for ${identifier}? This signs out the primary organizer and their co-organizers, and invalidates their setup, invitation and recovery links. Event data stays saved. Use Restore access to grant access again.`)) return;
    await run(async () => {
      await request("maintainer/revoke", { owner: identifier });
      setGrant(current => current?.owner === identifier ? null : current);
      setNotice(`Organizer access removed for ${identifier}. Event data is preserved.`);
    });
  }
  if (session === undefined) return <StartupLoading/>;
  return <main className="maintainer-page">
    <header><a className="maintainer-brand" href="/">ShuttleHub</a><span>Maintainer tools</span></header>
    {!session ? <section className="maintainer-card">
      <h1>Unlock organizer setup</h1>
      <p>Manage primary-organizer access and browse event history. Use your private provisioning secret to unlock these tools.</p>
      <form onSubmit={unlock}>
        <label htmlFor="maintainer-secret">Provisioning secret</label>
        <input id="maintainer-secret" type="password" autoComplete="current-password" required maxLength={2048} value={secret} onChange={e => setSecret(e.target.value)}/>
        <button disabled={busy} type="submit">{busy ? "Unlocking…" : "Unlock maintainer tools"}</button>
      </form>
      <small>This browser remembers access for up to 7 days. This secret grants authority to provision organizers; keep it private.</small>
    </section> : <>
      <div className="maintainer-heading"><div><h1>{tab === "access" ? "Primary organizer access" : "Event history"}</h1><p>{tab === "access" ? "Create a private setup link. The organizer opens it and saves their recovery link." : "Read-only results across every organizer’s event."}</p></div>
        <div className="maintainer-controls"><button disabled={busy} onClick={() => logout()}>Lock this browser</button><button disabled={busy} onClick={() => logout(true)}>Lock all maintainer browsers</button></div>
      </div>
      <nav className="maintainer-tabs" aria-label="Maintainer sections"><button aria-current={tab === "access" ? "page" : undefined} onClick={() => setTab("access")}>Organizer access</button><button aria-current={tab === "history" ? "page" : undefined} onClick={() => setTab("history")}>Event history</button></nav>
      {tab === "history" ? <MaintainerHistory onLock={lock}/> : <>
      <section className="maintainer-card">
        <h2>Create primary organizer</h2>
        <p>Use one permanent identifier per organizer, such as <code>ravi-club</code>. Each identifier owns exactly one event. Restore an existing identifier if access is lost.</p>
        <form onSubmit={e => { e.preventDefault(); issue(owner.trim()); }}>
          <label htmlFor="organizer-identifier">Permanent organizer identifier</label>
          <input id="organizer-identifier" type="text" placeholder="ravi-club" required pattern="[a-zA-Z0-9_-]{3,100}" minLength={3} maxLength={100} autoComplete="off" spellCheck={false} value={owner} onChange={e => setOwner(e.target.value)} aria-describedby="identifier-help"/>
          <small id="identifier-help">3–100 letters, numbers, hyphens or underscores. Identifiers are case-sensitive.</small>
          <button disabled={busy} type="submit">{busy ? "Please wait…" : "Create private setup link"}</button>
        </form>
      </section>
      {grant && <section className="maintainer-card maintainer-grant" aria-label="Private organizer setup link">
        <h2>{grant.recover ? "Access restoration" : "Organizer setup"}: {grant.owner}</h2>
        <p>Share privately with this organizer. This single-use link expires in 24 hours and grants management access to their event.</p>
        <textarea aria-label="Private setup link" readOnly value={grant.setupUrl}/>
        <div className="maintainer-controls"><button onClick={() => run(async () => { await navigator.clipboard.writeText(grant.setupUrl); setNotice("Private link copied. Send it only to the intended organizer."); })}>Copy private setup link</button><button onClick={() => setGrant(null)}>Hide link</button></div>
        {qr && <img src={qr} alt="Private organizer setup QR" width="240" height="240"/>}
        <small>The organizer saves their recovery link after opening this. If this setup link is lost, restore the same identifier below.</small>
      </section>}
      <section className="maintainer-card">
        <div className="maintainer-heading"><h2>Existing organizers</h2><button disabled={busy} onClick={() => run(() => load())}>Refresh directory</button></div>
        <p>These identifiers already have a private event. Remove organizer access to sign out its organizers and invalidate their links. Event data is preserved and access can be restored.</p>
        {!directory ? <p>Loading organizers…</p> : !directory.owners.length ? <p>No organizers on this page.</p> : <ul className="maintainer-owners">{directory.owners.map(row => <li key={row.owner}><strong>{row.owner}</strong><div className="maintainer-controls"><button disabled={busy} aria-label={`Restore access for ${row.owner}`} onClick={() => issue(row.owner, true)}>Restore access</button><button className="maintainer-remove" disabled={busy} aria-label={`Remove access for ${row.owner}`} onClick={() => revoke(row.owner)}>Remove access</button></div></li>)}</ul>}
        <div className="maintainer-controls">{directory?.nextCursor && <button disabled={busy} onClick={() => run(() => load(directory.nextCursor))}>Next 100 organizers</button>}<button disabled={busy} onClick={() => run(() => load())}>First page</button></div>
      </section>
      </>}
    </>}
    {error && <p className="score-error" role="alert">{error}</p>}
    {notice && <p className="maintainer-notice" role="status">{notice}</p>}
    <footer>Organizer invitations and event management remain inside each organizer’s own desk.</footer>
  </main>;
}
