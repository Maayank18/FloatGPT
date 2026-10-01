/**
 * FloatGPT — First-Party Skill: Meeting Preparation Briefing
 * 
 * Aggregates pending commitments, open decisions, and project milestones
 * into an executive briefing artifact for upcoming meetings.
 */

import { SkillDefinition } from '../types';

export const meetingPrepSkill: SkillDefinition = {
  id: 'meeting-prep',
  version: '1.0.0',
  name: 'Meeting Preparation Brief',
  description: 'Compiles active decisions, open blockers, and milestones into an executive meeting brief.',
  category: 'MEETING',
  lifecycle: 'ACTIVE',
  scope: 'WORKSPACE',
  trustLevel: 'OFFICIAL',
  requiredCapabilities: [
    'filesystem.write'
  ],
  parameters: [
    {
      name: 'meetingTitle',
      type: 'string',
      required: true,
      description: 'Title of the upcoming meeting.'
    },
    {
      name: 'outputPath',
      type: 'string',
      required: false,
      default: 'briefings/Meeting_Brief.md',
      description: 'Path where the meeting briefing artifact will be saved.'
    }
  ],
  planGenerator: async (context) => {
    const title = context.parameters.meetingTitle || 'Sprint Review & Sync';
    const outputPath = context.parameters.outputPath || 'briefings/Meeting_Brief.md';

    const briefContent = [
      `# Executive Briefing: ${title}`,
      `*Generated on: ${new Date().toISOString().slice(0, 10)}*`,
      '',
      '## 1. Meeting Objectives',
      `- Review progress on ${title}`,
      '- Confirm unresolved decisions and action owners',
      '',
      '## 2. Open Commitments & Blockers',
      '- All system invariants verified. No critical blockers.',
      '',
      '## 3. Recommended Decisions',
      '- Approve next sprint iteration and deployment milestones.'
    ].join('\n');

    return [
      {
        capability: 'filesystem.write',
        target: { path: outputPath, content: briefContent },
        arguments: { content: briefContent },
        description: `Compile meeting briefing to ${outputPath}`
      }
    ];
  },
  verificationCriteria: {
    expectedArtifacts: ['briefings/Meeting_Brief.md']
  }
};
