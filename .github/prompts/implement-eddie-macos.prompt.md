---
name: "Implement Eddie macOS Tauri"
description: "Execute the complete screenshot-faithful Eddie macOS Tauri implementation, embedded engine, Universal 2 packaging, and validation"
agent: "agent"
model: "Claude Opus 5 (copilot)"
---

Read and obey [the repository instructions](../copilot-instructions.md), then execute [the Eddie macOS implementation plan](../../docs/macos-tauri/implementation-plan.md) in full.

Use Claude Opus 5 with maximum reasoning and maximum context for this session and every delegated session. Use the files listed in [the reference manifest](../../docs/macos-tauri/reference/README.md) as attached visual requirements.

This is an implementation task. Do not return another plan as the deliverable. Inspect the current `master`, launch parallel implementation sessions with disjoint ownership, edit the code, integrate all work, run every available validation, capture comparison screenshots, commit the result, and open a pull request against `master`.

Do not stop with placeholders, partial controls, an unembedded UI shell, or architecture-specific release scripts presented as a complete single application. Continue until the definition of done in the implementation plan is satisfied or a genuinely external requirement such as unavailable signing credentials is the only remaining blocker.
