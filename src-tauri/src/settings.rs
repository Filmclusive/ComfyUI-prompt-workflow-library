use std::path::{Path, PathBuf};

use tauri::AppHandle;

use crate::{
  error::{AppError, AppResult},
  model::AppSettings,
  storage::{read_json, write_json_pretty_atomic},
};

fn settings_path(app: &AppHandle) -> AppResult<PathBuf> {
  let dir = app
    .path_resolver()
    .app_data_dir()
    .ok_or_else(|| AppError::InvalidInput("App data dir not available".to_string()))?;
  Ok(dir.join("settings.json"))
}

pub fn read_settings(app: &AppHandle) -> AppResult<AppSettings> {
  let path = settings_path(app)?;
  if !path.exists() {
    return Ok(AppSettings::default());
  }
  read_json(&path)
}

pub fn write_settings(app: &AppHandle, settings: &AppSettings) -> AppResult<AppSettings> {
  let path = settings_path(app)?;
  write_json_pretty_atomic(&path, settings)?;
  Ok(settings.clone())
}

pub fn bump_recent(settings: &mut AppSettings, project_dir: &Path) {
  let s = project_dir.to_string_lossy().to_string();
  settings.recent_projects.retain(|d| d != &s);
  settings.recent_projects.insert(0, s);
  settings.recent_projects.truncate(20);
}

