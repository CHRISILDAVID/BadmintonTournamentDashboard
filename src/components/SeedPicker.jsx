import React, { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { NativeSelect } from "./ui/native-select.jsx";

function SeedTeamSelect({ rank, current, available, select }) {
  const id = useId();
  const activeOption = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const query = search.trim().toLowerCase();
  const matches = available.filter(entry => entry.name.toLowerCase().includes(query));
  const index = Math.min(active, matches.length - 1);
  const listId = `${id}-teams`;
  const optionId = index >= 0 ? `${listId}-${index}` : undefined;
  useEffect(() => {
    if (open) activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [open, optionId]);
  const show = () => {
    setSearch("");
    setActive(0);
    setOpen(true);
  };
  const pick = entry => {
    select(entry.id);
    setOpen(false);
  };
  return <div className="field min-w-0">
    <label htmlFor={id}>Seed {rank}</label>
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true"/>
      <Input id={id} role="combobox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId : undefined} aria-autocomplete="list"
        autoComplete="off" className="pl-8" placeholder={open && current ? current.name : "Search by player name"}
        value={open ? search : current?.name ?? ""}
        onFocus={show} onClick={() => { if (!open) show(); }}
        onBlur={() => setOpen(false)}
        onChange={event => { setSearch(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (open && index >= 0) pick(matches[index]);
            else if (!open) show();
          } else if (["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            if (!open) show();
            else if (matches.length) setActive(Math.max(0, Math.min(index + (event.key === "ArrowDown" ? 1 : -1), matches.length - 1)));
          }
        }}/>
    </div>
    {open && <>
      <ul id={listId} role="listbox" aria-label={`Teams for seed ${rank}`}
        className="m-0 max-h-44 list-none overflow-y-auto rounded-md border border-input bg-background p-1">
        {matches.map((entry, i) => <li key={entry.id} id={`${listId}-${i}`} role="option" aria-selected={i === index}
          ref={i === index ? activeOption : null} className={`cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-muted ${i === index ? "bg-muted" : ""}`}
          onMouseDown={event => event.preventDefault()} onClick={() => pick(entry)}>{entry.name}</li>)}
      </ul>
      {!matches.length && <p className="help-text" role="status">No available teams match this search.</p>}
    </>}
  </div>;
}

export default function SeedPicker({ entries, order, change, offset = 0 }) {
  const selected = new Set(order);
  const unseeded = entries.filter(entry => !selected.has(entry.id));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const move = (index, direction) => {
    const next = [...order], target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
  };
  return <fieldset className="stage-scoring">
    <legend>Confirm seeding</legend>
    <label className="field">
      <span>Number of teams to seed</span>
      <NativeSelect value={order.length} onChange={e => change(Array.from({ length: +e.target.value }, (_, i) => order[i] ?? ""))}>
        <option value="0">No seeds</option>
        {entries.map((_, i) => <option value={i + 1} key={i}>{i + 1}</option>)}
      </NativeSelect>
    </label>
    {order.map((id, index) => {
      const rank = offset + index + 1;
      const current = byId.get(id);
      return <div className="form-row" key={index}>
        <SeedTeamSelect rank={rank} current={current} available={current ? [current, ...unseeded] : unseeded}
          select={teamId => change(order.map((value, i) => i === index ? teamId : value))}/>
        <div className="match-action-buttons">
          <Button type="button" variant="outline" size="sm" disabled={index === 0} aria-label={`Move seed ${rank} up`} onClick={() => move(index, -1)}>Up</Button>
          <Button type="button" variant="outline" size="sm" disabled={index === order.length - 1} aria-label={`Move seed ${rank} down`} onClick={() => move(index, 1)}>Down</Button>
          <Button type="button" variant="ghost" size="sm" aria-label={`Remove seed ${rank}`} onClick={() => change(order.filter((_, i) => i !== index))}>Remove</Button>
        </div>
      </div>;
    })}
  </fieldset>;
}
