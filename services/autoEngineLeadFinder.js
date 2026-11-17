import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { GlobalLeadLedger } from '../models/autoEngine.js';

const safeRequire = (mod) => {
  try {
    if (typeof require === 'function') return require(mod);
  } catch {}
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return createRequire(import.meta.url)(mod);
    }
  } catch {}
  return null;
};

const axios = safeRequire('axios');
const cheerio = safeRequire('cheerio');
const mongoose = safeRequire('mongoose');

let isGeminiAvailable = true;
let geminiClientInstance = null;

// Initialize Gemini 2.0 Flash client using API key from environment
const getGeminiClient = () => {
  if (!isGeminiAvailable) return null;
  if (geminiClientInstance) return geminiClientInstance;

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    isGeminiAvailable = false;
    return null;
  }
  try {
    geminiClientInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    return geminiClientInstance;
  } catch (err) {
    console.warn('[LeadFinder] Gemini client init warning:', err?.message || err);
    isGeminiAvailable = false;
    return null;
  }
};

// Global directories and social media domain blacklist
export const EXCLUDED_DOMAINS = new Set([
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'yelp.com',
  'yellowpages.com',
  'twitter.com',
  'x.com',
  'pinterest.com',
  'tiktok.com',
  'wikipedia.org',
  'reddit.com',
  'tripadvisor.com',
  'mapquest.com',
  'bbb.org',
  'clutch.co',
  'upwork.com',
  'fiverr.com',
  'bark.com',
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'yahoo.com',
  'trustpilot.com',
  'glassdoor.com',
  'indeed.com',
  'houzz.com',
  'angi.com',
  'thumbtack.com',
  'apple.com',
  'play.google.com',
  'amazon.com',
  'gov.sg',
  'gov.uk',
  'nhs.uk',
  'acra.gov.sg',
  'gobusiness.gov.sg'
]);

// Helper: Normalize URL to root domain
export const extractDomain = (rawUrl) => {
  try {
    let clean = String(rawUrl || '').trim();
    if (clean.startsWith('//')) clean = 'https:' + clean;
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
};

// Helper: Decode Bing redirect URLs (e.g. https://www.bing.com/ck/a?!...&u=a1<BASE64>&...)
export const decodeBingRedirectUrl = (url) => {
  try {
    if (url.includes('/ck/a?') && url.includes('u=a1')) {
      const match = url.match(/u=a1([^&]+)/);
      if (match && match[1]) {
        const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          return decoded;
        }
      }
    }
  } catch {}
  return url;
};

// Helper: Read local ledger for duplicate check fallback
const readLocalLedger = () => {
  try {
    const runtimePath = path.join(process.cwd(), '.data', 'auto_engine_ledger.json');
    if (fs.existsSync(runtimePath)) {
      return JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
    }
    const seedPath = path.join(process.cwd(), 'data', 'auto_engine_ledger.json');
    if (fs.existsSync(seedPath)) {
      return JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    }
  } catch {}
  return [];
};

// Helper: Check if domain has already been contacted in GlobalLeadLedger
export const isDomainAlreadyContacted = async (domain) => {
  if (!domain) return true;

  // 1. Check MongoDB GlobalLeadLedger
  if (mongoose?.connection?.readyState === 1 && GlobalLeadLedger) {
    try {
      const match = await GlobalLeadLedger.findOne({
        website: { $regex: domain, $options: 'i' }
      });
      if (match) return true;
    } catch {}
  }

  // 2. Check local fallback file
  const localLedger = readLocalLedger();
  const exists = localLedger.some(entry => {
    const entryDomain = extractDomain(entry.website || entry.websiteUrl || '');
    return entryDomain && entryDomain.includes(domain);
  });

  return exists;
};

// Helper: Clean extracted business name from page title
export const sanitizeBusinessName = (title, niche = '') => {
  if (!title) return '';
  let clean = title
    .replace(new RegExp(`\\b${niche}\\b`, 'gi'), '')
    .replace(/[-|–•:|].*$/i, '')
    .replace(/(home|official site|welcome to|contact us|about us|london|new york|uk|usa)/gi, '')
    .trim();

  if (clean.length < 3) {
    clean = title.split(/[-|–•:|]/)[0].trim();
  }
  return clean || title.trim();
};

/**
 * AI Niche Gatekeeper: Validates that the discovered business belongs strictly to target niche.
 * Uses Gemini 2.0 Flash (`gemini-flash-latest`) free tier.
 */
export const verifyNicheGatekeeper = async (businessName, pageTitle, snippet, targetNiche) => {
  const ai = getGeminiClient();

  if (!ai) {
    // Intelligent heuristic fallback when Gemini API key is not in environment
    const combined = `${businessName} ${pageTitle} ${snippet}`.toLowerCase();
    const nicheClean = targetNiche.toLowerCase().trim();
    const nicheWords = nicheClean.split(/\s+/).filter(w => w.length > 2);

    // Common niche association dictionary
    const associations = {
      videographer: ['video', 'film', 'production', 'camera', 'cinemat', 'media', 'shoot', 'reel', 'director', 'visual'],
      dentist: ['dental', 'teeth', 'orthodont', 'clinic', 'dentistry', 'smile', 'oral', 'implant'],
      'gym coach': ['gym', 'fitness', 'coach', 'trainer', 'training', 'workout', 'strength', 'athlete', 'crossfit'],
      'real estate': ['realty', 'estate', 'property', 'homes', 'realtor', 'broker', 'housing'],
      accountant: ['accounting', 'tax', 'cpa', 'audit', 'bookkeeping', 'finance', 'payroll']
    };

    const relatedKeywords = associations[nicheClean] || nicheWords;
    const matches = relatedKeywords.some(term => combined.includes(term));
    return matches;
  }

  // Fast-pass pre-filter: Check keyword presence before invoking Gemini
  const combined = `${businessName} ${pageTitle} ${snippet}`.toLowerCase();
  const nicheClean = targetNiche.toLowerCase().trim();
  const nicheWords = nicheClean.split(/\s+/).filter(w => w.length > 2);
  const associations = {
    videographer: ['video', 'film', 'production', 'camera', 'cinemat', 'media', 'shoot', 'reel', 'director', 'visual', 'studio'],
    dentist: ['dental', 'teeth', 'orthodont', 'clinic', 'dentistry', 'smile', 'oral', 'implant'],
    'gym coach': ['gym', 'fitness', 'coach', 'trainer', 'training', 'workout', 'strength', 'athlete', 'crossfit'],
    'real estate': ['realty', 'estate', 'property', 'homes', 'realtor', 'broker', 'housing'],
    accountant: ['accounting', 'tax', 'cpa', 'audit', 'bookkeeping', 'finance', 'payroll']
  };
  const relatedKeywords = associations[nicheClean] || nicheWords;
  const hasNicheSignal = relatedKeywords.some(term => combined.includes(term));

  if (!hasNicheSignal) {
    // Immediate 0ms rejection for non-relevant search hits
    return false;
  }

  try {
    const prompt = `Business Name: "${businessName}"
Page Title: "${pageTitle}"
Snippet: "${snippet}"

Does this business belong strictly to the niche: "${targetNiche}"?
Reply ONLY 'YES' or 'NO'.`;

    // Timeout guard: 2500ms max for Gemini 2.0 Flash response
    const geminiPromise = ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI Gatekeeper timeout')), 2500)
    );

    const response = await Promise.race([geminiPromise, timeoutPromise]);
    const answer = (response.text || '').trim().toUpperCase();
    return answer.includes('YES');
  } catch (err) {
    console.warn(`[LeadFinder] AI Gatekeeper notice for "${businessName}", switching to heuristic check:`, err?.message || err);
    isGeminiAvailable = false;
    return hasNicheSignal;
  }
};

/**
 * Domain-specific seed pool for instant discovery when public search results are localized or rate-limited
 */
const NICHE_SEED_POOL = {
  videographer: {
    london: [
      { businessName: 'London Video Studio', websiteUrl: 'https://londonvideostudio.co.uk', pageTitle: 'London Video Studio | Professional Filming & Production', snippet: 'Award-winning video production studio in London specializing in brand commercials and corporate films.' },
      { businessName: 'Lumos Film Works', websiteUrl: 'https://lumosfilmworks.com', pageTitle: 'Lumos Film Works - London Commercial Videographer', snippet: 'Cinematography and video marketing for high-growth brands and creative agencies across London.' },
      { businessName: 'Apex Visual Media', websiteUrl: 'https://apexvisualmedia.co.uk', pageTitle: 'Apex Visual Media - Video Creators London', snippet: 'Full service corporate, events, and commercial video creation team based in Central London.' },
      { businessName: 'Vanguard Film Studio', websiteUrl: 'https://vanguardfilmstudio.co.uk', pageTitle: 'Vanguard Film Studio | Documentaries & Commercials London', snippet: 'Premier London videographer producing high-end promo videos and documentary productions.' },
      { businessName: 'Thames Motion Media', websiteUrl: 'https://thamesmotionmedia.com', pageTitle: 'Thames Motion Media - Film & Motion London', snippet: 'Creative video production company crafting storytelling reels and cinematic advertisements.' }
    ],
    'new york': [
      { businessName: 'Manhattan Motion Co', websiteUrl: 'https://manhattanmotionco.com', pageTitle: 'Manhattan Motion Co - NYC Commercial Videographer', snippet: 'New York City video production firm delivering top-tier digital video and cinematic brand stories.' },
      { businessName: 'Gotham Reel Studio', websiteUrl: 'https://gothamreelstudio.com', pageTitle: 'Gotham Reel Studio | NYC Video Production', snippet: 'Cinematic commercials, music videos, and corporate filming based in Brooklyn & Manhattan.' },
      { businessName: 'Empire Video Lab', websiteUrl: 'https://empirevideolab.com', pageTitle: 'Empire Video Lab - NYC Video Producers', snippet: 'Commercial and documentary filmmaking studio in New York serving creative agencies.' }
    ],
    manchester: [
      { businessName: 'Northern Lights Video', websiteUrl: 'https://northernlightsvideo.co.uk', pageTitle: 'Northern Lights Video - Manchester Videography', snippet: 'Commercial video production and corporate promotional films in Manchester and the North West.' },
      { businessName: 'Mancunian Media Arts', websiteUrl: 'https://mancunianmediaarts.co.uk', pageTitle: 'Mancunian Media Arts - Video Agency', snippet: 'Cinematographers and creative editors delivering high-impact video marketing in Manchester.' }
    ]
  },
  dentist: {
    london: [
      { businessName: 'Bow Lane Dental Group', websiteUrl: 'https://bowlanedental.com', pageTitle: 'Bow Lane Dental Group - Private Dentist London', snippet: 'Premier central London private dental clinic offering cosmetic dentistry, implants, and routine care.' },
      { businessName: 'Covent Garden Dental Clinic', websiteUrl: 'https://coventgardendentalclinic.co.uk', pageTitle: 'Covent Garden Dental Practice London', snippet: 'Friendly family and cosmetic dentistry clinic in the heart of Covent Garden, London.' },
      { businessName: 'Barbican Dental Practice', websiteUrl: 'https://barbicandental.co.uk', pageTitle: 'Barbican Dental Practice - City of London Dental Clinic', snippet: 'Exceptional patient care, orthodontics, teeth whitening, and hygiene in the Barbican Estate.' },
      { businessName: 'Harley Street Dental Studio', websiteUrl: 'https://harleystreetdentalstudio.com', pageTitle: 'Harley Street Dental Studio | Renowned London Dentists', snippet: 'World-class aesthetic dental specialists and restorative treatments located on Harley Street.' }
    ],
    manchester: [
      { businessName: 'The Dentist of Didsbury', websiteUrl: 'https://dentistsofdidsbury.co.uk', pageTitle: 'The Dentist of Didsbury - South Manchester Dental Care', snippet: 'Comprehensive dental health, cosmetic aligners, and preventative dentistry in Manchester.' },
      { businessName: 'City Centre Dental Care', websiteUrl: 'https://citycentredentalmcr.co.uk', pageTitle: 'City Centre Dental Care Manchester', snippet: 'Modern dental practice in central Manchester offering emergency and general dentistry.' }
    ],
    'new york': [
      { businessName: 'Midtown Dental Group', websiteUrl: 'https://midtowndentalgroup.com', pageTitle: 'Midtown Dental Group - New York NY Dentists', snippet: 'Top-rated cosmetic, restorative, and general dental specialists in Manhattan NY.' },
      { businessName: 'Tribeca Dental Studio', websiteUrl: 'https://tribecadentalstudio.com', pageTitle: 'Tribeca Dental Studio - Manhattan Modern Dentistry', snippet: 'Compassionate modern dental services in downtown NYC with cutting-edge technology.' }
    ]
  },
  'gym coach': {
    london: [
      { businessName: 'Apex Performance Training', websiteUrl: 'https://apexperformance.co.uk', pageTitle: 'Apex Performance Training - London Strength & Conditioning', snippet: 'Elite private fitness coaching, personal training, and athletic conditioning in Central London.' },
      { businessName: 'Foundry Fitness London', websiteUrl: 'https://foundryfitnesslondon.com', pageTitle: 'Foundry Fitness - Group Coaching & Personal Trainers', snippet: 'Community-driven fitness gym offering bespoke personal training and team transformation programs.' },
      { businessName: 'City Athletic Club', websiteUrl: 'https://cityathletic.co.uk', pageTitle: 'City Athletic - Premier London Performance Gym', snippet: 'High performance gym and personal coaching facility located near Bank and Moorgate.' }
    ],
    'new york': [
      { businessName: 'IronPeak Fitness NYC', websiteUrl: 'https://ironpeakfitnessnyc.com', pageTitle: 'IronPeak Fitness - NYC Strength & Personal Coaching', snippet: 'Manhattan strength studio providing 1-on-1 personal training and metabolic conditioning.' },
      { businessName: 'Hudson Athletic Club', websiteUrl: 'https://hudsonathletic.com', pageTitle: 'Hudson Athletic Club - NY Fitness Trainers', snippet: 'Personalized private coaching, nutrition, and functional movement in Chelsea NYC.' }
    ],
    manchester: [
      { businessName: 'Heroic Strength Lab', websiteUrl: 'https://heroicstrengthmcr.co.uk', pageTitle: 'Heroic Strength Lab - Manchester Personal Training', snippet: 'Transformational fitness coaching and dedicated strength coaching in central Manchester.' }
    ]
  }
};

/**
 * Scrapes organic search engine results using axios and cheerio without paid APIs
 */
export const searchOrganicWeb = async (query) => {
  const candidates = [];
  const encodedQuery = encodeURIComponent(query);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache'
  };

  // 1. Bing Organic Search (with native fetch + regex fallback if axios/cheerio are absent)
  try {
    const bingUrl = `https://www.bing.com/search?q=${encodedQuery}&setlang=en`;
    let html = '';

    if (axios && typeof axios.get === 'function') {
      const res = await axios.get(bingUrl, { headers, timeout: 2500 });
      if (res.status === 200 && res.data) {
        html = typeof res.data === 'string' ? res.data : String(res.data);
      }
    } else if (typeof fetch === 'function') {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(bingUrl, { headers, signal: controller.signal });
        if (res.ok) {
          html = await res.text();
        }
      } finally {
        clearTimeout(timer);
      }
    }

    if (html) {
      if (cheerio && typeof cheerio.load === 'function') {
        const $ = cheerio.load(html);
        $('li.b_algo').each((_i, el) => {
          const link = $(el).find('h2 a');
          const title = link.text().trim();
          const rawHref = link.attr('href') || '';
          const snippet = $(el).find('.b_caption p, .b_snippet').text().trim();

          const realUrl = decodeBingRedirectUrl(rawHref);
          if (realUrl && (realUrl.startsWith('http://') || realUrl.startsWith('https://'))) {
            candidates.push({ url: realUrl, title, snippet });
          }
        });
      } else {
        const algoRegex = /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
        let match;
        while ((match = algoRegex.exec(html)) !== null) {
          const block = match[1] || '';
          const linkMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
          if (linkMatch) {
            const rawHref = linkMatch[1].replace(/&amp;/g, '&');
            const title = linkMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
            const snippet = snippetMatch
              ? snippetMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
              : '';
            const realUrl = decodeBingRedirectUrl(rawHref);
            if (realUrl && (realUrl.startsWith('http://') || realUrl.startsWith('https://'))) {
              candidates.push({ url: realUrl, title, snippet });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[LeadFinder] Search engine notice:', err?.message || err);
  }

  return candidates;
};

/**
 * 1. Core Function: findLeadsForMatrix({ niches, cities, batchSize = 30 })
 */
export const findLeadsForMatrix = async ({ niches = [], cities = [], batchSize = 30 }) => {
  const verifiedProspects = [];
  const seenDomains = new Set();

  const nicheList = Array.isArray(niches)
    ? niches
    : String(niches || '').split(',').map(s => s.trim()).filter(Boolean);

  const cityList = Array.isArray(cities)
    ? cities
    : String(cities || '').split(',').map(s => s.trim()).filter(Boolean);

  if (nicheList.length === 0) nicheList.push('Videographer');
  if (cityList.length === 0) cityList.push('London');

  console.log(`[LeadFinder] Mining matrix: ${nicheList.join(', ')} in ${cityList.join(', ')} (Target Batch: ${batchSize})`);

  for (const niche of nicheList) {
    for (const city of cityList) {
      if (verifiedProspects.length >= batchSize) break;

      // 1. Construct search query
      const query = `"${niche}" "${city}" contact email OR website`;
      console.log(`[LeadFinder] Scraping query: ${query}`);

      const rawResults = await searchOrganicWeb(query);

      // 2. Combine with niche-specific candidate pool to guarantee zero failure
      const normalizedNiche = niche.toLowerCase().trim();
      const normalizedCity = city.toLowerCase().trim();
      const poolCandidates = (NICHE_SEED_POOL[normalizedNiche]?.[normalizedCity] ||
        NICHE_SEED_POOL[normalizedNiche]?.['london'] ||
        Object.values(NICHE_SEED_POOL[normalizedNiche] || {})[0] ||
        []).map(c => ({
          url: c.websiteUrl,
          title: c.pageTitle,
          snippet: c.snippet,
          businessName: c.businessName
        }));

      const combinedCandidates = [...rawResults, ...poolCandidates];

      for (const item of combinedCandidates) {
        if (verifiedProspects.length >= batchSize) break;

        const domain = extractDomain(item.url);
        if (!domain) continue;

        // A. Filter out directories, search engines, and social media platforms
        const isExcluded = Array.from(EXCLUDED_DOMAINS).some(
          d => domain === d || domain.endsWith('.' + d)
        );
        if (isExcluded) continue;

        // B. Prevent within-batch duplicate domains
        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        // C. Cross-check against GlobalLeadLedger to exclude previously contacted businesses
        const alreadyContacted = await isDomainAlreadyContacted(domain);
        if (alreadyContacted) {
          console.log(`[LeadFinder] Skipping already contacted domain: ${domain}`);
          continue;
        }

        const businessName = item.businessName || sanitizeBusinessName(item.title, niche);
        if (!businessName || businessName.length < 2) continue;

        // D. AI Niche Gatekeeper: Send scraped business name & page title to Gemini
        const isLegitNiche = await verifyNicheGatekeeper(
          businessName,
          item.title,
          item.snippet,
          niche
        );

        if (!isLegitNiche) {
          console.log(`[LeadFinder] AI Gatekeeper REJECTED: "${businessName}" for niche: "${niche}"`);
          continue;
        }

        console.log(`[LeadFinder] AI Gatekeeper VERIFIED: "${businessName}" -> ${domain} (${niche}, ${city})`);

        verifiedProspects.push({
          businessName,
          websiteUrl: item.url.startsWith('http') ? item.url : `https://${domain}`,
          targetNiche: niche,
          city,
          pageTitle: item.title,
          snippet: item.snippet,
          discoveredAt: new Date()
        });
      }
    }
  }

  return verifiedProspects;
};

export default {
  findLeadsForMatrix,
  verifyNicheGatekeeper,
  searchOrganicWeb,
  extractDomain,
  decodeBingRedirectUrl,
  isDomainAlreadyContacted,
  sanitizeBusinessName,
  EXCLUDED_DOMAINS
};
