/**
 * AI Observability Logger
 * Lightweight structured logging for AI request lifecycle.
 * No external dependencies — outputs to console with structured prefixes.
 */

export const AILogger = {
  logRequest(scope: string, provider: string, model: string): void {
    console.log(`[AI:Request] scope=${scope} provider=${provider} model=${model}`);
  },

  logSuccess(provider: string, latencyMs: number): void {
    console.log(`[AI:Success] provider=${provider} latency=${latencyMs}ms`);
  },

  logFailure(provider: string, error: string, willRetry: boolean): void {
    console.error(`[AI:Failure] provider=${provider} error="${error}" willRetry=${willRetry}`);
  },

  logValidationFailure(provider: string, rawText: string): void {
    console.error(`[AI:ValidationFailed] provider=${provider} rawLength=${rawText.length} preview="${rawText.substring(0, 120)}..."`);
  },

  logFallback(fromProvider: string, toProvider: string, reason: string): void {
    console.warn(`[AI:Fallback] from=${fromProvider} to=${toProvider} reason="${reason}"`);
  },

  logKeyResolution(scope: string, providerId: string, hasKey: boolean): void {
    console.log(`[AI:KeyResolution] scope=${scope} provider=${providerId} keyFound=${hasKey}`);
  }
};
