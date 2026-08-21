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
 * Preferences page — renders the option schema sent by the engine.
 *
 * The engine describes every option in the 'ui.boot' message: a dictionary
 * name -> { type, default, man, secret, internalonly, value }.
 */

import { el, clear } from './dom.js';
import { getState, subscribe } from './state.js';
import { invoke } from './tauri.js';
import { isSensitiveOption } from './format.js';

let container, searchInput, groupsContainer;
let unsub;

export function init(root) {
  container = root;
  container.classList.add('page-preferences');

  const toolbar = el('div', { cls: 'toolbar' });
  searchInput = el('input', { attrs: { type: 'text', placeholder: 'Search options...', 'aria-label': 'Search options' } });
  searchInput.addEventListener('input', render);
  toolbar.appendChild(searchInput);
  container.appendChild(toolbar);

  groupsContainer = el('div', { cls: 'prefs-groups' });
  container.appendChild(groupsContainer);
}

function isTrue(value) {
  return String(value).toLowerCase() === 'true';
}

function buildInput(name, option, value, sensitive) {
  const id = 'opt-' + name;
  const type = String(option.type || 'text');

  if (type === 'bool') {
    const input = el('input', { attrs: { type: 'checkbox', id: id } });
    input.checked = isTrue(value);
    input.addEventListener('change', () => sendOption(name, input.checked ? 'True' : 'False'));
    return input;
  }

  if (type.startsWith('choice:')) {
    const input = el('select', { attrs: { id: id } });
    for (const choice of type.substring('choice:'.length).split(',')) {
      const item = el('option', { text: choice, attrs: { value: choice } });
      if (choice === String(value)) item.selected = true;
      input.appendChild(item);
    }
    input.addEventListener('change', () => sendOption(name, input.value));
    return input;
  }

  const inputType = sensitive ? 'password' : (type === 'int' || type === 'float' ? 'number' : 'text');
  const input = el('input', { attrs: { type: inputType, id: id } });
  if (type === 'float') input.setAttribute('step', 'any');
  if (sensitive) {
    input.setAttribute('placeholder', '\u2022\u2022\u2022\u2022\u2022\u2022');
  } else {
    input.value = value === undefined || value === null ? '' : String(value);
  }
  input.addEventListener('change', () => sendOption(name, input.value));
  return input;
}

function render() {
  const options = getState().options || {};
  const search = searchInput ? searchInput.value.toLowerCase() : '';

  clear(groupsContainer);

  const groups = new Map();
  for (const name of Object.keys(options).sort()) {
    const option = options[name];
    if (!option || typeof option !== 'object') continue;
    if (option.internalonly === true) continue;
    if (search && !name.toLowerCase().includes(search) && !String(option.man || '').toLowerCase().includes(search)) continue;

    const group = name.indexOf('.') === -1 ? 'general' : name.split('.')[0];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(name);
  }

  for (const [group, names] of groups) {
    const section = el('fieldset', { cls: 'prefs-group' });
    section.appendChild(el('legend', { text: group }));

    for (const name of names) {
      const option = options[name];
      const sensitive = option.secret === true || String(option.type) === 'password' || isSensitiveOption(name);
      const row = el('div', { cls: 'pref-row' });
      const label = el('label', { text: name, attrs: { for: 'opt-' + name, title: String(option.man || '') } });
      row.appendChild(label);
      row.appendChild(buildInput(name, option, option.value, sensitive));
      if (option.man) row.appendChild(el('p', { cls: 'pref-man', text: String(option.man) }));
      section.appendChild(row);
    }

    groupsContainer.appendChild(section);
  }
}

function sendOption(name, value) {
  invoke('engine_send', { command: { command: 'options.set', name: name, value: value } });
}

export function activate() {
  unsub = subscribe(render);
  render();
}

export function deactivate() {
  if (unsub) unsub();
}
