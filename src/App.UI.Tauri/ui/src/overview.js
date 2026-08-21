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
 * Overview / Main page — connect button, status, stats summary.
 */

import { el, clear, $ } from './dom.js';
import { getState, subscribe } from './state.js';
import { invoke } from './tauri.js';

let container;
let unsub;
let statusEl, actionBtn, statsGrid, netlockEl, frontMsgEl;

export function init(root) {
  container = root;
  container.classList.add('page-overview');

  // Status area
  statusEl = el('div', { cls: 'overview-status', attrs: { 'aria-live': 'polite' } });
  actionBtn = el('button', { cls: 'action-btn action-btn--red', text: 'Connect', attrs: { 'aria-label': 'Connect or disconnect VPN' } });
  netlockEl = el('div', { cls: 'overview-netlock' });
  statsGrid = el('div', { cls: 'overview-stats' });
  frontMsgEl = el('div', { cls: 'overview-frontmsg', attrs: { 'aria-live': 'polite' } });

  container.appendChild(statusEl);
  container.appendChild(actionBtn);
  container.appendChild(netlockEl);
  container.appendChild(statsGrid);
  container.appendChild(frontMsgEl);

  actionBtn.addEventListener('click', onAction);
}

function onAction() {
  const s = getState();
  const cmd = s.mainStatus && s.mainStatus.action_command;
  if (cmd) {
    invoke('engine_send', { command: { command: cmd } });
  }
}

export function activate() {
  unsub = subscribe(render);
  render(getState());
}

export function deactivate() {
  if (unsub) unsub();
}

function render(state) {
  const ms = state.mainStatus;
  if (ms) {
    statusEl.textContent = ms.message || '';
    actionBtn.textContent = ms.action_text || 'Connect';
    // Update button color class
    actionBtn.className = 'action-btn';
    if (ms.app_color) actionBtn.classList.add('action-btn--' + ms.app_color);
    if (!ms.action_command) {
      actionBtn.disabled = true;
    } else {
      actionBtn.disabled = false;
    }
    // Network lock indicator
    clear(netlockEl);
    if (ms.netlock) {
      netlockEl.appendChild(el('span', { cls: 'badge badge--netlock', text: 'Network Lock Active' }));
    }
  }

  // Stats summary
  clear(statsGrid);
  const keys = ['ServerName', 'ServerLocation', 'ServerLatency', 'VpnExitIPv4', 'VpnProtocol', 'VpnStart', 'VpnTotalDownload', 'VpnTotalUpload'];
  const labels = ['Server', 'Location', 'Latency', 'Exit IP', 'Protocol', 'Connected since', 'Download', 'Upload'];
  for (let i = 0; i < keys.length; i++) {
    const val = state.stats[keys[i]];
    if (val !== undefined && val !== '') {
      const item = el('div', { cls: 'stat-item', children: [
        el('span', { cls: 'stat-label', text: labels[i] }),
        el('span', { cls: 'stat-value', text: String(val) }),
      ]});
      statsGrid.appendChild(item);
    }
  }

  // Front messages
  clear(frontMsgEl);
  for (const fm of state.frontMessages) {
    const msg = el('div', { cls: 'front-message' });
    msg.appendChild(el('span', { text: fm.text || '' }));
    if (fm.link && fm.url) {
      const linkBtn = el('button', { cls: 'link-btn', text: fm.link });
      linkBtn.addEventListener('click', () => {
        invoke('engine_send', { command: { command: 'url.open', uri: fm.url } });
      });
      msg.appendChild(linkBtn);
    }
    frontMsgEl.appendChild(msg);
  }
}
