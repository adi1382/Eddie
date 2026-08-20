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

//! Tauri shell of the Eddie user interface.
//!
//! The window only renders: every feature is implemented by the engine
//! (`Eddie-CLI --jsoninout`), which this process starts as a child and drives
//! through the NDJSON protocol. Engine messages are forwarded to the web view
//! as `engine://message` events.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use eddie_engine::{locate_engine, protocol, EngineError, EngineProcess};
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};

/// Event carrying an engine message to the web view.
const EVENT_MESSAGE: &str = "engine://message";
/// Event carrying the engine lifecycle to the web view.
const EVENT_STATE: &str = "engine://state";

/// Maximum time waited for a reply. Some commands (a support report, a
/// providers refresh) legitimately need several seconds.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
/// Maximum time given to the engine to exit cleanly.
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(20);

/// State of the engine, as seen by the user interface.
#[derive(Clone, Copy, Debug, Serialize)]
pub struct EngineState {
    /// The engine process is alive.
    pub running: bool,
    /// The engine already sent its boot message (`ui.boot`).
    pub booted: bool,
}

pub struct AppState {
    engine: Mutex<Option<EngineProcess>>,
    booted: Arc<AtomicBool>,
}

impl AppState {
    fn new() -> Self {
        AppState {
            engine: Mutex::new(None),
            booted: Arc::new(AtomicBool::new(false)),
        }
    }

    fn state(&self) -> EngineState {
        let running = self
            .engine
            .lock()
            .unwrap()
            .as_ref()
            .map(|engine| engine.client().is_running())
            .unwrap_or(false);

        EngineState {
            running,
            booted: running && self.booted.load(Ordering::SeqCst),
        }
    }
}

/// Validates a message coming from the web view.
///
/// Only JSON objects with a `command` string are accepted, and the `callback`
/// key is reserved: the correlation identifier is assigned by this process, a
/// caller supplied one would hijack another pending request.
fn sanitize_command(command: Value) -> Result<Value, String> {
    let mut command = match command {
        Value::Object(_) => command,
        _ => return Err("a command must be a JSON object".to_string()),
    };

    if protocol::command_name(&command).unwrap_or("").is_empty() {
        return Err("a command must have a non empty 'command' name".to_string());
    }

    if let Some(map) = command.as_object_mut() {
        map.remove(protocol::KEY_CALLBACK);
    }

    Ok(command)
}

fn engine_error(err: EngineError) -> String {
    err.to_string()
}

/// Sends a command to the engine, without waiting for a reply.
#[tauri::command]
async fn engine_send(state: State<'_, AppState>, command: Value) -> Result<(), String> {
    let command = sanitize_command(command)?;

    let client = {
        let guard = state.engine.lock().unwrap();
        match guard.as_ref() {
            Some(engine) => engine.client().clone(),
            None => return Err(engine_error(EngineError::NotRunning)),
        }
    };

    client.send(&command).map_err(engine_error)
}

/// Sends a command to the engine and returns its reply.
#[tauri::command]
async fn engine_request(state: State<'_, AppState>, command: Value) -> Result<Value, String> {
    let command = sanitize_command(command)?;

    let client = {
        let guard = state.engine.lock().unwrap();
        match guard.as_ref() {
            Some(engine) => engine.client().clone(),
            None => return Err(engine_error(EngineError::NotRunning)),
        }
    };

    // The reply arrives on the reader thread: never block the async runtime.
    tauri::async_runtime::spawn_blocking(move || client.request(&command, REQUEST_TIMEOUT))
        .await
        .map_err(|err| err.to_string())?
        .map_err(engine_error)
}

/// Returns the current engine state.
#[tauri::command]
async fn engine_state(state: State<'_, AppState>) -> Result<EngineState, String> {
    Ok(state.state())
}

/// Starts the engine and forwards its messages to the web view.
fn start_engine(app: &AppHandle) -> Result<(), String> {
    let exe_dir = std::env::current_exe()
        .map_err(|err| format!("unable to locate the application: {err}"))?
        .parent()
        .map(|dir| dir.to_path_buf())
        .ok_or_else(|| "unable to locate the application directory".to_string())?;

    let engine_path = locate_engine(&exe_dir).ok_or_else(|| {
        format!(
            "the Eddie engine (Eddie-CLI) was not found next to the application in '{}'",
            exe_dir.display()
        )
    })?;

    let state = app.state::<AppState>();
    let booted = Arc::clone(&state.booted);
    let handle = app.clone();

    let engine = EngineProcess::start(&engine_path, &[], move |message| {
        if protocol::command_name(&message) == Some("ui.boot") {
            booted.store(true, Ordering::SeqCst);
            let _ = handle.emit(
                EVENT_STATE,
                EngineState {
                    running: true,
                    booted: true,
                },
            );
        }

        let _ = handle.emit(EVENT_MESSAGE, message);
    })
    .map_err(engine_error)?;

    *state.engine.lock().unwrap() = Some(engine);

    let _ = app.emit(
        EVENT_STATE,
        EngineState {
            running: true,
            booted: false,
        },
    );

    Ok(())
}

/// Stops the engine, giving it the time to close the VPN session cleanly.
fn stop_engine(app: &AppHandle) {
    let state = app.state::<AppState>();
    let engine = state.engine.lock().unwrap().take();

    if let Some(mut engine) = engine {
        engine.shutdown(SHUTDOWN_TIMEOUT);
    }

    state.booted.store(false, Ordering::SeqCst);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            engine_send,
            engine_request,
            engine_state
        ])
        .setup(|app| {
            if let Err(err) = start_engine(app.handle()) {
                // The window is shown anyway: it reports the failure to the
                // user instead of exiting silently.
                eprintln!("Eddie: {err}");
                let _ = app.handle().emit(
                    EVENT_STATE,
                    EngineState {
                        running: false,
                        booted: false,
                    },
                );
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while starting the Eddie user interface");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            stop_engine(handle);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn commands_must_be_named_objects() {
        assert!(sanitize_command(json!("mainaction.connect")).is_err());
        assert!(sanitize_command(json!([])).is_err());
        assert!(sanitize_command(json!({})).is_err());
        assert!(sanitize_command(json!({ "command": "" })).is_err());
        assert!(sanitize_command(json!({ "command": 42 })).is_err());
    }

    #[test]
    fn callback_supplied_by_the_web_view_is_dropped() {
        let command = sanitize_command(json!({
            "command": "ui.servers.list",
            "callback": "1",
            "filter": "nl"
        }))
        .unwrap();

        assert_eq!(
            command,
            json!({ "command": "ui.servers.list", "filter": "nl" })
        );
    }
}
