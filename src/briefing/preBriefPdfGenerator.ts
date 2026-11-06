import { PreBriefItem, BriefSource } from './types';
import { PdfEngine, PdfContentBlock, PdfDocumentOptions } from '../services/document/pdfEngine';
import { cleanTitle } from './tavilyClient';

export interface PreBriefPdfResult {
  blob: Blob;
  filename: string;
}

function cleanBulletText(text: string): string {
  if (!text) return '';
  return text
    .replace(/â€¢/g, '')
    .replace(/^[•·\u2022\u2219\u25E6\u25AA\u25CF\-\*\s]+/, '')
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function generatePreBriefPdf(brief: PreBriefItem): PreBriefPdfResult {
  const companyClean = brief.company.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${companyClean}_PreBrief_Dossier.pdf`;

  const options: PdfDocumentOptions = {
    title: `PreBrief Dossier: ${brief.company}`,
    author: 'FloatGPT Executive Intelligence',
    creator: 'FloatGPT Intelligence Engine',
    headerText: `FLOATGPT PREBRIEF · ${brief.company.toUpperCase()} EXECUTIVE INTELLIGENCE`,
    footerText: `Confidential Dossier · Generated on ${new Date().toLocaleDateString()} · FloatGPT`,
  };

  const blocks: PdfContentBlock[] = [];

  // Document Title
  blocks.push({
    type: 'title',
    text: `EXECUTIVE PRE-MEETING DOSSIER: ${brief.company.toUpperCase()}`,
  });

  // Target Metadata Callout Box
  const metaLines = [
    `TARGET ORGANIZATION:   ${brief.company.toUpperCase()}`,
    brief.person ? `KEY STAKEHOLDER:       ${brief.person}` : null,
    `SCHEDULED MEETING:     ${brief.meetingTime || 'Upcoming Scheduled Call'}`,
    `PRIMARY TRACK:         ${brief.meetingTrack}${brief.customTrack ? ` — ${brief.customTrack}` : ''}`,
    `INTELLIGENCE HORIZON:  Preceding 30 Days (Tavily Multi-Source Real-Time Search)`,
    `SECURITY CLASSIFIER:   CONFIDENTIAL · PRE-MEETING STRATEGIC PREPARATION`,
  ].filter(Boolean).join('\n');

  blocks.push({
    type: 'callout',
    text: metaLines,
  });

  blocks.push({ type: 'divider' });

  // 1. 30-Second Executive Snapshot
  blocks.push({
    type: 'heading1',
    text: '1. 30-Second Executive Snapshot',
  });

  const sec1Match = brief.summary.match(/(?:##\s*1[^\n]*|1\.\s*30-Second[^\n]*)([\s\S]*?)(?:##\s*2|2\.\s*Last 30 Days|$)/i);
  const sec1Content = sec1Match ? sec1Match[1].trim() : '';

  if (sec1Content) {
    const rawBullets = sec1Content
      .split(/(?:^|\n)\s*[-*•]\s+/)
      .map((s) => cleanBulletText(s))
      .filter((s) => s.length > 5);

    for (const b of rawBullets) {
      blocks.push({
        type: 'bullet',
        text: b,
      });
    }
  } else {
    blocks.push({
      type: 'bullet',
      text: `Company Context: ${brief.company} active operations and market development.`,
    });
    if (brief.person) {
      blocks.push({
        type: 'bullet',
        text: `${brief.person} Profile: Strategic decision-maker and domain stakeholder at ${brief.company}.`,
      });
    }
    blocks.push({
      type: 'bullet',
      text: `Meeting Objective: Focus on ${brief.meetingTrack} scheduled for ${brief.meetingTime || 'Upcoming Call'}.`,
    });
  }

  blocks.push({ type: 'divider' });

  // 2. Last 30 Days Radar (News, Launches, Hires & Moves)
  blocks.push({
    type: 'heading1',
    text: '2. 30-Day Intelligence Radar (Preceding 30 Days)',
  });

  const sources: BriefSource[] = Array.isArray(brief.sources) ? brief.sources : [];

  // Parse Section 2 from summary
  const sec2Match = brief.summary.match(/(?:##\s*2[^\n]*|2\.\s*Last 30 Days[^\n]*)([\s\S]*?)(?:##\s*3|3\.\s*Strategic|$)/i);
  const sec2Content = sec2Match ? sec2Match[1].trim() : '';

  // Check if Section 2 contains structured ### sub-blocks
  const hasSubBlocks = /###\s*(Product|Leadership|Strategic)/i.test(sec2Content);

  if (hasSubBlocks) {
    // 2A. Product Launches
    blocks.push({ type: 'heading2', text: 'A. Product Releases & Technical Announcements' });
    const launchMatch = sec2Content.match(/###\s*Product[^\n]*([\s\S]*?)(?=###\s*Leadership|###\s*Strategic|$)/i);
    const launchBullets = (launchMatch ? launchMatch[1].trim() : '')
      .split(/(?:^|\n)\s*[-*•]\s+/)
      .map((s) => cleanBulletText(s))
      .filter((s) => s.length > 5);

    if (launchBullets.length > 0) {
      for (const b of launchBullets) {
        blocks.push({ type: 'bullet', text: b });
      }
    } else {
      blocks.push({ type: 'paragraph', text: 'No public product releases verified in preceding 30 days.' });
    }

    // 2B. Leadership & Appointments
    blocks.push({ type: 'heading2', text: 'B. Leadership Appointments & Executive Moves' });
    const hireMatch = sec2Content.match(/###\s*Leadership[^\n]*([\s\S]*?)(?=###\s*Strategic|$)/i);
    const hireBullets = (hireMatch ? hireMatch[1].trim() : '')
      .split(/(?:^|\n)\s*[-*•]\s+/)
      .map((s) => cleanBulletText(s))
      .filter((s) => s.length > 5);

    if (hireBullets.length > 0) {
      for (const b of hireBullets) {
        blocks.push({ type: 'bullet', text: b });
      }
    } else {
      blocks.push({ type: 'paragraph', text: 'No executive transitions announced in preceding 30 days.' });
    }

    // 2C. Strategic Deals & Ecosystem Milestones
    blocks.push({ type: 'heading2', text: 'C. Strategic Deals, Partnerships & Ecosystem Milestones' });
    const updateMatch = sec2Content.match(/###\s*Strategic[^\n]*([\s\S]*)$/i);
    const updateBullets = (updateMatch ? updateMatch[1].trim() : '')
      .split(/(?:^|\n)\s*[-*•]\s+/)
      .map((s) => cleanBulletText(s))
      .filter((s) => s.length > 5);

    if (updateBullets.length > 0) {
      for (const b of updateBullets) {
        blocks.push({ type: 'bullet', text: b });
      }
    } else {
      blocks.push({ type: 'paragraph', text: 'No external partnerships or funding announcements verified in preceding 30 days.' });
    }
  } else if (sec2Content) {
    // Legacy summary without ###: group by tags
    const allRadarBullets = sec2Content
      .split(/(?:^|\n)\s*[-*•]\s+/)
      .map((s) => cleanBulletText(s))
      .filter((s) => s.length > 5);

    const launchBullets = allRadarBullets.filter((b) => /\[Product Launch\]/i.test(b));
    const hireBullets = allRadarBullets.filter((b) => /\[Executive Hire\]/i.test(b));
    const updateBullets = allRadarBullets.filter((b) => !launchBullets.includes(b) && !hireBullets.includes(b));

    blocks.push({ type: 'heading2', text: 'A. Product Releases & Technical Announcements' });
    if (launchBullets.length > 0) {
      for (const b of launchBullets) blocks.push({ type: 'bullet', text: b });
    } else {
      blocks.push({ type: 'paragraph', text: 'No public product releases verified in preceding 30 days.' });
    }

    blocks.push({ type: 'heading2', text: 'B. Leadership Appointments & Executive Moves' });
    if (hireBullets.length > 0) {
      for (const b of hireBullets) blocks.push({ type: 'bullet', text: b });
    } else {
      blocks.push({ type: 'paragraph', text: 'No executive transitions announced in preceding 30 days.' });
    }

    blocks.push({ type: 'heading2', text: 'C. Strategic Deals, Partnerships & Ecosystem Milestones' });
    if (updateBullets.length > 0) {
      for (const b of updateBullets) blocks.push({ type: 'bullet', text: b });
    } else {
      blocks.push({ type: 'paragraph', text: 'No external partnerships or funding announcements verified in preceding 30 days.' });
    }
  } else if (sources.length > 0) {
    const launches = sources.filter((s) => s.category === 'launch');
    const hires = sources.filter((s) => s.category === 'hire');
    const updates = sources.filter((s) => s.category !== 'launch' && s.category !== 'hire' && s.category !== 'person');

    blocks.push({ type: 'heading2', text: 'A. Product Releases & Technical Announcements' });
    if (launches.length > 0) {
      for (const s of launches.slice(0, 2)) {
        blocks.push({ type: 'bullet', text: `[Product Launch] ${cleanTitle(s.title)}: ${cleanBulletText(s.snippet || '')} (${s.domain})` });
      }
    } else {
      blocks.push({ type: 'paragraph', text: 'No public product releases verified in preceding 30 days.' });
    }

    blocks.push({ type: 'heading2', text: 'B. Leadership Appointments & Executive Moves' });
    if (hires.length > 0) {
      for (const s of hires.slice(0, 2)) {
        blocks.push({ type: 'bullet', text: `[Executive Hire] ${cleanTitle(s.title)}: ${cleanBulletText(s.snippet || '')} (${s.domain})` });
      }
    } else {
      blocks.push({ type: 'paragraph', text: 'No executive transitions announced in preceding 30 days.' });
    }

    blocks.push({ type: 'heading2', text: 'C. Strategic Deals, Partnerships & Ecosystem Milestones' });
    if (updates.length > 0) {
      for (const s of updates.slice(0, 2)) {
        blocks.push({ type: 'bullet', text: `[Strategic Update] ${cleanTitle(s.title)}: ${cleanBulletText(s.snippet || '')} (${s.domain})` });
      }
    } else {
      blocks.push({ type: 'paragraph', text: 'No external partnerships or funding announcements verified in preceding 30 days.' });
    }
  } else {
    blocks.push({
      type: 'paragraph',
      text: 'No major public announcements verified in the preceding 30 days.',
    });
  }

  blocks.push({ type: 'divider' });

  // 3. Strategic Meeting Angles
  blocks.push({
    type: 'heading1',
    text: '3. Strategic Meeting Angles (Tactical Playbook)',
  });

  const sec3Match = brief.summary.match(/(?:##\s*3[^\n]*|3\.\s*Strategic[^\n]*)([\s\S]*?)(?:##\s*4|4\.\s*Top 3|$)/i);
  const sec3Content = sec3Match ? sec3Match[1].trim() : '';

  if (sec3Content) {
    const angleBullets = sec3Content
      .split(/(?:^|\n)\s*[-*•]\s+/)
      .map((s) => cleanBulletText(s))
      .filter((s) => s.length > 5);

    for (const b of angleBullets) {
      blocks.push({
        type: 'bullet',
        text: b,
      });
    }
  } else {
    blocks.push({
      type: 'bullet',
      text: `Play 01 (30-Day Momentum): Align discussion with ${brief.company}'s latest updates to demonstrate thorough preparation.`,
    });
    blocks.push({
      type: 'bullet',
      text: `Play 02 (Core Deliverables): Anchor meeting directly around ${brief.meetingTrack} to ensure concrete, actionable deliverables.`,
    });
    if (brief.person) {
      blocks.push({
        type: 'bullet',
        text: `Play 03 (Decision Acceleration): Focus on ${brief.person}'s leadership domain and operational ROI to accelerate decision velocity.`,
      });
    }
  }

  blocks.push({ type: 'divider' });

  // 4. Top 3 High-Impact Discussion Questions
  blocks.push({
    type: 'heading1',
    text: '4. High-Impact Executive Discussion Questions',
  });

  const sec4Match = brief.summary.match(/(?:##\s*4[^\n]*|4\.\s*Top 3[^\n]*)([\s\S]*?)(?:##\s*5|5\.\s*Verified|$)/i);
  const sec4Content = sec4Match ? sec4Match[1].trim() : '';

  if (sec4Content) {
    const questionItems = sec4Content
      .split(/(?:^|\n)\s*(?:\d+[\.\)]|[-*•])\s+/)
      .map((s) => cleanBulletText(s))
      .filter((s) => s.length > 5);

    for (let idx = 0; idx < questionItems.length; idx++) {
      const qText = questionItems[idx];
      const hasPrefix = /^Q\d+/i.test(qText);
      blocks.push({
        type: 'bullet',
        text: hasPrefix ? qText : `Q${idx + 1}: ${qText}`,
      });
    }
  } else {
    blocks.push({
      type: 'bullet',
      text: `Q1 [Strategic Priority]: In the context of ${brief.meetingTrack}, what are ${brief.company}’s highest priority deliverables for the current cycle?`,
    });
    blocks.push({
      type: 'bullet',
      text: `Q2 [Execution Bottlenecks]: Where is your team experiencing the highest friction or resource constraint in this domain?`,
    });
    blocks.push({
      type: 'bullet',
      text: `Q3 [Mutual Value & Next Steps]: What outcome from this conversation would constitute an unambiguous win for your group?`,
    });
  }

  blocks.push({ type: 'divider' });

  // 5. Intelligence Sources & Provenance
  blocks.push({
    type: 'heading1',
    text: '5. Intelligence Sources & Provenance (Last 30 Days)',
  });

  if (sources.length > 0) {
    for (const s of sources.slice(0, 10)) {
      const datePart = s.publishedDate ? ` [${s.publishedDate.slice(0, 10)}]` : '';
      blocks.push({
        type: 'bullet',
        text: `${s.domain}${datePart}: ${cleanTitle(s.title)} (${s.url})`,
      });
    }
  } else {
    blocks.push({
      type: 'paragraph',
      text: 'Verified using direct public web queries.',
    });
  }

  const blob = PdfEngine.createPdf(options, blocks);
  return { blob, filename };
}

export function downloadBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error('[downloadBlob] Failed to download blob:', err);
  }
}
