import React, { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import iconVideo from "../../assets/shuttlehub-icon-breathe.mp4";
import logoVideo from "../../assets/shuttlehub-logo-breathe.mp4";
import iconPoster from "../../assets/shuttlehub-icon-poster.jpg";
import logoPoster from "../../assets/shuttlehub-logo-poster.jpg";
import "./animated-logo.css";

// Page lifetime, not component lifetime: navigation does not reset a person's
// pause choice, and no header ever replays the splash's entrance sequence.
const motion = createStore(() => ({ paused: false }));

export default function AnimatedLogo({ iconOnly = false, className = "" }) {
  const video = useRef(null);
  const paused = useStore(motion, state => state.paused);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = video.current;
    if (!player || failed) return;
    let active = true;
    const update = () => {
      if (paused || document.hidden || document.getElementById("startup-splash")) player.pause();
      else {
        player.muted = true;
        player.play().catch(() => { if (active) setFailed(true); });
      }
    };
    update();
    window.addEventListener("shuttle-startup-ready", update);
    document.addEventListener("visibilitychange", update);
    return () => { active = false; window.removeEventListener("shuttle-startup-ready", update); document.removeEventListener("visibilitychange", update); };
  }, [paused, failed]);
  return <button type="button" className={`animated-logo ${className}`} aria-label={`${paused || failed ? "Play" : "Pause"} ShuttleHub logo animation`}
    aria-pressed={paused} title={`${paused ? "Play" : "Pause"} logo animation`} onClick={() => {
      if (failed) setFailed(false);
      motion.setState({ paused: failed ? false : !paused });
    }}>
    <img src={iconOnly ? iconPoster : logoPoster} alt="" aria-hidden="true"/>
    {!failed && <video ref={video} src={iconOnly ? iconVideo : logoVideo} poster={iconOnly ? iconPoster : logoPoster}
      muted playsInline loop preload="auto" aria-hidden="true" tabIndex={-1} disablePictureInPicture onError={() => setFailed(true)}/>}
    <span className="logo-motion-indicator" aria-hidden="true">{paused || failed ? "▶" : "Ⅱ"}</span>
  </button>;
}
