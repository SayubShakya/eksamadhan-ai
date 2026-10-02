import { useEffect, useState } from 'react';
import * as theme from './theme.js';

/**
 * Per-device preferences from Settings > General: accent colour, chart style, language and keyboard
 * shortcuts. Kept in this browser only, like the theme, because they are about how one screen
 * looks to one person, not about the workspace.
 */
const KEY = 'prefs';
const DEFAULTS = { accent: 'blue', customAccent: '#2563eb', shortcuts: true, chartStyle: 'smooth', lang: 'en' };

/** No purple, and no red: red means danger here. Light and dark mode each get a shade that
 *  keeps white button text readable. */
export const ACCENTS = {
    blue: { label: 'Blue', light: '#2563eb', dark: '#5b8ff9' },
    teal: { label: 'Teal', light: '#0f766e', dark: '#14a394' },
    green: { label: 'Green', light: '#15803d', dark: '#22a352' },
    orange: { label: 'Orange', light: '#c2410c', dark: '#ea6a1f' },
};

/** WCAG contrast of white text on a colour: buttons carry white text, so a brand colour must
 *  reach 3:1 (large, bold text) to be usable. */
export function contrastWithWhite(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return 1.05 / (L + 0.05);
}
export const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

/** The colour in use now, as a hex code. */
export function accentHex(p = state, mode = theme.current()) {
    if (p.accent === 'custom' && isHex(p.customAccent)) return p.customAccent.toLowerCase();
    return (ACCENTS[p.accent] || ACCENTS.blue)[mode === 'dark' ? 'dark' : 'light'];
}

const listeners = new Set();

function read() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

let state = read();

export function get() { return state; }

function apply() {
    const root = document.documentElement.style;
    if (state.accent === 'blue' || (!ACCENTS[state.accent] && !(state.accent === 'custom' && isHex(state.customAccent)))) {
        // The default blue is the stylesheet's own, tuned per theme.
        ['--accent', '--accent-weak', '--accent-tint'].forEach(v => root.removeProperty(v));
        return;
    }
    const hex = accentHex();
    root.setProperty('--accent', hex);
    root.setProperty('--accent-weak', `color-mix(in srgb, ${hex} 9%, var(--bg))`);
    root.setProperty('--accent-tint', `color-mix(in srgb, ${hex} 16%, var(--bg))`);
}

export function init() {
    apply();
    theme.subscribe(apply);
}

export function set(patch) {
    state = { ...state, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: this visit only */ }
    apply();
    listeners.forEach(fn => fn(state));
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function usePrefs() {
    const [p, setP] = useState(state);
    useEffect(() => subscribe(setP), []);
    return p;
}
