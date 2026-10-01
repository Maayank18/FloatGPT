import { loadIdentityVault } from './vaultStore';
import { mapFormFields, formatFillReceipt } from './fieldMapper';

export async function runFormFill(): Promise<string> {
  const api = typeof window !== 'undefined' ? window.electronAPI?.formFill : undefined;
  if (!api?.inspect || !api?.fill) {
    return '⚠️ **Form fill needs the desktop app.** Restart FloatGPT, focus the form in Chrome/Edge, then try again.';
  }

  const vault = await loadIdentityVault();
  const hasAny = Object.entries(vault).some(([k, v]) => {
    if (k === 'custom') return (vault.custom || []).some((c) => c.value.trim());
    return typeof v === 'string' && v.trim();
  });
  if (!hasAny) {
    return '⚠️ **Identity vault is empty.** Open **Settings → Profile**, save your details, then click **Fill this form**.';
  }

  const inspected = await api.inspect();
  if (!inspected?.ok) {
    return formatFillReceipt({ filled: [], skipped: [], unmatched: [], error: inspected?.error });
  }
  const fields = (inspected.fields || []).map((f) => ({
    ...f,
    type: f.type || 'text'
  }));
  if (!fields.length) {
    return formatFillReceipt({
      filled: [],
      skipped: [],
      unmatched: [],
      title: inspected.title,
      error: `No text fields found on “${inspected.title || 'unknown window'}”. Click the browser tab (fill.dev / Chrome / Edge), not the Orb, then Fill again. Fully restart FloatGPT once so the new filler loads.`
    });
  }

  const mapped = mapFormFields(fields, vault);
  const toFill = mapped.filter((m) => m.value && !m.skipped);
  const skipped = mapped.filter((m) => m.skipped && m.skipped !== 'no vault match' && m.skipped !== 'empty in vault');
  const unmatched = mapped.filter((m) => m.skipped === 'no vault match' || m.skipped === 'empty in vault');

  if (!toFill.length) {
    return formatFillReceipt({
      filled: [],
      skipped,
      unmatched,
      title: inspected.title,
      error: 'The form was read, but nothing in your vault matched those labels. Add custom fields in Settings → Profile (e.g. Unstop ID).'
    });
  }

  const result = await api.fill(toFill.map((m) => ({ index: m.index, value: m.value })));
  if (!result?.ok) {
    return formatFillReceipt({ filled: [], skipped, unmatched, title: inspected.title, error: result?.error });
  }

  return formatFillReceipt({
    title: inspected.title,
    filled: toFill,
    skipped,
    unmatched
  });
}
