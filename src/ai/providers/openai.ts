/**
 * OpenAI-Compatible Provider Adapter
 * Shared adapter for OpenAI and Groq (both use the OpenAI chat completions format).
 * A factory function takes the endpoint URL to differentiate providers.
 */

import { parseStructuredResponse } from '../validation/response';

export function createOpenAICompatibleProvider(endpoint: string, providerLabel: string) {
  return async function fetchOpenAICompatible(
    apiKey: string, model: string, systemInstruction: string,
    history: any[], prompt: string, temperature: number,
    maxTokens: number, isPlanMode: boolean,
    attachments?: any[]
  ) {
    const mapAttachments = (atts: any[]) => atts.map((att: any) => ({
      type: 'image_url',
      image_url: { url: att.data }
    }));

    const messages = [
      { role: 'system', content: systemInstruction },
      ...history.map(h => ({
        role: h.role,
        content: h.attachments ? [{ type: 'text', text: h.content }, ...mapAttachments(h.attachments)] : h.content
      })),
      { role: 'user', content: attachments && attachments.length > 0 ? [{ type: 'text', text: prompt }, ...mapAttachments(attachments)] : prompt }
    ];

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(isPlanMode ? { response_format: { type: "json_object" } } : {})
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `${providerLabel} API Error: ${response.statusText}`);
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`No text returned from ${providerLabel} API`);

    if (isPlanMode) {
      return parseStructuredResponse(text, providerLabel);
    }

    return { message: text };
  };
}
