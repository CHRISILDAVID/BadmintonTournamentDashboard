// One splash owns the document's initial load, across every React/Suspense
// handoff. Loading markers keep it up until the actual role screen is mounted.
export function initializeStartupSplash() {
  const splash = document.getElementById("startup-splash");
  const root = document.getElementById("root");
  if (!splash || !root) return;
  const video = splash.querySelector("video");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let finished = motion.matches || video.ended;
  let dismissed = false;

  const reveal = () => {
    if (dismissed || !finished || !root.firstElementChild || root.querySelector("[data-startup-loading]")) return;
    dismissed = true;
    observer.disconnect();
    clearTimeout(mediaTimeout);
    clearTimeout(retryTimeout);
    motion.removeEventListener("change", motionChanged);
    video.pause();
    splash.remove();
    root.inert = false;
    root.removeAttribute("aria-hidden");
    if (document.activeElement === document.body) root.querySelector("h1[tabindex='-1']")?.focus({ preventScroll: true });
  };
  const complete = () => { finished = true; reveal(); };
  const showPoster = () => { video.pause(); video.hidden = true; complete(); };
  const motionChanged = () => { if (motion.matches) showPoster(); };
  const observer = new MutationObserver(reveal);
  observer.observe(root, { childList: true, subtree: true });
  video.addEventListener("ended", complete, { once: true });
  video.addEventListener("error", showPoster, { once: true });
  video.querySelector("source")?.addEventListener("error", showPoster, { once: true });
  motion.addEventListener("change", motionChanged);
  // A rejected autoplay, stalled download or unsupported codec must never
  // hold an otherwise ready application behind an animation.
  const mediaTimeout = setTimeout(showPoster, 6000);
  const retryTimeout = setTimeout(() => { splash.querySelector(".splash-status").hidden = false; }, 12000);
  splash.querySelector(".splash-retry").addEventListener("click", () => location.reload());
  if (motion.matches) showPoster();
  else video.play().catch(showPoster);
  reveal();
}
