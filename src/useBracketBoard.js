import { useLayoutEffect, useRef, useState } from "react";
import { fitBracket, zoomBracket } from "./lib/bracket-view.js";

export default function useBracketBoard({ canvas, space, drawKey, rounds, teams }) {
  const view = useRef({ x: 0, y: 0, scale: 1 });
  const geometry = useRef(null);
  const autoFit = useRef(true);
  const pointers = useRef(new Map());
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const paint = (next) => {
    view.current = next;
    if (canvas.current) canvas.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`;
    setScale(next.scale);
  };
  const fit = () => {
    const g = geometry.current;
    if (!g) return;
    autoFit.current = true;
    paint(fitBracket(g.width, g.height, g.vw, g.vh));
  };
  const zoom = (requested, point) => {
    const g = geometry.current;
    if (!g) return;
    const fitted = fitBracket(g.width, g.height, g.vw, g.vh);
    const next = Math.max(Math.min(0.05, fitted.scale / 2), Math.min(4, requested));
    autoFit.current = false;
    paint(zoomBracket(view.current, next, point || { x: g.vw / 2, y: g.vh / 2 }));
  };
  const actualSize = () => {
    const frame = space.current, g = geometry.current;
    if (!frame || !g) return;
    const rect = frame.getBoundingClientRect();
    const centre = { x: rect.left + frame.clientLeft + g.vw / 2, y: rect.top + frame.clientTop + g.vh / 2 };
    // A tall draw has large gaps between later rounds. Open actual size on a
    // nearby match rather than magnifying an empty patch of the board.
    let closest = null, distance = Infinity;
    for (const card of canvas.current.querySelectorAll(".vb-ko-card")) {
      const bounds = card.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
      const candidate = Math.hypot(x - centre.x, y - centre.y);
      if (candidate < distance) { closest = { x, y }; distance = candidate; }
    }
    if (!closest) return;
    const x = (closest.x - rect.left - frame.clientLeft - view.current.x) / view.current.scale;
    const y = (closest.y - rect.top - frame.clientTop - view.current.y) / view.current.scale;
    autoFit.current = false;
    paint({ x: g.vw / 2 - x, y: g.vh / 2 - y, scale: 1 });
  };

  useLayoutEffect(() => {
    autoFit.current = true;
    geometry.current = null;
    pointers.current.clear();
    setDragging(false);
  }, [drawKey]);

  useLayoutEffect(() => {
    const element = canvas.current, frame = space.current;
    if (!element || !frame) return;
    const cards = [...element.querySelectorAll(".vb-ko-card")];
    const measure = () => {
      const width = rounds.length * 310 + Math.max(0, rounds.length - 1) * 26;
      element.style.width = `${width}px`;
      const row = Math.max(118, ...cards.map(card => card.offsetHeight + 20));
      element.style.setProperty("--vb-bracket-row", `${row}px`);
      const vw = frame.clientWidth, vh = frame.clientHeight;
      if (!vw || !vh) return;
      const previous = geometry.current;
      geometry.current = { width, height: element.offsetHeight, vw, vh };
      if (autoFit.current || !previous) fit();
      else if (previous.vw !== vw || previous.vh !== vh) {
        // Keep the same bracket point at the centre when the widget is resized.
        paint({ ...view.current, x: view.current.x + (vw - previous.vw) / 2, y: view.current.y + (vh - previous.vh) / 2 });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(element);
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [drawKey, rounds, teams]);

  useLayoutEffect(() => {
    const frame = space.current;
    if (!frame) return;
    const wheel = event => {
      event.preventDefault();
      event.stopPropagation();
      const rect = frame.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? frame.clientHeight : 1);
      zoom(view.current.scale * Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.005), { x: event.clientX - rect.left - frame.clientLeft, y: event.clientY - rect.top - frame.clientTop });
    };
    frame.addEventListener("wheel", wheel, { passive: false });
    return () => frame.removeEventListener("wheel", wheel);
  }, []);

  const point = event => {
    const rect = space.current.getBoundingClientRect();
    return { x: event.clientX - rect.left - space.current.clientLeft, y: event.clientY - rect.top - space.current.clientTop };
  };
  const endPointer = event => {
    pointers.current.delete(event.pointerId);
    setDragging(pointers.current.size > 0);
  };
  const boardProps = {
    onPointerDown: event => {
      if (event.button !== 0 && event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      space.current.focus({ preventScroll: true });
      space.current.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, point(event));
      setDragging(true);
    },
    onPointerMove: event => {
      if (!pointers.current.has(event.pointerId)) return;
      event.stopPropagation();
      const before = [...pointers.current.values()];
      const last = pointers.current.get(event.pointerId), next = point(event);
      pointers.current.set(event.pointerId, next);
      autoFit.current = false;
      if (pointers.current.size === 2) {
        const after = [...pointers.current.values()];
        const centre = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
        const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const a = centre(before), b = centre(after);
        zoom(view.current.scale * distance(after) / Math.max(1, distance(before)), a);
        paint({ ...view.current, x: view.current.x + b.x - a.x, y: view.current.y + b.y - a.y });
      } else {
        paint({ ...view.current, x: view.current.x + next.x - last.x, y: view.current.y + next.y - last.y });
      }
    },
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    onLostPointerCapture: endPointer,
    onDoubleClick: event => zoom(view.current.scale * 1.5, point(event)),
    onKeyDown: event => {
      const movement = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[event.key];
      if (movement) {
        autoFit.current = false;
        paint({ ...view.current, x: view.current.x + movement[0], y: view.current.y + movement[1] });
      } else if (["+", "="].includes(event.key)) zoom(view.current.scale * 1.25);
      else if (event.key === "-") zoom(view.current.scale / 1.25);
      else if (event.key === "0" || event.key === "Home") fit();
      else return;
      event.preventDefault();
      event.stopPropagation();
    },
  };
  return { scale, dragging, fit, zoomIn: () => zoom(view.current.scale * 1.25), zoomOut: () => zoom(view.current.scale / 1.25), actualSize, boardProps };
}
