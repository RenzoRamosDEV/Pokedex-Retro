const THEME_KEY = 'theme';
const DEFAULT_THEME = 'normal';

// A null storage throws like a blocked one, so both fall back to not persisting.
function savedThemeOrDefault(storage) {
  try {
    return storage.getItem(THEME_KEY) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function saveTheme(storage, theme) {
  try {
    storage.setItem(THEME_KEY, theme);
  } catch {
    // The theme still applies; it just is not remembered.
  }
}

export function initTheme(document, storage) {
  const themeOptions = document.querySelectorAll('.theme-option');

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    saveTheme(storage, theme);
    themeOptions.forEach((option) => {
      option.classList.toggle('active', option.dataset.value === theme);
    });
  }

  applyTheme(savedThemeOrDefault(storage));

  themeOptions.forEach((option) => {
    option.addEventListener('click', () => applyTheme(option.dataset.value));
  });
}
