import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import { useStore } from "zustand";
import { Grip, ArrowUp, ArrowDown, Pencil, Check, RotateCcw, X } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { NativeSelect } from "./ui/native-select.jsx";
import { cleanLiveScoreLayout } from "../lib/venue-widgets.js";
import { venueStore } from "../stores/venue.js";
import { BREAKPOINTS, COLUMNS, ROW_HEIGHT, GAP, breakpointFor, defaultLayouts, resolveLayouts, normalizeLayout, reorderPanel, selectionKey } from "../lib/venue-layout.js";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

function PanelSizeControl({ label, name, value, min, max, onChange }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const valid = text => text !== "" && Number.isInteger(Number(text)) && Number(text) >= min && Number(text) <= max;
  return <label className="flex items-center gap-1 text-xs">{label}<Input className="h-8 w-16" type="number"
    min={min} max={max} value={draft} aria-label={name}
    onChange={event => {
      const text = event.target.value;
      setDraft(text);
      if (valid(text)) onChange(Number(text));
    }}
    onBlur={() => { if (!valid(draft)) setDraft(String(value)); }}
    onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}/></label>;
}

export default function VenueGrid({ panels, renderPanel, controls }) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const preferences = useStore(venueStore);
  const ids = useMemo(() => panels.map(p => p.tournament.id), [panels]);
  const key = selectionKey(ids);
  const [height, setHeight] = useState(600);
  const breakpoint = breakpointFor(width);
  useEffect(() => {
    const measure = () => {
      const top = containerRef.current?.getBoundingClientRect().top || 140;
      setHeight(Math.max(400, window.innerHeight - top - 24));
    };
    measure(); window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    document.addEventListener("fullscreenchange", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); document.removeEventListener("fullscreenchange", measure); };
  }, [containerRef, panels.length]);
  const defaults = useMemo(() => defaultLayouts(ids, height), [ids, height]);
  const saved = useMemo(() => ({ ...resolveLayouts(preferences.savedLayouts[key], defaults), widgets: preferences.savedLayouts[key]?.widgets || {}, liveScores: cleanLiveScoreLayout(preferences.savedLayouts[key]?.liveScores) }), [preferences.savedLayouts, key, defaults]);
  const liveScores = cleanLiveScoreLayout(preferences.editing ? preferences.draft?.liveScores : saved.liveScores);
  const layouts = preferences.editing && preferences.editingKey === key ? resolveLayouts(preferences.draft, defaults) : saved;
  useEffect(() => {
    if (preferences.editing && preferences.editingKey !== key) preferences.cancel();
  }, [key, preferences.editing, preferences.editingKey, preferences.cancel]);
  const updateSize = (id, dimension, value) => {
    const changed = layouts[breakpoint].map(item => item.i === id ? { ...item, [dimension]: Number(value) } : item);
    preferences.updateDraft(breakpoint, normalizeLayout(changed, defaults[breakpoint], COLUMNS[breakpoint]));
  };
  return <section className="venue-layout-area" aria-label="Venue screen layout">
    {controls && createPortal(<>
        {preferences.editing ? <>
          <Button variant="ghost" size="icon" title="Reset layout" aria-label="Reset layout" onClick={() => preferences.reset(defaults)}><RotateCcw/></Button>
          <Button variant="ghost" size="icon" title="Cancel layout changes" aria-label="Cancel layout changes" onClick={preferences.cancel}><X/></Button>
          <Button size="sm" onClick={preferences.save}><Check/> Save layout</Button>
        </> : <Button variant="ghost" size="icon" title="Edit layout" aria-label="Edit layout" disabled={!panels.length} onClick={() => preferences.begin(key, saved)}><Pencil/></Button>}
    </>, controls)}
    <p id="widget-keyboard-help" className="sr-only">Use arrow keys on a widget grip to move it. Hold Shift with arrow keys to resize it. Use Widgets to restore a hidden widget.</p>
    {preferences.editing && <div className="venue-live-settings">
      <label>Live scores<NativeSelect aria-label="Live scores position" value={liveScores.position} onChange={event => preferences.setLiveScoreLayout({ position: event.target.value })}>
        <option value="tournament">Inside tournaments</option><option value="top">Above tournaments · all matches</option>
      </NativeSelect></label>
      {liveScores.position === "top" && <label>Cards<NativeSelect aria-label="Shared live scores layout" value={liveScores.flow} onChange={event => preferences.setLiveScoreLayout({ flow: event.target.value })}>
        <option value="horizontal">Horizontal scroll</option><option value="wrap">Wrap cards</option>
      </NativeSelect></label>}
    </div>}
    {preferences.storageError && <p className="rounded-lg bg-red-50 p-3 text-sm text-destructive" role="alert">{preferences.storageError}</p>}
    <div ref={containerRef} className="venue-grid-viewport vb-scroll">
      {mounted && <ResponsiveGridLayout key={`${key}:${breakpoint}`} width={width} breakpoint={breakpoint} breakpoints={BREAKPOINTS} cols={COLUMNS}
        layouts={layouts} rowHeight={ROW_HEIGHT} margin={[GAP, GAP]} containerPadding={[0, 0]}
        dragConfig={{ enabled: preferences.editing, handle: ".venue-drag-handle", cancel: "button,input,select,.venue-widget-canvas" }}
        resizeConfig={{ enabled: preferences.editing, handles: ["se"] }}
        onDragStop={layout => preferences.updateDraft(breakpoint, normalizeLayout(layout, defaults[breakpoint], COLUMNS[breakpoint]))}
        onResizeStop={layout => preferences.updateDraft(breakpoint, normalizeLayout(layout, defaults[breakpoint], COLUMNS[breakpoint]))}>
        {panels.map(data => {
          const id = data.tournament.id, item = layouts[breakpoint].find(item => item.i === id);
          return <div key={id} className={`venue-grid-panel ${preferences.editing ? "is-editing" : ""}`}>
            {preferences.editing && <div className="venue-panel-editor">
              <div className="venue-drag-handle"><Grip size={18}/><span className="truncate">{data.tournament.name}</span></div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="icon-sm" aria-label={`Move ${data.tournament.name} earlier`} onClick={() => preferences.updateDraft(breakpoint, reorderPanel(layouts[breakpoint], id, -1, COLUMNS[breakpoint]))}><ArrowUp/></Button>
                <Button variant="outline" size="icon-sm" aria-label={`Move ${data.tournament.name} later`} onClick={() => preferences.updateDraft(breakpoint, reorderPanel(layouts[breakpoint], id, 1, COLUMNS[breakpoint]))}><ArrowDown/></Button>
                <PanelSizeControl label="Width" name={`${data.tournament.name} panel width`} value={item.w} min={item.minW} max={COLUMNS[breakpoint]} onChange={value => updateSize(id, "w", value)}/>
                <PanelSizeControl label="Height" name={`${data.tournament.name} panel height`} value={item.h} min={item.minH} max={80} onChange={value => updateSize(id, "h", value)}/>
              </div>
            </div>}
            {renderPanel(data)}
          </div>;
        })}
      </ResponsiveGridLayout>}
      {!panels.length && <div className="empty"><h2>Ready for your first tournament</h2><p>Standings, results, and upcoming games will appear once a tournament is created.</p></div>}
    </div>
  </section>;
}
