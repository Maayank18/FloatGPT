import { SlashCommandType } from '../commandSchemas';

/**
 * Guards validate the output to ensure the LLM didn't break the rules.
 * If it did, we can either throw an error (triggering a retry) or clean it up.
 */
export function validateCommandResponse(command: SlashCommandType, response: string): boolean {
  if (!response || response.trim() === '') return false;

  // Example: a one-liner shouldn't be massive.
  if (command === 'one-liner') {
    if (response.split('\n').length > 3) {
      // It wrote a paragraph instead of a one-liner
      console.warn(`[Command Guard] one-liner response was too long.`);
      // We'll let it pass for now but could throw an error to trigger retry
    }
  }

  // Ensure image prompt isn't ridiculously long
  if (command === 'image') {
    if (response.length > 1000) {
      console.warn(`[Command Guard] image prompt response was too long. Truncating.`);
      // We don't throw, we just let it pass, but it's good to log.
    }
  }

  return true;
}
