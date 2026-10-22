// One splash owns the document's initial load, across every React/Suspense
// handoff. Loading markers keep it up until the actual role screen is mounted.
import breathingVideo from "../assets/shuttlehub-splash-breathe.mp4";

export function initializeStartupSplash() {
  const splash = document.getElementById("startup-splash");
  const root = document.getElementById("root");
  if (!splash || !root) return;
  const video = splash.querySelector("video");
  const skipEvents = ["click", "keydown", "wheel", "touchstart"];
  // Start deliberately after the bootstrap is attached. Autoplay in the HTML
  // can finish behind a slow module load before desktop users see the intro.
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  let finished = false;
  let dismissed = false;
  let playing = false;
  let skipped = false;
  let mediaTimeout;
  let entranceChecked = false;
  let checkpointFrame;
  const appReady = () => !!root.firstElementChild && !root.querySelector("[data-startup-loading]");

  const reveal = () => {
    if (dismissed || !finished || !appReady()) return;
    dismissed = true;
    observer.disconnect();
    clearTimeout(mediaTimeout);
    clearTimeout(retryTimeout);
    if (checkpointFrame !== undefined) video.cancelVideoFrameCallback?.(checkpointFrame);
    document.removeEventListener("visibilitychange", visibilityChanged);
    for (const type of skipEvents) document.removeEventListener(type, skip, true);
    video.pause();
    splash.remove();
    root.inert = false;
    root.removeAttribute("aria-hidden");
    if (document.activeElement === document.body) root.querySelector("h1[tabindex='-1']")?.focus({ preventScroll: true });
  };
  const showPoster = () => {
    if (dismissed) return;
    clearTimeout(mediaTimeout);
    video.pause(); video.hidden = true;
    delete splash.dataset.playing;
    finished = true; reveal();
  };
  const play = () => { if (!dismissed && !skipped) video.play().catch(showPoster); };
  const checkEntrance = elapsed => {
    if (dismissed || entranceChecked || elapsed < 2.2) return;
    entranceChecked = true;
    // Decide once at 2.2 seconds. If data arrives after this checkpoint,
    // keep the splash through the original clip's end at four seconds.
    if (appReady()) { finished = true; reveal(); }
  };
  const checkFrame = (_now, frame) => {
    checkEntrance(frame.mediaTime);
    if (!dismissed && !entranceChecked) checkpointFrame = video.requestVideoFrameCallback(checkFrame);
  };
  const complete = () => {
    if (dismissed || skipped) return;
    finished = true; reveal();
    if (!dismissed) {
      // Entrance is only 0–2 seconds. Waiting for data repeats the breathing
      // segment, never the shuttle's flight or the whole four-second clip.
      // A separate tail clip gives native looping. Calling play() while a
      // seek from an ended video is pending can rewind to zero in Chromium.
      video.dataset.segment = "breathing";
      video.loop = true;
      video.src = breathingVideo;
      video.load();
      play();
    }
  };
  const observer = new MutationObserver(reveal);
  observer.observe(root, { childList: true, subtree: true });
  video.addEventListener("ended", complete);
  video.addEventListener("timeupdate", () => checkEntrance(video.currentTime));
  if (video.requestVideoFrameCallback) checkpointFrame = video.requestVideoFrameCallback(checkFrame);
  video.addEventListener("playing", () => {
    if (dismissed || skipped || video.hidden) { video.pause(); return; }
    playing = true;
    clearTimeout(mediaTimeout);
    splash.dataset.playing = "true";
  });
  video.addEventListener("error", showPoster, { once: true });
  video.querySelector("source")?.addEventListener("error", showPoster, { once: true });
  // A rejected autoplay, stalled download or unsupported codec must never
  // hold an otherwise ready application behind an animation.
  const watchForStall = () => {
    if (dismissed || skipped) return;
    clearTimeout(mediaTimeout);
    mediaTimeout = setTimeout(showPoster, 7000);
  };
  video.addEventListener("waiting", watchForStall);
  video.addEventListener("stalled", watchForStall);
  watchForStall();
  const retryTimeout = setTimeout(() => { splash.querySelector(".splash-status").hidden = false; }, 12000);
  splash.querySelector(".splash-retry").addEventListener("click", () => location.reload());
  const skip = event => {
    if (dismissed || event.target.closest?.(".splash-retry")) return;
    // Preserve browser shortcuts such as reload, tab switching and zoom.
    if (event.type === "keydown" && (event.ctrlKey || event.metaKey || event.altKey || event.repeat ||
      ["Shift", "Control", "Alt", "Meta"].includes(event.key) || /^F\d+$/.test(event.key))) return;
    if (event.type === "wheel" && (event.ctrlKey || event.metaKey)) return;
    // Consume the skip gesture so it cannot activate a control in the app
    // that is revealed underneath it (including synthetic touch clicks).
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
    skipped = true;
    entranceChecked = true;
    if (checkpointFrame !== undefined) video.cancelVideoFrameCallback?.(checkpointFrame);
    splash.querySelector(".splash-hint").hidden = true;
    showPoster();
  };
  for (const type of skipEvents) document.addEventListener(type, skip, { capture: true, passive: false });
  const visibilityChanged = () => {
    if (dismissed || skipped || video.hidden || document.hidden) return;
    if (video.paused && playing) play();
  };
  document.addEventListener("visibilitychange", visibilityChanged);
  // Preloading starts in HTML. Its error can precede this module's listeners.
  if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) showPoster();
  else { video.currentTime = 0; play(); }
  reveal();
}
