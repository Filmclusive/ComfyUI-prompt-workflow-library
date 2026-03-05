use chrono::Utc;
use include_dir::{include_dir, Dir};
use std::collections::{BTreeMap, HashSet};
use uuid::Uuid;

use crate::{
  error::{AppError, AppResult},
  model::WorkflowMeta,
  paths::{ensure_dir, workflow_dir, workflow_json_path, workflow_meta_path},
  storage::{write_json_pretty_atomic, write_text_atomic},
};

static DEFAULT_WORKFLOW_TAG: &str = "filmclusive-approved";

static DEFAULT_WORKFLOWS_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/default_workflows");

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
  #[serde(default)]
  workflows: Vec<DefaultWorkflow>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DefaultWorkflow {
  id: Uuid,
  title: String,
  file: String,
  #[serde(default)]
  tags: Vec<String>,
  #[serde(default)]
  models: Vec<String>,
  #[serde(default)]
  notes: String,
  #[serde(default)]
  variables: Vec<String>,
}

pub fn install_default_workflows(global_workflows_root: &std::path::Path) -> AppResult<()> {
  let manifest = match DEFAULT_WORKFLOWS_DIR.get_file("manifest.json") {
    Some(f) => serde_json::from_slice::<Manifest>(f.contents())?,
    None => Manifest { workflows: vec![] },
  };

  // Build an index of explicit manifest entries (if provided). Any `.json` files
  // in the folder that are not listed will still be included with derived metadata.
  let mut by_file: BTreeMap<String, DefaultWorkflow> = BTreeMap::new();
  for wf in manifest.workflows {
    if by_file.insert(wf.file.clone(), wf).is_some() {
      return Err(AppError::InvalidInput("Duplicate default workflow manifest file entry".to_string()));
    }
  }

  let json_files: Vec<_> = DEFAULT_WORKFLOWS_DIR
    .files()
    .filter_map(|f| {
      let path = f.path().to_string_lossy().to_string();
      if path == "manifest.json" {
        return None;
      }
      if !path.to_lowercase().ends_with(".json") {
        return None;
      }
      Some(path)
    })
    .collect();

  let mut expected_ids = HashSet::new();
  ensure_dir(global_workflows_root)?;
  if json_files.is_empty() && by_file.is_empty() {
    cleanup_removed_default_workflows(global_workflows_root, &expected_ids)?;
    return Ok(());
  }

  // Validate that all manifest entries reference a real file.
  for file in by_file.keys() {
    if DEFAULT_WORKFLOWS_DIR.get_file(file.as_str()).is_none() {
      return Err(AppError::InvalidInput(format!(
        "Default workflow file not found (from manifest): {file}"
      )));
    }
  }

  for file in json_files {
    let wf = match by_file.remove(&file) {
      Some(wf) => wf,
      None => {
        let name = file.split('/').last().unwrap_or(&file);
        let title = name.trim_end_matches(".json").trim_end_matches(".JSON");
        let name_lc = title.to_lowercase();
        let mut tags = vec!["filmclusive-approved".to_string()];
        let mut models = Vec::new();
        for (needle, model) in [
          ("sdxl", "sdxl"),
          ("flux", "flux"),
          ("wan", "wan"),
        ] {
          if name_lc.contains(needle) {
            tags.push(format!("model:{model}"));
            models.push(model.to_string());
          }
        }
        DefaultWorkflow {
          id: Uuid::new_v5(
            &Uuid::NAMESPACE_URL,
            format!("filmclusive-default-workflow:{file}").as_bytes(),
          ),
          title: title.to_string(),
          file: file.clone(),
          tags,
          models,
          notes: String::new(),
          variables: vec![],
        }
      }
    };

    let wf_id = wf.id;
    expected_ids.insert(wf_id);

    let tags = ensure_default_workflow_tag(wf.tags);

    let wdir = workflow_dir(global_workflows_root, wf_id);
    if wdir.exists() {
      continue;
    }
    ensure_dir(&wdir)?;

    let json_file = DEFAULT_WORKFLOWS_DIR
      .get_file(&wf.file)
      .ok_or_else(|| AppError::InvalidInput(format!("Default workflow file not found: {}", wf.file)))?;
    let json: serde_json::Value = serde_json::from_slice(json_file.contents())?;
    write_json_pretty_atomic(&workflow_json_path(&wdir), &json)?;

    let now = Utc::now();
    let meta = WorkflowMeta {
      variables: if wf.variables.is_empty() {
        WorkflowMeta::default().variables
      } else {
        wf.variables
      },
      notes: wf.notes,
      tags,
      models: wf.models,
      updated_at: now,
      created_at: now,
    };
    write_json_pretty_atomic(&workflow_meta_path(&wdir), &meta)?;
    write_text_atomic(&wdir.join("title.txt"), &wf.title)?;
  }
  cleanup_removed_default_workflows(global_workflows_root, &expected_ids)?;
  Ok(())
}

fn ensure_default_workflow_tag(mut tags: Vec<String>) -> Vec<String> {
  if !tags.iter().any(|tag| tag == DEFAULT_WORKFLOW_TAG) {
    tags.push(DEFAULT_WORKFLOW_TAG.to_string());
  }
  tags
}

fn cleanup_removed_default_workflows(
  global_workflows_root: &std::path::Path,
  expected_ids: &HashSet<Uuid>,
) -> AppResult<()> {
  for entry in std::fs::read_dir(global_workflows_root)? {
    let entry = entry?;
    if !entry.file_type()?.is_dir() {
      continue;
    }
    let name = entry.file_name();
    let name_str = name.to_string_lossy();
    let id_str = match name_str.strip_prefix("workflow_") {
      Some(value) => value,
      None => continue,
    };
    let id = match Uuid::parse_str(id_str) {
      Ok(id) => id,
      Err(_) => continue,
    };
    if expected_ids.contains(&id) {
      continue;
    }
    let meta_path = workflow_meta_path(&entry.path());
    let meta_contents = match std::fs::read(&meta_path) {
      Ok(contents) => contents,
      Err(_) => continue,
    };
    let meta: WorkflowMeta = match serde_json::from_slice(&meta_contents) {
      Ok(meta) => meta,
      Err(_) => continue,
    };
    if !meta.tags.iter().any(|tag| tag == DEFAULT_WORKFLOW_TAG) {
      continue;
    }
    std::fs::remove_dir_all(entry.path())?;
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn bundled_default_workflows_are_valid_json() {
    // This ensures the build fails early if any default workflow JSON is invalid.
    for f in DEFAULT_WORKFLOWS_DIR.files() {
      let path = f.path().to_string_lossy().to_string();
      if path == "manifest.json" || !path.to_lowercase().ends_with(".json") {
        continue;
      }
      let _: serde_json::Value = serde_json::from_slice(f.contents()).unwrap();
    }
  }
}
