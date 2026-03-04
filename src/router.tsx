import { createBrowserRouter } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { AppShell } from "./ui/AppShell";
import { ProjectPage } from "./ui/pages/ProjectPage";
import { ShotPage } from "./ui/pages/ShotPage";
import { SettingsPage } from "./ui/pages/SettingsPage";
import { WorkflowManagerPage } from "./ui/pages/WorkflowManagerPage";
import { PromptLibraryPage } from "./ui/pages/PromptLibraryPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/prompts" replace /> },
      { path: "project", element: <ProjectPage /> },
      { path: "project/shot", element: <ShotPage /> },
      { path: "prompts", element: <PromptLibraryPage /> },
      { path: "workflows", element: <WorkflowManagerPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
