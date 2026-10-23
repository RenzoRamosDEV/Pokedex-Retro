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
  const themeButton = document.getElementById('theme-btn');
  const themeDropdown = document.getElementById('theme-dropdown');
  const themeOptions = document.querySelectorAll('.theme-option');
  const infoButton = document.getElementById('info-btn');
  const infoPanel = document.getElementById('info-dropdown');

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    saveTheme(storage, theme);
    themeDropdown.hidden = true;
    themeOptions.forEach((option) => {
      option.classList.toggle('active', option.dataset.value === theme);
    });
  }

  applyTheme(savedThemeOrDefault(storage));

  themeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    themeDropdown.hidden = !themeDropdown.hidden;
  });

  themeOptions.forEach((option) => {
    option.addEventListener('click', () => applyTheme(option.dataset.value));
  });

  infoButton.addEventListener('click', (event) => {
    event.stopPropagation();
    infoPanel.hidden = !infoPanel.hidden;
    themeDropdown.hidden = true;
  });

  document.addEventListener('click', () => {
    themeDropdown.hidden = true;
    infoPanel.hidden = true;
  });
}
