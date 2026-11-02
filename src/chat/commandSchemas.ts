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
  | 'compare'
  | 'checklist'
  | 'define'
  | 'next'
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
    description: 'arXiv papers, title matched to the link',
    aliases: ['papers', 'scholar']
  },
  compare: {
    command: 'compare',
    description: 'Two options, side by side',
    aliases: ['vs', 'contrast']
  },
  checklist: {
    command: 'checklist',
    description: 'Boxes, in the order to do them',
    aliases: ['check', 'checks']
  },
  define: {
    command: 'define',
    description: 'What it is, in one line',
    aliases: ['meaning', 'whatis']
  },
  next: {
    command: 'next',
    description: 'The one next action',
    aliases: ['nextstep']
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
    description: 'A picture of what you describe',
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
  { label: 'Write', commands: ['summary', 'rewrite', 'translate', 'email', 'one-liner', 'bullets', 'checklist', 'define'] },
  { label: 'Think', commands: ['plan', 'review', 'research', 'compare', 'next'] },
  { label: 'Show', commands: ['table', 'diagram', 'architecture', 'image'] },
  { label: 'Keep', commands: ['note', 'pdf'] },
];

export const ALL_COMMANDS = Object.keys(COMMAND_SCHEMAS) as SlashCommandType[];

function commandOrder(): SlashCommandType[] {
  const grouped = new Set(COMMAND_GROUPS.flatMap((group) => group.commands));
  return [
    ...COMMAND_GROUPS.flatMap((group) => group.commands),
    ...ALL_COMMANDS.filter((cmd) => !grouped.has(cmd)),
  ];
}

/** Commands for the slash menu. A name that starts with the letters comes before an alias that does. */
export function slashMenuCommands(typed: string): SlashCommandType[] {
  const query = typed.trim().toLowerCase().replace(/^\//, '');
  const needle = `/${query}`;
  const named: SlashCommandType[] = [];
  const aliased: SlashCommandType[] = [];
  for (const cmd of commandOrder()) {
    if (`/${cmd}`.startsWith(needle)) named.push(cmd);
    else if (COMMAND_SCHEMAS[cmd].aliases.some((alias) => `/${alias}`.startsWith(needle))) aliased.push(cmd);
  }
  return [...named, ...aliased];
}

/** True when the box already holds a whole command, such as /image or /img. */
export function isExactSlashCommand(typed: string): boolean {
  const name = typed.trim().toLowerCase().replace(/^\//, '');
  if (!name || /\s/.test(name)) return false;
  return ALL_COMMANDS.some((cmd) => cmd === name || COMMAND_SCHEMAS[cmd].aliases.includes(name));
}
