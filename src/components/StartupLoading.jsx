import React from "react";

// The persistent HTML splash stays visible while any startup stage renders
// this marker. A separate video here would restart at each lazy-load handoff.
export default function StartupLoading() {
  return <div data-startup-loading="" role="status" aria-label="Loading ShuttleHub"/>;
}
