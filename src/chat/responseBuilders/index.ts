import { SlashCommandType } from '../commandSchemas';

/**
 * Builds or formats the final string response.
 * Useful if we need to force markdown wrappers that the LLM forgot.
 */
export function buildCommandResponse(command: SlashCommandType, rawResponse: string): string {
  let output = rawResponse.trim();

  if (command === 'diagram') {
    const alreadyFenced = /```mermaid/i.test(output);
    if (!alreadyFenced) {
      const body = output.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
      output = `\`\`\`mermaid\n${body}\n\`\`\``;
    }
  }

  if (command === 'translate') {
    output = output
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/i, '')
      .replace(/^(?:sure[,.]?\s*)?(?:here(?:'s| is)(?: the)? translation[:.]?\s*)/i, '')
      .replace(/^translation:\s*/i, '')
      .replace(/\n+(?:note|translator's note):[\s\S]*$/i, '')
      .trim();
  }

  if (command === 'email') {
    output = output
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/i, '')
      .replace(/^(?:sure[,.]?\s*)?(?:here(?:'s| is)(?: your| a| the)? (?:draft|email)[:.]?\s*)/i, '')
      .replace(/^\*\*Subject:\*\*/i, 'Subject:')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (command === 'one-liner') {
    const first = output
      .split('\n')
      .map((line) => line.replace(/^[-*]\s+/, '').replace(/^["'`]+|["'`]+$/g, '').trim())
      .find(Boolean);
    output = first || output;
  }

  if (command === 'table') {
    const lines = output.split('\n');
    const start = lines.findIndex((line) => line.trim().startsWith('|'));
    if (start >= 0) {
      const table: string[] = [];
      for (let i = start; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('|')) break;
        table.push(lines[i]);
      }
      if (table.length >= 2) output = table.join('\n');
    }
  }

  if (command === 'image') {
    const cleaned = output
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[*_#>`]/g, ' ')
      .replace(/^["']+|["']+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);
    if (!cleaned) return 'I need a short description after /image.';
    const encodedPrompt = encodeURIComponent(cleaned);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux&width=768&height=768&nologo=true&enhance=true`;
    output = `![Generated Image](${url})\n\n*Prompt: ${cleaned}*`;
  }

  return output;
}
