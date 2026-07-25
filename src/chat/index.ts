import { AppState } from '../types';
import { routeCommand, CommandRouteResult } from './commandRouter';
import { getCommandSystemPrompt } from './promptTemplates';
import { buildCommandResponse } from './responseBuilders';
import { validateCommandResponse } from './guards';
import { SlashCommandType } from './commandSchemas';

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
