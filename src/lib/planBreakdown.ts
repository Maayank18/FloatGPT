import type { PlanStep } from './planFromRequest';

export type BrokenPlan = {
  title: string;
  deadlineAt?: number;
  steps: PlanStep[];
};

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pretty(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function dateIn(text: string, now: Date): { at: number; label: string } | null {
  const match = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?:\s+(\d{4}))?\b/i)
    || text.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/i);
  if (!match) return null;
  const monthFirst = Number.isNaN(Number(match[1]));
  const day = Number(monthFirst ? match[2] : match[1]);
  const monthName = (monthFirst ? match[1] : match[2]).toLowerCase();
  const year = match[3] ? Number(match[3]) : undefined;
  const month = MONTHS[monthName];
  if (!month && month !== 0) return null;
  if (day < 1 || day > 31) return null;
  const when = new Date(now);
  when.setFullYear(year || now.getFullYear(), month, day);
  when.setHours(23, 59, 0, 0);
  if (!year && when.getTime() < now.getTime() - 36 * 60 * 60 * 1000) when.setFullYear(when.getFullYear() + 1);
  return { at: when.getTime(), label: `${day} ${MONTH_NAMES[month]}` };
}

function kindOf(text: string): string {
  if (/\bhackathon\b|\bcodefest\b/i.test(text)) return 'hackathon';
  if (/\binterview\b/i.test(text)) return 'interview';
  if (/\b(exam|midterm|viva)\b/i.test(text)) return 'exam';
  if (/\b(presentation|demo|pitch)\b/i.test(text)) return 'presentation';
  if (/\bmeeting\b/i.test(text)) return 'meeting';
  if (/\b(trip|flight|travel)\b/i.test(text)) return 'trip';
  if (/\b(submit|assignment|homework)\b/i.test(text)) return 'submission';
  return 'general';
}

function stamp(steps: PlanStep[], deadlineAt?: number): PlanStep[] {
  if (deadlineAt && steps.length) steps[steps.length - 1].deadlineAt = deadlineAt;
  return steps;
}

function named(text: string, label: string): string {
  const who = text.match(new RegExp(`\\b${label}\\s+with\\s+([a-z][a-z .'-]{1,40})`, 'i'));
  if (!who) return pretty(label);
  const name = who[1].replace(/\b(tomorrow|today|tonight|please|on|at)\b.*$/i, '').trim();
  return name ? `${pretty(label)} with ${pretty(name)}` : pretty(label);
}

function generalTitle(text: string): string {
  const cleaned = text
    .replace(/\b(if i (?:get|got) selected|if got selected|i have|i've got|i need to|i want to|gotta|gotch|please|so that|so)\b/gi, ' ')
    .replace(/\b(?:on the|on)\s+\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+\b/gi, ' ')
    .replace(/\b(adn|and)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return pretty(cleaned) || 'This plan';
}

/** Turn one sentence into the next few steps. The first step is the one to do now. */
export function breakDown(text: string, now = new Date()): BrokenPlan {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  const dated = dateIn(source, now);
  const deadlineAt = dated?.at;
  const kind = kindOf(source);
  const conditional = /\b(if|selected|selection|shortlist)\b/i.test(source);

  let title = 'This plan';
  let steps: PlanStep[] = [];

  if (kind === 'hackathon') {
    title = 'Hackathon';
    steps = [
      ...(conditional ? [{ title: 'Confirm you are selected' }] : []),
      { title: 'Read the rules and the theme' },
      { title: 'Choose what you will build' },
      { title: 'Prepare what you will show' },
      { title: 'Rehearse it once out loud' },
      { title: 'Present at the hackathon', deadlineAt },
    ];
  } else if (kind === 'interview') {
    title = named(source, 'interview');
    steps = [
      { title: 'Read what the interview is for' },
      { title: 'Write three things you want them to remember' },
      { title: 'Rehearse the answers once out loud' },
      { title: 'Do the interview', deadlineAt },
    ];
  } else if (kind === 'exam') {
    title = 'Exam';
    steps = [
      { title: 'List what the exam covers' },
      { title: 'Study the first topic' },
      { title: 'Do one practice set' },
      { title: 'Review what you missed' },
      { title: 'Sit the exam', deadlineAt },
    ];
  } else if (kind === 'presentation') {
    title = named(source, kind === 'presentation' ? 'presentation' : 'presentation');
    if (/\bpitch\b/i.test(source)) title = 'Pitch';
    else if (/\bdemo\b/i.test(source)) title = 'Demo';
    steps = [
      { title: 'Decide the one point you need to land' },
      { title: 'Prepare what you will show' },
      { title: 'Rehearse it once out loud' },
      { title: 'Give it', deadlineAt },
    ];
  } else if (kind === 'meeting') {
    title = named(source, 'meeting');
    steps = [
      { title: 'Check the time is free' },
      { title: 'Write the notes' },
      { title: 'Get what you will show ready' },
      { title: title, deadlineAt },
    ];
  } else if (kind === 'trip') {
    title = 'Trip';
    steps = [
      { title: 'Check the time and what to carry' },
      { title: 'Pack' },
      { title: 'Leave', deadlineAt },
    ];
  } else if (kind === 'submission') {
    title = 'Submission';
    steps = [
      { title: 'Read the brief' },
      { title: 'Draft it' },
      { title: 'Check it once' },
      { title: 'Submit it', deadlineAt },
    ];
  } else {
    title = generalTitle(source);
    const rehearse = /\b(rehears|practic)\b/i.test(source);
    const prepare = /\bprepar/i.test(source);
    steps = [
      { title: `Open ${title} and name the first piece` },
      ...(prepare ? [{ title: 'Prepare that piece' }] : []),
      ...(rehearse ? [{ title: 'Rehearse it once' }] : []),
      { title: prepare || rehearse ? `Finish ${title}` : `Do the first piece of ${title}` },
      { title: `Check it, then you are done`, deadlineAt },
    ];
  }

  const seen = new Set<string>();
  steps = stamp(steps.filter((step) => {
    const key = step.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }), deadlineAt);
  return { title, deadlineAt, steps };
}
