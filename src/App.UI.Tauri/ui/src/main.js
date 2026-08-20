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
 * Application entry point — wires Tauri events to state and router.
 */

import { invoke, listen } from './tauri.js';
import { getState, setState, addLog, setStat, setOption } from './state.js';
import { registerPage, initRouter, navigate } from './router.js';
import { fetchServers, fetchAreas } from './data.js';
import * as overview from './overview.js';
import * as servers from './servers.js';
import * as areas from './areas.js';
import * as logs from './logs.js';
import * as stats from './stats.js';
import * as preferences from './preferences.js';
import * as about from './about.js';

function handleEngineMessage(msg) {
  if (!msg || !msg.command) return;

  switch (msg.command) {
    case 'ui.boot':
      setState({
        engineBooted: true,
        manifest: msg.manifest || null,
        mainStatus: msg.main_status || null,
        options: msg.options || {},
        optionSchema: (msg.manifest && msg.manifest.options) || [],
        paths: msg.path || {},
        netlockModes: msg.netlock_modes || [],
      });
      if (msg.logs) {
        for (const l of msg.logs) addLog(l);
      }
      // Fetch initial data
      fetchServers(true);
      fetchAreas(true);
      break;

    case 'ui.manifest':
      setState({
        manifest: msg,
        optionSchema: msg.options || getState().optionSchema,
      });
      break;

    case 'ui.main-status':
      setState({ mainStatus: msg });
      break;

    case 'ui.status':
      // Window title, as the legacy user interfaces do.
      document.title = msg.full || msg.short || 'Eddie';
      break;

    case 'log':
      addLog(msg);
      break;

    case 'ui.stats.change':
      setStat(msg.key, msg.value);
      break;

    case 'option.change':
      setOption(msg.name, msg.value);
      break;

    case 'ui.notification':
      // Show as log for now
      addLog({ type: msg.level || 'info', message: msg.message, date: new Date().toISOString() });
      break;

    case 'ui.servers.updated':
      fetchServers();
      break;

    case 'ui.areas.updated':
      fetchAreas();
      break;

    case 'ui.frontmessage':
      if (msg.message) {
        const fm = getState().frontMessages.concat([msg.message]);
        setState({ frontMessages: fm });
      }
      break;

    case 'engine.shutdown':
      setState({ engineRunning: false, engineBooted: false });
      break;
  }
}

async function init() {
  // Register pages
  registerPage('overview', 'Overview', overview);
  registerPage('servers', 'Servers', servers);
  registerPage('areas', 'Countries', areas);
  registerPage('logs', 'Logs', logs);
  registerPage('stats', 'Stats', stats);
  registerPage('preferences', 'Preferences', preferences);
  registerPage('about', 'About', about);

  // Initialize router
  const tabList = document.getElementById('tab-list');
  const content = document.getElementById('content');
  initRouter(tabList, content);

  // Navigate to first page
  navigate('overview');

  // Listen to engine events
  listen('engine://message', (e) => {
    handleEngineMessage(e.payload);
  });

  listen('engine://state', (e) => {
    setState({
      engineRunning: e.payload.running,
      engineBooted: e.payload.booted,
    });
  });

  // Check engine state and request boot
  const engineState = await invoke('engine_state');
  if (engineState) {
    setState({ engineRunning: engineState.running, engineBooted: engineState.booted });
  }

  // Request boot data
  invoke('engine_send', { command: { command: 'ui.boot.request' } });
}

init();
