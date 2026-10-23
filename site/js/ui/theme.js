const THEME_KEY = 'theme';
const THEMES = ['normal', 'gb', 'gray'];
const LIGHT_DEFAULT = 'normal';
const DARK_DEFAULT = 'gray';

// A null storage throws like a blocked one, so both fall back to not persisting.
function savedTheme(storage) {
  try {
    const theme = storage.getItem(THEME_KEY);
    return THEMES.includes(theme) ? theme : null;
  } catch {
    return null;
  }
}

function saveTheme(storage, theme) {
  try {
    storage.setItem(THEME_KEY, theme);
  } catch {
    // The theme still applies; it just is not remembered.
  }
}

export function initTheme(document, storage, prefersDark = false) {
  const themeOptions = document.querySelectorAll('.theme-option');

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    themeOptions.forEach((option) => {
      option.classList.toggle('active', option.dataset.value === theme);
    });
  }

  applyTheme(savedTheme(storage) ?? (prefersDark ? DARK_DEFAULT : LIGHT_DEFAULT));

  themeOptions.forEach((option) => {
    option.addEventListener('click', () => {
      applyTheme(option.dataset.value);
      saveTheme(storage, option.dataset.value);
    });
  });
}
