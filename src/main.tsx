import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AppProviders } from "./state/AppProviders";
import { router } from "./router";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <div className="min-h-full bg-bg text-fg font-sans">
        <RouterProvider router={router} />
      </div>
    </AppProviders>
  </React.StrictMode>,
);
