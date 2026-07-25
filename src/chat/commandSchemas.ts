export type SlashCommandType = 
  | 'one-liner' 
  | 'architecture' 
  | 'diagram' 
  | 'summary' 
  | 'rewrite' 
  | 'plan' 
  | 'review' 
  | 'bullets' 
  | 'table';

export interface CommandSchema {
  command: SlashCommandType;
  description: string;
  aliases: string[];
}

export const COMMAND_SCHEMAS: Record<SlashCommandType, CommandSchema> = {
  'one-liner': {
    command: 'one-liner',
    description: 'Return a single powerful, polished, copy-paste-ready one-liner.',
    aliases: ['oneliner', 'short']
  },
  'architecture': {
    command: 'architecture',
    description: 'Return a structured architecture answer for a canvas flowchart or blueprint.',
    aliases: ['arch']
  },
  'diagram': {
    command: 'diagram',
    description: 'Return a clean diagram-oriented answer.',
    aliases: ['mermaid', 'visual']
  },
  'summary': {
    command: 'summary',
    description: 'Return a compact summary of the given text, plan, or context.',
    aliases: ['tldr']
  },
  'rewrite': {
    command: 'rewrite',
    description: 'Rewrite the user’s input in a better form.',
    aliases: ['improve']
  },
  'plan': {
    command: 'plan',
    description: 'Convert the input into a structured execution plan.',
    aliases: ['steps']
  },
  'review': {
    command: 'review',
    description: 'Review the user’s content, plan, or idea critically.',
    aliases: ['critique', 'feedback']
  },
  'bullets': {
    command: 'bullets',
    description: 'Return the answer as a tight bullet list.',
    aliases: ['list']
  },
  'table': {
    command: 'table',
    description: 'Return the answer in a compact table-like structure.',
    aliases: ['compare']
  }
};

export const ALL_COMMANDS = Object.keys(COMMAND_SCHEMAS) as SlashCommandType[];
