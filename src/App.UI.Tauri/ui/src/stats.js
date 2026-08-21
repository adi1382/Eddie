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
 * Stats page — key/value pairs from engine.
 */

import { el, clear } from './dom.js';
import { getState, subscribe } from './state.js';
import { invoke } from './tauri.js';

let container, statsContainer;
let unsub;

export function init(root) {
  container = root;
  container.classList.add('page-stats');

  const toolbar = el('div', { cls: 'toolbar' });
  const profileBtn = el('button', { text: 'Open Profile', attrs: { 'aria-label': 'Open profile directory' } });
  profileBtn.addEventListener('click', () => invoke('engine_send', { command: { command: 'ui.stats.pathprofile' } }));
  const dataBtn = el('button', { text: 'Open Data', attrs: { 'aria-label': 'Open data directory' } });
  dataBtn.addEventListener('click', () => invoke('engine_send', { command: { command: 'ui.stats.pathdata' } }));
  const appBtn = el('button', { text: 'Open App', attrs: { 'aria-label': 'Open application directory' } });
  appBtn.addEventListener('click', () => invoke('engine_send', { command: { command: 'ui.stats.pathapp' } }));
  toolbar.appendChild(profileBtn);
  toolbar.appendChild(dataBtn);
  toolbar.appendChild(appBtn);
  container.appendChild(toolbar);

  statsContainer = el('div', { cls: 'stats-grid' });
  container.appendChild(statsContainer);
}

function render() {
  const stats = getState().stats || {};
  clear(statsContainer);

  // Group by prefix (part before first uppercase letter after lowercase)
  const groups = {};
  for (const [key, value] of Object.entries(stats)) {
    const match = key.match(/^([A-Z][a-z]+)/);
    const group = match ? match[1] : 'General';
    if (!groups[group]) groups[group] = [];
    groups[group].push({ key, value });
  }

  for (const [group, items] of Object.entries(groups)) {
    const section = el('div', { cls: 'stats-group' });
    section.appendChild(el('h3', { text: group }));
    const dl = el('dl');
    for (const item of items) {
      dl.appendChild(el('dt', { text: item.key }));
      dl.appendChild(el('dd', { text: String(item.value != null ? item.value : '') }));
    }
    section.appendChild(dl);
    statsContainer.appendChild(section);
  }
}

export function activate() {
  unsub = subscribe(render);
  render();
}

export function deactivate() {
  if (unsub) unsub();
}
