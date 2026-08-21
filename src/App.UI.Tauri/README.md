# Eddie UI (Tauri edition)

Desktop user interface for Eddie, written in Rust with [Tauri 2](https://tauri.app)
and a dependency-free web front end.

The window is only a view: every feature (VPN sessions, network lock, providers,
options, logs, ...) stays in the existing engine, the `Eddie-CLI` executable
started with `--jsoninout`, which exchanges one JSON object per line on
stdin/stdout. This is the same protocol already implemented by
`Eddie.Core.ConsoleEdition.UiApp` and `Eddie.Core.UiManager`, so the Tauri UI
has the same feature set as the legacy Forms/Cocoa interfaces without
duplicating any VPN logic.

## Layout

```
src/App.UI.Tauri
├── Cargo.toml               Rust workspace
├── crates/eddie-engine      Engine client: NDJSON framing, request/reply, child process
├── src-tauri                Tauri application (window, commands, engine lifecycle)
│   ├── capabilities         Tauri permissions (core only)
│   └── tauri.conf.json      Window, CSP and bundle configuration
└── ui                       Static front end (HTML/CSS/ES modules, no build step)
```

## Architecture

```
web view  --invoke-->  Tauri commands  --NDJSON-->  Eddie-CLI --jsoninout
   ^                                                     |
   +----------  engine://message events  <---------------+
```

- `engine_send(command)`: sends a command, no reply expected.
- `engine_request(command)`: sends a command and returns the engine reply. The
  correlation identifier (`callback`) is assigned by the Rust side, never by the
  web view.
- `engine_state()`: `{ running, booted }`.
- Every unsolicited engine message (`log`, `ui.main-status`, `ui.stats.change`,
  ...) is emitted to the web view as an `engine://message` event.

The engine is started when the application starts and asked to exit when the
application exits, so a VPN session is always closed cleanly (and the network
lock restored) instead of being killed.

## Build

Requirements: [Rust](https://rustup.rs), the Tauri CLI
(`cargo install tauri-cli --version "^2"`), the .NET SDK for the engine and, on
Linux, the usual `webkit2gtk` development packages.

```bash
cd src/App.UI.Tauri
cargo test                 # engine client and command validation tests
cargo tauri dev            # development run
cargo tauri build          # release bundle for the host platform
```

The UI needs the engine next to its own executable (`Eddie-CLI` or `eddie-cli`,
also looked up in `../Resources`). During development, point it to any build
with `EDDIE_ENGINE_PATH=/path/to/Eddie-CLI cargo tauri dev`.

### macOS packages

`repository/macos_tauri/build.sh arm64` (or `x64`) builds the complete
`Eddie.app` bundle: engine, elevated helpers, VPN tools, resources and the Tauri
UI. Unlike the legacy Mono/Xamarin line, this build cross-compiles, so an
`arm64` (Apple Silicon) package can also be produced on an Intel Mac.

## Front end

See `ui/README.md`. It has no build step and no dependency: opening
`ui/index.html` in a browser runs the interface against a mock engine, which is
convenient for design and QA work.
