/**
 * Token Telemetry & Observability Tracker
 * 
 * Records request metrics:
 * - inputTokens (estimated/reported)
 * - outputTokens (estimated/reported)
 * - latencyMs
 * - routeType (FAST_PATH | LLM_TIER_1 | LLM_TIER_2)
 * - provider & model
 * - cacheHits
 */

export interface TelemetryRecord {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  routeType: 'FAST_PATH' | 'LLM_TIER_1' | 'LLM_TIER_2';
  inputTokensEstimated: number;
  outputTokensEstimated: number;
  latencyMs: number;
  success: boolean;
}

class TokenTelemetryService {
  private records: TelemetryRecord[] = [];
  private readonly MAX_RECORDS = 100;

  /**
   * Fast token estimation (approximately 4 characters per token for English).
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  reset() {
    this.records = [];
  }

  getRecords(): TelemetryRecord[] {
    return [...this.records];
  }

  record(entry: Omit<TelemetryRecord, 'id' | 'timestamp'>) {
    const record: TelemetryRecord = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      ...entry
    };

    this.records.push(record);
    if (this.records.length > this.MAX_RECORDS) {
      this.records.shift();
    }
  }

  getSummary() {
    if (this.records.length === 0) {
      return {
        totalRequests: 0,
        fastPathBypassRate: '0%',
        avgLatencyMs: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalEstimatedTokens: 0,
        byProvider: {} as Record<string, { requests: number; inTokens: number; outTokens: number }>
      };
    }

    const total = this.records.length;
    const fastPathCount = this.records.filter(r => r.routeType === 'FAST_PATH').length;
    const totalLatency = this.records.reduce((acc, r) => acc + r.latencyMs, 0);
    const totalInTokens = this.records.reduce((acc, r) => acc + r.inputTokensEstimated, 0);
    const totalOutTokens = this.records.reduce((acc, r) => acc + r.outputTokensEstimated, 0);

    const byProvider: Record<string, { requests: number; inTokens: number; outTokens: number }> = {};
    for (const r of this.records) {
      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { requests: 0, inTokens: 0, outTokens: 0 };
      }
      byProvider[r.provider].requests++;
      byProvider[r.provider].inTokens += r.inputTokensEstimated;
      byProvider[r.provider].outTokens += r.outputTokensEstimated;
    }

    return {
      totalRequests: total,
      fastPathBypassRate: `${Math.round((fastPathCount / total) * 100)}%`,
      avgLatencyMs: Math.round(totalLatency / total),
      totalInputTokens: totalInTokens,
      totalOutputTokens: totalOutTokens,
      totalEstimatedTokens: totalInTokens + totalOutTokens,
      byProvider
    };
  }
}

export const TokenTelemetry = new TokenTelemetryService();
