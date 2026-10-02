import { getFirebaseRuntime } from './firebase';
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
  aiChatSessions?: any[];
  aiActiveSessionId?: string;
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

export function getCanonicalAiCopilotDocId(email?: string, userId?: string): string {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail) {
    return `ws_aicopilot_${cleanEmail.replace(/[^a-z0-9]/g, '_').slice(0, 95)}`;
  }
  const cleanUserId = (userId || '').trim().toLowerCase();
  if (cleanUserId) {
    return `ws_aicopilot_${cleanUserId.replace(/[^a-z0-9]/g, '_').slice(0, 95)}`;
  }
  return '';
}

export function isUntouchedDefaultAiSession(s: any): boolean {
  if (!s || typeof s !== 'object') return true;
  const msgs = Array.isArray(s.messages) ? s.messages : [];
  if (msgs.length === 0) return true;
  const hasUserMsg = msgs.some((m: any) => m && m.role === 'user' && String(m.content || '').trim().length > 0);
  if (hasUserMsg) return false;
  if (String(s.id) === 'session-default') return true;
  if (msgs.length === 1 && String(msgs[0]?.id) === 'msg-init') return true;
  return false;
}

export function hasRealAiCopilotSessions(sessions?: any[]): boolean {
  if (!Array.isArray(sessions) || sessions.length === 0) return false;
  return sessions.some((s: any) => s && !isUntouchedDefaultAiSession(s));
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
    if (item.name) {
      const cleanNameLower = String(item.name).trim().toLowerCase();
      const slug = cleanNameLower.replace(/[^a-z0-9]+/g, '-');
      if (deletedSet.has(`camp-name:${cleanNameLower}`) || deletedSet.has(`camp-restored-${slug}`)) {
        return false;
      }
    }
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
    aiChatSessions: Array.isArray(rawWorkspace.aiChatSessions) ? filterAlive(rawWorkspace.aiChatSessions) : undefined,
    aiActiveSessionId: rawWorkspace.aiActiveSessionId ? String(rawWorkspace.aiActiveSessionId) : undefined,
    deletedThreadIds: allDeletedArr.slice(-4000),
    permanentlyDeletedIds: allDeletedArr
  };
}

function sanitizeForFirestore(payload: WorkspaceData): WorkspaceData {
  try {
    const clone: any = JSON.parse(JSON.stringify(payload));
    if (Array.isArray(clone.threads)) {
      for (const t of clone.threads) {
        for (const m of t?.messages || []) {
          if (Array.isArray(m?.attachments)) {
            for (const a of m.attachments) {
              if (a && a.contentBase64) {
                delete a.contentBase64;
              }
            }
          }
        }
      }
    }
    if (Array.isArray(clone.sentEmails) && clone.sentEmails.length > 400) {
      clone.sentEmails = clone.sentEmails.slice(0, 400);
    }
    if (Array.isArray(clone.minedLeads) && clone.minedLeads.length > 300) {
      clone.minedLeads = clone.minedLeads.slice(0, 300);
    }
    if (Array.isArray(clone.aiChatSessions) && clone.aiChatSessions.length > 50) {
      clone.aiChatSessions = clone.aiChatSessions.slice(0, 50);
    }
    if (clone.notificationSettings?.customAudioBase64 && String(clone.notificationSettings.customAudioBase64).length > 150000) {
      delete clone.notificationSettings.customAudioBase64;
    }
    return clone;
  } catch {
    return payload;
  }
}

export function mergeWorkspaceCollectionsById(
  primArr?: any[],
  secArr?: any[],
  deletedSet?: Set<string>
): any[] {
  const primList = Array.isArray(primArr) ? primArr : [];
  const secList = Array.isArray(secArr) ? secArr : [];
  if (primList.length === 0 && secList.length === 0) return [];

  const isAllowed = (item: any) => {
    if (!item || !item.id) return false;
    const idStr = String(item.id);
    if (idStr.startsWith('camp-live-') || idStr.startsWith('camp-restored-')) return false;
    if (DEMO_IDS.has(idStr)) return false;
    if (deletedSet) {
      if (deletedSet.has(idStr) || deletedSet.has(`thread:${idStr}`)) return false;
      if (item.name) {
        const cleanNameLower = String(item.name).trim().toLowerCase();
        const slug = cleanNameLower.replace(/[^a-z0-9]+/g, '-');
        if (deletedSet.has(`camp-name:${cleanNameLower}`) || deletedSet.has(`camp-restored-${slug}`)) {
          return false;
        }
      }
    }
    return true;
  };

  const mergedMap = new Map<string, any>();

  // 1. Seed with secondary (older) items first
  for (const item of secList) {
    if (!isAllowed(item)) continue;
    mergedMap.set(String(item.id), item);
  }

  // 2. Overlay primary (newer) items, merging nested messages for threads & AI chat sessions
  for (const item of primList) {
    if (!isAllowed(item)) continue;
    const key = String(item.id);
    const existing = mergedMap.get(key);
    if (existing && Array.isArray(existing.messages) && Array.isArray(item.messages)) {
      const exIsUntouchedDefault = key === 'session-default' && isUntouchedDefaultAiSession(existing);
      const itemIsUntouchedDefault = key === 'session-default' && isUntouchedDefaultAiSession(item);

      if (exIsUntouchedDefault && !itemIsUntouchedDefault) {
        mergedMap.set(key, item);
        continue;
      }
      if (itemIsUntouchedDefault && !exIsUntouchedDefault) {
        mergedMap.set(key, existing);
        continue;
      }

      const msgMap = new Map<string, any>();
      for (const m of existing.messages) {
        if (!m) continue;
        const mKey = String(m.id || `${m.role || m.sender || ''}-${m.timestamp || ''}-${String(m.content || m.body || '').slice(0, 60)}`);
        if (deletedSet && m.id && deletedSet.has(String(m.id))) continue;
        msgMap.set(mKey, m);
      }
      for (const m of item.messages) {
        if (!m) continue;
        const mKey = String(m.id || `${m.role || m.sender || ''}-${m.timestamp || ''}-${String(m.content || m.body || '').slice(0, 60)}`);
        if (deletedSet && m.id && deletedSet.has(String(m.id))) continue;
        msgMap.set(mKey, m);
      }
      const combinedMessages = Array.from(msgMap.values());
      const defaultTitles = new Set(['New Outreach Session', 'High-Converting Cold Outreach']);
      const resolvedTitle =
        item.title && !defaultTitles.has(item.title)
          ? item.title
          : existing.title && !defaultTitles.has(existing.title)
          ? existing.title
          : item.title || existing.title;

      mergedMap.set(key, {
        ...existing,
        ...item,
        ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
        messages: combinedMessages
      });
    } else {
      mergedMap.set(key, existing ? { ...existing, ...item } : item);
    }
  }

  // Preserve primary order first, followed by any remaining secondary items
  const result: any[] = [];
  const seen = new Set<string>();
  for (const item of primList) {
    if (!item || !item.id) continue;
    const k = String(item.id);
    if (mergedMap.has(k) && !seen.has(k)) {
      seen.add(k);
      result.push(mergedMap.get(k));
    }
  }
  for (const item of secList) {
    if (!item || !item.id) continue;
    const k = String(item.id);
    if (mergedMap.has(k) && !seen.has(k)) {
      seen.add(k);
      result.push(mergedMap.get(k));
    }
  }

  // If this is an AI chat sessions collection and there is at least one real session, strip any untouched 'session-default' placeholder
  const hasRealChatSession = result.some(
    (s: any) => s && Array.isArray(s.messages) && s.messages.some((m: any) => m?.role === 'user' || m?.role === 'assistant') && !isUntouchedDefaultAiSession(s)
  );
  if (hasRealChatSession) {
    return result.filter((s: any) => !(String(s?.id) === 'session-default' && isUntouchedDefaultAiSession(s)));
  }

  return result;
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

  let cancelled = false;
  let unsubscribe = () => {};

  getFirebaseRuntime()
    .then((fb) => {
      if (cancelled || !fb) return;
      try {
        const docRef = fb.doc(fb.db, 'workspaces', docId);
        unsubscribe = fb.onSnapshot(
          docRef,
          (snapshot: any) => {
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
      } catch {}
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    try {
      unsubscribe();
    } catch {}
  };
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
  const rawCandidates: Array<{
    candidate: any;
    source: 'firestore-db' | 'supabase-auth' | 'supabase-table' | 'backend-db';
  }> = [];

  const queueCandidate = (
    candidate: any,
    source: 'firestore-db' | 'supabase-auth' | 'supabase-table' | 'backend-db'
  ) => {
    if (!candidate || typeof candidate !== 'object') return;
    if (Array.isArray(candidate.deletedThreadIds)) {
      for (const id of candidate.deletedThreadIds) if (id) cumulativeTombstones.add(String(id));
    }
    if (Array.isArray(candidate.permanentlyDeletedIds)) {
      for (const id of candidate.permanentlyDeletedIds) if (id) cumulativeTombstones.add(String(id));
    }
    if (candidate.userDeletedCampaigns) {
      anyUserDeletedCampaigns = true;
    }
    rawCandidates.push({ candidate, source });
  };

  const considerCandidate = (
    candidate: any,
    source: 'firestore-db' | 'supabase-auth' | 'supabase-table' | 'backend-db'
  ) => {
    if (!candidate || typeof candidate !== 'object') return;
    const rawTs = candidate.updatedAt ? new Date(candidate.updatedAt).getTime() : 1;
    const ts = Number.isFinite(rawTs) ? rawTs : 1;

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

    const allDeletedArr = Array.from(cumulativeTombstones).slice(-5000);

    bestData = {
      ...secondary,
      ...primary,
      leads: mergeWorkspaceCollectionsById(primary.leads, secondary.leads, cumulativeTombstones),
      leadTags: mergeWorkspaceCollectionsById(primary.leadTags, secondary.leadTags, cumulativeTombstones),
      campaigns: mergeWorkspaceCollectionsById(primary.campaigns, secondary.campaigns, cumulativeTombstones),
      smtpAccounts: mergeWorkspaceCollectionsById(primary.smtpAccounts, secondary.smtpAccounts, cumulativeTombstones),
      emailTemplates: mergeWorkspaceCollectionsById(primary.emailTemplates, secondary.emailTemplates, cumulativeTombstones),
      templateCategories: mergeWorkspaceCollectionsById(primary.templateCategories, secondary.templateCategories, cumulativeTombstones),
      threads: mergeWorkspaceCollectionsById(primary.threads, secondary.threads, cumulativeTombstones),
      deletedThreadIds: allDeletedArr.slice(-4000),
      permanentlyDeletedIds: allDeletedArr,
      userDeletedCampaigns: anyUserDeletedCampaigns || Boolean(primary.userDeletedCampaigns || secondary.userDeletedCampaigns),
      sentEmails: mergeWorkspaceCollectionsById(primary.sentEmails, secondary.sentEmails, cumulativeTombstones),
      minedLeads: mergeWorkspaceCollectionsById(primary.minedLeads, secondary.minedLeads, cumulativeTombstones),
      aiChatSessions: mergeWorkspaceCollectionsById(primary.aiChatSessions, secondary.aiChatSessions, cumulativeTombstones),
      aiActiveSessionId: primary.aiActiveSessionId || secondary.aiActiveSessionId,
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
  const canonicalAiDocId = getCanonicalAiCopilotDocId(cleanEmail, cleanUserId);

  await Promise.allSettled([
    // 1. Google Cloud Firestore (Global cross-device & cross-browser cloud authority)
    (async () => {
      if (!canonicalDocId) return;
      try {
        const fb = await getFirebaseRuntime();
        if (!fb) return;
        const docRef = fb.doc(fb.db, 'workspaces', canonicalDocId);
        const snap = await withTimeout(fb.getDoc(docRef), 1200);
        if (snap && snap.exists()) {
          const firestoreData = snap.data();
          if (firestoreData && typeof firestoreData === 'object') {
            queueCandidate(firestoreData, 'firestore-db');
          }
        }
      } catch {}
    })(),

    // 1b. Dedicated Google Cloud Firestore AI Outreach Copilot document
    (async () => {
      if (!canonicalAiDocId) return;
      try {
        const fb = await getFirebaseRuntime();
        if (!fb) return;
        const aiDocRef = fb.doc(fb.db, 'workspaces', canonicalAiDocId);
        const aiSnap = await withTimeout(fb.getDoc(aiDocRef), 1200);
        if (aiSnap && aiSnap.exists()) {
          const aiData = aiSnap.data();
          if (aiData && typeof aiData === 'object' && Array.isArray(aiData.aiChatSessions)) {
            queueCandidate(aiData, 'firestore-db');
          }
        }
      } catch {}
    })(),

    // 1c. Dedicated Backend AI Outreach Copilot endpoint
    (async () => {
      try {
        const qp = new URLSearchParams();
        if (cleanEmail) qp.set('email', cleanEmail);
        if (cleanUserId) qp.set('userId', cleanUserId);
        qp.set('_t', String(Date.now()));
        const resAi = await fetch(`/api/ai-copilot/sessions?${qp.toString()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
        const parsedAi = await safeParseResponse(resAi, 'AI Copilot fetch failed');
        if (parsedAi.ok && parsedAi.data?.success && Array.isArray(parsedAi.data?.aiChatSessions) && parsedAi.data.aiChatSessions.length > 0) {
          queueCandidate(
            {
              aiChatSessions: parsedAi.data.aiChatSessions,
              aiActiveSessionId: parsedAi.data.aiActiveSessionId,
              permanentlyDeletedIds: parsedAi.data.permanentlyDeletedIds,
              updatedAt: parsedAi.data.updatedAt
            },
            'backend-db'
          );
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
          queueCandidate(json.data, 'backend-db');
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
            queueCandidate(json2.data, 'backend-db');
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
          query.order('updated_at', { ascending: false }).limit(5) as any,
          2000
        )) as any;
        if (!supaErr && Array.isArray(supaRows) && supaRows.length > 0) {
          for (const row of supaRows) {
            if (row?.data) {
              const workspaceObj = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
              queueCandidate(workspaceObj, 'supabase-table');
            }
          }
        }
      } catch {}
    })()
  ]);

  if (cumulativeTombstones.size > 0) {
    try {
      const serialized = JSON.stringify(Array.from(cumulativeTombstones).slice(-5000));
      localStorage.setItem('visualsky_permanently_deleted_ids', serialized);
      localStorage.setItem('visualsky_deleted_imap_msgs', serialized);
    } catch {}
  }

  for (const item of rawCandidates) {
    considerCandidate(item.candidate, item.source);
  }

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
  const canonicalAiDocId = getCanonicalAiCopilotDocId(cleanEmail, cleanUserId);

  // 1. Save to Google Cloud Firestore (Real-time cross-device & cross-browser sync)
  const firestorePromise = (async () => {
    const fb = await getFirebaseRuntime();
    if (!fb) return false;
    let ok = false;
    if (canonicalDocId) {
      try {
        const cleanFirestorePayload = sanitizeForFirestore(payloadToSave);
        await fb.setDoc(fb.doc(fb.db, 'workspaces', canonicalDocId), cleanFirestorePayload);
        ok = true;
      } catch (err) {
        console.warn('Firestore workspace save warning:', err);
      }
    }
    if (canonicalAiDocId && Array.isArray(payloadToSave.aiChatSessions) && hasRealAiCopilotSessions(payloadToSave.aiChatSessions)) {
      try {
        await fb.setDoc(fb.doc(fb.db, 'workspaces', canonicalAiDocId), {
          email: cleanEmail,
          userId: cleanUserId,
          aiChatSessions: payloadToSave.aiChatSessions.slice(0, 50),
          aiActiveSessionId: payloadToSave.aiActiveSessionId || payloadToSave.aiChatSessions[0]?.id || '',
          permanentlyDeletedIds: (payloadToSave.permanentlyDeletedIds || []).slice(-1000),
          updatedAt: nowIso
        });
        ok = true;
      } catch {}
    }
    return ok;
  })();

  // 2. Supabase persistence (update all rows matching email + upsert canonical row)
  if (isSupabaseConfigured && supabase) {
    Promise.resolve().then(async () => {
      try {
        if (cleanEmail) {
          await supabase
            .from('user_workspaces')
            .update({
              data: payloadToSave,
              updated_at: nowIso
            })
            .ilike('email', cleanEmail);
        }
        const rowId = cleanUserId || canonicalDocId || `usr-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`;
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

  // 3. Save to Central Backend Database API immediately (only enable keepalive for payloads < 30KB to avoid browser 64KB keepalive TypeError)
  let backendSucceeded = false;
  let authoritativeUpdatedAt = nowIso;
  try {
    const bodyStr = JSON.stringify({
      userId: cleanUserId,
      email: cleanEmail,
      data: payloadToSave
    });
    const res = await fetch('/api/user-data/save', {
      method: 'POST',
      keepalive: bodyStr.length < 30000,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      },
      body: bodyStr
    });

    if (res.ok) {
      backendSucceeded = true;
      try {
        const json = await res.json();
        if (json?.savedAt) authoritativeUpdatedAt = json.savedAt;
      } catch {}
    } else {
      const fallbackId = cleanEmail || cleanUserId;
      if (fallbackId) {
        const fallbackBody = JSON.stringify({ data: payloadToSave });
        const res2 = await fetch(`/api/user-data/${encodeURIComponent(fallbackId)}`, {
          method: 'POST',
          keepalive: fallbackBody.length < 30000,
          headers: { 'Content-Type': 'application/json' },
          body: fallbackBody
        });
        if (res2.ok) {
          backendSucceeded = true;
          try {
            const json2 = await res2.json();
            if (json2?.savedAt) authoritativeUpdatedAt = json2.savedAt;
          } catch {}
        }
      }
    }
  } catch {}

  const firestoreSucceeded = await firestorePromise;

  return {
    success: backendSucceeded || firestoreSucceeded,
    updatedAt: authoritativeUpdatedAt
  };
}

/**
 * Dedicated fast persistence for AI Outreach Copilot sessions across all browsers and devices.
 * Persists simultaneously to localStorage, Central Backend (/api/ai-copilot/sessions), and Google Cloud Firestore (ws_aicopilot_<email>).
 */
export async function persistAiCopilotSessionsNow(params: {
  email?: string;
  userId?: string;
  sessions: any[];
  activeSessionId?: string;
  deletedIds?: string[];
}): Promise<boolean> {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanUserId = (params.userId || '').trim();
  const safeSessions = Array.isArray(params.sessions) ? params.sessions : [];
  const nowIso = new Date().toISOString();

  const tombstones = getLocalTombstones();
  if (Array.isArray(params.deletedIds)) {
    for (const id of params.deletedIds) {
      if (id) tombstones.add(String(id));
    }
  }
  const allDeleted = Array.from(tombstones).slice(-2000);

  const cleanSessions = safeSessions.filter(
    (s: any) => s && s.id && !tombstones.has(String(s.id)) && Array.isArray(s.messages) && s.messages.length > 0
  );
  const filteredSessions = hasRealAiCopilotSessions(cleanSessions)
    ? cleanSessions.filter((s: any) => !(String(s.id) === 'session-default' && isUntouchedDefaultAiSession(s)))
    : cleanSessions;

  const resolvedActiveId =
    params.activeSessionId && filteredSessions.some((s: any) => String(s.id) === params.activeSessionId)
      ? params.activeSessionId
      : filteredSessions[0]?.id || 'session-default';

  try {
    localStorage.setItem('visualsky_ai_chat_sessions', JSON.stringify(filteredSessions));
    if (cleanEmail) {
      localStorage.setItem(`visualsky_ai_chat_sessions_${cleanEmail}`, JSON.stringify(filteredSessions));
    }
    if (resolvedActiveId) {
      localStorage.setItem('visualsky_ai_active_session_id', resolvedActiveId);
      if (cleanEmail) {
        localStorage.setItem(`visualsky_ai_active_session_id_${cleanEmail}`, resolvedActiveId);
      }
    }
  } catch {}

  if (!cleanEmail && !cleanUserId) return false;

  const canonicalAiDocId = getCanonicalAiCopilotDocId(cleanEmail, cleanUserId);

  const [serverOk, firestoreOk] = await Promise.all([
    (async () => {
      try {
        const bodyStr = JSON.stringify({
          email: cleanEmail,
          userId: cleanUserId,
          aiChatSessions: filteredSessions,
          aiActiveSessionId: resolvedActiveId,
          permanentlyDeletedIds: allDeleted,
          updatedAt: nowIso
        });
        const res = await fetch('/api/ai-copilot/sessions', {
          method: 'POST',
          keepalive: bodyStr.length < 30000,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store'
          },
          body: bodyStr
        });
        return res.ok;
      } catch {
        return false;
      }
    })(),
    (async () => {
      if (!canonicalAiDocId) return false;
      try {
        const fb = await getFirebaseRuntime();
        if (!fb) return false;
        const cleanFirestoreSessions = JSON.parse(JSON.stringify(filteredSessions.slice(0, 50)));
        await fb.setDoc(fb.doc(fb.db, 'workspaces', canonicalAiDocId), {
          email: cleanEmail,
          userId: cleanUserId,
          aiChatSessions: cleanFirestoreSessions,
          aiActiveSessionId: resolvedActiveId,
          permanentlyDeletedIds: allDeleted.slice(-1000),
          updatedAt: nowIso
        });
        return true;
      } catch {
        return false;
      }
    })()
  ]);

  return serverOk || firestoreOk;
}

/**
 * Fetch and smart-merge AI Outreach Copilot sessions from Firestore + Backend + LocalStorage,
 * automatically pushing any unsynced local sessions to the cloud so other browsers/devices receive them immediately.
 */
export async function syncAiCopilotSessions(params: {
  email?: string;
  userId?: string;
  localSessions?: any[];
  activeSessionId?: string;
}): Promise<{
  sessions: any[];
  activeSessionId: string;
  updatedFromRemote: boolean;
}> {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanUserId = (params.userId || '').trim();
  const tombstones = getLocalTombstones();

  let remoteSessions: any[] = [];
  let remoteActiveId = '';
  const canonicalAiDocId = getCanonicalAiCopilotDocId(cleanEmail, cleanUserId);
  const canonicalWsDocId = getCanonicalWorkspaceDocId(cleanEmail, cleanUserId);

  const withFastTimeout = <T>(p: Promise<T>, ms = 1800): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);

  await Promise.allSettled([
    // 1. Dedicated Backend Endpoint
    (async () => {
      if (!cleanEmail && !cleanUserId) return;
      try {
        const qp = new URLSearchParams();
        if (cleanEmail) qp.set('email', cleanEmail);
        if (cleanUserId) qp.set('userId', cleanUserId);
        qp.set('_t', String(Date.now()));
        const res = await fetch(`/api/ai-copilot/sessions?${qp.toString()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
        const parsed = await safeParseResponse(res, 'AI Copilot sync failed');
        const data = parsed.data;
        if (parsed.ok && data?.success) {
          if (Array.isArray(data.permanentlyDeletedIds)) {
            for (const id of data.permanentlyDeletedIds) if (id) tombstones.add(String(id));
          }
          if (Array.isArray(data.aiChatSessions) && data.aiChatSessions.length > 0) {
            remoteSessions = mergeWorkspaceCollectionsById(data.aiChatSessions, remoteSessions, tombstones);
          }
          if (data.aiActiveSessionId && !remoteActiveId) {
            remoteActiveId = String(data.aiActiveSessionId);
          }
        }
      } catch {}
    })(),
    // 2. Dedicated Firestore AI Copilot Document
    (async () => {
      if (!canonicalAiDocId) return;
      try {
        const fb = await getFirebaseRuntime();
        if (!fb) return;
        const docRef = fb.doc(fb.db, 'workspaces', canonicalAiDocId);
        const snap = await withFastTimeout(fb.getDoc(docRef), 1200);
        if (snap && snap.exists()) {
          const d: any = snap.data();
          if (Array.isArray(d?.permanentlyDeletedIds)) {
            for (const id of d.permanentlyDeletedIds) if (id) tombstones.add(String(id));
          }
          if (Array.isArray(d?.aiChatSessions) && d.aiChatSessions.length > 0) {
            remoteSessions = mergeWorkspaceCollectionsById(d.aiChatSessions, remoteSessions, tombstones);
          }
          if (d?.aiActiveSessionId) {
            remoteActiveId = String(d.aiActiveSessionId);
          }
        }
      } catch {}
    })(),
    // 3. Full Firestore Workspace Document fallback
    (async () => {
      if (!canonicalWsDocId) return;
      try {
        const fb = await getFirebaseRuntime();
        if (!fb) return;
        const docRef = fb.doc(fb.db, 'workspaces', canonicalWsDocId);
        const snap = await withFastTimeout(fb.getDoc(docRef), 1500);
        if (snap && snap.exists()) {
          const d: any = snap.data();
          if (Array.isArray(d?.permanentlyDeletedIds)) {
            for (const id of d.permanentlyDeletedIds) if (id) tombstones.add(String(id));
          }
          if (Array.isArray(d?.aiChatSessions) && d.aiChatSessions.length > 0) {
            remoteSessions = mergeWorkspaceCollectionsById(remoteSessions, d.aiChatSessions, tombstones);
          }
          if (d?.aiActiveSessionId && !remoteActiveId) {
            remoteActiveId = String(d.aiActiveSessionId);
          }
        }
      } catch {}
    })()
  ]);

  const localList = Array.isArray(params.localSessions) ? params.localSessions : [];
  const merged = mergeWorkspaceCollectionsById(remoteSessions, localList, tombstones).filter(
    (s: any) => s && s.id && !tombstones.has(String(s.id)) && Array.isArray(s.messages) && s.messages.length > 0
  );

  // Count total messages across sessions to detect if local had unsynced messages not yet in remote
  const countMessages = (list: any[]) =>
    (Array.isArray(list) ? list : [])
      .filter((s: any) => s && !isUntouchedDefaultAiSession(s))
      .reduce((acc, s) => acc + (Array.isArray(s.messages) ? s.messages.length : 0), 0);

  const remoteMsgCount = countMessages(remoteSessions);
  const mergedMsgCount = countMessages(merged);

  const resolvedActiveId = (() => {
    if (
      remoteActiveId &&
      remoteActiveId !== 'session-default' &&
      merged.some((s: any) => String(s.id) === remoteActiveId)
    ) {
      return remoteActiveId;
    }
    if (
      params.activeSessionId &&
      params.activeSessionId !== 'session-default' &&
      merged.some((s: any) => String(s.id) === params.activeSessionId)
    ) {
      return params.activeSessionId;
    }
    const firstReal = merged.find((s: any) => !isUntouchedDefaultAiSession(s));
    if (firstReal) return String(firstReal.id);
    return merged[0]?.id || params.activeSessionId || 'session-default';
  })();

  // If this browser had real sessions/messages that were missing on the remote server/Firestore, push them now!
  if (mergedMsgCount > remoteMsgCount && hasRealAiCopilotSessions(merged)) {
    persistAiCopilotSessionsNow({
      email: cleanEmail,
      userId: cleanUserId,
      sessions: merged,
      activeSessionId: resolvedActiveId,
      deletedIds: Array.from(tombstones)
    }).catch(() => {});
  }

  return {
    sessions: merged,
    activeSessionId: resolvedActiveId,
    updatedFromRemote: merged.length > 0
  };
}

/**
 * Real-time Firestore listener specifically for AI Outreach Copilot sessions (< 100ms cross-browser & cross-device push).
 */
export function subscribeToAiCopilotSessions(
  identifiers: { email?: string; userId?: string },
  onUpdate: (payload: { aiChatSessions: any[]; aiActiveSessionId?: string; permanentlyDeletedIds?: string[] }) => void
): () => void {
  const docId = getCanonicalAiCopilotDocId(identifiers.email, identifiers.userId);
  if (!docId) return () => {};

  let cancelled = false;
  let unsubscribe = () => {};

  getFirebaseRuntime()
    .then((fb) => {
      if (cancelled || !fb) return;
      try {
        const docRef = fb.doc(fb.db, 'workspaces', docId);
        unsubscribe = fb.onSnapshot(
          docRef,
          (snap: any) => {
            if (!snap.exists()) return;
            const d: any = snap.data();
            if (d && Array.isArray(d.aiChatSessions)) {
              onUpdate({
                aiChatSessions: d.aiChatSessions,
                aiActiveSessionId: d.aiActiveSessionId,
                permanentlyDeletedIds: d.permanentlyDeletedIds
              });
            }
          },
          () => {}
        );
      } catch {}
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    try {
      unsubscribe();
    } catch {}
  };
}
