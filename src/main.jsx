import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import CloudGate from "./cloud/CloudGate.jsx";
import StartupLoading from "./components/StartupLoading.jsx";
import { initializeStartupSplash } from "./startup-splash.js";
import "./theme.css";
import "./styles/organizer.css";
import "./cloud/cloud.css";
import "./styles/desk.css";
const App = lazy(() => import("./App.jsx"));
const Maintainer = lazy(() => import("./cloud/Maintainer.jsx"));
initializeStartupSplash();
createRoot(document.getElementById("root")).render(__SHUTTLE_CLOUD__
  ? location.pathname.replace(/\/$/, "") === "/maintainer"
    ? <Suspense fallback={<StartupLoading/>}><Maintainer/></Suspense>
    : <CloudGate/>
  : <Suspense fallback={<StartupLoading/>}><App/></Suspense>);
