pub mod api;
pub mod auth;
pub mod pulls;
pub mod repos;
pub mod update;

/// Convert a snake_case string to camelCase.
fn snake_to_camel(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut capitalize = false;
    for c in s.chars() {
        if c == '_' {
            capitalize = true;
        } else if capitalize {
            result.push(c.to_ascii_uppercase());
            capitalize = false;
        } else {
            result.push(c);
        }
    }
    result
}

/// Recursively convert all JSON object keys from snake_case to camelCase.
pub(crate) fn keys_snake_to_camel(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(map) => {
            let keys: Vec<String> = map.keys().cloned().collect();
            for key in keys {
                if let Some(v) = map.remove(&key) {
                    let new_key = snake_to_camel(&key);
                    let mut v = v;
                    keys_snake_to_camel(&mut v);
                    map.insert(new_key, v);
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                keys_snake_to_camel(item);
            }
        }
        _ => {}
    }
}

/// Read a reqwest response body as text, convert keys to camelCase, then deserialize.
pub(crate) async fn parse_github_response<T: serde::de::DeserializeOwned>(
    resp: reqwest::Response,
) -> Result<T, String> {
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("GitHub API error ({}): {}", status, text));
    }

    let mut json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Invalid JSON from GitHub: {}", e))?;

    keys_snake_to_camel(&mut json);

    serde_json::from_value(json).map_err(|e| format!("Failed to parse GitHub response: {}", e))
}
