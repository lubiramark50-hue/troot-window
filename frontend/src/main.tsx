import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import "./mobile-polish.css";
import "./desktop-polish.css";
import { startAutomaticUpdates } from "./update-manager";

startAutomaticUpdates();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </React.StrictMode>,
);
