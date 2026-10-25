const COMMAND_MARK = /execute_os_command|Executed command successfully|Failed to execute command|PowerShell\s+-Command|Start-Process\b|osascript\b|```(?:powershell|ps1|bash|sh|shell)\b/i;

/** Drop a command FloatGPT already ran. The person sees the outcome, not the script. */
export function hideRanCommand(text: string): string {
  if (!text || text.includes('SECURITY_PROMPT_CARD')) return text;
  if (!COMMAND_MARK.test(text)) return text;
  if (/Failed to execute command|didn.?t go through/i.test(text)) return 'That didn’t go through.';
  return 'Done. Take a look.';
}
