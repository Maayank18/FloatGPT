import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  HelpCircle,
  Key,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { AppState } from '../../types';
import { MeetingTrack, PreBriefItem } from '../../briefing/types';
import {
  deleteBriefing,
  getActiveBriefingId,
  getTavilyApiKey,
  listBriefings,
  saveBriefing,
  saveTavilyApiKey,
  setActiveBriefingId,
} from '../../briefing/preBriefStore';
import { conductPreBriefResearch } from '../../briefing/tavilyClient';
import { synthesizePreBrief } from '../../briefing/preBriefSynthesizer';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { addPdfDocument, cleanupPreBriefTextNotes, listShelf, removeItem } from '../../flowtion/shelf';
import { generatePreBriefPdf, downloadBlob } from '../../briefing/preBriefPdfGenerator';

interface ParsedSection {
  num: string;
  title: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  content: string;
}

function cleanPersonValue(val: string): string {
  return val
    .replace(/#+\s*[A-Za-z0-9_]+/g, '')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
    .replace(/\b\d+[kKmM]?\+?\s*(?:followers|connections|@\w+)\b/gi, '')
    .replace(/\|\s*\d+[kKmM]?\s*@?[A-Za-z0-9_]+\s*\|?/gi, '')
    .replace(/\b(?:Headline|Current role|Seniority|Experience|Connections|Followers):\s*/gi, '')
    .replace(/\|\s*\|/g, '|')
    .replace(/[|•·-]\s*[|•·-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseBriefSections(summary: string): ParsedSection[] {
  const sectionKeywords = [
    {
      num: '1',
      pattern: /(?:^|\n)\s*(?:#{1,4}\s*|\*{1,2})?\s*1?[\.\:\)]?\s*([^\n\*#]*(?:Executive Snapshot|Snapshot|Overview)[^\n\*#]*)/i,
      defaultTitle: '30-Second Executive Snapshot',
    },
    {
      num: '2',
      pattern: /(?:^|\n)\s*(?:#{1,4}\s*|\*{1,2})?\s*2[\.\:\)]\s*([^\n\*#]*(?:Radar|News|Update|Development|Announcement)[^\n\*#]*)/i,
      defaultTitle: 'Last 30 Days Radar (News & Updates)',
    },
    {
      num: '3',
      pattern: /(?:^|\n)\s*(?:#{1,4}\s*|\*{1,2})?\s*3[\.\:\)]\s*([^\n\*#]*(?:Angle|Strategy|Talking|Strategic)[^\n\*#]*)/i,
      defaultTitle: 'Strategic Meeting Angles',
    },
    {
      num: '4',
      pattern: /(?:^|\n)\s*(?:#{1,4}\s*|\*{1,2})?\s*4[\.\:\)]\s*([^\n\*#]*(?:Question|Discussion|Inquiry)[^\n\*#]*)/i,
      defaultTitle: 'Top 3 High-Impact Discussion Questions',
    },
  ];

  const indices: Array<{ num: string; title: string; matchIndex: number; matchLength: number }> = [];
  for (const s of sectionKeywords) {
    const match = summary.match(s.pattern);
    if (match && typeof match.index === 'number') {
      indices.push({
        num: s.num,
        title: (match[1] || s.defaultTitle).trim(),
        matchIndex: match.index,
        matchLength: match[0].length,
      });
    }
  }

  indices.sort((a, b) => a.matchIndex - b.matchIndex);

  const meta: Record<string, { badge: string; badgeColor: string; icon: React.ReactNode }> = {
    '1': {
      badge: 'Executive Snapshot',
      badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      icon: <Sparkles className="w-3.5 h-3.5 text-blue-400" />,
    },
    '2': {
      badge: 'Live Radar',
      badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      icon: <Radio className="w-3.5 h-3.5 text-emerald-400" />,
    },
    '3': {
      badge: 'Strategic Angles',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      icon: <Target className="w-3.5 h-3.5 text-amber-400" />,
    },
    '4': {
      badge: 'Key Questions',
      badgeColor: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
      icon: <HelpCircle className="w-3.5 h-3.5 text-violet-400" />,
    },
  };

  if (indices.length < 2) {
    // Fallback: try splitting by numbered lines if keywords differed
    const parts = summary.split(/(?:^|\n)\s*(?:#{1,4}\s*)?(\d)[\.\)]\s+([^\n]+)/);
    if (parts.length >= 4) {
      const res: ParsedSection[] = [];
      for (let i = 1; i < parts.length; i += 3) {
        const num = parts[i];
        const rawTitle = (parts[i + 1] || '').trim();
        const content = (parts[i + 2] || '').trim();
        const info = meta[num] || {
          badge: `Section ${num}`,
          badgeColor: 'border-card-border bg-panel text-text-muted',
          icon: <Briefcase className="w-3.5 h-3.5 text-accent" />,
        };
        res.push({
          num,
          title: rawTitle,
          badge: info.badge,
          badgeColor: info.badgeColor,
          icon: info.icon,
          content,
        });
      }
      return res;
    }
    return [
      {
        num: '1',
        title: 'Executive Briefing',
        badge: 'Summary',
        badgeColor: 'border-accent/40 bg-accent/10 text-accent',
        icon: <Briefcase className="w-3.5 h-3.5 text-accent" />,
        content: summary,
      },
    ];
  }

  const sections: ParsedSection[] = [];
  for (let i = 0; i < indices.length; i++) {
    const curr = indices[i];
    const startIndex = curr.matchIndex + curr.matchLength;
    const endIndex = i + 1 < indices.length ? indices[i + 1].matchIndex : summary.length;
    const content = summary.slice(startIndex, endIndex).trim();
    const info = meta[curr.num] || {
      badge: `Section ${curr.num}`,
      badgeColor: 'border-card-border bg-panel text-text-muted',
      icon: <Briefcase className="w-3.5 h-3.5 text-accent" />,
    };

    sections.push({
      num: curr.num,
      title: curr.title || `Section ${curr.num}`,
      badge: info.badge,
      badgeColor: info.badgeColor,
      icon: info.icon,
      content,
    });
  }

  return sections;
}

function renderSnapshotBlock(content: string) {
  const rawItems = content
    .split(/(?:^|\n)\s*[-*•]\s+|\s+•\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (rawItems.length === 0) {
    return <MarkdownRenderer content={content} />;
  }

  return (
    <div className="space-y-2">
      {rawItems.map((item, idx) => {
        const colonIdx = item.indexOf(':');
        const hasLabel = colonIdx > 0 && colonIdx < 60;
        const rawLabel = hasLabel ? item.slice(0, colonIdx).replace(/\*\*/g, '').trim() : '';
        const value = hasLabel ? item.slice(colonIdx + 1).trim() : item.trim();

        const isProfile = /profile|role|lead|person|engineer|founder|ceo/i.test(rawLabel);
        const isCompany = /company|organization|context/i.test(rawLabel);
        const isObjective = /objective|meeting|goal|schedule|track/i.test(rawLabel);

        return (
          <div
            key={idx}
            className={`rounded-xl border p-3 space-y-1.5 transition-colors ${
              isProfile
                ? 'border-blue-500/30 bg-blue-500/5'
                : isObjective
                ? 'border-violet-500/30 bg-violet-500/5'
                : 'border-card-border bg-bg-secondary/60'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              {isCompany && <Building2 className="w-3.5 h-3.5 text-blue-400" />}
              {isProfile && <UserCheck className="w-3.5 h-3.5 text-blue-400" />}
              {isObjective && <Target className="w-3.5 h-3.5 text-violet-400" />}
              <span
                className={
                  isProfile
                    ? 'text-blue-400 font-semibold'
                    : isObjective
                    ? 'text-violet-400 font-semibold'
                    : 'text-text-muted font-semibold'
                }
              >
                {rawLabel || `Point ${idx + 1}`}
              </span>
            </div>
            <div className="text-xs text-text-primary leading-relaxed pl-5">
              <MarkdownRenderer content={isProfile ? cleanPersonValue(value) : value} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function cleanRadarText(txt: string): string {
  return txt
    .replace(/(?:Document:\s*)?EX-[0-9.]+\s*\d*\s*[a-z0-9_-]*exhibit[0-9a-z.]*\s*(?:EX-[0-9.]+\s*)?(?:Document\s+Exhibit\s+[0-9.]+\s*)?/gi, '')
    .replace(/(?:Skip to content|Log\s*in\s*Sign\s*up|Sign\s*up\s*Log\s*in|Hire an AI employee|Super-Agents|Agent-to-AgentBenchmarksPricingBlog|Guides \d+|Terms of Service|Privacy Policy|Cookie Policy|All rights reserved)/gi, '')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
    .replace(/\b\d+[kKmM]?\+?\s*(?:followers|connections|@\w+)\b/gi, '')
    .replace(/\|\s*\d+[kKmM]?\s*@?[A-Za-z0-9_]+\s*\|?/gi, '')
    .replace(/#\w+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function renderRadarBlock(content: string) {
  const rawItems = content
    .split(/(?:^|\n)\s*[-*•]\s+|\s+•\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (rawItems.length === 0) {
    return <MarkdownRenderer content={content} />;
  }

  return (
    <div className="space-y-2">
      {rawItems.map((item, idx) => {
        const linkMatch =
          item.match(/\(\[([^\]]+)\]\(([^)]+)\)\)/) ||
          item.match(/\(([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^)]*)\)/);

        let domain = '';
        let url = '';
        let cleanText = item;

        if (linkMatch) {
          domain = linkMatch[1];
          url = linkMatch[2] || `https://${linkMatch[1]}`;
          cleanText = cleanText.replace(linkMatch[0], '').trim();
        }

        // Detect category tag if present: e.g. [Product Launch], [Executive Hire], [Strategic Update]
        let categoryTag = '';
        let categoryColor = 'border-card-border bg-panel text-text-muted';
        const tagMatch = cleanText.match(/^\[(Product Launch|Executive Hire|Strategic Update|News Update|Launch|Hire|Update)\]\s*/i);
        if (tagMatch) {
          const t = tagMatch[1].toLowerCase();
          cleanText = cleanText.slice(tagMatch[0].length).trim();
          if (t.includes('launch')) {
            categoryTag = 'Launch';
            categoryColor = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
          } else if (t.includes('hire')) {
            categoryTag = 'Leadership';
            categoryColor = 'border-blue-500/30 bg-blue-500/10 text-blue-400';
          } else {
            categoryTag = 'Strategic Move';
            categoryColor = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
          }
        }

        const colonIdx = cleanText.indexOf(':');
        const hasTitle = colonIdx > 0 && colonIdx < 110;
        let title = hasTitle ? cleanText.slice(0, colonIdx).replace(/\*\*/g, '').trim() : '';
        let body = hasTitle
          ? cleanText.slice(colonIdx + 1).replace(/\*\*/g, '').trim()
          : cleanText.replace(/\*\*/g, '').trim();

        title = cleanRadarText(title);
        body = cleanRadarText(body);

        return (
          <div
            key={idx}
            className="rounded-xl border border-card-border bg-bg-secondary/50 p-3 space-y-1.5 hover:border-emerald-500/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                {categoryTag && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 border ${categoryColor}`}>
                    {categoryTag}
                  </span>
                )}
                <h4 className="text-xs font-semibold text-text-primary truncate">
                  {title || `Announcement ${idx + 1}`}
                </h4>
              </div>
              {domain && (
                <a
                  href={url || `https://${domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 hover:underline bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded transition-colors"
                >
                  <span className="truncate max-w-[110px]">{domain}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            {body && (
              <p className="text-xs text-text-secondary leading-relaxed pl-3">
                {body}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderAnglesBlock(content: string) {
  const points = content
    .split(/(?:^|\n)\s*[-*•]\s+|\s+•\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (points.length === 0) {
    return <MarkdownRenderer content={content} />;
  }

  return (
    <div className="space-y-2">
      {points.map((pt, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2.5 rounded-xl border border-card-border bg-bg-secondary/50 p-3 hover:border-amber-500/30 transition-colors"
        >
          <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[10px] font-bold text-amber-400 mt-0.5">
            0{idx + 1}
          </span>
          <div className="flex-1 text-xs text-text-primary leading-relaxed">
            <MarkdownRenderer content={pt} />
          </div>
        </div>
      ))}
    </div>
  );
}

function renderQuestionsBlock(
  content: string,
  onCopyQuestion: (q: string, idx: number) => void,
  copiedIdx: number | null
) {
  const questions = content
    .split(/(?:^|\n)\s*[1-9]\d*[\.\)]\s+|\s+[1-9]\d*[\.\)]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (questions.length === 0) {
    return <MarkdownRenderer content={content} />;
  }

  return (
    <div className="space-y-2">
      {questions.map((q, idx) => (
        <div
          key={idx}
          className="group rounded-xl border border-card-border bg-bg-secondary/50 p-3 space-y-1.5 hover:border-violet-500/30 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
              Question {idx + 1}
            </span>
            <button
              type="button"
              onClick={() => onCopyQuestion(q, idx)}
              title="Copy question text"
              className="p-1 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 text-[10px]"
            >
              {copiedIdx === idx ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs font-medium text-text-primary leading-relaxed pl-0.5">
            {q.replace(/^\*\*(.*?)\*\*/, '$1')}
          </p>
        </div>
      ))}
    </div>
  );
}

const TRACKS = [
  'Sales & Pitch',
  'Partnership',
  'Hiring & Interview',
  'Investor & Due Diligence',
  'General',
  'Custom Track / Need...',
] as const;

export function PreBriefPanel({
  onBack,
  onOpenFlowtion,
  state,
}: {
  onBack: () => void;
  onOpenFlowtion?: () => void;
  state: AppState;
}) {
  const [briefings, setBriefings] = useState<PreBriefItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Form state
  const [company, setCompany] = useState('');
  const [person, setPerson] = useState('');
  const [track, setTrack] = useState<string>('Sales & Pitch');
  const [customTrack, setCustomTrack] = useState('');
  const [meetingTime, setMeetingTime] = useState('Today at 4:00 PM');
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Key state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySavedToast, setKeySavedToast] = useState(false);

  // UI feedback
  const [copied, setCopied] = useState(false);
  const [flowtionToast, setFlowtionToast] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copiedQuestionIdx, setCopiedQuestionIdx] = useState<number | null>(null);

  const handleCopyQuestion = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionIdx(idx);
    setTimeout(() => setCopiedQuestionIdx(null), 1800);
  };

  const refreshData = async () => {
    cleanupPreBriefTextNotes().catch(() => {});
    const list = await listBriefings();
    setBriefings(list);
    const active = await getActiveBriefingId();
    if (active && list.some((b) => b.id === active)) {
      setActiveId(active);
      setIsCreating(false);
    } else if (list.length > 0) {
      setActiveId(list[0].id);
      setIsCreating(false);
    } else {
      setActiveId(null);
      setIsCreating(true);
    }
  };

  useEffect(() => {
    refreshData().catch(() => {});
    setApiKeyInput(getTavilyApiKey());
  }, []);

  const activeBrief = briefings.find((b) => b.id === activeId) || null;

  const handleSaveKey = (e?: React.FormEvent) => {
    e?.preventDefault();
    saveTavilyApiKey(apiKeyInput.trim());
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 2200);
    setShowKeyModal(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCompany = company.trim();
    if (!cleanCompany) return;

    const isCustom = track === 'Custom Track / Need...';
    const effectiveTrack = isCustom ? (customTrack.trim() || 'Custom Need') : track;
    const cleanCustomNeed = isCustom ? customTrack.trim() : undefined;

    const currentKey = getTavilyApiKey();
    if (!currentKey) {
      setShowKeyModal(true);
      setErrorMsg('Tavily API key is required to research recent announcements.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    setStatusText('Querying Tavily for company news & person background...');

    try {
      const research = await conductPreBriefResearch({
        apiKey: currentKey,
        company: cleanCompany,
        person: person.trim() || undefined,
        meetingTrack: effectiveTrack,
        customTrack: cleanCustomNeed,
      });

      setStatusText('Synthesizing 1-page executive brief...');

      const summary = await synthesizePreBrief({
        company: cleanCompany,
        person: person.trim() || undefined,
        meetingTrack: effectiveTrack,
        customNeed: cleanCustomNeed,
        meetingTime: meetingTime.trim() || undefined,
        sources: research.sources,
        companySources: research.companySources,
        personSources: research.personSources,
        answerNotes: research.answerNotes,
        state,
      });

      const newItem: PreBriefItem = {
        id: `brief_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        company: cleanCompany,
        person: person.trim() || undefined,
        meetingTrack: effectiveTrack,
        customTrack: cleanCustomNeed,
        meetingTime: meetingTime.trim() || undefined,
        createdAt: Date.now(),
        summary,
        sources: research.sources,
        status: 'ready',
      };

      await saveBriefing(newItem);
      setBriefings((prev) => [newItem, ...prev.filter((b) => b.id !== newItem.id)]);
      setActiveId(newItem.id);
      setIsCreating(false);
      setCompany('');
      setPerson('');
      setCustomTrack('');

      // Automatically add to Flowtion shelf: strictly the Detailed PDF Dossier
      try {
        const { blob, filename } = generatePreBriefPdf(newItem);
        await addPdfDocument(filename, blob);
        await cleanupPreBriefTextNotes().catch(() => {});
        setFlowtionToast('Auto-saved PDF Dossier to Flowtion!');
        setTimeout(() => setFlowtionToast(''), 3000);
      } catch (flowtionErr) {
        console.warn('[PreBrief] Automatic Flowtion sync failed:', flowtionErr);
      }
    } catch (err: any) {
      console.error('[PreBrief] Error generating brief:', err);
      setErrorMsg(err.message || 'Failed to generate briefing. Please check your API key.');
    } finally {
      setBusy(false);
      setStatusText('');
    }
  };

  const handleDownloadPdf = () => {
    if (!activeBrief) return;
    try {
      const { blob, filename } = generatePreBriefPdf(activeBrief);
      downloadBlob(blob, filename);
      setFlowtionToast(`Downloaded ${filename}`);
      setTimeout(() => setFlowtionToast(''), 2500);
    } catch (err) {
      console.error('[PreBrief] PDF download error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    const toDelete = briefings.find((b) => b.id === id);
    await deleteBriefing(id);
    if (toDelete) {
      try {
        const companyClean = toDelete.company.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${companyClean}_PreBrief_Dossier.pdf`.toLowerCase();
        const shelf = await listShelf();
        const match = shelf.find((it) => it.name.toLowerCase() === filename);
        if (match) {
          await removeItem(match.id);
        }
      } catch (err) {
        console.warn('[PreBrief] Error removing PDF from shelf on delete:', err);
      }
    }
    const updated = briefings.filter((b) => b.id !== id);
    setBriefings(updated);
    if (updated.length > 0) {
      setActiveId(updated[0].id);
      await setActiveBriefingId(updated[0].id);
    } else {
      setActiveId(null);
      setIsCreating(true);
    }
  };

  const handleCopy = () => {
    if (!activeBrief) return;
    const textToCopy = `# PreBrief: ${activeBrief.company}${activeBrief.person ? ` — ${activeBrief.person}` : ''}\nMeeting Track: ${activeBrief.meetingTrack}\n\n${activeBrief.summary}\n\n---\nSources:\n${activeBrief.sources.map((s, i) => `${i + 1}. ${s.title}: ${s.url}`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToFlowtion = async () => {
    if (!activeBrief) return;
    try {
      const { blob, filename } = generatePreBriefPdf(activeBrief);
      const res = await addPdfDocument(filename, blob);
      await cleanupPreBriefTextNotes().catch(() => {});
      if (res.ok) {
        setFlowtionToast('Saved PDF Dossier to Flowtion!');
      } else {
        setFlowtionToast(res.error || 'Could not save to Flowtion.');
      }
    } catch {
      setFlowtionToast('Could not save PDF to Flowtion.');
    }
    setTimeout(() => setFlowtionToast(''), 2500);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-card-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-panel-hover"
            aria-label="Back to Home"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <Briefcase className="w-4 h-4 text-accent shrink-0" />
            <span className="text-xs font-semibold text-text-primary truncate">PreBrief</span>
            <span className="text-[10px] font-medium text-text-muted bg-panel border border-card-border px-1.5 py-0.5 rounded shrink-0">
              Intel
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowKeyModal(!showKeyModal)}
            title="Tavily API Key Settings"
            className="p-1.5 rounded-lg border border-card-border bg-card hover:border-accent text-text-muted hover:text-text-primary transition-colors"
          >
            <Key className="w-3.5 h-3.5" />
          </button>
          {!isCreating && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              title="New Research Briefing"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}
        </div>
      </div>

      {/* Tavily Key Settings Dropdown Drawer */}
      {showKeyModal && (
        <div className="border-b border-card-border bg-panel p-3.5 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-accent" />
              Tavily API Key
            </span>
            <a
              href="https://tavily.com"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
            >
              Get credits <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <form onSubmit={handleSaveKey} className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="tvly-xxxxxxxxxxxxxxxxxxxx"
              className="flex-1 min-w-0 bg-bg border border-card-border rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-accent text-white hover:bg-accent-hover shrink-0"
            >
              Save
            </button>
          </form>
          <p className="text-[10px] text-text-muted leading-tight">
            Key stays on this PC in IndexedDB. You can also add <code>VITE_TAVILY_API_KEY</code> in <code>.env</code>.
          </p>
        </div>
      )}

      {keySavedToast && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-3 py-1.5 text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> Tavily API Key saved successfully.
        </div>
      )}

      {/* Body Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
        {isCreating ? (
          /* CREATE BRIEFING FORM */
          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-text-primary">Research a Meeting</h4>
                <p className="text-[11px] text-text-muted">
                  Pulls verified news & executive announcements from the preceding 30 days.
                </p>
              </div>
              {briefings.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-text-muted hover:text-text-primary underline"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
                Company Name *
              </label>
              <input
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Stripe, Linear, NVIDIA, Anthropic"
                className="w-full bg-bg-secondary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
                Person / Key Role (Optional)
              </label>
              <input
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="e.g. Patrick Collison (CEO), Head of Partnerships"
                className="w-full bg-bg-secondary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
                  Meeting Track
                </label>
                <select
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  className="w-full bg-bg-secondary border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  {TRACKS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
                  Meeting Time
                </label>
                <input
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  placeholder="e.g. Tomorrow at 3 PM"
                  className="w-full bg-bg-secondary border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {track === 'Custom Track / Need...' && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-accent block">
                  Custom Meeting Track / Need *
                </label>
                <input
                  required
                  value={customTrack}
                  onChange={(e) => setCustomTrack(e.target.value)}
                  placeholder="e.g. SDE-2 System Design Interview, Architecture Review, Salary Negotiation"
                  className="w-full bg-bg-secondary border border-accent/40 rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted/60"
                />
              </div>
            )}

            {errorMsg && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400 leading-relaxed">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !company.trim()}
              className="w-full mt-2 py-2.5 px-4 text-xs font-semibold rounded-xl bg-accent text-white hover:bg-accent-hover disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {busy ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{statusText || 'Researching...'}</span>
                </>
              ) : (
                <>
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Generate 1-Page Briefing</span>
                </>
              )}
            </button>
          </form>
        ) : activeBrief ? (
          /* ACTIVE BRIEFING DISPLAY */
          <div className="space-y-3 pb-3">
            {/* Briefing Switcher / Meta Bar */}
            <div className="flex items-center justify-between gap-2 bg-panel border border-card-border rounded-xl px-3 py-2">
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1.5 w-full text-left"
                >
                  <span className="text-xs font-bold text-text-primary truncate">
                    {activeBrief.company}
                  </span>
                  {activeBrief.person && (
                    <span className="text-xs text-text-secondary truncate">
                      · {activeBrief.person}
                    </span>
                  )}
                  {briefings.length > 1 && (
                    <ChevronDown className="w-3 h-3 text-text-muted shrink-0 ml-auto" />
                  )}
                </button>

                {dropdownOpen && briefings.length > 1 && (
                  <div className="absolute top-[130%] left-0 w-full max-h-48 overflow-y-auto bg-card border border-card-border rounded-xl shadow-2xl p-1 z-30 space-y-0.5">
                    {briefings.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setActiveId(b.id);
                          setActiveBriefingId(b.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate transition-colors ${
                          b.id === activeBrief.id
                            ? 'bg-accent/20 text-accent font-semibold'
                            : 'text-text-primary hover:bg-panel'
                        }`}
                      >
                        {b.company} {b.person ? `(${b.person})` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-[10px] font-semibold text-text-muted bg-bg border border-card-border px-2 py-0.5 rounded-full shrink-0">
                {activeBrief.meetingTrack}
              </span>
            </div>

            {/* Auto-saved to Flowtion Banner */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] font-medium text-emerald-400">
              <div className="flex items-center gap-1.5 min-w-0">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Auto-saved to Flowtion as Detailed PDF Dossier</span>
              </div>
              {onOpenFlowtion && (
                <button
                  type="button"
                  onClick={onOpenFlowtion}
                  className="inline-flex items-center gap-1 underline hover:text-emerald-300 shrink-0 font-semibold cursor-pointer"
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>Open</span>
                </button>
              )}
            </div>

            {/* Structured Executive Blocks */}
            <div className="space-y-3">
              {parseBriefSections(activeBrief.summary).map((sec) => (
                <div
                  key={sec.num}
                  className="rounded-xl border border-card-border bg-card p-3.5 shadow-sm space-y-2.5 transition-colors hover:border-card-border/80"
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-card-border/60 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-bg">
                        {sec.icon}
                      </div>
                      <h3 className="text-xs font-bold text-text-primary truncate">
                        {sec.title}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sec.badgeColor}`}
                    >
                      {sec.badge}
                    </span>
                  </div>

                  {/* Block Content */}
                  <div className="text-xs leading-relaxed text-text-primary space-y-2">
                    {sec.num === '1'
                      ? renderSnapshotBlock(sec.content)
                      : sec.num === '2'
                      ? renderRadarBlock(sec.content)
                      : sec.num === '3'
                      ? renderAnglesBlock(sec.content)
                      : sec.num === '4'
                      ? renderQuestionsBlock(sec.content, handleCopyQuestion, copiedQuestionIdx)
                      : (
                        <div className="pl-0.5">
                          <MarkdownRenderer content={sec.content} />
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {/* Verified Sources Tray */}
            {activeBrief.sources && activeBrief.sources.length > 0 && (
              <div className="bg-panel border border-card-border rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Verified Sources (Last 30 Days)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeBrief.sources.map((s, idx) => (
                    <a
                      key={`${s.url}-${idx}`}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-card-border bg-bg px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-accent hover:border-accent transition-colors"
                    >
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate max-w-[130px]">{s.domain}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadPdf}
                title="Download formatted executive PDF"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-card-border bg-card hover:bg-bg-secondary text-xs font-semibold text-text-primary transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                <span>PDF</span>
              </button>

              {onOpenFlowtion ? (
                <button
                  type="button"
                  onClick={onOpenFlowtion}
                  title="Open in Flowtion"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-card-border bg-card hover:bg-bg-secondary text-xs font-semibold text-emerald-400 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Flowtion</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveToFlowtion}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-card-border bg-card hover:bg-bg-secondary text-xs font-semibold text-text-primary transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-accent" />
                  <span>Flowtion</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                title="Copy markdown text"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-card-border bg-card hover:bg-bg-secondary text-xs font-semibold text-text-primary transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDelete(activeBrief.id)}
                title="Delete this briefing"
                className="p-2 rounded-lg border border-card-border bg-card hover:border-red-500/40 text-text-muted hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {flowtionToast && (
              <p className="text-center text-[11px] font-medium text-accent animate-in fade-in">
                {flowtionToast}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

