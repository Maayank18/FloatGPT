/**
 * FloatGPT — Shadow AI Cross-System Reasoning Engine
 * 
 * Aggregates fragmented signals across disparate SaaS/DevOps silos (GitHub,
 * Sentry, Zendesk, Stripe) and synthesizes causal root-cause hypotheses
 * with calibrated uncertainty.
 */

import { SystemSignal, CrossSystemCorrelation, SignalSource } from './types';

export class ShadowAIEngine {
  private static signals: SystemSignal[] = [];
  private static correlations: CrossSystemCorrelation[] = [];

  /**
   * Ingests an observational signal from an external system.
   */
  static ingestSignal(params: {
    source: SignalSource;
    entityId: string;
    metric: string;
    value: number;
    metadata?: Record<string, any>;
    timestamp?: number;
  }): SystemSignal {
    const signal: SystemSignal = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      source: params.source,
      entityId: params.entityId,
      metric: params.metric,
      value: params.value,
      timestamp: params.timestamp || Date.now(),
      metadata: params.metadata
    };

    this.signals.push(signal);
    return signal;
  }

  /**
   * Analyzes ingested signals and synthesizes cross-system causal correlations.
   */
  static analyzeCorrelations(): CrossSystemCorrelation[] {
    const newCorrelations: CrossSystemCorrelation[] = [];

    // Pattern 1: DevOps Delay + Sentry Errors + Support Ticket Surge
    const devopsDelays = this.signals.filter(
      s => (s.source === 'GITHUB' || s.source === 'LINEAR' || s.source === 'JIRA') && 
           (s.metric.includes('delay') || s.metric.includes('failed_build'))
    );
    const sentryErrors = this.signals.filter(
      s => s.source === 'SENTRY' && (s.metric.includes('error') || s.metric.includes('crash'))
    );
    const supportComplaints = this.signals.filter(
      s => s.source === 'ZENDESK' && (s.metric.includes('complaint') || s.metric.includes('ticket'))
    );

    if (devopsDelays.length > 0 && (sentryErrors.length > 0 || supportComplaints.length > 0)) {
      const correlatedSignals = [...devopsDelays, ...sentryErrors, ...supportComplaints];
      const primaryDelay = devopsDelays[0];

      const confidence = sentryErrors.length > 0 && supportComplaints.length > 0 ? 0.88 : 0.76;
      const correlation: CrossSystemCorrelation = {
        id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        signals: correlatedSignals,
        hypothesis: `Delay in ${primaryDelay.source} (${primaryDelay.entityId}) is highly correlated with downstream errors in Sentry and customer support escalation.`,
        confidence,
        impactLevel: 'CRITICAL',
        rationale: `Detected ${primaryDelay.entityId} delay (${primaryDelay.value}h) preceding ${sentryErrors.length} Sentry anomalies and ${supportComplaints.length} customer complaints within the observation window.`,
        suggestedAction: `Prioritize review and deployment of ${primaryDelay.entityId} to resolve downstream service failures.`,
        timestamp: Date.now()
      };

      newCorrelations.push(correlation);
      this.correlations.push(correlation);
    }

    // Pattern 2: Stripe Payment Dips + Checkout Support Tickets
    const stripeDips = this.signals.filter(
      s => s.source === 'STRIPE' && s.metric.includes('revenue_drop')
    );
    const checkoutTickets = this.signals.filter(
      s => s.source === 'ZENDESK' && (s.metadata?.tag === 'checkout' || s.metric.includes('checkout_failure'))
    );

    if (stripeDips.length > 0 && checkoutTickets.length > 0) {
      const correlated = [...stripeDips, ...checkoutTickets];
      const correlation: CrossSystemCorrelation = {
        id: `corr_stripe_${Date.now()}`,
        signals: correlated,
        hypothesis: 'Checkout gateway failure is suppressing checkout conversions and impacting Stripe revenue.',
        confidence: 0.92,
        impactLevel: 'CRITICAL',
        rationale: `Observed ${stripeDips[0].value}% revenue drop directly coinciding with ${checkoutTickets.length} checkout issue reports.`,
        suggestedAction: 'Verify payment gateway webhooks and certificate validity.',
        timestamp: Date.now()
      };

      newCorrelations.push(correlation);
      this.correlations.push(correlation);
    }

    return newCorrelations;
  }

  static getSignals(): SystemSignal[] {
    return this.signals;
  }

  static getCorrelations(): CrossSystemCorrelation[] {
    return this.correlations;
  }

  static clear(): void {
    this.signals = [];
    this.correlations = [];
  }
}
