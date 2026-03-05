use std::path::PathBuf;

use chrono::Utc;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    model::{Scene, Shot, ShotParams, ShotStatus},
    paths::{
        ensure_dir, scene_dir, scene_json_path, scene_shots_dir, shot_dir, shot_dir_name,
        shot_json_path, shot_negative_path, shot_positive_path,
    },
    storage::{read_json, write_json_pretty_atomic, write_text_atomic},
};

#[tauri::command(rename_all = "snake_case")]
pub fn list_shots(
    project_dir: String,
    scene_id: Uuid,
    scene_dir: String,
) -> Result<Vec<Shot>, String> {
    list_shots_impl(&project_dir, &scene_dir, scene_id).map_err(|e| e.to_string())
}

fn list_shots_impl(
    project_dir: &str,
    scene_dir_name: &str,
    scene_id: Uuid,
) -> AppResult<Vec<Shot>> {
    let project_dir = PathBuf::from(project_dir);
    let sdir = scene_dir(&project_dir, scene_dir_name);
    let shots_root = scene_shots_dir(&sdir);
    if !shots_root.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&shots_root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let shot_path = shot_json_path(&entry.path());
        if !shot_path.exists() {
            continue;
        }
        let shot: Shot = read_json(&shot_path)?;
        if shot.scene_id == scene_id {
            out.push(shot);
        }
    }
    out.sort_by_key(|s| s.number);
    Ok(out)
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_shot(project_dir: String, scene_id: Uuid) -> Result<Shot, String> {
    create_shot_impl(&project_dir, scene_id).map_err(|e| e.to_string())
}

fn create_shot_impl(project_dir: &str, scene_id: Uuid) -> AppResult<Shot> {
    let project_dir = PathBuf::from(project_dir);
    let scenes_root = project_dir.join("scenes");
    if !scenes_root.exists() {
        return Err(AppError::NotFound("Scenes folder not found".to_string()));
    }

    let mut scene_dir_name: Option<String> = None;
    for entry in std::fs::read_dir(&scenes_root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let sp = scene_json_path(&entry.path());
        if !sp.exists() {
            continue;
        }
        let scene: Scene = read_json(&sp)?;
        if scene.id == scene_id {
            scene_dir_name = Some(entry.file_name().to_string_lossy().to_string());
            break;
        }
    }
    let scene_dir_name =
        scene_dir_name.ok_or_else(|| AppError::NotFound("Scene not found".to_string()))?;
    let sdir = scene_dir(&project_dir, &scene_dir_name);

    let sjp = scene_json_path(&sdir);
    let mut scene: Scene = read_json(&sjp)?;

    let number = (scene.shot_ids.len() as u32) + 1;
    let id = Uuid::new_v4();
    let dir_name = shot_dir_name(number, id);
    let shdir = shot_dir(&sdir, &dir_name);

    ensure_dir(&shdir)?;
    ensure_dir(&shdir.join("attachments"))?;
    ensure_dir(&shdir.join("history"))?;
    ensure_dir(&shdir.join("prompt-library"))?;

    let now = Utc::now();
    let shot = Shot {
        id,
        scene_id: scene.id,
        number,
        title: String::new(),
        status: ShotStatus::Todo,
        notes: String::new(),
        tags: Vec::new(),
        params: ShotParams::default(),
        attachments: Vec::new(),
        workflow_ref: None,
        created_at: now,
        updated_at: now,
    };
    write_json_pretty_atomic(&shot_json_path(&shdir), &shot)?;
    write_text_atomic(&shot_positive_path(&shdir), "")?;
    write_text_atomic(&shot_negative_path(&shdir), "")?;

    scene.shot_ids.push(shot.id);
    scene.updated_at = now;
    write_json_pretty_atomic(&sjp, &scene)?;

    Ok(shot)
}

#[tauri::command(rename_all = "snake_case")]
pub fn read_shot(project_dir: String, scene_id: Uuid, shot_id: Uuid) -> Result<Shot, String> {
    read_shot_impl(&project_dir, scene_id, shot_id).map_err(|e| e.to_string())
}

fn read_shot_impl(project_dir: &str, scene_id: Uuid, shot_id: Uuid) -> AppResult<Shot> {
    let project_dir = PathBuf::from(project_dir);
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
                return Ok(shot);
            }
        }
    }
    Err(AppError::NotFound("Shot not found".to_string()))
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_shot_fields(
    project_dir: String,
    scene_id: Uuid,
    shot_id: Uuid,
    shot: Shot,
) -> Result<Shot, String> {
    update_shot_fields_impl(&project_dir, scene_id, shot_id, &shot)
        .map(|_| shot)
        .map_err(|e| e.to_string())
}

fn update_shot_fields_impl(
    project_dir: &str,
    scene_id: Uuid,
    shot_id: Uuid,
    shot: &Shot,
) -> AppResult<()> {
    let project_dir = PathBuf::from(project_dir);
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
            let existing: Shot = read_json(&sj)?;
            if existing.id == shot_id {
                write_json_pretty_atomic(&sj, shot)?;
                return Ok(());
            }
        }
    }
    Err(AppError::NotFound("Shot not found".to_string()))
}
