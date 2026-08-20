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
 * About page — version, license, libraries, thanks.
 */

import { el, clear } from './dom.js';
import { getState, subscribe } from './state.js';
import { invoke } from './tauri.js';

let container, contentDiv;
let unsub;

export function init(root) {
  container = root;
  container.classList.add('page-about');
  contentDiv = el('div', { cls: 'about-content' });
  container.appendChild(contentDiv);
}

function render() {
  const manifest = getState().manifest;
  clear(contentDiv);
  if (!manifest) {
    contentDiv.appendChild(el('p', { text: 'Waiting for engine data...' }));
    return;
  }

  const v = manifest.version || {};
  const os = manifest.os || {};
  const about = manifest.about || {};

  contentDiv.appendChild(el('h2', { text: (v.name || 'Eddie') + ' ' + (v.text || '') }));
  contentDiv.appendChild(el('p', { text: 'OS: ' + (os.name || '') + ' (' + (os.code || '') + '), Framework: ' + (os.framework || '') }));

  if (about.license) {
    contentDiv.appendChild(el('h3', { text: 'License' }));
    contentDiv.appendChild(el('pre', { cls: 'about-text', text: about.license }));
  }
  if (about.libraries) {
    contentDiv.appendChild(el('h3', { text: 'Libraries' }));
    contentDiv.appendChild(el('pre', { cls: 'about-text', text: about.libraries }));
  }
  if (about.thanks) {
    contentDiv.appendChild(el('h3', { text: 'Thanks' }));
    contentDiv.appendChild(el('p', { text: about.thanks }));
  }

  const linkBtn = el('button', { cls: 'link-btn', text: 'Visit AirVPN Website' });
  linkBtn.addEventListener('click', () => {
    invoke('engine_send', { command: { command: 'url.open', uri: 'https://airvpn.org' } });
  });
  contentDiv.appendChild(linkBtn);
}

export function activate() {
  unsub = subscribe(render);
  render();
}

export function deactivate() {
  if (unsub) unsub();
}
