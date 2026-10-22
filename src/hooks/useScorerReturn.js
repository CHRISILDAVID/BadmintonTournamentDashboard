import { useEffect, useLayoutEffect, useRef } from "react";

// The scorer deliberately keeps its existing URL. Restore the list's position
// and trigger after its replacement DOM has mounted, including filtered lists.
export default function useScorerReturn(open) {
  const saved = useRef({ y: 0, label: null });
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) return;
    const remember = () => { saved.current = { y: window.scrollY, label: document.activeElement?.getAttribute("aria-label") }; };
    document.addEventListener("focusin", remember);
    window.addEventListener("scroll", remember, { passive: true });
    return () => { document.removeEventListener("focusin", remember); window.removeEventListener("scroll", remember); };
  }, [open]);
  useLayoutEffect(() => {
    const returning = wasOpen.current && !open;
    wasOpen.current = open;
    if (returning) {
      const { y, label } = saved.current;
      const frame = requestAnimationFrame(() => {
        const trigger = label && [...document.querySelectorAll("button[aria-label]")].find(el => el.getAttribute("aria-label") === label && el.checkVisibility());
        (trigger || document.querySelector("h1"))?.focus({ preventScroll: true });
        window.scrollTo(0, y);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);
}
