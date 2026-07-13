/**
 * Anthropic Claude Provider Adapter
 * Handles the Anthropic-specific API format (system as top-level, content arrays).
 */

import { parseStructuredResponse } from '../validation/response';

export async function fetchAnthropic(
  apiKey: string, model: string, systemInstruction: string,
  history: any[], prompt: string, temperature: number,
  maxTokens: number, isPlanMode: boolean,
  attachments?: any[]
) {
  const mapAttachments = (atts: any[]) => atts.map((att: any) => {
    const isBase64 = att.data.includes('base64,');
    const mediaType = att.mimeType || 'image/jpeg';
    const data = isBase64 ? att.data.split('base64,')[1] : att.data;
    
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: data
      }
    };
  });

  const messages = [
    ...history.map(h => {
      let content: any = [];
      if (h.content) content.push({ type: 'text', text: h.content });
      if (h.attachments && h.attachments.length > 0) {
        content = [...content, ...mapAttachments(h.attachments)];
      }
      return { role: h.role === 'assistant' ? 'assistant' : 'user', content };
    }),
    { 
      role: 'user', 
      content: attachments && attachments.length > 0 
        ? [{ type: 'text', text: prompt }, ...mapAttachments(attachments)] 
        : prompt 
    }
  ];

  // Anthropic API doesn't support JSON response format natively in the same way,
  // we instruct it strictly in the system prompt.
  const payload: any = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemInstruction,
    messages
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerously-allow-browser': 'true'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Anthropic API Error: ${response.statusText}`);
  }

  const data = await response.json();
  let text = data.content?.[0]?.text;
  if (!text) throw new Error("No text returned from Anthropic API");

  if (isPlanMode) {
    return parseStructuredResponse(text, 'anthropic');
  }

  return { message: text };
}
