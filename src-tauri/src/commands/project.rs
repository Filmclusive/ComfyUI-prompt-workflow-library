use std::path::PathBuf;

use chrono::Utc;
use tauri::AppHandle;
use uuid::Uuid;

use crate::{
  error::{AppError, AppResult},
  model::Project,
  paths::{ensure_dir, project_json_path, scenes_dir},
  settings::{bump_recent, read_settings, write_settings},
  storage::{read_json, write_json_pretty_atomic},
};

#[tauri::command]
pub fn create_project(app: AppHandle, name: String, dir: String) -> Result<String, String> {
  create_project_impl(&app, &name, &dir)
    .map(|p| p.to_string_lossy().to_string())
    .map_err(|e| e.to_string())
}

fn create_project_impl(app: &AppHandle, name: &str, dir: &str) -> AppResult<PathBuf> {
  if name.trim().is_empty() {
    return Err(AppError::InvalidInput("Project name is required".to_string()));
  }
  if dir.trim().is_empty() {
    return Err(AppError::InvalidInput("Project folder path is required".to_string()));
  }
  let project_dir = PathBuf::from(dir);
  ensure_dir(&project_dir)?;
  ensure_dir(&scenes_dir(&project_dir))?;
  ensure_dir(&project_dir.join("prompt-library"))?;
  ensure_dir(&project_dir.join("workflows"))?;
  ensure_dir(&project_dir.join("exports"))?;

  let now = Utc::now();
  let project = Project {
    id: Uuid::new_v4(),
    name: name.to_string(),
    scene_ids: Vec::new(),
    created_at: now,
    updated_at: now,
  };
  write_json_pretty_atomic(&project_json_path(&project_dir), &project)?;

  let mut settings = read_settings(app)?;
  bump_recent(&mut settings, &project_dir);
  write_settings(app, &settings)?;

  Ok(project_dir)
}

#[tauri::command]
pub fn open_project(app: AppHandle, dir: String) -> Result<String, String> {
  open_project_impl(&app, &dir)
    .map(|p| p.to_string_lossy().to_string())
    .map_err(|e| e.to_string())
}

fn open_project_impl(app: &AppHandle, dir: &str) -> AppResult<PathBuf> {
  let project_dir = PathBuf::from(dir);
  let pj = project_json_path(&project_dir);
  if !pj.exists() {
    return Err(AppError::NotFound(format!(
      "project.json not found in {}",
      project_dir.display()
    )));
  }
  let mut settings = read_settings(app)?;
  bump_recent(&mut settings, &project_dir);
  write_settings(app, &settings)?;
  Ok(project_dir)
}

#[tauri::command]
pub fn read_project(project_dir: String) -> Result<Project, String> {
  let p = PathBuf::from(&project_dir);
  let pj = project_json_path(&p);
  read_json(&pj).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_project_metadata(project_dir: String, project: Project) -> Result<Project, String> {
  let p = PathBuf::from(&project_dir);
  let pj = project_json_path(&p);
  write_json_pretty_atomic(&pj, &project)
    .map(|_| project)
    .map_err(|e| e.to_string())
}

