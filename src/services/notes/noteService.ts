/**
 * FloatGPT — Smart Note Service
 * 
 * Creates, formats, and transforms structured notes across Quick, Meeting,
 * Study, Research, Project, and Decision modes.
 */

import { StructuredNote, NoteType, NoteSection, ActionItem } from './noteTypes';

export class NoteService {
  /**
   * Generates a structured note from raw text input.
   */
  static createNoteFromText(
    title: string,
    rawText: string,
    noteType: NoteType = 'quick',
    sourceType: NonNullable<StructuredNote['sourceRef']>['type'] = 'chat'
  ): StructuredNote {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const keyPoints: string[] = [];
    const actionItems: ActionItem[] = [];
    const decisions: string[] = [];
    const questions: string[] = [];

    // Extract bullet points, action items, and questions
    lines.forEach(line => {
      if (/^[-*•]\s*\[?\s*\]?\s*(todo|action|task|fix|follow.?up):/i.test(line) || /^\[\s*\]/i.test(line)) {
        const clean = line.replace(/^[-*•]\s*(\[\s*\])?\s*(todo|action|task|fix|follow.?up)?:\s*/i, '').trim();
        actionItems.push({ task: clean, completed: false });
      } else if (/^[-*•]\s*(decision|agreed|resolved):/i.test(line)) {
        decisions.push(line.replace(/^[-*•]\s*(decision|agreed|resolved):\s*/i, '').trim());
      } else if (line.endsWith('?') || /^[-*•]\s*(q|question):/i.test(line)) {
        questions.push(line.replace(/^[-*•]\s*(q|question):\s*/i, '').trim());
      } else if (/^[-*•]\s+/.test(line)) {
        keyPoints.push(line.replace(/^[-*•]\s+/, '').trim());
      }
    });

    const summary = lines.slice(0, 3).join(' ').slice(0, 200) || 'Note created with FloatGPT Smart Notes.';

    const sections: NoteSection[] = [
      {
        heading: 'Overview',
        content: rawText.slice(0, 500),
        bulletPoints: keyPoints.slice(0, 6)
      }
    ];

    if (actionItems.length > 0) {
      sections.push({
        heading: 'Action Items & Next Steps',
        content: `${actionItems.length} action items captured.`,
        bulletPoints: actionItems.map(a => `[ ] ${a.task}${a.owner ? ` (@${a.owner})` : ''}`)
      });
    }

    return {
      noteId: Math.random().toString(36).substring(2, 9),
      title: title || 'FloatGPT Note',
      noteType,
      summary,
      sections,
      keyPoints,
      actionItems,
      decisions,
      questions,
      tags: [noteType, 'note'],
      sourceRef: {
        type: sourceType,
        name: title
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * Formats a structured note into clean Markdown.
   */
  static formatToMarkdown(note: StructuredNote): string {
    let md = `# ${note.title}\n\n`;
    md += `> **Type:** ${note.noteType.toUpperCase()} | **Date:** ${new Date(note.createdAt).toLocaleDateString()}\n\n`;
    md += `### Summary\n${note.summary}\n\n`;

    if (note.keyPoints.length > 0) {
      md += `### Key Points\n`;
      note.keyPoints.forEach(kp => {
        md += `- ${kp}\n`;
      });
      md += '\n';
    }

    if (note.decisions.length > 0) {
      md += `### Decisions\n`;
      note.decisions.forEach(d => {
        md += `- 🎯 ${d}\n`;
      });
      md += '\n';
    }

    if (note.actionItems.length > 0) {
      md += `### Action Items\n`;
      note.actionItems.forEach(item => {
        md += `- [ ] ${item.task}${item.owner ? ` *(Owner: ${item.owner})*` : ''}${item.deadline ? ` *(Due: ${item.deadline})*` : ''}\n`;
      });
      md += '\n';
    }

    if (note.questions.length > 0) {
      md += `### Open Questions\n`;
      note.questions.forEach(q => {
        md += `- ❓ ${q}\n`;
      });
      md += '\n';
    }

    return md;
  }
}
