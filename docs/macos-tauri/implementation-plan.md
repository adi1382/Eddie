# Eddie macOS Tauri Implementation Plan

## Mandate

Deliver one self-contained Eddie desktop application that preserves the familiar Intel Cocoa client's compact interface and full behavior while using Tauri for the desktop shell. It must run natively on Intel and Apple Silicon, embed the existing engine and VPN toolchain, and ship as one Universal 2 macOS application when every bundled Mach-O component can be combined safely.

This plan is the authoritative implementation handoff. The prior cloud planning session did not publish a transcript or commit; this document consolidates the verified repository investigation, the user's execution prompts, and the exact visual attachments committed beside it.

This is not a request to redesign Eddie or produce another plan. Implement, validate, commit, and open a pull request.

## Sources of Truth

Priority order:

1. `docs/macos-tauri/reference/*.png` for appearance, density, layout, and visible states.
2. `src/App.Cocoa.MacOS/` for macOS behavior, menus, dialogs, status item, assets, and interaction details.
3. `src/Lib.Forms/` and `src/Lib.Forms.Skin/` for shared feature coverage and advanced workflows.
4. `src/Lib.Core/` for engine behavior and authority.
5. `src/App.UI.Tauri/` for the replacement shell and existing protocol bridge.
6. `repository/macos_*`, `deploy/macos_arm64/`, and `deploy/macos_x64/` for release behavior and bundled binaries.

Do not accept README claims as evidence of feature parity. Verify behavior in code and tests.

## Product Contract

### Visual language

- Preserve the legacy Cocoa window's compact logical dimensions and dense content.
- Use native macOS title-bar behavior and system typography.
- Reproduce the thin state header: Eddie icon at left; status, flag, warning, and lock state at right.
- Preserve state semantics: blue base, pale red exposed/error state, yellow transition state, and green connected state.
- Use the centered compact tab strip in this order: Overview, Servers, Countries, Speed, Stats, Logs.
- Match the attached dark appearance first and support system light appearance without changing information architecture.
- Reuse existing Eddie logos, flags, status lamps, tab icons, and menu-bar assets where licensing and resolution permit.
- Improve rendering sharpness, keyboard access, focus, and screen-reader semantics without making the application look like a web dashboard.

Forbidden visual changes include a sidebar, card dashboard, marketing layout, hero content, oversized headings, decorative gradients, floating sections, excessive corner radii, and placeholder or nonfunctional controls.

### Screen requirements

#### Overview

- Username/email, password, Remember, and login/logout behavior.
- AirVPN identity art without dominating the content.
- Recommended-server connect action and explanatory line.
- Network Lock activation/deactivation with red/green status lamp.
- Version in the lower-right corner.
- Distinct disconnected, locked, connecting, connected, disconnecting, recoverable-error, fatal-error, and engine-unavailable states.
- Credentials must use the engine's secure storage path; plaintext values must not enter shared frontend state, logs, local storage, or diagnostics.

#### Servers

- Dense sortable and resizable table with flag, name, score, location, latency, status lamp, load/capacity, users, and user-list state.
- Connect, allowlist, denylist, clear-list, details/more, rename where supported, and refresh actions.
- Show All, Scoring Rule, and Lock Current controls.
- Single and multi-selection, shift-range selection, keyboard operation, double-click connect, and contextual actions.
- Stable selection across benign refreshes and safe removal of selections that no longer exist.

#### Countries

- Dense sortable table with flag, country name, server count, status/load, capacity, users, and user-list state.
- Allowlist, denylist, and clear-list actions with multi-selection and keyboard parity.

#### Speed

- Real-time upload and download lines with byte totals and current rates.
- Resolution selector matching the legacy range/grid/step choices.
- Bounded samples, resize-safe rendering, device-pixel-ratio sharpness, and no long-session memory growth.
- Pause updates while hidden without losing the configured time window.

#### Stats

- Dense icon/key/value table preserving all engine-provided legacy statistics and ordering.
- Directory and URL values invoke validated native actions rather than arbitrary shell commands.

#### Logs

- Date, severity icon, and message columns with live updates and controlled auto-scroll.
- Details, copy, save, clear, support report, and advanced command actions where enabled by the legacy application.
- Severity filtering, keyboard navigation, bounded retained history, and safe handling of large messages.

### Native workflows

- Standard About, Preferences, Window, Edit, and Help application menus.
- macOS status item with disconnected, connecting, and connected imagery plus status, connect/disconnect, Network Lock, Preferences, About, restore/hide, links, and Quit actions.
- Native notifications respecting existing options.
- Preferences organized around existing legacy sections rather than one unstructured option dump.
- Provider list/add/edit/remove and OpenVPN/WireGuard/manifest workflows.
- Credential challenges, key selection, front messages, connection details, reports, text viewer, command window, updater, and recoverable errors.
- Persist window geometry and restore/hide behavior.
- One application instance and deterministic foreground activation.

## Target Architecture

```text
Static HTML/CSS/ES modules
        |
        | validated Tauri invokes and events
        v
Tauri Rust shell
  - window/menu/tray/notification ownership
  - engine child supervision
  - typed command validation
        |
        | versioned NDJSON over stdin/stdout
        v
Eddie-CLI --jsoninout
  - Lib.Core authority
  - sessions/providers/settings/stats/logs
        |
        | existing elevated IPC
        v
eddie-cli-elevated + native library + VPN tools
```

Ownership rules:

- `Lib.Core` owns VPN policy, state machines, profile persistence, providers, options, logs, stats, reports, Network Lock, and shutdown ordering.
- The Rust bridge owns child discovery/start/restart, stdin/stdout framing, request correlation, timeouts, capability negotiation, native UI integration, and event delivery.
- The web frontend owns view state, rendering, selection, filtering, sorting, graph samples, focus, and user intent.
- No layer may bypass the validated engine contract to mutate a profile or perform a privileged action.

## Current Gaps to Close

| Area | Existing Tauri state | Required result |
| --- | --- | --- |
| Overview | Generic summary view | Screenshot-faithful authentication, actions, lamps, and all connection states |
| Servers/Countries | Basic tables and list actions | Legacy columns, controls, selection, context actions, scoring, details, and refresh behavior |
| Speed | Missing | Live bounded graph and resolution control |
| Stats/Logs | Partial | Legacy density, icons, actions, ordering, filtering, and large-data behavior |
| Preferences | Flat schema rendering | Organized feature-complete settings workflows and restart/validation feedback |
| Providers | Missing | Full list/add/edit/remove flows for supported provider types |
| Authentication | Missing | Login/logout, remember mode, key selection, and asynchronous credential challenges |
| Network Lock | Indicator only | Main toggle, confirmation/error handling, settings, and lifecycle parity |
| Native macOS | Missing | Menus, status item, notifications, window persistence, dialogs, single instance |
| Engine contract | Partial | Versioned capabilities and complete request/event/error contracts |
| Packaging | Per-architecture partial script | Embedded self-contained engine/tools and validated Universal 2 release |

## Engine Protocol Work

### Envelope

Add a protocol version and capability list during boot without breaking older clients. Every request that expects a result must receive exactly one structured success or error reply.

Required properties:

- Correlation identifiers are generated in Rust and stripped from untrusted web input.
- Command names and payloads are validated before engine dispatch.
- Unknown commands and malformed payloads produce structured errors, not silent timeouts.
- Sensitive fields are marked and excluded from logging and state replay.
- Events may be coalesced for high-frequency stats but connection-state transitions may not be dropped.
- The boot snapshot is sufficient to reconstruct every view after reload or engine restart.

### Contract families

Implement and test contracts for:

- Boot, capabilities, engine state, controlled restart, graceful exit, and fatal/recoverable errors.
- Main action, explicit server connection, cancellation, disconnect, and full connection-state snapshots.
- Server and country lists, sorting metadata, user-list mutations, rename/details, refresh, scoring rule, and lock-current state.
- Authentication status, login/logout, remember mode, key selection, credential challenge/response/cancel, and secure clearing.
- Network Lock state, modes, activation/deactivation, options, warnings, and cleanup failures.
- Stats snapshot/delta, graph samples, log snapshot/append/clear/details/save, support report, and command execution.
- Option schema/value/validation/save, restart-required metadata, routes, DNS, protocols, proxy, WireGuard, directives, events, logging, and advanced options.
- Provider list/add/edit/remove/refresh/bootstrap and provider-specific schemas.
- Front messages, updater state, version information, libraries/licenses, paths, native directory/URL actions, and notifications.

Add C# command tests and Rust framing/correlation/lifecycle tests before relying on each family in the UI.

## Implementation Phases

### Phase 0: Baseline and contracts

1. Record current focused test/build commands and preserve existing behavior.
2. Add protocol fixtures representing all seven reference screens and key lifecycle states.
3. Add version/capability and structured-error support.
4. Establish secure challenge/response and engine-restart behavior.

Gate: protocol tests pass in C# and Rust; the frontend mock can replay deterministic snapshots without the engine.

### Phase 1: Visual shell and core screens

1. Rebuild the global window, state header, tabs, typography, spacing, and tokens from the references.
2. Implement Overview, Servers, Countries, Speed, Stats, and Logs against fixtures.
3. Add keyboard, focus, loading, empty, error, and engine-unavailable states.
4. Capture deterministic screenshots at the legacy logical window size in dark and light appearances.

Gate: all seven dark reference comparisons are accepted; core controls work with the mock engine; accessibility audit has no serious violations.

### Phase 2: Feature-complete engine integration

1. Wire every core screen to real engine snapshots and events.
2. Implement authentication, Network Lock, provider workflows, preferences, reports, updater, and advanced dialogs.
3. Add reconnect/replay after engine loss and validate clean shutdown ordering.

Gate: parity matrix is complete with no required placeholders; real-engine integration tests cover success, validation errors, timeout, EOF, restart, and cancellation.

### Phase 3: Native macOS integration

1. Add application menus, status item, notifications, dialogs, single-instance behavior, geometry persistence, and foreground activation.
2. Ensure close/hide/quit semantics match the Cocoa client.
3. Verify all external path and URL actions against an allowlisted native API.

Gate: manual native workflow checklist passes and quitting cannot orphan the engine, VPN child, elevated state, routes, DNS, or Network Lock.

### Phase 4: Embedded architecture builds

1. Parameterize native-library and elevated-helper builds with explicit target architecture.
2. Produce self-contained `osx-arm64` and `osx-x64` engine publications.
3. Produce Tauri arm64 and x86_64 applications.
4. Assemble complete unsigned per-architecture app trees containing the matching engine, helpers, native library, VPN tools, dylibs, locales, provider data, icons, and licenses.
5. Validate architecture and engine/tool discovery for every embedded executable.

Gate: each per-architecture app launches on matching physical hardware, connects, disconnects, toggles Network Lock, restarts, and quits cleanly without external runtimes.

### Phase 5: Universal 2, signing, and release

1. Compare the two unsigned app trees and classify files as identical data, mergeable Mach-O, or architecture-specific exceptions.
2. Combine every matching Mach-O executable and dylib using `lipo -create`; never merge scripts, configuration, or opaque data.
3. Fail the build if a required executable has only one architecture or if the trees differ unexpectedly.
4. Recompute any helper integrity manifests after final binary assembly using the repository's signing/hash order.
5. Sign nested code from the inside out, sign the final app, archive, notarize, staple where applicable, and verify Gatekeeper assessment.
6. Keep per-architecture artifacts as an explicit fallback until Universal 2 passes physical-hardware VPN tests.

Gate: `file` and `lipo -info` show both `arm64` and `x86_64` for every required Mach-O; signatures, notarization, Intel testing, Apple Silicon testing, update, and rollback all pass.

## Parallel Ownership

Run these workstreams concurrently after Phase 0 establishes contracts:

| Workstream | Primary ownership | Must not edit |
| --- | --- | --- |
| Visual frontend | `src/App.UI.Tauri/ui/` | Engine and packaging |
| Engine contracts | `src/Lib.Core/`, focused C# tests | Frontend styling and packaging |
| Rust/native shell | `src/App.UI.Tauri/crates/eddie-engine/`, `src-tauri/` | C# policy and frontend styling |
| macOS packaging | `repository/macos_*`, target-parameter build scripts | Product behavior and visual code |
| QA/fixtures | Test assets, screenshot harness, checklists | Production behavior except small testability hooks |

Integrate at each phase gate. Do not let parallel sessions implement competing protocol shapes or edit the same files independently.

## Validation Matrix

### Automated

- `cargo test --workspace` in `src/App.UI.Tauri`.
- Affected .NET project builds and focused command/serialization tests.
- Frontend state, filtering, sorting, selection, graph-window, credential-redaction, and event-replay tests.
- Mock-engine integration for every connection state and screen fixture.
- Rust process tests for missing engine, boot, request/reply, timeout, malformed output, EOF, restart, and shutdown.
- Bundle inspection that asserts required files, executable bits, architectures, minimum macOS version, identifiers, and no debug artifacts.
- Deterministic screenshot comparison for every file in the reference manifest plus light appearance, connected, error, and engine-unavailable states.

### Physical macOS

Test on Intel and Apple Silicon without relying on Rosetta for the native path:

- First launch, profile migration, login/logout, connect/cancel/disconnect, explicit server connection.
- OpenVPN and WireGuard where supported; DNS/routes restored after normal and forced exits.
- Network Lock activate/deactivate, reconnect, engine crash, UI crash, reboot recovery, and failed helper authorization.
- Status item, menus, notifications, dialogs, hide/restore, single instance, sleep/wake, network change, and update/rollback.
- Long-running stats/log/graph behavior and bounded memory.
- Rosetta launch is a compatibility check only, not a substitute for native Intel validation.

## Pull Request Evidence

The implementation pull request must include:

- A completed parity matrix with links to code/tests.
- Before/reference/after screenshots for all seven views and additional lifecycle states.
- Exact commands and outcomes for tests and builds.
- A bundle-content and architecture report.
- Physical hardware results, or an explicit unchecked list if hardware was unavailable.
- Signing/notarization evidence when credentials are available.
- Known limitations and rollback instructions; no hidden placeholders.

## Definition of Done

- The Tauri app is immediately recognizable as the attached Cocoa Eddie client.
- Every visible required control performs its real operation.
- Authentication, providers, preferences, Network Lock, servers, countries, speed, stats, logs, native menus/status item, notifications, reports, updater, and recovery workflows have parity.
- The frontend contains no VPN policy and no retained plaintext credentials.
- Engine loss is recoverable and shutdown leaves no orphaned processes, routes, DNS changes, or lock state.
- Complete embedded arm64 and x86_64 applications pass tests on matching hardware.
- The Universal 2 artifact passes architecture, signature, notarization, launch, VPN, update, and rollback validation, or a documented single-download fallback is proven when a third-party component cannot legally or technically be merged.
- All changes and evidence are committed and a pull request targets `master`.
