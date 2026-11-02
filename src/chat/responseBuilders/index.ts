import { SlashCommandType } from '../commandSchemas';
import { finalizeImagePrompt, imageMarkdown } from '../imagePrompt';

/**
 * Builds or formats the final string response.
 * Useful if we need to force markdown wrappers that the LLM forgot.
 */
export function buildCommandResponse(command: SlashCommandType, rawResponse: string, subject?: string): string {
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

  if (command === 'table' || command === 'compare') {
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

  if (command === 'checklist') {
    const boxes = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^([-*]|\d+[.)])\s+/.test(line))
      .map((line) => line.replace(/^([-*]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '- [ ] '));
    if (boxes.length > 0) output = boxes.join('\n');
  }

  if (command === 'define') {
    output = output
      .replace(/^(?:sure[,.]?\s*)?(?:here(?:'s| is)(?: the)? definition[:.]?\s*)/i, '')
      .trim();
  }

  if (command === 'next') {
    output = output
      .replace(/^(?:sure[,.]?\s*)?(?:here(?:'s| is)(?: the)? next step[:.]?\s*)/i, '')
      .trim();
    const first = output.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).find(Boolean);
    output = first || output;
  }

  if (command === 'image') {
    const asked = String(subject || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[*_#>`]/g, ' ')
      .replace(/^["']+|["']+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    if (!asked && !output.trim()) return 'Tell me what to draw.\n\n`/image a red house on a quiet street`';
    const prompt = finalizeImagePrompt(asked || output, output);
    return imageMarkdown(asked || output, undefined, prompt);
  }

  return output;
}
