import React, { useEffect, useMemo, useState } from 'react';
import { AppState } from '../../types';
import { ChevronLeft, ChevronRight, Library, ShoppingCart } from 'lucide-react';
import { PriceComparePanel } from './PriceComparePanel';
import { FlowtionPanel } from './FlowtionPanel';
import { shelfCount } from '../../flowtion/shelf';
import { ContactStore } from '../../agents/messenger/core/ContactStore';
import { MessageJobStore } from '../../agents/messenger/scheduler/MessageJobStore';
import { MessageScheduler } from '../../agents/messenger/scheduler/MessageScheduler';
import { ScheduledMessageJob } from '../../agents/messenger/types/messenger.types';
import { combineDateAndClock, resolveHomeSchedule, SavedPerson, scheduleWhatsAppMessage } from '../../agents/messenger/scheduleDraft';

const VISIBLE = new Set(['SCHEDULED', 'OVERDUE_PENDING', 'FAILED', 'EXECUTING']);

function WhatsAppMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#25D366"
        d="M20.52 3.48A11.86 11.86 0 0 0 12.04 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.73 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.41-8.43zM12.04 21.8h-.01a9.86 9.86 0 0 1-5.02-1.37l-.36-.21-3.74.98 1-3.65-.23-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.9 9.88zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35z"
      />
    </svg>
  );
}

function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function whenLabel(epoch: number): string {
  return new Date(epoch).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function HomePanel(_props: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>>, onOpenPlan?: () => void }) {
  const [page, setPage] = useState<'home' | 'whatsapp' | 'prices' | 'flowtion'>('home');
  const [flowtionCount, setFlowtionCount] = useState(0);
  const [contact, setContact] = useState('');
  const [national, setNational] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(todayInput);
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>('AM');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const [devicePeople, setDevicePeople] = useState<SavedPerson[]>([]);
  const [linkPeople, setLinkPeople] = useState<SavedPerson[]>([]);
  const [jobs, setJobs] = useState<ScheduledMessageJob[]>([]);

  const saved = useMemo(() => [...devicePeople, ...linkPeople], [devicePeople, linkPeople]);

  const refresh = async () => {
    const [book, stored] = await Promise.all([ContactStore.getAll(), MessageJobStore.getAll()]);
    setDevicePeople(book.filter((item) => item.platform === 'whatsapp').map((item) => ({
      name: item.name,
      phone: item.phoneNormalized || item.identifier
    })));
    setJobs(
      stored
        .filter((job) => job.platform === 'whatsapp' && VISIBLE.has(job.status))
        .sort((a, b) => a.scheduledEpochMs - b.scheduledEpochMs)
    );
    const status = await window.electronAPI?.whatsapp?.linkedStatus?.();
    if (!status) return;
    setLinked(!!status.linked);
    setLinkPeople((status.contacts || []).map((item) => ({ name: item.name, phone: item.phone })));
  };

  useEffect(() => {
    let stop = false;
    refresh().catch(() => {});
    const unsub = window.electronAPI?.whatsapp?.onLinked?.((status) => {
      if (stop) return;
      setLinked(!!status.linked);
      setLinkPeople((status.contacts || []).map((item) => ({ name: item.name, phone: item.phone })));
    });
    shelfCount().then(setFlowtionCount).catch(() => {});
    const timer = window.setInterval(() => { refresh().catch(() => {}); }, 15000);
    return () => {
      stop = true;
      unsub?.();
      window.clearInterval(timer);
    };
  }, []);

  const schedule = async (event: React.FormEvent) => {
    event.preventDefault();
    setProblem('');
    setNote('');
    const when = combineDateAndClock(date, hour, minute, meridiem);
    if (!when) {
      setProblem('Choose the date, the hour, the minute, and AM or PM.');
      return;
    }
    const target = resolveHomeSchedule({ name: contact, national, saved });
    if (!target.ok) {
      setProblem(target.error);
      return;
    }
    setBusy(true);
    try {
      const result = await scheduleWhatsAppMessage({ name: contact, national, message, when, saved });
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      setMessage('');
      setNational('');
      setHour('');
      setMinute('');
      setNote(`Scheduled for ${whenLabel(when.getTime())} to ${target.name}.`);
      await refresh();
    } catch (err: any) {
      setProblem(err?.message || 'That message could not be scheduled.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    await MessageScheduler.cancelJob(id);
    await refresh();
  };

  const sendMissed = async (job: ScheduledMessageJob) => {
    setBusy(true);
    setProblem('');
    try {
      const result = await MessageScheduler.executeJob(job);
      if (!result.success) setProblem(result.error || 'That message did not send.');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
  const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
  const preview = combineDateAndClock(date, hour, minute, meridiem);

  if (page === 'prices') {
    return <PriceComparePanel onBack={() => setPage('home')} />;
  }

  if (page === 'flowtion') {
    return <FlowtionPanel onBack={() => { setPage('home'); shelfCount().then(setFlowtionCount).catch(() => {}); }} />;
  }

  if (page === 'whatsapp') {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-bg">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-card-border bg-bg-secondary">
          <button
            type="button"
            onClick={() => setPage('home')}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-panel-hover"
            aria-label="Back to Home"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <WhatsAppMark />
          <h3 className="text-sm font-semibold text-text-primary leading-snug">Schedule a WhatsApp message</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <form onSubmit={schedule} className="space-y-3">
            <p className="text-xs text-text-secondary leading-relaxed">
              {linked
                ? 'It sends from the linked phone while FloatGPT is open.'
                : 'Link WhatsApp once in Settings → Messaging before the send time.'}
            </p>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Contact name</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                list="floatgpt-saved-contacts"
                placeholder="Saved name, if you have one"
                className="w-full bg-bg-secondary border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </label>
            <datalist id="floatgpt-saved-contacts">
              {saved.map((person) => (
                <option key={`${person.name}-${person.phone}`} value={person.name} />
              ))}
            </datalist>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Mobile number</span>
              <span className="flex items-center bg-bg-secondary border border-card-border rounded-md overflow-hidden focus-within:border-accent">
                <span className="px-3 py-1.5 text-xs font-semibold text-text-primary border-r border-card-border">+91</span>
                <input
                  value={national}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  placeholder="10-digit number"
                  aria-label="10-digit mobile number after +91"
                  onChange={(event) => setNational(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="flex-1 min-w-0 bg-transparent px-3 py-1.5 text-xs text-text-primary focus:outline-none"
                />
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Message</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="What should be sent"
                className="w-full resize-none bg-bg-secondary border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Date</span>
              <input
                type="date"
                value={date}
                min={todayInput()}
                onChange={(event) => setDate(event.target.value)}
                className="w-full bg-bg-secondary border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </label>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Time</span>
              <div className="flex items-center gap-2">
                <select
                  value={hour}
                  onChange={(event) => setHour(event.target.value)}
                  aria-label="Hour"
                  className="flex-1 bg-bg-secondary border border-card-border rounded-md px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Hour</option>
                  {hours.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select
                  value={minute}
                  onChange={(event) => setMinute(event.target.value)}
                  aria-label="Minute"
                  className="flex-1 bg-bg-secondary border border-card-border rounded-md px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Min</option>
                  {minutes.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <div className="flex bg-bg-secondary border border-card-border rounded-md p-0.5 shrink-0">
                  {(['AM', 'PM'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMeridiem(value)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded ${meridiem === value ? 'bg-accent text-white' : 'text-text-muted'}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {preview && (
                <p className="text-[11px] text-text-secondary">
                  {preview.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' at '}
                  {preview.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white disabled:opacity-60"
            >
              Schedule
            </button>
            {problem && <p className="text-xs text-text-secondary leading-relaxed">{problem}</p>}
            {note && <p className="text-xs text-text-primary leading-relaxed">{note}</p>}
          </form>

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Scheduled</h3>
            {jobs.length === 0 ? (
              <p className="text-xs text-text-secondary">Nothing is waiting to send.</p>
            ) : (
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                {jobs.map((job) => (
                  <div key={job.id} className="px-4 py-2.5 border-b border-card-border last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">{job.recipient.name}</p>
                        <p className="text-[11px] text-text-secondary mt-0.5">{whenLabel(job.scheduledEpochMs)}</p>
                        <p className="text-[11px] text-text-muted mt-1 line-clamp-2">{job.message.content}</p>
                        {job.status === 'FAILED' && job.error && (
                          <p className="text-[11px] text-text-secondary mt-1">{job.error}</p>
                        )}
                        {job.status === 'OVERDUE_PENDING' && (
                          <p className="text-[11px] text-text-secondary mt-1">This time passed while the app was closed.</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {job.status === 'OVERDUE_PENDING' && (
                          <button type="button" disabled={busy} onClick={() => sendMissed(job)} className="text-[10px] font-semibold text-accent">Send now</button>
                        )}
                        {job.status === 'SCHEDULED' && (
                          <button type="button" onClick={() => cancel(job.id)} className="text-[10px] font-semibold text-text-muted hover:text-text-primary">Cancel</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      <button
        type="button"
        onClick={() => setPage('whatsapp')}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-card border border-card-border rounded-xl hover:bg-bg-secondary"
      >
        <span className="flex items-center gap-2 min-w-0">
          <WhatsAppMark className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold text-text-primary">Schedule a WhatsApp message</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {jobs.length > 0 && (
            <span className="text-[10px] font-semibold text-text-muted">{jobs.length}</span>
          )}
          <ChevronRight className="w-4 h-4 text-text-muted" />
        </span>
      </button>
      <button
        type="button"
        onClick={() => setPage('prices')}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-card border border-card-border rounded-xl hover:bg-bg-secondary"
      >
        <span className="flex items-center gap-2 min-w-0">
          <ShoppingCart className="w-4 h-4 text-accent shrink-0" />
          <span className="text-sm font-semibold text-text-primary">Compare prices</span>
        </span>
        <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
      </button>
      <button
        type="button"
        onClick={() => setPage('flowtion')}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-card border border-card-border rounded-xl hover:bg-bg-secondary"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Library className="w-4 h-4 text-accent shrink-0" />
          <span className="text-sm font-semibold text-text-primary">Flowtion</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {flowtionCount > 0 && (
            <span className="text-[10px] font-semibold text-text-muted">{flowtionCount}</span>
          )}
          <ChevronRight className="w-4 h-4 text-text-muted" />
        </span>
      </button>
      <p className="px-1 pt-1 text-[11px] text-text-muted">More to come.</p>
    </div>
  );
}
