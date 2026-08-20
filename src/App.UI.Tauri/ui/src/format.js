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
 * Formatting utilities.
 */

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return '-';
  const n = Number(bytes);
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(2) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}

/**
 * Format a duration in seconds to HH:MM:SS.
 */
export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '-';
  const s = Math.floor(Number(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Format a date string to local time.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString();
  } catch {
    return dateStr;
  }
}

/**
 * Truncate a string to max length.
 */
export function truncate(str, max = 80) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

/**
 * Determine if an option name is sensitive (password/key).
 */
export function isSensitiveOption(name) {
  const lower = name.toLowerCase();
  return lower.includes('password') || lower.includes('access_key') || lower.includes('.key');
}
