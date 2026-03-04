import React from "react";
import { AppStateProvider } from "./AppState";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AppStateProvider>{children}</AppStateProvider>;
}

