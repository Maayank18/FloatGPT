import { AppState } from '../types';
import { routeCommand, CommandRouteResult } from './commandRouter';
import { getCommandSystemPrompt } from './promptTemplates';
import { buildCommandResponse } from './responseBuilders';
import { validateCommandResponse } from './guards';
import { SlashCommandType } from './commandSchemas';

const USE_PREVIOUS = new Set<SlashCommandType>(['summary', 'rewrite', 'review', 'bullets', 'one-liner', 'email']);

const LANGUAGES: Record<string, string> = {
  en: 'English', english: 'English',
  hi: 'Hindi', hindi: 'Hindi',
  hinglish: 'Hinglish',
  es: 'Spanish', spanish: 'Spanish',
  fr: 'French', french: 'French',
  de: 'German', german: 'German',
  pt: 'Portuguese', portuguese: 'Portuguese',
  it: 'Italian', italian: 'Italian',
  ja: 'Japanese', japanese: 'Japanese',
  ko: 'Korean', korean: 'Korean',
  zh: 'Chinese', chinese: 'Chinese', mandarin: 'Chinese',
  ar: 'Arabic', arabic: 'Arabic',
  ru: 'Russian', russian: 'Russian',
  nl: 'Dutch', dutch: 'Dutch',
  tr: 'Turkish', turkish: 'Turkish',
  ta: 'Tamil', tamil: 'Tamil',
  te: 'Telugu', telugu: 'Telugu',
  bn: 'Bengali', bengali: 'Bengali',
  mr: 'Marathi', marathi: 'Marathi',
  gu: 'Gujarati', gujarati: 'Gujarati',
  pa: 'Punjabi', punjabi: 'Punjabi',
  ur: 'Urdu', urdu: 'Urdu'
};

function previousMessage(messages: { role?: string; content?: string }[] | undefined): string | null {
  const prior = [...(messages || [])].reverse().find((message) => {
    const text = String(message?.content || '').trim();
    return text && !text.startsWith('/');
  });
  return prior ? String(prior.content).slice(0, 3500) : null;
}

/** Pull a named language off the front or the end, and return the text to translate. */
export function parseTranslateInput(stripped: string): { language: string; text: string } | null {
  let source = String(stripped || '').trim().replace(/^(?:to|into|in)\s+/i, '');
  if (!source) return null;

  const words = source.split(/\s+/);
  const first = words[0].toLowerCase().replace(/[.,:]+$/g, '');
  if (LANGUAGES[first]) {
    return { language: LANGUAGES[first], text: words.slice(1).join(' ').trim() };
  }

  const trailing = source.match(/\s+(?:to|into|in)\s+([a-zA-Z]+)\s*$/);
  const named = trailing?.[1]?.toLowerCase();
  if (named && LANGUAGES[named] && trailing?.index !== undefined) {
    return { language: LANGUAGES[named], text: source.slice(0, trailing.index).trim() };
  }
  return null;
}

/** Text the command should work on. Empty commands can use the previous message. */
export function slashSubject(
  command: SlashCommandType,
  stripped: string,
  messages: { role?: string; content?: string }[] | undefined
): string | null {
  if (command === 'translate') {
    const parsed = parseTranslateInput(stripped);
    if (!parsed?.language) return null;
    const text = parsed.text || previousMessage(messages);
    if (!text) return null;
    return `Target language: ${parsed.language}\n\n${text}`;
  }

  const typed = String(stripped || '').trim();
  if (typed) return typed;
  if (!USE_PREVIOUS.has(command)) return null;
  return previousMessage(messages);
}

export function missingSlashHelp(command: SlashCommandType): string {
  if (command === 'translate') {
    return 'Name the language first.\n\n`/translate hi your text`\n`/translate to English your text`\n\n`/translate hi` alone uses the last message.';
  }
  if (command === 'email') {
    return 'Add the rough note after the command.\n\n`/email tell Priya the build is ready tomorrow`\n\n`/email` alone uses the last message. Nothing is sent.';
  }
  return `Add the text after the command.\n\nExample: \`/${command} your text here\`\n\nSummary, rewrite, review, bullets, one-liner, and email can also be sent alone, right after a message, and I will use that message.`;
}

export interface SlashCommandProcessResult {
  isCommand: boolean;
  command: SlashCommandType | null;
  strippedPrompt: string;
  systemInstruction: string | null;
}

/**
 * Main entry point for the slash command layer.
 * Parses the prompt and returns instructions if a command is detected.
 */
export function processSlashCommand(prompt: string, state: AppState): SlashCommandProcessResult {
  const route = routeCommand(prompt);

  if (route.isCommand && route.command) {
    const systemInstruction = getCommandSystemPrompt(route.command);
    return {
      isCommand: true,
      command: route.command,
      strippedPrompt: route.strippedPrompt,
      systemInstruction
    };
  }

  return {
    isCommand: false,
    command: null,
    strippedPrompt: prompt,
    systemInstruction: null
  };
}

/**
 * Formats and guards the final response.
 */
export function postProcessSlashCommand(command: SlashCommandType, rawResponse: string): string {
  const isValid = validateCommandResponse(command, rawResponse);
  if (!isValid) {
    console.warn(`[SlashCommand] Response failed validation guard for command: ${command}`);
    // In strict mode we could throw, but for now we just log it and proceed.
  }
  return buildCommandResponse(command, rawResponse);
}
