use std::{
  io::Write,
  path::{Path, PathBuf},
};

use crate::{
  error::{AppError, AppResult},
  storage::copy_file_atomic,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
  pub output_path: String,
  pub as_zip: bool,
  pub include_history: bool,
  pub include_attachments: bool,
}

impl Default for ExportOptions {
  fn default() -> Self {
    Self {
      output_path: String::new(),
      as_zip: true,
      include_history: false,
      include_attachments: true,
    }
  }
}

#[tauri::command]
pub fn export_bundle(project_dir: String, options: ExportOptions) -> Result<String, String> {
  export_bundle_impl(&project_dir, &options)
    .map(|p| p.to_string_lossy().to_string())
    .map_err(|e| e.to_string())
}

fn export_bundle_impl(project_dir: &str, options: &ExportOptions) -> AppResult<PathBuf> {
  if options.output_path.trim().is_empty() {
    return Err(AppError::InvalidInput("outputPath is required".to_string()));
  }
  let src = PathBuf::from(project_dir);
  if !src.exists() {
    return Err(AppError::NotFound(format!("Project folder not found: {project_dir}")));
  }
  let out = PathBuf::from(&options.output_path);
  if out.exists() {
    return Err(AppError::InvalidInput("Output path already exists".to_string()));
  }

  if options.as_zip || out.extension().and_then(|e| e.to_str()) == Some("zip") {
    export_as_zip(&src, &out, options)?;
    Ok(out)
  } else {
    export_as_folder(&src, &out, options)?;
    Ok(out)
  }
}

fn export_as_folder(src: &Path, dst: &Path, options: &ExportOptions) -> AppResult<()> {
  std::fs::create_dir_all(dst)?;
  copy_filtered(src, dst, options)?;
  Ok(())
}

fn export_as_zip(src: &Path, zip_path: &Path, options: &ExportOptions) -> AppResult<()> {
  if let Some(parent) = zip_path.parent() {
    std::fs::create_dir_all(parent)?;
  }
  let f = std::fs::File::create(zip_path)?;
  let mut zip = zip::ZipWriter::new(f);
  let opts = zip::write::SimpleFileOptions::default()
    .compression_method(zip::CompressionMethod::Deflated)
    .unix_permissions(0o644);

  zip_dir_filtered(&mut zip, src, src, options, opts)?;
  zip.finish()?;
  Ok(())
}

fn should_skip(rel: &Path, options: &ExportOptions) -> bool {
  if rel.components().any(|c| c.as_os_str() == "exports") {
    return true;
  }
  if !options.include_history && rel.components().any(|c| c.as_os_str() == "history") {
    return true;
  }
  if !options.include_attachments
    && rel
      .components()
      .any(|c| c.as_os_str() == "attachments")
  {
    return true;
  }
  false
}

fn copy_filtered(src: &Path, dst: &Path, options: &ExportOptions) -> AppResult<()> {
  for entry in std::fs::read_dir(src)? {
    let entry = entry?;
    let from = entry.path();
    let rel = from.strip_prefix(src).unwrap_or(&from);
    if should_skip(rel, options) {
      continue;
    }
    let to = dst.join(entry.file_name());
    let ft = entry.file_type()?;
    if ft.is_dir() {
      std::fs::create_dir_all(&to)?;
      copy_filtered(&from, &to, options)?;
    } else if ft.is_file() {
      copy_file_atomic(&from, &to)?;
    }
  }
  Ok(())
}

fn zip_dir_filtered<W: std::io::Write + std::io::Seek>(
  zip: &mut zip::ZipWriter<W>,
  root_src: &Path,
  cur_src: &Path,
  options: &ExportOptions,
  file_opts: zip::write::SimpleFileOptions,
) -> AppResult<()> {
  for entry in std::fs::read_dir(cur_src)? {
    let entry = entry?;
    let from = entry.path();
    let rel = from.strip_prefix(root_src).unwrap_or(&from);
    if should_skip(rel, options) {
      continue;
    }
    let name = rel.to_string_lossy().replace('\\', "/");
    let ft = entry.file_type()?;
    if ft.is_dir() {
      zip.add_directory(format!("{name}/"), file_opts)?;
      zip_dir_filtered(zip, root_src, &from, options, file_opts)?;
    } else if ft.is_file() {
      zip.start_file(name, file_opts)?;
      let bytes = std::fs::read(&from)?;
      zip.write_all(&bytes)?;
    }
  }
  Ok(())
}
