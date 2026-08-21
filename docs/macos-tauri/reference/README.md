# Eddie macOS Visual Reference Set

These images are the exact screenshots supplied for the Tauri implementation. Compare the Eddie application window, not the surrounding VS Code or browser content.

| File | Required state |
| --- | --- |
| `01-overview-disconnected.png` | Logged-in Overview, disconnected, network exposed, red Network Lock lamp |
| `02-overview-network-lock.png` | Logged-in Overview, disconnected, Network Lock active, green lamp |
| `03-servers-connecting.png` | Servers table during connection, transition header, flags, score, latency, status, load, side actions, scoring controls |
| `04-countries-connecting.png` | Countries table during connection, transition header, flags, server counts, status/load, users, list actions |
| `05-speed-connecting.png` | Speed tab during connection, dark chart, grid, upload/download labels, resolution control |
| `06-stats-connecting.png` | Dense statistics icon/key/value table |
| `07-logs-connecting.png` | Dense dated log table with severity icons and side actions |

Visual requirements derived from the set:

- Preserve the thin state header and compact centered tab strip.
- Preserve table density, restrained spacing, native text sizing, and fixed tool columns.
- Treat blue, red/pink, yellow, and green as semantic connection-state colors, not decoration.
- Preserve the overview's directness: identity, credentials, one primary connection action, and one Network Lock action.
- Do not reproduce the captured desktop background inside the application.
- Do not infer that clipped text is desirable; retain dense columns while supporting resizing, tooltips, and accessible full values.

The legacy source remains authoritative for states and interactions not visible in these images. Required supplemental regression states are connected Overview, disconnecting, recoverable error, fatal error, engine unavailable, empty tables, loading, Preferences, Providers, About, and light appearance.
