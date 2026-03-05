use std::{
  collections::BTreeMap,
  path::PathBuf,
};

use chrono::Utc;
use uuid::Uuid;

use crate::{
  error::{AppError, AppResult},
  model::{WorkflowMeta, WorkflowScope, WorkflowSummary},
  paths::{
    ensure_dir, workflow_dir, workflow_json_path, workflow_meta_path, workflow_variants_root,
    workflows_dir_for_project,
  },
  storage::{copy_file_atomic, read_json, read_text, write_json_pretty_atomic},
  workflow_injection::apply_placeholders,
};

fn workflows_root_dir(app: Option<&tauri::AppHandle>, scope: &WorkflowScope, project_dir: Option<&str>) -> AppResult<PathBuf> {
  match scope {
    WorkflowScope::Global => {
      let app = app.ok_or_else(|| AppError::InvalidInput("App handle required for global workflows".to_string()))?;
      let dir = app
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| AppError::InvalidInput("App data dir not available".to_string()))?
        .join("workflows")
        .join("global");
      Ok(dir)
    }
    WorkflowScope::Project => {
      let project_dir = project_dir.ok_or_else(|| AppError::InvalidInput("projectDir is required for project workflows".to_string()))?;
      Ok(workflows_dir_for_project(&PathBuf::from(project_dir)))
    }
  }
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_workflows(app: tauri::AppHandle, scope: WorkflowScope, project_dir: Option<String>) -> Result<Vec<WorkflowSummary>, String> {
  list_workflows_impl(Some(&app), scope, project_dir.as_deref()).map_err(|e| e.to_string())
}

fn list_workflows_impl(app: Option<&tauri::AppHandle>, scope: WorkflowScope, project_dir: Option<&str>) -> AppResult<Vec<WorkflowSummary>> {
  let root = workflows_root_dir(app, &scope, project_dir)?;
  if !root.exists() {
    return Ok(Vec::new());
  }
  let mut out = Vec::new();
  for entry in std::fs::read_dir(&root)? {
    let entry = entry?;
    if !entry.file_type()?.is_dir() {
      continue;
    }
    let dir = entry.path();
    let meta_path = workflow_meta_path(&dir);
    if !meta_path.exists() {
      continue;
    }
    let meta: WorkflowMeta = read_json(&meta_path)?;
    let id = parse_workflow_id(&entry.file_name().to_string_lossy())?;
    let title_path = dir.join("title.txt");
    let title = if title_path.exists() {
      read_text(&title_path)?
    } else {
      format!("Workflow {}", id)
    };
    out.push(WorkflowSummary {
      id,
      scope: scope.clone(),
      title: title.trim().to_string(),
      tags: meta.tags,
      updated_at: meta.updated_at,
    });
  }
  out.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
  Ok(out)
}

fn parse_workflow_id(dir_name: &str) -> AppResult<Uuid> {
  let prefix = "workflow_";
  if !dir_name.starts_with(prefix) {
    return Err(AppError::InvalidInput(format!("Invalid workflow dir: {dir_name}")));
  }
  let id = &dir_name[prefix.len()..];
  Ok(Uuid::parse_str(id).map_err(|_| AppError::InvalidInput("Invalid workflow id".to_string()))?)
}

#[tauri::command(rename_all = "snake_case")]
pub fn import_workflow(
  app: tauri::AppHandle,
  scope: WorkflowScope,
  project_dir: Option<String>,
  title: String,
  workflow_json_path: String,
) -> Result<(), String> {
  import_workflow_impl(Some(&app), scope, project_dir.as_deref(), &title, &workflow_json_path).map_err(|e| e.to_string())
}

fn import_workflow_impl(
  app: Option<&tauri::AppHandle>,
  scope: WorkflowScope,
  project_dir: Option<&str>,
  title: &str,
  workflow_json_src: &str,
) -> AppResult<()> {
  if title.trim().is_empty() {
    return Err(AppError::InvalidInput("Title is required".to_string()));
  }
  let root = workflows_root_dir(app, &scope, project_dir)?;
  ensure_dir(&root)?;
  let id = Uuid::new_v4();
  let wdir = workflow_dir(&root, id);
  ensure_dir(&wdir)?;

  copy_file_atomic(&PathBuf::from(workflow_json_src), &workflow_json_path(&wdir))?;
  write_json_pretty_atomic(&workflow_meta_path(&wdir), &WorkflowMeta::default())?;
  crate::storage::write_text_atomic(&wdir.join("title.txt"), title)?;
  Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn apply_workflow_template(
  app: tauri::AppHandle,
  project_dir: String,
  scope: WorkflowScope,
  workflow_id: Uuid,
  shot_id: Uuid,
  mapping: BTreeMap<String, String>,
) -> Result<String, String> {
  apply_workflow_template_impl(Some(&app), &project_dir, scope, workflow_id, shot_id, mapping)
    .map(|p| p.to_string_lossy().to_string())
    .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn read_workflow_meta(
  app: tauri::AppHandle,
  scope: WorkflowScope,
  project_dir: Option<String>,
  workflow_id: Uuid,
) -> Result<WorkflowMeta, String> {
  read_workflow_meta_impl(Some(&app), scope, project_dir.as_deref(), workflow_id).map_err(|e| e.to_string())
}

fn read_workflow_meta_impl(
  app: Option<&tauri::AppHandle>,
  scope: WorkflowScope,
  project_dir: Option<&str>,
  workflow_id: Uuid,
) -> AppResult<WorkflowMeta> {
  let root = workflows_root_dir(app, &scope, project_dir)?;
  let wdir = workflow_dir(&root, workflow_id);
  let p = workflow_meta_path(&wdir);
  if !p.exists() {
    return Ok(WorkflowMeta::default());
  }
  read_json(&p)
}

#[tauri::command(rename_all = "snake_case")]
pub fn write_workflow_meta(
  app: tauri::AppHandle,
  scope: WorkflowScope,
  project_dir: Option<String>,
  workflow_id: Uuid,
  meta: WorkflowMeta,
) -> Result<WorkflowMeta, String> {
  write_workflow_meta_impl(Some(&app), scope, project_dir.as_deref(), workflow_id, &meta)
    .map(|_| meta)
    .map_err(|e| e.to_string())
}

fn write_workflow_meta_impl(
  app: Option<&tauri::AppHandle>,
  scope: WorkflowScope,
  project_dir: Option<&str>,
  workflow_id: Uuid,
  meta: &WorkflowMeta,
) -> AppResult<()> {
  let root = workflows_root_dir(app, &scope, project_dir)?;
  let wdir = workflow_dir(&root, workflow_id);
  ensure_dir(&wdir)?;
  write_json_pretty_atomic(&workflow_meta_path(&wdir), meta)?;
  Ok(())
}

fn apply_workflow_template_impl(
  app: Option<&tauri::AppHandle>,
  project_dir: &str,
  scope: WorkflowScope,
  workflow_id: Uuid,
  shot_id: Uuid,
  mapping: BTreeMap<String, String>,
) -> AppResult<PathBuf> {
  let project_dir_path = PathBuf::from(project_dir);
  let root = workflows_root_dir(app, &scope, Some(project_dir))?;
  let wdir = workflow_dir(&root, workflow_id);
  let src = workflow_json_path(&wdir);
  if !src.exists() {
    return Err(AppError::NotFound("Workflow JSON not found".to_string()));
  }
  let mut json: serde_json::Value = read_json(&src)?;
  apply_placeholders(&mut json, &mapping);

  let now = Utc::now();
  let variants_root = workflow_variants_root(&project_dir_path).join(shot_id.to_string());
  ensure_dir(&variants_root)?;
  let out_path = variants_root.join(format!("{}.json", now.format("%Y%m%dT%H%M%SZ")));
  write_json_pretty_atomic(&out_path, &json)?;
  Ok(out_path)
}
