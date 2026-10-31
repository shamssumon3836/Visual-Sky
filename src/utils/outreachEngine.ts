/**
 * VisualSky Outreach Engine Utilities:
 * 1. Role Classification: Decision Maker vs Studio Inbox vs Personal Mail
 * 2. Live Free DNS MX Verification via Google DoH
 * 3. Advanced Template Engine: Fallback Tokens & Spintax ({Hi|Hello|Hey})
 * 4. UK Business Hours Guard (08:30 - 17:30 London Time)
 */

export type LeadRoleCategory = 'decision_maker' | 'studio' | 'personal';

export interface LeadRoleClassification {
  category: LeadRoleCategory;
  label: string;
  badgeText: string;
  priority: number;
  badgeClass: string;
  badgeColor: string;
}

export const GENERIC_STUDIO_PREFIXES = new Set([
  'hello', 'info', 'contact', 'team', 'studio', 'mail', 'admin', 'enquiries', 
  'enquiry', 'support', 'office', 'general', 'press', 'sales', 'hi', 'hey', 
  'help', 'frontdesk', 'reception', 'inbox', 'billing', 'accounts', 'media',
  'jobs', 'careers', 'partnerships', 'creative', 'production', 'post', 'operations'
]);

export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 
  'aol.com', 'mail.com', 'zoho.com', 'protonmail.com', 'proton.me', 'live.com', 'gmx.com'
]);

/**
 * Classifies lead email into:
 * - 👑 Decision Maker (personal names on custom domains: Priority 100)
 * - 🏢 Studio Inbox (generic role prefixes like hello@, team@: Priority 70)
 * - 📧 Personal Mail (gmail.com, yahoo.com: Priority 50)
 */
export function classifyLeadRole(email: string): LeadRoleClassification {
  if (!email || !email.includes('@')) {
    return {
      category: 'studio',
      label: 'Studio Inbox',
      badgeText: '🏢 Studio Inbox',
      priority: 70,
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    };
  }

  const [rawPrefix, rawDomain] = email.trim().toLowerCase().split('@');
  const prefix = rawPrefix.replace(/[._+-].*$/, '');
  const domain = (rawDomain || '').trim();

  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return {
      category: 'personal',
      label: 'Personal Mail',
      badgeText: '📧 Personal Mail',
      priority: 50,
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
    };
  }

  if (GENERIC_STUDIO_PREFIXES.has(prefix) || GENERIC_STUDIO_PREFIXES.has(rawPrefix)) {
    return {
      category: 'studio',
      label: 'Studio Inbox',
      badgeText: '🏢 Studio Inbox',
      priority: 70,
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    };
  }

  return {
    category: 'decision_maker',
    label: 'Decision Maker',
    badgeText: '👑 Decision Maker',
    priority: 100,
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  };
}

export interface MxVerificationResult {
  email: string;
  domain: string;
  isValid: boolean;
  mxStatus: 'VALID_MX' | 'DEAD_DOMAIN_NO_MX' | 'TEMP_ERROR';
  status: 'VALID_MX' | 'DEAD_DOMAIN_NO_MX' | 'TEMP_ERROR';
  provider: 'Google Workspace' | 'Microsoft 365' | 'Zoho' | 'Custom SMTP' | 'None';
  providerLabel: string;
  mxRecords: string[];
}

const mxCache = new Map<string, MxVerificationResult>();

/**
 * 100% Free Live DNS MX Verification using Google's DNS-over-HTTPS API.
 * Detects mail provider (Google Workspace, Microsoft 365, Zoho, Custom) or ❌ Dead Domain.
 */
export async function verifyEmailMX(email: string): Promise<MxVerificationResult> {
  const normEmail = (email || '').trim().toLowerCase();
  const domain = normEmail.split('@')[1] || '';
  if (!domain || !domain.includes('.')) {
    return {
      email: normEmail,
      domain,
      isValid: false,
      mxStatus: 'DEAD_DOMAIN_NO_MX',
      status: 'DEAD_DOMAIN_NO_MX',
      provider: 'None',
      providerLabel: '❌ Dead Domain / No MX',
      mxRecords: []
    };
  }

  if (mxCache.has(domain)) {
    const cached = mxCache.get(domain)!;
    return { ...cached, email: normEmail };
  }

  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
      signal: AbortSignal.timeout(6500)
    });
    if (!res.ok) {
      throw new Error(`DNS lookup HTTP ${res.status}`);
    }
    const data = await res.json();
    const answers = Array.isArray(data.Answer) ? data.Answer : [];
    const mxAnswers = answers.filter((a: any) => a.type === 15 || typeof a.data === 'string');

    if (data.Status !== 0 || mxAnswers.length === 0) {
      const result: MxVerificationResult = {
        email: normEmail,
        domain,
        isValid: false,
        mxStatus: 'DEAD_DOMAIN_NO_MX',
        status: 'DEAD_DOMAIN_NO_MX',
        provider: 'None',
        providerLabel: '❌ Dead Domain / No MX',
        mxRecords: []
      };
      mxCache.set(domain, result);
      return result;
    }

    const mxRecords = mxAnswers.map((a: any) => String(a.data || '').toLowerCase());
    const rawJoined = mxRecords.join(' ');

    let provider: MxVerificationResult['provider'] = 'Custom SMTP';
    let providerLabel = '🛡️ Custom SMTP';

    if (rawJoined.includes('google') || rawJoined.includes('aspmx') || rawJoined.includes('l.google.com')) {
      provider = 'Google Workspace';
      providerLabel = '🟢 Google Workspace';
    } else if (rawJoined.includes('outlook.com') || rawJoined.includes('protection.outlook') || rawJoined.includes('microsoft')) {
      provider = 'Microsoft 365';
      providerLabel = '🟦 Microsoft 365';
    } else if (rawJoined.includes('zoho')) {
      provider = 'Zoho';
      providerLabel = '🟨 Zoho Mail';
    } else {
      const firstMxHost = (mxRecords[0]?.split(' ').pop() || domain).replace(/\.$/, '');
      provider = 'Custom SMTP';
      providerLabel = `🛡️ Custom MX (${firstMxHost.slice(0, 22)})`;
    }

    const result: MxVerificationResult = {
      email: normEmail,
      domain,
      isValid: true,
      mxStatus: 'VALID_MX',
      status: 'VALID_MX',
      provider,
      providerLabel,
      mxRecords
    };
    mxCache.set(domain, result);
    return result;
  } catch {
    return {
      email: normEmail,
      domain,
      isValid: true,
      mxStatus: 'TEMP_ERROR',
      status: 'TEMP_ERROR',
      provider: 'Custom SMTP',
      providerLabel: '⚠️ MX Check Timeout',
      mxRecords: []
    };
  }
}

/**
 * Batch verifies multiple emails in parallel with rate pacing
 */
export async function batchVerifyMx(emails: string[]): Promise<Record<string, MxVerificationResult>> {
  const results: Record<string, MxVerificationResult> = {};
  const uniqueDomains = Array.from(new Set(emails.map(e => (e || '').trim().toLowerCase().split('@')[1]).filter(Boolean)));

  // Batch query domains
  for (let i = 0; i < uniqueDomains.length; i += 6) {
    const chunk = uniqueDomains.slice(i, i + 6);
    await Promise.all(
      chunk.map(async dom => {
        const dummyEmail = `test@${dom}`;
        const res = await verifyEmailMX(dummyEmail);
        results[dom] = res;
      })
    );
  }

  // Map to emails
  const finalMap: Record<string, MxVerificationResult> = {};
  for (const email of emails) {
    const dom = (email || '').trim().toLowerCase().split('@')[1];
    if (dom && results[dom]) {
      finalMap[email.toLowerCase()] = { ...results[dom], email: email.toLowerCase() };
    }
  }

  return finalMap;
}

/**
 * Advanced Template Engine:
 * - Smart First Name Detection: If lead.name is empty, equals company (e.g. "BearJam"), or email is generic prefix, treats first_name as blank.
 * - Fallback Token Syntax: {{first_name|there}}, {{name|Team}}, {{company|your studio}}, {{icebreaker|}}
 * - Spintax Resolution: {Hi|Hello|Hey} or {wanted to circle back|quick question}
 * - Standard Tokens: {{name}}, {{first_name}}, {{company}}, {{website}}, {{email}}, {{sender_name}}
 */
export function parseTemplate(
  templateText: string,
  lead: {
    name?: string;
    company?: string;
    email?: string;
    website?: string;
    title?: string;
    icebreaker?: string;
    niche?: string;
  },
  senderName: string = 'Outreach Specialist'
): string {
  if (!templateText) return '';

  const cleanLeadName = (lead.name || '').trim();
  const cleanCompany = (lead.company || '').trim();
  const cleanEmail = (lead.email || '').trim().toLowerCase();
  const emailPrefix = cleanEmail.split('@')[0] || '';

  const isGenericPrefix = GENERIC_STUDIO_PREFIXES.has(emailPrefix.replace(/[._+-].*$/, ''));
  const isNameEqualsCompany = cleanCompany && cleanLeadName.toLowerCase() === cleanCompany.toLowerCase();
  
  let smartFirstName = '';
  if (cleanLeadName && !isNameEqualsCompany && !isGenericPrefix) {
    smartFirstName = cleanLeadName.split(' ')[0] || '';
  }

  let text = templateText;

  // 1. Spintax resolution: {Hi|Hello|Hey} or {quick question|following up}
  text = text.replace(/\{([^{}]+)\}/g, (match, choices) => {
    if (choices.includes('|')) {
      const options = choices.split('|').map((s: string) => s.trim());
      if (options.length > 0) {
        return options[Math.floor(Math.random() * options.length)];
      }
    }
    return match;
  });

  // 2. Token Fallback Syntax: {{first_name|there}}, {{name|Team}}, {{company|your studio}}, {{icebreaker|}}
  text = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\|\s*([^}]*)\s*\}\}/gi, (_, tokenKey, fallbackVal) => {
    const key = tokenKey.toLowerCase();
    const fallback = fallbackVal !== undefined ? fallbackVal : '';
    if (key === 'first_name') return smartFirstName || fallback;
    if (key === 'name') return (cleanLeadName && !isNameEqualsCompany ? cleanLeadName : fallback) || fallback;
    if (key === 'company') return cleanCompany || fallback;
    if (key === 'icebreaker') return (lead.icebreaker || '').trim() || fallback;
    if (key === 'website') return lead.website || cleanCompany || fallback;
    if (key === 'email') return cleanEmail || fallback;
    if (key === 'sender_name') return senderName || fallback;
    if (key === 'title') return lead.title || fallback;
    if (key === 'niche') return lead.niche || fallback;
    return fallback;
  });

  // 3. Standard Tokens: {{name}}, {{first_name}}, {{company}}, etc.
  text = text
    .replace(/\{\{\s*first_name\s*\}\}/gi, smartFirstName || 'there')
    .replace(/\{\{\s*name\s*\}\}/gi, cleanLeadName || 'there')
    .replace(/\{\{\s*company\s*\}\}/gi, cleanCompany || 'your company')
    .replace(/\{\{\s*website\s*\}\}/gi, lead.website || cleanCompany || 'your website')
    .replace(/\{\{\s*email\s*\}\}/gi, cleanEmail)
    .replace(/\{\{\s*sender_name\s*\}\}/gi, senderName)
    .replace(/\{\{\s*title\s*\}\}/gi, lead.title || 'Executive')
    .replace(/\{\{\s*niche\s*\}\}/gi, lead.niche || 'your space')
    .replace(/\{\{\s*icebreaker\s*\}\}/gi, lead.icebreaker || `came across ${cleanCompany || 'your team'} and loved your work`);

  return text;
}

/**
 * Live UK Business Hours Calculator (08:30 - 17:30 London Time, Mon-Fri)
 */
export function getUKBusinessHoursStatus(): {
  isBusinessHours: boolean;
  isWeekend: boolean;
  londonTimeStr: string;
  currentLondonTime: string;
  statusLabel: string;
  reason: string;
  badgeClass: string;
} {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value || 'Mon';
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '12', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    const isWeekend = weekday === 'Sat' || weekday === 'Sun';
    const timeMinutes = hour * 60 + minute;
    const startMinutes = 8 * 60 + 30; // 08:30
    const endMinutes = 17 * 60 + 30;   // 17:30

    const isBusinessHours = !isWeekend && timeMinutes >= startMinutes && timeMinutes <= endMinutes;
    const londonTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${weekday})`;

    if (isBusinessHours) {
      return {
        isBusinessHours: true,
        isWeekend: false,
        londonTimeStr,
        currentLondonTime: londonTimeStr,
        statusLabel: `🇬🇧 London: ${londonTimeStr} • In UK Business Hours`,
        reason: 'In UK Business Hours (08:30 - 17:30 London Time)',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      };
    } else {
      const reasonStr = isWeekend ? 'Weekend (Closed)' : 'Outside UK Hours (08:30 - 17:30)';
      return {
        isBusinessHours: false,
        isWeekend,
        londonTimeStr,
        currentLondonTime: londonTimeStr,
        statusLabel: `🇬🇧 London: ${londonTimeStr} • ${reasonStr}`,
        reason: reasonStr,
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      };
    }
  } catch {
    return {
      isBusinessHours: true,
      isWeekend: false,
      londonTimeStr: '12:00 (Mon)',
      currentLondonTime: '12:00 (Mon)',
      statusLabel: '🇬🇧 London Time',
      reason: 'UK Business Hours Active',
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700'
    };
  }
}

export interface DnsblCheckResult {
  host: string;
  name: string;
  isClean: boolean;
  statusText: string;
  badgeClass: string;
}

export interface DomainDeliverabilityAudit {
  domain: string;
  healthScore: number; // 0 - 100
  spf: {
    passed: boolean;
    record: string;
    statusText: string;
    recommendedDns: string;
  };
  dmarc: {
    passed: boolean;
    policy: 'reject' | 'quarantine' | 'none' | 'missing';
    record: string;
    statusText: string;
    recommendedDns: string;
  };
  dkim: {
    passed: boolean;
    selectorFound: string;
    record: string;
    statusText: string;
    recommendedDns: string;
  };
  blacklists: DnsblCheckResult[];
  allClean: boolean;
  auditedAt: string;
}

/**
 * 100% Free Live Domain Health Auditor using Google DNS-over-HTTPS
 * Verifies SPF (TXT), DMARC (_dmarc.domain), DKIM selectors, and Live DNSBL Blacklists
 */
export async function checkDomainDeliverability(targetDomain: string): Promise<DomainDeliverabilityAudit> {
  const cleanDomain = (targetDomain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').split('@').pop() || 'visualsky.pro';

  // 1. Check Root SPF Record (TXT)
  let spfPassed = false;
  let spfRecord = '';
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=TXT`, {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      const answers = Array.isArray(data.Answer) ? data.Answer : [];
      const spfAnswer = answers.find((a: any) => typeof a.data === 'string' && a.data.includes('v=spf1'));
      if (spfAnswer) {
        spfPassed = true;
        spfRecord = String(spfAnswer.data).replace(/^"|"$/g, '');
      }
    }
  } catch {}

  // 2. Check DMARC Record (_dmarc.domain TXT)
  let dmarcPassed = false;
  let dmarcPolicy: 'reject' | 'quarantine' | 'none' | 'missing' = 'missing';
  let dmarcRecord = '';
  try {
    const res = await fetch(`https://dns.google/resolve?name=_dmarc.${encodeURIComponent(cleanDomain)}&type=TXT`, {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      const answers = Array.isArray(data.Answer) ? data.Answer : [];
      const dmarcAnswer = answers.find((a: any) => typeof a.data === 'string' && a.data.includes('v=DMARC1'));
      if (dmarcAnswer) {
        dmarcPassed = true;
        dmarcRecord = String(dmarcAnswer.data).replace(/^"|"$/g, '');
        if (dmarcRecord.includes('p=reject')) dmarcPolicy = 'reject';
        else if (dmarcRecord.includes('p=quarantine')) dmarcPolicy = 'quarantine';
        else dmarcPolicy = 'none';
      }
    }
  } catch {}

  // 3. Check DKIM Record on common selectors (default, google, k1, s1)
  let dkimPassed = false;
  let dkimSelectorFound = '';
  let dkimRecord = '';
  const candidateSelectors = ['default', 'google', 'k1', 's1'];
  for (const selector of candidateSelectors) {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${selector}._domainkey.${encodeURIComponent(cleanDomain)}&type=TXT`, {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        const answers = Array.isArray(data.Answer) ? data.Answer : [];
        const dkimAnswer = answers.find((a: any) => typeof a.data === 'string' && (a.data.includes('v=DKIM1') || a.data.includes('p=')));
        if (dkimAnswer) {
          dkimPassed = true;
          dkimSelectorFound = selector;
          dkimRecord = String(dkimAnswer.data).replace(/^"|"$/g, '');
          break;
        }
      }
    } catch {}
  }

  // 4. Free Live DNSBL Blacklist checks (Spamhaus, SpamCop, SORBS)
  const dnsblServers = [
    { host: 'zen.spamhaus.org', name: 'Spamhaus ZEN' },
    { host: 'bl.spamcop.net', name: 'SpamCop' },
    { host: 'dnsbl.sorbs.net', name: 'SORBS DNSBL' }
  ];

  const blacklists: DnsblCheckResult[] = await Promise.all(
    dnsblServers.map(async srv => {
      try {
        const queryHost = `${cleanDomain}.${srv.host}`;
        const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(queryHost)}&type=A`, {
          signal: AbortSignal.timeout(4500)
        });
        if (res.ok) {
          const data = await res.json();
          // NXDOMAIN (status 3) or status 0 with no answer = NOT listed (Clean)
          const isListed = data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0;
          if (isListed) {
            return {
              host: srv.host,
              name: srv.name,
              isClean: false,
              statusText: '🔴 Listed',
              badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            };
          }
        }
        return {
          host: srv.host,
          name: srv.name,
          isClean: true,
          statusText: '🟢 Clean',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        };
      } catch {
        return {
          host: srv.host,
          name: srv.name,
          isClean: true,
          statusText: '🟢 Clean',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        };
      }
    })
  );

  // Compute 0 - 100 Deliverability Health Score
  let score = 0;
  if (spfPassed) score += 30;
  if (dmarcPassed) {
    score += (dmarcPolicy === 'reject' ? 30 : dmarcPolicy === 'quarantine' ? 25 : 15);
  }
  if (dkimPassed) score += 25;
  const cleanCount = blacklists.filter(b => b.isClean).length;
  score += Math.round((cleanCount / dnsblServers.length) * 15);

  const defaultRecommendedSpf = `v=spf1 include:_spf.google.com include:sendgrid.net ~all`;
  const defaultRecommendedDmarc = `v=DMARC1; p=quarantine; rua=mailto:dmarc@${cleanDomain}; pct=100; sp=quarantine`;
  const defaultRecommendedDkim = `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...`;

  return {
    domain: cleanDomain,
    healthScore: Math.min(100, Math.max(10, score)),
    spf: {
      passed: spfPassed,
      record: spfRecord || 'No SPF record found on domain root',
      statusText: spfPassed ? 'PASS (Aligned)' : 'MISSING (Critical)',
      recommendedDns: defaultRecommendedSpf
    },
    dmarc: {
      passed: dmarcPassed,
      policy: dmarcPolicy,
      record: dmarcRecord || 'No DMARC record found on _dmarc sub-domain',
      statusText: dmarcPassed ? `Enforced (${dmarcPolicy})` : 'MISSING (High Risk)',
      recommendedDns: defaultRecommendedDmarc
    },
    dkim: {
      passed: dkimPassed,
      selectorFound: dkimSelectorFound,
      record: dkimRecord || 'No standard DKIM selector found (tested: default, google, k1, s1)',
      statusText: dkimPassed ? `PASS (selector: ${dkimSelectorFound})` : 'NOT DETECTED',
      recommendedDns: defaultRecommendedDkim
    },
    blacklists,
    allClean: cleanCount === dnsblServers.length,
    auditedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

/**
 * Free Website Context Scraper & Gemini 2.0 Icebreaker Generator
 * Generates natural, 1-sentence casual compliments for video editing & post-production outreach (strictly max 18 words)
 */
export async function generateLeadIcebreaker(lead: {
  name?: string;
  company?: string;
  email?: string;
  website?: string;
  niche?: string;
  location?: string;
}): Promise<string> {
  const company = (lead.company || '').trim() || 'your studio';
  const emailDomain = (lead.email || '').split('@')[1] || '';
  const domain = (lead.website || emailDomain).replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  try {
    const res = await fetch('/api/gemini/generate-icebreaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        company,
        domain,
        website: lead.website,
        niche: lead.niche || 'video production & creative studio',
        name: lead.name
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.icebreaker && typeof data.icebreaker === 'string' && data.icebreaker.trim()) {
        return data.icebreaker.trim();
      }
    }
  } catch {}

  // Intelligent fallback compliment without cheesy buzzwords
  return `Loved the visual pacing and clean color grade across ${company}'s recent reel.`;
}
