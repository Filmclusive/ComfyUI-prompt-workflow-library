use std::{
  fs,
  io::{Read, Write},
  path::{Path, PathBuf},
};

use serde::Serialize;

use crate::error::{AppError, AppResult};

pub fn read_text(path: &Path) -> AppResult<String> {
  if !path.exists() {
    return Ok(String::new());
  }
  Ok(fs::read_to_string(path)?)
}

pub fn write_text_atomic(path: &Path, text: &str) -> AppResult<()> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }
  let tmp = tmp_path(path);
  {
    let mut f = fs::File::create(&tmp)?;
    f.write_all(text.as_bytes())?;
    f.sync_all()?;
  }
  fs::rename(tmp, path)?;
  Ok(())
}

pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> AppResult<T> {
  let mut f = fs::File::open(path)?;
  let mut s = String::new();
  f.read_to_string(&mut s)?;
  Ok(serde_json::from_str(&s)?)
}

pub fn write_json_pretty_atomic<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }
  let tmp = tmp_path(path);
  {
    let mut f = fs::File::create(&tmp)?;
    let s = serde_json::to_string_pretty(value)?;
    f.write_all(s.as_bytes())?;
    f.write_all(b"\n")?;
    f.sync_all()?;
  }
  fs::rename(tmp, path)?;
  Ok(())
}

pub fn copy_file_atomic(src: &Path, dst: &Path) -> AppResult<()> {
  if let Some(parent) = dst.parent() {
    fs::create_dir_all(parent)?;
  }
  let tmp = tmp_path(dst);
  fs::copy(src, &tmp)?;
  fs::rename(tmp, dst)?;
  Ok(())
}

pub fn copy_dir_recursive(src: &Path, dst: &Path) -> AppResult<()> {
  if !src.exists() {
    return Err(AppError::NotFound(format!(
      "Source directory not found: {}",
      src.display()
    )));
  }
  fs::create_dir_all(dst)?;
  for entry in fs::read_dir(src)? {
    let entry = entry?;
    let from = entry.path();
    let to = dst.join(entry.file_name());
    let ft = entry.file_type()?;
    if ft.is_dir() {
      copy_dir_recursive(&from, &to)?;
    } else if ft.is_file() {
      copy_file_atomic(&from, &to)?;
    }
  }
  Ok(())
}

fn tmp_path(path: &Path) -> PathBuf {
  let mut p = path.to_path_buf();
  let ext = match path.extension().and_then(|e| e.to_str()) {
    Some(e) => format!("{e}.tmp"),
    None => "tmp".to_string(),
  };
  p.set_extension(ext);
  p
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde::Serialize;

  #[derive(Debug, Serialize)]
  #[serde(rename_all = "camelCase")]
  struct Demo {
    id: String,
    created_at: String,
    scene_ids: Vec<String>,
  }

  #[test]
  fn json_write_is_stable_and_newline_terminated() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("demo.json");
    let v = Demo {
      id: "a".to_string(),
      created_at: "2026-03-04T00:00:00Z".to_string(),
      scene_ids: vec!["x".to_string(), "y".to_string()],
    };

    write_json_pretty_atomic(&p, &v).unwrap();
    let first = fs::read_to_string(&p).unwrap();
    write_json_pretty_atomic(&p, &v).unwrap();
    let second = fs::read_to_string(&p).unwrap();

    assert_eq!(first, second);
    assert!(second.ends_with('\n'));
  }
}
