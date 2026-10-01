/**
 * FloatGPT — Messenger Agent: Intent Parser
 * 
 * Deterministic natural-language parser for messaging operations.
 * Resolves platforms, recipients, message content, actions, and local-timezone scheduling.
 */

import { ParsedMessageIntent, MessagePlatform, MessageAction } from '../types/messenger.types';

export class MessageIntentParser {
  /**
   * Parses raw user text into structured messaging intent.
   */
  static parse(rawText: string): ParsedMessageIntent | null {
    const text = rawText.trim();
    const lower = text.toLowerCase();

    // Strict guard: Never parse conversational greetings or trivial words as messaging commands
    const cleanLower = lower.replace(/[?!.,]+$/, '').trim();
    if (/^(hi|hello|hey|howdy|greetings|how are you|how r u|who are you|thanks|thank you|yes|no|ok|okay)$/i.test(cleanLower)) {
      return null;
    }
    if (/^(message|text|dm|msg)\s*(:|;|-)?\s*(hi|hello|hey|yes|no|ok|okay)$/i.test(cleanLower)) {
      return null;
    }

    // Check if this input is related to messaging
    const hasExplicitPlatform = /\b(whatsapp|linkedin|telegram|discord|slack|email)\b/i.test(lower);
    const hasScheduledKeyword = /\b(schedule\s+(a\s+)?(message|whatsapp|text|dm)|scheduled\s+messages|list\s+scheduled|cancel\s+(the\s+)?scheduled)\b/i.test(lower);
    const looksLikeSendToContact = /\b(send|shoot|forward|text|message|dm)\b/i.test(lower) && /\bto\s+[a-z0-9+\u0900-\u097F]/i.test(lower);
    const looksLikeDirectMessage = /\b(send|text|message|dm)\s+[a-zA-Z0-9+\u0900-\u097F]+\s+(saying|with|that|about|tomorrow|today|tonight|at\s+\d|in\s+\d)\b/i.test(lower);

    if (!hasExplicitPlatform && !hasScheduledKeyword && !looksLikeSendToContact && !looksLikeDirectMessage) {
      return null;
    }

    const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

    // ─── 1. Identify Platform & Client Preference ───────────────
    let platform: MessagePlatform = 'whatsapp'; // Default primary platform
    let clientPreference: 'desktop' | 'web' | undefined = undefined;

    if (/\b(whatsapp\s*web|web\s*whatsapp|on\s+web)\b/i.test(lower)) {
      platform = 'whatsapp';
      clientPreference = 'web';
    } else if (/\b(whatsapp\s*desktop|desktop\s*whatsapp|on\s+desktop)\b/i.test(lower)) {
      platform = 'whatsapp';
      clientPreference = 'desktop';
    } else if (/\blinkedin\b/i.test(lower)) {
      platform = 'linkedin';
    } else if (/\bwhatsapp\b/i.test(lower)) {
      platform = 'whatsapp';
    } else if (/\btelegram\b/i.test(lower)) {
      platform = 'telegram';
    } else if (/\bdiscord\b/i.test(lower)) {
      platform = 'discord';
    } else if (/\bslack\b/i.test(lower)) {
      platform = 'slack';
    } else if (/\bemail\b/i.test(lower)) {
      platform = 'email';
    }

    // ─── 2. Identify Action ────────────────────────────────────
    let action: MessageAction = 'send_message';

    if (/\b(list|show|view|display|get)\s+(all\s+)?(my\s+)?scheduled\s+(messages|texts|jobs|dms)\b/i.test(lower)) {
      return {
        rawPrompt: text,
        platform,
        action: 'list_scheduled',
        timezone,
        confidence: 0.95
      };
    }

    if (/\b(cancel|delete|remove|abort)\s+(the\s+)?(scheduled\s+)?(message|text|dm)\s+(to\s+)?([^.]+)/i.test(lower)) {
      const match = lower.match(/\b(cancel|delete|remove|abort)\s+(the\s+)?(scheduled\s+)?(message|text|dm)\s+(to\s+)?([a-z0-9_\-\s]+)/i);
      return {
        rawPrompt: text,
        platform,
        action: 'cancel_message',
        recipientQuery: match ? match[6].trim().replace(/\b(for\s+me|please)\b/g, '').trim() : undefined,
        timezone,
        confidence: 0.9
      };
    }

    const isScheduling = /\b(schedule|queue|send later|tonight|tomorrow|in\s+\d+\s*(minute|hour|day)s?|at\s+\d{1,2}(:\d{2})?\s*(am|pm)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|on\s+\d{1,2}(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec))\b/i.test(lower);
    if (isScheduling) {
      action = 'schedule_message';
    }

    // ─── 3. Extract Recipient & Message Content ────────────────
    const { recipientQuery, messageContent } = this.extractRecipientAndMessage(text);

    // ─── 4. Parse Schedule Time (if applicable) ───────────────
    let scheduledAt: string | null = null;
    let scheduledEpochMs: number | null = null;

    if (action === 'schedule_message') {
      const timeParsed = this.parseScheduledTime(text);
      if (timeParsed) {
        scheduledAt = timeParsed.iso;
        scheduledEpochMs = timeParsed.epochMs;
      } else {
        // Default to 1 hour from now if ambiguous schedule without explicit time
        const fallbackDate = new Date(Date.now() + 60 * 60 * 1000);
        scheduledAt = fallbackDate.toISOString();
        scheduledEpochMs = fallbackDate.getTime();
      }
    }

    return {
      rawPrompt: text,
      platform,
      action,
      recipientQuery: recipientQuery || undefined,
      messageContent: messageContent || undefined,
      scheduledAt,
      scheduledEpochMs,
      timezone,
      confidence: (recipientQuery && messageContent) ? 0.95 : 0.7,
      clientPreference
    };
  }

  /**
   * Extracts recipient and message content from various conversational structures.
   */
  private static extractRecipientAndMessage(text: string): { recipientQuery: string; messageContent: string } {
    let recipient = '';
    let message = '';

    // Structure A: Quoted content
    // e.g. Float, send Adam a WhatsApp saying "Hi Adam, are you free?"
    // e.g. Message Adam on WhatsApp: 'Hey, are you coming?'
    const quoteMatch = text.match(/["'“]([^"'“”]+)["'”]/);
    if (quoteMatch) {
      message = quoteMatch[1].trim();
    }

    // Structure B: saying / that / text / message followed by message
    if (!message) {
      const sayingMatch = text.match(/\b(?:saying|say|tell (?:him|her|them) that|that|message:|with text:)\s+(.+)$/i);
      if (sayingMatch) {
        message = sayingMatch[1].trim();
        // Remove trailing quotes if mismatched
        message = message.replace(/^["']|["']$/g, '');
      }
    }

    // Clean leading phrases like "Float, ", "Can you ", "Please "
    let cleanText = text.replace(/^(?:float|assistant|ai|hey|please|can you|could you)\s*[,:]?\s*/i, '');

    const stopWords = new Set([
      'a', 'an', 'the', 'my', 'this', 'that', 'whatsapp', 'linkedin', 'message',
      'text', 'dm', 'tomorrow', 'today', 'saying', 'say', 'him', 'her', 'them',
      'on', 'in', 'via', 'to', 'using', 'with'
    ]);

    // Structure C: "send [MESSAGE] to [RECIPIENT] [on/via/in PLATFORM]"
    // e.g. "please send Hi to Mummy on Whatsapp"
    // e.g. "send hello to +919953314976 on WhatsApp web"
    if (!message) {
      const sendMsgToPattern = /^(?:send|shoot|forward)\s+(?:a\s+)?(?:message\s+)?(.+?)\s+to\s+([a-zA-Z0-9_\-\+]+(?:\s+[a-zA-Z0-9_\-\+]+)?)(?:\s+(?:on|via|in)\s+(?:whatsapp(?:\s+(?:web|desktop))?|linkedin|telegram|slack))?$/i;
      const match = cleanText.match(sendMsgToPattern);
      if (match) {
        const potentialMsg = match[1].trim();
        const potentialRecipient = match[2].trim().replace(/\s+(?:on|in|via|to|using)$/i, '').trim();
        const firstWord = potentialRecipient.split(/\s+/)[0].toLowerCase();
        if (!/^(?:a\s+)?(?:whatsapp|linkedin|message|text|dm)$/i.test(potentialMsg) && !stopWords.has(firstWord)) {
          message = potentialMsg;
          recipient = potentialRecipient;
        }
      }
    }

    // Extract Recipient with precise boundary handling
    if (!recipient) {
      const recipientPatterns = [
        // "send this to [Recipient] on whatsapp/linkedin"
        /\b(?:send|forward|share)\s+(?:this\s+)?to\s+([a-zA-Z0-9_\-\+]+(?:\s+[a-zA-Z0-9_\-\+]+)?)\s+(?:on|via|in)\s+(?:whatsapp(?:\s+(?:web|desktop))?|linkedin)/i,
        // "send a whatsapp to [Recipient]" or "schedule a whatsapp to [Recipient] tomorrow..."
        /\b(?:send|schedule|shoot)\s+(?:a\s+)?(?:whatsapp|linkedin|message|text|dm)\s+to\s+([a-zA-Z0-9_\-\+]+(?:\s+[a-zA-Z0-9_\-\+]+)?)/i,
        // "to [Recipient] tomorrow at..." or "to [Recipient] saying..."
        /\bto\s+([a-zA-Z0-9_\-\+]+(?:\s+[a-zA-Z0-9_\-\+]+)?)\s+(?:tomorrow|today|at\s+\d|in\s+\d|saying|that|for)/i,
        // "send [Recipient] a whatsapp" -> ensure " a" is not captured in recipient
        /\b(?:send|tell|message|text|dm)\s+([a-zA-Z0-9_\-\+]+(?:\s+[a-zA-Z0-9_\-\+]+)?)\s+a\s+(?:whatsapp|linkedin|message|text|dm)/i,
        // "message [Recipient] on whatsapp"
        /\b(?:message|text|tell|dm)\s+([a-zA-Z0-9_\-\+]+(?:\s+[a-zA-Z0-9_\-\+]+)?)\s+(?:on|via|in)\s+(?:whatsapp|linkedin)/i,
        // "send [Recipient] saying..."
        /\b(?:send|message)\s+([a-zA-Z0-9_\-\+]+(?:\s+[a-zA-Z0-9_\-\+]+)?)\s+(?:saying|with)/i,
        // Generic "to [Recipient]"
        /\bto\s+([a-zA-Z0-9_\-\+]+(?:\s+[a-zA-Z0-9_\-\+]+)?)/i
      ];

      for (const pattern of recipientPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
          let candidate = match[1].trim();

          // Strip trailing prepositions and time words if captured (e.g. "Mummy on", "Adam tomorrow")
          candidate = candidate.replace(/\s+(?:on|in|via|to|at|for|from|using|with|tomorrow|today|tonight|saying|that|a|the)$/i, '').trim();

          const firstWord = candidate.split(/\s+/)[0].toLowerCase();
          if (!stopWords.has(firstWord) && candidate.length > 0) {
            recipient = candidate;
            break;
          }
        }
      }
    }

    // Clean recipient string
    if (recipient) {
      recipient = recipient.replace(/^(?:a|an|the|my)\s+/i, '').trim();
    }

    return {
      recipientQuery: recipient,
      messageContent: message
    };
  }

  private static extractClock(lower: string): { hours: number; minutes: number } | null {
    const named = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (named) {
      let hours = parseInt(named[1], 10);
      const minutes = named[2] ? parseInt(named[2], 10) : 0;
      const meridiem = named[3].toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      return { hours, minutes };
    }
    const twentyFour = lower.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
    if (twentyFour) {
      return { hours: parseInt(twentyFour[1], 10), minutes: parseInt(twentyFour[2], 10) };
    }
    return null;
  }

  private static stampClock(target: Date, clock: { hours: number; minutes: number } | null, fallbackHour = 9): Date {
    const hours = clock ? clock.hours : fallbackHour;
    const minutes = clock ? clock.minutes : 0;
    target.setHours(hours, minutes, 0, 0);
    return target;
  }

  private static wrap(target: Date): { iso: string; epochMs: number } {
    return { iso: target.toISOString(), epochMs: target.getTime() };
  }

  /**
   * Deterministically parses date/time in the user's local timezone.
   */
  static parseScheduledTime(text: string): { iso: string; epochMs: number } | null {
    const lower = text.toLowerCase();
    const now = new Date();
    const clock = this.extractClock(lower);

    const relativeMatch = lower.match(/\bin\s+(\d+)\s*(min|minute|minutes|hour|hours|day|days)\b/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      let deltaMs = 0;
      if (unit.startsWith('min')) deltaMs = amount * 60 * 1000;
      else if (unit.startsWith('hour')) deltaMs = amount * 60 * 60 * 1000;
      else if (unit.startsWith('day')) deltaMs = amount * 24 * 60 * 60 * 1000;
      const targetEpoch = now.getTime() + deltaMs;
      return { iso: new Date(targetEpoch).toISOString(), epochMs: targetEpoch };
    }

    const months: Record<string, number> = {
      january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
      may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
      september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11
    };
    const dateNamed = lower.match(
      /\bon\s+(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)(?:\s+(\d{4}))?/i
    );
    if (dateNamed) {
      const day = parseInt(dateNamed[1], 10);
      const month = months[dateNamed[2].toLowerCase()];
      const year = dateNamed[3] ? parseInt(dateNamed[3], 10) : now.getFullYear();
      const target = this.stampClock(new Date(year, month, day), clock, 9);
      if (target.getTime() <= now.getTime()) {
        target.setFullYear(target.getFullYear() + 1);
      }
      return this.wrap(target);
    }

    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdayIdx = weekdays.findIndex((d) => new RegExp(`\\b${d}\\b`, 'i').test(lower));
    if (weekdayIdx >= 0) {
      const target = new Date(now);
      this.stampClock(target, clock, 9);
      let add = (weekdayIdx - now.getDay() + 7) % 7;
      if (add === 0 && target.getTime() <= now.getTime()) add = 7;
      target.setDate(now.getDate() + add);
      this.stampClock(target, clock, 9);
      return this.wrap(target);
    }

    if (
      !/\btomorrow\b/i.test(lower) &&
      (/\btonight\s+at\b/i.test(lower) || /\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\s+tonight\b/i.test(lower) || (/\bschedule\b/i.test(lower) && /\btonight\b/i.test(lower)) || /\btonight\b/i.test(lower))
    ) {
      const target = this.stampClock(new Date(now), clock, 20);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return this.wrap(target);
    }

    const timeMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (timeMatch) {
      const target = this.stampClock(new Date(now), clock || {
        hours: (() => {
          let hours = parseInt(timeMatch[1], 10);
          const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
          if (meridiem === 'pm' && hours < 12) hours += 12;
          if (meridiem === 'am' && hours === 12) hours = 0;
          return hours;
        })(),
        minutes: timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
      }, 9);

      if (lower.includes('tomorrow')) {
        target.setDate(target.getDate() + 1);
      } else if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return this.wrap(target);
    }

    if (lower.includes('tomorrow')) {
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      if (lower.includes('morning')) target.setHours(9, 0, 0, 0);
      else if (lower.includes('afternoon')) target.setHours(14, 0, 0, 0);
      else if (lower.includes('evening') || lower.includes('tonight')) target.setHours(19, 0, 0, 0);
      else if (clock) this.stampClock(target, clock, 9);
      else target.setHours(9, 0, 0, 0);
      return this.wrap(target);
    }

    return null;
  }
}
