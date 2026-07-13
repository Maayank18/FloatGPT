/**
 * Google Gemini Provider Adapter
 * Handles the Gemini-specific API format, including web search tools.
 */

import { parseStructuredResponse } from '../validation/response';

export async function fetchGoogleGemini(
  apiKey: string, model: string, systemInstruction: string, 
  history: any[], prompt: string, temperature: number, 
  maxTokens: number, isPlanMode: boolean, 
  attachments?: any[], useWebSearch?: boolean
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
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text returned from Gemini API");
  
  if (isPlanMode) {
    return parseStructuredResponse(text, 'gemini');
  }

  return { message: text };
}
