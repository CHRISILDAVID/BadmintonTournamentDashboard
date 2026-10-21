import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import CloudGate from "./cloud/CloudGate.jsx";
import "./theme.css";
import "./styles/organizer.css";
import "./cloud/cloud.css";
const App = lazy(() => import("./App.jsx"));
createRoot(document.getElementById("root")).render(__SHUTTLE_CLOUD__ ? <CloudGate/> : <Suspense fallback={<p>Loading…</p>}><App/></Suspense>);
