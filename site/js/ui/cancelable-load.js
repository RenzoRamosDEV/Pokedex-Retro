export async function loadUntilPageHide(target, load) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  target.addEventListener('pagehide', abort);
  try {
    const result = await load(controller.signal);
    return controller.signal.aborted ? null : result;
  } catch (error) {
    if (controller.signal.aborted) return null;
    throw error;
  } finally {
    target.removeEventListener('pagehide', abort);
  }
}
