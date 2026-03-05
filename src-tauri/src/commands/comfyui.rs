use std::{
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

use tauri::AppHandle;

use crate::{
    error::{AppError, AppResult},
    settings::{read_settings, write_settings},
    state::ComfyUiProcessState,
};

pub(crate) fn spawn_comfyui_app(app_path: &str, file_to_open: Option<&Path>) -> AppResult<()> {
    if app_path.trim().is_empty() {
        return Err(AppError::InvalidInput(
            "ComfyUI application path is required".to_string(),
        ));
    }

    #[cfg(target_os = "macos")]
    {
        let app_path_lower = app_path.to_lowercase();
        if app_path_lower.ends_with(".app") {
            let mut cmd = Command::new("open");
            cmd.arg("-a").arg(app_path);
            if let Some(p) = file_to_open {
                cmd.arg(p);
            }
            cmd.spawn()?;
            return Ok(());
        }
    }

    let mut cmd = Command::new(app_path);
    if let Some(p) = file_to_open {
        cmd.arg(p);
    }
    cmd.spawn()?;
    Ok(())
}

fn detect_comfyui_application_path() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let mut roots = vec![PathBuf::from("/Applications")];
        if let Some(home) = std::env::var_os("HOME") {
            roots.push(PathBuf::from(home).join("Applications"));
        }
        for root in roots {
            if !root.exists() {
                continue;
            }
            let Ok(entries) = std::fs::read_dir(&root) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let name = path.file_name()?.to_string_lossy().to_string();
                let name_lower = name.to_lowercase();
                if name_lower.contains("comfyui") && name_lower.ends_with(".app") {
                    return Some(path);
                }
            }
        }
        return None;
    }

    #[cfg(target_os = "windows")]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            candidates.push(
                PathBuf::from(&local)
                    .join("Programs")
                    .join("ComfyUI")
                    .join("ComfyUI.exe"),
            );
            candidates.push(
                PathBuf::from(&local)
                    .join("Programs")
                    .join("ComfyUI")
                    .join("comfyui.exe"),
            );
        }
        if let Some(pf) = std::env::var_os("ProgramFiles") {
            candidates.push(PathBuf::from(&pf).join("ComfyUI").join("ComfyUI.exe"));
        }
        if let Some(pfx86) = std::env::var_os("ProgramFiles(x86)") {
            candidates.push(PathBuf::from(&pfx86).join("ComfyUI").join("ComfyUI.exe"));
        }

        for c in candidates {
            if c.exists() && c.is_file() {
                return Some(c);
            }
        }
        return None;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        None
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn find_comfyui_application(_app: AppHandle) -> Result<Option<String>, String> {
    Ok(detect_comfyui_application_path().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command(rename_all = "snake_case")]
pub fn open_comfyui_application(app: AppHandle) -> Result<(), String> {
    let settings = read_settings(&app).map_err(|e| e.to_string())?;
    let app_path = settings.comfyui.app_path.ok_or_else(|| {
        "ComfyUI application is not set. Select it in Settings first.".to_string()
    })?;
    spawn_comfyui_app(&app_path, None).map_err(|e| e.to_string())
}

fn split_command(command: &str) -> AppResult<(String, Vec<String>)> {
    let parts = shell_words::split(command)
        .map_err(|_| AppError::InvalidInput("Failed to parse command".to_string()))?;
    if parts.is_empty() {
        return Err(AppError::InvalidInput("Command is required".to_string()));
    }
    Ok((parts[0].clone(), parts[1..].to_vec()))
}

#[tauri::command(rename_all = "snake_case")]
pub fn launch_comfyui(
    app: AppHandle,
    state: tauri::State<ComfyUiProcessState>,
) -> Result<(), String> {
    launch_comfyui_impl(&app, &state).map_err(|e| e.to_string())
}

fn launch_comfyui_impl(app: &AppHandle, state: &ComfyUiProcessState) -> AppResult<()> {
    let settings = read_settings(app)?;
    let (bin, args) = split_command(&settings.comfyui.command)?;

    let mut child_guard = state.child.lock().unwrap();
    if child_guard.is_some() {
        return Ok(());
    }

    let mut cmd = Command::new(bin);
    cmd.args(args);
    if let Some(wd) = settings.comfyui.working_dir.as_ref() {
        cmd.current_dir(wd);
    }
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    let child = cmd.spawn()?;
    *child_guard = Some(child);
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn stop_comfyui(state: tauri::State<ComfyUiProcessState>) -> Result<(), String> {
    stop_comfyui_impl(&state).map_err(|e| e.to_string())
}

fn stop_comfyui_impl(state: &ComfyUiProcessState) -> AppResult<()> {
    let mut child_guard = state.child.lock().unwrap();
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_settings(app: AppHandle) -> Result<crate::model::AppSettings, String> {
    read_settings(&app).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_settings(
    app: AppHandle,
    settings: crate::model::AppSettings,
) -> Result<crate::model::AppSettings, String> {
    write_settings(&app, &settings).map_err(|e| e.to_string())
}
