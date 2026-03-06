use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::Serialize;
use tauri::AppHandle;

use crate::{
    error::{AppError, AppResult},
    settings::read_settings,
    storage::{write_json_pretty_atomic, write_text_atomic},
};

const PLUGIN_DIR_NAME: &str = "ComfyUI-Filmclusive-Bridge";

// Embedded plugin payload (copied into the user's ComfyUI folder at runtime).
const FILE_INIT: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../integrations/comfyui/ComfyUI-Filmclusive-Bridge/__init__.py"
));
const FILE_ROUTES: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../integrations/comfyui/ComfyUI-Filmclusive-Bridge/routes.py"
));
const FILE_TERMS_DEFAULT: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../integrations/comfyui/ComfyUI-Filmclusive-Bridge/terms.default.json"
));
const FILE_JS_FILMCLUSIVE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../integrations/comfyui/ComfyUI-Filmclusive-Bridge/js/filmclusive.js"
));
const FILE_README: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../integrations/comfyui/ComfyUI-Filmclusive-Bridge/README.md"
));

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeInstallRecord {
    plugin_dir: String,
    version: String,
    installed_at: String,
}

fn comfyui_root_from_settings(settings: &crate::model::AppSettings) -> AppResult<PathBuf> {
    let wd = settings.comfyui.working_dir.as_ref().ok_or_else(|| {
        AppError::InvalidInput(
            "ComfyUI working directory is not set. Set it in Settings first.".to_string(),
        )
    })?;
    Ok(PathBuf::from(wd))
}

fn plugin_target_dir(comfyui_root: &Path) -> PathBuf {
    comfyui_root.join("custom_nodes").join(PLUGIN_DIR_NAME)
}

fn install_impl(app: &AppHandle, force: bool) -> AppResult<PathBuf> {
    let settings = read_settings(app)?;
    let comfyui_root = comfyui_root_from_settings(&settings)?;
    let target = plugin_target_dir(&comfyui_root);

    if target.exists() && !force {
        return Ok(target);
    }

    std::fs::create_dir_all(target.join("js"))?;

    write_text_atomic(&target.join("__init__.py"), FILE_INIT)?;
    write_text_atomic(&target.join("routes.py"), FILE_ROUTES)?;
    write_text_atomic(&target.join("terms.default.json"), FILE_TERMS_DEFAULT)?;
    write_text_atomic(&target.join("README.md"), FILE_README)?;
    write_text_atomic(&target.join("js").join("filmclusive.js"), FILE_JS_FILMCLUSIVE)?;

    // Keep a record in ComfyUI/user/filmclusive/ so both sides can confirm install state.
    let record_dir = comfyui_root.join("user").join("filmclusive");
    std::fs::create_dir_all(&record_dir)?;
    let record = BridgeInstallRecord {
        plugin_dir: target.to_string_lossy().to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        installed_at: Utc::now().to_rfc3339(),
    };
    write_json_pretty_atomic(&record_dir.join("install.json"), &record)?;

    Ok(target)
}

#[tauri::command(rename_all = "snake_case")]
pub fn install_comfyui_bridge_plugin(app: AppHandle, force: Option<bool>) -> Result<String, String> {
    let dir = install_impl(&app, force.unwrap_or(false)).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

