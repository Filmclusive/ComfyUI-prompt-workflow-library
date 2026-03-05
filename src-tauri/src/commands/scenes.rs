use std::path::PathBuf;

use chrono::Utc;
use uuid::Uuid;

use crate::{
    error::AppResult,
    model::{Project, Scene},
    paths::{
        ensure_dir, project_json_path, scene_dir, scene_dir_name, scene_json_path, scene_shots_dir,
        scenes_dir,
    },
    storage::{read_json, write_json_pretty_atomic},
};

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneWithDir {
    #[serde(flatten)]
    pub scene: Scene,
    pub dir_name: String,
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_scenes(project_dir: String) -> Result<Vec<SceneWithDir>, String> {
    list_scenes_impl(&project_dir).map_err(|e| e.to_string())
}

fn list_scenes_impl(project_dir: &str) -> AppResult<Vec<SceneWithDir>> {
    let project_dir = PathBuf::from(project_dir);
    let scenes_root = scenes_dir(&project_dir);
    if !scenes_root.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&scenes_root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        let scene_path = scene_json_path(&entry.path());
        if !scene_path.exists() {
            continue;
        }
        let scene: Scene = read_json(&scene_path)?;
        out.push(SceneWithDir { scene, dir_name });
    }
    out.sort_by_key(|s| s.scene.number);
    Ok(out)
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_scene(project_dir: String, title: Option<String>) -> Result<SceneWithDir, String> {
    create_scene_impl(&project_dir, title.as_deref()).map_err(|e| e.to_string())
}

fn create_scene_impl(project_dir: &str, title: Option<&str>) -> AppResult<SceneWithDir> {
    let project_dir = PathBuf::from(project_dir);
    let pj = project_json_path(&project_dir);
    let mut project: Project = read_json(&pj)?;

    let number = (project.scene_ids.len() as u32) + 1;
    let id = Uuid::new_v4();
    let dir_name = scene_dir_name(number, id);
    let sdir = scene_dir(&project_dir, &dir_name);

    ensure_dir(&sdir)?;
    ensure_dir(&scene_shots_dir(&sdir))?;
    ensure_dir(&sdir.join("prompt-library"))?;

    let now = Utc::now();
    let scene = Scene {
        id,
        project_id: project.id,
        number,
        title: title.unwrap_or_default().to_string(),
        notes: String::new(),
        tags: Vec::new(),
        shot_ids: Vec::new(),
        created_at: now,
        updated_at: now,
    };

    write_json_pretty_atomic(&scene_json_path(&sdir), &scene)?;

    project.scene_ids.push(scene.id);
    project.updated_at = now;
    write_json_pretty_atomic(&pj, &project)?;

    Ok(SceneWithDir { scene, dir_name })
}
