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
 * Central application state store with subscription support.
 */

const state = {
  engineRunning: false,
  engineBooted: false,
  manifest: null,
  mainStatus: null,
  logs: [],
  stats: {},
  options: {},
  paths: { profile: '', data: '', application: '' },
  netlockModes: [],
  frontMessages: [],
  servers: [],
  areas: [],
  notifications: [],
};

const subscribers = new Map();
let subId = 0;

/**
 * Get current state (read-only reference).
 */
export function getState() {
  return state;
}

/**
 * Update state fields and notify subscribers.
 */
export function setState(partial) {
  Object.assign(state, partial);
  for (const fn of subscribers.values()) {
    fn(state);
  }
}

/**
 * Subscribe to state changes. Returns unsubscribe function.
 */
export function subscribe(fn) {
  const id = ++subId;
  subscribers.set(id, fn);
  return () => subscribers.delete(id);
}

/**
 * Add a log entry, capping at 5000.
 */
export function addLog(entry) {
  state.logs.push(entry);
  if (state.logs.length > 5000) {
    state.logs = state.logs.slice(-5000);
  }
  for (const fn of subscribers.values()) {
    fn(state);
  }
}

/**
 * Update a single stat.
 */
export function setStat(key, value) {
  state.stats[key] = value;
  for (const fn of subscribers.values()) {
    fn(state);
  }
}

/**
 * Update a single option.
 */
export function setOption(name, value) {
  const option = state.options[name];
  if (option && typeof option === 'object') {
    option.value = value;
  } else {
    state.options[name] = { type: 'text', value: value };
  }
  for (const fn of subscribers.values()) {
    fn(state);
  }
}
