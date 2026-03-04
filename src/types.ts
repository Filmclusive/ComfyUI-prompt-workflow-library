export type IsoDateTime = string;

export type ThemeSetting = "system" | "light" | "dark";

export type AttachmentRole =
  | "first_frame"
  | "last_frame"
  | "reference"
  | "result"
  | "other";

export type AttachmentKind = "image" | "video" | "other";

export type Attachment = {
  id: string;
  role: AttachmentRole;
  kind: AttachmentKind;
  fileName: string;
  relPath: string;
  addedAt: IsoDateTime;
};

export type ShotStatus = "Todo" | "InProgress" | "Approved";

export type ShotParams = {
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  modelName?: string;
};

export type Shot = {
  id: string;
  sceneId: string;
  number: number;
  title: string;
  status: ShotStatus;
  notes: string;
  tags: string[];
  params: ShotParams;
  attachments: Attachment[];
  workflowRef?: { scope: "global" | "project"; workflowId: string } | null;
  updatedAt: IsoDateTime;
  createdAt: IsoDateTime;
};

export type Scene = {
  id: string;
  projectId: string;
  number: number;
  title: string;
  notes: string;
  tags: string[];
  shotIds: string[];
  updatedAt: IsoDateTime;
  createdAt: IsoDateTime;
  dirName: string;
};

export type Project = {
  id: string;
  name: string;
  sceneIds: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type AppSettings = {
  recentProjects: string[];
  theme: ThemeSetting;
  comfyui: {
    command: string;
    workingDir: string | null;
    url: string;
  };
};

export type PromptScope = "global" | "project" | "scene" | "shot";

export type PromptEntryKind =
  | "positiveSnippet"
  | "negativeSnippet"
  | "both"
  | "noteTemplate";

export type PromptEntry = {
  id: string;
  scope: PromptScope;
  parentId: string | null;
  title: string;
  body: string;
  tags: string[];
  kind: PromptEntryKind;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type WorkflowSummary = {
  id: string;
  scope: "global" | "project";
  title: string;
  tags: string[];
  updatedAt: IsoDateTime;
};
