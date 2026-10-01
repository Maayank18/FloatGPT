/**
 * FloatGPT — Messenger Agent Orchestrator
 * 
 * Top-level Agent orchestrator for messaging operations.
 * Implements the full pipeline:
 * Intent -> Multi-turn Context -> Recipient Resolution -> Auth Check -> Composition -> Scheduling/Execution -> Verification -> Audit -> User Response
 */

import { MessageIntentParser } from './MessageIntentParser';
import { RecipientResolver } from './RecipientResolver';
import { MessageComposer } from './MessageComposer';
import { MessageExecutor } from './MessageExecutor';
import { MessageScheduler } from '../scheduler/MessageScheduler';
import { MessengerRegistry } from './MessengerRegistry';
import { WhatsAppAuth } from '../whatsapp/WhatsAppAuth';
import {
  MessagePlatform,
  MessageAction,
  ResolvedRecipient,
  MessagePayload
} from '../types/messenger.types';

const DISPATCH_CONFIRM_MARKER = 'FLOATGPT_DISPATCH_CONFIRM';
const CONFIRM_WINDOW_MS = 5000;

interface PendingMessengerSession {
  platform: MessagePlatform;
  action: MessageAction;
  recipientQuery?: string;
  messageContent?: string;
  scheduledAt?: string | null;
  scheduledEpochMs?: number | null;
  timezone?: string;
  waitingFor: 'recipient' | 'message' | 'client_preference' | 'confirm_send' | 'overdue_confirm';
  clientPreference?: 'desktop' | 'web';
  resolvedRecipient?: ResolvedRecipient;
  payload?: MessagePayload;
  overdueJobId?: string;
  timestamp: number;
}

export class MessengerAgent {
  private static pendingSession: PendingMessengerSession | null = null;
  private static confirmTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Checks if an active conversational messaging session is awaiting follow-up input.
   */
  static hasPendingSession(): boolean {
    if (!this.pendingSession) return false;
    // Expire after 60 seconds of inactivity to prevent trapping casual chat
    if (Date.now() - this.pendingSession.timestamp > 60 * 1000) {
      this.clearConfirmTimer();
      this.pendingSession = null;
      return false;
    }
    return true;
  }

  static getPendingSession(): PendingMessengerSession | null {
    return this.hasPendingSession() ? this.pendingSession : null;
  }

  static clearPendingSession(): void {
    this.clearConfirmTimer();
    this.pendingSession = null;
  }

  private static clearConfirmTimer(): void {
    if (this.confirmTimer) {
      clearTimeout(this.confirmTimer);
      this.confirmTimer = null;
    }
  }

  static async confirmPendingSend(): Promise<{ handled: boolean; message?: string; actionExecuted?: string; data?: any }> {
    return this.commitConfirmSend();
  }

  static async cancelPendingSend(): Promise<{ handled: boolean; message?: string; actionExecuted?: string; data?: any }> {
    const sess = this.pendingSession;
    this.clearPendingSession();
    if (sess?.waitingFor === 'overdue_confirm' && sess.overdueJobId) {
      await MessageScheduler.cancelJob(sess.overdueJobId);
      return {
        handled: true,
        message: `🚫 Discarded overdue message to **${sess.resolvedRecipient?.name || sess.recipientQuery}**.`,
        actionExecuted: 'cancel_overdue'
      };
    }
    return {
      handled: true,
      message: `❌ Cancelled WhatsApp message to **${sess?.resolvedRecipient?.name || sess?.recipientQuery || 'recipient'}**.`,
      actionExecuted: 'cancel_send'
    };
  }

  /**
   * Primary entry point for natural-language messaging requests.
   */
  static async handleUserInstruction(rawPrompt: string): Promise<{
    handled: boolean;
    message?: string;
    actionExecuted?: string;
    data?: any;
  }> {
    const prompt = rawPrompt.trim();
    const lowerPrompt = prompt.toLowerCase();

    // ─── Check Multi-Turn Slot Filling Memory ────────────────────
    if (this.hasPendingSession()) {
      const sess = this.pendingSession!;

      // ─── Escape Hatch 1: Explicit cancellation / dismissal ───
      if (
        /^(cancel|stop|abort|never\s*mind|exit|quit|dismiss|back|undo|forget\s*it|nah|close)$/i.test(lowerPrompt) ||
        /^(no|nope)$/i.test(lowerPrompt.trim())
      ) {
        return this.cancelPendingSend();
      }

      // ─── Escape Hatch 2: Local OS / media / system commands ───
      const isLocalOrOsCommand = /^(open|launch|start|run|play|pause|mute|unmute|volume|battery|ram|memory|cpu|disk|storage|screenshot|camera|task|goal|note)\b/i.test(lowerPrompt);
      if (isLocalOrOsCommand) {
        this.clearPendingSession();
        return { handled: false };
      }

      // ─── Escape Hatch 3: Casual greetings when waiting for a recipient ───
      // If we are asking "Who would you like to message?", casual greetings or "yes/ok" are NOT contact names!
      if (sess.waitingFor === 'recipient') {
        const isCasualGreetingOrChat = /^(hi|hello|hey|howdy|greetings|how are you|how r u|what's up|sup|who are you|what can you do|good (morning|afternoon|evening))\b/i.test(lowerPrompt) ||
          /^(what (is|are)|how (do|is)|tell me|why|where|can you|who is)\b/i.test(lowerPrompt) ||
          /^(yes|ok|okay|sure|fine|yep|yeah)$/i.test(lowerPrompt.trim()) ||
          prompt.length > 40;

        if (isCasualGreetingOrChat) {
          this.clearPendingSession();
          return { handled: false };
        }
      }

      if (sess.waitingFor === 'confirm_send' || sess.waitingFor === 'overdue_confirm') {
        if (/^(send now|send it now|yes|ok|okay|proceed|confirm|send)$/i.test(lowerPrompt.trim())) {
          return this.commitConfirmSend();
        }
        const nestedIntent = MessageIntentParser.parse(prompt);
        if (nestedIntent) {
          this.clearPendingSession();
        } else {
          this.pendingSession = { ...sess, timestamp: Date.now() };
          return {
            handled: true,
            message: `⏳ Reply **Send Now** or **Cancel**. Auto-send in a few seconds.`,
            actionExecuted: sess.waitingFor
          };
        }
      } else if (sess.waitingFor === 'message') {
        return this.executePipeline({
          platform: sess.platform,
          action: sess.action,
          recipientQuery: sess.recipientQuery!,
          messageContent: prompt,
          scheduledAt: sess.scheduledAt || undefined,
          timezone: sess.timezone || undefined,
          clientPreference: sess.clientPreference
        });
      } else if (sess.waitingFor === 'recipient') {
        // If the prompt is just "yes", "ok", or punctuation, it's not a recipient name!
        if (/^(yes|ok|okay|sure|fine|yep|yeah)$/i.test(lowerPrompt.trim()) || prompt.length > 40) {
          this.clearPendingSession();
          return { handled: false };
        }

        return this.executePipeline({
          platform: sess.platform,
          action: sess.action,
          recipientQuery: prompt,
          messageContent: sess.messageContent!,
          scheduledAt: sess.scheduledAt || undefined,
          timezone: sess.timezone || undefined,
          clientPreference: sess.clientPreference
        });
      } else if (sess.waitingFor === 'client_preference') {
        if (/\b(cancel|stop|abort|never\s*mind|dismiss)\b/i.test(lowerPrompt) || /^(no)$/i.test(lowerPrompt.trim())) {
          this.clearPendingSession();
          return {
            handled: true,
            message: `❌ Cancelled WhatsApp message to **${sess.recipientQuery}**.`,
            actionExecuted: 'cancel_send'
          };
        }

        let chosenClient: 'desktop' | 'web' | null = null;
        if (/\b(desktop|app|native|pc|windows)\b/i.test(lowerPrompt) || /^(2|two)$/i.test(lowerPrompt.trim())) {
          chosenClient = 'desktop';
        } else if (/\b(web|browser|chrome|edge|firefox|brave)\b/i.test(lowerPrompt) || /^(1|one)$/i.test(lowerPrompt.trim())) {
          chosenClient = 'web';
        }

        if (!chosenClient) {
          this.pendingSession = { ...sess, timestamp: Date.now() };
          return {
            handled: true,
            message: this.formatClientAsk(sess.recipientQuery || 'recipient', sess.messageContent || ''),
            actionExecuted: 'ask_client_preference'
          };
        }

        if (/\b(always|forever|default|remember)\b/i.test(lowerPrompt)) {
          await WhatsAppAuth.setClientType(chosenClient);
        }

        this.clearPendingSession();
        return this.executePipeline({
          platform: sess.platform,
          action: sess.action,
          recipientQuery: sess.recipientQuery!,
          messageContent: sess.messageContent!,
          scheduledAt: sess.scheduledAt || undefined,
          timezone: sess.timezone || undefined,
          clientPreference: chosenClient
        });
      }
    }

    // ─── 1. Understand Intent ────────────────────────────────────
    const intent = MessageIntentParser.parse(prompt);
    if (!intent) {
      return { handled: false };
    }

    const { platform, action, recipientQuery, messageContent, scheduledAt, timezone, clientPreference } = intent;

    // ─── Action: List Scheduled Messages ─────────────────────────
    if (action === 'list_scheduled') {
      const pending = await MessageScheduler.getPending();
      if (pending.length === 0) {
        return {
          handled: true,
          message: '📅 **No Scheduled Messages**\nYou have zero pending messages queued in the persistent scheduler.',
          actionExecuted: 'list_scheduled'
        };
      }

      const listItems = pending.map((job, idx) => {
        const timeStr = new Date(job.scheduledEpochMs).toLocaleString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const overdue = job.status === 'OVERDUE_PENDING' ? '\n   - **Status:** ⚠️ OVERDUE — reply **Send Now** or **Cancel**' : '';
        return `${idx + 1}. ✉️ **${job.recipient.name}** (${job.platform.toUpperCase()})\n   - **Time:** \`${timeStr}\`\n   - **Message:** *"${job.message.content}"*\n   - **Job ID:** \`${job.id}\`${overdue}`;
      }).join('\n\n');

      const firstOverdue = pending.find(j => j.status === 'OVERDUE_PENDING');
      if (firstOverdue) {
        this.pendingSession = {
          platform: firstOverdue.platform,
          action: 'send_message',
          recipientQuery: firstOverdue.recipient.name,
          messageContent: firstOverdue.message.content,
          waitingFor: 'overdue_confirm',
          resolvedRecipient: firstOverdue.recipient,
          payload: firstOverdue.message,
          overdueJobId: firstOverdue.id,
          timestamp: Date.now()
        };
      }

      return {
        handled: true,
        message: `📋 **Scheduled Messages (${pending.length} pending):**\n\n${listItems}`,
        actionExecuted: 'list_scheduled',
        data: pending
      };
    }

    // ─── Action: Cancel Scheduled Message ───────────────────────
    if (action === 'cancel_message') {
      const pending = await MessageScheduler.getPending();
      const targetQuery = (recipientQuery || '').toLowerCase();

      const match = pending.find(j => 
        j.id === targetQuery || 
        j.recipient.name.toLowerCase().includes(targetQuery) ||
        j.recipient.identifier.includes(targetQuery)
      );

      if (!match) {
        return {
          handled: true,
          message: `⚠️ Could not find any pending scheduled message matching "${recipientQuery}".`,
          actionExecuted: 'cancel_message'
        };
      }

      await MessageScheduler.cancelJob(match.id);
      return {
        handled: true,
        message: `🚫 **Scheduled Message Cancelled**\nThe message to **${match.recipient.name}** (scheduled for ${new Date(match.scheduledEpochMs).toLocaleTimeString()}) has been cancelled.`,
        actionExecuted: `cancel_message:${match.id}`
      };
    }

    // ─── Action: Send or Schedule Message ────────────────────────
    return this.executePipeline({
      platform,
      action,
      recipientQuery,
      messageContent,
      scheduledAt: scheduledAt || undefined,
      timezone,
      clientPreference
    });
  }

  /**
   * Internal pipeline execution with slot-filling preservation.
   */
  private static async executePipeline(params: {
    platform: MessagePlatform;
    action: MessageAction;
    recipientQuery?: string;
    messageContent?: string;
    scheduledAt?: string;
    timezone?: string;
    clientPreference?: 'desktop' | 'web';
    skipConfirmation?: boolean;
  }): Promise<{
    handled: boolean;
    message?: string;
    actionExecuted?: string;
    data?: any;
  }> {
    const { platform, action, recipientQuery, messageContent, scheduledAt, timezone, clientPreference } = params;
    this.clearPendingSession();

    if (!recipientQuery) {
      this.pendingSession = {
        platform,
        action,
        messageContent,
        scheduledAt,
        timezone,
        waitingFor: 'recipient',
        timestamp: Date.now()
      };
      return {
        handled: true,
        message: `❓ Who would you like to message on ${platform.toUpperCase()}? Please specify their name or phone number.`,
        actionExecuted: 'ask_recipient'
      };
    }

    if (!messageContent) {
      this.pendingSession = {
        platform,
        action,
        recipientQuery,
        scheduledAt,
        timezone,
        waitingFor: 'message',
        timestamp: Date.now()
      };
      return {
        handled: true,
        message: `❓ What would you like to say to **${recipientQuery}** on ${platform.toUpperCase()}?`,
        actionExecuted: 'ask_message'
      };
    }

    // 2. Resolve Recipient
    const resolution = await RecipientResolver.resolve(recipientQuery, platform);

    if (!resolution.success) {
      if (resolution.isAmbiguous) {
        return {
          handled: true,
          message: resolution.disambiguation.disambiguationPrompt,
          actionExecuted: 'recipient_disambiguation',
          data: resolution.disambiguation.candidates
        };
      } else {
        const looksLikePlausibleName = /^[a-zA-Z0-9\s+._-]{1,30}$/.test(recipientQuery.trim()) &&
          !/^(hi|hello|hey|yes|no|ok|okay|why|what|how)\b/i.test(recipientQuery.trim());

        if (looksLikePlausibleName) {
          // Save session so user can reply with their phone number directly
          this.pendingSession = {
            platform,
            action,
            messageContent,
            scheduledAt,
            timezone,
            waitingFor: 'recipient',
            timestamp: Date.now()
          };
        } else {
          this.clearPendingSession();
        }

        return {
          handled: true,
          message: `⚠️ I couldn't find **"${recipientQuery}"** in your contacts.\n\nPlease reply with their phone number (e.g. \`+91 99533 14976\`), add them in **Settings → Messaging**, or reply **cancel** to dismiss.`,
          actionExecuted: 'recipient_not_found'
        };
      }
    }

    const recipient = resolution.recipient;

    // 3. Compose & Validate Message
    const composition = MessageComposer.compose(messageContent, platform);
    if (!composition.success || !composition.payload) {
      return {
        handled: true,
        message: `⚠️ ${composition.error || 'Invalid message content.'}`,
        actionExecuted: 'invalid_message'
      };
    }

    const payload = composition.payload;

    // 4. Authenticate Platform Account
    const adapter = MessengerRegistry.get(platform);
    if (!adapter) {
      return {
        handled: true,
        message: `⚠️ Platform adapter for **${platform.toUpperCase()}** is not installed.`,
        actionExecuted: 'unsupported_platform'
      };
    }

    const isAuthed = await adapter.isAuthenticated();
    if (!isAuthed) {
      return {
        handled: true,
        message: `⚠️ **${platform.toUpperCase()} is not connected yet.**\nPlease connect your WhatsApp account in **Settings → MESSAGING** before sending messages.`,
        actionExecuted: 'auth_required'
      };
    }

    // 5. Schedule vs Instant Send
    if (action === 'schedule_message' && scheduledAt) {
      const storedClient = platform === 'whatsapp'
        ? (clientPreference || await WhatsAppAuth.getClientType())
        : undefined;

      if (platform === 'whatsapp' && !clientPreference && storedClient === 'ask') {
        this.pendingSession = {
          platform,
          action,
          recipientQuery: recipient.identifier || recipient.name,
          messageContent: payload.content,
          scheduledAt,
          timezone,
          waitingFor: 'client_preference',
          resolvedRecipient: recipient,
          payload,
          timestamp: Date.now()
        };
        return {
          handled: true,
          message: this.formatClientAsk(recipient.name, payload.content),
          actionExecuted: 'ask_client_preference'
        };
      }

      const job = await MessageScheduler.schedule({
        platform,
        recipient,
        message: payload,
        scheduledAt,
        timezone: timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'),
        clientType: storedClient === 'desktop' ? 'desktop' : 'web'
      });

      const formattedTime = new Date(job.scheduledEpochMs).toLocaleString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return {
        handled: true,
        message: `✓ **Scheduled on ${platform.toUpperCase()}**\n\n- **To:** ${recipient.name} (\`${recipient.identifier}\`)\n- **Time:** ${formattedTime}\n- **Message:** *"${payload.content}"*\n- **Job ID:** \`${job.id}\``,
        actionExecuted: `schedule_message:${job.id}`,
        data: job
      };
    }

    // Resolve client preference for WhatsApp — ask when Settings is "Ask each time"
    let clientType = clientPreference;

    if (platform === 'whatsapp' && (action === 'send_message' || action === 'schedule_message')) {
      const storedClient = await WhatsAppAuth.getClientType();

      if (!clientType) {
        if (storedClient === 'ask') {
          this.pendingSession = {
            platform,
            action,
            recipientQuery: recipient.identifier || recipient.name,
            messageContent: payload.content,
            scheduledAt,
            timezone,
            waitingFor: 'client_preference',
            resolvedRecipient: recipient,
            payload,
            timestamp: Date.now()
          };
          return {
            handled: true,
            message: this.formatClientAsk(recipient.name, payload.content),
            actionExecuted: 'ask_client_preference'
          };
        }
        clientType = storedClient === 'desktop' ? 'desktop' : 'web';
      }
    }

    // Instant Execution — 5s reversible gate in interactive surfaces only
    if (
      platform === 'whatsapp' &&
      action === 'send_message' &&
      typeof window !== 'undefined' &&
      !params.skipConfirmation
    ) {
      return this.armConfirmGate({
        platform,
        action,
        recipientQuery: recipient.identifier || recipient.name,
        messageContent: payload.content,
        scheduledAt,
        timezone,
        clientPreference: clientType,
        resolvedRecipient: recipient,
        payload
      });
    }

    return this.dispatchInstant(platform, recipient, payload, clientType);
  }

  private static formatClientAsk(name: string, content: string): string {
    const preview = content.length > 140 ? `${content.slice(0, 140)}…` : content;
    return [
      `📱 **Where should I send this WhatsApp?**`,
      ``,
      `- **To:** ${name}`,
      `- **Message:** *"${preview}"*`,
      ``,
      `1️⃣ **Web** — FloatGPT’s WhatsApp window (scan QR once). **This clicks Send.**`,
      `2️⃣ **Desktop** — opens the Windows WhatsApp app (often only pre-fills; you may still tap Send).`,
      ``,
      `Reply **1** / **Web** or **2** / **Desktop**. Add **always** to remember (e.g. \`web always\`).`,
      `Reply **Cancel** to abort.`
    ].join('\n');
  }

  private static armConfirmGate(sess: Omit<PendingMessengerSession, 'waitingFor' | 'timestamp'>): {
    handled: boolean;
    message?: string;
    actionExecuted?: string;
    data?: any;
  } {
    this.clearConfirmTimer();
    this.pendingSession = {
      ...sess,
      waitingFor: 'confirm_send',
      timestamp: Date.now()
    };

    const recipient = sess.resolvedRecipient!;
    const payload = sess.payload!;
    const phone = recipient.phoneNormalized || recipient.identifier;
    return {
      handled: true,
      message: this.formatConfirmCard(recipient.name, phone, payload.content),
      actionExecuted: 'confirm_send',
      data: {
        recipient,
        message: payload.content,
        clientType: sess.clientPreference,
        countdownMs: CONFIRM_WINDOW_MS
      }
    };
  }

  private static formatConfirmCard(name: string, phone: string, content: string): string {
    return [
      `<!--${DISPATCH_CONFIRM_MARKER}-->`,
      `✉️ **Ready to send on WhatsApp**`,
      ``,
      `- **To:** ${name} (\`${phone}\`)`,
      `- **Message:** *"${content}"*`,
      `- **Auto-send:** 5 seconds (reversible)`,
      ``,
      `Reply **Send Now** or **Cancel**, or use the buttons below.`
    ].join('\n');
  }

  private static async commitConfirmSend(): Promise<{
    handled: boolean;
    message?: string;
    actionExecuted?: string;
    data?: any;
  }> {
    const sess = this.pendingSession;
    this.clearConfirmTimer();

    if (!sess) {
      return { handled: true, message: 'Nothing pending to send.', actionExecuted: 'confirm_idle' };
    }

    if (sess.waitingFor === 'overdue_confirm' && sess.overdueJobId) {
      this.pendingSession = null;
      const jobs = await MessageScheduler.getOverduePending();
      const job = jobs.find(j => j.id === sess.overdueJobId) || jobs[0];
      if (!job) {
        return { handled: true, message: 'That overdue message is no longer pending.', actionExecuted: 'overdue_missing' };
      }
      const sendResult = await MessageScheduler.executeJob(job);
      if (sendResult.success) {
        return {
          handled: true,
          message: `✓ **Overdue message delivered to ${job.recipient.name}.**\n\n- **Message:** "${job.message.content}"`,
          actionExecuted: `send_overdue:${job.id}`,
          data: sendResult
        };
      }
      return {
        handled: true,
        message: `❌ Failed to send overdue message: ${sendResult.error}`,
        actionExecuted: `send_failed:${job.id}`,
        data: sendResult
      };
    }

    this.pendingSession = null;
    if (!sess.resolvedRecipient || !sess.payload) {
      return this.executePipeline({
        platform: sess.platform,
        action: sess.action,
        recipientQuery: sess.recipientQuery,
        messageContent: sess.messageContent,
        scheduledAt: sess.scheduledAt || undefined,
        timezone: sess.timezone,
        clientPreference: sess.clientPreference,
        skipConfirmation: true
      });
    }

    return this.dispatchInstant(
      sess.platform,
      sess.resolvedRecipient,
      sess.payload,
      sess.clientPreference
    );
  }

  private static async dispatchInstant(
    platform: MessagePlatform,
    recipient: ResolvedRecipient,
    payload: MessagePayload,
    clientType?: 'desktop' | 'web'
  ): Promise<{
    handled: boolean;
    message?: string;
    actionExecuted?: string;
    data?: any;
  }> {
    const sendResult = await MessageExecutor.execute(platform, recipient, payload, {
      clientType
    });

    if (sendResult.success) {
      if (sendResult.details?.includes('Idempotent Replay')) {
        return {
          handled: true,
          message: `ℹ️ **Duplicate Message Suppressed**\n\n- **Platform:** ${platform.toUpperCase()}\n- **Recipient:** ${recipient.name} (\`${recipient.identifier}\`)\n- **Note:** This exact message was already sent less than 60 seconds ago.\n- *Tip: Wait a moment or modify your message to send again.*`,
          actionExecuted: `idempotent_suppressed:${sendResult.operationId}`,
          data: sendResult
        };
      }
      if (sendResult.verificationStatus === 'PREFILLED') {
        return {
          handled: true,
          message: `⚠️ **Opened WhatsApp Desktop — Send was not confirmed.**\n\n- **To:** ${recipient.name} (\`${recipient.identifier}\`)\n- **Message:** "${payload.content}"\n\nThe Windows app usually only pre-fills. Check the chat and tap **Send**, or reply **web** next time so FloatGPT clicks Send in its own WhatsApp window.`,
          actionExecuted: `send_prefilled:${sendResult.operationId}`,
          data: sendResult
        };
      }
      return {
        handled: true,
        message: `✓ **Message Sent Successfully**\n\n- **Platform:** ${platform.toUpperCase()}\n- **Recipient:** ${recipient.name} (\`${recipient.identifier}\`)\n- **Status:** \`${sendResult.verificationStatus || 'SEND_CONFIRMED'}\`\n- **Message:** "${payload.content}"`,
        actionExecuted: `send_message:${sendResult.operationId}`,
        data: sendResult
      };
    } else {
      if (sendResult.error?.includes('QR_REQUIRED')) {
        return {
          handled: true,
          message:
            `**Scan WhatsApp QR once**\n\nFloatGPT opened a dedicated WhatsApp window. Scan the QR with your phone, wait until chats appear, then send again.\n\nThis is the only reliable way to **actually Send** (not just type). Keys stay in that window so FloatGPT never steals Enter.\n\n*Settings → Messaging → Open WhatsApp session* if the window is hidden.`,
          actionExecuted: 'whatsapp_qr_required',
          data: sendResult
        };
      }
      return {
        handled: true,
        message: `❌ **Failed to send message to ${recipient.name}**\n\n> **Reason:** ${sendResult.error || 'Unknown dispatch error'}`,
        actionExecuted: `send_failed:${sendResult.operationId}`,
        data: sendResult
      };
    }
  }
}
