export function wantsScreenPdf(text: string): boolean {
  const t = String(text || '')
    .toLowerCase()
    .replace(/[?!.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/\bpdf\b/.test(t) || !/\b(screen|display|desktop)\b/.test(t)) return false;
  if (/\b(what is|what's|explain|define|how does|difference between)\b/.test(t)) return false;
  const make = /\b(create|make|save|generate|capture|take|download|print|export|banao|bana|banado)\b/.test(t);
  const ofScreen = /\bpdf\b.{0,48}\b(of|for)\b.{0,32}\b(the |my |this |current )?(screen|display|desktop)\b/.test(t)
    || /\b(screen|display|desktop)\b.{0,40}\b(as|to|into|ka|ki)\b.{0,16}\bpdf\b/.test(t)
    || /\b(screen|display)\s+pdf\b/.test(t);
  return make || ofScreen;
}

export async function saveCurrentScreenPdf(): Promise<{ message: string; actionExecuted: string }> {
  const api = typeof window !== 'undefined' ? window.electronAPI?.saveScreenPdf : undefined;
  if (!api) {
    return {
      message: 'Saving the screen as a PDF works in the Windows app.',
      actionExecuted: 'screen_pdf_unavailable',
    };
  }
  try {
    const result = await api();
    if (result?.ok && result.file) {
      return {
        message: `Saved the screen as a PDF in Downloads.\n\n${result.file}`,
        actionExecuted: 'screen_pdf',
      };
    }
  } catch (err) {
    console.warn('[ScreenPdf] Save failed:', err);
  }
  return {
    message: 'I could not capture the screen, so no PDF was saved.',
    actionExecuted: 'screen_pdf_failed',
  };
}
