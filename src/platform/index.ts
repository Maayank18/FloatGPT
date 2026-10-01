/**
 * FloatGPT — Enterprise Platform Subsystem Barrel
 * 
 * Re-exports Tenancy, RBAC, Personal Data Firewall, Memory Promotion,
 * Shadow AI, Enterprise Connectors, Webhooks, Developer SDK, and Audit Trail.
 */

export * from './tenancy/types';
export * from './tenancy/rbacEngine';
export * from './tenancy/tenantManager';
export * from './tenancy/promotionBridge';

export * from './shadow/types';
export * from './shadow/shadowEngine';
export * from './shadow/orgRiskEngine';

export * from './integrations/types';
export * from './integrations/webhookHandler';
export * from './integrations/firstPartyConnectors';

export * from './sdk/floatgptSdk';
export * from './sdk/extensionSimulator';

export * from './audit/types';
export * from './audit/auditLogger';

export * from './os';
