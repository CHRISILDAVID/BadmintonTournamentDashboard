import React, { useEffect, useRef, useState } from "react";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import { useStore } from "zustand";
import { Grip, Minus, SlidersHorizontal } from "lucide-react";
import { venueStore } from "../stores/venue.js";
import { selectionKey } from "../lib/venue-layout.js";
import { WIDGETS, WIDGET_BREAKPOINTS, WIDGET_COLUMNS, WIDGET_ROW, WIDGET_GAP, widgetBreakpoint, visibleWidgets, widgetLayout, cleanWidgetPreferences, keyboardWidgetLayout } from "../lib/venue-widgets.js";
import { Button } from "./ui/button.jsx";
import { NativeSelect } from "./ui/native-select.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog.jsx";

export default function VenueWidgets({ data, renderWidget, sharedLiveScores = false }) {
  const preferences = useStore(venueStore);
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const [height, setHeight] = useState(600), [settings, setSettings] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const active = useRef(null);
  const key = selectionKey(preferences.selection.ids), id = data.tournament.id;
  const saved = preferences.editing ? preferences.draft : preferences.savedLayouts[key];
  const widgets = cleanWidgetPreferences(saved?.widgets?.[id]);
  const visible = visibleWidgets(data, widgets).filter(widget => !sharedLiveScores || widget !== "live"), breakpoint = widgetBreakpoint(width);
  const layout = widgetLayout(widgets, visible, breakpoint, height);
  active.current = { layout, breakpoint };
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => setHeight(Math.max(0, node.clientHeight - 24));
    measure();
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);
  useEffect(() => { if (!preferences.editing) setSettings(false); }, [preferences.editing]);
  const keyboard = (event, widget) => {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault(); event.stopPropagation();
    const next = keyboardWidgetLayout(layout, widget, event.key, event.shiftKey, WIDGET_COLUMNS[breakpoint]);
    preferences.updateWidgetLayout(id, breakpoint, next);
    const item = next.find(item => item.i === widget);
    setAnnouncement(`${WIDGETS[widget]}: column ${item.x + 1}, row ${item.y + 1}, width ${item.w}, height ${item.h}.`);
  };
  return <>
    {preferences.editing && <div className="venue-widget-tools">
      <span>Drag to arrange · resize from the corner</span>
      <Button variant="outline" size="sm" aria-label={`Choose widgets for ${data.tournament.name}`} onClick={() => setSettings(true)}>
        <SlidersHorizontal/> Widgets
      </Button>
    </div>}
    <div className="venue-widget-canvas" ref={containerRef}>
      <span className="sr-only" role="status">{announcement}</span>
      {mounted && <ResponsiveGridLayout key={`${id}:${breakpoint}`} width={width} breakpoint={breakpoint}
        breakpoints={WIDGET_BREAKPOINTS} cols={WIDGET_COLUMNS} layouts={{ [breakpoint]: layout }}
        rowHeight={WIDGET_ROW} margin={[WIDGET_GAP, WIDGET_GAP]} containerPadding={[0, 0]}
        dragConfig={{ enabled: preferences.editing, handle: ".venue-widget-grip" }}
        resizeConfig={{ enabled: preferences.editing, handles: ["se"] }}
        onDragStop={next => preferences.updateWidgetLayout(id, active.current.breakpoint, next)}
        onResizeStop={next => preferences.updateWidgetLayout(id, active.current.breakpoint, next)}>
        {visible.map(widget => <section key={widget} data-widget={widget} className={`venue-widget ${preferences.editing ? "is-editing" : ""}`}
          aria-label={`${data.tournament.name} ${WIDGETS[widget]} widget`}>
          <header className="venue-widget-heading">
            {preferences.editing && <Button variant="ghost" size="icon-sm" className="venue-widget-grip"
              aria-label={`Move or resize ${WIDGETS[widget]}`} aria-describedby="widget-keyboard-help"
              title="Arrow keys: move. Shift + arrow keys: resize." onKeyDown={event => keyboard(event, widget)}><Grip/></Button>}
            <h3>{WIDGETS[widget]}</h3>
            {preferences.editing && <Button variant="secondary" size="icon-xs" aria-label={`Hide ${WIDGETS[widget]}`}
              onClick={() => { preferences.setWidgetVisibility(id, widget, "hide"); setAnnouncement(`${WIDGETS[widget]} hidden. Restore it with Widgets.`); }}><Minus/></Button>}
          </header>
          <div className="venue-widget-content">{renderWidget(widget)}</div>
        </section>)}
      </ResponsiveGridLayout>}
      {!visible.length && <div className="vb-empty">All widgets are hidden.{preferences.editing ? " Choose Widgets to add one." : " Use the pencil to choose widgets."}</div>}
    </div>
    <Dialog open={settings} onOpenChange={setSettings}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Widgets · {data.tournament.name}</DialogTitle>
          <DialogDescription>Automatic follows the tournament stage. Always show keeps a widget visible at every stage, including after the final.</DialogDescription>
        </DialogHeader>
        {Object.entries(WIDGETS).map(([widget, label]) => <label className="flex items-center justify-between gap-4" key={widget}>
          <span>{label}{widget === "live" && sharedLiveScores && <small className="block text-muted-foreground">Displayed above tournaments</small>}</span><NativeSelect className="w-40" aria-label={`${label} visibility`} value={widgets.visibility[widget]} disabled={widget === "live" && sharedLiveScores}
            onChange={event => preferences.setWidgetVisibility(id, widget, event.target.value)}>
            <option value="auto">Automatic</option><option value="show">Always show</option><option value="hide">Hide</option>
          </NativeSelect>
        </label>)}
        <p className="text-sm text-muted-foreground">Changes stay in your draft until you save the layout.</p>
        <Button onClick={() => setSettings(false)}>Done</Button>
      </DialogContent>
    </Dialog>
  </>;
}
