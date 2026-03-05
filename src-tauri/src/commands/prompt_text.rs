use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::{
  error::{AppError, AppResult},
  model::{Scene, Shot},
  paths::{scene_json_path, scene_shots_dir, shot_json_path, shot_negative_path, shot_positive_path},
  storage::{read_json, read_text, write_text_atomic},
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PromptTextKind {
  Positive,
  Negative,
}

fn find_shot_dir(project_dir: &Path, scene_id: Uuid, shot_id: Uuid) -> AppResult<PathBuf> {
  let scenes_root = project_dir.join("scenes");
  for scene_entry in std::fs::read_dir(&scenes_root)? {
    let scene_entry = scene_entry?;
    if !scene_entry.file_type()?.is_dir() {
      continue;
    }
    let sp = scene_json_path(&scene_entry.path());
    if !sp.exists() {
      continue;
    }
    let scene: Scene = read_json(&sp)?;
    if scene.id != scene_id {
      continue;
    }
    let shots_root = scene_shots_dir(&scene_entry.path());
    for shot_entry in std::fs::read_dir(&shots_root)? {
      let shot_entry = shot_entry?;
      if !shot_entry.file_type()?.is_dir() {
        continue;
      }
      let sj = shot_json_path(&shot_entry.path());
      if !sj.exists() {
        continue;
      }
      let shot: Shot = read_json(&sj)?;
      if shot.id == shot_id {
        return Ok(shot_entry.path());
      }
    }
  }
  Err(AppError::NotFound("Shot not found".to_string()))
}

#[tauri::command(rename_all = "snake_case")]
pub fn read_prompt_text(
  project_dir: String,
  scene_id: Uuid,
  shot_id: Uuid,
  kind: PromptTextKind,
) -> Result<String, String> {
  read_prompt_text_impl(&project_dir, scene_id, shot_id, kind).map_err(|e| e.to_string())
}

fn read_prompt_text_impl(
  project_dir: &str,
  scene_id: Uuid,
  shot_id: Uuid,
  kind: PromptTextKind,
) -> AppResult<String> {
  let project_dir = PathBuf::from(project_dir);
  let shot_dir = find_shot_dir(&project_dir, scene_id, shot_id)?;
  let path = match kind {
    PromptTextKind::Positive => shot_positive_path(&shot_dir),
    PromptTextKind::Negative => shot_negative_path(&shot_dir),
  };
  read_text(&path)
}

#[tauri::command(rename_all = "snake_case")]
pub fn write_prompt_text(
  project_dir: String,
  scene_id: Uuid,
  shot_id: Uuid,
  kind: PromptTextKind,
  text: String,
) -> Result<(), String> {
  write_prompt_text_impl(&project_dir, scene_id, shot_id, kind, &text).map_err(|e| e.to_string())
}

fn write_prompt_text_impl(
  project_dir: &str,
  scene_id: Uuid,
  shot_id: Uuid,
  kind: PromptTextKind,
  text: &str,
) -> AppResult<()> {
  let project_dir = PathBuf::from(project_dir);
  let shot_dir = find_shot_dir(&project_dir, scene_id, shot_id)?;
  let path = match kind {
    PromptTextKind::Positive => shot_positive_path(&shot_dir),
    PromptTextKind::Negative => shot_negative_path(&shot_dir),
  };
  write_text_atomic(&path, text)?;
  Ok(())
}
