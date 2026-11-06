import { BriefSource, MeetingTrack } from './types';
import { generateAIResponse } from '../ai/orchestrator';
import { AppState } from '../types';
import { cleanPersonSnippet, cleanTitle, cleanSnippet } from './tavilyClient';

export function formatSourcesMarkdown(sources: BriefSource[]): string {
  if (!sources || sources.length === 0) return '_No external sources retrieved._';
  return sources
    .map((s, idx) => `[${idx + 1}] [${s.title}](${s.url}) · _${s.domain}_${s.publishedDate ? ` (${s.publishedDate.slice(0, 10)})` : ''}`)
    .join('\n');
}

export function formatAnalyticalSnippet(text: string, maxChars = 180): string {
  if (!text) return '';
  const clean = text
    .replace(/â€¢/g, '')
    .replace(/^[•·\u2022\u2219\u25E6\u25AA\u25CF\-\*\s]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const result = lastSpace > 50 ? cut.slice(0, lastSpace) : cut;
  return result.replace(/[,;:\-\s]+$/, '') + '...';
}

export function classifyDevelopment(s: BriefSource): { tag: string; blockCategory: 'launch' | 'hire' | 'update' } {
  const combined = `${s.title} ${s.snippet || ''}`.toLowerCase();

  // Leadership & Executive Moves
  if (
    s.category === 'hire' ||
    /\b(hire|hired|appoint|appointed|appointment|joined|joins|named|director|vp|vice president|chief|ceo|cto|cfo|coo|leadership|executive|head of)\b/i.test(combined)
  ) {
    return { tag: '[Executive Hire]', blockCategory: 'hire' };
  }

  // Real Product & Technical Releases
  if (
    s.category === 'launch' ||
    /\b(launch|launched|launches|release|released|releases|unveil|unveiled|unveils|v\d+(\.\d+)?|version|beta|sdk|api|platform|tool|app|feature|solution|rollout)\b/i.test(combined)
  ) {
    return { tag: '[Product Launch]', blockCategory: 'launch' };
  }

  // Strategic Deals, Partnerships & Funding
  if (
    /\b(partner|partnership|invest|investment|funding|round|seed|series\s+[a-z]|acquire|acquisition|merger|deal|contract|collaborat|alliance)\b/i.test(combined)
  ) {
    return { tag: '[Strategic Deal]', blockCategory: 'update' };
  }

  return { tag: '[Strategic Update]', blockCategory: 'update' };
}

export async function synthesizePreBrief(params: {
  company: string;
  person?: string;
  meetingTrack: MeetingTrack | string;
  meetingTime?: string;
  customNeed?: string;
  sources: BriefSource[];
  companySources?: BriefSource[];
  personSources?: BriefSource[];
  answerNotes?: string[];
  state?: AppState;
}): Promise<string> {
  const {
    company,
    person,
    meetingTrack,
    meetingTime,
    customNeed,
    sources,
    companySources = [],
    personSources = [],
    answerNotes = [],
    state,
  } = params;

  const effectiveGoal = (customNeed && customNeed.trim()) ? customNeed.trim() : meetingTrack;

  // Build condensed, token-efficient research blocks
  const personResearch = personSources
    .map((s, i) => `[Person ${i + 1}] ${s.title} (${s.domain}): ${formatAnalyticalSnippet(s.snippet || '', 200)}`)
    .join('\n');

  const companyResearch = (companySources.length > 0 ? companySources : sources)
    .slice(0, 6)
    .map((s, i) => `[Source ${i + 1}] ${s.title} (${s.domain}): ${formatAnalyticalSnippet(s.snippet || '', 200)} (URL: ${s.url})`)
    .join('\n');

  const extraNotes = answerNotes.length > 0 ? `Key Highlights:\n${answerNotes.map((a) => `• ${formatAnalyticalSnippet(a, 200)}`).join('\n')}` : '';

  const prompt = `You are an elite Executive Pre-Meeting Intelligence Agent for FloatGPT.
Your task is to synthesize verified web intelligence into a razor-sharp, ONE-PAGE executive pre-meeting brief.

TARGET DETAILS:
- Organization: ${company}
- Key Stakeholder: ${person || 'Key Decision Maker'}
- Meeting Track: ${meetingTrack}
- Specific Meeting Focus / Need: ${effectiveGoal}
- Scheduled Meeting Time: ${meetingTime || 'Upcoming Call'}

${person ? `PERSON RESEARCH:\n${personResearch || 'No direct public profiles returned in recent queries.'}\n` : ''}
COMPANY RESEARCH (PRECEDING 30 DAYS):
${companyResearch || 'No verified announcements verified in the preceding 30 days.'}
${extraNotes}

STRICT ANTI-HALLUCINATION & FORMATTING RULES:
1. Ground all claims in the verified research. Never invent facts, roles, or metrics.
2. If researching a person, dedicate a specific bullet under Section 1 detailing their title, seniority, background, and functional domain.
3. In Section 2 (Last 30 Days Radar), partition updates into 3 distinct sub-blocks:
   - Product Launches & Technical Releases
   - Leadership & Executive Appointments
   - Strategic Deals, Partnerships & Ecosystem Milestones
   Tag each item clearly with [Product Launch], [Executive Hire], or [Strategic Update] / [Strategic Deal] citing the publisher domain inline as ([Domain](url)).
   If no verified announcements exist for a sub-block, state "• No public announcements verified in the preceding 30 days."
4. Every strategic angle and discussion question MUST anchor specifically to "${effectiveGoal}" and scheduled time (${meetingTime || 'Upcoming Call'}).
5. Use clean markdown formatting. Cite sources as ([Domain](url)).
6. Follow this exact layout:

## 1. 30-Second Executive Snapshot
- **Company Context**: 2 sentences on ${company}'s current market developments and scale.
${person ? `- **${person} Profile**: Detail ${person}'s role, technical or operational domain, and relevance to this meeting.` : ''}
- **Meeting Objective & Deliverable**: Focus on "${effectiveGoal}" (Scheduled: ${meetingTime || 'Upcoming Call'}).

## 2. Last 30 Days Radar (News, Launches, Hires & Updates)

### Product Launches & Technical Releases
(1-2 verified items or note stating none verified)

### Leadership & Executive Appointments
(1-2 verified items or note stating none verified)

### Strategic Deals, Partnerships & Ecosystem Milestones
(1-2 verified items or note stating none verified)

## 3. Strategic Meeting Angles
• **Play 01 — Align with 30-Day Momentum**: Tactical talking point connecting recent developments to "${effectiveGoal}".
• **Play 02 — Target Core Deliverables (${meetingTrack})**: Tactical talking point addressing operational execution and timeline.
• **Play 03 — Address Stakeholder Decision Criteria**: Tactical talking point framing mutual ROI and next steps for ${person || 'stakeholders'}.

## 4. Top 3 High-Impact Discussion Questions
1. **[Strategic Priority]**: Thoughtful question probing high-level alignment on "${effectiveGoal}".
2. **[Execution Bottlenecks]**: Insightful question addressing current technical or operational hurdles.
3. **[Mutual Win & Deliverables]**: Pragmatic question establishing what constitutes an unambiguous success for this meeting.

Do not include conversational filler. Start directly with "## 1. 30-Second Executive Snapshot".`;

  if (state?.settings?.aiConfig && process.env.NODE_ENV !== 'test') {
    try {
      const result = await generateAIResponse(
        state,
        prompt,
        undefined,
        false,
        {
          skipHistory: true,
          isSystemScope: true,
        }
      );
      const text = typeof result === 'string' ? result : result?.message || result?.content || '';
      if (text && text.includes('Executive Snapshot')) {
        return text.trim();
      }
    } catch (err) {
      console.warn('[PreBriefSynthesizer] AI generation fallback:', err);
    }
  }

  // Graceful deterministic fallback (when offline or AI provider unavailable)
  const rawPersonSnippet = personSources.find((s) => s.snippet && s.snippet.length > 15)?.snippet || '';
  const cleanedPerson = cleanPersonSnippet(rawPersonSnippet);
  const cleanPersonBio = cleanedPerson ? formatAnalyticalSnippet(cleanedPerson, 180) : '';

  const candidateSources = companySources.length > 0 ? companySources : sources.filter((s) => s.category !== 'person');
  
  const classifiedSources = candidateSources.map((s) => ({
    source: s,
    ...classifyDevelopment(s),
  }));

  const launchItems = classifiedSources.filter((c) => c.blockCategory === 'launch').slice(0, 2);
  const hireItems = classifiedSources.filter((c) => c.blockCategory === 'hire').slice(0, 2);
  const updateItems = classifiedSources.filter((c) => c.blockCategory === 'update' && !launchItems.includes(c) && !hireItems.includes(c)).slice(0, 2);

  const formatSourceItem = (c: typeof classifiedSources[0]) => {
    const s = c.source;
    const safeTitle = cleanTitle(s.title);
    const safeSnippet = formatAnalyticalSnippet(s.snippet || '', 150);
    return `• **${c.tag} ${safeTitle}**: ${safeSnippet} ([${s.domain}](${s.url}))`;
  };

  const launchBlock = launchItems.length > 0
    ? launchItems.map(formatSourceItem).join('\n')
    : '• No public product releases verified in preceding 30 days.';

  const hireBlock = hireItems.length > 0
    ? hireItems.map(formatSourceItem).join('\n')
    : '• No executive transitions announced in preceding 30 days.';

  const updateBlock = updateItems.length > 0
    ? updateItems.map(formatSourceItem).join('\n')
    : '• No public partnerships or corporate filings verified in preceding 30 days.';

  return `## 1. 30-Second Executive Snapshot
- **Company Context**: **${company}** active operational domain and market presence.
${
  person
    ? `- **${person} Profile**: ${
        cleanPersonBio
          ? `${cleanPersonBio} ([${personSources[0]?.domain || 'Web'}](${personSources[0]?.url || '#'}))`
          : `Key participant and stakeholder at ${company}. Meeting discussion centered on ${effectiveGoal}.`
      }`
    : ''
}
- **Meeting Objective & Deliverable**: **${effectiveGoal}** (${meetingTime || 'Upcoming Call'}).

## 2. Last 30 Days Radar (News, Launches, Hires & Updates)

### Product Launches & Technical Releases
${launchBlock}

### Leadership & Executive Appointments
${hireBlock}

### Strategic Deals, Partnerships & Ecosystem Milestones
${updateBlock}

## 3. Strategic Meeting Angles
• **Play 01 — Align with 30-Day Momentum**: Anchor discussion in ${company}'s current operational cycle to demonstrate thorough preparation.
• **Play 02 — Target Core Deliverables (${meetingTrack})**: Focus directly on "${effectiveGoal}" to establish concrete milestone timelines.
• **Play 03 — Address Stakeholder Decision Criteria**: Frame value proposition around operational velocity and measurable outcomes for ${person || company}.

## 4. Top 3 High-Impact Discussion Questions
1. **[Strategic Priority]**: In the context of your current 30-day priorities, what is ${company}'s most critical objective for ${effectiveGoal}?
2. **[Execution Bottlenecks]**: Where is your team experiencing the highest friction or resource constraint in executing on ${meetingTrack}?
3. **[Mutual Win & Deliverables]**: What specific outcome from our conversation today would make this initiative an immediate success for you?`;
}
