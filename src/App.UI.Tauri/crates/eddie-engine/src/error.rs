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

use std::fmt;

/// Errors raised while talking with the engine.
#[derive(Debug)]
pub enum EngineError {
    /// The engine is not running (never started, or already terminated).
    NotRunning,
    /// A reply did not arrive within the expected time.
    Timeout,
    /// I/O failure on the engine pipes or while spawning it.
    Io(std::io::Error),
    /// A line received from the engine is not a valid JSON object.
    Protocol(String),
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EngineError::NotRunning => write!(f, "the Eddie engine is not running"),
            EngineError::Timeout => write!(f, "timeout while waiting for the engine reply"),
            EngineError::Io(err) => write!(f, "engine communication error: {err}"),
            EngineError::Protocol(msg) => write!(f, "engine protocol error: {msg}"),
        }
    }
}

impl std::error::Error for EngineError {}

impl From<std::io::Error> for EngineError {
    fn from(err: std::io::Error) -> Self {
        EngineError::Io(err)
    }
}

impl From<serde_json::Error> for EngineError {
    fn from(err: serde_json::Error) -> Self {
        EngineError::Protocol(err.to_string())
    }
}
