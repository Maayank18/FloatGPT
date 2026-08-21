import { SlashCommandType } from '../commandSchemas';

/**
 * Builds or formats the final string response.
 * Useful if we need to force markdown wrappers that the LLM forgot.
 */
export function buildCommandResponse(command: SlashCommandType, rawResponse: string): string {
  let output = rawResponse.trim();

  // If the command is diagram but the LLM forgot to wrap it in a mermaid block:
  if (command === 'diagram') {
    if (!output.includes('```mermaid') && output.includes('graph TD') || output.includes('sequenceDiagram')) {
      output = `\`\`\`mermaid\n${output}\n\`\`\``;
    }
  }

  // Remove leading/trailing quotes if it's a one-liner
  if (command === 'one-liner') {
    if (output.startsWith('"') && output.endsWith('"')) {
      output = output.slice(1, -1);
    }
  }

  // Format image commands by passing the LLM enhanced text to Pollinations API
  if (command === 'image') {
    // Generate a unique seed or just encode the prompt
    const seed = Math.floor(Math.random() * 1000000000);
    const encodedPrompt = encodeURIComponent(output);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
    output = `![Generated Image](${url})\n\n*Prompt: ${output}*`;
  }

  return output;
}
