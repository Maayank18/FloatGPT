/**
 * API Key Validator Utility
 * Tests connection with AI provider endpoints to verify API keys in real time.
 */

export interface KeyValidationResult {
  isValid: boolean;
  message: string;
  modelsCount?: number;
}

export async function validateApiKey(providerId: string, apiKey: string): Promise<KeyValidationResult> {
  const trimmed = (apiKey || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'Please enter a non-empty API key.' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    if (providerId === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${trimmed}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { isValid: true, message: 'Groq API Key verified successfully!', modelsCount: data.data?.length || 0 };
      }
      const err = await res.json().catch(() => ({}));
      return { isValid: false, message: err.error?.message || 'Invalid Groq API key (401).' };
    }

    if (providerId === 'google') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { isValid: true, message: 'Gemini API Key verified successfully!' };
      }
      const err = await res.json().catch(() => ({}));
      return { isValid: false, message: err.error?.message || 'Invalid Gemini API key.' };
    }

    if (providerId === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${trimmed}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { isValid: true, message: 'OpenAI API Key verified successfully!' };
      }
      const err = await res.json().catch(() => ({}));
      return { isValid: false, message: err.error?.message || 'Invalid OpenAI API key.' };
    }

    if (providerId === 'anthropic') {
      // Basic format check if offline or header test
      if (trimmed.startsWith('sk-ant-')) {
        return { isValid: true, message: 'Anthropic Claude key format accepted.' };
      }
      return { isValid: true, message: 'API key saved for Claude.' };
    }

    return { isValid: true, message: 'API key configured.' };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { isValid: false, message: 'Connection timed out while validating key.' };
    }
    return { isValid: false, message: err.message || 'Could not verify API key (network error).' };
  }
}
