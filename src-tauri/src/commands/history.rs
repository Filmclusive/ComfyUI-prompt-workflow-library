use std::path::{Path, PathBuf};

use chrono::Utc;
use similar::TextDiff;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    model::{RevisionMeta, Shot},
    paths::{
        scene_json_path, scene_shots_dir, shot_history_dir, shot_json_path, shot_negative_path,
        shot_positive_path,
    },
    storage::{read_json, read_text, write_json_pretty_atomic, write_text_atomic},
};

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionSummary {
    pub id: Uuid,
    pub dir_name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub message: Option<String>,
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
        let scene: crate::model::Scene = read_json(&sp)?;
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
pub fn create_revision(
    project_dir: String,
    scene_id: Uuid,
    shot_id: Uuid,
    message: Option<String>,
) -> Result<(), String> {
    create_revision_impl(&project_dir, scene_id, shot_id, message).map_err(|e| e.to_string())
}

fn create_revision_impl(
    project_dir: &str,
    scene_id: Uuid,
    shot_id: Uuid,
    message: Option<String>,
) -> AppResult<()> {
    let project_dir = PathBuf::from(project_dir);
    let shot_dir = find_shot_dir(&project_dir, scene_id, shot_id)?;
    let history_root = shot_history_dir(&shot_dir);
    std::fs::create_dir_all(&history_root)?;

    let now = Utc::now();
    let rev_id = Uuid::new_v4();
    let dir_name = format!("{}-{}", now.format("%Y%m%dT%H%M%SZ"), rev_id);
    let rev_dir = history_root.join(&dir_name);
    std::fs::create_dir_all(&rev_dir)?;

    let shot: Shot = read_json(&shot_json_path(&shot_dir))?;
    let pos = read_text(&shot_positive_path(&shot_dir))?;
    let neg = read_text(&shot_negative_path(&shot_dir))?;

    write_json_pretty_atomic(&rev_dir.join("shot.json"), &shot)?;
    write_text_atomic(&rev_dir.join("positive.txt"), &pos)?;
    write_text_atomic(&rev_dir.join("negative.txt"), &neg)?;

    let meta = RevisionMeta {
        id: rev_id,
        created_at: now,
        message,
    };
    write_json_pretty_atomic(&rev_dir.join("meta.json"), &meta)?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_revisions(
    project_dir: String,
    scene_id: Uuid,
    shot_id: Uuid,
) -> Result<Vec<RevisionSummary>, String> {
    list_revisions_impl(&project_dir, scene_id, shot_id).map_err(|e| e.to_string())
}

fn list_revisions_impl(
    project_dir: &str,
    scene_id: Uuid,
    shot_id: Uuid,
) -> AppResult<Vec<RevisionSummary>> {
    let project_dir = PathBuf::from(project_dir);
    let shot_dir = find_shot_dir(&project_dir, scene_id, shot_id)?;
    let history_root = shot_history_dir(&shot_dir);
    if !history_root.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&history_root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        let meta_path = entry.path().join("meta.json");
        if !meta_path.exists() {
            continue;
        }
        let meta: RevisionMeta = read_json(&meta_path)?;
        out.push(RevisionSummary {
            id: meta.id,
            dir_name,
            created_at: meta.created_at,
            message: meta.message,
        });
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

#[tauri::command(rename_all = "snake_case")]
pub fn restore_revision(
    project_dir: String,
    scene_id: Uuid,
    shot_id: Uuid,
    revision_dir_name: String,
) -> Result<(), String> {
    restore_revision_impl(&project_dir, scene_id, shot_id, &revision_dir_name)
        .map_err(|e| e.to_string())
}

fn restore_revision_impl(
    project_dir: &str,
    scene_id: Uuid,
    shot_id: Uuid,
    revision_dir_name: &str,
) -> AppResult<()> {
    let project_dir = PathBuf::from(project_dir);
    let shot_dir = find_shot_dir(&project_dir, scene_id, shot_id)?;
    let rev_dir = shot_history_dir(&shot_dir).join(revision_dir_name);
    if !rev_dir.exists() {
        return Err(AppError::NotFound("Revision not found".to_string()));
    }
    let shot: Shot = read_json(&rev_dir.join("shot.json"))?;
    let pos = read_text(&rev_dir.join("positive.txt"))?;
    let neg = read_text(&rev_dir.join("negative.txt"))?;

    write_json_pretty_atomic(&shot_json_path(&shot_dir), &shot)?;
    write_text_atomic(&shot_positive_path(&shot_dir), &pos)?;
    write_text_atomic(&shot_negative_path(&shot_dir), &neg)?;
    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub positive: String,
    pub negative: String,
    pub shot_json: String,
}

#[tauri::command(rename_all = "snake_case")]
pub fn diff_revision(
    project_dir: String,
    scene_id: Uuid,
    shot_id: Uuid,
    revision_dir_name: String,
) -> Result<DiffResult, String> {
    diff_revision_impl(&project_dir, scene_id, shot_id, &revision_dir_name)
        .map_err(|e| e.to_string())
}

fn diff_revision_impl(
    project_dir: &str,
    scene_id: Uuid,
    shot_id: Uuid,
    revision_dir_name: &str,
) -> AppResult<DiffResult> {
    let project_dir = PathBuf::from(project_dir);
    let shot_dir = find_shot_dir(&project_dir, scene_id, shot_id)?;
    let rev_dir = shot_history_dir(&shot_dir).join(revision_dir_name);
    if !rev_dir.exists() {
        return Err(AppError::NotFound("Revision not found".to_string()));
    }

    let cur_pos = read_text(&shot_positive_path(&shot_dir))?;
    let cur_neg = read_text(&shot_negative_path(&shot_dir))?;
    let cur_shot: serde_json::Value = read_json(&shot_json_path(&shot_dir))?;

    let rev_pos = read_text(&rev_dir.join("positive.txt"))?;
    let rev_neg = read_text(&rev_dir.join("negative.txt"))?;
    let rev_shot: serde_json::Value = read_json(&rev_dir.join("shot.json"))?;

    let pos_diff = TextDiff::from_lines(&rev_pos, &cur_pos)
        .unified_diff()
        .to_string();
    let neg_diff = TextDiff::from_lines(&rev_neg, &cur_neg)
        .unified_diff()
        .to_string();
    let shot_diff = TextDiff::from_lines(
        &serde_json::to_string_pretty(&rev_shot)?,
        &serde_json::to_string_pretty(&cur_shot)?,
    )
    .unified_diff()
    .to_string();

    Ok(DiffResult {
        positive: pos_diff,
        negative: neg_diff,
        shot_json: shot_diff,
    })
}
