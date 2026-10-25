export type HandsPending = 'email' | 'form' | 'editor' | null;

export type FormField = { label: string; value: string };

export type HandsJob =
  | { kind: 'email'; toName: string; toEmail: string; subject: string; body: string }
  | { kind: 'form'; fields: FormField[]; skippedPassword?: boolean }
  | { kind: 'editor'; prompt: string; sendNow: boolean }
  | { kind: 'paste'; code?: string }
  | { kind: 'confirm'; target: 'email' | 'form' | 'editor' }
  | { kind: 'refuse'; line: string };

const FORM_LABELS = [
  'email address',
  'email id',
  'email',
  'roll number',
  'roll no',
  'enrollment number',
  'enrollment no',
  'registration number',
  'reg no',
  'student id',
  'phone number',
  'mobile number',
  'contact number',
  'phone',
  'mobile',
  'full name',
  'first name',
  'last name',
  'father name',
  'company name',
  'college name',
  'university',
  'college',
  'company',
  'school',
  'address',
  'city',
  'state',
  'name',
];

function clean(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function subjectFrom(body: string): string {
  const trimmed = body.replace(/^the\s+/i, '').trim();
  const sentence = (trimmed.split(/[.!?]/)[0] || trimmed).trim();
  const short = sentence.slice(0, 70);
  if (!short) return 'Note';
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function isInvalidEmailRecipient(who: string): boolean {
  const trimmed = who.trim();
  if (!trimmed || trimmed.length > 50) return true;
  // If who contains words indicating a statement or negation, it is NOT an email recipient!
  if (/\b(?:has|have|had|is|are|was|were|been|not|updated|update|form|google|screen|sent|draft|opened|open|didn't|did not|doesn't|does not|cannot|could not)\b/i.test(trimmed)) {
    return true;
  }
  if (/[.?!]/i.test(trimmed) && !/@/.test(trimmed)) return true;
  return false;
}

function splitRecipient(raw: string): { toName: string; toEmail: string } {
  const text = raw.trim().replace(/[.,]$/, '');
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) return { toName: '', toEmail: email[0] };
  if (isInvalidEmailRecipient(text)) return { toName: '', toEmail: '' };
  return { toName: text.replace(/^to\s+/i, '').slice(0, 80), toEmail: '' };
}

function passwordLabel(label: string): boolean {
  return /password|passwd|secret|otp|\bpin\b/i.test(label);
}

function isInvalidFieldValue(val: string): boolean {
  if (!val || val.length > 200) return true;
  if (/\b(?:has not been|not updated|not filled|was not|is not sent|presented on the screen|check carefully|relevant information|when you want that)\b/i.test(val)) {
    return true;
  }
  return false;
}

function cleanValue(value: string): string {
  let next = value.trim();
  next = next.replace(/^(?:is|hai|h|:|-|as|=)\s+/i, '');
  next = next.replace(/^(?:and|&|aur|tatha)\s+/i, '');
  next = next.replace(/^(?:meri|mera|apna|apni|my|the)\s+/i, '');
  next = next.replace(/[\s,.;]+$/g, '');
  next = next.replace(/\s+(?:and|&|aur|tatha)\s+(?:meri|mera|apna|apni|my|the)$/i, '');
  next = next.replace(/\s+(?:and|&|aur|tatha)$/i, '');
  next = next.replace(/\s+(?:meri|mera|apna|apni|my|the)$/i, '');
  next = next.replace(/\s+(?:hai|h|sir|please)$/i, '');
  next = next.replace(/[\s,.;]+$/g, '');
  return next.trim();
}

function findLabels(text: string): { index: number; label: string }[] {
  const lower = text.toLowerCase();
  const hits: { index: number; label: string }[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (i > 0 && /[a-z0-9]/i.test(text[i - 1])) continue;
    let best = '';
    for (const label of FORM_LABELS) {
      if (label.length <= best.length || !lower.startsWith(label, i)) continue;
      const after = i + label.length;
      if (after < text.length && /[a-z0-9]/i.test(text[after])) continue;
      best = label;
    }
    if (!best) continue;
    hits.push({ index: i, label: best });
    i += best.length - 1;
  }
  return hits;
}

function looksLikePassword(segment: string): boolean {
  return /^(?:the\s+)?(?:password|passwd|secret|otp|pin)\b/i.test(segment.trim());
}

function parseFreeSegment(segment: string): FormField | 'password' | null {
  const text = segment.trim().replace(/^(?:and|&|aur|,)\s+/i, '').replace(/^(?:meri|mera|apna|apni|my|the)\s+/i, '');
  if (looksLikePassword(text)) return 'password';
  const named = text.match(/^([A-Za-z][A-Za-z0-9 .'/]{0,40}?)\s*(?:is|hai|h|:|=|-)\s*(.+)$/i);
  if (!named) return null;
  const label = named[1].trim();
  const value = cleanValue(named[2]);
  if (!label || !value || isInvalidFieldValue(value)) return null;
  if (passwordLabel(label)) return 'password';
  return { label, value };
}

function peelExtras(rawValue: string): { value: string; extra: FormField[]; skippedPassword: boolean } {
  const parts = rawValue.split(/\s*(?:,|;|\.\s+)\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return { value: cleanValue(rawValue), extra: [], skippedPassword: false };
  const extra: FormField[] = [];
  const kept = [parts[0]];
  let skippedPassword = false;
  for (const part of parts.slice(1)) {
    if (looksLikePassword(part)) {
      skippedPassword = true;
      continue;
    }
    const field = parseFreeSegment(part);
    if (field === 'password') {
      skippedPassword = true;
      continue;
    }
    if (field) extra.push(field);
    else kept.push(part);
  }
  return { value: cleanValue(kept.join(', ')), extra, skippedPassword };
}

function collectFormFields(raw: string): { fields: FormField[]; skippedPassword: boolean } {
  const body = raw
    .replace(/^(?:to\s+)?(?:usmein|ismein|usme|isme|iss\s+form\s+mein|is\s+form\s+me|is\s+form\s+mein|us\s+form\s+me|form\s+mein|form\s+me)?\s*(?:meri|apni|ye|yeh)?\s*(?:entries|details|fields)?\s*(?:fill\s*(?:karo|kardo|kijiye|kar\s*do)?|bhar\s*(?:do|dijiye|karo)|daal\s*(?:do|dijiye)|likh\s*(?:do|dijiye))?\s*(?:sir|please)?\s*[,:]?\s*/i, ' ')
    .replace(/^(?:please\s+)?(?:fill|complete)\s+(?:in\s+|out\s+|all\s+|the\s+|this\s+|of\s+|text\s+|entries\s+|fields\s+|form\s+)+/i, ' ')
    .replace(/\bon (?:this|the) (?:google )?form\b/gi, ' ')
    .replace(/\bin (?:this|the) (?:google )?form\b/gi, ' ')
    .replace(/\bgoogle form\b/gi, ' ')
    .replace(/\s+(?:fill\s*(?:karo|kardo|kijiye|kar\s*do)|bhar\s*do|daal\s*do|enter\s*karo|likh\s*do)\s*$/i, ' ')
    .replace(/^[\s,.;]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const hits = findLabels(body);
  const fields: FormField[] = [];
  let skippedPassword = false;
  if (hits.length > 0) {
    hits.forEach((hit, index) => {
      const start = hit.index + hit.label.length;
      const end = index + 1 < hits.length ? hits[index + 1].index : body.length;
      const typed = body.slice(hit.index, hit.index + hit.label.length);
      if (passwordLabel(typed)) {
        skippedPassword = true;
        return;
      }
      const peeled = peelExtras(body.slice(start, end));
      if (peeled.skippedPassword) skippedPassword = true;
      if (peeled.value && !isInvalidFieldValue(peeled.value)) fields.push({ label: typed, value: peeled.value });
      fields.push(...peeled.extra.filter((f) => !isInvalidFieldValue(f.value)));
    });
    return { fields: fields.slice(0, 12), skippedPassword };
  }
  const segments = body.split(/\s*(?:,|;|\.\s+)\s*/).map((part) => part.trim()).filter(Boolean);
  for (const segment of segments) {
    const known = findLabels(segment);
    if (known.length === 1 && known[0].index === 0) {
      const typed = segment.slice(0, known[0].label.length);
      const value = cleanValue(segment.slice(known[0].label.length));
      if (passwordLabel(typed)) skippedPassword = true;
      else if (value && !isInvalidFieldValue(value)) fields.push({ label: typed, value });
      continue;
    }
    const field = parseFreeSegment(segment);
    if (field === 'password') skippedPassword = true;
    else if (field && !isInvalidFieldValue(field.value)) fields.push(field);
  }
  return { fields: fields.slice(0, 12), skippedPassword };
}

function isFormIntent(raw: string): boolean {
  // Guard against complaints or status remarks about forms
  if (/\b(?:has\s+not\s+been|was\s+not|not\s+updated|not\s+filled|didn't\s+update|failed\s+to\s+update|why\s+is\s+it\s+not|why\s+it\s+is\s+not|draft\s+is\s+open)\b/i.test(raw)) {
    return false;
  }
  if (/on (?:this|the) (?:google )?form|in (?:this|the) form|\bgoogle form\b/i.test(raw)) return true;
  if (/^(?:please\s+)?(?:fill|complete)\b/i.test(raw)) return true;
  if (/\b(?:fill\s*(?:karo|kardo|kijiye|kar\s*do)|bhar\s*(?:do|dijiye|karo)|daal\s*(?:do|dijiye)|likh\s*(?:do|dijiye)|enter\s*(?:karo|kardo))\b/i.test(raw)) return true;
  if (/\b(?:form|entries|fields|details)\b/i.test(raw) && /\b(?:fill|bhar|daal|likh|enter|put)\b/i.test(raw)) return true;
  return false;
}

function formRequest(raw: string): HandsJob | null {
  if (!isFormIntent(raw)) return null;
  const direct = /on (?:this|the) (?:google )?form|in (?:this|the) form|\bgoogle form\b/i.test(raw);
  const parsed = collectFormFields(raw);
  if (parsed.skippedPassword && parsed.fields.length === 0) {
    return { kind: 'refuse', line: 'I do not fill passwords.' };
  }
  if (parsed.fields.length > 0) {
    return { kind: 'form', fields: parsed.fields, skippedPassword: parsed.skippedPassword || undefined };
  }
  if (/^(?:please\s+)?(?:put|type|enter|write|fill)\s+.+\s+(?:in|into|for|as)\s+/i.test(raw)) return null;
  if (direct || /\b(?:form|entries|fields|details)\b/i.test(raw)) {
    return { kind: 'refuse', line: 'Tell me each field and its value. I left the form alone.' };
  }
  return null;
}

function cursorTextBox(raw: string): HandsJob | null {
  const mentionsCursor = /\bcursor\b/i.test(raw);
  const mentionsBox = /\b(?:text\s*box|chat\s*box|input\s*box|message\s*box|textbox|chat\s*panel|prompt\s*box)\b/i.test(raw);
  const asksWrite = /\b(?:likh|type|paste|write|prompt|fill)\b/i.test(raw);
  if (!mentionsCursor || !mentionsBox || !asksWrite) return null;

  let prompt = '';
  const quoted = raw.match(/["“]([^"”]{2,2000})["”]/);
  if (quoted) prompt = quoted[1].trim();
  else {
    const after = raw.match(/\b(?:ki|that)\s*[:,]?\s+([\s\S]{2,2000})$/i);
    if (after) prompt = after[1].trim();
  }
  prompt = prompt
    .replace(/\s+ya\s+kuch\b[\s\S]*$/i, '')
    .replace(/\s+or\s+something\b[\s\S]*$/i, '')
    .replace(/\s+something\s+like\s+that\b[\s\S]*$/i, '')
    .trim();
  if (prompt.length < 2) {
    return { kind: 'refuse', line: 'Tell me the exact words to paste. I left Cursor alone.' };
  }
  const sendNow = /\b(?:send it|send now|press enter|hit enter)\s*$/i.test(raw);
  return { kind: 'editor', prompt, sendNow };
}

function emailJob(recipient: string, body: string): HandsJob | null {
  const message = body.trim();
  if (!message) return null;
  const who = splitRecipient(recipient);
  if (!who.toName && !who.toEmail) return null;
  return {
    kind: 'email',
    toName: who.toName,
    toEmail: who.toEmail,
    subject: subjectFrom(message),
    body: message,
  };
}

export function codeFromText(content: string): string | null {
  const fenced = String(content || '').match(/```(?:\w+)?\r?\n([\s\S]+?)```/);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const trimmed = String(content || '').trim();
  if (trimmed.length > 15 && trimmed.length < 12000 && /[{;}]/.test(trimmed) && /^(?:class |int |public |#include|function |def |const |void |for |while )/m.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function isPasteRequest(raw: string): boolean {
  const code = /\b(?:code|solution|answer|snippet|script)\b/i.test(raw);
  const editor = /\b(?:editor|leetcode|ide)\b/i.test(raw);
  if (/\b(?:paste|insert)\b/i.test(raw) && (code || editor)) return true;
  if (/\bcopy\b/i.test(raw) && code && editor) return true;
  if (/\b(?:paste|insert|type|daal|likh)\s+(?:this|the|my|that|given)?\s*(?:code|solution|answer|script|snippet)\b/i.test(raw)) return true;
  if (/^(?:can\s+you\s+)?(?:please\s+)?paste\s+(?:this|it|the\s+code|code)\b/i.test(raw)) return true;
  if (/\bpaste\s+(?:this|it|code)\s+(?:on|in|into|to)\s+(?:the\s+)?(?:screen|editor|window|leetcode|browser|page|wehre)\b/i.test(raw)) return true;
  if (/\b(?:code|solution)\s+(?:ko\s+)?(?:screen\s+pe\s+|editor\s+me\s+)?paste\s*(?:karo|kardo|kijiye|kar\s*do|krdo)\b/i.test(raw)) return true;
  if (/^paste\s+(?:karo|kardo|kijiye|kar\s*do|it|this)$/i.test(raw)) return true;
  return false;
}

export function wantsSolutionInEditor(raw: string): boolean {
  if (isPasteRequest(raw)) return false;
  const write = /\b(?:write|put|type|place|drop)\b/i.test(raw);
  const code = /\b(?:code|solution|answer)\b/i.test(raw);
  const editor = /\b(?:editor|leetcode)\b/i.test(raw);
  return write && code && editor;
}

export function parseHandsJob(text: string, pending: HandsPending = null): HandsJob | null {
  const raw = clean(text).replace(/[.!?]+$/, '');
  if (!raw || raw.length > 2500) return null;

  if (isPasteRequest(raw)) {
    const codeMatch = raw.match(/```(?:\w+)?\r?\n([\s\S]+?)```/) || raw.match(/`([^`]+)`/);
    return { kind: 'paste', code: codeMatch ? codeMatch[1].trim() : undefined };
  }

  if (/^(?:please\s+)?submit(?:\s+(?:it|the form|this form))?$/i.test(raw)) {
    return { kind: 'confirm', target: 'form' };
  }
  if (/^(?:please\s+)?send the (?:email|mail|draft)$/i.test(raw)) {
    return { kind: 'confirm', target: 'email' };
  }
  if (/^(?:please\s+)?(?:send it|send now|press enter|hit enter)$/i.test(raw)) {
    if (pending === 'email' || pending === 'editor') return { kind: 'confirm', target: pending };
    return null;
  }

  const box = cursorTextBox(raw);
  if (box) return box;

  // Guard: if sentence starts with "email" as a subject / noun rather than a drafting command
  if (!/^(?:please\s+)?email\s+(?:has|is|was|are|were|had|did|does|do|can|could|will|would|should|must|not)\b/i.test(raw)) {
    const emailThat = raw.match(/^(?:please\s+)?email\s+(.+?)\s+that\s+(.+)$/i);
    if (emailThat && !isInvalidEmailRecipient(emailThat[1])) {
      const job = emailJob(emailThat[1], emailThat[2]);
      if (job) return job;
    }

    const emailTo = raw.match(/^(?:please\s+)?(?:write|draft)\s+(?:an\s+)?email\s+to\s+(.+?)\s+(?:that|saying|:)\s+(.+)$/i);
    if (emailTo && !isInvalidEmailRecipient(emailTo[1])) {
      const job = emailJob(emailTo[1], emailTo[2]);
      if (job) return job;
    }
  }

  const editor = raw.match(/^(?:please\s+)?(?:prompt|tell|ask|paste into|paste in)\s+(?:the\s+)?(?:cursor|code editor|editor)\s*[:,-]?\s+(.+)$/i);
  if (editor) {
    let prompt = editor[1].trim();
    let sendNow = false;
    const tail = prompt.match(/\s+and\s+(?:send|run|enter)\s+it$/i);
    if (tail && tail.index !== undefined) {
      sendNow = true;
      prompt = prompt.slice(0, tail.index).trim();
    }
    if (!prompt) return null;
    return { kind: 'editor', prompt, sendNow };
  }

  const listed = formRequest(raw);
  if (listed) return listed;

  const put = raw.match(/^(?:please\s+)?(?:put|type|enter|write|fill)\s+(.+?)\s+(?:in|into|for|as)\s+(?:the\s+)?(.+)$/i);
  if (put && /form|full name|email address|phone/i.test(raw)) {
    const label = put[2].replace(/\s+on (?:this|the) (?:google )?form$/i, '').replace(/\s+in (?:this|the) form$/i, '').trim();
    const value = put[1].trim();
    if (passwordLabel(label)) return { kind: 'refuse', line: 'I do not fill passwords.' };
    if (label && value) return { kind: 'form', fields: [{ label, value }] };
  }

  return null;
}

export function handsApplies(planMode: boolean, text: string, pending: HandsPending = null): HandsJob | null {
  if (planMode) return null;
  return parseHandsJob(text, pending);
}

export type ComposeChange = 'arm' | 'cancel' | 'noop';

export function classifyComposeChange(previous: string, next: string, armed = false, elapsedMs = Number.POSITIVE_INFINITY): ComposeChange {
  if (next === previous) return 'noop';
  const grew = next.length - previous.length;
  if (grew <= 0) return 'cancel';
  if (grew >= 4) return 'arm';
  if (grew >= 1 && elapsedMs <= 70) return 'arm';
  if (armed && grew > 2) return 'arm';
  if (grew <= 2) return 'cancel';
  return 'noop';
}
