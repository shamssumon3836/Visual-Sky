import { EmailMessage, EmailThread } from '../types';

/**
 * Robust detection of Out-Of-Office (OOO), Vacation, Leave, and Auto-Responders
 * Inspects RFC headers and common phrasing (including film/production shoots)
 */
export const isAutoReplyOrOoo = (
  subject: string = '',
  body: string = '',
  isAutoReplyHeader: boolean = false
): boolean => {
  if (isAutoReplyHeader) return true;

  const combined = `${subject} ${body}`.toLowerCase();

  // 1. Film / Shoot / Production specific leave (e.g., "I'll be out on shoots on the 22nd", "on a shoot", "on shoot")
  const shootPatterns = /(out\s+on\s+shoots?|on\s+shoots?|out\s+on\s+a\s+shoot|on\s+set|on\s+location\s+shoot|filming\s+on\s+location|out\s+filming|away\s+filming)/i;

  // 2. Out of office / leave / vacation patterns
  const oooPatterns = /(out\s+of\s+(the\s+)?office|away\s+from\s+(my\s+desk|the\s+office|office)|away\s+until|out\s+until|back\s+in\s+the\s+office\s+on|back\s+on\s+\d|annual\s+leave|maternity\s+leave|paternity\s+leave|sick\s+leave|on\s+leave|on\s+vacation|on\s+holiday|bank\s+holiday|public\s+holiday)/i;

  // 3. Automated responder & generic autoreply patterns
  const autoReplyPatterns = /(auto-?reply|automatic\s+reply|automated\s+response|auto\s+generated|autoresponse|autoreply|this\s+is\s+an\s+automated\s+message|do\s+not\s+reply\s+to\s+this\s+email)/i;

  // 4. Delayed response / away notices
  const delayedPatterns = /(limited\s+access\s+to\s+(email|my\s+inbox)|intermittent\s+access\s+to\s+email|will\s+(not\s+have|have\s+limited)\s+access|will\s+get\s+back\s+to\s+you\s+(as\s+soon\s+as|when\s+i\s+return|upon\s+my\s+return|on\s+the|once\s+back)|will\s+respond\s+(when\s+i\s+return|upon\s+my\s+return|after)|currently\s+unavailable|delayed\s+(response|reply)|thank\s+you\s+for\s+your\s+email.*i\s+am\s+(currently\s+)?away)/i;

  return (
    shootPatterns.test(combined) ||
    oooPatterns.test(combined) ||
    autoReplyPatterns.test(combined) ||
    delayedPatterns.test(combined)
  );
};

/**
 * Hard bounce detection (Mailer-Daemon, Postmaster, 550, Undeliverable)
 */
export const isHardBounceMessage = (
  fromEmail: string = '',
  subject: string = '',
  body: string = ''
): boolean => {
  const lowerFrom = (fromEmail || '').toLowerCase();
  const combined = `${subject} ${body}`.toLowerCase();

  if (
    lowerFrom.includes('mailer-daemon') ||
    lowerFrom.includes('postmaster') ||
    lowerFrom.includes('mail-daemon')
  ) {
    return true;
  }

  return /(delivery\s+status\s+notification|failure\s+notice|undeliverable|undelivered\s+mail|returned\s+mail|550\s+5\.|554\s+5\.|user\s+unknown|mailbox\s+unavailable|address\s+rejected|could\s+not\s+be\s+delivered|recipient\s+rejected)/i.test(
    combined
  );
};

/**
 * Unsubscribe request detection
 */
export const isUnsubscribeMessage = (
  subject: string = '',
  body: string = ''
): boolean => {
  const combined = `${subject} ${body}`.toLowerCase();
  return /(unsubscribe|remove\s+me|stop\s+emailing|please\s+remove|take\s+me\s+off|do\s+not\s+contact|opt\s+out|not\s+interested\s+please\s+remove)/i.test(
    combined
  );
};

export type IntentCategoryType =
  | 'meeting'
  | 'hot'
  | 'question'
  | 'auto_reply'
  | 'bounce'
  | 'unsubscribe'
  | 'later'
  | 'cold'
  | 'neutral';

export interface IntentClassificationResult {
  type: IntentCategoryType;
  label: string;
  badgeClass: string;
  icon: string;
}

/**
 * Smart Intent Classifier with strict guardrails:
 * - Detects Bounces & Unsubscribes first
 * - Detects Auto-Replies & OOO next (so "out on shoots" NEVER gets High Intent)
 * - Detects Meeting Requests
 * - Only flags High Intent if the prospect explicitly asks for pricing/rates, portfolio/samples, or expresses genuine intent to collaborate
 * - Short or minimal greetings ("Hi", "hello", "haaaaa", "heyyy", "yo", "ok", "thanks") are classified as Neutral Reply
 */
export const classifyIntent = (
  subject: string = '',
  text: string = '',
  isAutoReplyHeader: boolean = false,
  existingLabels: string[] = []
): IntentClassificationResult => {
  const cleanSubject = (subject || '').trim();
  const cleanBody = (text || '').trim();
  const lowerCombined = `${cleanSubject} ${cleanBody}`.toLowerCase();

  // 1. Hard Bounce
  if (isHardBounceMessage('', cleanSubject, cleanBody) || existingLabels.includes('Bounced')) {
    return {
      type: 'bounce',
      label: 'Bounced',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: '🚫'
    };
  }

  // 2. Unsubscribe
  if (isUnsubscribeMessage(cleanSubject, cleanBody) || existingLabels.includes('Unsubscribed')) {
    return {
      type: 'unsubscribe',
      label: 'Unsubscribed',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      icon: '🛑'
    };
  }

  // 3. Auto-Reply / Out of Office / Shoots
  if (
    isAutoReplyOrOoo(cleanSubject, cleanBody, isAutoReplyHeader) ||
    existingLabels.includes('Auto-Reply') ||
    existingLabels.includes('🕒 OOO Paused')
  ) {
    return {
      type: 'auto_reply',
      label: 'Auto-Reply',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: '🕒'
    };
  }

  // 4. Meeting Request
  const meetingPattern = /(schedule\s+(a\s+)?(call|chat|meeting)|book\s+(a\s+)?time|zoom\s+(call|link)?|google\s+meet|calendly\.com|hop\s+on\s+a\s+call|available\s+(for\s+a\s+call|at|tomorrow|next\s+week)|what\s+time\s+(suits|works)|let('?s)?\s+(hop\s+on|jump\s+on\s+a\s+call|meet)|have\s+time\s+for\s+a\s+call)/i;
  if (existingLabels.includes('Meeting Scheduled') || existingLabels.includes('Meeting Requested') || meetingPattern.test(lowerCombined)) {
    return {
      type: 'meeting',
      label: 'Wants Meeting',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: '📅'
    };
  }

  // 5. Minimal Greeting & Test Reply Guardrail
  // e.g. "Hi", "hello", "haaaaa", "heyyy", "yo", "ok", "cool", "thanks", "noted", "received", "sure"
  const strippedText = cleanBody.replace(/[^a-zA-Z\s]/g, '').trim().toLowerCase();
  const isMinimalGreeting = /^(hi|hello|heyyy*|haaa*|yo|test|ok|okay|cool|thanks|thx|thank\s+you|received|noted|k|sure|good)$/i.test(
    strippedText
  );

  // If the reply is merely a minimal greeting or lacks substantial interest words, DO NOT mark as High Intent!
  if (!isMinimalGreeting) {
    // 5a. Pricing & Rates Inquiry
    const pricingPattern = /(pricing|rates?|quote|quotation|cost|costs|how\s+much\s+(do\s+you\s+charge|is\s+it|would\s+it\s+be)|budget|rate\s+card|fee\s+structure)/i;
    // 5b. Portfolio, Showreel, Samples, Case Studies
    const portfolioPattern = /(portfolio|showreel|show\s+reel|case\s+stud(y|ies)|samples?|work\s+samples?|examples?\s+of\s+(your\s+)?work|show\s+me\s+(some\s+)?work|demo\s+reel)/i;
    // 5c. Strong Expressed Interest & Collaboration
    const interestPattern = /(interested\s+in\s+(learning|hearing|working|collaborating|your\s+services)|sounds?\s+(great|interesting|promising|like\s+a\s+fit)|send\s+(me\s+)?(more\s+info|details|the\s+deck|a\s+proposal)|we('?re|\s+are)\s+looking\s+for|can\s+you\s+send\s+over|let('?s)?\s+(collaborate|work\s+together|discuss\s+further)|definitely\s+interested|would\s+love\s+to\s+(hear|learn|see)|tell\s+me\s+more|let('?s)?\s+talk)/i;

    if (
      pricingPattern.test(lowerCombined) ||
      portfolioPattern.test(lowerCombined) ||
      interestPattern.test(lowerCombined)
    ) {
      return {
        type: 'hot',
        label: 'High Intent',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        icon: '🔥'
      };
    }
  }

  // 6. Inquiry / Q&A
  if (/\?|how does|what is|can you|do you support|security|gdpr|turnaround/i.test(lowerCombined)) {
    return {
      type: 'question',
      label: 'Inquiry / Q&A',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      icon: '❓'
    };
  }

  // 7. Later / Bad Timing
  if (/busy|next month|next quarter|q4|reach out later|not now|bad timing|ping me in/i.test(lowerCombined)) {
    return {
      type: 'later',
      label: 'Follow Up Later',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      icon: '⏳'
    };
  }

  // 8. Cold / Not Interested
  if (/not interested|no thanks|pass on this|we have someone|in-house team/i.test(lowerCombined)) {
    return {
      type: 'cold',
      label: 'Not Interested',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      icon: '💤'
    };
  }

  // 9. Neutral Reply / Minimal (Default)
  return {
    type: 'neutral',
    label: isMinimalGreeting ? 'Needs Review' : 'Neutral Reply',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: '💬'
  };
};

/**
 * Universal thread unread check (ensures 100% sync across Header, Sidebar, and SmartInbox)
 */
export const isThreadUnread = (thread?: EmailThread | null): boolean => {
  if (!thread || thread.isTrash) return false;
  if ((thread.unreadCount || 0) > 0) return true;
  if (Array.isArray(thread.messages) && thread.messages.some(m => m.sender === 'lead' && m.isRead === false)) {
    return true;
  }
  return false;
};

/**
 * Parse any timestamp representation into epoch milliseconds
 */
export const parseMessageTimestamp = (ts?: string): number => {
  if (!ts) return 0;
  const trimmed = ts.trim();
  if (trimmed.toLowerCase() === 'just now') return Date.now();

  // Try direct Date parse
  const parsedDate = new Date(trimmed).getTime();
  if (!isNaN(parsedDate) && parsedDate > 100000000000) {
    return parsedDate;
  }

  // Handle 12-hour format like "10:30 AM" or "02:15 PM"
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const meridiem = timeMatch[4]?.toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    const d = new Date();
    d.setHours(hours, minutes, seconds, 0);
    return d.getTime();
  }

  // Handle "X hours ago", "X mins ago"
  const agoMatch = trimmed.match(/(\d+)\s*(min|hour|day|sec)s?\s*ago/i);
  if (agoMatch) {
    const num = parseInt(agoMatch[1], 10);
    const unit = agoMatch[2].toLowerCase();
    const ms = unit.startsWith('sec')
      ? num * 1000
      : unit.startsWith('min')
      ? num * 60000
      : unit.startsWith('hour')
      ? num * 3600000
      : num * 86400000;
    return Date.now() - ms;
  }

  return 0;
};

/**
 * Thread message deduplication & strict chronological sorting
 * Removes duplicate outbox/sent messages and sorts from earliest to newest
 */
export const deduplicateAndSortThreadMessages = (messages: EmailMessage[]): EmailMessage[] => {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const deduplicated: EmailMessage[] = [];

  for (const m of messages) {
    if (!m) continue;
    const mId = String(m.id || '');
    if (mId && seenIds.has(mId)) continue;

    // Content fingerprint: sender + recipient + normalized subject + body snippet
    const normSender = (m.senderEmail || m.sender || '').trim().toLowerCase();
    const normRecip = (m.recipientEmail || '').trim().toLowerCase();
    const normBody = (m.body || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const fingerprint = `${normSender}::${normRecip}::${normBody}`;

    if (normBody && seenFingerprints.has(fingerprint)) {
      continue; // Duplicate message already recorded
    }

    if (mId) seenIds.add(mId);
    if (normBody) seenFingerprints.add(fingerprint);
    deduplicated.push(m);
  }

  // Sort strictly chronologically by timestamp
  return deduplicated.sort((a, b) => {
    const timeA = parseMessageTimestamp(a.timestamp);
    const timeB = parseMessageTimestamp(b.timestamp);
    return timeA - timeB;
  });
};
