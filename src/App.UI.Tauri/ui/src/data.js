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

/**
 * Lists fetched on demand from the engine (servers and countries).
 *
 * Both lists can be big (thousands of servers) and the engine signals every
 * change (a latency test is enough), so the refetch is throttled: at most one
 * every THROTTLE_MS, with the skipped one replayed at the end of the window.
 */

import { setState } from './state.js';
import { invoke } from './tauri.js';

const THROTTLE_MS = 3000;

const lists = {
  servers: { command: 'ui.servers.list', key: 'servers', last: 0, timer: null },
  areas: { command: 'ui.areas.list', key: 'areas', last: 0, timer: null },
};

async function load(entry) {
  entry.last = Date.now();
  const reply = await invoke('engine_request', { command: { command: entry.command } });
  if (reply && Array.isArray(reply[entry.key])) {
    setState({ [entry.key]: reply[entry.key] });
  }
}

function fetchList(entry, force) {
  if (force) {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    return load(entry);
  }

  const elapsed = Date.now() - entry.last;
  if (elapsed >= THROTTLE_MS) {
    return load(entry);
  }

  // Already fetched recently: schedule the refresh once, at the end of the window.
  if (entry.timer === null) {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      load(entry);
    }, THROTTLE_MS - elapsed);
  }

  return Promise.resolve();
}

/** Refreshes the server list. `force` bypasses the throttle. */
export function fetchServers(force = false) {
  return fetchList(lists.servers, force);
}

/** Refreshes the country list. `force` bypasses the throttle. */
export function fetchAreas(force = false) {
  return fetchList(lists.areas, force);
}
