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

//! Supervision of the engine child process (`Eddie-CLI --jsoninout`).

use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::Value;

use crate::client::EngineClient;
use crate::error::EngineError;
use crate::protocol;

/// Names of the engine executable, in lookup order.
const ENGINE_NAMES: [&str; 2] = ["Eddie-CLI", "eddie-cli"];

/// Directories, relative to the UI executable, where the engine is deployed.
///
/// - `.` is the macOS bundle layout (`Eddie.app/Contents/MacOS`) and the
///   Windows/Linux portable layout, where UI and CLI live side by side.
/// - `../Resources` and `../../Resources` cover the bundle variants where the
///   CLI is shipped as a bundle resource.
const ENGINE_RELATIVE_DIRS: [&str; 3] = [".", "../Resources", "../../Resources"];

/// Environment variable used to override the engine path (development, tests).
pub const ENGINE_PATH_ENV: &str = "EDDIE_ENGINE_PATH";

/// Looks for the engine executable shipped next to the UI executable.
///
/// `EDDIE_ENGINE_PATH`, when set to an existing file, always wins.
pub fn locate_engine(exe_dir: &Path) -> Option<PathBuf> {
    if let Some(path) = std::env::var_os(ENGINE_PATH_ENV) {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Some(path);
        }
    }

    for dir in ENGINE_RELATIVE_DIRS {
        for name in ENGINE_NAMES {
            let candidate = exe_dir.join(dir).join(name);
            if candidate.is_file() {
                // Canonicalize to remove the `..` components, keeping the path
                // readable in logs and stable for the child working directory.
                return Some(candidate.canonicalize().unwrap_or(candidate));
            }
        }
    }

    None
}

/// A running engine and its client.
pub struct EngineProcess {
    child: Child,
    client: EngineClient,
}

impl EngineProcess {
    /// Starts the engine and the thread reading its messages.
    ///
    /// `on_event` receives every unsolicited message (logs, status, ...) and
    /// `on_close` is called once the engine output ends, whatever the reason.
    pub fn start<F, C>(
        path: &Path,
        extra_args: &[String],
        on_event: F,
        on_close: C,
    ) -> Result<Self, EngineError>
    where
        F: FnMut(Value) + Send + 'static,
        C: FnOnce() + Send + 'static,
    {
        let mut command = Command::new(path);
        command
            .arg("--jsoninout")
            .args(extra_args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            // The engine writes diagnostics of the tools it drives on stderr;
            // they are not part of the protocol, let them reach the parent.
            .stderr(Stdio::inherit());

        if let Some(dir) = path.parent() {
            command.current_dir(dir);
        }

        let mut child = command.spawn()?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| EngineError::Protocol("engine stdin not available".to_string()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| EngineError::Protocol("engine stdout not available".to_string()))?;

        let client = EngineClient::new(stdin);
        client.start_reader_with_close(BufReader::new(stdout), on_event, on_close);

        Ok(EngineProcess { child, client })
    }

    /// Client bound to this engine.
    pub fn client(&self) -> &EngineClient {
        &self.client
    }

    /// Asks the engine to exit, then waits for it, killing it as a last resort.
    ///
    /// The engine shuts the VPN session down cleanly (and restores the network
    /// lock) only if it exits by itself, so the kill is a fallback.
    pub fn shutdown(&mut self, timeout: Duration) {
        let _ = self.client.send(&protocol::command("exit"));
        // Stops the blocking stdin reader thread of the engine.
        let _ = self.client.send(&protocol::command("engine.stdin.stop"));

        let deadline = Instant::now() + timeout;
        loop {
            match self.child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) => {
                    if Instant::now() >= deadline {
                        let _ = self.child.kill();
                        let _ = self.child.wait();
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(_) => break,
            }
        }

        self.client.close();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "eddie-engine-test-{}-{}",
                name,
                std::process::id()
            ));
            let _ = std::fs::remove_dir_all(&path);
            std::fs::create_dir_all(&path).unwrap();
            TempDir(path)
        }

        fn file(&self, relative: &str) -> PathBuf {
            let path = self.0.join(relative);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, b"#!/bin/sh\n").unwrap();
            path
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn engine_is_found_next_to_the_ui() {
        let dir = TempDir::new("sibling");
        dir.file("Contents/MacOS/Eddie-CLI");

        let found = locate_engine(&dir.0.join("Contents/MacOS")).unwrap();
        assert!(found.ends_with("Eddie-CLI"));
    }

    #[test]
    fn engine_is_found_in_resources() {
        let dir = TempDir::new("resources");
        dir.file("Contents/MacOS/Eddie");
        dir.file("Contents/Resources/eddie-cli");

        let found = locate_engine(&dir.0.join("Contents/MacOS")).unwrap();
        assert!(found.ends_with("eddie-cli"));
    }

    #[test]
    fn missing_engine_is_reported() {
        let dir = TempDir::new("missing");
        assert!(locate_engine(&dir.0).is_none());
    }
}
