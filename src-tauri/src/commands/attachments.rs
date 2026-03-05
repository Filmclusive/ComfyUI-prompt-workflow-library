use std::path::{Path, PathBuf};

use chrono::Utc;
use uuid::Uuid;

use crate::{
  error::{AppError, AppResult},
  model::{Attachment, AttachmentKind, AttachmentRole, Scene, Shot},
  paths::{scene_json_path, scene_shots_dir, shot_attachments_dir, shot_json_path},
  storage::{copy_file_atomic, read_json, write_json_pretty_atomic},
};

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

fn guess_kind(file_name: &str) -> AttachmentKind {
  let lower = file_name.to_lowercase();
  if lower.ends_with(".png")
    || lower.ends_with(".jpg")
    || lower.ends_with(".jpeg")
    || lower.ends_with(".webp")
    || lower.ends_with(".gif")
  {
    return AttachmentKind::Image;
  }
  if lower.ends_with(".mp4") || lower.ends_with(".mov") || lower.ends_with(".mkv") {
    return AttachmentKind::Video;
  }
  AttachmentKind::Other
}

#[tauri::command(rename_all = "snake_case")]
pub fn import_attachments(
  project_dir: String,
  scene_id: Uuid,
  shot_id: Uuid,
  files: Vec<String>,
  role: AttachmentRole,
) -> Result<Shot, String> {
  import_attachments_impl(&project_dir, scene_id, shot_id, files, role).map_err(|e| e.to_string())
}

fn import_attachments_impl(
  project_dir: &str,
  scene_id: Uuid,
  shot_id: Uuid,
  files: Vec<String>,
  role: AttachmentRole,
) -> AppResult<Shot> {
  let project_dir = PathBuf::from(project_dir);
  let shot_dir = find_shot_dir(&project_dir, scene_id, shot_id)?;
  let attachments_dir = shot_attachments_dir(&shot_dir);
  std::fs::create_dir_all(&attachments_dir)?;

  let shot_json = shot_json_path(&shot_dir);
  let mut shot: Shot = read_json(&shot_json)?;

  let now = Utc::now();
  for file in files {
    let src = PathBuf::from(&file);
    if !src.exists() {
      return Err(AppError::NotFound(format!("Attachment not found: {file}")));
    }
    let file_name = src
      .file_name()
      .and_then(|n| n.to_str())
      .ok_or_else(|| AppError::InvalidInput("Invalid file name".to_string()))?
      .to_string();

    let id = Uuid::new_v4();
    let dst_file_name = format!("{}_{}", id, file_name);
    let dst = attachments_dir.join(&dst_file_name);
    copy_file_atomic(&src, &dst)?;

    let rel_path = format!("attachments/{}", dst_file_name);
    shot.attachments.push(Attachment {
      id,
      role: role.clone(),
      kind: guess_kind(&file_name),
      file_name,
      rel_path,
      added_at: now,
    });
  }

  shot.updated_at = now;
  write_json_pretty_atomic(&shot_json, &shot)?;
  Ok(shot)
}
