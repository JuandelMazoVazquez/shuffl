// Guía de instalación (guia/, guide/): botón para copiar la Redirect URI. Sin módulos ni dependencias.
const LABELS = document.documentElement.lang === 'en' ? { copied: 'Copied', selected: 'Selected' } : { copied: 'Copiada', selected: 'Seleccionada' };

for (const btn of document.querySelectorAll('button[data-copy]')) {
  const input = document.getElementById(btn.dataset.copy);
  const label = btn.textContent;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      btn.textContent = LABELS.copied;
    } catch {
      input.select();
      btn.textContent = LABELS.selected;
    }
    setTimeout(() => { btn.textContent = label; }, 1800);
  });
}
