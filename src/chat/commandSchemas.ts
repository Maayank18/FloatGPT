export type SlashCommandType = 
  | 'summary'
  | 'rewrite'
  | 'translate'
  | 'email'
  | 'one-liner'
  | 'bullets'
  | 'plan'
  | 'review'
  | 'table'
  | 'diagram'
  | 'architecture'
  | 'research'
  | 'image'
  | 'note'
  | 'pdf';

export interface CommandSchema {
  command: SlashCommandType;
  description: string;
  aliases: string[];
  /** Handled on the device. These do not call a model. */
  local?: boolean;
}

export const COMMAND_SCHEMAS: Record<SlashCommandType, CommandSchema> = {
  summary: {
    command: 'summary',
    description: 'A few lines, or the last reply',
    aliases: ['tldr', 'sum']
  },
  rewrite: {
    command: 'rewrite',
    description: 'Clearer wording, same meaning',
    aliases: ['improve', 'edit']
  },
  translate: {
    command: 'translate',
    description: 'Into the language you name',
    aliases: ['tr', 'translation']
  },
  email: {
    command: 'email',
    description: 'Draft with a subject. Not sent',
    aliases: ['mail', 'draft']
  },
  'one-liner': {
    command: 'one-liner',
    description: 'One sentence you can paste',
    aliases: ['oneliner', 'short']
  },
  bullets: {
    command: 'bullets',
    description: 'A tight list, no intro',
    aliases: ['list']
  },
  plan: {
    command: 'plan',
    description: 'Steps, in the order to do them',
    aliases: ['steps']
  },
  review: {
    command: 'review',
    description: 'Strengths, gaps, and risks',
    aliases: ['critique', 'feedback']
  },
  research: {
    command: 'research',
    description: 'Papers with a real link',
    aliases: ['papers', 'scholar']
  },
  table: {
    command: 'table',
    description: 'A markdown table only',
    aliases: ['tab', 'grid']
  },
  diagram: {
    command: 'diagram',
    description: 'A Mermaid diagram',
    aliases: ['mermaid', 'visual']
  },
  architecture: {
    command: 'architecture',
    description: 'Parts and how they connect',
    aliases: ['arch']
  },
  image: {
    command: 'image',
    description: 'An image from a short idea',
    aliases: ['img', 'pic']
  },
  note: {
    command: 'note',
    description: 'Saved on this device',
    aliases: ['notes'],
    local: true
  },
  pdf: {
    command: 'pdf',
    description: 'A simple PDF download',
    aliases: ['doc'],
    local: true
  }
};

export const COMMAND_GROUPS: { label: string; commands: SlashCommandType[] }[] = [
  { label: 'Write', commands: ['summary', 'rewrite', 'translate', 'email', 'one-liner', 'bullets'] },
  { label: 'Think', commands: ['plan', 'review', 'research'] },
  { label: 'Show', commands: ['table', 'diagram', 'architecture', 'image'] },
  { label: 'Keep', commands: ['note', 'pdf'] },
];

export const ALL_COMMANDS = Object.keys(COMMAND_SCHEMAS) as SlashCommandType[];
