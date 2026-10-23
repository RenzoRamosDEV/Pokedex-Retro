const DIALOG_HASH = /^#pokemon-\d+$/;

export function dialogIdFromHash(hash) {
  return DIALOG_HASH.test(hash) ? hash.slice(1) : null;
}

export function connectPokemonDialogs({ root, document, location, history }) {
  function open(id) {
    const dialog = document.getElementById(id);
    dialog.showModal();
    dialog.querySelector('[data-cerrar]').focus();
    history.replaceState(null, '', `#${id}`);
  }

  root.addEventListener('click', (event) => {
    const card = event.target.closest('a.card-link');
    if (card) {
      event.preventDefault();
      open(card.getAttribute('href').slice(1));
      return;
    }
    const closeButton = event.target.closest('[data-cerrar]');
    if (closeButton) {
      closeButton.closest('dialog').close();
      return;
    }
    // The panel fills the dialog box, so only backdrop clicks target the dialog itself.
    if (event.target.tagName === 'DIALOG') event.target.close();
  });

  // `close` does not bubble, so it is caught on its way down.
  root.addEventListener(
    'close',
    (event) => {
      document.querySelector(`a.card-link[href="#${event.target.id}"]`)?.focus();
      history.replaceState(null, '', location.pathname + location.search);
    },
    true,
  );

  return {
    openFromHash() {
      const id = dialogIdFromHash(location.hash);
      if (id !== null && document.getElementById(id) !== null) open(id);
    },
  };
}
