import { detectPlatform } from '../../platform';

export function buildChatPrompt(basePersona: string, timeContext: string, compressedState: string, customChatContext?: string): string {
  const customContextBlock = customChatContext?.trim()
    ? `\nUser notes:\n${customChatContext.trim()}\n`
    : '';

  const isMac = detectPlatform() === 'darwin';

  return `${basePersona}

${timeContext}
OS: ${isMac ? 'macOS' : 'Windows'}
${customContextBlock}
Context: ${compressedState}

Rules:
- Answer the question the user just asked. Do not recite focus, tasks, the clock, or the OS unless they asked about those.
- Direct, dense answers. No filler.
- OS/apps/browser/settings: call execute_os_command with a complete script. Never dump unexecuted raw JSON into chat.
- WhatsApp: user can say "Send a WhatsApp to [name] saying [text]". Do not claim you cannot message.`;
}
