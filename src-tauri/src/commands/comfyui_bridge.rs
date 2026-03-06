use std::path::PathBuf;

use chrono::Utc;
use serde::Serialize;
use tauri::AppHandle;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    settings::read_settings,
    storage::write_json_pretty_atomic,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ComfyUiBridgeContext {
    project_dir: String,
    scene_id: Uuid,
    shot_id: Uuid,
    updated_at: String,
}

fn bridge_dir(settings_working_dir: &str) -> PathBuf {
    PathBuf::from(settings_working_dir).join("user").join("filmclusive")
}

#[tauri::command(rename_all = "snake_case")]
pub fn write_comfyui_bridge_context(
    app: AppHandle,
    project_dir: String,
    scene_id: Uuid,
    shot_id: Uuid,
) -> Result<(), String> {
    write_comfyui_bridge_context_impl(&app, &project_dir, scene_id, shot_id)
        .map_err(|e| e.to_string())
}

fn write_comfyui_bridge_context_impl(
    app: &AppHandle,
    project_dir: &str,
    scene_id: Uuid,
    shot_id: Uuid,
) -> AppResult<()> {
    let settings = read_settings(app)?;
    let wd = settings.comfyui.working_dir.ok_or_else(|| {
        AppError::InvalidInput(
            "ComfyUI working directory is not set. Set it in Settings first.".to_string(),
        )
    })?;

    let dir = bridge_dir(&wd);
    std::fs::create_dir_all(&dir)?;

    let ctx = ComfyUiBridgeContext {
        project_dir: project_dir.to_string(),
        scene_id,
        shot_id,
        updated_at: Utc::now().to_rfc3339(),
    };

    write_json_pretty_atomic(&dir.join("context.json"), &ctx)?;
    Ok(())
}

