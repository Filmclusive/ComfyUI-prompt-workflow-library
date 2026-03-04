use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::error::{AppError, AppResult};

pub fn ensure_dir(path: &Path) -> AppResult<()> {
  std::fs::create_dir_all(path)?;
  Ok(())
}

pub fn project_json_path(project_dir: &Path) -> PathBuf {
  project_dir.join("project.json")
}

pub fn scenes_dir(project_dir: &Path) -> PathBuf {
  project_dir.join("scenes")
}

pub fn scene_dir_name(number: u32, id: Uuid) -> String {
  format!("scene_{:02}_{}", number, id)
}

pub fn scene_dir(project_dir: &Path, scene_dir_name: &str) -> PathBuf {
  scenes_dir(project_dir).join(scene_dir_name)
}

pub fn scene_json_path(scene_dir: &Path) -> PathBuf {
  scene_dir.join("scene.json")
}

pub fn scene_shots_dir(scene_dir: &Path) -> PathBuf {
  scene_dir.join("shots")
}

pub fn shot_dir_name(number: u32, id: Uuid) -> String {
  format!("shot_{:03}_{}", number, id)
}

pub fn shot_dir(scene_dir: &Path, shot_dir_name: &str) -> PathBuf {
  scene_shots_dir(scene_dir).join(shot_dir_name)
}

pub fn shot_json_path(shot_dir: &Path) -> PathBuf {
  shot_dir.join("shot.json")
}

pub fn shot_positive_path(shot_dir: &Path) -> PathBuf {
  shot_dir.join("positive.txt")
}

pub fn shot_negative_path(shot_dir: &Path) -> PathBuf {
  shot_dir.join("negative.txt")
}

pub fn shot_attachments_dir(shot_dir: &Path) -> PathBuf {
  shot_dir.join("attachments")
}

pub fn shot_history_dir(shot_dir: &Path) -> PathBuf {
  shot_dir.join("history")
}

pub fn prompt_library_dir_for_project(project_dir: &Path) -> PathBuf {
  project_dir.join("prompt-library")
}

pub fn prompt_library_dir_for_scene(scene_dir: &Path) -> PathBuf {
  scene_dir.join("prompt-library")
}

pub fn prompt_library_dir_for_shot(shot_dir: &Path) -> PathBuf {
  shot_dir.join("prompt-library")
}

pub fn workflows_dir_for_project(project_dir: &Path) -> PathBuf {
  project_dir.join("workflows")
}

pub fn workflow_dir(workflows_root: &Path, id: Uuid) -> PathBuf {
  workflows_root.join(format!("workflow_{}", id))
}

pub fn workflow_json_path(workflow_dir: &Path) -> PathBuf {
  workflow_dir.join("workflow.json")
}

pub fn workflow_meta_path(workflow_dir: &Path) -> PathBuf {
  workflow_dir.join("workflow.meta.json")
}

pub fn workflow_variants_root(project_dir: &Path) -> PathBuf {
  workflows_dir_for_project(project_dir).join("variants")
}

pub fn require_project_dir(project_dir: &str) -> AppResult<PathBuf> {
  let p = PathBuf::from(project_dir);
  if !p.exists() {
    return Err(AppError::NotFound(format!("Project folder not found: {project_dir}")));
  }
  Ok(p)
}

