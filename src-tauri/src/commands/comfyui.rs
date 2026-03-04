use std::process::{Command, Stdio};

use tauri::AppHandle;

use crate::{
  error::{AppError, AppResult},
  settings::{read_settings, write_settings},
  state::ComfyUiProcessState,
};

fn split_command(command: &str) -> AppResult<(String, Vec<String>)> {
  let parts = shell_words::split(command)
    .map_err(|_| AppError::InvalidInput("Failed to parse command".to_string()))?;
  if parts.is_empty() {
    return Err(AppError::InvalidInput("Command is required".to_string()));
  }
  Ok((parts[0].clone(), parts[1..].to_vec()))
}

#[tauri::command]
pub fn launch_comfyui(app: AppHandle, state: tauri::State<ComfyUiProcessState>) -> Result<(), String> {
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

#[tauri::command]
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

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<crate::model::AppSettings, String> {
  read_settings(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_settings(app: AppHandle, settings: crate::model::AppSettings) -> Result<crate::model::AppSettings, String> {
  write_settings(&app, &settings).map_err(|e| e.to_string())
}

