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
 * Preferences page — renders option schema from the engine.
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

function render() {
  const state = getState();
  const schema = state.optionSchema || [];
  const options = state.options || {};
  const search = searchInput ? searchInput.value.toLowerCase() : '';

  clear(groupsContainer);

  // Group by option group or name prefix
  const groups = {};
  for (const opt of schema) {
    const group = opt.group || opt.name.split('.')[0] || 'general';
    if (!groups[group]) groups[group] = [];
    groups[group].push(opt);
  }

  for (const [group, opts] of Object.entries(groups)) {
    const filtered = opts.filter(o =>
      !search || o.name.toLowerCase().includes(search) || (o.text && o.text.toLowerCase().includes(search))
    );
    if (filtered.length === 0) continue;

    const section = el('fieldset', { cls: 'prefs-group' });
    section.appendChild(el('legend', { text: group }));

    for (const opt of filtered) {
      const row = el('div', { cls: 'pref-row' });
      const label = el('label', { text: opt.text || opt.name, attrs: { for: 'opt-' + opt.name } });
      row.appendChild(label);

      const currentVal = options[opt.name] !== undefined ? options[opt.name] : (opt.default || '');
      const sensitive = isSensitiveOption(opt.name);

      let input;
      if (opt.type === 'bool') {
        input = el('input', { attrs: { type: 'checkbox', id: 'opt-' + opt.name } });
        input.checked = currentVal === 'true' || currentVal === true;
        input.addEventListener('change', () => {
          sendOption(opt.name, input.checked ? 'true' : 'false');
        });
      } else if (opt.type === 'choice' && opt.values) {
        input = el('select', { attrs: { id: 'opt-' + opt.name } });
        for (const v of opt.values) {
          const optEl = el('option', { text: v, attrs: { value: v } });
          if (v === currentVal) optEl.selected = true;
          input.appendChild(optEl);
        }
        input.addEventListener('change', () => {
          sendOption(opt.name, input.value);
        });
      } else {
        const inputType = sensitive ? 'password' : (opt.type === 'int' ? 'number' : 'text');
        input = el('input', { attrs: { type: inputType, id: 'opt-' + opt.name, value: sensitive ? '' : String(currentVal) } });
        if (sensitive) input.setAttribute('placeholder', '\u2022\u2022\u2022\u2022\u2022\u2022');
        input.addEventListener('change', () => {
          sendOption(opt.name, input.value);
        });
      }
      row.appendChild(input);
      section.appendChild(row);
    }
    groupsContainer.appendChild(section);
  }
}

function sendOption(name, value) {
  invoke('engine_send', { command: { command: 'options.set', name, value } });
}

export function activate() {
  unsub = subscribe(render);
  render();
}

export function deactivate() {
  if (unsub) unsub();
}
