import React, { useRef, useState } from "react";
import { LayoutDashboard, CalendarDays, GitBranch, Trophy, Users, Settings, Monitor, Menu, MoreHorizontal, History } from "lucide-react";
import { Logo } from "./common.jsx";
import PageLink from "./PageLink.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog.jsx";
import { Button } from "./ui/button.jsx";

const matchDay = [["Overview", LayoutDashboard], ["Matches", CalendarDays], ["Standings", GitBranch]];
const setup = [["Tournaments", Trophy], ["Teams & players", Users], ["Settings", Settings]];
const officiating = [["Matches", CalendarDays], ["History", History], ["Standings", GitBranch]];

export default function DeskNavigation({ page, event, umpire = false }) {
  const [menu, setMenu] = useState(false);
  const menuTrigger = useRef(null), menuPage = useRef(page);
  const openMenu = event => { menuTrigger.current = event.currentTarget; menuPage.current = page; setMenu(true); };
  const active = destination => page === destination || (!umpire && destination === "Matches" && page === "History");
  const links = items => items.map(([destination, Icon]) => <PageLink key={destination} page={destination}
    className={active(destination) ? "desk-nav-link active" : "desk-nav-link"}
    aria-label={umpire && destination === "Standings" ? "Standings & brackets" : undefined}
    aria-current={active(destination) ? "page" : undefined} onNavigate={() => setMenu(false)}>
    <Icon size={20} aria-hidden="true"/><span>{umpire && destination === "History" ? "Match history" : destination}</span>
  </PageLink>);
  const display = <a className="desk-nav-link" href="/display" target="_blank" rel="noreferrer"><Monitor size={20} aria-hidden="true"/><span>Venue display <small>↗</small></span></a>;
  return <>
    {!umpire && <aside className="desk-sidebar">
      <div className="desk-brand"><Logo small/><div><strong>ShuttleHub</strong><small>Tournament desk</small></div></div>
      <div className="desk-event"><Trophy size={18} aria-hidden="true"/><strong>{event.name}</strong></div>
      <nav aria-label="Main navigation"><span className="desk-nav-label">Match day</span>{links(matchDay)}<span className="desk-nav-label">Tournament setup</span>{links(setup.slice(0, 2))}</nav>
      <nav className="desk-utilities" aria-label="Utilities">{links(setup.slice(2))}{display}</nav>
    </aside>}
    {!umpire && <Button variant="outline" className="desk-menu-trigger" onClick={openMenu} aria-label="Open navigation"><Menu size={20}/><span>Menu</span></Button>}
    <nav className={`desk-bottom-nav ${umpire ? "umpire-navigation" : ""}`} aria-label={umpire ? "Umpire navigation" : "Mobile navigation"}>
      {links(umpire ? officiating : matchDay)}
      {!umpire && <button type="button" className={`desk-nav-link ${setup.some(([p]) => p === page) ? "active" : ""}`} aria-expanded={menu} aria-label="More navigation" onClick={openMenu}><MoreHorizontal size={20}/><span>More</span></button>}
    </nav>
    <Dialog open={menu} onOpenChange={setMenu}><DialogContent className="desk-navigation-dialog" onCloseAutoFocus={event => { event.preventDefault(); if (menuPage.current === page) menuTrigger.current?.focus(); }}>
      <DialogHeader><DialogTitle>Navigate your event</DialogTitle><DialogDescription>{event.name}</DialogDescription></DialogHeader>
      <nav aria-label="All destinations">{links(matchDay)}<span className="desk-nav-label">Tournament setup</span>{links(setup)}{display}</nav>
    </DialogContent></Dialog>
  </>;
}
