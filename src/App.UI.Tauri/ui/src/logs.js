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
 * Logs page — live log list with severity filter.
 */

import { el, clear } from './dom.js';
import { getState, subscribe } from './state.js';
import { invoke } from './tauri.js';
import { formatDate } from './format.js';

let container, logList, filterSelect, autoScrollCheck;
let unsub;
let autoScroll = true;
let severityFilter = 'all';

const severities = ['all', 'verbose', 'info', 'infoimportant', 'warning', 'error', 'fatal', 'realtime'];

export function init(root) {
  container = root;
  container.classList.add('page-logs');

  const toolbar = el('div', { cls: 'toolbar' });

  filterSelect = el('select', { attrs: { 'aria-label': 'Filter log severity' } });
  for (const s of severities) {
    filterSelect.appendChild(el('option', { text: s, attrs: { value: s } }));
  }
  filterSelect.addEventListener('change', () => { severityFilter = filterSelect.value; renderLogs(); });

  const copyBtn = el('button', { text: 'Copy to Clipboard', attrs: { 'aria-label': 'Copy logs to clipboard' } });
  copyBtn.addEventListener('click', copyLogs);

  const reportBtn = el('button', { text: 'Support Report', attrs: { 'aria-label': 'Generate support report' } });
  reportBtn.addEventListener('click', () => invoke('engine_send', { command: { command: 'system.report.start' } }));

  const scrollLabel = el('label', { cls: 'checkbox-label', text: ' Auto-scroll' });
  autoScrollCheck = el('input', { attrs: { type: 'checkbox', checked: '' } });
  autoScrollCheck.checked = true;
  autoScrollCheck.addEventListener('change', () => { autoScroll = autoScrollCheck.checked; });
  scrollLabel.prepend(autoScrollCheck);

  toolbar.appendChild(filterSelect);
  toolbar.appendChild(copyBtn);
  toolbar.appendChild(reportBtn);
  toolbar.appendChild(scrollLabel);
  container.appendChild(toolbar);

  logList = el('div', { cls: 'log-list', attrs: { 'aria-live': 'off', role: 'log' } });
  container.appendChild(logList);
}

function renderLogs() {
  const logs = getState().logs || [];
  const filtered = severityFilter === 'all' ? logs : logs.filter(l => l.type === severityFilter);
  clear(logList);
  for (const entry of filtered) {
    const row = el('div', { cls: 'log-entry log-entry--' + (entry.type || 'info') });
    row.appendChild(el('span', { cls: 'log-time', text: formatDate(entry.date) }));
    row.appendChild(el('span', { cls: 'log-type', text: entry.type || '' }));
    row.appendChild(el('span', { cls: 'log-msg', text: entry.message || '' }));
    logList.appendChild(row);
  }
  if (autoScroll) {
    logList.scrollTop = logList.scrollHeight;
  }
}

function copyLogs() {
  const logs = getState().logs || [];
  const text = logs.map(l => `[${l.date || ''}] [${l.type || ''}] ${l.message || ''}`).join('\n');
  navigator.clipboard.writeText(text).catch(() => {});
}

export function activate() {
  unsub = subscribe(renderLogs);
  renderLogs();
}

export function deactivate() {
  if (unsub) unsub();
}
