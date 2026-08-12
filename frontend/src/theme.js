// ===== SHARED THEME MODULE — single source of truth for theme application.
// Both Chat.js and Settings.js import this instead of each managing their
// own effect, so light/dark stays perfectly in sync across the whole app. =====

const THEME_KEY = 'nalantamil_theme'; // one global key, not per-user — must be
// readable before login (by the blocking script in index.html) and before
// any username is known.

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark';
  } catch (err) {
    return 'dark';
  }
}

export function setStoredTheme(pref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch (err) {}
}

export function resolveTheme(pref) {
  if (pref === 'system') {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  return pref === 'dark' ? 'dark' : 'light';
}

// Applies the resolved theme by toggling class="dark" on <html>. This is the
// ONE place in the whole app that touches the theme class — no component
// should call classList/setAttribute for theme itself outside this function.
export function applyTheme(pref) {
  const resolved = resolveTheme(pref);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

// Call once from any mounted component (Chat.js and Settings.js both call
// this on mount) to (a) apply the current stored theme immediately, and
// (b) keep it live-updating if the pref is "system" and the OS changes.
// Returns a cleanup function.
export function initTheme(onChange) {
  const pref = getStoredTheme();
  applyTheme(pref);
  if (onChange) onChange(pref);

  if (pref !== 'system' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => applyTheme(pref);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

// Call when the user picks a new theme in Preferences.
export function changeTheme(pref) {
  setStoredTheme(pref);
  applyTheme(pref);
}