import { supabase, isSupabaseConfigured } from './supabase';
import { safeParseResponse } from './safeFetch';

export interface WorkspaceData {
  leads?: any[];
  leadTags?: any[];
  smtpAccounts?: any[];
  campaigns?: any[];
  emailTemplates?: any[];
  templateCategories?: any[];
  threads?: any[];
  sentEmails?: any[];
  minedLeads?: any[];
  columnSettings?: any[];
  notificationSettings?: any;
  userProfile?: any;
  userId?: string;
  email?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface FetchWorkspaceResult {
  success: boolean;
  data: WorkspaceData | null;
  source: 'supabase-auth' | 'supabase-table' | 'backend-db' | 'none';
  error?: string;
}

/**
 * Instantly query existing workspace database records across any device or browser.
 * Queries Supabase Auth user_metadata, Supabase Database table, and Central Server Database.
 * Evaluates records across sources and automatically selects the most recent state.
 */
export async function queryUserWorkspace(identifiers: {
  userId?: string;
  email?: string;
}): Promise<FetchWorkspaceResult> {
  const { userId, email } = identifiers;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUserId = (userId || '').trim();

  if (!cleanEmail && !cleanUserId) {
    return { success: false, data: null, source: 'none', error: 'No user ID or email provided' };
  }

  let bestData: WorkspaceData | null = null;
  let bestSource: 'supabase-auth' | 'supabase-table' | 'backend-db' | 'none' = 'none';
  let bestTimestamp = 0;

  const DEMO_IDS = new Set([
    'lead-saas-101', 'lead-saas-102', 'lead-saas-103', 'lead-saas-104', 'lead-saas-105',
    'camp-b2b-saas-growth', 'camp-enterprise-partners',
    'smtp-primary-google', 'smtp-secondary-relay',
    'thread-liam-103', 'sent-init-1', 'sent-init-2'
  ]);

  const mergeArraysById = (arrA?: any[], arrB?: any[], fallbackKey?: string): any[] => {
    const cleanA = (Array.isArray(arrA) ? arrA : []).filter(x => x && !DEMO_IDS.has(x.id));
    const cleanB = (Array.isArray(arrB) ? arrB : []).filter(x => x && !DEMO_IDS.has(x.id));
    if (cleanA.length === 0) return cleanB;
    if (cleanB.length === 0) return cleanA;
    const result = [...cleanA];
    const seenIds = new Set(cleanA.map(x => String(x.id || '')).filter(Boolean));
    const seenFallbacks = fallbackKey
      ? new Set(cleanA.map(x => String(x[fallbackKey] || '').trim().toLowerCase()).filter(Boolean))
      : null;

    for (const item of cleanB) {
      const idStr = String(item.id || '');
      const fbStr = fallbackKey ? String(item[fallbackKey] || '').trim().toLowerCase() : '';
      const hasId = idStr && seenIds.has(idStr);
      const hasFb = fbStr && seenFallbacks && seenFallbacks.has(fbStr);
      if (!hasId && !hasFb) {
        result.push(item);
        if (idStr) seenIds.add(idStr);
        if (fbStr && seenFallbacks) seenFallbacks.add(fbStr);
      }
    }
    return result;
  };

  // Helper to compare and smart-merge candidate records while strictly respecting permanentlyDeletedIds tombstones
  const getLocalTombstones = (): Set<string> => {
    const set = new Set<string>();
    try {
      const localDel = localStorage.getItem('visualsky_deleted_imap_msgs');
      if (localDel) {
        for (const id of JSON.parse(localDel)) if (id) set.add(String(id));
      }
    } catch {}
    try {
      const localPerm = localStorage.getItem('visualsky_permanently_deleted_ids');
      if (localPerm) {
        for (const id of JSON.parse(localPerm)) if (id) set.add(String(id));
      }
    } catch {}
    return set;
  };

  const considerCandidate = (candidate: any, source: 'supabase-auth' | 'supabase-table' | 'backend-db') => {
    if (!candidate || typeof candidate !== 'object') return;
    const ts = candidate.updatedAt ? new Date(candidate.updatedAt).getTime() : 1;

    const deletedSet = getLocalTombstones();
    if (Array.isArray(candidate.deletedThreadIds)) {
      for (const id of candidate.deletedThreadIds) if (id) deletedSet.add(String(id));
    }
    if (Array.isArray(candidate.permanentlyDeletedIds)) {
      for (const id of candidate.permanentlyDeletedIds) if (id) deletedSet.add(String(id));
    }
    if (bestData) {
      if (Array.isArray(bestData.deletedThreadIds)) {
        for (const id of bestData.deletedThreadIds) if (id) deletedSet.add(String(id));
      }
      if (Array.isArray(bestData.permanentlyDeletedIds)) {
        for (const id of bestData.permanentlyDeletedIds) if (id) deletedSet.add(String(id));
      }
    }

    const isAlive = (item: any) => {
      if (!item || !item.id) return false;
      const idStr = String(item.id);
      if (DEMO_IDS.has(idStr) || deletedSet.has(idStr) || deletedSet.has(`thread:${idStr}`)) return false;
      if (item.name && deletedSet.has(`camp-name:${String(item.name).trim().toLowerCase()}`)) return false;
      return true;
    };

    const filterAlive = (arr?: any[]) => (Array.isArray(arr) ? arr.filter(isAlive) : []);

    if (!bestData) {
      bestData = {
        ...candidate,
        leads: filterAlive(candidate.leads),
        leadTags: Array.isArray(candidate.leadTags) ? candidate.leadTags.filter(isAlive) : undefined,
        campaigns: filterAlive(candidate.campaigns),
        smtpAccounts: filterAlive(candidate.smtpAccounts),
        emailTemplates: Array.isArray(candidate.emailTemplates) ? filterAlive(candidate.emailTemplates) : undefined,
        templateCategories: Array.isArray(candidate.templateCategories) ? candidate.templateCategories.filter(isAlive) : undefined,
        threads: filterAlive(candidate.threads).filter(
          (t: any) => !deletedSet.has(`thread:${String(t.id).replace(/-split-\d+$/, '')}`)
        ),
        sentEmails: filterAlive(candidate.sentEmails),
        minedLeads: Array.isArray(candidate.minedLeads) ? filterAlive(candidate.minedLeads) : undefined,
        deletedThreadIds: Array.from(deletedSet),
        permanentlyDeletedIds: Array.from(deletedSet)
      };
      bestSource = source;
      bestTimestamp = ts;
      return;
    }

    // Always prefer backend-db or the newer timestamp as authoritative so deleted/changed items in older cloud backups never overwrite newer state
    const isNewer = source === 'backend-db' ? ts >= bestTimestamp - 5000 : ts > bestTimestamp;
    const primary = isNewer ? candidate : bestData;
    const secondary = isNewer ? bestData : candidate;

    const pickAuthoritative = (primArr?: any[], secArr?: any[]) => {
      if (Array.isArray(primArr)) return filterAlive(primArr);
      if (Array.isArray(secArr)) return filterAlive(secArr);
      return [];
    };

    const cleanThreads = pickAuthoritative(primary.threads, secondary.threads).filter(
      (t: any) => !deletedSet.has(`thread:${String(t.id).replace(/-split-\d+$/, '')}`)
    );

    bestData = {
      ...secondary,
      ...primary,
      leads: pickAuthoritative(primary.leads, secondary.leads),
      leadTags: Array.isArray(primary.leadTags)
        ? primary.leadTags.filter(isAlive)
        : Array.isArray(secondary.leadTags)
        ? secondary.leadTags.filter(isAlive)
        : undefined,
      campaigns: pickAuthoritative(primary.campaigns, secondary.campaigns),
      smtpAccounts: pickAuthoritative(primary.smtpAccounts, secondary.smtpAccounts),
      emailTemplates: Array.isArray(primary.emailTemplates)
        ? filterAlive(primary.emailTemplates)
        : Array.isArray(secondary.emailTemplates)
        ? filterAlive(secondary.emailTemplates)
        : undefined,
      templateCategories: Array.isArray(primary.templateCategories)
        ? primary.templateCategories.filter(isAlive)
        : Array.isArray(secondary.templateCategories)
        ? secondary.templateCategories.filter(isAlive)
        : undefined,
      threads: cleanThreads,
      deletedThreadIds: Array.from(deletedSet),
      permanentlyDeletedIds: Array.from(deletedSet),
      userDeletedCampaigns: Boolean(primary.userDeletedCampaigns || secondary.userDeletedCampaigns),
      sentEmails: pickAuthoritative(primary.sentEmails, secondary.sentEmails),
      minedLeads: pickAuthoritative(primary.minedLeads, secondary.minedLeads),
      userProfile: {
        ...(secondary.userProfile || {}),
        ...(primary.userProfile || {})
      }
    };

    if (isNewer) {
      bestSource = source;
      bestTimestamp = ts;
    }
  };

  const withTimeout = <T>(promise: Promise<T>, ms: number = 2000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
  };

  // Run Backend API and optional Supabase queries in parallel so page load is never blocked by sequential external network calls
  await Promise.allSettled([
    // 1. Central Backend Database API (fastest local authority)
    (async () => {
      try {
        const queryParams = new URLSearchParams();
        if (cleanUserId) queryParams.set('userId', cleanUserId);
        if (cleanEmail) queryParams.set('email', cleanEmail);
        queryParams.set('_t', String(Date.now()));

        const fetchUrl = `/api/user-data/fetch?${queryParams.toString()}`;
        const res = await fetch(fetchUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });

        const parsed = await safeParseResponse(res, 'Backend workspace fetch failed');
        const json = parsed.data;
        if (parsed.ok && json?.success && json?.data && typeof json.data === 'object') {
          considerCandidate(json.data, 'backend-db');
          return;
        }

        const fallbackId = cleanUserId || cleanEmail;
        if (fallbackId) {
          const res2 = await fetch(`/api/user-data/${encodeURIComponent(fallbackId)}?_t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          const parsed2 = await safeParseResponse(res2, 'Backend workspace fallback fetch failed');
          const json2 = parsed2.data;
          if (parsed2.ok && json2?.success && json2?.data && typeof json2.data === 'object') {
            considerCandidate(json2.data, 'backend-db');
          }
        }
      } catch (err: any) {
        console.warn('Backend database fetch warning:', err);
      }
    })(),

    // 2. Supabase Auth & Table (with fast 2s timeout so it never stalls initial render)
    (async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        let query = supabase.from('user_workspaces').select('*');
        if (cleanUserId && cleanEmail) {
          query = query.or(`user_id.eq."${cleanUserId}",email.ilike."${cleanEmail}"`);
        } else if (cleanUserId) {
          query = query.eq('user_id', cleanUserId);
        } else if (cleanEmail) {
          query = query.ilike('email', cleanEmail);
        }

        const { data: supaRows, error: supaErr } = await withTimeout(
          query.order('updated_at', { ascending: false }).limit(1) as any,
          2000
        ) as any;
        if (!supaErr && Array.isArray(supaRows) && supaRows.length > 0 && supaRows[0]?.data) {
          const raw = supaRows[0].data;
          const workspaceObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          considerCandidate(workspaceObj, 'supabase-table');
        }
      } catch {}
    })()
  ]);

  if (bestData) {
    return {
      success: true,
      data: bestData,
      source: bestSource
    };
  }

  return { success: false, data: null, source: 'none' };
}

/**
 * Persist user workflows, campaigns, leads, settings, and app data
 * automatically to Supabase database (mapped to user_id) and Central Server database.
 */
export async function persistUserWorkspace(params: {
  userId: string;
  email: string;
  data: WorkspaceData;
}): Promise<{ success: boolean; error?: string; updatedAt?: string }> {
  const { userId, email, data } = params;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUserId = (userId || '').trim();

  if (!cleanEmail && !cleanUserId) {
    return { success: false, error: 'User identifier required for persistence' };
  }

  const nowIso = data.updatedAt || new Date().toISOString();
  const payloadToSave: WorkspaceData = {
    ...data,
    userId: cleanUserId,
    email: cleanEmail,
    updatedAt: nowIso
  };

  // Fire-and-forget Supabase persistence in background so UI never waits on external cloud calls
  if (isSupabaseConfigured && supabase) {
    Promise.resolve().then(async () => {
      try {
        const rowId = cleanUserId || `usr-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`;
        await supabase.from('user_workspaces').upsert(
          {
            user_id: rowId,
            email: cleanEmail,
            data: payloadToSave,
            updated_at: nowIso
          },
          { onConflict: 'user_id' }
        );
      } catch {}
    });
  }

  // Save to Central Backend Database API immediately
  try {
    const res = await fetch('/api/user-data/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      },
      body: JSON.stringify({
        userId: cleanUserId,
        email: cleanEmail,
        data: payloadToSave
      })
    });

    if (res.ok) {
      return { success: true, updatedAt: nowIso };
    }

    // Fallback: direct identifier POST
    const fallbackId = cleanUserId || cleanEmail;
    const res2 = await fetch(`/api/user-data/${encodeURIComponent(fallbackId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: payloadToSave })
    });

    if (res2.ok) {
      return { success: true, updatedAt: nowIso };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Database persistence failed' };
  }

  return { success: false, updatedAt: nowIso };
}
