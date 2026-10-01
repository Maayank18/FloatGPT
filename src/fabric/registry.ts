/**
 * FloatGPT — Capability Registry
 * 
 * Central catalog of all permitted, typed capabilities supported by the Execution Fabric.
 * Unregistered actions are immediately rejected at the Action Broker boundary.
 */

import { Capability } from './protocol';

export class CapabilityRegistry {
  private static capabilities: Map<string, Capability> = new Map();

  static {
    // ─── Application Capabilities ───────────────────────────────
    this.register({
      id: 'application.open',
      domain: 'application',
      name: 'Open Application',
      description: 'Launches a desktop application by name or path.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    this.register({
      id: 'application.focus',
      domain: 'application',
      name: 'Focus Window/Application',
      description: 'Brings a running application window to the foreground.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    this.register({
      id: 'application.close',
      domain: 'application',
      name: 'Close Application',
      description: 'Closes an application or window gracefully.',
      riskLevel: 'LEVEL_2_SENSITIVE',
      requiresConfirmation: true,
      reversible: false,
      supportsVerification: true,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    // ─── Browser Capabilities ───────────────────────────────────
    this.register({
      id: 'browser.navigate',
      domain: 'browser',
      name: 'Navigate to URL',
      description: 'Opens a validated HTTP/HTTPS URL in the default browser.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    this.register({
      id: 'browser.search',
      domain: 'browser',
      name: 'Search Web',
      description: 'Performs a web search via the default browser.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    // ─── Filesystem Capabilities ────────────────────────────────
    this.register({
      id: 'filesystem.read',
      domain: 'filesystem',
      name: 'Read File',
      description: 'Reads contents of a safe, permitted text/code document.',
      riskLevel: 'LEVEL_0_OBSERVE',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: false,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    this.register({
      id: 'filesystem.list_directory',
      domain: 'filesystem',
      name: 'List Directory',
      description: 'Inspects directory structure or counts items in a user workspace.',
      riskLevel: 'LEVEL_0_OBSERVE',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: false,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    this.register({
      id: 'filesystem.write',
      domain: 'filesystem',
      name: 'Write File',
      description: 'Creates or updates a document within user workspace boundaries.',
      riskLevel: 'LEVEL_2_SENSITIVE',
      requiresConfirmation: true,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    this.register({
      id: 'filesystem.delete',
      domain: 'filesystem',
      name: 'Delete File',
      description: 'Deletes a specified file in workspace.',
      riskLevel: 'LEVEL_3_DESTRUCTIVE',
      requiresConfirmation: true,
      reversible: false,
      supportsVerification: true,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    // ─── Clipboard Capabilities ─────────────────────────────────
    this.register({
      id: 'clipboard.read',
      domain: 'clipboard',
      name: 'Read Clipboard',
      description: 'Reads plain text currently on the system clipboard.',
      riskLevel: 'LEVEL_0_OBSERVE',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: false,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    this.register({
      id: 'clipboard.write',
      domain: 'clipboard',
      name: 'Write Clipboard',
      description: 'Copies text or snippet to the system clipboard.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['windows', 'macos', 'linux', 'universal']
    });

    // ─── System Capabilities ────────────────────────────────────
    this.register({
      id: 'system.get_time',
      domain: 'system',
      name: 'Get Current Time/Date',
      description: 'Returns local date, time, and timezone.',
      riskLevel: 'LEVEL_0_OBSERVE',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: false,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'system.open_settings',
      domain: 'system',
      name: 'Open System Settings',
      description: 'Opens OS settings pane (e.g. ms-settings: or macOS System Settings).',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['windows', 'macos', 'universal']
    });

    this.register({
      id: 'system.capture_screen',
      domain: 'system',
      name: 'Capture Screen',
      description: 'Takes a desktop screenshot for vision analysis.',
      riskLevel: 'LEVEL_0_OBSERVE',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: false,
      supportedPlatforms: ['windows', 'macos', 'universal']
    });

    // ─── Document Capabilities ──────────────────────────────────
    this.register({
      id: 'document.create_note',
      domain: 'document',
      name: 'Create Structured Note',
      description: 'Creates a structured note (Meeting, Study, Quick, Technical) and saves as artifact.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'document.create_pdf',
      domain: 'document',
      name: 'Create PDF Document',
      description: 'Generates a formatted, multi-page PDF document and triggers download.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'document.extract_study_pack',
      domain: 'document',
      name: 'Extract Study Pack',
      description: 'Generates flashcards, definitions, quiz MCQs, and revision checklists.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    // ─── Sharing Capabilities ───────────────────────────────────
    this.register({
      id: 'share.whatsapp',
      domain: 'share',
      name: 'Share to WhatsApp',
      description: 'Dispatches document or note to WhatsApp with recipient confirmation.',
      riskLevel: 'LEVEL_2_SENSITIVE',
      requiresConfirmation: true,
      reversible: false,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'share.email',
      domain: 'share',
      name: 'Share via Email',
      description: 'Dispatches document or note via email mailto protocol.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: false,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'share.native',
      domain: 'share',
      name: 'System Share Sheet',
      description: 'Shares document or text using native OS share dialog.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: false,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    // ─── Messaging Capabilities (Messenger Agents) ──────────────
    this.register({
      id: 'messaging.whatsapp.connect',
      domain: 'messaging',
      name: 'Connect WhatsApp Account',
      description: 'Authenticates or links WhatsApp session credentials.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'messaging.whatsapp.resolve_contact',
      domain: 'messaging',
      name: 'Resolve WhatsApp Contact',
      description: 'Resolves recipient name or phone number with disambiguation.',
      riskLevel: 'LEVEL_0_OBSERVE',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: false,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'messaging.whatsapp.send',
      domain: 'messaging',
      name: 'Send WhatsApp Message',
      description: 'Dispatches a message to authenticated recipient via WhatsApp.',
      riskLevel: 'LEVEL_2_SENSITIVE',
      requiresConfirmation: false, // User explicitly commands the action
      reversible: false,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'messaging.whatsapp.schedule',
      domain: 'messaging',
      name: 'Schedule WhatsApp Message',
      description: 'Enqueues a message for future dispatch in the persistent scheduler.',
      riskLevel: 'LEVEL_2_SENSITIVE',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'messaging.whatsapp.cancel',
      domain: 'messaging',
      name: 'Cancel Scheduled WhatsApp Message',
      description: 'Cancels a pending message in the persistent scheduler.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'messaging.linkedin.connect',
      domain: 'messaging',
      name: 'Connect LinkedIn Account',
      description: 'Links LinkedIn messaging session credentials.',
      riskLevel: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: true,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });

    this.register({
      id: 'messaging.linkedin.send',
      domain: 'messaging',
      name: 'Send LinkedIn Message',
      description: 'Dispatches a message to an authenticated LinkedIn connection.',
      riskLevel: 'LEVEL_2_SENSITIVE',
      requiresConfirmation: false,
      reversible: false,
      supportsVerification: true,
      supportedPlatforms: ['universal']
    });
  }

  static register(capability: Capability) {
    this.capabilities.set(capability.id, capability);
  }

  static get(capabilityId: string): Capability | undefined {
    return this.capabilities.get(capabilityId);
  }

  static has(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }

  static list(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  static getByDomain(domain: string): Capability[] {
    return this.list().filter(c => c.domain === domain);
  }
}
