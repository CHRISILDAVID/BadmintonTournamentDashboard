import { useEffect } from "react";

// Venue screens cycle independently through every overflowing list. A touch,
// key press, or manual scroll gives the reader time before cycling resumes.
export default function useAutoScroll(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const positions = new Map();
    let areas = [];
    let frame;
    let lastFrame = 0;
    let pausedUntil = 0;
    const edgePause = 3500;
    const collect = () => {
      areas = [...root.querySelectorAll("[data-auto-scroll]")];
      for (const node of positions.keys()) {
        if (!areas.includes(node)) positions.delete(node);
      }
    };
    const pause = () => {
      pausedUntil = performance.now() + 8000;
    };
    const resume = () => {
      lastFrame = 0;
      for (const state of positions.values())
        state.waitUntil = performance.now() + edgePause;
    };
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) return;
      if (lastFrame && now - lastFrame < 32) return;
      const seconds = lastFrame ? Math.min(now - lastFrame, 100) / 1000 : 0;
      lastFrame = now;
      for (const node of areas) {
        const maxY = Math.max(0, node.scrollHeight - node.clientHeight);
        const maxX = Math.max(0, node.scrollWidth - node.clientWidth);
        const both = node.dataset.scrollAxis === "both";
        const axis = both && maxY <= 1 && maxX > 1 ? "scrollLeft" : "scrollTop";
        let state = positions.get(node);
        if (!state || state.axis !== axis) {
          state = {
            axis,
            position: node[axis],
            waitUntil: now + edgePause,
            atEnd: false,
          };
          positions.set(node, state);
        }
        const max = axis === "scrollLeft" ? maxX : maxY;
        if (max <= 1) {
          state.position = 0;
          state.atEnd = false;
          state.waitUntil = now + edgePause;
          continue;
        }
        if (now < pausedUntil) {
          state.position = node[axis];
          state.atEnd = false;
          state.waitUntil = pausedUntil;
          continue;
        }
        const bounds = node.getBoundingClientRect();
        if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) continue;
        if (now < state.waitUntil) continue;
        if (state.atEnd) {
          node[axis] = 0;
          // Read every row before moving across to the next bracket rounds.
          // Overlapping pages keep the connecting lines in view.
          if (both && axis === "scrollTop" && maxX > 1) {
            node.scrollLeft =
              node.scrollLeft >= maxX - 1
                ? 0
                : Math.min(maxX, node.scrollLeft + node.clientWidth * 0.75);
          }
          state.position = 0;
          state.atEnd = false;
          state.waitUntil = now + edgePause;
          continue;
        }
        const speed = Number(node.dataset.scrollSpeed) || 18;
        state.position = Math.min(max, state.position + speed * seconds);
        node[axis] = state.position;
        if (state.position >= max) {
          state.atEnd = true;
          state.waitUntil = now + edgePause;
        }
      }
    };
    collect();
    const observer = new MutationObserver(collect);
    observer.observe(root, { childList: true, subtree: true });
    const interactions = [
      "pointerdown",
      "touchstart",
      "wheel",
      "keydown",
      "focusin",
    ];
    for (const event of interactions)
      root.addEventListener(event, pause, { passive: true });
    document.addEventListener("visibilitychange", resume);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const event of interactions) root.removeEventListener(event, pause);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [rootRef]);
}
