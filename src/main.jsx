import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import CloudGate from "./cloud/CloudGate.jsx";
import "./theme.css";
import "./styles/organizer.css";
import "./cloud/cloud.css";
import "./styles/desk.css";
const App = lazy(() => import("./App.jsx"));
const Maintainer = lazy(() => import("./cloud/Maintainer.jsx"));
createRoot(document.getElementById("root")).render(__SHUTTLE_CLOUD__
  ? location.pathname.replace(/\/$/, "") === "/maintainer"
    ? <Suspense fallback={<p>Opening maintainer tools…</p>}><Maintainer/></Suspense>
    : <CloudGate/>
  : <Suspense fallback={<p>Loading…</p>}><App/></Suspense>);
