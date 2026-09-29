import { doc, getDocFromServer, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
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
  driveStorageSettings?: any;
  userProfile?: any;
  permanentlyDeletedIds?: string[];
  deletedThreadIds?: string[];
  userDeletedCampaigns?: boolean;
  userId?: string;
  email?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface FetchWorkspaceResult {
  success: boolean;
  data: WorkspaceData | null;
  source: 'firestore-db' | 'supabase-auth' | 'supabase-table' | 'backend-db' | 'none';
  error?: string;
}

const DEMO_IDS = new Set([
  'lead-saas-101', 'lead-saas-102', 'lead-saas-103', 'lead-saas-104', 'lead-saas-105',
  'camp-b2b-saas-growth', 'camp-enterprise-partners',
  'smtp-primary-google', 'smtp-secondary-relay',
  'thread-liam-103', 'sent-init-1', 'sent-init-2'
]);

export function getCanonicalWorkspaceDocId(email?: string, userId?: string): string {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail) {
    return `ws_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
  }
  const cleanUserId = (userId || '').trim().toLowerCase();
  if (cleanUserId) {
    return `ws_${cleanUserId.replace(/[^a-z0-9]/g, '_')}`;
  }
  return '';
}

export function getLocalTombstones(): Set<string> {
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
}

export function scrubWorkspaceCollections(rawWorkspace: any, extraTombstones?: Iterable<string>): WorkspaceData {
  if (!rawWorkspace || typeof rawWorkspace !== 'object') return {};

  const deletedSet = getLocalTombstones();
  if (extraTombstones) {
    for (const id of extraTombstones) if (id) deletedSet.add(String(id));
  }
  if (Array.isArray(rawWorkspace.deletedThreadIds)) {
    for (const id of rawWorkspace.deletedThreadIds) if (id) deletedSet.add(String(id));
  }
  if (Array.isArray(rawWorkspace.permanentlyDeletedIds)) {
    for (const id of rawWorkspace.permanentlyDeletedIds) if (id) deletedSet.add(String(id));
  }

  const isAlive = (item: any) => {
    if (!item || !item.id) return false;
    const idStr = String(item.id);
    if (idStr.startsWith('camp-live-') || idStr.startsWith('camp-restored-')) return false;
    if (DEMO_IDS.has(idStr) || deletedSet.has(idStr) || deletedSet.has(`thread:${idStr}`)) return false;
    if (item.name && deletedSet.has(`camp-name:${String(item.name).trim().toLowerCase()}`)) return false;
    return true;
  };

  const filterAlive = (arr?: any[]) => (Array.isArray(arr) ? arr.filter(isAlive) : []);

  const allDeletedArr = Array.from(deletedSet).slice(-5000);

  return {
    ...rawWorkspace,
    leads: Array.isArray(rawWorkspace.leads) ? filterAlive(rawWorkspace.leads) : undefined,
    leadTags: Array.isArray(rawWorkspace.leadTags) ? rawWorkspace.leadTags.filter(isAlive) : undefined,
    campaigns: Array.isArray(rawWorkspace.campaigns) ? filterAlive(rawWorkspace.campaigns) : undefined,
    smtpAccounts: Array.isArray(rawWorkspace.smtpAccounts) ? filterAlive(rawWorkspace.smtpAccounts) : undefined,
    emailTemplates: Array.isArray(rawWorkspace.emailTemplates) ? filterAlive(rawWorkspace.emailTemplates) : undefined,
    templateCategories: Array.isArray(rawWorkspace.templateCategories) ? rawWorkspace.templateCategories.filter(isAlive) : undefined,
    threads: Array.isArray(rawWorkspace.threads)
      ? filterAlive(rawWorkspace.threads).filter(
          (t: any) => !deletedSet.has(`thread:${String(t.id).replace(/-split-\d+$/, '')}`)
        )
      : undefined,
    sentEmails: Array.isArray(rawWorkspace.sentEmails) ? filterAlive(rawWorkspace.sentEmails) : undefined,
    minedLeads: Array.isArray(rawWorkspace.minedLeads) ? filterAlive(rawWorkspace.minedLeads) : undefined,
    deletedThreadIds: allDeletedArr.slice(-4000),
    permanentlyDeletedIds: allDeletedArr
  };
}

function sanitizeForFirestore(payload: WorkspaceData): WorkspaceData {
  try {
    const clone: any = JSON.parse(JSON.stringify(payload));
    if (Array.isArray(clone.sentEmails) && clone.sentEmails.length > 400) {
      clone.sentEmails = clone.sentEmails.slice(0, 400);
    }
    if (Array.isArray(clone.minedLeads) && clone.minedLeads.length > 300) {
      clone.minedLeads = clone.minedLeads.slice(0, 300);
    }
    if (clone.notificationSettings?.customAudioBase64 && String(clone.notificationSettings.customAudioBase64).length > 150000) {
      delete clone.notificationSettings.customAudioBase64;
    }
    return clone;
  } catch {
    return payload;
  }
}

/**
 * Subscribe to real-time cross-device & cross-browser changes via Google Cloud Firestore.
 * Whenever any device or browser deletes, trashes, restores, or updates data for this account,
 * onUpdate fires immediately (< 150ms) across all other open browsers and devices.
 */
export function subscribeToUserWorkspace(
  identifiers: { userId?: string; email?: string },
  onUpdate: (data: WorkspaceData) => void
): () => void {
  const docId = getCanonicalWorkspaceDocId(identifiers.email, identifiers.userId);
  if (!docId) return () => {};

  try {
    const docRef = doc(db, 'workspaces', docId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const raw = snapshot.data();
        if (raw && typeof raw === 'object') {
          const scrubbed = scrubWorkspaceCollections(raw);
          onUpdate(scrubbed);
        }
      },
      () => {
        // Ignore transient snapshot errors; polling fallback stays active
      }
    );
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Instantly query existing workspace database records across any device or browser.
 * Queries Google Cloud Firestore, Central Server Database, and Supabase Database table in parallel.
 * Evaluates records across sources, unions all permanent deletion tombstones, and selects the most recent state.
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
  let bestSource: 'firestore-db' | 'supabase-auth' | 'supabase-table' | 'backend-db' | 'none' = 'none';
  let bestTimestamp = 0;
  const cumulativeTombstones = getLocalTombstones();
  let anyUserDeletedCampaigns = false;

  const considerCandidate = (
    candidate: any,
    source: 'firestore-db' | 'supabase-auth' | 'supabase-table' | 'backend-db'
  ) => {
    if (!candidate || typeof candidate !== 'object') return;
    const rawTs = candidate.updatedAt ? new Date(candidate.updatedAt).getTime() : 1;
    const ts = Number.isFinite(rawTs) ? rawTs : 1;

    if (Array.isArray(candidate.deletedThreadIds)) {
      for (const id of candidate.deletedThreadIds) if (id) cumulativeTombstones.add(String(id));
    }
    if (Array.isArray(candidate.permanentlyDeletedIds)) {
      for (const id of candidate.permanentlyDeletedIds) if (id) cumulativeTombstones.add(String(id));
    }
    if (candidate.userDeletedCampaigns) {
      anyUserDeletedCampaigns = true;
    }

    const scrubbedCandidate = scrubWorkspaceCollections(candidate, cumulativeTombstones);

    if (!bestData) {
      bestData = {
        ...scrubbedCandidate,
        userDeletedCampaigns: anyUserDeletedCampaigns || Boolean(scrubbedCandidate.userDeletedCampaigns)
      };
      bestSource = source;
      bestTimestamp = ts;
      return;
    }

    const isNewer = ts >= bestTimestamp;
    const primary = isNewer ? scrubbedCandidate : scrubWorkspaceCollections(bestData, cumulativeTombstones);
    const secondary = isNewer ? scrubWorkspaceCollections(bestData, cumulativeTombstones) : scrubbedCandidate;

    const pickAuthoritative = (primArr?: any[], secArr?: any[]) => {
      if (Array.isArray(primArr)) return primArr;
      if (Array.isArray(secArr)) return secArr;
      return [];
    };

    const allDeletedArr = Array.from(cumulativeTombstones).slice(-5000);

    bestData = {
      ...secondary,
      ...primary,
      leads: pickAuthoritative(primary.leads, secondary.leads),
      leadTags: Array.isArray(primary.leadTags)
        ? primary.leadTags
        : Array.isArray(secondary.leadTags)
        ? secondary.leadTags
        : undefined,
      campaigns: pickAuthoritative(primary.campaigns, secondary.campaigns),
      smtpAccounts: pickAuthoritative(primary.smtpAccounts, secondary.smtpAccounts),
      emailTemplates: Array.isArray(primary.emailTemplates)
        ? primary.emailTemplates
        : Array.isArray(secondary.emailTemplates)
        ? secondary.emailTemplates
        : undefined,
      templateCategories: Array.isArray(primary.templateCategories)
        ? primary.templateCategories
        : Array.isArray(secondary.templateCategories)
        ? secondary.templateCategories
        : undefined,
      threads: pickAuthoritative(primary.threads, secondary.threads),
      deletedThreadIds: allDeletedArr.slice(-4000),
      permanentlyDeletedIds: allDeletedArr,
      userDeletedCampaigns: anyUserDeletedCampaigns || Boolean(primary.userDeletedCampaigns || secondary.userDeletedCampaigns),
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

  const withTimeout = <T>(promise: Promise<T>, ms: number = 2200): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
  };

  const canonicalDocId = getCanonicalWorkspaceDocId(cleanEmail, cleanUserId);

  await Promise.allSettled([
    // 1. Google Cloud Firestore (Global cross-device & cross-browser cloud authority)
    (async () => {
      if (!canonicalDocId) return;
      try {
        const docRef = doc(db, 'workspaces', canonicalDocId);
        let snap;
        try {
          snap = await withTimeout(getDocFromServer(docRef), 2000);
        } catch {
          snap = await withTimeout(getDoc(docRef), 1500);
        }
        if (snap && snap.exists()) {
          const firestoreData = snap.data();
          if (firestoreData && typeof firestoreData === 'object') {
            considerCandidate(firestoreData, 'firestore-db');
          }
        }
      } catch {}
    })(),

    // 2. Central Backend Database API
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

        const fallbackId = cleanEmail || cleanUserId;
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

    // 3. Supabase Table fallback
    (async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        let query = supabase.from('user_workspaces').select('*');
        if (cleanEmail) {
          query = query.ilike('email', cleanEmail);
        } else if (cleanUserId) {
          query = query.eq('user_id', cleanUserId);
        }

        const { data: supaRows, error: supaErr } = (await withTimeout(
          query.order('updated_at', { ascending: false }).limit(1) as any,
          2000
        )) as any;
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
      data: scrubWorkspaceCollections(bestData, cumulativeTombstones),
      source: bestSource
    };
  }

  return { success: false, data: null, source: 'none' };
}

/**
 * Persist user workflows, campaigns, leads, settings, and permanent deletion tombstones
 * simultaneously to Google Cloud Firestore, Central Server Database, and Supabase.
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
  const scrubbed = scrubWorkspaceCollections({
    ...data,
    userId: cleanUserId,
    email: cleanEmail,
    updatedAt: nowIso
  });

  const payloadToSave: WorkspaceData = {
    ...scrubbed,
    userId: cleanUserId,
    email: cleanEmail,
    updatedAt: nowIso
  };

  const canonicalDocId = getCanonicalWorkspaceDocId(cleanEmail, cleanUserId);

  // 1. Save to Google Cloud Firestore (Real-time cross-device & cross-browser sync)
  const firestorePromise = (async () => {
    if (!canonicalDocId) return false;
    try {
      const cleanFirestorePayload = sanitizeForFirestore(payloadToSave);
      await setDoc(doc(db, 'workspaces', canonicalDocId), cleanFirestorePayload);
      return true;
    } catch (err) {
      console.warn('Firestore workspace save warning:', err);
      return false;
    }
  })();

  // 2. Fire-and-forget Supabase persistence
  if (isSupabaseConfigured && supabase) {
    Promise.resolve().then(async () => {
      try {
        const rowId = canonicalDocId || cleanUserId || `usr-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`;
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

  // 3. Save to Central Backend Database API immediately (with keepalive so page reload never aborts in-flight write)
  let backendSucceeded = false;
  try {
    const res = await fetch('/api/user-data/save', {
      method: 'POST',
      keepalive: true,
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
      backendSucceeded = true;
    } else {
      const fallbackId = cleanEmail || cleanUserId;
      if (fallbackId) {
        const res2 = await fetch(`/api/user-data/${encodeURIComponent(fallbackId)}`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payloadToSave })
        });
        if (res2.ok) backendSucceeded = true;
      }
    }
  } catch {}

  const firestoreSucceeded = await firestorePromise;

  return {
    success: backendSucceeded || firestoreSucceeded,
    updatedAt: nowIso
  };
}
