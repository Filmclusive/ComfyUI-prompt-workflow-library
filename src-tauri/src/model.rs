use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type IsoDateTime = DateTime<Utc>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub scene_ids: Vec<Uuid>,
    pub created_at: IsoDateTime,
    pub updated_at: IsoDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    pub id: Uuid,
    pub project_id: Uuid,
    pub number: u32,
    pub title: String,
    pub notes: String,
    pub tags: Vec<String>,
    pub shot_ids: Vec<Uuid>,
    pub created_at: IsoDateTime,
    pub updated_at: IsoDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShotParams {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub seed: Option<i64>,
    pub steps: Option<u32>,
    pub cfg: Option<f64>,
    pub sampler: Option<String>,
    pub model_name: Option<String>,
}

impl Default for ShotParams {
    fn default() -> Self {
        Self {
            width: None,
            height: None,
            seed: None,
            steps: None,
            cfg: None,
            sampler: None,
            model_name: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttachmentRole {
    FirstFrame,
    LastFrame,
    Reference,
    Result,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttachmentKind {
    Image,
    Video,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: Uuid,
    pub role: AttachmentRole,
    pub kind: AttachmentKind,
    pub file_name: String,
    pub rel_path: String,
    pub added_at: IsoDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRef {
    pub scope: WorkflowScope,
    pub workflow_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Shot {
    pub id: Uuid,
    pub scene_id: Uuid,
    pub number: u32,
    pub title: String,
    pub status: ShotStatus,
    pub notes: String,
    pub tags: Vec<String>,
    pub params: ShotParams,
    pub attachments: Vec<Attachment>,
    pub workflow_ref: Option<WorkflowRef>,
    pub created_at: IsoDateTime,
    pub updated_at: IsoDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum ShotStatus {
    Todo,
    InProgress,
    Approved,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PromptScope {
    Global,
    Project,
    Scene,
    Shot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PromptEntryKind {
    PositiveSnippet,
    NegativeSnippet,
    Both,
    NoteTemplate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PromptEntryFormat {
    Simple,
    #[serde(alias = "dual")]
    Advanced,
}

impl Default for PromptEntryFormat {
    fn default() -> Self {
        Self::Simple
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PromptParams {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub seed: Option<u64>,
    pub steps: Option<u32>,
    pub cfg: Option<f32>,
    pub sampler: Option<String>,
    pub model_name: Option<String>,
    pub vae: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptEntry {
    pub id: Uuid,
    pub scope: PromptScope,
    pub parent_id: Option<Uuid>,
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub format: PromptEntryFormat,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub positive: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub negative: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub params: Option<PromptParams>,
    pub tags: Vec<String>,
    pub kind: PromptEntryKind,
    pub created_at: IsoDateTime,
    pub updated_at: IsoDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowScope {
    Global,
    Project,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowMeta {
    pub variables: Vec<String>,
    pub notes: String,
    pub tags: Vec<String>,
    #[serde(default)]
    pub models: Vec<String>,
    pub updated_at: IsoDateTime,
    pub created_at: IsoDateTime,
}

impl Default for WorkflowMeta {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            variables: vec![
                "positive".to_string(),
                "negative".to_string(),
                "seed".to_string(),
                "steps".to_string(),
                "cfg".to_string(),
                "width".to_string(),
                "height".to_string(),
            ],
            notes: String::new(),
            tags: Vec::new(),
            models: Vec::new(),
            updated_at: now,
            created_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowSummary {
    pub id: Uuid,
    pub scope: WorkflowScope,
    pub title: String,
    pub tags: Vec<String>,
    pub updated_at: IsoDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub recent_projects: Vec<String>,
    #[serde(default)]
    pub theme: ThemeSetting,
    pub comfyui: ComfyUiSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ThemeSetting {
    System,
    Light,
    Dark,
}

impl Default for ThemeSetting {
    fn default() -> Self {
        Self::System
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyUiSettings {
    #[serde(default)]
    pub app_path: Option<String>,
    pub command: String,
    pub working_dir: Option<String>,
    pub url: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            recent_projects: Vec::new(),
            theme: ThemeSetting::System,
            comfyui: ComfyUiSettings {
                app_path: None,
                command: "python main.py --listen".to_string(),
                working_dir: None,
                url: "http://127.0.0.1:8188".to_string(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionMeta {
    pub id: Uuid,
    pub created_at: IsoDateTime,
    pub message: Option<String>,
}
