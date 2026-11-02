import { MessageScheduler } from './scheduler/MessageScheduler';

export interface SavedPerson {
  name: string;
  phone: string;
}

export type ScheduleTarget =
  | { ok: true; name: string; phone: string }
  | { ok: false; error: string };

/** Indian mobile only. +91, 91, or a 10-digit mobile starting 6–9. */
export function parseIndianMobile(input: string): string | null | 'foreign' | 'bad' {
  const compact = String(input || '').trim().replace(/[\s()-]/g, '');
  if (!compact || /[a-z]/i.test(compact)) return null;
  if (compact.startsWith('+') && !compact.startsWith('+91')) return 'foreign';
  const digits = compact.replace(/\D/g, '');
  let national = '';
  if (compact.startsWith('+91') || compact.startsWith('91')) {
    if (!(compact.startsWith('+91') || digits.length === 12)) return 'bad';
    national = digits.startsWith('91') ? digits.slice(2) : digits;
  } else if (digits.length === 10) {
    national = digits;
  } else {
    return 'bad';
  }
  if (!/^[6-9]\d{9}$/.test(national)) return 'bad';
  return `+91${national}`;
}

function tidy(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function resolveScheduleTarget(input: string, saved: SavedPerson[]): ScheduleTarget {
  const raw = tidy(input);
  if (!raw) return { ok: false, error: 'Enter a saved contact name, or an Indian number starting with +91.' };

  const phone = parseIndianMobile(raw);
  if (phone === 'foreign') return { ok: false, error: 'Only an Indian number starting with +91 can be used.' };
  if (phone === 'bad') return { ok: false, error: 'Use a 10-digit Indian mobile, written as +91.' };
  if (typeof phone === 'string') return { ok: true, name: phone, phone };

  const wanted = raw.toLowerCase();
  const hits = saved.filter((person) => tidy(person.name).toLowerCase() === wanted);
  if (hits.length === 0) {
    return { ok: false, error: `No saved contact is named “${raw}”. Use the +91 number, or save that contact first.` };
  }

  const phones = new Map<string, string>();
  for (const hit of hits) {
    const parsed = parseIndianMobile(hit.phone);
    if (typeof parsed === 'string' && parsed.startsWith('+91')) phones.set(parsed, tidy(hit.name) || raw);
  }
  if (phones.size === 1) {
    const [only] = phones.entries();
    return { ok: true, name: only[1], phone: only[0] };
  }
  if (phones.size > 1) {
    return { ok: false, error: `More than one contact is named “${raw}”. Use the +91 number.` };
  }
  return { ok: false, error: `“${raw}” is saved, but not with an Indian +91 number.` };
}

export function combineLocalDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const when = new Date(`${date}T${time}`);
  if (Number.isNaN(when.getTime())) return null;
  return when;
}

/** 1–12 hour, minute, and AM or PM, on a calendar date. */
export function combineDateAndClock(date: string, hour: string, minute: string, meridiem: 'AM' | 'PM'): Date | null {
  if (!/^(?:[1-9]|1[0-2])$/.test(hour) || !/^(?:[0-9]|[0-5][0-9])$/.test(minute)) return null;
  const h = Number(hour);
  const m = Number(minute);
  let hour24 = h % 12;
  if (meridiem === 'PM') hour24 += 12;
  return combineLocalDateTime(date, `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

export function resolveHomeSchedule(input: { name: string; national: string; saved: SavedPerson[] }): ScheduleTarget {
  const digits = String(input.national || '').replace(/\D/g, '');
  const name = tidy(input.name);
  if (digits) {
    if (digits.length !== 10) return { ok: false, error: 'Enter only the 10 digits after +91.' };
    const phone = parseIndianMobile(`+91${digits}`);
    if (phone !== `+91${digits}`) return { ok: false, error: 'That is not an Indian mobile number. Use the 10 digits after +91.' };
    if (!name) return { ok: true, name: phone, phone };
    const named = resolveScheduleTarget(name, input.saved);
    if (named.ok && named.phone !== phone) {
      return { ok: false, error: `“${name}” is saved with a different number. Clear the name, or use that contact’s number.` };
    }
    return { ok: true, name: named.ok ? named.name : name, phone };
  }
  if (!name) return { ok: false, error: 'Enter a saved contact name, or the 10 digits after +91.' };
  return resolveScheduleTarget(name, input.saved);
}

export async function scheduleWhatsAppMessage(input: {
  name: string;
  national: string;
  message: string;
  when: Date;
  saved: SavedPerson[];
}) {
  const target = resolveHomeSchedule({ name: input.name, national: input.national, saved: input.saved });
  if (!target.ok) return target;
  const text = input.message.trim();
  if (!text) return { ok: false as const, error: 'Write the message first.' };
  if (text.length > 1000) return { ok: false as const, error: 'Keep the message under 1000 characters.' };
  if (input.when.getTime() < Date.now() + 30_000) {
    return { ok: false as const, error: 'Pick a time at least a minute ahead.' };
  }

  const job = await MessageScheduler.schedule({
    platform: 'whatsapp',
    recipient: {
      id: `sched_${target.phone.replace(/\D/g, '')}`,
      name: target.name,
      identifier: target.phone,
      phoneNormalized: target.phone,
      platform: 'whatsapp',
      verified: true
    },
    message: { content: text.slice(0, 1000), contentType: 'text' },
    scheduledAt: input.when.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    clientType: 'web'
  });
  return { ok: true as const, job };
}
