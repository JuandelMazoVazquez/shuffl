const HOUR = 3600 * 1000;

/**
 * Registra el service worker y avisa con `onUpdate(apply)` cuando hay una versión nueva esperando.
 * `apply()` pide al worker nuevo que tome el control y la página se recarga una sola vez.
 */
export async function registerUpdates({ onUpdate, url = 'sw.js' } = {}) {
  if (!('serviceWorker' in navigator)) return null;
  const hadController = !!navigator.serviceWorker.controller;
  let wanted = false;
  let reloaded = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wanted || reloaded) return;
    reloaded = true;
    location.reload();
  });

  const reg = await navigator.serviceWorker.register(url);
  const offer = (worker) => onUpdate?.(() => {
    wanted = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
  if (reg.waiting && hadController) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
    });
  });

  const check = () => reg.update().catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, HOUR);
  return reg;
}
