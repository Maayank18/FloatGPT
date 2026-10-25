import { getHandsPending, setHandsPending } from './handsPending';
import { codeFromText, handsApplies, type HandsJob } from './hands';

type HandsResult = { ok?: boolean; reason?: string; sent?: boolean; filled?: string[]; missed?: string[] };

function desktop(): { run?: (job: any) => Promise<HandsResult> } | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.electronAPI?.hands as any;
}

function mailtoHref(job: Extract<HandsJob, { kind: 'email' }>): string {
  const to = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.toEmail) ? job.toEmail : '';
  const greeting = job.toName ? `Hi ${job.toName},\n\n` : '';
  const params = new URLSearchParams({
    subject: job.subject.slice(0, 120),
    body: `${greeting}${job.body}`.slice(0, 1800),
  });
  return `mailto:${to}?${params.toString()}`;
}

function who(job: Extract<HandsJob, { kind: 'email' }>): string {
  return job.toEmail || job.toName || 'them';
}

async function perform(job: HandsJob, messages?: Array<{ role: string; content: string }>): Promise<string> {
  if (job.kind === 'refuse') return job.line;

  const api = desktop();

  if (job.kind === 'email') {
    if (api?.run) {
      const result = await api.run(job);
      if (!result?.ok) return 'I could not open a draft. I left that alone.';
    } else if (typeof window !== 'undefined') {
      const opened = window.open(mailtoHref(job), '_blank');
      if (!opened) return 'I could not open a draft. I left that alone.';
    } else {
      return 'I left that alone.';
    }
    setHandsPending('email');
    return `Draft is open for ${who(job)}. It is not sent. Say send the email when you want that.`;
  }

  if (job.kind === 'form') {
    if (!api?.run) return 'That needs the FloatGPT desktop app. I left the form alone.';
    const result = await api.run(job);
    if (result?.reason === 'password') return 'I do not fill passwords.';
    if (result?.reason === 'no-browser') return 'No browser is open. I left the form alone.';
    if (result?.reason === 'focus-failed') return 'I could not bring the browser to the front. I left the form alone.';
    if (!result?.ok) return 'I could not fill that form. I left it alone.';
    setHandsPending('form');
    const filled = result.filled?.length ? result.filled : job.fields.map((field) => field.label);
    const missed = result.missed || [];
    const summary = filled.length === 1
      ? `Filled ${filled[0]}.`
      : `Filled ${filled.length} fields: ${filled.join(', ')}.`;
    const failed = missed.length ? ` I could not fill ${missed.join(', ')}.` : '';
    const passwords = job.skippedPassword ? ' I do not fill passwords.' : '';
    return `${summary}${failed}${passwords} Submit is not pressed. Say submit the form when you want that.`;
  }

  if (job.kind === 'editor') {
    if (!api?.run) return 'That needs the FloatGPT desktop app. I left the editor alone.';
    const result = await api.run(job);
    if (result?.reason === 'cursor-closed') return 'Cursor is not open. I left that alone.';
    if (result?.reason === 'focus-failed') return 'I could not bring Cursor to the front. I left that alone.';
    if (!result?.ok) return 'I could not paste into Cursor. I left that alone.';
    if (result.sent || job.sendNow) {
      setHandsPending(null);
      return 'Pasted into Cursor and pressed Enter.';
    }
    setHandsPending('editor');
    return 'Pasted into Cursor. Enter is not pressed. Say send it when you want Cursor to run it.';
  }

  if (job.kind === 'paste') {
    let code = job.code;
    if (!code && messages && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role === 'assistant') {
          const found = codeFromText(m.content);
          if (found) {
            code = found;
            break;
          }
        }
      }
    }

    if (!code) {
      return 'I could not find any code snippet from our chat to paste. Please generate or provide the code first.';
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
      } catch {}
    }

    if (!api?.run) {
      return 'Copied the code to your clipboard! Click into your editor and press Ctrl+V to paste.';
    }

    const result = await api.run({ kind: 'paste', text: code });
    if (!result?.ok) {
      return 'The code is on the clipboard. Click the editor once and press Ctrl+V. I left the page alone.';
    }
    return 'Pasted the code into the editor. I did not submit it.';
  }

  if (job.kind === 'confirm') {
    if (job.target === 'email' && getHandsPending() !== 'email') return 'There is no draft waiting. I left that alone.';
    if (job.target === 'form' && getHandsPending() !== 'form') return 'There is no form field waiting. I left that alone.';
    if (job.target === 'editor' && getHandsPending() !== 'editor') return 'Nothing is waiting in Cursor. I left that alone.';
    if (!api?.run) return 'That needs the FloatGPT desktop app. I left that alone.';
    const result = await api.run(job);
    if (job.target === 'email' && result?.reason === 'mail-not-front') {
      return 'The mail window is not in front. I did not press send.';
    }
    if (job.target === 'form' && result?.reason === 'no-browser') return 'No browser is open. I did not submit.';
    if (job.target === 'form' && result?.reason === 'focus-failed') return 'I could not bring the browser to the front. I did not submit.';
    if (job.target === 'editor' && result?.reason === 'cursor-closed') return 'Cursor is not open. I left that alone.';
    if (job.target === 'editor' && result?.reason === 'focus-failed') return 'I could not bring Cursor to the front. I left that alone.';
    if (!result?.ok) return 'I left that alone.';
    setHandsPending(null);
    if (job.target === 'email') return 'I pressed send in the mail window. Check that it actually left.';
    if (job.target === 'form') return 'I pressed Ctrl+Enter in the browser. If the form is still open, submit did not land.';
    return 'I pressed Enter in Cursor.';
  }

  return 'I left that alone.';
}

export async function pasteCodeBlock(code: string): Promise<string> {
  const job: HandsJob = { kind: 'paste', code };
  return perform(job);
}

export async function replyForHands(text: string, planMode: boolean, messages?: Array<{ role: string; content: string }>): Promise<string | null> {
  const job = handsApplies(planMode, text, getHandsPending());
  if (!job) return null;
  try {
    return await perform(job, messages);
  } catch (err) {
    console.warn('[Hands] left alone', err);
    return 'I left that alone.';
  }
}
