import React from "react";
import { useStore } from "zustand";
import { organizerStore } from "../stores/organizer.js";
import { routeHref } from "../lib/navigation.js";

// Real links support copying/opening in another tab; ordinary clicks stay in-app.
export default function PageLink({ page, children, ...props }) {
  const state = useStore(organizerStore);
  return <a {...props} href={routeHref({ ...state, page })} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); state.setPage(page);
  }}>{children}</a>;
}
