# Eddie Repository Instructions

## Active macOS Objective

The active repository objective is the complete Eddie macOS Tauri implementation described in [the implementation plan](../docs/macos-tauri/implementation-plan.md).

When a request says to read the instructions and perform all necessary actions, treat it as authorization to execute that plan end to end. This is an implementation task, not a request for another plan, audit, or mockup.

Use the seven files in [the visual reference set](../docs/macos-tauri/reference/README.md) as the visual source of truth. Use `src/App.Cocoa.MacOS/` and the shared legacy UI code as the behavioral source of truth.

## Execution

- Start from the latest `master`; do not import deleted feature branches.
- Use Claude Opus 5 with maximum reasoning and maximum context for the parent session and every delegated session.
- Delegate independent UI, engine protocol, native integration, packaging, and QA work in parallel, but keep file ownership disjoint and integrate the results.
- Begin editing once the controlling code paths and focused checks are known. Do not stop after analysis.
- Continue through implementation, focused tests, visual comparison, macOS builds where available, commits, and a pull request targeting `master`.
- If the environment cannot perform a macOS-only validation, finish all implementation possible, record the exact missing check, and provide its command. Never claim an unavailable check passed.

## Product Constraints

- Preserve the compact Cocoa Eddie information architecture and workflows. Tauri is an implementation detail, not a redesign license.
- Keep VPN policy, session state, providers, settings, Network Lock, and elevated operations in the existing .NET engine.
- Keep the Rust layer responsible for process supervision, validated IPC, and native desktop integration.
- Keep the web layer responsible for presentation and interaction only; never retain plaintext credentials in frontend state or logs.
- Do not introduce a sidebar, dashboard cards, marketing composition, oversized typography, decorative gradients, placeholder controls, or a generic administration UI.
- Do not remove advanced Eddie capabilities to simplify implementation.

## Validation

- Add focused tests with each behavior change and run the narrowest useful check immediately after editing.
- Run the Rust workspace tests, affected .NET builds/tests, frontend tests, protocol integration tests, and visual regression checks before completion.
- Validate engine loss, reconnect, clean shutdown, Network Lock cleanup, and child-process cleanup.
- Validate arm64, x86_64, embedded bundle contents, Universal 2 slices, signing, and notarization whenever the required macOS tools and credentials are available.
