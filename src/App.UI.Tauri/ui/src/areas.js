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
 * Countries/Areas page.
 */

import { el, clear } from './dom.js';
import { getState, subscribe } from './state.js';
import { invoke } from './tauri.js';
import { fetchAreas, fetchServers } from './data.js';

let container, tableBody;
let unsub;
let selectedCodes = new Set();
let sortCol = 'name';
let sortAsc = true;

const columns = [
  { key: 'name', label: 'Country' },
  { key: 'servers', label: 'Servers' },
  { key: 'users', label: 'Users' },
  { key: 'load_perc', label: 'Load %' },
  { key: 'user_list', label: 'List' },
];

export function init(root) {
  container = root;
  container.classList.add('page-areas');

  const toolbar = el('div', { cls: 'toolbar' });
  const allowBtn = el('button', { text: 'Allowlist', attrs: { 'aria-label': 'Add to allowlist' } });
  allowBtn.addEventListener('click', () => setList('allowlist'));
  const denyBtn = el('button', { text: 'Denylist', attrs: { 'aria-label': 'Add to denylist' } });
  denyBtn.addEventListener('click', () => setList('denylist'));
  const noneBtn = el('button', { text: 'Undefine', attrs: { 'aria-label': 'Remove from list' } });
  noneBtn.addEventListener('click', () => setList('none'));
  toolbar.appendChild(allowBtn);
  toolbar.appendChild(denyBtn);
  toolbar.appendChild(noneBtn);
  container.appendChild(toolbar);

  const table = el('table', { cls: 'data-table', attrs: { 'aria-label': 'Area list' } });
  const thead = el('thead');
  const headRow = el('tr');
  for (const col of columns) {
    const th = el('th', { text: col.label, attrs: { tabindex: '0', 'data-col': col.key } });
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
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = true; }
  renderTable();
}

function renderTable() {
  let areas = getState().areas || [];
  areas = [...areas].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });
  clear(tableBody);
  for (const a of areas) {
    const tr = el('tr', { cls: selectedCodes.has(a.code) ? 'selected' : '' });
    for (const col of columns) {
      tr.appendChild(el('td', { text: String(a[col.key] != null ? a[col.key] : '') }));
    }
    tr.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (selectedCodes.has(a.code)) selectedCodes.delete(a.code);
        else selectedCodes.add(a.code);
      } else {
        selectedCodes.clear();
        selectedCodes.add(a.code);
      }
      renderTable();
    });
    tableBody.appendChild(tr);
  }
}

function setList(list) {
  if (selectedCodes.size === 0) return;
  invoke('engine_send', { command: { command: 'areas.userlist', codes: [...selectedCodes], list } })
    .then(() => { fetchAreas(true); fetchServers(true); });
}

export function activate() {
  unsub = subscribe(renderTable);
  renderTable();
  fetchAreas();
}

export function deactivate() {
  if (unsub) unsub();
}
