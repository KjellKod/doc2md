// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DesktopApp from "./DesktopApp";
import "../styles/global.css";
import "./desktop.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    <DesktopApp />
  </StrictMode>,
);
