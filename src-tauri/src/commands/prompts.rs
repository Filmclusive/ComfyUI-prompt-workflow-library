use std::path::{Path, PathBuf};

use chrono::Utc;
use uuid::Uuid;

use crate::{
  error::{AppError, AppResult},
  model::{PromptEntry, PromptEntryKind, PromptScope},
  storage::{read_json, write_json_pretty_atomic},
};

fn prompt_root_dir(app: Option<&tauri::AppHandle>, scope: &PromptScope, parent_dir: Option<&str>) -> AppResult<PathBuf> {
  match scope {
    PromptScope::Global => {
      let app = app.ok_or_else(|| AppError::InvalidInput("App handle required for global prompts".to_string()))?;
      let dir = app
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| AppError::InvalidInput("App data dir not available".to_string()))?
        .join("library")
        .join("global-prompts");
      Ok(dir)
    }
    PromptScope::Project | PromptScope::Scene | PromptScope::Shot => {
      let parent_dir = parent_dir.ok_or_else(|| AppError::InvalidInput("parentDir is required for non-global prompt scope".to_string()))?;
      Ok(PathBuf::from(parent_dir).join("prompt-library"))
    }
  }
}

fn entry_path(root: &Path, id: Uuid) -> PathBuf {
  root.join(format!("entry_{}.json", id))
}

#[tauri::command]
pub fn list_prompt_entries(
  app: tauri::AppHandle,
  scope: PromptScope,
  parent_dir: Option<String>,
  parent_id: Option<Uuid>,
) -> Result<Vec<PromptEntry>, String> {
  list_prompt_entries_impl(Some(&app), scope, parent_dir.as_deref(), parent_id).map_err(|e| e.to_string())
}

fn list_prompt_entries_impl(
  app: Option<&tauri::AppHandle>,
  scope: PromptScope,
  parent_dir: Option<&str>,
  parent_id: Option<Uuid>,
) -> AppResult<Vec<PromptEntry>> {
  let root = prompt_root_dir(app, &scope, parent_dir)?;
  if !root.exists() {
    return Ok(Vec::new());
  }
  let mut out = Vec::new();
  for entry in std::fs::read_dir(&root)? {
    let entry = entry?;
    if !entry.file_type()?.is_file() {
      continue;
    }
    if !entry.file_name().to_string_lossy().starts_with("entry_") {
      continue;
    }
    let pe: PromptEntry = read_json(&entry.path())?;
    if pe.scope == scope && pe.parent_id == parent_id {
      out.push(pe);
    }
  }
  out.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
  Ok(out)
}

#[tauri::command]
pub fn create_prompt_entry(
  app: tauri::AppHandle,
  scope: PromptScope,
  parent_dir: Option<String>,
  parent_id: Option<Uuid>,
  title: String,
  body: String,
  tags: Vec<String>,
  kind: PromptEntryKind,
) -> Result<PromptEntry, String> {
  create_prompt_entry_impl(Some(&app), scope, parent_dir.as_deref(), parent_id, &title, &body, tags, kind)
    .map_err(|e| e.to_string())
}

fn create_prompt_entry_impl(
  app: Option<&tauri::AppHandle>,
  scope: PromptScope,
  parent_dir: Option<&str>,
  parent_id: Option<Uuid>,
  title: &str,
  body: &str,
  tags: Vec<String>,
  kind: PromptEntryKind,
) -> AppResult<PromptEntry> {
  if title.trim().is_empty() {
    return Err(AppError::InvalidInput("Title is required".to_string()));
  }
  let root = prompt_root_dir(app, &scope, parent_dir)?;
  std::fs::create_dir_all(&root)?;

  let now = Utc::now();
  let entry = PromptEntry {
    id: Uuid::new_v4(),
    scope: scope.clone(),
    parent_id,
    title: title.to_string(),
    body: body.to_string(),
    tags,
    kind,
    created_at: now,
    updated_at: now,
  };
  write_json_pretty_atomic(&entry_path(&root, entry.id), &entry)?;
  Ok(entry)
}

#[tauri::command]
pub fn delete_prompt_entry(
  app: tauri::AppHandle,
  scope: PromptScope,
  parent_dir: Option<String>,
  id: Uuid,
) -> Result<(), String> {
  delete_prompt_entry_impl(Some(&app), scope, parent_dir.as_deref(), id).map_err(|e| e.to_string())
}

fn delete_prompt_entry_impl(
  app: Option<&tauri::AppHandle>,
  scope: PromptScope,
  parent_dir: Option<&str>,
  id: Uuid,
) -> AppResult<()> {
  let root = prompt_root_dir(app, &scope, parent_dir)?;
  let p = entry_path(&root, id);
  if !p.exists() {
    return Err(AppError::NotFound("Prompt entry not found".to_string()));
  }
  std::fs::remove_file(p)?;
  Ok(())
}

