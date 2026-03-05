use serde_json::Value;

pub fn apply_placeholders(value: &mut Value, mapping: &std::collections::BTreeMap<String, String>) {
    match value {
        Value::String(s) => {
            if let Some((_k, v)) = mapping
                .iter()
                .find(|(k, _v)| s.as_str() == format!("{{{{{k}}}}}"))
            {
                if let Ok(i) = v.parse::<i64>() {
                    *value = Value::Number(i.into());
                    return;
                }
                if let Ok(f) = v.parse::<f64>() {
                    if let Some(n) = serde_json::Number::from_f64(f) {
                        *value = Value::Number(n);
                        return;
                    }
                }
                *s = v.clone();
                return;
            }

            let mut out = s.clone();
            for (k, v) in mapping {
                let token = format!("{{{{{k}}}}}");
                out = out.replace(&token, v);
            }
            *s = out;
        }
        Value::Array(arr) => {
            for v in arr {
                apply_placeholders(v, mapping);
            }
        }
        Value::Object(map) => {
            for (_k, v) in map.iter_mut() {
                apply_placeholders(v, mapping);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::collections::BTreeMap;

    #[test]
    fn replaces_string_placeholders() {
        let mut v = json!({ "prompt": "{{positive}}", "neg": "no {{negative}}", "n": "{{steps}}" });
        let mut m = BTreeMap::new();
        m.insert("positive".to_string(), "hello".to_string());
        m.insert("negative".to_string(), "bad".to_string());
        m.insert("steps".to_string(), "25".to_string());
        apply_placeholders(&mut v, &m);
        assert_eq!(v["prompt"], json!("hello"));
        assert_eq!(v["neg"], json!("no bad"));
        assert_eq!(v["n"], json!(25));
    }
}
