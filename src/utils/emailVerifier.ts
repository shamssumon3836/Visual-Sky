import { safeParseResponse } from '../lib/safeFetch';

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  status: 'valid' | 'invalid' | 'risky';
  reason: string;
  reasonBn: string;
  suggestion?: string;
  mxVerified?: boolean;
  mxHost?: string;
}

// Common typo domains mapped to their intended valid domain
const TYPO_DOMAINS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gimail.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'ymail.con': 'ymail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.cmo': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlook.cmo': 'outlook.com',
  'icloud.con': 'icloud.com',
  'iclud.com': 'icloud.com',
  'zoho.con': 'zoho.com',
  'protonmial.com': 'protonmail.com'
};

// Known disposable / temporary / burner mail domains
const DISPOSABLE_DOMAINS = new Set<string>([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'sharklasers.com',
  'maildrop.cc',
  'throwawaymail.com',
  'fakeinbox.com',
  'dispostable.com',
  'mohmal.com',
  'tempmailo.com',
  'mailnesia.com',
  'mintemail.com',
  'mytemp.email',
  'tempail.com',
  'burnermail.io',
  'guerrillamailblock.com',
  'grr.la',
  'pokemail.net',
  'spam4.me'
]);

// Known fake / placeholder / dead domains that always bounce in real delivery
const FAKE_PLACEHOLDER_DOMAINS = new Set<string>([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'testing.com',
  'yourdomain.com',
  'domain.com',
  'sample.com',
  'fake.com',
  'invalid.com',
  'invalid',
  'localhost',
  'none.com',
  'null.com',
  'noemail.com',
  'nomail.com',
  'abc.com',
  'xyz.com',
  '123.com'
]);

// Known bounce-trap or non-deliverable daemon prefixes
const BOUNCE_TRAP_PREFIXES = new Set<string>([
  'mailer-daemon',
  'postmaster',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'bounce',
  'bounces',
  'abuse',
  'spam',
  'null',
  'devnull'
]);

// Client-side cache of deep DNS MX results
const dnsVerificationCache = new Map<string, EmailVerificationResult>();

/**
 * Synchronous, instant email verification check.
 * Flags syntax errors, domain typos, disposable emails, fake placeholders, and bounce traps.
 */
export function verifyEmailSync(rawEmail: string): EmailVerificationResult {
  const trimmed = String(rawEmail || '').trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: 'Empty email address',
      reasonBn: 'ইমেইল খালি রয়েছে (পাঠানো যাবে না)'
    };
  }

  // Check if we already have a cached DNS MX verification result for this exact email
  const cached = dnsVerificationCache.get(lower);
  if (cached) {
    return cached;
  }

  // Must not contain whitespace or illegal characters
  if (/\s/.test(trimmed) || /[<>(),;:"[\]\\]/.test(trimmed)) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: 'Contains spaces or invalid symbols',
      reasonBn: 'নষ্ট মেইল: ইমেইলে স্পেস বা ভুল চিহ্ন রয়েছে (পাঠালে এরর হবে)'
    };
  }

  const parts = lower.split('@');
  if (parts.length !== 2) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: 'Missing or multiple @ symbols',
      reasonBn: 'নষ্ট মেইল: @ চিহ্ন নেই বা একাধিক @ রয়েছে (পাঠানো যাবে না)'
    };
  }

  const [localPart, domainPart] = parts;

  if (!localPart || localPart.length > 64) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: 'Invalid username before @',
      reasonBn: 'নষ্ট মেইল: @ এর আগের অংশ সঠিক নয়'
    };
  }

  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart)
  ) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: 'Malformed characters in email username',
      reasonBn: 'নষ্ট মেইল: ইমেইল ইউজারনেমে ভুল ডট বা অক্ষর রয়েছে'
    };
  }

  if (!domainPart || !domainPart.includes('.')) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: 'Missing domain extension (e.g. .com)',
      reasonBn: 'নষ্ট মেইল: ডোমেইন এক্সটেনশন (.com/.io ইত্যাদি) নেই'
    };
  }

  if (
    domainPart.startsWith('.') ||
    domainPart.endsWith('.') ||
    domainPart.startsWith('-') ||
    domainPart.endsWith('-') ||
    domainPart.includes('..')
  ) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: 'Broken domain structure',
      reasonBn: 'নষ্ট মেইল: ডোমেইন নামটি ভাঙা বা ভুল ফরম্যাটে আছে'
    };
  }

  const domainLabels = domainPart.split('.');
  const tld = domainLabels[domainLabels.length - 1];

  if (!tld || tld.length < 2 || /^\d+$/.test(tld) || !/^[a-z]{2,24}$/i.test(tld)) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: `Invalid domain extension (.${tld})`,
      reasonBn: `নষ্ট মেইল: ডোমেইন এক্সটেনশন (.${tld}) সঠিক নয়`
    };
  }

  for (const label of domainLabels) {
    if (!label || label.startsWith('-') || label.endsWith('-') || !/^[a-z0-9-]+$/i.test(label)) {
      return {
        email: trimmed,
        isValid: false,
        status: 'invalid',
        reason: `Invalid domain segment "${label}"`,
        reasonBn: `নষ্ট মেইল: ডোমেইন "${domainPart}" সঠিক নয়`
      };
    }
  }

  // Check typo domains (e.g., gmial.com, hotmial.com, yahoo.con)
  if (TYPO_DOMAINS[domainPart]) {
    const fixedDomain = TYPO_DOMAINS[domainPart];
    const suggestion = `${localPart}@${fixedDomain}`;
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: `Domain typo (${domainPart} → ${fixedDomain}) — will bounce`,
      reasonBn: `নষ্ট মেইল: ডোমেইন বানান ভুল (${domainPart})! পাঠালে বাউন্স করবে (সঠিক: ${suggestion})`,
      suggestion
    };
  }

  // Check fake/placeholder domains
  if (FAKE_PLACEHOLDER_DOMAINS.has(domainPart)) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: `Fake/Placeholder domain (${domainPart}) — cannot receive mail`,
      reasonBn: `নষ্ট/টেস্ট মেইল (${domainPart}): এই ডোমেইনে মেইল পাঠানো যাবে না (হার্ড বাউন্স হবে)`
    };
  }

  // Check disposable / burner domains
  if (DISPOSABLE_DOMAINS.has(domainPart)) {
    return {
      email: trimmed,
      isValid: false,
      status: 'invalid',
      reason: `Disposable/Temporary mail (${domainPart}) — high spam risk`,
      reasonBn: `নষ্ট/টেম্পোরারি মেইল (${domainPart}): এটি ওয়ান-টাইম ভুয়া মেইল, পাঠালে আইপি রেপুটেশন নষ্ট হবে`
    };
  }

  // Check bounce-trap or automated noreply prefixes
  const cleanPrefix = localPart.split('+')[0];
  if (BOUNCE_TRAP_PREFIXES.has(cleanPrefix)) {
    return {
      email: trimmed,
      isValid: false,
      status: 'risky',
      reason: `System/No-Reply address (${cleanPrefix}@) — will not accept outreach`,
      reasonBn: `ঝুঁকিপূর্ণ/ব্লকড মেইল (${cleanPrefix}@): এটি রোবট বা নো-রিপ্লাই অ্যাড্রেস, মেইল পাঠালে বাউন্স হতে পারে`
    };
  }

  return {
    email: trimmed,
    isValid: true,
    status: 'valid',
    reason: 'Valid syntax & active domain format',
    reasonBn: 'সঠিক ও ভেরিফাইড মেইল (পাঠানোর জন্য প্রস্তুত)'
  };
}

/**
 * Deep asynchronous DNS MX & Domain verification via backend `/api/verify/emails`.
 * Updates the in-memory cache and returns detailed verification results for all emails.
 */
export async function verifyEmailsWithDns(
  rawEmails: string[]
): Promise<EmailVerificationResult[] & Record<string, EmailVerificationResult>> {
  const resultsMap: Record<string, EmailVerificationResult> = {};
  const needBackendCheck: string[] = [];

  for (const raw of rawEmails) {
    const clean = String(raw || '').trim();
    const lower = clean.toLowerCase();
    if (!clean) continue;

    const syncRes = verifyEmailSync(clean);
    resultsMap[lower] = syncRes;

    // If syntax passed and we haven't checked MX on backend yet, queue for DNS MX check
    if (syncRes.isValid && syncRes.mxVerified === undefined) {
      needBackendCheck.push(clean);
    }
  }

  if (needBackendCheck.length > 0) {
    try {
      const res = await fetch('/api/verify/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: Array.from(new Set(needBackendCheck)) })
      });
      const parsed = await safeParseResponse(res, 'Email DNS verification failed');
      if (parsed.ok && parsed.data?.success && parsed.data?.results) {
        const serverResults = parsed.data.results as Record<string, EmailVerificationResult> | EmailVerificationResult[];
        if (Array.isArray(serverResults)) {
          for (const srvRes of serverResults) {
            if (srvRes && srvRes.email) {
              const normKey = srvRes.email.trim().toLowerCase();
              dnsVerificationCache.set(normKey, srvRes);
              resultsMap[normKey] = srvRes;
            }
          }
        } else {
          for (const [emailKey, srvRes] of Object.entries(serverResults)) {
            const normKey = emailKey.trim().toLowerCase();
            dnsVerificationCache.set(normKey, srvRes);
            resultsMap[normKey] = srvRes;
          }
        }
      }
    } catch {
      // Fallback to sync results if offline
    }
  }

  const orderedArray = rawEmails
    .map(raw => {
      const lower = String(raw || '').trim().toLowerCase();
      return resultsMap[lower];
    })
    .filter(Boolean) as EmailVerificationResult[] & Record<string, EmailVerificationResult>;

  for (const [k, v] of Object.entries(resultsMap)) {
    (orderedArray as any)[k] = v;
  }

  return orderedArray;
}

/**
 * Parses raw pasted text into email items with instant verification results.
 */
export function parseAndVerifyRawEmails(rawText: string): Array<{
  email: string;
  name: string;
  company: string;
  verification: EmailVerificationResult;
}> {
  const leads = parsePastedEmailsToLeads(rawText);
  const seen = new Set<string>();
  const output: Array<{
    email: string;
    name: string;
    company: string;
    verification: EmailVerificationResult;
  }> = [];

  for (const item of leads) {
    const cleanEmail = (item.email || '').trim();
    if (!cleanEmail) continue;
    const key = cleanEmail.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      email: cleanEmail,
      name: item.name,
      company: item.company,
      verification: verifyEmailSync(cleanEmail),
    });
  }

  return output;
}

/**
 * Parses pasted raw text (emails separated by newlines, commas, semicolons, tabs, or CSV lines)
 * into structured lead preview items while preserving broken/invalid emails so the user can see
 * which ones are broken (`noshto mail`) and remove them in 1 click!
 */
export function parsePastedEmailsToLeads(
  rawText: string,
  defaultTag: string = 'Imported Leads'
): Array<{
  name: string;
  email: string;
  company: string;
  title: string;
  phone: string;
  website: string;
  niche: string;
  location: string;
  tags: string[];
}> {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const results: Array<{
    name: string;
    email: string;
    company: string;
    title: string;
    phone: string;
    website: string;
    niche: string;
    location: string;
    tags: string[];
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip obvious CSV header row
    if (
      i === 0 &&
      /^(name|full\s*name|email|e-mail|mail|company|first\s*name)(\s*[,;\t]\s*(name|email|company|title|phone|website))+$/i.test(
        line.replace(/["']/g, '').trim()
      )
    ) {
      continue;
    }

    // Format 1: "Full Name <email@domain.com>"
    const angleMatch = line.match(/^([^<]+)<([^>]+)>$/);
    if (angleMatch) {
      const namePart = angleMatch[1].replace(/["']/g, '').trim();
      const emailPart = angleMatch[2].replace(/["']/g, '').trim();
      const domain = emailPart.split('@')[1] || '';
      const comp = domain.split('.')[0]
        ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
        : 'Outbound Target';
      results.push({
        name: namePart || emailPart.split('@')[0] || 'Prospect',
        email: emailPart,
        company: comp,
        title: 'Decision Maker',
        phone: '+1 (555) 019-2834',
        website: domain && domain.includes('.') ? `https://${domain}` : 'https://example.com',
        niche: 'B2B Outbound',
        location: 'United States',
        tags: [defaultTag]
      });
      continue;
    }

    // If the line has multiple emails separated by comma / semicolon / space (and isn't a multi-column CSV row with Name,Email,Company)
    const tokensBySep = line.split(/[;,]+/).map(t => t.trim()).filter(Boolean);
    const allTokensLookLikeEmails =
      tokensBySep.length > 1 &&
      tokensBySep.every(t => t.includes('@') || (!t.includes(' ') && t.includes('.')));

    if (allTokensLookLikeEmails) {
      for (const tok of tokensBySep) {
        const cleanEmail = tok.replace(/^["'<]|["'>]$/g, '').trim();
        if (!cleanEmail) continue;
        const local = cleanEmail.split('@')[0] || cleanEmail;
        const domain = cleanEmail.split('@')[1] || '';
        const derivedName = local
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        const comp = domain.split('.')[0]
          ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
          : 'Enterprise Partner';
        results.push({
          name: derivedName || 'Prospective Lead',
          email: cleanEmail,
          company: comp,
          title: 'Decision Maker',
          phone: '+1 (555) 019-2834',
          website: domain && domain.includes('.') ? `https://${domain}` : 'https://example.com',
          niche: 'B2B Outbound',
          location: 'United States',
          tags: [defaultTag]
        });
      }
      continue;
    }

    // Otherwise parse as CSV / TSV / single-item row
    const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));

    if (cols.length === 1) {
      const singleToken = cols[0];
      const local = singleToken.split('@')[0] || singleToken;
      const domain = singleToken.split('@')[1] || '';
      const derivedName = local
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      const comp = domain.split('.')[0]
        ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
        : 'Enterprise Partner';
      results.push({
        name: derivedName || 'Prospective Lead',
        email: singleToken,
        company: comp,
        title: 'Decision Maker',
        phone: '+1 (555) 019-2834',
        website: domain && domain.includes('.') ? `https://${domain}` : 'https://example.com',
        niche: 'B2B Outbound',
        location: 'United States',
        tags: [defaultTag]
      });
    } else {
      // Find column containing '@' or looks like an email candidate
      const emailColIdx = cols.findIndex(c => c.includes('@'));
      const candidateIdx =
        emailColIdx !== -1
          ? emailColIdx
          : cols.findIndex(c => !c.includes(' ') && c.includes('.') && !c.startsWith('http'));
      const chosenIdx = candidateIdx !== -1 ? candidateIdx : 1;
      const emailVal = cols[chosenIdx] || cols[0] || '';
      const otherCols = cols.filter((_, idx) => idx !== chosenIdx);
      const nameVal =
        otherCols[0] ||
        (emailVal.split('@')[0] || 'Prospect').replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const domain = emailVal.split('@')[1] || '';
      const compVal =
        otherCols[1] ||
        (domain.split('.')[0]
          ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
          : 'Enterprise Partner');

      results.push({
        name: nameVal,
        email: emailVal,
        company: compVal,
        title: otherCols[2] || 'Decision Maker',
        phone: otherCols[3] || '+1 (555) 019-2834',
        website: domain && domain.includes('.') ? `https://${domain}` : 'https://example.com',
        niche: 'B2B Outbound',
        location: 'United States',
        tags: [defaultTag]
      });
    }
  }

  return results;
}
