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

//! Client library for the Eddie engine.
//!
//! The engine is the existing `Eddie-CLI` executable started with `--jsoninout`:
//! it exchanges one JSON object per line (NDJSON) on stdin/stdout, the same
//! protocol already used by the C++ UI line. This crate implements the
//! transport (line framing), the request/reply correlation (the `callback` /
//! `reply` pair implemented by `Eddie.Core.UiManager`) and the supervision of
//! the engine child process.

mod client;
mod error;
mod process;
pub mod protocol;

pub use client::EngineClient;
pub use error::EngineError;
pub use process::{locate_engine, EngineProcess};
