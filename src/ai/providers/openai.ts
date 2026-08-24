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
    attachments?: any[], useWebSearch?: boolean, tools?: any[]
  ) {
    const isVisionModel = model.toLowerCase().includes('vision') || 
                          model.toLowerCase().includes('4o') || 
                          model.toLowerCase().includes('gpt-4-turbo');

    const mapAttachments = (atts: any[]) => atts.map((att: any) => ({
      type: 'image_url',
      image_url: { url: att.data }
    }));

    // History content MUST strictly be a clean string for OpenAI and Groq API compatibility
    const formatHistoryContent = (h: any): string => {
      if (typeof h.content === 'string') return h.content;
      if (Array.isArray(h.content)) {
        return h.content.map((c: any) => (typeof c === 'string' ? c : (c?.text || ''))).filter(Boolean).join('\n');
      }
      if (h.content && typeof h.content === 'object' && typeof h.content.text === 'string') {
        return h.content.text;
      }
      return String(h.content || '');
    };

    // User message content: array with image_url for vision models, clean text string for text models
    let userContent: any;
    if (attachments && attachments.length > 0) {
      if (isVisionModel) {
        userContent = [
          { type: 'text', text: prompt },
          ...mapAttachments(attachments)
        ];
      } else {
        const fileNames = attachments.map((a: any) => a.name || 'attachment').join(', ');
        userContent = `${prompt}\n\n[Attached File: ${fileNames}]`;
      }
    } else {
      userContent = prompt;
    }

    const messages = [
      { role: 'system', content: systemInstruction },
      ...history.map(h => ({
        role: h.role,
        content: formatHistoryContent(h)
      })),
      { role: 'user', content: userContent }
    ];

    const payload: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(isPlanMode ? { response_format: { type: "json_object" } } : {})
    };

    if (tools && tools.length > 0) {
      const normalizeSchemaTypes = (schema: any): any => {
        if (!schema || typeof schema !== 'object') return schema;
        if (Array.isArray(schema)) return schema.map(normalizeSchemaTypes);
        const normalized: any = {};
        for (const [key, value] of Object.entries(schema)) {
          if (key === 'type' && typeof value === 'string') {
            normalized[key] = value.toLowerCase();
          } else if (typeof value === 'object' && value !== null) {
            normalized[key] = normalizeSchemaTypes(value);
          } else {
            normalized[key] = value;
          }
        }
        return normalized;
      };

      payload.tools = tools.map((t: any) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: normalizeSchemaTypes(t.parameters)
        }
      }));
    }

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
    const messageObj = data.choices?.[0]?.message;
    
    // Handle Tool Calls (OpenAI/Groq Format)
    if (messageObj?.tool_calls && messageObj.tool_calls.length > 0) {
      const toolCall = messageObj.tool_calls[0];
      return {
        isToolCall: true,
        toolName: toolCall.function.name,
        toolArgs: JSON.parse(toolCall.function.arguments)
      };
    }

    const text = messageObj?.content;
    if (!text) throw new Error(`No text returned from ${providerLabel} API`);

    if (isPlanMode || (text.trim().startsWith('{') && (text.includes('"newGoals"') || text.includes('"newTasks"') || text.includes('"newProjects"') || text.includes('"message"')))) {
      return parseStructuredResponse(text, providerLabel);
    }

    return { message: text };
  };
}
