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
 * Simple tab-based router — no history/URL changes.
 */

const pages = new Map();
let currentPage = null;
let tabListEl = null;
let contentEl = null;

/**
 * Register a page module.
 * @param {string} id
 * @param {string} label
 * @param {{ init(container), activate(), deactivate() }} mod
 */
export function registerPage(id, label, mod) {
  pages.set(id, { id, label, mod, container: null, initialized: false });
}

/**
 * Initialize the router — build tab bar and panels.
 */
export function initRouter(tabListElement, contentElement) {
  tabListEl = tabListElement;
  contentEl = contentElement;

  for (const [id, page] of pages) {
    // Create tab button
    const btn = document.createElement('button');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.setAttribute('aria-controls', 'panel-' + id);
    btn.id = 'tab-' + id;
    btn.textContent = page.label;
    btn.dataset.page = id;
    tabListEl.appendChild(btn);

    // Create panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tab-' + id);
    panel.id = 'panel-' + id;
    panel.classList.add('tab-panel');
    panel.hidden = true;
    contentEl.appendChild(panel);
    page.container = panel;
  }

  // Tab click handling
  tabListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[role="tab"]');
    if (btn) navigate(btn.dataset.page);
  });

  // Keyboard navigation for tabs
  tabListEl.addEventListener('keydown', (e) => {
    const tabs = Array.from(tabListEl.querySelectorAll('[role="tab"]'));
    const idx = tabs.indexOf(document.activeElement);
    if (idx < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (idx + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (idx - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = tabs.length - 1;
    }
    if (next >= 0) {
      e.preventDefault();
      tabs[next].focus();
      navigate(tabs[next].dataset.page);
    }
  });
}

/**
 * Navigate to a page by id.
 */
export function navigate(id) {
  if (!pages.has(id)) return;
  if (currentPage === id) return;

  // Deactivate current
  if (currentPage && pages.has(currentPage)) {
    const prev = pages.get(currentPage);
    prev.container.hidden = true;
    if (prev.mod.deactivate) prev.mod.deactivate();
    const prevTab = document.getElementById('tab-' + currentPage);
    if (prevTab) {
      prevTab.setAttribute('aria-selected', 'false');
      prevTab.setAttribute('tabindex', '-1');
    }
  }

  // Activate new
  const page = pages.get(id);
  if (!page.initialized) {
    page.mod.init(page.container);
    page.initialized = true;
  }
  page.container.hidden = false;
  if (page.mod.activate) page.mod.activate();
  currentPage = id;

  const tab = document.getElementById('tab-' + id);
  if (tab) {
    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');
  }
}

/**
 * Get currently active page id.
 */
export function getCurrentPage() {
  return currentPage;
}
