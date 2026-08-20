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
 * Servers page — sortable/filterable table.
 */

import { el, clear, $ } from './dom.js';
import { getState, subscribe } from './state.js';
import { invoke } from './tauri.js';

let container, tableBody, filterInput, countEl;
let unsub;
let sortCol = 'name';
let sortAsc = true;
let selectedCodes = new Set();

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'country_name', label: 'Country' },
  { key: 'location', label: 'Location' },
  { key: 'ping', label: 'Latency' },
  { key: 'load_perc', label: 'Load %' },
  { key: 'users', label: 'Users' },
  { key: 'score', label: 'Score' },
  { key: 'user_list', label: 'List' },
];

export function init(root) {
  container = root;
  container.classList.add('page-servers');

  // Toolbar
  const toolbar = el('div', { cls: 'toolbar' });
  filterInput = el('input', { attrs: { type: 'text', placeholder: 'Filter servers...', 'aria-label': 'Filter servers' } });
  filterInput.addEventListener('input', renderTable);

  const refreshBtn = el('button', { text: 'Refresh', attrs: { 'aria-label': 'Refresh server list' } });
  refreshBtn.addEventListener('click', () => invoke('engine_send', { command: { command: 'servers.refresh' } }));

  const connectBtn = el('button', { text: 'Connect', attrs: { 'aria-label': 'Connect to selected server' } });
  connectBtn.addEventListener('click', connectSelected);

  const allowBtn = el('button', { text: 'Allowlist', attrs: { 'aria-label': 'Add to allowlist' } });
  allowBtn.addEventListener('click', () => setList('allowlist'));
  const denyBtn = el('button', { text: 'Denylist', attrs: { 'aria-label': 'Add to denylist' } });
  denyBtn.addEventListener('click', () => setList('denylist'));
  const noneBtn = el('button', { text: 'Undefine', attrs: { 'aria-label': 'Remove from list' } });
  noneBtn.addEventListener('click', () => setList('none'));

  countEl = el('span', { cls: 'server-count' });

  toolbar.appendChild(filterInput);
  toolbar.appendChild(refreshBtn);
  toolbar.appendChild(connectBtn);
  toolbar.appendChild(allowBtn);
  toolbar.appendChild(denyBtn);
  toolbar.appendChild(noneBtn);
  toolbar.appendChild(countEl);
  container.appendChild(toolbar);

  // Table
  const table = el('table', { cls: 'data-table', attrs: { 'aria-label': 'Server list' } });
  const thead = el('thead');
  const headRow = el('tr');
  for (const col of columns) {
    const th = el('th', { text: col.label, attrs: { 'aria-sort': 'none', tabindex: '0', 'data-col': col.key } });
    th.addEventListener('click', () => toggleSort(col.key));
    th.addEventListener('keydown', (e) => { if (e.key === 'Enter') toggleSort(col.key); });
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);
  tableBody = el('tbody');
  table.appendChild(tableBody);
  container.appendChild(table);
}

function toggleSort(col) {
  if (sortCol === col) { sortAsc = !sortAsc; }
  else { sortCol = col; sortAsc = true; }
  renderTable();
}

function getFiltered() {
  const filter = filterInput ? filterInput.value.toLowerCase() : '';
  let servers = getState().servers || [];
  if (filter) {
    servers = servers.filter(s =>
      s.name.toLowerCase().includes(filter) ||
      s.country_name.toLowerCase().includes(filter) ||
      s.location.toLowerCase().includes(filter)
    );
  }
  servers = [...servers].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });
  return servers;
}

function renderTable() {
  const servers = getFiltered();
  clear(tableBody);
  countEl.textContent = servers.length + ' servers';
  for (const s of servers) {
    const tr = el('tr', { cls: selectedCodes.has(s.code) ? 'selected' : '' });
    tr.dataset.code = s.code;
    for (const col of columns) {
      const td = el('td', { text: String(s[col.key] != null ? s[col.key] : '') });
      if (col.key === 'load_perc' && s.load_color) td.classList.add('load--' + s.load_color);
      tr.appendChild(td);
    }
    tr.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (selectedCodes.has(s.code)) selectedCodes.delete(s.code);
        else selectedCodes.add(s.code);
      } else {
        selectedCodes.clear();
        selectedCodes.add(s.code);
      }
      renderTable();
    });
    tr.addEventListener('dblclick', () => {
      invoke('engine_send', { command: { command: 'servers.connect', code: s.code } });
    });
    tableBody.appendChild(tr);
  }
}

function connectSelected() {
  if (selectedCodes.size === 1) {
    const code = selectedCodes.values().next().value;
    invoke('engine_send', { command: { command: 'servers.connect', code } });
  }
}

function setList(list) {
  if (selectedCodes.size === 0) return;
  invoke('engine_send', { command: { command: 'servers.userlist', codes: [...selectedCodes], list } });
}

export function activate() {
  unsub = subscribe(renderTable);
  renderTable();
}

export function deactivate() {
  if (unsub) unsub();
}
