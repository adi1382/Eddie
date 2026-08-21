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
 * Tauri JS API wrapper with mock fallback for browser development.
 */

const hasTauri = typeof window.__TAURI__ !== 'undefined';

// Mock data for browser development
const mockServers = [
  { code: 'Castor', name: 'Castor', name_list: 'Castor', provider: 'AirVPN', country_code: 'NL', country_name: 'Netherlands', location: 'Amsterdam', latitude: 52.37, longitude: 4.9, ping: 12, load: 35, load_perc: 35, load_color: 'green', users: 42, score: 98000, user_list: 'none', can_connect: true, warning: false, error: false, warnings: '' },
  { code: 'Pollux', name: 'Pollux', name_list: 'Pollux', provider: 'AirVPN', country_code: 'DE', country_name: 'Germany', location: 'Frankfurt', latitude: 50.11, longitude: 8.68, ping: 18, load: 55, load_perc: 55, load_color: 'yellow', users: 87, score: 85000, user_list: 'none', can_connect: true, warning: false, error: false, warnings: '' },
  { code: 'Vega', name: 'Vega', name_list: 'Vega', provider: 'AirVPN', country_code: 'US', country_name: 'United States', location: 'New York', latitude: 40.71, longitude: -74.01, ping: 85, load: 72, load_perc: 72, load_color: 'yellow', users: 120, score: 72000, user_list: 'allowlist', can_connect: true, warning: false, error: false, warnings: '' },
  { code: 'Sirius', name: 'Sirius', name_list: 'Sirius', provider: 'AirVPN', country_code: 'JP', country_name: 'Japan', location: 'Tokyo', latitude: 35.68, longitude: 139.69, ping: 190, load: 20, load_perc: 20, load_color: 'green', users: 15, score: 60000, user_list: 'denylist', can_connect: true, warning: false, error: false, warnings: '' },
  { code: 'Altair', name: 'Altair', name_list: 'Altair', provider: 'AirVPN', country_code: 'CH', country_name: 'Switzerland', location: 'Zurich', latitude: 47.37, longitude: 8.54, ping: 22, load: 90, load_perc: 90, load_color: 'red', users: 200, score: 45000, user_list: 'none', can_connect: true, warning: true, error: false, warnings: 'High load' },
];

const mockAreas = [
  { code: 'NL', name: 'Netherlands', servers: 5, users: 210, load: 40, load_perc: 40, load_color: 'green', user_list: 'none' },
  { code: 'DE', name: 'Germany', servers: 8, users: 350, load: 55, load_perc: 55, load_color: 'yellow', user_list: 'none' },
  { code: 'US', name: 'United States', servers: 12, users: 500, load: 65, load_perc: 65, load_color: 'yellow', user_list: 'allowlist' },
  { code: 'JP', name: 'Japan', servers: 3, users: 45, load: 20, load_perc: 20, load_color: 'green', user_list: 'none' },
];

const mockManifest = {
  version: { name: 'Eddie', text: '2.24.0', int: 22400 },
  os: { code: 'linux', name: 'Linux', framework: '.NET 8' },
  about: {
    license: 'Eddie is free software released under the GNU General Public License v3.',
    libraries: 'OpenVPN, WireGuard, OpenSSL, Mono/.NET, Tauri',
    thanks: 'Thanks to all AirVPN community members and contributors.'
  },
  locales: ['en'],
};

const mockOptions = {
  'login': { type: 'text', default: '', man: 'AirVPN account login.', value: 'user' },
  'password': { type: 'password', default: '', man: 'AirVPN account password.', secret: true, value: '' },
  'dns.mode': { type: 'choice:auto,none', default: 'auto', man: 'DNS switch mode.', value: 'auto' },
  'network.ipv6.mode': { type: 'choice:in,out,block', default: 'in', man: 'IPv6 mode.', value: 'in' },
  'proxy.host': { type: 'text', default: '127.0.0.1', man: 'Proxy host.', value: '127.0.0.1' },
  'proxy.port': { type: 'int', default: '8080', man: 'Proxy port.', value: '8080' },
  'advanced.expert': { type: 'bool', default: 'False', man: 'Expert mode.', value: 'False' },
  'internal.only': { type: 'text', default: '', man: '', internalonly: true, value: 'hidden' },
};

const mockState = { running: true, booted: true };

const mockListeners = new Map();

function mockInvoke(cmd, args) {
  switch (cmd) {
    case 'engine_state':
      return Promise.resolve(mockState);
    case 'engine_request': {
      const c = args.command.command;
      if (c === 'ui.servers.list') return Promise.resolve({ servers: mockServers });
      if (c === 'ui.areas.list') return Promise.resolve({ areas: mockAreas });
      if (c === 'man') return Promise.resolve({ layout: 'text', title: 'Eddie Manual', body: 'Eddie VPN client manual.\n\nUsage: connect to AirVPN servers.' });
      return Promise.resolve(null);
    }
    case 'engine_send': {
      const c = args.command.command;
      if (c === 'mainaction.connect') {
        setTimeout(() => emitMock('engine://message', {
          command: 'ui.main-status',
          message: 'Connected to Castor',
          app_icon: 'connected',
          app_color: 'green',
          action_icon: 'disconnect',
          action_command: 'mainaction.disconnect',
          action_text: 'Disconnect',
          netlock: false
        }), 500);
      } else if (c === 'mainaction.disconnect') {
        setTimeout(() => emitMock('engine://message', {
          command: 'ui.main-status',
          message: 'Disconnected',
          app_icon: 'disconnected',
          app_color: 'red',
          action_icon: 'connect',
          action_command: 'mainaction.connect',
          action_text: 'Connect',
          netlock: false
        }), 300);
      } else if (c === 'ui.boot.request') {
        setTimeout(() => {
          emitMock('engine://message', {
            command: 'ui.boot',
            manifest: mockManifest,
            main_status: { message: 'Ready', app_icon: 'idle', app_color: 'red', action_icon: 'connect', action_command: 'mainaction.connect', action_text: 'Connect', netlock: false },
            logs: [
              { type: 'info', message: 'Engine started.', time: Date.now() },
              { type: 'info', message: 'Mock mode active.', time: Date.now() },
            ],
            options: mockOptions,
            path: { profile: '/home/user/.eddie', data: '/usr/share/eddie', application: '/opt/eddie' },
            netlock_modes: [{ code: 'auto', title: 'Automatic' }, { code: 'custom', title: 'Custom' }]
          });
        }, 200);
      }
      return Promise.resolve(null);
    }
    default:
      return Promise.resolve(null);
  }
}

function emitMock(event, payload) {
  const listeners = mockListeners.get(event);
  if (listeners) {
    for (const fn of listeners) {
      fn({ payload });
    }
  }
}

function mockListen(event, handler) {
  if (!mockListeners.has(event)) mockListeners.set(event, new Set());
  mockListeners.get(event).add(handler);
  return Promise.resolve(() => {
    const s = mockListeners.get(event);
    if (s) s.delete(handler);
  });
}

/**
 * Invoke a Tauri command.
 */
export function invoke(cmd, args) {
  if (hasTauri) {
    return window.__TAURI__.core.invoke(cmd, args);
  }
  return mockInvoke(cmd, args);
}

/**
 * Listen to a Tauri event.
 * Returns a function to unlisten.
 */
export function listen(event, handler) {
  if (hasTauri) {
    return window.__TAURI__.event.listen(event, handler);
  }
  return mockListen(event, handler);
}
