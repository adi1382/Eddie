// <eddie_source_header>
// This file is part of Eddie/AirVPN software.
// Copyright (C)2014-2026 AirVPN (support@airvpn.org) / https://airvpn.org
//
// Eddie is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Eddie is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Eddie. If not, see <http://www.gnu.org/licenses/>.
// </eddie_source_header>

//! Framing and shape of the messages exchanged with the engine.

use serde_json::{Map, Value};

use crate::error::EngineError;

/// Key holding the command name in every message.
pub const KEY_COMMAND: &str = "command";
/// Key set on a request when a reply is expected.
pub const KEY_CALLBACK: &str = "callback";
/// Command name of the messages carrying a reply.
pub const COMMAND_REPLY: &str = "reply";

/// Builds a message with only a command name.
pub fn command(name: &str) -> Value {
    let mut map = Map::new();
    map.insert(KEY_COMMAND.to_string(), Value::String(name.to_string()));
    Value::Object(map)
}

/// Serializes a message as a single NDJSON line (terminator included).
///
/// JSON string escaping guarantees that no raw newline can appear inside the
/// payload, so one message is always exactly one line.
pub fn encode_line(message: &Value) -> Result<String, EngineError> {
    let mut line = serde_json::to_string(message)?;
    line.push('\n');
    Ok(line)
}

/// Parses one line received from the engine.
///
/// Only JSON objects are accepted: the engine never sends bare values, and
/// refusing them keeps malformed/foreign output (for example a stray print on
/// stdout) out of the UI.
pub fn parse_line(line: &str) -> Result<Value, EngineError> {
    let line = line.trim();
    if line.is_empty() {
        return Err(EngineError::Protocol("empty line".to_string()));
    }

    let value: Value = serde_json::from_str(line)?;
    if !value.is_object() {
        return Err(EngineError::Protocol(
            "message is not an object".to_string(),
        ));
    }

    Ok(value)
}

/// Returns the command name of a message, if any.
pub fn command_name(message: &Value) -> Option<&str> {
    message.get(KEY_COMMAND)?.as_str()
}

/// Returns `(callback id, body)` when the message is a reply to a request.
pub fn as_reply(message: &Value) -> Option<(String, Value)> {
    if command_name(message)? != COMMAND_REPLY {
        return None;
    }

    let id = match message.get("id")? {
        Value::String(id) => id.clone(),
        other => other.to_string(),
    };

    let body = message.get("body").cloned().unwrap_or(Value::Null);

    Some((id, body))
}

/// Marks a message as a request waiting for the reply identified by `id`.
pub fn set_callback(message: &mut Value, id: &str) -> Result<(), EngineError> {
    match message.as_object_mut() {
        Some(map) => {
            map.insert(KEY_CALLBACK.to_string(), Value::String(id.to_string()));
            Ok(())
        }
        None => Err(EngineError::Protocol(
            "request is not an object".to_string(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn encode_line_is_a_single_line() {
        let message = json!({ "command": "log", "message": "line1\nline2" });
        let line = encode_line(&message).unwrap();

        assert!(line.ends_with('\n'));
        assert_eq!(line.matches('\n').count(), 1);
        assert_eq!(parse_line(&line).unwrap(), message);
    }

    #[test]
    fn parse_line_rejects_non_objects() {
        assert!(parse_line("").is_err());
        assert!(parse_line("   ").is_err());
        assert!(parse_line("\"hello\"").is_err());
        assert!(parse_line("[1,2]").is_err());
        assert!(parse_line("not json").is_err());
        assert!(parse_line("{\"command\":\"log\"}").is_ok());
    }

    #[test]
    fn command_name_is_extracted() {
        assert_eq!(command_name(&command("exit")), Some("exit"));
        assert_eq!(command_name(&json!({})), None);
        assert_eq!(command_name(&json!({ "command": 3 })), None);
    }

    #[test]
    fn replies_are_recognized() {
        let message = json!({ "command": "reply", "id": "7", "body": { "result": "ok" } });
        let (id, body) = as_reply(&message).unwrap();

        assert_eq!(id, "7");
        assert_eq!(body, json!({ "result": "ok" }));

        // A reply without body is a valid null reply.
        let (_, body) = as_reply(&json!({ "command": "reply", "id": "8" })).unwrap();
        assert_eq!(body, Value::Null);

        // Anything else is an event.
        assert!(as_reply(&json!({ "command": "log" })).is_none());
    }

    #[test]
    fn callback_is_added_to_requests() {
        let mut message = command("ui.servers.list");
        set_callback(&mut message, "42").unwrap();

        assert_eq!(message[KEY_CALLBACK], json!("42"));
        assert!(set_callback(&mut json!([]), "42").is_err());
    }
}
