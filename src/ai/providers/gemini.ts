/**
 * Google Gemini Provider Adapter
 * Handles the Gemini-specific API format, including web search tools.
 */

import { parseStructuredResponse } from '../validation/response';

export async function fetchGoogleGemini(
  apiKey: string, model: string, systemInstruction: string, 
  history: any[], prompt: string, temperature: number, 
  maxTokens: number, isPlanMode: boolean, 
  attachments?: any[], useWebSearch?: boolean, tools?: any[]
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const mapAttachments = (atts: any[]) => atts.map((att: any) => ({
    inlineData: {
      mimeType: att.mimeType,
      data: att.data.includes('base64,') ? att.data.split('base64,')[1] : att.data
    }
  }));

  const contents = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }, ...(h.attachments ? mapAttachments(h.attachments) : [])]
  }));
  contents.push({ role: 'user', parts: [{ text: prompt }, ...(attachments ? mapAttachments(attachments) : [])] });

  const payload: any = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(isPlanMode ? { responseMimeType: "application/json" } : {})
    }
  };

  if (useWebSearch) {
    if (model.includes('2.5') || model.includes('3.0') || model.includes('3.5')) {
      payload.tools = [{ google_search: {} }];
    } else {
      payload.tools = [{ googleSearchRetrieval: { dynamicRetrievalConfig: { mode: "MODE_DYNAMIC", dynamicThreshold: 0.3 } } }];
    }
  } else if (tools && tools.length > 0) {
    const toGeminiSchemaTypes = (schema: any): any => {
      if (!schema || typeof schema !== 'object') return schema;
      if (Array.isArray(schema)) return schema.map(toGeminiSchemaTypes);
      const normalized: any = {};
      for (const [key, value] of Object.entries(schema)) {
        if (key === 'type' && typeof value === 'string') {
          normalized[key] = value.toUpperCase();
        } else if (typeof value === 'object' && value !== null) {
          normalized[key] = toGeminiSchemaTypes(value);
        } else {
          normalized[key] = value;
        }
      }
      return normalized;
    };

    payload.tools = [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: toGeminiSchemaTypes(t.parameters)
      }))
    }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Google API Error: ${response.statusText}`);
  }

  const data = await response.json();
  const part = data.candidates?.[0]?.content?.parts?.[0];
  
  if (!part) throw new Error("No content returned from Gemini API");
  
  // Handle Function Call return
  if (part.functionCall) {
    return { 
      isToolCall: true,
      toolName: part.functionCall.name,
      toolArgs: part.functionCall.args 
    };
  }

  const text = part.text;
  if (!text) throw new Error("No text returned from Gemini API");
  
  if (isPlanMode) {
    return parseStructuredResponse(text, 'gemini');
  }

  return { message: text };
}
