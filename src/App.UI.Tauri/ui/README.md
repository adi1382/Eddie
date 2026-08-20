<!-- eddie_source_header
  This file is part of Eddie/AirVPN software.
  Copyright (C)2014-2026 AirVPN (support@airvpn.org) / https://airvpn.org

  Eddie is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.
  eddie_source_header -->

# Eddie Tauri UI

Static web front end for the Eddie VPN Tauri v2 application.

## File Layout

```
ui/
├── index.html          Entry point (loaded by Tauri as frontendDist)
├── style.css           All styles (dark/light via prefers-color-scheme)
├── README.md           This file
└── src/
    ├── main.js         App entry — wires events, state, and router
    ├── tauri.js        Tauri API wrapper (falls back to mock in browser)
    ├── state.js        Central state store with pub/sub
    ├── router.js       Tab-based page router (a11y: role=tablist)
    ├── dom.js          Safe DOM helpers (no innerHTML)
    ├── format.js       Formatting utilities
    ├── overview.js     Overview/connect page
    ├── servers.js      Server list page
    ├── areas.js        Countries/areas page
    ├── logs.js         Live log viewer
    ├── stats.js        Stats key/value display
    ├── preferences.js  Options editor
    └── about.js        About/version page
```

## Development in a Browser

Open `index.html` directly in any browser (or via a local HTTP server):

```sh
# From this directory:
python3 -m http.server 8080
# Then open http://localhost:8080
```

When `window.__TAURI__` is not present, `tauri.js` provides a mock backend
that returns plausible data and simulates connect/disconnect. No build step
or network access is required.

## Design Principles

- **No build step** — plain ES modules, no bundler/transpiler needed.
- **CSP safe** — no inline scripts/handlers, no eval, no innerHTML with
  untrusted data. All dynamic content uses `document.createElement` +
  `textContent`.
- **Accessible** — keyboard-navigable tabs, ARIA roles, visible focus,
  screen-reader live regions.
- **Dark/light** — automatic via `prefers-color-scheme`.
- **Sensitive data** — options containing "password"/"key"/"access_key"
  are rendered as password inputs and never logged.
