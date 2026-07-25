import { ALL_COMMANDS, COMMAND_SCHEMAS, SlashCommandType } from './commandSchemas';

export interface CommandRouteResult {
  isCommand: boolean;
  command: SlashCommandType | null;
  strippedPrompt: string;
}

/**
 * Detects if the user's prompt begins with a slash command, and strips it.
 * Also handles aliases.
 */
export function routeCommand(prompt: string): CommandRouteResult {
  const trimmed = prompt.trim();
  
  if (!trimmed.startsWith('/')) {
    return { isCommand: false, command: null, strippedPrompt: prompt };
  }

  // Split by whitespace to get the first word
  const firstSpaceIndex = trimmed.indexOf(' ');
  const firstWord = firstSpaceIndex === -1 ? trimmed : trimmed.substring(0, firstSpaceIndex);
  
  const rawCommand = firstWord.substring(1).toLowerCase(); // remove '/'
  
  // Find the command or check aliases
  let matchedCommand: SlashCommandType | null = null;
  
  if (ALL_COMMANDS.includes(rawCommand as SlashCommandType)) {
    matchedCommand = rawCommand as SlashCommandType;
  } else {
    // Check aliases
    for (const key of ALL_COMMANDS) {
      if (COMMAND_SCHEMAS[key].aliases.includes(rawCommand)) {
        matchedCommand = key;
        break;
      }
    }
  }

  if (matchedCommand) {
    const strippedPrompt = firstSpaceIndex === -1 ? '' : trimmed.substring(firstSpaceIndex).trim();
    return {
      isCommand: true,
      command: matchedCommand,
      strippedPrompt
    };
  }

  // If it starts with '/' but isn't recognized, we treat it as normal text.
  return {
    isCommand: false,
    command: null,
    strippedPrompt: prompt
  };
}
