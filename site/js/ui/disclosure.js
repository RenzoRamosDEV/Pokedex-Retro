function setOpen({ button, panel }, open) {
  panel.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

const isOpen = ({ panel }) => !panel.hidden;

export function connectDisclosures(document, pairs) {
  const disclosures = pairs.map(({ button, panel }) => ({
    button: document.getElementById(button),
    panel: document.getElementById(panel),
  }));

  disclosures.forEach((disclosure) => {
    setOpen(disclosure, isOpen(disclosure));
    disclosure.button.addEventListener('click', (event) => {
      event.stopPropagation();
      const opening = !isOpen(disclosure);
      disclosures.forEach((other) => setOpen(other, false));
      setOpen(disclosure, opening);
    });
  });

  document.addEventListener('click', () => {
    disclosures.filter(isOpen).forEach((disclosure) => {
      const focusInside = disclosure.panel.contains(document.activeElement);
      setOpen(disclosure, false);
      if (focusInside) disclosure.button.focus();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = disclosures.find(isOpen);
    if (open === undefined) return;
    setOpen(open, false);
    open.button.focus();
  });
}
