#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod model;
mod paths;
mod settings;
mod state;
mod storage;
mod workflow_injection;

use crate::state::ComfyUiProcessState;

fn ensure_app_dirs(app: &tauri::AppHandle) -> Result<(), String> {
  let app_data = app
    .path_resolver()
    .app_data_dir()
    .ok_or_else(|| "App data dir not available".to_string())?;
  std::fs::create_dir_all(app_data.join("library").join("global-prompts"))
    .map_err(|e| e.to_string())?;
  std::fs::create_dir_all(app_data.join("workflows").join("global")).map_err(|e| e.to_string())?;
  Ok(())
}

fn main() {
  tauri::Builder::default()
    .manage(ComfyUiProcessState::default())
    .setup(|app| {
      ensure_app_dirs(&app.handle())?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // Settings
      commands::comfyui::get_settings,
      commands::comfyui::set_settings,
      // Project
      commands::project::create_project,
      commands::project::open_project,
      commands::project::read_project,
      commands::project::write_project_metadata,
      // Scenes / shots
      commands::scenes::list_scenes,
      commands::scenes::create_scene,
      commands::shots::list_shots,
      commands::shots::create_shot,
      commands::shots::read_shot,
      commands::shots::update_shot_fields,
      // Prompt text (shot positive/negative)
      commands::prompt_text::read_prompt_text,
      commands::prompt_text::write_prompt_text,
      // Prompt library
      commands::prompts::list_prompt_entries,
      commands::prompts::create_prompt_entry,
      commands::prompts::delete_prompt_entry,
      // History
      commands::history::create_revision,
      commands::history::list_revisions,
      commands::history::restore_revision,
      commands::history::diff_revision,
      // Attachments
      commands::attachments::import_attachments,
      // Workflows
      commands::workflows::list_workflows,
      commands::workflows::import_workflow,
      commands::workflows::apply_workflow_template,
      commands::workflows::read_workflow_meta,
      commands::workflows::write_workflow_meta,
      // Export
      commands::export::export_bundle,
      // ComfyUI
      commands::comfyui::launch_comfyui,
      commands::comfyui::stop_comfyui,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
