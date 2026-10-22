import React, { lazy, Suspense, useEffect, useState } from "react";
import { api, read, namespace } from "./storage.js";
import { liveStore, stopCloud } from "./connection.js";
const App = lazy(() => import("../App.jsx"));
const POINTER = "shuttlehub.active-session";
export default function CloudGate() {
  const [session, setSession] = useState(null), [error, setError] = useState(""), [recovery, setRecovery] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  useEffect(() => {
    let active = true;
    const revoke = () => {
      stopCloud(); try { localStorage.removeItem(POINTER); } catch {} globalThis.__shuttleSession = null;
      setSession(null); setError("Access expired or was revoked. Open a new invitation or your recovery link.");
    };
    window.addEventListener("shuttle-revoked", revoke);
    const invitationChanged = () => { if (new URLSearchParams(location.hash.slice(1)).has("invite")) location.reload(); };
    window.addEventListener("hashchange", invitationChanged);
    const identityChanged = event => {
      if (event.key !== POINTER || !globalThis.__shuttleSession) return;
      let next; try { next = JSON.parse(event.newValue); } catch {}
      if (next?.sessionId !== globalThis.__shuttleSession.sessionId) {
        stopCloud(); globalThis.__shuttleSession = null; setSession(null);
        setError("Browser access changed in another tab. Reload to use the current session.");
      }
    };
    window.addEventListener("storage", identityChanged);
    (async () => {
      const material = new URLSearchParams(location.hash.slice(1)).get("invite");
      if (material) history.replaceState(null, "", location.pathname); // Secret never goes to server logs.
      let me;
      try {
        if (material) {
          const [eventId, token] = material.split(".");
          me = await api("redeem", { eventId, token });
          if (me.recovery) setRecovery(me.recovery);
        } else me = await api("me");
        const { recovery: _, ...safe } = me;
        me = safe;
        try { localStorage.setItem(POINTER, JSON.stringify(me)); } catch {}
      } catch (e) {
        if (material || (e.status && e.status !== 429 && e.status < 500)) throw e;
        try { me = JSON.parse(localStorage.getItem(POINTER)); } catch {}
        if (!me || me.expires <= Date.now() || !["umpire", "display"].includes(me.role)) throw e;
        me = { ...me, offline: true };
      }
      globalThis.__shuttleSession = me;
      if (me.role === "umpire" && !["/matches", "/matches/history", "/standings"].includes(location.pathname.replace(/\/+$/, ""))) history.replaceState(null, "", "/matches");
      if (me.role === "display" && location.pathname !== "/display") history.replaceState(null, "", "/display");
      if (me.offline) {
        const saved = await read(`${namespace(me)}:snapshot`);
        if (saved) {
          globalThis.__shuttleOfflineState = saved.state;
          liveStore.setState({ records: Object.fromEntries(saved.live.map(r => [r.matchId, r])), preset: saved.preset });
        }
      }
      if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
      if (active) setSession(me);
    })().catch(e => active && setError(e.message));
    return () => { active = false; window.removeEventListener("shuttle-revoked", revoke); window.removeEventListener("hashchange", invitationChanged); window.removeEventListener("storage", identityChanged); };
  }, []);
  if (!session) return <main className="cloud-welcome"><h1>ShuttleHub</h1><p>{error || "Opening your event…"}</p><p>Use the private setup, umpire invitation, or display link provided by your organizer.</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (recovery) return <main className="cloud-welcome"><h1>Save your recovery link</h1><p>This private link grants organizer access. Store it securely before continuing. Recovery revokes your previous organizer sessions and generates a replacement link.</p><textarea readOnly aria-label="Private recovery link" value={recovery}/><button onClick={() => navigator.clipboard.writeText(recovery).then(() => setCopyNotice("Recovery link copied.")).catch(() => setCopyNotice("Could not copy. Select the link above and copy it manually."))}>Copy recovery link</button><p role="status">{copyNotice}</p><button onClick={() => setRecovery("")}>I have saved it — open event</button></main>;
  return <Suspense fallback={<p>Loading tournament desk…</p>}><App/></Suspense>;
}
