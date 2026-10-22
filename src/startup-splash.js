// One splash owns the document's initial load, across every React/Suspense
// handoff. Loading markers keep it up until the actual role screen is mounted.
import breathingVideo from "../assets/shuttlehub-splash-breathe.mp4";

export function initializeStartupSplash() {
  const splash = document.getElementById("startup-splash");
  const root = document.getElementById("root");
  if (!splash || !root) return;
  const video = splash.querySelector("video");
  const motionButton = splash.querySelector(".splash-motion");
  // Start deliberately after the bootstrap is attached. Autoplay in the HTML
  // can finish behind a slow module load before desktop users see the intro.
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  let finished = false;
  let dismissed = false;
  let playing = false;
  let mediaTimeout;

  const reveal = () => {
    if (dismissed || !finished || !root.firstElementChild || root.querySelector("[data-startup-loading]")) return;
    dismissed = true;
    observer.disconnect();
    clearTimeout(mediaTimeout);
    clearTimeout(retryTimeout);
    document.removeEventListener("visibilitychange", visibilityChanged);
    video.pause();
    splash.remove();
    root.inert = false;
    root.removeAttribute("aria-hidden");
    if (document.activeElement === document.body) root.querySelector("h1[tabindex='-1']")?.focus({ preventScroll: true });
  };
  const showPoster = () => {
    if (dismissed) return;
    clearTimeout(mediaTimeout);
    video.pause(); video.hidden = true; motionButton.hidden = true;
    delete splash.dataset.playing;
    finished = true; reveal();
  };
  const play = () => { video.play().catch(showPoster); };
  const complete = () => {
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
  video.addEventListener("playing", () => {
    playing = true;
    clearTimeout(mediaTimeout);
    splash.dataset.playing = "true";
    motionButton.hidden = false;
  });
  video.addEventListener("error", showPoster, { once: true });
  video.querySelector("source")?.addEventListener("error", showPoster, { once: true });
  // A rejected autoplay, stalled download or unsupported codec must never
  // hold an otherwise ready application behind an animation.
  const watchForStall = () => {
    clearTimeout(mediaTimeout);
    mediaTimeout = setTimeout(showPoster, 7000);
  };
  video.addEventListener("waiting", watchForStall);
  video.addEventListener("stalled", watchForStall);
  watchForStall();
  const retryTimeout = setTimeout(() => { splash.querySelector(".splash-status").hidden = false; }, 12000);
  splash.querySelector(".splash-retry").addEventListener("click", () => location.reload());
  motionButton.addEventListener("click", () => {
    if (video.paused) {
      motionButton.textContent = "Pause animation";
      motionButton.setAttribute("aria-pressed", "false");
      play();
    } else {
      video.pause();
      clearTimeout(mediaTimeout);
      motionButton.textContent = "Play animation";
      motionButton.setAttribute("aria-pressed", "true");
      // A deliberately paused intro must not block a ready application.
      finished = true; reveal();
    }
  });
  const visibilityChanged = () => {
    if (dismissed || document.hidden || motionButton.getAttribute("aria-pressed") === "true") return;
    if (video.paused && playing) play();
  };
  document.addEventListener("visibilitychange", visibilityChanged);
  // Preloading starts in HTML. Its error can precede this module's listeners.
  if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) showPoster();
  else { video.currentTime = 0; play(); }
  reveal();
}
