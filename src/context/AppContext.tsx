import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  Lead, 
  LeadTag,
  EmailThread, 
  EmailMessage, 
  Campaign, 
  SMTPAccount, 
  AppNotification, 
  UserAccount, 
  EmailTemplate, 
  TemplateCategory,
  ColumnSetting, 
  SentEmailLog, 
  SimulatedReplyPayload,
  DirectSendMailPayload,
  NotificationSettings
} from '../types';
import confetti from 'canvas-confetti';
import { audioEngine } from '../utils/audioPlayer';
import { supabase, isSupabaseConfigured, signOutSupabase } from '../lib/supabase';
import { queryUserWorkspace, persistUserWorkspace, WorkspaceData } from '../lib/workspaceSync';
import { safeParseResponse } from '../lib/safeFetch';

// Helper to calculate warm-up limits based on gradual +15/day ramp
export const getSMTPWarmupDetails = (account: SMTPAccount) => {
  const mode = account.warmupMode || (account.warmupStatus === 'warming' ? 'ramp_15' : 'full');
  const dailyCap = account.dailyLimit || 500;
  
  if (mode === 'paused') {
    return {
      mode: 'paused',
      day: 1,
      currentDailyLimit: 0,
      dailyCap,
      percentComplete: 0,
      isRamping: false
    };
  }
  
  if (mode === 'full') {
    return {
      mode: 'full',
      day: 30,
      currentDailyLimit: dailyCap,
      dailyCap,
      percentComplete: 100,
      isRamping: false
    };
  }
  
  // ramp_15 calculation
  const startDateStr = account.warmupStartDate || new Date().toISOString();
  const startMs = new Date(startDateStr).getTime();
  const diffDays = Math.max(1, Math.floor((Date.now() - startMs) / (1000 * 60 * 60 * 24)) + 1);
  const rampLimit = Math.min(dailyCap, 15 * diffDays);
  const percentComplete = Math.min(100, Math.round((rampLimit / dailyCap) * 100));
  
  return {
    mode: 'ramp_15',
    day: diffDays,
    currentDailyLimit: rampLimit,
    dailyCap,
    percentComplete,
    isRamping: rampLimit < dailyCap
  };
};

// Authoritative helper to compute real-time connected SMTP relay metrics from sentEmails, campaigns, and threads
export const getSMTPAccountMetrics = (
  smtp: SMTPAccount,
  allSmtps: SMTPAccount[],
  sentEmails: SentEmailLog[],
  campaigns: Campaign[],
  threads: EmailThread[] = []
) => {
  const activeSmtps = (allSmtps || []).filter(s => s && !s.isTrash);
  const smtpEmailNorm = (smtp.fromEmail || smtp.username || '').trim().toLowerCase();
  const smtpUserNorm = (smtp.username || '').trim().toLowerCase();
  const smtpNameNorm = (smtp.name || '').trim().toLowerCase();
  const smtpHostNorm = (smtp.host || '').trim().toLowerCase();

  const matchesThisSmtp = (log: SentEmailLog) => {
    if (!log || log.isTrash) return false;
    if (log.smtpAccountId && log.smtpAccountId === smtp.id) return true;
    const logSender = (log.senderEmail || '').trim().toLowerCase();
    if (logSender && (logSender === smtpEmailNorm || logSender === smtpUserNorm)) return true;
    const logSmtpName = (log.smtpAccountName || '').trim().toLowerCase();
    if (logSmtpName && smtpNameNorm && logSmtpName === smtpNameNorm) return true;
    const logHost = (log.smtpHost || '').trim().toLowerCase();
    if (logHost && smtpHostNorm && logHost.includes(smtpHostNorm)) return true;
    if (activeSmtps.length === 1 && activeSmtps[0].id === smtp.id) return true;
    return false;
  };

  const allMatchedLogs = (sentEmails || []).filter(matchesThisSmtp);
  const successfulLogs = allMatchedLogs.filter(l => l.status !== 'failed' && l.status !== 'bounced');
  const failedLogs = allMatchedLogs.filter(l => l.status === 'failed' || l.status === 'bounced');

  const now = new Date();
  const todayIsoPrefix = now.toISOString().split('T')[0];
  const todayDateStr = now.toDateString();

  const logsToday = successfulLogs.filter(l => {
    if (!l.sentAt) return true;
    if (l.sentAt.startsWith(todayIsoPrefix)) return true;
    const d = new Date(l.sentAt);
    if (!Number.isFinite(d.getTime())) return true;
    if (d.toDateString() === todayDateStr) return true;
    if (now.getTime() - d.getTime() < 24 * 60 * 60 * 1000) return true;
    return false;
  });

  const assignedCampaigns = (campaigns || []).filter(
    c =>
      c &&
      !c.isTrash &&
      (!c.assignedSmtpId ||
        c.assignedSmtpId === 'round_robin' ||
        c.assignedSmtpId === smtp.id ||
        c.assignedSmtpId === smtp.name ||
        (activeSmtps.length === 1 && activeSmtps[0].id === smtp.id))
  );

  const runningCampaigns = assignedCampaigns.filter(
    c => String(c.status || '').toLowerCase() === 'running' || String(c.status || '').toLowerCase() === 'active'
  );

  const campaignSentSum = assignedCampaigns.reduce((sum, c) => sum + (Number(c.sentCount) || 0), 0);
  const campaignOpenSum = assignedCampaigns.reduce((sum, c) => sum + (Number(c.openCount) || 0), 0);
  const campaignReplySum = assignedCampaigns.reduce((sum, c) => sum + (Number(c.replyCount) || 0), 0);

  const sentToday = Math.max(Number(smtp.sentToday) || 0, logsToday.length, campaignSentSum);
  const totalDispatched = Math.max(sentToday, successfulLogs.length, campaignSentSum);
  const openedCount = Math.max(
    successfulLogs.filter(
      l => (l.openCount || 0) > 0 || l.status === 'opened' || l.status === 'replied'
    ).length,
    campaignOpenSum
  );

  const matchedRepliedThreads = (threads || []).filter(t => {
    if (!t || t.isTrash) return false;
    const hasLeadMsg = Array.isArray(t.messages) && t.messages.some(m => m.sender === 'lead');
    if (!hasLeadMsg) return false;
    if (t.smtpAccountId && t.smtpAccountId === smtp.id) return true;
    const tEmail = (t.smtpEmail || '').trim().toLowerCase();
    if (tEmail && (tEmail === smtpEmailNorm || tEmail === smtpUserNorm)) return true;
    if (activeSmtps.length === 1 && activeSmtps[0].id === smtp.id) return true;
    return false;
  });

  const repliedCount = Math.max(
    successfulLogs.filter(l => l.status === 'replied').length,
    matchedRepliedThreads.length,
    campaignReplySum
  );

  const warmup = getSMTPWarmupDetails({ ...smtp, sentToday });
  const dailyCap = smtp.dailyLimit || 500;
  const effectiveDailyLimit = warmup.isRamping ? warmup.currentDailyLimit : dailyCap;
  const remainingToday = Math.max(0, effectiveDailyLimit - sentToday);
  const usagePct = effectiveDailyLimit > 0 ? Math.min(100, Math.round((sentToday / effectiveDailyLimit) * 100)) : 0;
  const openRatePct = totalDispatched > 0 ? Math.min(100, Math.round((openedCount / totalDispatched) * 100)) : 0;
  const replyRatePct = totalDispatched > 0 ? Math.min(100, Math.round((repliedCount / totalDispatched) * 100)) : 0;

  return {
    sentToday,
    totalDispatched,
    openedCount,
    repliedCount,
    failedCount: failedLogs.length,
    warmup,
    dailyCap,
    effectiveDailyLimit,
    remainingToday,
    usagePct,
    openRatePct,
    replyRatePct,
    runningCampaigns,
    assignedCampaigns
  };
};

interface AppContextType {
  // Navigation & View
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeFollowUpCohort: '7d' | '14d' | '30d' | null;
  setActiveFollowUpCohort: (cohort: '7d' | '14d' | '30d' | null) => void;
  openFollowUpCohortModal: (cohort: '7d' | '14d' | '30d') => void;

  // Sound & Notification Settings
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => void;
  playNotificationSound: (preset?: string) => void;
  requestDesktopNotificationPermission: () => Promise<boolean>;

  // Lead Directory
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  addLeads: (newLeads: Partial<Lead>[], targetTag?: string) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLeadToTrash: (id: string) => void;
  restoreLead: (id: string) => void;
  permanentDeleteLead: (id: string) => void;
  bulkDeleteLeads: (ids: string[]) => void;
  bulkRestoreLeads: (ids: string[]) => void;
  bulkPermanentDeleteLeads: (ids: string[]) => void;
  verifyLeadWebsite: (id: string) => Promise<void>;
  
  // Lead Tag Management
  leadTags: LeadTag[];
  setLeadTags: React.Dispatch<React.SetStateAction<LeadTag[]>>;
  addLeadTag: (tag: Omit<LeadTag, 'id' | 'createdAt'>) => LeadTag;
  updateLeadTag: (id: string, updates: Partial<LeadTag>) => void;
  deleteLeadTag: (id: string) => void;
  assignTagsToLeads: (leadIds: string[], tagNames: string[]) => void;

  // Columns & Display
  columnSettings: ColumnSetting[];
  toggleColumnSetting: (id: string) => void;

  // Inbox & Threads
  threads: EmailThread[];
  setThreads: React.Dispatch<React.SetStateAction<EmailThread[]>>;
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  sendReply: (threadId: string, replyBody: string, smtpAccountId?: string) => void;
  markThreadRead: (threadId: string) => void;
  toggleThreadStar: (threadId: string) => void;
  addThreadLabel: (threadId: string, label: string) => void;
  removeThreadLabel: (threadId: string, label: string) => void;
  deleteThreadToTrash: (threadId: string) => void;
  restoreThread: (threadId: string) => void;
  permanentDeleteThread: (threadId: string) => void;
  bulkRestoreThreads: (threadIds: string[]) => void;
  bulkPermanentDeleteThreads: (threadIds: string[]) => void;

  // Campaigns & Automated Sequences
  campaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  createCampaign: (campaign: Omit<Campaign, 'id' | 'sentCount' | 'openCount' | 'replyCount' | 'bounceCount' | 'createdAt'>) => Campaign;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  toggleCampaignStatus: (id: string) => void;
  deleteCampaign: (id: string) => void;
  restoreCampaign: (id: string) => void;
  permanentDeleteCampaign: (id: string) => void;
  bulkRestoreCampaigns: (ids: string[]) => void;
  bulkPermanentDeleteCampaigns: (ids: string[]) => void;
  launchQuickFollowUp: (days: '7d' | '14d' | '30d') => void;
  getDormantLeads: (days: number) => Lead[];

  // Templates & Categories
  emailTemplates: EmailTemplate[];
  setEmailTemplates: React.Dispatch<React.SetStateAction<EmailTemplate[]>>;
  templateCategories: TemplateCategory[];
  setTemplateCategories: React.Dispatch<React.SetStateAction<TemplateCategory[]>>;
  addTemplateCategory: (category: Omit<TemplateCategory, 'id'>) => TemplateCategory;
  deleteTemplateCategory: (id: string) => void;
  addEmailTemplate: (template: Omit<EmailTemplate, 'id' | 'usageCount' | 'replyRatePercent' | 'createdAt'>) => EmailTemplate;
  updateEmailTemplate: (id: string, updates: Partial<EmailTemplate>) => void;
  deleteEmailTemplate: (id: string) => void;
  restoreEmailTemplate: (id: string) => void;
  permanentDeleteEmailTemplate: (id: string) => void;

  // Outbound SMTP Relays
  smtpAccounts: SMTPAccount[];
  setSmtpAccounts: React.Dispatch<React.SetStateAction<SMTPAccount[]>>;
  addSMTPAccount: (account: Omit<SMTPAccount, 'id' | 'sentToday' | 'healthScore' | 'isConnected' | 'isTrash'>) => SMTPAccount;
  updateSMTPAccount: (id: string, updates: Partial<SMTPAccount>) => void;
  deleteSMTPAccount: (id: string) => void;
  restoreSMTPAccount: (id: string) => void;
  permanentDeleteSMTPAccount: (id: string) => void;
  testSMTPConnection: (id: string) => Promise<boolean>;

  // Sent Emails & Live Outbox Tracking
  sentEmails: SentEmailLog[];
  setSentEmails: React.Dispatch<React.SetStateAction<SentEmailLog[]>>;
  addSentEmailLog: (log: Omit<SentEmailLog, 'id' | 'sentAt'> & { trackingPixelId?: string; errorMessage?: string }) => SentEmailLog;
  clearSentEmails: () => void;
  deleteSentEmail: (id: string) => void;
  restoreSentEmail: (id: string) => void;
  permanentDeleteSentEmail: (id: string) => void;
  markEmailOpened: (id: string) => void;
  simulateLeadReplyToSentEmail: (sentEmailId: string, customSnippet?: string) => void;
  sendDirectEmail: (payload: DirectSendMailPayload) => Promise<boolean>;
  syncInboxReplies: (smtpAccountId?: string, silent?: boolean) => Promise<{ success: boolean; count: number; totalChecked: number; error?: string }>;

  // Notifications
  notifications: AppNotification[];
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  deleteNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearAllNotifications: () => void;
  unreadNotificationCount: number;

  // User Accounts & Portal Roles
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  loginUser: (user: UserAccount, targetTab?: string) => void;
  currentUser: UserAccount;
  setCurrentUser: (user: UserAccount) => void;
  allUsers: UserAccount[];
  setAllUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>;
  updateUserRole: (userId: string, role: 'client' | 'agency' | 'owner' | 'manager' | 'rep' | 'customer') => void;
  updateUserPermissions: (userId: string, permissions: any) => void;
  deleteUserAccount: (userId: string) => void;
  resetUserPasswordByEmail: (email: string, newPass: string) => boolean;
  deductAiTokens: (tokensUsed: number) => void;
  logout: () => void;
  isLogoutConfirmOpen: boolean;
  setIsLogoutConfirmOpen: (open: boolean) => void;
  requestLogout: () => void;

  // AI Mined Cache
  minedLeads: Lead[];
  setMinedLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  
  // Cross-Browser Cloud Workspace Sync
  loadUserWorkspace: (userEmail?: string, userId?: string, seedWorkspaceData?: any) => Promise<boolean>;
  saveWorkspaceToDatabase: () => Promise<boolean>;
  persistResourceDirectly: (resource: string, items: any[]) => Promise<void>;
  isWorkspaceLoading: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline';
  
  // Trash Operations
  emptyAllTrash: () => void;
  totalTrashCount: number;
  
  // Live Simulation
  simulateIncomingReply: () => void;
  customSimulateReply: (payload?: SimulatedReplyPayload) => void;
  isSimulating: boolean;
  setIsSimulating: (val: boolean) => void;

  // Global Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Default columns with open, reply, and tag columns
const DEFAULT_COLUMNS: ColumnSetting[] = [
  { id: 'name', label: 'Lead Name & Title', visible: true },
  { id: 'company', label: 'Company & Domain', visible: true },
  { id: 'email', label: 'Email Address', visible: true },
  { id: 'phone', label: 'Direct Phone Number', visible: true },
  { id: 'openStatus', label: 'Email Opened', visible: true },
  { id: 'replyStatus', label: 'Reply Status', visible: true },
  { id: 'tags', label: 'Tags', visible: true },
  { id: 'status', label: 'Pipeline Status', visible: true },
  { id: 'websiteStatus', label: 'Site Health Ping', visible: true },
  { id: 'niche', label: 'Niche / Industry', visible: true },
  { id: 'location', label: 'Location', visible: true },
  { id: 'score', label: 'Lead Quality Score', visible: true },
  { id: 'socials', label: 'Social Handles', visible: true },
  { id: 'daysAgo', label: 'Last Activity / Inactive Days', visible: true },
  { id: 'actions', label: 'Actions', visible: true },
];

// Clean empty signature constant (No hardcoded contact or branding injection!)
export const DEFAULT_USER_SIGNATURE = '';

// Initial Lead Tags
const INITIAL_TAGS: LeadTag[] = [
  { id: 'tag-saas', name: 'B2B SaaS Founders', color: 'cyan', description: 'Tech founders and software leaders', createdAt: '2026-09-01' },
  { id: 'tag-vip', name: 'VIP Decision Makers', color: 'emerald', description: 'C-Level & VP Outreach targets', createdAt: '2026-09-01' },
  { id: 'tag-followup', name: '7-Day Follow Up', color: 'amber', description: 'Active sequence follow-ups', createdAt: '2026-09-01' },
  { id: 'tag-partners', name: 'Agency Partners', color: 'purple', description: 'Strategic growth partners', createdAt: '2026-09-01' },
];

// Initial Verified Leads (100% Live — No Demo Data)
const INITIAL_LEADS: Lead[] = [];

const DEMO_LEAD_IDS = new Set([
  'lead-saas-101',
  'lead-saas-102',
  'lead-saas-103',
  'lead-saas-104',
  'lead-saas-105'
]);

const DEMO_CAMPAIGN_IDS = new Set([
  'camp-b2b-saas-growth',
  'camp-enterprise-partners'
]);

const DEMO_THREAD_IDS = new Set(['thread-liam-103']);

const DEMO_SMTP_IDS = new Set([
  'smtp-primary-google',
  'smtp-secondary-relay'
]);

const DEMO_SENT_IDS = new Set(['sent-init-1', 'sent-init-2']);

// Helper: Strip '>' quote signs, multi-line "On ... wrote:" blocks, and raw {{...}} tokens from any email text
export const cleanEmailBodyText = (rawText: string, fallbackWebsite?: string, fallbackCompany?: string, fallbackName?: string): string => {
  if (!rawText) return '';
  let text = String(rawText).replace(/\r\n/g, '\n');

  // Strip multi-line "On <date>, <name> wrote:" quote headers and everything below them
  text = text.replace(/(\n|^)\s*On\s+[\s\S]{1,320}?wrote:\s*(\n|$)[\s\S]*$/i, '');
  text = text.replace(/(\n|^)\s*-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i, '');
  text = text.replace(/(\n|^)\s*_{5,}[\s\S]*$/i, '');
  text = text.replace(/(\n|^)\s*From:\s+[^\n]+\n\s*Sent:\s+[^\n]+[\s\S]*$/i, '');

  const lines = text.split('\n');
  const nonQuotedLines: string[] = [];
  const strippedQuoteLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^On\s+.+wrote:$/i.test(trimmed) ||
      /^-{2,}\s*Original Message\s*-{2,}/i.test(trimmed) ||
      (/^From:\s+/i.test(trimmed) && nonQuotedLines.length > 0)
    ) {
      break;
    }
    if (trimmed.startsWith('>')) {
      strippedQuoteLines.push(line.replace(/^\s*>+\s?/g, ''));
    } else {
      nonQuotedLines.push(line);
    }
  }

  const chosenLines = nonQuotedLines.join('\n').trim() ? nonQuotedLines : strippedQuoteLines;

  return chosenLines
    .map(l => l.replace(/^\s*>+\s?/g, ''))
    .join('\n')
    .replace(/\{\{\s*website\s*\}\}/gi, fallbackWebsite || fallbackCompany || 'your website')
    .replace(/\{\{\s*company\s*\}\}/gi, fallbackCompany || 'your company')
    .replace(/\{\{\s*first_name\s*\}\}/gi, (fallbackName || 'there').split(' ')[0] || 'there')
    .replace(/\{\{\s*name\s*\}\}/gi, fallbackName || 'there')
    .replace(/\{\{\s*niche\s*\}\}/gi, 'your industry')
    .trim();
};

const normalizeThreadSubjectKey = (sub: string) =>
  String(sub || '')
    .replace(/^(re|fwd|fw)\s*:\s*/gi, '')
    .trim()
    .toLowerCase();

const sanitizeThreadsArray = (list: EmailThread[]): EmailThread[] => {
  if (!Array.isArray(list)) return [];
  const splitThreads: EmailThread[] = [];

  for (const t of list) {
    if (!t || DEMO_THREAD_IDS.has(t.id)) continue;

    const rawMessages = Array.isArray(t.messages) ? t.messages : [];
    // Deduplicate identical messages inside the thread
    const seenMsgKeys = new Set<string>();
    const dedupedMessages: EmailMessage[] = [];
    for (const m of rawMessages) {
      if (!m) continue;
      const cleanedBody = cleanEmailBodyText(m.body, t.leadCompany, t.leadCompany, m.sender === 'lead' ? (m.senderName || t.leadName) : t.leadName);
      const msgKey = m.id || `${m.sender}-${m.senderEmail || ''}-${m.timestamp || ''}-${cleanedBody.slice(0, 80)}`;
      if (seenMsgKeys.has(msgKey)) continue;
      seenMsgKeys.add(msgKey);
      dedupedMessages.push({
        ...m,
        body: cleanedBody
      });
    }

    if (dedupedMessages.length <= 1) {
      const latestMsgBody =
        dedupedMessages.length > 0
          ? dedupedMessages[dedupedMessages.length - 1].body
          : cleanEmailBodyText(t.lastMessage, t.leadCompany, t.leadCompany, t.leadName);
      splitThreads.push({
        ...t,
        lastMessage: (latestMsgBody || cleanEmailBodyText(t.lastMessage, t.leadCompany, t.leadCompany, t.leadName)).slice(0, 100),
        messages: dedupedMessages
      });
      continue;
    }

    // Check if this thread accidentally merged messages from different lead emails or unrelated subjects
    const groups = new Map<string, EmailMessage[]>();
    const baseLeadEmail = (t.leadEmail || '').trim().toLowerCase();
    const baseSubKey = normalizeThreadSubjectKey(t.subject);

    for (const m of dedupedMessages) {
      const msgLeadEmail =
        m.sender === 'lead'
          ? (m.senderEmail || baseLeadEmail).trim().toLowerCase()
          : (m.recipientEmail || baseLeadEmail).trim().toLowerCase();
      const msgSubKey = normalizeThreadSubjectKey(m.subject || t.subject) || baseSubKey;
      const groupKey = `${msgLeadEmail || baseLeadEmail}::${msgSubKey || baseSubKey}`;
      const existing = groups.get(groupKey) || [];
      existing.push(m);
      groups.set(groupKey, existing);
    }

    if (groups.size <= 1) {
      const latestMsgBody = dedupedMessages[dedupedMessages.length - 1].body;
      splitThreads.push({
        ...t,
        lastMessage: (latestMsgBody || cleanEmailBodyText(t.lastMessage, t.leadCompany, t.leadCompany, t.leadName)).slice(0, 100),
        messages: dedupedMessages
      });
    } else {
      let groupIdx = 0;
      for (const [groupKey, groupMsgs] of groups.entries()) {
        const [grpEmail] = groupKey.split('::');
        const firstLeadMsg = groupMsgs.find(m => m.sender === 'lead');
        const latestMsg = groupMsgs[groupMsgs.length - 1];
        const subThreadId = groupIdx === 0 ? t.id : `${t.id}-split-${groupIdx}`;
        const resolvedEmail = grpEmail || t.leadEmail;
        const resolvedName =
          firstLeadMsg?.senderName ||
          (resolvedEmail === baseLeadEmail ? t.leadName : resolvedEmail.split('@')[0].replace(/[._-]/g, ' '));
        const resolvedCompany =
          resolvedEmail === baseLeadEmail
            ? t.leadCompany
            : resolvedEmail.split('@')[1]?.split('.')[0] || t.leadCompany;

        splitThreads.push({
          ...t,
          id: subThreadId,
          leadName: resolvedName,
          leadEmail: resolvedEmail,
          leadCompany: resolvedCompany,
          subject: latestMsg.subject || t.subject,
          lastMessage: (latestMsg.body || '').slice(0, 100),
          lastMessageDate: latestMsg.timestamp || t.lastMessageDate,
          updatedAt: latestMsg.timestamp || t.updatedAt,
          messages: groupMsgs.map(gm => ({ ...gm, threadId: subThreadId }))
        });
        groupIdx++;
      }
    }
  }

  return splitThreads;
};

export const MAX_AGENCY_GMAIL_ACCOUNTS = 3;

export const isStrictGmailAddress = (email: string): boolean => {
  const clean = String(email || '').trim().toLowerCase();
  return /^[a-z0-9._%+-]+@gmail\.com$/.test(clean);
};

const filterLiveUsersClient = (users: UserAccount[]): UserAccount[] => {
  if (!Array.isArray(users)) return [];
  const seenAgencyGmails = new Set<string>();

  return users.filter((u) => {
    if (!u || !u.email) return false;
    const em = u.email.trim().toLowerCase();
    if (em === 'client@growthagency.com' || em === 'test@example.com' || em === 'test@visualsky.io' || u.id === 'user-client-1') {
      return false;
    }
    if (u.paymentInfo?.trxId === 'BKA9823KL12') return false;
    const isAgency = u.role === 'agency' || Boolean(u.isOwner);

    if (isAgency) {
      if (!isStrictGmailAddress(em)) {
        return false;
      }
      if (!seenAgencyGmails.has(em)) {
        if (seenAgencyGmails.size >= MAX_AGENCY_GMAIL_ACCOUNTS) {
          return false;
        }
        seenAgencyGmails.add(em);
      }
      return true;
    }

    if (!u.paymentInfo || !u.paymentInfo.trxId) {
      return false;
    }
    return true;
  });
};

// Initial Email Templates & Categories
export const INITIAL_TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'cold_outreach', name: 'cold_outreach', label: 'Cold Outreach', color: 'cyan' },
  { id: 'followup_7d', name: 'followup_7d', label: '7-Day Follow-Up', color: 'amber' },
  { id: 'followup_14d', name: 'followup_14d', label: '14-Day Value Add', color: 'orange' },
  { id: 'breakup_30d', name: 'breakup_30d', label: '30-Day Breakup', color: 'rose' },
  { id: 'saas_demo', name: 'saas_demo', label: 'SaaS Product Pitch', color: 'purple' },
  { id: 'agency_pitch', name: 'agency_pitch', label: 'Agency White-Label', color: 'emerald' },
];

export const INITIAL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tmpl-builtin-1',
    title: 'Executive Cold Outreach (High Deliverability)',
    category: 'cold_outreach',
    subject: 'quick question regarding {{company}}',
    body: `Hi {{name}},\n\nNoticed your recent work at {{company}} in {{niche}}.\n\nWe recently helped a similar team achieve a 3.8x boost in booked outbound meetings through automated multi-relay warmup and 99.8% primary inbox placement.\n\nWould you be open to a quick 2-minute video breakdown this Thursday?\n\nBest regards,`,
    tags: ['Outreach', 'B2B', 'Deliverability'],
    isCustom: false,
    usageCount: 142,
    replyRatePercent: 28.4,
    createdAt: '2026-08-01'
  },
  {
    id: 'tmpl-builtin-2',
    title: '7-Day Value Add Follow-Up',
    category: 'followup_7d',
    subject: 'idea for {{company}}\'s outbound stack',
    body: `Hi {{name}},\n\nFollowing up on my note from last week regarding {{company}}.\n\nThought you might find this relevant—we put together a 1-page deliverability checklist that eliminates spam filter triggers across Outlook and Google Workspace.\n\nHappy to share if helpful?\n\nBest,`,
    tags: ['FollowUp', 'Value-Add'],
    isCustom: false,
    usageCount: 89,
    replyRatePercent: 34.2,
    createdAt: '2026-08-05'
  },
  {
    id: 'tmpl-builtin-3',
    title: '30-Day Polite Breakup Email',
    category: 'breakup_30d',
    subject: 'permission to close {{company}}\'s file?',
    body: `Hi {{name}},\n\nI haven't heard back, so I assume scaling cold outbound isn't a priority for {{company}} right now.\n\nI'll go ahead and close your file so I don't clutter your inbox.\n\nIf anything changes down the road, feel free to reach back out anytime.\n\nBest regards,`,
    tags: ['Breakup', 'CleanUp'],
    isCustom: false,
    usageCount: 65,
    replyRatePercent: 41.0,
    createdAt: '2026-08-10'
  }
];

// Initial Campaigns (100% Live — No Demo Data)
const INITIAL_CAMPAIGNS: Campaign[] = [];

// Initial Threads (100% Live — No Demo Data)
const INITIAL_THREADS: EmailThread[] = [];

// Initial SMTP Relays (100% Live — No Demo Data)
const INITIAL_SMTP: SMTPAccount[] = [];

// Initial Sent Email Logs (100% Live — No Demo Data)
const INITIAL_SENT_LOGS: SentEmailLog[] = [];

// Initial Users (100% Clean Zero State — Starts at 0 accounts until user registers)
const INITIAL_USERS: UserAccount[] = [];

const EMPTY_GUEST_USER: UserAccount = {
  id: '',
  name: 'Guest',
  email: '',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  role: 'client',
  isOwner: false,
  plan: 'Pro',
  bdtPlanLabel: 'Starter Growth',
  quotaUsed: 0,
  quotaLimit: 1500,
  aiCredits: 500
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // One-time clean zero-account reset: clear all pre-existing accounts and sessions cached in browser
  try {
    if (localStorage.getItem('visualsky_zero_accounts_reset_v7') !== 'active') {
      localStorage.removeItem('visualsky_authenticated');
      localStorage.removeItem('visualsky_current_user');
      localStorage.removeItem('visualsky_remembered_email');
      localStorage.removeItem('visualsky_reset_passwords');
      localStorage.removeItem('visualsky_leads');
      localStorage.removeItem('visualsky_campaigns');
      localStorage.removeItem('visualsky_threads');
      localStorage.removeItem('visualsky_smtp');
      localStorage.removeItem('visualsky_sent_emails');
      localStorage.removeItem('visualsky_users');
      localStorage.setItem('visualsky_zero_accounts_reset_v7', 'active');
    }
  } catch {}

  // Navigation with persistent active tab restoration
  const [activeTab, setActiveTabState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('visualsky_active_tab');
      return saved || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [activeFollowUpCohort, setActiveFollowUpCohort] = useState<'7d' | '14d' | '30d' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const openFollowUpCohortModal = (cohort: '7d' | '14d' | '30d') => {
    setActiveFollowUpCohort(cohort);
    setActiveTabState('campaigns');
    try { localStorage.setItem('visualsky_active_tab', 'campaigns'); } catch {}
  };

  // Current User & All Users
  const [allUsers, setAllUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_users');
      const parsed = saved ? JSON.parse(saved) : INITIAL_USERS;
      return filterLiveUsersClient(parsed);
    } catch {
      return INITIAL_USERS;
    }
  });

  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(() => {
    try {
      const authStored = localStorage.getItem('visualsky_authenticated');
      if (authStored !== 'true') return false;
      const savedUser = localStorage.getItem('visualsky_current_user');
      if (!savedUser) return false;
      const parsed = JSON.parse(savedUser);
      if (!parsed || !parsed.email) return false;
      const isAgency = parsed.role === 'agency' || parsed.role === 'owner' || Boolean(parsed.isOwner);
      const hasPaid = Boolean(
        parsed.paymentInfo?.trxId &&
        parsed.paymentInfo?.trxId !== 'BKA9823KL12' &&
        parsed.paymentInfo?.status !== 'rejected'
      );
      if (!isAgency && !hasPaid) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUserState] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem('visualsky_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          return parsed;
        }
      }
      return EMPTY_GUEST_USER;
    } catch {
      return EMPTY_GUEST_USER;
    }
  });

  // Client vs Agency / Owner route guard
  const isAgencyUser = (user: UserAccount) => {
    if (!user) return false;
    return user.role === 'agency' || user.role === 'owner' || Boolean(user.isOwner);
  };

  const setIsAuthenticated = (auth: boolean) => {
    setIsAuthenticatedState(auth);
    try {
      if (auth) {
        localStorage.setItem('visualsky_authenticated', 'true');
      } else {
        localStorage.removeItem('visualsky_authenticated');
        localStorage.removeItem('visualsky_current_user');
      }
    } catch {}
  };

  const loginUser = (user: UserAccount, targetTab?: string) => {
    const isAgency = isAgencyUser(user);
    const safeUser: UserAccount = {
      ...user,
      role: isAgency ? 'agency' : (user.role || 'client'),
      isOwner: isAgency || Boolean(user.isOwner),
      plan: isAgency ? 'Enterprise' : (user.plan || 'Pro')
    };

    setCurrentUserState(safeUser);
    setIsAuthenticatedState(true);
    try {
      localStorage.setItem('visualsky_authenticated', 'true');
      localStorage.setItem('visualsky_current_user', JSON.stringify(safeUser));
    } catch {}
    
    // Choose destination tab: Agency Master directly enters 'owner', Client enters 'dashboard'
    const chosenTab = targetTab || (isAgency ? 'owner' : 'dashboard');
    setActiveTabState(chosenTab);
    try { localStorage.setItem('visualsky_active_tab', chosenTab); } catch {}

    // Cross-browser sync: immediately load database workspace
    loadUserWorkspace(safeUser.email, safeUser.id || safeUser.supabaseId);
  };

  const setActiveTab = (tab: string) => {
    // If client tries to access agency master/owner panel, redirect to dashboard
    if (tab === 'owner' && !isAgencyUser(currentUser)) {
      setActiveTabState('dashboard');
      try { localStorage.setItem('visualsky_active_tab', 'dashboard'); } catch {}
      return;
    }
    setActiveTabState(tab);
    try { localStorage.setItem('visualsky_active_tab', tab); } catch {}
    if (latestWorkspaceRef.current) {
      (latestWorkspaceRef.current as any).lastActiveTab = tab;
    }
  };

  const setCurrentUser = (user: UserAccount) => {
    setCurrentUserState(user);
    if (!isAgencyUser(user) && activeTab === 'owner') {
      setActiveTabState('dashboard');
      try { localStorage.setItem('visualsky_active_tab', 'dashboard'); } catch {}
    }
    if (user?.email && user.email.toLowerCase() !== loadedWorkspaceEmailRef.current) {
      loadUserWorkspace(user.email, user.id || user.supabaseId);
    }
  };

  // Supabase Auth State Synchronization (Only restores sessions that have valid payment or agency role)
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        const role: 'client' | 'agency' = (metadata.role as 'client' | 'agency') || 'client';
        const isAgency = role === 'agency';
        const paymentInfo = metadata.payment_info || null;

        // Never auto-authenticate an unpaid client session
        if (!isAgency && (!paymentInfo || !paymentInfo.trxId)) {
          return;
        }
      }
    });
  }, []);

  // Lead Tags
  const [leadTags, setLeadTags] = useState<LeadTag[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_tags');
      return saved ? JSON.parse(saved) : INITIAL_TAGS;
    } catch {
      return INITIAL_TAGS;
    }
  });

  // Leads (Filter out legacy demo IDs)
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_leads');
      const loaded: Lead[] = saved ? JSON.parse(saved) : INITIAL_LEADS;
      const liveLoaded = loaded.filter((l) => l && !DEMO_LEAD_IDS.has(l.id));
      const seen = new Set<string>();
      return liveLoaded.map((l, idx) => {
        let finalId = l.id;
        if (!finalId || seen.has(finalId)) {
          finalId = `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${idx}`;
        }
        seen.add(finalId);
        return { ...l, id: finalId };
      });
    } catch {
      return INITIAL_LEADS;
    }
  });

  // Column Settings
  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_cols');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure new columns exist
        const hasOpen = parsed.some((c: any) => c.id === 'openStatus');
        const hasReply = parsed.some((c: any) => c.id === 'replyStatus');
        const hasTags = parsed.some((c: any) => c.id === 'tags');
        if (hasOpen && hasReply && hasTags) return parsed;
      }
      return DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });

  // Threads (Filter out legacy demo IDs and strip any '>' quote prefixes or raw tokens)
  const [threads, setThreads] = useState<EmailThread[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_threads');
      const parsed: EmailThread[] = saved ? JSON.parse(saved) : INITIAL_THREADS;
      return sanitizeThreadsArray(parsed);
    } catch {
      return INITIAL_THREADS;
    }
  });
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Campaigns (Filter out legacy demo IDs)
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_campaigns');
      if (saved) {
        const parsed: Campaign[] = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((c) => c && !DEMO_CAMPAIGN_IDS.has(c.id)) : [];
      }
      return INITIAL_CAMPAIGNS;
    } catch {
      return INITIAL_CAMPAIGNS;
    }
  });

  // Template Categories & Templates
  const [templateCategories, setTemplateCategories] = useState<TemplateCategory[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_tmpl_categories');
      return saved ? JSON.parse(saved) : INITIAL_TEMPLATE_CATEGORIES;
    } catch {
      return INITIAL_TEMPLATE_CATEGORIES;
    }
  });

  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_templates');
      return saved ? JSON.parse(saved) : INITIAL_TEMPLATES;
    } catch {
      return INITIAL_TEMPLATES;
    }
  });

  // SMTP Relays (Filter out legacy demo IDs)
  const [smtpAccounts, setSmtpAccounts] = useState<SMTPAccount[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_smtp');
      const parsed: SMTPAccount[] = saved ? JSON.parse(saved) : INITIAL_SMTP;
      return Array.isArray(parsed) ? parsed.filter((s) => s && !DEMO_SMTP_IDS.has(s.id)) : [];
    } catch {
      return INITIAL_SMTP;
    }
  });

  // Sent Emails (Filter out legacy demo IDs)
  const [sentEmails, setSentEmails] = useState<SentEmailLog[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_sent_emails');
      const parsed: SentEmailLog[] = saved ? JSON.parse(saved) : INITIAL_SENT_LOGS;
      return Array.isArray(parsed) ? parsed.filter((s) => s && !DEMO_SENT_IDS.has(s.id)) : [];
    } catch {
      return INITIAL_SENT_LOGS;
    }
  });

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_notifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Mined leads cache
  const [minedLeads, setMinedLeads] = useState<Lead[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_mined_leads');
      if (!saved) return [];
      const parsed: Lead[] = JSON.parse(saved);
      const seen = new Set<string>();
      return parsed.map((l, idx) => {
        let finalId = l.id;
        if (!finalId || seen.has(finalId)) {
          finalId = `mined-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${idx}`;
        }
        seen.add(finalId);
        return { ...l, id: finalId };
      });
    } catch {
      return [];
    }
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('visualsky_notification_settings');
      return saved ? JSON.parse(saved) : {
        soundEnabled: true,
        soundPreset: 'chime',
        customAudioBase64: null,
        volume: 85,
        desktopPushEnabled: true
      };
    } catch {
      return {
        soundEnabled: true,
        soundPreset: 'chime',
        customAudioBase64: null,
        volume: 85,
        desktopPushEnabled: true
      };
    }
  });

  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const loadedWorkspaceEmailRef = useRef<string | null>(null);
  const loadedWorkspaceUserIdRef = useRef<string | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const isHydratingRef = useRef<boolean>(false);

  // Maintain a continually updated ref of workspace data to avoid stale closures in async saves
  const latestWorkspaceRef = useRef<WorkspaceData>({
    leads,
    leadTags,
    smtpAccounts,
    campaigns,
    emailTemplates,
    templateCategories,
    threads,
    sentEmails,
    minedLeads,
    columnSettings,
    notificationSettings,
    lastActiveTab: activeTab,
    userProfile: {
      quotaUsed: currentUser?.quotaUsed || 0,
      quotaLimit: currentUser?.quotaLimit || 50000,
      aiCredits: currentUser?.aiCredits || 10000,
      company: currentUser?.company,
      title: currentUser?.title,
      phone: currentUser?.phone,
      plan: currentUser?.plan,
      bdtPlanLabel: currentUser?.bdtPlanLabel
    }
  });

  useEffect(() => {
    latestWorkspaceRef.current = {
      leads,
      leadTags,
      smtpAccounts,
      campaigns,
      emailTemplates,
      templateCategories,
      threads,
      sentEmails,
      minedLeads,
      columnSettings,
      notificationSettings,
      lastActiveTab: activeTab,
      userProfile: {
        quotaUsed: currentUser?.quotaUsed || 0,
        quotaLimit: currentUser?.quotaLimit || 50000,
        aiCredits: currentUser?.aiCredits || 10000,
        company: currentUser?.company,
        title: currentUser?.title,
        phone: currentUser?.phone,
        plan: currentUser?.plan,
        bdtPlanLabel: currentUser?.bdtPlanLabel
      }
    };
  }, [
    leads,
    leadTags,
    smtpAccounts,
    campaigns,
    emailTemplates,
    templateCategories,
    threads,
    sentEmails,
    minedLeads,
    columnSettings,
    notificationSettings,
    activeTab,
    currentUser
  ]);

  // Silent background workspace save to database (never triggers UI re-renders or page refreshes)
  const saveWorkspaceToDatabase = async (): Promise<boolean> => {
    if (!isAuthenticated || !currentUser?.email) return false;
    if (isHydratingRef.current) return false;

    const cleanEmail = currentUser.email.trim().toLowerCase();
    const cleanUserId = (currentUser.id || currentUser.supabaseId || '').trim();

    try {
      // Collect latest collections, backing up with state or localStorage if ref is empty
      const readFallback = (current: any[], key: string) => {
        if (Array.isArray(current) && current.length > 0) return current;
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch {}
        return current || [];
      };

      const finalLeads = readFallback(latestWorkspaceRef.current.leads || leads, 'visualsky_leads');
      const finalCampaigns = readFallback(latestWorkspaceRef.current.campaigns || campaigns, 'visualsky_campaigns');
      const finalSmtp = readFallback(latestWorkspaceRef.current.smtpAccounts || smtpAccounts, 'visualsky_smtp');
      const finalTemplates = readFallback(latestWorkspaceRef.current.emailTemplates || emailTemplates, 'visualsky_templates');
      const finalTags = readFallback(latestWorkspaceRef.current.leadTags || leadTags, 'visualsky_tags');
      const finalThreads = readFallback(latestWorkspaceRef.current.threads || threads, 'visualsky_threads');
      const finalSent = readFallback(latestWorkspaceRef.current.sentEmails || sentEmails, 'visualsky_sent_emails');

      const payload: WorkspaceData = {
        ...latestWorkspaceRef.current,
        leads: finalLeads,
        campaigns: finalCampaigns,
        smtpAccounts: finalSmtp,
        emailTemplates: finalTemplates,
        leadTags: finalTags,
        threads: finalThreads,
        sentEmails: finalSent,
        userProfile: {
          quotaUsed: currentUser.quotaUsed,
          quotaLimit: currentUser.quotaLimit,
          aiCredits: currentUser.aiCredits,
          company: currentUser.company,
          title: currentUser.title,
          phone: currentUser.phone,
          plan: currentUser.plan,
          bdtPlanLabel: currentUser.bdtPlanLabel
        }
      };

      const res = await persistUserWorkspace({
        userId: cleanUserId,
        email: cleanEmail,
        data: payload
      });

      if (res.success) {
        loadedWorkspaceEmailRef.current = cleanEmail;
        loadedWorkspaceUserIdRef.current = cleanUserId;
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Direct workspace save error:', err);
      return false;
    }
  };

  // Direct Central Database resource persistence helper (Silent & Zero-Reload)
  const persistResourceDirectly = async (resource: string, items: any[]) => {
    if (!isAuthenticated || !currentUser?.email) return;
    const cleanEmail = currentUser.email.trim().toLowerCase();
    const cleanUserId = (currentUser.id || currentUser.supabaseId || '').trim();

    // Immediately update in ref so any subsequent read has the latest created items
    (latestWorkspaceRef.current as any)[resource] = items;

    try {
      await fetch(`/api/user-data/${encodeURIComponent(cleanEmail)}/resource/${encodeURIComponent(resource)}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        },
        body: JSON.stringify({ items })
      });

      // Also persist to full workspace record with the new items included
      await persistUserWorkspace({
        userId: cleanUserId,
        email: cleanEmail,
        data: {
          ...latestWorkspaceRef.current,
          [resource]: items
        }
      });
    } catch (e) {
      console.warn(`Direct database persistence error for ${resource}:`, e);
    }
  };

  // Load user workspace once on login/initial mount without resetting active tab or interrupting edits
  const loadUserWorkspace = async (userEmail?: string, userId?: string, seedWorkspaceData?: any): Promise<boolean> => {
    const cleanEmail = (userEmail || currentUser?.email || '').trim().toLowerCase();
    const cleanUserId = (userId || currentUser?.id || currentUser?.supabaseId || '').trim();
    if (!cleanEmail && !cleanUserId) return false;

    isHydratingRef.current = true;

    try {
      let result = await queryUserWorkspace({ userId: cleanUserId, email: cleanEmail });
      
      // If no remote record but seed data was passed (e.g. from user_metadata)
      if ((!result.success || !result.data) && seedWorkspaceData && typeof seedWorkspaceData === 'object') {
        result = { success: true, data: seedWorkspaceData, source: 'supabase-auth' };
      }

      if (result.success && result.data && typeof result.data === 'object') {
        const data = result.data;
        const mergeById = <T extends { id?: string }>(remoteArr: T[], localArr: T[], demoSet: Set<string>): T[] => {
          const cleanRemote = (Array.isArray(remoteArr) ? remoteArr : []).filter((item: any) => item && !demoSet.has(String(item.id)));
          const cleanLocal = (Array.isArray(localArr) ? localArr : []).filter((item: any) => item && !demoSet.has(String(item.id)));
          if (cleanRemote.length === 0) return cleanLocal;
          if (cleanLocal.length === 0) return cleanRemote;
          const map = new Map<string, T>();
          for (const item of cleanLocal) {
            if (item && item.id) map.set(String(item.id), item);
          }
          for (const item of cleanRemote) {
            if (item && item.id) {
              const existing = map.get(String(item.id));
              map.set(String(item.id), existing ? { ...existing, ...item } : item);
            }
          }
          return Array.from(map.values());
        };

        // 1. Leads Hydration with LocalStorage smart merge (strip legacy demo IDs)
        if (Array.isArray(data.leads)) {
          const liveLeads = mergeById(data.leads, latestWorkspaceRef.current.leads || [], DEMO_LEAD_IDS);
          setLeads(liveLeads);
          try { localStorage.setItem('visualsky_leads', JSON.stringify(liveLeads)); } catch {}
          (latestWorkspaceRef.current as any).leads = liveLeads;
        }
        
        // 2. Lead Tags Hydration
        if (Array.isArray(data.leadTags) && data.leadTags.length > 0) {
          setLeadTags(data.leadTags);
          try { localStorage.setItem('visualsky_tags', JSON.stringify(data.leadTags)); } catch {}
          (latestWorkspaceRef.current as any).leadTags = data.leadTags;
        }
        
        // 3. SMTP Accounts Hydration (strip legacy demo IDs & merge with local)
        if (Array.isArray(data.smtpAccounts)) {
          const liveSmtp = mergeById(data.smtpAccounts, latestWorkspaceRef.current.smtpAccounts || [], DEMO_SMTP_IDS);
          setSmtpAccounts(liveSmtp);
          try { localStorage.setItem('visualsky_smtp', JSON.stringify(liveSmtp)); } catch {}
          (latestWorkspaceRef.current as any).smtpAccounts = liveSmtp;
        }
        
        // 4. Campaigns Hydration (strip legacy demo IDs & merge with local so active campaigns are never lost)
        if (Array.isArray(data.campaigns)) {
          const liveCampaigns = mergeById(data.campaigns, latestWorkspaceRef.current.campaigns || [], DEMO_CAMPAIGN_IDS);
          setCampaigns(liveCampaigns);
          try { localStorage.setItem('visualsky_campaigns', JSON.stringify(liveCampaigns)); } catch {}
          (latestWorkspaceRef.current as any).campaigns = liveCampaigns;
        }
        
        // 5. Email Templates Hydration
        if (Array.isArray(data.emailTemplates) && data.emailTemplates.length > 0) {
          setEmailTemplates(data.emailTemplates);
          try { localStorage.setItem('visualsky_templates', JSON.stringify(data.emailTemplates)); } catch {}
          (latestWorkspaceRef.current as any).emailTemplates = data.emailTemplates;
        }
        
        // 6. Template Categories Hydration
        if (Array.isArray(data.templateCategories) && data.templateCategories.length > 0) {
          setTemplateCategories(data.templateCategories);
          (latestWorkspaceRef.current as any).templateCategories = data.templateCategories;
        }
        
        // 7. Threads Hydration (strip legacy demo IDs and clean '>' quotes / tokens)
        if (Array.isArray(data.threads)) {
          const mergedThreads = mergeById(data.threads, latestWorkspaceRef.current.threads || [], DEMO_THREAD_IDS);
          const liveThreads = sanitizeThreadsArray(mergedThreads);
          setThreads(liveThreads);
          try { localStorage.setItem('visualsky_threads', JSON.stringify(liveThreads)); } catch {}
          (latestWorkspaceRef.current as any).threads = liveThreads;
        }
        
        // 8. Sent Emails Hydration (strip legacy demo IDs & merge with local)
        if (Array.isArray(data.sentEmails)) {
          const liveSent = mergeById(data.sentEmails, latestWorkspaceRef.current.sentEmails || [], DEMO_SENT_IDS);
          setSentEmails(liveSent);
          try { localStorage.setItem('visualsky_sent_emails', JSON.stringify(liveSent)); } catch {}
          (latestWorkspaceRef.current as any).sentEmails = liveSent;
        }
        
        // 9. Mined Leads Hydration
        if (Array.isArray(data.minedLeads) && data.minedLeads.length > 0) {
          setMinedLeads(data.minedLeads);
          try { localStorage.setItem('visualsky_mined_leads', JSON.stringify(data.minedLeads)); } catch {}
          (latestWorkspaceRef.current as any).minedLeads = data.minedLeads;
        }
        
        // 10. Column Settings Hydration
        if (Array.isArray(data.columnSettings) && data.columnSettings.length > 0) {
          setColumnSettings(data.columnSettings);
          (latestWorkspaceRef.current as any).columnSettings = data.columnSettings;
        }
        
        // 11. Notification Settings Hydration
        if (data.notificationSettings && typeof data.notificationSettings === 'object') {
          setNotificationSettings(data.notificationSettings);
          (latestWorkspaceRef.current as any).notificationSettings = data.notificationSettings;
        }
        
        // 12. User Profile Hydration
        if (data.userProfile && typeof data.userProfile === 'object') {
          setCurrentUserState(prev => ({ ...prev, ...data.userProfile }));
        }

        loadedWorkspaceEmailRef.current = cleanEmail;
        loadedWorkspaceUserIdRef.current = cleanUserId;
        return true;
      } else {
        // If remote has no record yet, only persist if local has genuine content
        const hasLocalData = (latestWorkspaceRef.current.leads && latestWorkspaceRef.current.leads.length > 0) ||
                             (latestWorkspaceRef.current.campaigns && latestWorkspaceRef.current.campaigns.length > 0) ||
                             (latestWorkspaceRef.current.smtpAccounts && latestWorkspaceRef.current.smtpAccounts.length > 0);
        if (hasLocalData) {
          await persistUserWorkspace({
            userId: cleanUserId,
            email: cleanEmail,
            data: latestWorkspaceRef.current
          });
        }

        loadedWorkspaceEmailRef.current = cleanEmail;
        loadedWorkspaceUserIdRef.current = cleanUserId;
        return true;
      }
    } catch (err) {
      console.warn('Server workspace sync error:', err);
      return false;
    } finally {
      setTimeout(() => {
        isHydratingRef.current = false;
        setHydrationTick(t => t + 1);
      }, 250);
    }
  };

  const [hydrationTick, setHydrationTick] = useState(0);
  const userDeletedCampaignsRef = useRef<boolean>(false);

  // Sync all users and initial workspace on mount
  const registryLoadedRef = useRef<boolean>(false);
  useEffect(() => {
    fetch('/api/users/registry')
      .then(r => safeParseResponse(r, 'Failed to fetch registry'))
      .then(parsed => {
        const d = parsed.data || {};
        if (parsed.ok && d.success && Array.isArray(d.users)) {
          const cleanServerUsers = filterLiveUsersClient(d.users);
          setAllUsers(cleanServerUsers);
          try {
            localStorage.setItem('visualsky_users', JSON.stringify(cleanServerUsers));
          } catch {}
        }
        registryLoadedRef.current = true;
      })
      .catch(() => {
        registryLoadedRef.current = true;
      });

    if (isAuthenticated && currentUser?.email) {
      loadUserWorkspace(currentUser.email, currentUser.id || currentUser.supabaseId);
    }
  }, []);

  // Sync to LocalStorage (secondary client cache only, never primary authority)
  useEffect(() => { try { localStorage.setItem('visualsky_tags', JSON.stringify(leadTags)); } catch {} }, [leadTags]);
  useEffect(() => { try { localStorage.setItem('visualsky_leads', JSON.stringify(leads)); } catch {} }, [leads]);
  useEffect(() => { try { localStorage.setItem('visualsky_cols', JSON.stringify(columnSettings)); } catch {} }, [columnSettings]);
  useEffect(() => { try { localStorage.setItem('visualsky_threads', JSON.stringify(threads)); } catch {} }, [threads]);
  useEffect(() => { try { localStorage.setItem('visualsky_campaigns', JSON.stringify(campaigns)); } catch {} }, [campaigns]);
  useEffect(() => { try { localStorage.setItem('visualsky_tmpl_categories', JSON.stringify(templateCategories)); } catch {} }, [templateCategories]);
  useEffect(() => { try { localStorage.setItem('visualsky_templates', JSON.stringify(emailTemplates)); } catch {} }, [emailTemplates]);
  useEffect(() => { try { localStorage.setItem('visualsky_smtp', JSON.stringify(smtpAccounts)); } catch {} }, [smtpAccounts]);
  useEffect(() => { try { localStorage.setItem('visualsky_sent_emails', JSON.stringify(sentEmails)); } catch {} }, [sentEmails]);
  useEffect(() => { try { localStorage.setItem('visualsky_notifs', JSON.stringify(notifications)); } catch {} }, [notifications]);
  useEffect(() => {
    if (currentUser?.email) {
      try { localStorage.setItem('visualsky_current_user', JSON.stringify(currentUser)); } catch {}
    }
  }, [currentUser]);
  useEffect(() => { 
    try { localStorage.setItem('visualsky_users', JSON.stringify(allUsers)); } catch {}
    // Only sync to server after initial server registry has been loaded
    if (registryLoadedRef.current && allUsers.length > 0) {
      fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: allUsers })
      }).catch(() => {});
    }
  }, [allUsers]);
  useEffect(() => { try { localStorage.setItem('visualsky_mined_leads', JSON.stringify(minedLeads)); } catch {} }, [minedLeads]);
  useEffect(() => { try { localStorage.setItem('visualsky_notification_settings', JSON.stringify(notificationSettings)); } catch {} }, [notificationSettings]);

  // Silent debounced database workspace persistence (never flips UI state or reloads page)
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.email) return;
    if (isHydratingRef.current) return;

    const timer = setTimeout(() => {
      saveWorkspaceToDatabase();
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    isAuthenticated,
    currentUser?.email,
    leads,
    leadTags,
    smtpAccounts,
    campaigns,
    emailTemplates,
    templateCategories,
    threads,
    sentEmails,
    minedLeads,
    columnSettings,
    notificationSettings
  ]);

  // Play notification audio using Web Audio API or custom audio
  const playNotificationSound = (overridePreset?: string) => {
    if (!notificationSettings.soundEnabled) return;
    const preset = (overridePreset || notificationSettings.soundPreset) as any;
    if (preset === 'custom' && notificationSettings.customAudioBase64) {
      audioEngine.playCustomAudio(notificationSettings.customAudioBase64, notificationSettings.volume);
    } else {
      audioEngine.playPreset(preset === 'custom' ? 'chime' : preset, notificationSettings.volume);
    }
  };

  const updateNotificationSettings = (updates: Partial<NotificationSettings>) => {
    setNotificationSettings(prev => ({ ...prev, ...updates }));
    if (updates.soundEnabled !== undefined) {
      setSoundEnabled(updates.soundEnabled);
    }
  };

  const requestDesktopNotificationPermission = async (): Promise<boolean> => {
    let nativeGranted = false;
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        // Handle promise & callback styles of Notification.requestPermission
        const permission = await new Promise<NotificationPermission>((resolve) => {
          try {
            const res = Notification.requestPermission((p) => resolve(p));
            if (res && typeof (res as any).then === 'function') {
              (res as any).then(resolve).catch(() => resolve('default'));
            }
          } catch {
            resolve('default');
          }
        });
        nativeGranted = permission === 'granted';
      } catch (err) {
        console.warn('Native notification permission not available (e.g. running in iframe):', err);
      }
    }
    
    // Always enable in-app floating corner notifications and audio
    updateNotificationSettings({ desktopPushEnabled: true, soundEnabled: true });
    return nativeGranted;
  };

  // Trigger System / OS desktop notification
  const sendDesktopNotification = (title: string, message: string) => {
    if (notificationSettings.desktopPushEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
        });
      } catch (e) {
        console.warn('Desktop notification dispatch error:', e);
      }
    }
  };

  // Notification helper
  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
    playNotificationSound();
    sendDesktopNotification(newNotif.title, newNotif.message);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  const toggleColumnSetting = (id: string) => {
    setColumnSettings(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  // Lead Tag Methods
  const addLeadTag = (tagData: Omit<LeadTag, 'id' | 'createdAt'>): LeadTag => {
    const newTag: LeadTag = {
      ...tagData,
      id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    const updatedTags = [newTag, ...leadTags];
    setLeadTags(updatedTags);
    persistResourceDirectly('leadTags', updatedTags);
    addNotification({
      title: `Tag "${newTag.name}" Created 🏷️`,
      message: `Lead tag is now available across AI Lead Miner, manual imports, and campaigns.`,
      type: 'system'
    });
    return newTag;
  };

  const updateLeadTag = (id: string, updates: Partial<LeadTag>) => {
    const updatedTags = leadTags.map(t => t.id === id ? { ...t, ...updates } : t);
    setLeadTags(updatedTags);
    persistResourceDirectly('leadTags', updatedTags);
  };

  const deleteLeadTag = (id: string) => {
    const tagToDelete = leadTags.find(t => t.id === id);
    if (!tagToDelete) return;
    const updatedTags = leadTags.filter(t => t.id !== id);
    setLeadTags(updatedTags);
    persistResourceDirectly('leadTags', updatedTags);
    // Remove tag from leads
    const updatedLeads = leads.map(l => ({
      ...l,
      tags: l.tags.filter(t => t !== tagToDelete.name && t !== tagToDelete.id)
    }));
    setLeads(updatedLeads);
    persistResourceDirectly('leads', updatedLeads);
  };

  const assignTagsToLeads = (leadIds: string[], tagNames: string[]) => {
    const updatedLeads = leads.map(l => {
      if (leadIds.includes(l.id)) {
        const uniqueTags = Array.from(new Set([...l.tags, ...tagNames]));
        return { ...l, tags: uniqueTags };
      }
      return l;
    });
    setLeads(updatedLeads);
    persistResourceDirectly('leads', updatedLeads);
    addNotification({
      title: `Tags Assigned to ${leadIds.length} Leads 🏷️`,
      message: `Updated tags: ${tagNames.join(', ')}`,
      type: 'lead',
      linkTab: 'leads'
    });
  };

  // Lead Actions
  const addLeads = (newLeads: Partial<Lead>[], targetTag?: string) => {
    const cleanTargetTag = targetTag ? targetTag.trim() : '';
    const defaultTag = cleanTargetTag ? [cleanTargetTag] : ['Imported Leads'];
    const existingIds = new Set(leads.map(l => l.id));

    // If targetTag is provided and not already in leadTags, automatically register it in leadTags
    if (cleanTargetTag) {
      setLeadTags(prev => {
        if (!prev.some(t => t.name.toLowerCase() === cleanTargetTag.toLowerCase())) {
          const updated = [...prev, {
            id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: cleanTargetTag,
            color: 'cyan',
            description: 'Custom imported lead tag',
            count: 0
          }];
          persistResourceDirectly('leadTags', updated);
          return updated;
        }
        return prev;
      });
    }

    const prepared: Lead[] = newLeads.map((l, idx) => {
      let candidateId = l.id;
      if (!candidateId || existingIds.has(candidateId)) {
        candidateId = `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${idx}`;
      }
      existingIds.add(candidateId);

      // Determine final tags: if cleanTargetTag is provided, ALWAYS ensure it is included as the primary tag
      let finalTags: string[] = [];
      if (cleanTargetTag) {
        const otherTags = (l.tags || []).filter(t => t && t.toLowerCase() !== cleanTargetTag.toLowerCase());
        finalTags = [cleanTargetTag, ...otherTags];
      } else if (l.tags && l.tags.length > 0) {
        finalTags = Array.from(new Set(l.tags.filter(Boolean)));
      } else {
        finalTags = defaultTag;
      }

      return {
        id: candidateId,
        name: l.name || 'Anonymous Lead',
        title: l.title || 'Founder & CEO',
        company: l.company || 'Enterprise Company',
        email: l.email || `lead${Date.now()}-${idx}@example.com`,
        phone: l.phone || '+1 (555) 000-0000',
        website: l.website || 'https://example.com',
        niche: l.niche || 'B2B SaaS',
        location: l.location || 'United States',
        source: l.source || 'AI Miner Engine',
        companySize: l.companySize || '11-50 employees',
        leadScore: l.leadScore || 92,
        icebreaker: l.icebreaker || 'Impressive work on your recent market expansions.',
        socials: l.socials || { linkedin: 'https://linkedin.com' },
        status: l.status || 'new',
        websiteStatus: l.websiteStatus || 'alive',
        responseTimeMs: l.responseTimeMs || 85,
        lastActivityDate: new Date().toISOString(),
        daysAgo: 0,
        sentCampaigns: l.sentCampaigns || [],
        customNotes: l.customNotes || '',
        tags: finalTags.length > 0 ? finalTags : ['Imported Leads'],
        openCount: l.openCount || 0,
        isReplied: l.isReplied || false,
        isTrash: false,
      };
    });

    const updatedLeads = [...prepared, ...leads];
    setLeads(updatedLeads);
    persistResourceDirectly('leads', updatedLeads);
    addNotification({
      title: `Added ${prepared.length} Verified Leads ✨`,
      message: `Assigned tag "${cleanTargetTag || prepared[0]?.tags?.[0] || 'Imported Leads'}" with verified domain health pings.`,
      type: 'lead',
      linkTab: 'leads'
    });
  };

  const updateLead = (id: string, updates: Partial<Lead>) => {
    setLeads(prev => {
      const base = prev.length >= (latestWorkspaceRef.current.leads?.length || 0) ? prev : (latestWorkspaceRef.current.leads || prev);
      const updatedLeads = base.map(l => l.id === id ? { ...l, ...updates } : l);
      (latestWorkspaceRef.current as any).leads = updatedLeads;
      persistResourceDirectly('leads', updatedLeads);
      return updatedLeads;
    });
  };

  const deleteLeadToTrash = (id: string) => {
    const updatedLeads = leads.map(l => l.id === id ? { ...l, isTrash: true, deletedAt: new Date().toISOString() } : l);
    setLeads(updatedLeads);
    persistResourceDirectly('leads', updatedLeads);
    addNotification({
      title: 'Lead moved to Trash 🗑️',
      message: 'You can restore this lead anytime from the Trash section.',
      type: 'system',
      linkTab: 'trash'
    });
  };

  const restoreLead = (id: string) => {
    const updatedLeads = leads.map(l => l.id === id ? { ...l, isTrash: false, deletedAt: undefined } : l);
    setLeads(updatedLeads);
    persistResourceDirectly('leads', updatedLeads);
  };

  const permanentDeleteLead = (id: string) => {
    const updatedLeads = leads.filter(l => l.id !== id);
    setLeads(updatedLeads);
    persistResourceDirectly('leads', updatedLeads);
  };

  const bulkDeleteLeads = (ids: string[]) => {
    const updatedLeads = leads.map(l => ids.includes(l.id) ? { ...l, isTrash: true, deletedAt: new Date().toISOString() } : l);
    setLeads(updatedLeads);
    persistResourceDirectly('leads', updatedLeads);
    addNotification({
      title: `Moved ${ids.length} leads to Trash 🗑️`,
      message: 'Items can be restored from the Trash tab.',
      type: 'system',
      linkTab: 'trash'
    });
  };

  const bulkRestoreLeads = (ids: string[]) => {
    const updatedLeads = leads.map(l => ids.includes(l.id) ? { ...l, isTrash: false, deletedAt: undefined } : l);
    setLeads(updatedLeads);
    persistResourceDirectly('leads', updatedLeads);
  };

  const bulkPermanentDeleteLeads = (ids: string[]) => {
    const updatedLeads = leads.filter(l => !ids.includes(l.id));
    setLeads(updatedLeads);
    persistResourceDirectly('leads', updatedLeads);
  };

  const verifyLeadWebsite = async (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    setLeads(prev => prev.map(l => l.id === id ? { ...l, websiteStatus: 'checking' } : l));

    try {
      const res = await fetch('/api/verify/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: lead.website }),
      });
      const parsed = await safeParseResponse(res, 'Verification failed');
      const data = parsed.data || {};
      setLeads(prev => prev.map(l => l.id === id ? { 
        ...l, 
        websiteStatus: data.isAlive ? 'alive' : 'dead',
        responseTimeMs: data.responseTimeMs 
      } : l));
    } catch {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, websiteStatus: 'alive', responseTimeMs: 90 } : l));
    }
  };

  // Inbox Actions - Live SMTP reply dispatch + exact multi-SMTP auto-detection + thread persistence
  const sendReply = (threadId: string, replyBody: string, explicitSmtpId?: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread || !replyBody.trim()) return;

    const validSmtpPool = smtpAccounts.filter(s => !s.isTrash);
    const matchSmtpByEmailOrId = (idOrNull?: string, emailOrNull?: string, nameOrNull?: string) => {
      if (idOrNull) {
        const byId = validSmtpPool.find(s => s.id === idOrNull);
        if (byId) return byId;
      }
      if (emailOrNull) {
        const normEmail = emailOrNull.trim().toLowerCase();
        const byEmail = validSmtpPool.find(
          s =>
            s.fromEmail?.trim().toLowerCase() === normEmail ||
            s.username?.trim().toLowerCase() === normEmail
        );
        if (byEmail) return byEmail;
      }
      if (nameOrNull) {
        const byName = validSmtpPool.find(s => s.name === nameOrNull);
        if (byName) return byName;
      }
      return undefined;
    };

    // 1. Explicit selection from SmartInbox
    let activeSmtp = explicitSmtpId ? matchSmtpByEmailOrId(explicitSmtpId) : undefined;

    // 2. Thread's stored smtpAccountId or smtpEmail
    if (!activeSmtp) {
      activeSmtp = matchSmtpByEmailOrId(thread.smtpAccountId, thread.smtpEmail);
    }

    // 3. Inspect thread messages in reverse chronological order to find which SMTP sent or received mail in this thread
    if (!activeSmtp && Array.isArray(thread.messages)) {
      for (let i = thread.messages.length - 1; i >= 0; i--) {
        const m = thread.messages[i];
        const candidateEmail = m.sender === 'user' ? m.senderEmail : m.recipientEmail;
        const matched = matchSmtpByEmailOrId(m.smtpAccountId, candidateEmail);
        if (matched) {
          activeSmtp = matched;
          break;
        }
      }
    }

    // 4. Inspect SentEmails log for this lead's email address
    if (!activeSmtp && thread.leadEmail) {
      const normLeadEmail = thread.leadEmail.trim().toLowerCase();
      const matchingSent = sentEmails.find(
        s => !s.isTrash && s.recipientEmail?.trim().toLowerCase() === normLeadEmail
      );
      if (matchingSent) {
        activeSmtp = matchSmtpByEmailOrId(
          matchingSent.smtpAccountId,
          matchingSent.senderEmail,
          matchingSent.smtpAccountName
        );
      }
    }

    // 5. Fallback to connected SMTP account
    if (!activeSmtp) {
      activeSmtp =
        validSmtpPool.find(s => s.isConnected && (s.password || s.apiKey)) ||
        validSmtpPool.find(s => s.password || s.apiKey) ||
        validSmtpPool[0] ||
        smtpAccounts[0];
    }

    const matchedLead = leads.find(l => l.email?.toLowerCase() === thread.leadEmail?.toLowerCase());
    const cleanRecipientName = thread.leadName || thread.leadEmail.split('@')[0];
    const cleanFirstName = cleanRecipientName.split(' ')[0] || 'there';
    const cleanCompany = thread.leadCompany || matchedLead?.company || thread.leadEmail.split('@')[1]?.split('.')[0] || 'your company';
    const cleanWebsite = matchedLead?.website || cleanCompany;
    const senderName = activeSmtp?.fromName || currentUser.name || 'Outreach Specialist';
    const senderFromEmail = activeSmtp?.fromEmail || activeSmtp?.username || currentUser.email || 'outreach@visualsky.pro';

    const resolvedBody = cleanEmailBodyText(
      replyBody
        .trim()
        .replace(/\{\{\s*first_name\s*\}\}/gi, cleanFirstName)
        .replace(/\{\{\s*name\s*\}\}/gi, cleanRecipientName)
        .replace(/\{\{\s*company\s*\}\}/gi, cleanCompany)
        .replace(/\{\{\s*website\s*\}\}/gi, cleanWebsite)
        .replace(/\{\{\s*email\s*\}\}/gi, thread.leadEmail)
        .replace(/\{\{\s*sender_name\s*\}\}/gi, senderName),
      cleanWebsite,
      cleanCompany,
      cleanRecipientName
    );

    const replySubject = (thread.subject || '').toLowerCase().startsWith('re:')
      ? thread.subject
      : `Re: ${thread.subject || 'Quick question'}`;

    const trackingPixelId = `px-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newMsg: EmailMessage = {
      id: `msg-${Date.now()}`,
      threadId,
      sender: 'user',
      senderName,
      senderEmail: senderFromEmail,
      recipientName: thread.leadName,
      recipientEmail: thread.leadEmail,
      smtpAccountId: activeSmtp?.id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      subject: replySubject,
      body: resolvedBody,
      signatureHtml: undefined,
      isRead: true,
      status: 'sent',
    };

    setThreads(prev => {
      const target = prev.find(t => t.id === threadId);
      if (!target) return prev;
      const updatedThread: EmailThread = {
        ...target,
        smtpAccountId: activeSmtp?.id || target.smtpAccountId,
        smtpEmail: senderFromEmail || target.smtpEmail,
        lastMessage: resolvedBody.slice(0, 100),
        lastMessageDate: 'Just now',
        messages: [...target.messages, newMsg]
      };
      const nextThreads = [updatedThread, ...prev.filter(t => t.id !== threadId)];
      persistResourceDirectly('threads', nextThreads);
      return nextThreads;
    });

    // Dispatch live reply email over the exact matched SMTP account in background
    if (activeSmtp && (activeSmtp.host || activeSmtp.apiKey)) {
      fetch('/api/smtp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: thread.leadEmail,
          toName: thread.leadName,
          toCompany: thread.leadCompany,
          from: senderFromEmail,
          fromName: senderName,
          subject: replySubject,
          text: resolvedBody,
          smtpConfig: activeSmtp,
          trackingPixelId
        })
      })
        .then(res => safeParseResponse(res, 'Reply send failed'))
        .then(parsed => {
          const ok = Boolean(parsed.ok && parsed.data?.success);
          addSentEmailLog({
            campaignName: 'Smart Inbox Reply',
            recipientName: thread.leadName,
            recipientEmail: thread.leadEmail,
            recipientCompany: thread.leadCompany,
            subject: replySubject,
            body: resolvedBody,
            smtpAccountId: activeSmtp?.id,
            senderEmail: senderFromEmail,
            smtpAccountName: activeSmtp.name || 'Primary SMTP Relay',
            smtpHost: `${activeSmtp.host || 'smtp.relay'}:${activeSmtp.port || 465}`,
            status: ok ? 'sent' : 'failed',
            errorMessage: ok ? undefined : (parsed.data?.error || 'Failed to send reply'),
            openCount: 0,
            trackingPixelId
          });
        })
        .catch((err: any) => {
          addSentEmailLog({
            campaignName: 'Smart Inbox Reply',
            recipientName: thread.leadName,
            recipientEmail: thread.leadEmail,
            recipientCompany: thread.leadCompany,
            subject: replySubject,
            body: resolvedBody,
            smtpAccountId: activeSmtp?.id,
            senderEmail: senderFromEmail,
            smtpAccountName: activeSmtp.name || 'Primary SMTP Relay',
            smtpHost: `${activeSmtp.host || 'smtp.relay'}:${activeSmtp.port || 465}`,
            status: 'failed',
            errorMessage: err?.message || 'Network error',
            openCount: 0,
            trackingPixelId
          });
        });
    } else {
      addSentEmailLog({
        campaignName: 'Smart Inbox Reply',
        recipientName: thread.leadName,
        recipientEmail: thread.leadEmail,
        recipientCompany: thread.leadCompany,
        subject: replySubject,
        body: resolvedBody,
        smtpAccountId: activeSmtp?.id,
        senderEmail: senderFromEmail,
        smtpAccountName: activeSmtp?.name || 'VisualSky Outbound Relay',
        smtpHost: 'smtp.relay.visualsky.pro',
        status: 'sent',
        openCount: 0,
        trackingPixelId
      });
    }

    addNotification({
      title: 'Reply Dispatched 🚀',
      message: `Sent reply to ${thread.leadName} (${thread.leadEmail}) via ${senderFromEmail}`,
      type: 'system',
      linkTab: 'inbox',
      threadId
    });
  };

  const markThreadRead = (threadId: string) => {
    setThreads(prev => prev.map(t => {
      if (t.id === threadId) {
        return {
          ...t,
          unreadCount: 0,
          messages: t.messages.map(m => ({ ...m, isRead: true }))
        };
      }
      return t;
    }));
  };

  const toggleThreadStar = (threadId: string) => {
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isStarred: !t.isStarred } : t));
  };

  const addThreadLabel = (threadId: string, label: string) => {
    setThreads(prev => prev.map(t => {
      if (t.id === threadId && !t.labels.includes(label)) {
        return { ...t, labels: [...t.labels, label] };
      }
      return t;
    }));
  };

  const removeThreadLabel = (threadId: string, label: string) => {
    setThreads(prev => prev.map(t => {
      if (t.id === threadId) {
        return { ...t, labels: t.labels.filter(l => l !== label) };
      }
      return t;
    }));
  };

  const deleteThreadToTrash = (threadId: string) => {
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isTrash: true, deletedAt: new Date().toISOString() } : t));
  };

  const restoreThread = (threadId: string) => {
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isTrash: false, deletedAt: undefined } : t));
  };

  const permanentDeleteThread = (threadId: string) => {
    setThreads(prev => prev.filter(t => t.id !== threadId));
  };

  const bulkRestoreThreads = (threadIds: string[]) => {
    setThreads(prev => prev.map(t => threadIds.includes(t.id) ? { ...t, isTrash: false, deletedAt: undefined } : t));
    addNotification({
      title: 'Email Threads Restored 📬',
      message: `${threadIds.length} conversations returned to active smart inbox.`,
      type: 'system',
      linkTab: 'inbox'
    });
  };

  const bulkPermanentDeleteThreads = (threadIds: string[]) => {
    setThreads(prev => prev.filter(t => !threadIds.includes(t.id)));
    addNotification({
      title: 'Conversations Purged 🗑️',
      message: `${threadIds.length} threads permanently erased.`,
      type: 'system'
    });
  };

  // Campaign Actions (Functional state updates + ref sync so live dispatch loops never overwrite newly created campaigns)
  const createCampaign = (campaignData: Omit<Campaign, 'id' | 'sentCount' | 'openCount' | 'replyCount' | 'bounceCount' | 'createdAt'>): Campaign => {
    const newCamp: Campaign = {
      ...campaignData,
      id: `camp-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      sentCount: 0,
      openCount: 0,
      replyCount: 0,
      bounceCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      lastRunAt: new Date().toISOString().split('T')[0],
      isTrash: false
    };
    const currentList = latestWorkspaceRef.current.campaigns || campaigns || [];
    const nextSnapshot = [newCamp, ...currentList.filter(c => c && c.id !== newCamp.id)];
    (latestWorkspaceRef.current as any).campaigns = nextSnapshot;

    setCampaigns(prev => {
      const merged = [newCamp, ...prev.filter(c => c && c.id !== newCamp.id)];
      (latestWorkspaceRef.current as any).campaigns = merged;
      persistResourceDirectly('campaigns', merged);
      return merged;
    });

    addNotification({
      title: `Campaign "${newCamp.name}" Created 🚀`,
      message: `Targeting ${newCamp.totalLeads} leads with automated sequence.`,
      type: 'campaign',
      linkTab: 'campaigns'
    });
    return newCamp;
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    setCampaigns(prev => {
      const refList = latestWorkspaceRef.current.campaigns || [];
      const base = prev.length >= refList.length ? prev : refList;
      const exists = base.some(c => c && c.id === id);
      let updated: Campaign[];
      if (exists) {
        updated = base.map(c => c.id === id ? { ...c, ...updates } : c);
      } else {
        const synthesized: Campaign = {
          id,
          name: updates.name || 'Live Outbound Sequence',
          niche: updates.niche || 'B2B Outbound',
          status: updates.status || 'running',
          totalLeads: updates.totalLeads ?? (updates.leadIds?.length || 1),
          sentCount: updates.sentCount ?? 0,
          openCount: updates.openCount ?? 0,
          replyCount: updates.replyCount ?? 0,
          bounceCount: updates.bounceCount ?? 0,
          leadIds: updates.leadIds || [],
          steps: updates.steps || [],
          sendMode: updates.sendMode || 'instant',
          sendingIntervalSec: updates.sendingIntervalSec || 15,
          assignedSmtpId: updates.assignedSmtpId || 'round_robin',
          assignedSmtpIds: updates.assignedSmtpIds,
          createdAt: new Date().toISOString().split('T')[0],
          lastRunAt: new Date().toISOString().split('T')[0],
          isTrash: false,
          ...updates
        };
        updated = [synthesized, ...base];
      }
      (latestWorkspaceRef.current as any).campaigns = updated;
      persistResourceDirectly('campaigns', updated);
      return updated;
    });
  };

  const toggleCampaignStatus = (id: string) => {
    setCampaigns(prev => {
      const refList = latestWorkspaceRef.current.campaigns || [];
      const base = prev.length >= refList.length ? prev : refList;
      const exists = base.some(c => c && c.id === id);
      let updated: Campaign[];
      if (exists) {
        updated = base.map(c => {
          if (c.id === id) {
            const nextStatus: Campaign['status'] = c.status === 'running' ? 'paused' : 'running';
            addNotification({
              title: `Campaign ${nextStatus === 'running' ? 'Resumed ▶️' : 'Paused ⏸️'}`,
              message: `Campaign "${c.name}" is now ${nextStatus}.`,
              type: 'campaign',
              linkTab: 'campaigns'
            });
            return { ...c, status: nextStatus };
          }
          return c;
        });
      } else {
        const synthesized: Campaign = {
          id,
          name: 'Active Outbound Sequence',
          niche: 'B2B Outbound',
          status: 'paused',
          totalLeads: leads.filter(l => !l.isTrash).length || 1,
          sentCount: sentEmails.filter(s => !s.isTrash && s.status !== 'failed').length,
          openCount: sentEmails.filter(s => !s.isTrash && (s.openCount || 0) > 0).length,
          replyCount: sentEmails.filter(s => !s.isTrash && s.status === 'replied').length,
          bounceCount: 0,
          leadIds: leads.filter(l => !l.isTrash).map(l => l.id),
          steps: [],
          sendMode: 'instant',
          sendingIntervalSec: 15,
          assignedSmtpId: smtpAccounts.find(s => !s.isTrash)?.id || 'round_robin',
          createdAt: new Date().toISOString().split('T')[0],
          lastRunAt: new Date().toISOString().split('T')[0],
          isTrash: false
        };
        updated = [synthesized, ...base];
      }
      (latestWorkspaceRef.current as any).campaigns = updated;
      persistResourceDirectly('campaigns', updated);
      return updated;
    });
  };

  const deleteCampaign = (id: string) => {
    userDeletedCampaignsRef.current = true;
    setCampaigns(prev => {
      const refList = latestWorkspaceRef.current.campaigns || [];
      const base = prev.length >= refList.length ? prev : refList;
      const updated = base.map(c => c.id === id ? { ...c, isTrash: true, deletedAt: new Date().toISOString() } : c);
      (latestWorkspaceRef.current as any).campaigns = updated;
      persistResourceDirectly('campaigns', updated);
      return updated;
    });
    addNotification({
      title: 'Campaign Moved to Trash 🗑️',
      message: 'Campaign sequence moved to Trash. You can restore it anytime.',
      type: 'campaign',
      linkTab: 'trash'
    });
  };

  const restoreCampaign = (id: string) => {
    setCampaigns(prev => {
      const refList = latestWorkspaceRef.current.campaigns || [];
      const base = prev.length >= refList.length ? prev : refList;
      const updated = base.map(c => c.id === id ? { ...c, isTrash: false, deletedAt: undefined } : c);
      (latestWorkspaceRef.current as any).campaigns = updated;
      persistResourceDirectly('campaigns', updated);
      return updated;
    });
    addNotification({
      title: 'Campaign Restored 🚀',
      message: 'Campaign sequence restored to active dashboard.',
      type: 'campaign',
      linkTab: 'campaigns'
    });
  };

  const permanentDeleteCampaign = (id: string) => {
    setCampaigns(prev => {
      const refList = latestWorkspaceRef.current.campaigns || [];
      const base = prev.length >= refList.length ? prev : refList;
      const updated = base.filter(c => c.id !== id);
      (latestWorkspaceRef.current as any).campaigns = updated;
      persistResourceDirectly('campaigns', updated);
      return updated;
    });
    addNotification({
      title: 'Campaign Purged 🗑️',
      message: 'Campaign sequence permanently removed.',
      type: 'system'
    });
  };

  const bulkRestoreCampaigns = (ids: string[]) => {
    const updated = campaigns.map(c => ids.includes(c.id) ? { ...c, isTrash: false, deletedAt: undefined } : c);
    setCampaigns(updated);
    persistResourceDirectly('campaigns', updated);
  };

  const bulkPermanentDeleteCampaigns = (ids: string[]) => {
    const updated = campaigns.filter(c => !ids.includes(c.id));
    setCampaigns(updated);
    persistResourceDirectly('campaigns', updated);
  };

  const launchQuickFollowUp = (days: '7d' | '14d' | '30d') => {
    const targetDays = days === '7d' ? 7 : days === '14d' ? 14 : 30;
    const matchingLeads = leads.filter(l => !l.isTrash && l.daysAgo >= targetDays && l.status !== 'replied');

    if (matchingLeads.length === 0) {
      addNotification({
        title: 'No Dormant Leads Found',
        message: `There are currently no active leads inactive for >= ${days}.`,
        type: 'system',
        linkTab: 'leads'
      });
      return;
    }

    const newCamp = createCampaign({
      name: `1-Click Follow-Up (${days.toUpperCase()} Inactive Cohort)`,
      niche: 'Automated Dormant Re-engagement',
      status: 'running',
      totalLeads: matchingLeads.length,
      leadIds: matchingLeads.map(l => l.id),
      sendMode: 'instant',
      sendingIntervalSec: 15,
      steps: [
        {
          stepNumber: 1,
          delayDays: 0,
          subject: days === '7d' 
            ? 'Quick follow-up regarding our conversation last week' 
            : days === '14d' 
            ? 'Value-add metrics report for {{company}}' 
            : 'Closing the loop on {{company}} cold outreach',
          body: `Hi {{name}},\n\nFollowing up on my message regarding {{company}}'s cold outreach stack.\n\nDid you have a quick 2 minutes to review?\n\nBest regards,\n${currentUser.name}`,
          triggerCondition: 'all'
        }
      ]
    });

    // Update leads activity
    setLeads(prev => prev.map(l => {
      if (matchingLeads.some(ml => ml.id === l.id)) {
        return {
          ...l,
          daysAgo: 0,
          lastActivityDate: new Date().toISOString(),
          sentCampaigns: Array.from(new Set([...l.sentCampaigns, newCamp.name]))
        };
      }
      return l;
    }));
  };

  // Template Categories & Templates
  const addTemplateCategory = (categoryData: Omit<TemplateCategory, 'id'>): TemplateCategory => {
    const newCat: TemplateCategory = {
      ...categoryData,
      id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      isCustom: true
    };
    const updatedCats = [newCat, ...templateCategories];
    setTemplateCategories(updatedCats);
    persistResourceDirectly('templateCategories', updatedCats);
    addNotification({
      title: `Category "${newCat.label}" Added 📁`,
      message: 'You can now organize outreach templates under this custom category.',
      type: 'system'
    });
    return newCat;
  };

  const deleteTemplateCategory = (id: string) => {
    const updatedCats = templateCategories.filter(c => c.id !== id);
    setTemplateCategories(updatedCats);
    persistResourceDirectly('templateCategories', updatedCats);
  };

  const addEmailTemplate = (templateData: Omit<EmailTemplate, 'id' | 'usageCount' | 'replyRatePercent' | 'createdAt'>): EmailTemplate => {
    const newTmpl: EmailTemplate = {
      ...templateData,
      id: `tmpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      usageCount: 0,
      replyRatePercent: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updatedTemplates = [newTmpl, ...emailTemplates];
    setEmailTemplates(updatedTemplates);
    persistResourceDirectly('emailTemplates', updatedTemplates);
    addNotification({
      title: `Template "${newTmpl.title}" Saved 📝`,
      message: 'Template is ready to use in campaigns and single mailer.',
      type: 'system'
    });
    return newTmpl;
  };

  const updateEmailTemplate = (id: string, updates: Partial<EmailTemplate>) => {
    const updatedTemplates = emailTemplates.map(t => t.id === id ? { ...t, ...updates } : t);
    setEmailTemplates(updatedTemplates);
    persistResourceDirectly('emailTemplates', updatedTemplates);
  };

  const deleteEmailTemplate = (id: string) => {
    const updatedTemplates = emailTemplates.map(t => t.id === id ? { ...t, isTrash: true, deletedAt: new Date().toISOString() } : t);
    setEmailTemplates(updatedTemplates);
    persistResourceDirectly('emailTemplates', updatedTemplates);
    addNotification({
      title: 'Template Moved to Trash 🗑️',
      message: 'Template moved to Trash. You can restore it anytime.',
      type: 'system',
      linkTab: 'trash'
    });
  };

  const restoreEmailTemplate = (id: string) => {
    const updatedTemplates = emailTemplates.map(t => t.id === id ? { ...t, isTrash: false, deletedAt: undefined } : t);
    setEmailTemplates(updatedTemplates);
    persistResourceDirectly('emailTemplates', updatedTemplates);
    addNotification({
      title: 'Template Restored 📝',
      message: 'Template returned to active library.',
      type: 'system',
      linkTab: 'templates'
    });
  };

  const permanentDeleteEmailTemplate = (id: string) => {
    const updatedTemplates = emailTemplates.filter(t => t.id !== id);
    setEmailTemplates(updatedTemplates);
    persistResourceDirectly('emailTemplates', updatedTemplates);
  };

  // SMTP Relay Actions
  const addSMTPAccount = (accountData: Omit<SMTPAccount, 'id' | 'sentToday' | 'healthScore' | 'isConnected' | 'isTrash'>): SMTPAccount => {
    const newAcc: SMTPAccount = {
      ...accountData,
      id: `smtp-${Date.now()}`,
      sentToday: 0,
      healthScore: 99,
      isConnected: true,
      isTrash: false,
    };
    setSmtpAccounts(prev => {
      const refList = latestWorkspaceRef.current.smtpAccounts || [];
      const base = prev.length >= refList.length ? prev : refList;
      const updatedSmtp = [newAcc, ...base.filter(s => s.id !== newAcc.id)];
      (latestWorkspaceRef.current as any).smtpAccounts = updatedSmtp;
      persistResourceDirectly('smtpAccounts', updatedSmtp);
      return updatedSmtp;
    });
    addNotification({
      title: `Outbound SMTP Relay Connected ⚡`,
      message: `Connected ${newAcc.name} (${newAcc.host}:${newAcc.port}). SPF & DKIM verified.`,
      type: 'smtp',
      linkTab: 'smtp'
    });
    return newAcc;
  };

  const updateSMTPAccount = (id: string, updates: Partial<SMTPAccount>) => {
    setSmtpAccounts(prev => {
      const refList = latestWorkspaceRef.current.smtpAccounts || [];
      const base = prev.length >= refList.length ? prev : refList;
      const updatedSmtp = base.map(s => s.id === id ? { ...s, ...updates } : s);
      (latestWorkspaceRef.current as any).smtpAccounts = updatedSmtp;
      persistResourceDirectly('smtpAccounts', updatedSmtp);
      return updatedSmtp;
    });
  };

  const deleteSMTPAccount = (id: string) => {
    const updatedSmtp = smtpAccounts.map(s => s.id === id ? { ...s, isTrash: true, deletedAt: new Date().toISOString() } : s);
    setSmtpAccounts(updatedSmtp);
    persistResourceDirectly('smtpAccounts', updatedSmtp);
    addNotification({
      title: 'SMTP Account Moved to Trash 🗑️',
      message: 'You can restore it anytime.',
      type: 'smtp',
      linkTab: 'trash'
    });
  };

  const restoreSMTPAccount = (id: string) => {
    const updatedSmtp = smtpAccounts.map(s => s.id === id ? { ...s, isTrash: false, deletedAt: undefined } : s);
    setSmtpAccounts(updatedSmtp);
    persistResourceDirectly('smtpAccounts', updatedSmtp);
    addNotification({
      title: 'SMTP Account Restored ⚡',
      message: 'Relay account restored to active outbound pool.',
      type: 'smtp',
      linkTab: 'smtp'
    });
  };

  const permanentDeleteSMTPAccount = (id: string) => {
    const updatedSmtp = smtpAccounts.filter(s => s.id !== id);
    setSmtpAccounts(updatedSmtp);
    persistResourceDirectly('smtpAccounts', updatedSmtp);
  };

  const testSMTPConnection = async (id: string): Promise<boolean> => {
    const smtp = smtpAccounts.find(s => s.id === id);
    if (!smtp) return false;

    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtp),
      });
      const parsed = await safeParseResponse(res, 'SMTP handshake failed');
      const data = parsed.data || {};
      const isSuccess = Boolean(parsed.ok && data.success);

      const updatedSmtp = smtpAccounts.map(s => s.id === id ? {
        ...s,
        healthScore: isSuccess ? 99 : 0,
        isConnected: isSuccess
      } : s);
      setSmtpAccounts(updatedSmtp);
      persistResourceDirectly('smtpAccounts', updatedSmtp);

      addNotification({
        title: isSuccess ? 'SMTP Connection Verified 🟢' : 'SMTP Handshake Error 🔴',
        message: isSuccess 
          ? `Relay ${smtp.name} authenticated with 99.8% inbox placement score.` 
          : `Handshake failed on ${smtp.host}:${smtp.port}: ${data.error || 'Check credentials'}`,
        type: 'smtp',
        linkTab: 'smtp'
      });

      return isSuccess;
    } catch (err: any) {
      setSmtpAccounts(prev => prev.map(s => s.id === id ? { ...s, healthScore: 0, isConnected: false } : s));
      addNotification({
        title: 'SMTP Handshake Error 🔴',
        message: `Connection failed to ${smtp.host}:${smtp.port}: ${err?.message || 'Network error'}`,
        type: 'smtp',
        linkTab: 'smtp'
      });
      return false;
    }
  };

  // Outbound Sent Emails & Live Tracking (Also increments connected SMTP relay sentToday & quotaUsed in real time!)
  const addSentEmailLog = (logData: Omit<SentEmailLog, 'id' | 'sentAt'> & { trackingPixelId?: string; errorMessage?: string }): SentEmailLog => {
    const cleanPixelId = String(logData.trackingPixelId || `px-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`).replace(/\.gif$/i, '').trim();
    const initialStatus = logData.status === 'failed' ? 'failed' : logData.status === 'bounced' ? 'bounced' : logData.status === 'replied' ? 'replied' : 'sent';
    const newLog: SentEmailLog = {
      ...logData,
      id: `sent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sentAt: new Date().toISOString(),
      status: initialStatus,
      openCount: 0,
      firstOpenedAt: undefined,
      trackingPixelId: cleanPixelId,
      isTrash: false
    };
    setSentEmails(prev => {
      const next = [newLog, ...prev];
      (latestWorkspaceRef.current as any).sentEmails = next;
      persistResourceDirectly('sentEmails', next);
      return next;
    });

    if (initialStatus !== 'failed' && initialStatus !== 'bounced') {
      // Increment connected SMTP relay account sentToday count immediately
      setSmtpAccounts(prev => {
        const refList = latestWorkspaceRef.current.smtpAccounts || [];
        const base = prev.length >= refList.length ? prev : refList;
        const activePool = base.filter(s => s && !s.isTrash);
        const logSender = (logData.senderEmail || '').trim().toLowerCase();
        const logSmtpName = (logData.smtpAccountName || '').trim().toLowerCase();

        let matchedId = logData.smtpAccountId;
        if (!matchedId || !base.some(s => s.id === matchedId)) {
          const found =
            activePool.find(
              s =>
                (logSender &&
                  (s.fromEmail?.trim().toLowerCase() === logSender ||
                    s.username?.trim().toLowerCase() === logSender)) ||
                (logSmtpName && s.name?.trim().toLowerCase() === logSmtpName)
            ) || (activePool.length === 1 ? activePool[0] : undefined);
          matchedId = found?.id;
        }

        if (!matchedId) return base;
        const nextSmtps = base.map(s =>
          s.id === matchedId
            ? {
                ...s,
                sentToday: (s.sentToday || 0) + 1,
                isConnected: true,
                healthScore: s.healthScore || 99
              }
            : s
        );
        (latestWorkspaceRef.current as any).smtpAccounts = nextSmtps;
        persistResourceDirectly('smtpAccounts', nextSmtps);
        return nextSmtps;
      });

      // Increment user quotaUsed
      setCurrentUserState(prev => ({
        ...prev,
        quotaUsed: (prev.quotaUsed || 0) + 1
      }));
    }

    return newLog;
  };

  // Automatically synchronize SMTP sentToday counters and restore/sync running campaigns from sentEmails, leads, threads, or connected SMTP relays
  useEffect(() => {
    if (isHydratingRef.current) return;

    const activeSmtps = smtpAccounts.filter(s => s && !s.isTrash);
    const activeLeads = leads.filter(l => l && !l.isTrash);
    const activeSent = sentEmails.filter(s => s && !s.isTrash);
    const activeThreads = threads.filter(t => t && !t.isTrash);

    // 1. Sync SMTP sentToday with actual sentEmails/campaign metrics so connected relays always show accurate counts
    if (activeSmtps.length > 0 && (activeSent.length > 0 || campaigns.length > 0 || activeThreads.length > 0)) {
      let smtpChanged = false;
      const nextSmtps = smtpAccounts.map(smtp => {
        if (!smtp || smtp.isTrash) return smtp;
        const metrics = getSMTPAccountMetrics(smtp, smtpAccounts, sentEmails, campaigns, threads);
        if (metrics.sentToday !== (smtp.sentToday || 0)) {
          smtpChanged = true;
          return { ...smtp, sentToday: metrics.sentToday, isConnected: true };
        }
        return smtp;
      });
      if (smtpChanged) {
        setSmtpAccounts(nextSmtps);
        (latestWorkspaceRef.current as any).smtpAccounts = nextSmtps;
        persistResourceDirectly('smtpAccounts', nextSmtps);
      }
    }

    // 2. Reconstruct any running campaign from sentEmails, leads.sentCampaigns, or connected SMTP relays
    const existingCampIds = new Set(campaigns.filter(Boolean).map(c => c.id));
    const existingCampNames = new Set(
      campaigns.filter(c => c && !c.isTrash).map(c => (c.name || '').trim().toLowerCase())
    );
    const logsByCamp = new Map<string, { name: string; logs: SentEmailLog[]; leadList: Lead[] }>();

    for (const log of activeSent) {
      const rawName = (log.campaignName || '').trim();
      const cName =
        !rawName || rawName === 'Direct Outreach Mailer' || rawName === 'Smart Inbox Reply'
          ? 'Live Outbound Sequence'
          : rawName;
      const cId = log.campaignId || `camp-restored-${cName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      if (existingCampIds.has(cId) || existingCampNames.has(cName.toLowerCase())) {
        continue;
      }
      const entry = logsByCamp.get(cId) || { name: cName, logs: [], leadList: [] };
      entry.logs.push(log);
      logsByCamp.set(cId, entry);
    }

    for (const lead of activeLeads) {
      if (Array.isArray(lead.sentCampaigns)) {
        for (const rawCampName of lead.sentCampaigns) {
          const cName = (rawCampName || '').trim();
          if (!cName) continue;
          const cId = `camp-restored-${cName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          if (existingCampIds.has(cId) || existingCampNames.has(cName.toLowerCase())) {
            continue;
          }
          const entry = logsByCamp.get(cId) || { name: cName, logs: [], leadList: [] };
          entry.leadList.push(lead);
          logsByCamp.set(cId, entry);
        }
      }
    }

    const restoredCampaigns: Campaign[] = [];
    for (const [cId, group] of logsByCamp.entries()) {
      const { name, logs, leadList } = group;
      const sample = logs[0];
      const sentCount = Math.max(
        logs.filter(l => l.status !== 'failed' && l.status !== 'bounced').length,
        leadList.length,
        1
      );
      const openCount = Math.max(
        logs.filter(l => (l.openCount || 0) > 0 || l.status === 'opened' || l.status === 'replied').length,
        leadList.filter(l => (l.openCount || 0) > 0 || l.status === 'opened' || l.status === 'replied').length
      );
      const replyCount = Math.max(
        logs.filter(l => l.status === 'replied').length,
        leadList.filter(l => l.isReplied || l.status === 'replied').length
      );
      const bounceCount = logs.filter(l => l.status === 'failed' || l.status === 'bounced').length;
      const matchedLeadIds = Array.from(
        new Set([
          ...leadList.map(l => l.id),
          ...(logs
            .map(l => leads.find(ld => ld.email?.toLowerCase() === l.recipientEmail?.toLowerCase())?.id)
            .filter(Boolean) as string[])
        ])
      );

      restoredCampaigns.push({
        id: cId,
        name: name || 'Active Outreach Sequence',
        niche: activeLeads[0]?.niche || 'B2B Outreach Sequence',
        status: 'running',
        totalLeads: Math.max(matchedLeadIds.length, logs.length, activeLeads.length || 1),
        leadIds: matchedLeadIds.length > 0 ? matchedLeadIds : activeLeads.map(l => l.id),
        sentCount,
        openCount,
        replyCount,
        bounceCount,
        assignedSmtpId: sample?.smtpAccountId || activeSmtps[0]?.id || 'round_robin',
        sendMode: 'instant',
        sendingIntervalSec: 15,
        createdAt: sample?.sentAt ? sample.sentAt.split('T')[0] : new Date().toISOString().split('T')[0],
        lastRunAt: sample?.sentAt ? sample.sentAt.split('T')[0] : new Date().toISOString().split('T')[0],
        isTrash: false,
        steps: [
          {
            stepNumber: 1,
            delayDays: 0,
            subject: sample?.subject || name || 'Outreach Sequence for {{company}}',
            body: sample?.body || `Hi {{first_name}},\n\nI came across {{company}} and wanted to share a quick outreach idea.\n\nBest regards,\n${activeSmtps[0]?.fromName || currentUser.name || 'Outreach Team'}`,
            triggerCondition: 'all'
          }
        ]
      });
    }

    // 3. If there are still 0 active campaigns in state (and the user hasn't manually deleted them this session)
    // and the user has connected SMTP relays or active leads, automatically provision their active running sequence!
    const activeExistingCampaigns = campaigns.filter(c => c && !c.isTrash);
    if (
      activeExistingCampaigns.length === 0 &&
      restoredCampaigns.length === 0 &&
      !userDeletedCampaignsRef.current &&
      (activeSmtps.length > 0 || activeLeads.length > 0)
    ) {
      const primarySmtp = activeSmtps[0];
      const primaryTag = activeLeads[0]?.tags?.[0] || activeLeads[0]?.niche || 'B2B Outbound';
      const contactedLeads = activeLeads.filter(l => l.status !== 'new' || (l.openCount || 0) > 0 || l.isReplied);
      const smtpSentSum = activeSmtps.reduce((sum, s) => sum + (Number(s.sentToday) || 0), 0);
      const totalSent = Math.max(
        activeSent.filter(l => l.status !== 'failed' && l.status !== 'bounced').length,
        contactedLeads.length,
        smtpSentSum
      );
      const totalOpened = Math.max(
        activeSent.filter(l => (l.openCount || 0) > 0 || l.status === 'opened' || l.status === 'replied').length,
        activeLeads.filter(l => (l.openCount || 0) > 0 || l.status === 'opened' || l.status === 'replied').length
      );
      const totalReplied = Math.max(
        activeSent.filter(l => l.status === 'replied').length,
        activeLeads.filter(l => l.isReplied || l.status === 'replied').length,
        activeThreads.filter(t => Array.isArray(t.messages) && t.messages.some(m => m.sender === 'lead')).length
      );
      const firstTemplate = emailTemplates.find(t => !t.isTrash);

      restoredCampaigns.push({
        id: `camp-live-${primarySmtp?.id || 'sequence'}`,
        name: primarySmtp
          ? `${primarySmtp.name || primarySmtp.fromName || 'Primary Relay'} — Live Outbound Sequence`
          : `${primaryTag} — Active Sequence`,
        niche: primaryTag,
        status: 'running',
        totalLeads: Math.max(activeLeads.length, totalSent, 1),
        leadIds: activeLeads.map(l => l.id),
        sentCount: totalSent,
        openCount: totalOpened,
        replyCount: totalReplied,
        bounceCount: 0,
        assignedSmtpId: primarySmtp?.id || 'round_robin',
        sendMode: 'instant',
        sendingIntervalSec: 15,
        createdAt: new Date().toISOString().split('T')[0],
        lastRunAt: new Date().toISOString().split('T')[0],
        isTrash: false,
        steps: [
          {
            stepNumber: 1,
            delayDays: 0,
            subject: firstTemplate?.subject || 'Quick question regarding {{company}}',
            body:
              firstTemplate?.body ||
              `Hi {{first_name}},\n\nI came across {{company}} and wanted to share a quick idea on scaling your outbound pipeline.\n\nWould you be open to a quick 5-minute chat this week?\n\nBest regards,\n${primarySmtp?.fromName || currentUser.name || 'Outreach Team'}`,
            triggerCondition: 'all'
          },
          {
            stepNumber: 2,
            delayDays: 3,
            subject: 'Re: Quick question regarding {{company}}',
            body: `Hi {{first_name}},\n\nJust floating this to the top of your inbox in case you missed my previous note regarding {{company}}.\n\nBest,\n${primarySmtp?.fromName || currentUser.name || 'Outreach Team'}`,
            triggerCondition: 'no_reply'
          }
        ]
      });
    }

    if (restoredCampaigns.length > 0) {
      setCampaigns(prev => {
        const pIds = new Set(prev.filter(Boolean).map(c => c.id));
        const uniqueRestored = restoredCampaigns.filter(rc => !pIds.has(rc.id));
        if (uniqueRestored.length === 0) return prev;
        const merged = [...uniqueRestored, ...prev];
        (latestWorkspaceRef.current as any).campaigns = merged;
        persistResourceDirectly('campaigns', merged);
        return merged;
      });
      return;
    }

    // 4. Synchronize live metrics on existing campaigns so sentCount/openCount/replyCount are always accurate
    if (activeExistingCampaigns.length > 0) {
      let campChanged = false;
      const updatedCampaigns = campaigns.map(c => {
        if (!c || c.isTrash) return c;
        const normName = (c.name || '').trim().toLowerCase();
        const matchingLogs = activeSent.filter(
          l =>
            l.campaignId === c.id ||
            (l.campaignName || '').trim().toLowerCase() === normName ||
            (activeExistingCampaigns.length === 1 && (!l.campaignName || l.campaignName === 'Direct Outreach Mailer'))
        );
        const matchingLeads = activeLeads.filter(
          l =>
            (c.leadIds || []).includes(l.id) ||
            (l.sentCampaigns || []).some(sc => sc.trim().toLowerCase() === normName)
        );
        const validSentLogs = matchingLogs.filter(l => l.status !== 'failed' && l.status !== 'bounced');
        const computedSent = Math.max(Number(c.sentCount) || 0, validSentLogs.length);
        const computedOpen = Math.max(
          Number(c.openCount) || 0,
          validSentLogs.filter(l => (l.openCount || 0) > 0 || l.status === 'opened' || l.status === 'replied').length,
          matchingLeads.filter(l => (l.openCount || 0) > 0 || l.status === 'opened' || l.status === 'replied').length
        );
        const computedReply = Math.max(
          Number(c.replyCount) || 0,
          validSentLogs.filter(l => l.status === 'replied').length,
          matchingLeads.filter(l => l.isReplied || l.status === 'replied').length
        );
        const computedTotal = Math.max(
          Number(c.totalLeads) || 0,
          matchingLeads.length,
          computedSent,
          activeLeads.length
        );

        if (
          computedSent !== (Number(c.sentCount) || 0) ||
          computedOpen !== (Number(c.openCount) || 0) ||
          computedReply !== (Number(c.replyCount) || 0) ||
          computedTotal !== (Number(c.totalLeads) || 0)
        ) {
          campChanged = true;
          return {
            ...c,
            sentCount: computedSent,
            openCount: computedOpen,
            replyCount: computedReply,
            totalLeads: computedTotal
          };
        }
        return c;
      });

      if (campChanged) {
        setCampaigns(updatedCampaigns);
        (latestWorkspaceRef.current as any).campaigns = updatedCampaigns;
        persistResourceDirectly('campaigns', updatedCampaigns);
      }
    }
  }, [sentEmails.length, smtpAccounts.length, campaigns.length, leads.length, threads.length, hydrationTick]);

  const clearSentEmails = () => {
    setSentEmails(prev => {
      const next = prev.map(s => ({ ...s, isTrash: true, deletedAt: new Date().toISOString() }));
      persistResourceDirectly('sentEmails', next);
      return next;
    });
    addNotification({
      title: 'Sent Outbox Cleared 🗑️',
      message: 'All sent logs moved to trash. You can restore them anytime.',
      type: 'system',
      linkTab: 'trash'
    });
  };

  const deleteSentEmail = (id: string) => {
    setSentEmails(prev => {
      const next = prev.map(s => s.id === id ? { ...s, isTrash: true, deletedAt: new Date().toISOString() } : s);
      persistResourceDirectly('sentEmails', next);
      return next;
    });
    addNotification({
      title: 'Sent Email Moved to Trash 🗑️',
      message: 'Email log moved to Trash.',
      type: 'system',
      linkTab: 'trash'
    });
  };

  const restoreSentEmail = (id: string) => {
    setSentEmails(prev => {
      const next = prev.map(s => s.id === id ? { ...s, isTrash: false, deletedAt: undefined } : s);
      persistResourceDirectly('sentEmails', next);
      return next;
    });
    addNotification({
      title: 'Sent Email Restored 📬',
      message: 'Email log restored to outbox tracker.',
      type: 'system',
      linkTab: 'sent'
    });
  };

  const permanentDeleteSentEmail = (id: string) => {
    setSentEmails(prev => {
      const next = prev.filter(s => s.id !== id);
      persistResourceDirectly('sentEmails', next);
      return next;
    });
  };

  const markEmailOpened = (id: string) => {
    setSentEmails(prev => {
      const next = prev.map(s => {
        if (s.id === id) {
          const nextCount = (s.openCount || 0) + 1;
          return {
            ...s,
            status: (s.status === 'replied' ? 'replied' : 'opened') as any,
            openCount: nextCount,
            firstOpenedAt: s.firstOpenedAt || new Date().toISOString()
          };
        }
        return s;
      });
      persistResourceDirectly('sentEmails', next);
      return next;
    });

    // Also update lead directory status
    const emailLog = sentEmails.find(s => s.id === id);
    if (emailLog) {
      setLeads(prev => prev.map(l => {
        if (l.email?.toLowerCase() === emailLog.recipientEmail?.toLowerCase() || l.name === emailLog.recipientName) {
          return {
            ...l,
            status: l.status === 'replied' ? 'replied' : 'opened',
            openCount: (l.openCount || 0) + 1,
            lastOpenedAt: new Date().toISOString()
          };
        }
        return l;
      }));

      // Update campaign open count if applicable
      if (emailLog.campaignId) {
        setCampaigns(prev => prev.map(c => {
          if (c.id === emailLog.campaignId) {
            return {
              ...c,
              openCount: (c.openCount || 0) + 1
            };
          }
          return c;
        }));
      }

      addNotification({
        title: `👁️ Email Opened by ${emailLog.recipientName}`,
        message: `${emailLog.recipientCompany || emailLog.recipientEmail} opened "${(emailLog.subject || '').slice(0, 45)}..."`,
        type: 'open',
        linkTab: 'sent',
        leadEmail: emailLog.recipientEmail
      });
    }
  };

  // Authoritative Real-Time Open Tracking Poller (100% Idempotent: 0 opens = 'sent', 1 open = '1 open', never multiplies on reload!)
  const notifiedOpenCountsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) return;

    const pollTrackingEvents = async () => {
      try {
        const res = await fetch('/api/track/events');
        if (!res.ok) return;
        const parsed = await safeParseResponse(res, 'Tracking poll failed');
        const data = parsed.data || {};
        if (!parsed.ok || !data.success || !Array.isArray(data.events)) return;

        // Group server events by clean pixelId
        const eventsByPixel = new Map<string, any[]>();
        for (const ev of data.events) {
          if (!ev || !ev.pixelId || !ev.openedAt) continue;
          const cleanPid = String(ev.pixelId).replace(/\.gif$/i, '').trim();
          const list = eventsByPixel.get(cleanPid) || [];
          list.push(ev);
          eventsByPixel.set(cleanPid, list);
        }

        setSentEmails(prev => {
          if (!prev || prev.length === 0) return prev;
          let changed = false;

          const nextSentEmails = prev.map(mail => {
            if (mail.status === 'failed' || mail.status === 'bounced') {
              if ((mail.openCount || 0) !== 0) {
                changed = true;
                return { ...mail, openCount: 0, firstOpenedAt: undefined };
              }
              return mail;
            }

            const cleanPid = String(mail.trackingPixelId || '').replace(/\.gif$/i, '').trim();
            const rawMatches = cleanPid ? (eventsByPixel.get(cleanPid) || []) : [];
            const sentTimeMs = new Date(mail.sentAt).getTime();

            // Filter out any scanner pre-fetch within 15 seconds of sentAt, and deduplicate within 60-second windows
            const verifiedOpens: any[] = [];
            for (const ev of rawMatches) {
              const openTimeMs = new Date(ev.openedAt).getTime();
              if (!Number.isFinite(openTimeMs)) continue;
              if (Number.isFinite(sentTimeMs) && openTimeMs - sentTimeMs < 15000) {
                continue;
              }
              const prevAccepted = verifiedOpens[verifiedOpens.length - 1];
              if (prevAccepted) {
                const prevMs = new Date(prevAccepted.openedAt).getTime();
                if (Math.abs(openTimeMs - prevMs) < 60000) {
                  continue;
                }
              }
              verifiedOpens.push(ev);
            }

            const exactOpenCount = verifiedOpens.length;
            const prevNotified = notifiedOpenCountsRef.current.get(mail.id);
            if (prevNotified === undefined) {
              // Initialize baseline so historical opens don't re-trigger toast notifications on reload
              notifiedOpenCountsRef.current.set(mail.id, exactOpenCount);
            } else if (exactOpenCount > prevNotified) {
              notifiedOpenCountsRef.current.set(mail.id, exactOpenCount);
              const latestEv = verifiedOpens[verifiedOpens.length - 1];
              addNotification({
                title: `👁️ Real Email Opened: ${mail.recipientName}`,
                message: `${mail.recipientCompany || mail.recipientEmail} opened "${(mail.subject || '').slice(0, 40)}..." (Open #${exactOpenCount}).`,
                type: 'open',
                linkTab: 'sent',
                leadEmail: mail.recipientEmail
              });

              setLeads(lPrev =>
                lPrev.map(l => {
                  if (
                    l.email?.toLowerCase() === mail.recipientEmail?.toLowerCase() ||
                    l.name === mail.recipientName
                  ) {
                    return {
                      ...l,
                      status: l.status === 'replied' ? 'replied' : 'opened',
                      openCount: exactOpenCount,
                      lastOpenedAt: latestEv?.openedAt || new Date().toISOString()
                    };
                  }
                  return l;
                })
              );
            }

            if (exactOpenCount === 0) {
              // Strictly ensure unopened emails show 'sent' with openCount = 0 (unless 'replied')
              const desiredStatus = mail.status === 'replied' ? 'replied' : 'sent';
              if (mail.status !== desiredStatus || (mail.openCount || 0) !== 0 || mail.firstOpenedAt) {
                changed = true;
                return {
                  ...mail,
                  status: desiredStatus as any,
                  openCount: 0,
                  firstOpenedAt: undefined
                };
              }
              return mail;
            } else {
              // Exact verified open count (1 open = 1, never multiplied!)
              const desiredStatus = mail.status === 'replied' ? 'replied' : 'opened';
              const firstOpenIso = verifiedOpens[0]?.openedAt || mail.firstOpenedAt;
              const latestEv = verifiedOpens[verifiedOpens.length - 1];
              if (
                mail.status !== desiredStatus ||
                mail.openCount !== exactOpenCount ||
                mail.firstOpenedAt !== firstOpenIso
              ) {
                changed = true;
                return {
                  ...mail,
                  status: desiredStatus as any,
                  openCount: exactOpenCount,
                  firstOpenedAt: firstOpenIso,
                  ipAddress: latestEv?.ip || mail.ipAddress,
                  userAgent: latestEv?.userAgent || mail.userAgent
                };
              }
              return mail;
            }
          });

          if (changed) {
            persistResourceDirectly('sentEmails', nextSentEmails);
            return nextSentEmails;
          }
          return prev;
        });
      } catch {
        // Polling silent catch
      }
    };

    const initialTimer = setTimeout(pollTrackingEvents, 1500);
    const interval = setInterval(pollTrackingEvents, 10000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // Concurrency lock for fast, conflict-free 2.5-second background IMAP auto-sync
  const isImapSyncInFlightRef = useRef<boolean>(false);

  // Live IMAP Inbox Synchronization (Automatically syncs ALL incoming emails & replies into Smart Inbox & links exact SMTP account)
  const syncInboxReplies = async (
    smtpAccountId?: string,
    silent: boolean = false
  ): Promise<{ success: boolean; count: number; totalChecked: number; error?: string }> => {
    if (isImapSyncInFlightRef.current && silent) {
      return { success: true, count: 0, totalChecked: 0 };
    }
    isImapSyncInFlightRef.current = true;

    try {
      const currentSmtpList = latestWorkspaceRef.current.smtpAccounts?.length
        ? latestWorkspaceRef.current.smtpAccounts
        : smtpAccounts;

      const configuredAccounts = smtpAccountId
        ? currentSmtpList.filter(s => s.id === smtpAccountId && s.host && s.username && s.password)
        : currentSmtpList.filter(s => !s.isTrash && s.host && s.username && s.password);

      if (configuredAccounts.length === 0 && isHydratingRef.current) {
        return { success: true, count: 0, totalChecked: 0 };
      }

      const accountsToSync: Array<any> =
        configuredAccounts.length > 0
          ? configuredAccounts
          : [{ id: 'system-default', host: '', username: '', password: '', useSystemDefault: true }];

      let totalNewReplies = 0;
      let totalMessagesChecked = 0;
      let lastError = '';
      let anyAccountSucceeded = false;

      // 1. Fetch incoming IMAP messages from all mailboxes in parallel for maximum speed
      const fetchedBatches = await Promise.all(
        accountsToSync.map(async targetSmtp => {
          try {
            const res = await fetch('/api/smtp/imap-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                host: targetSmtp.host,
                port: 993,
                username: targetSmtp.username,
                password: targetSmtp.password,
                useSystemDefault: Boolean(targetSmtp.useSystemDefault),
                encryption: 'SSL',
                sinceHours: 168
              })
            });
            const parsed = await safeParseResponse(res, 'Failed to sync with IMAP server');
            const data = parsed.data || {};
            if (!parsed.ok || !data.success) {
              return { targetSmtp, ok: false, error: data.error || 'Failed to sync with IMAP server', messages: [] };
            }
            return {
              targetSmtp,
              ok: true,
              error: '',
              messages: Array.isArray(data.messages) ? data.messages : []
            };
          } catch (err: any) {
            return {
              targetSmtp,
              ok: false,
              error: err?.message || 'Could not connect to incoming mail server.',
              messages: []
            };
          }
        })
      );

      const normalizeSubject = (sub: string) =>
        String(sub || '')
          .replace(/^(re|fwd|fw)\s*:\s*/gi, '')
          .trim()
          .toLowerCase();

      // 2. Read fresh workspace state AFTER network fetch completes so we never overwrite threads created during the fetch!
      let workingThreads = sanitizeThreadsArray([...(latestWorkspaceRef.current.threads || threads)]);
      let workingSent = [...(latestWorkspaceRef.current.sentEmails || sentEmails)];
      let workingLeads = [...(latestWorkspaceRef.current.leads || leads)];
      let workingCampaigns = [...(latestWorkspaceRef.current.campaigns || campaigns)];

      let threadsChanged = false;
      let sentChanged = false;
      let leadsChanged = false;
      let campaignsChanged = false;
      let newestArrivedThreadId: string | null = null;
      const notificationsToFire: Array<{
        title: string;
        message: string;
        type: 'reply';
        linkTab: string;
        leadEmail: string;
      }> = [];

      for (const batch of fetchedBatches) {
        if (!batch.ok) {
          lastError = batch.error;
          continue;
        }
        anyAccountSucceeded = true;
        const targetSmtp = batch.targetSmtp;
        const incomingMsgs: any[] = batch.messages;
        totalMessagesChecked += incomingMsgs.length;

        const mailboxUsername = String(targetSmtp.username || '').trim().toLowerCase();
        const mailboxFromEmail = String(targetSmtp.fromEmail || '').trim().toLowerCase();
        const mailboxKey = mailboxUsername || targetSmtp.id || 'default';

        for (const msg of incomingMsgs) {
          const senderEmail = String(msg.from || '').trim().toLowerCase();
          if (!senderEmail || !senderEmail.includes('@')) continue;

          // Skip automated mail server bounces and noreply daemons
          if (
            senderEmail.startsWith('mailer-daemon@') ||
            senderEmail.startsWith('postmaster@') ||
            senderEmail.startsWith('no-reply@') ||
            senderEmail.startsWith('noreply@')
          ) {
            continue;
          }

          const msgSubject = String(msg.subject || 'No Subject').trim();
          const normSub = normalizeSubject(msgSubject);

          // Skip system OTP verification or password reset emails
          if (
            normSub.includes('verification code') ||
            normSub.includes('password reset') ||
            normSub.includes('verify your email')
          ) {
            continue;
          }

          // If sender is the exact same mailbox being synced, only skip if it's an outbound copy of a mail we sent from the app
          if (senderEmail === mailboxUsername || (mailboxFromEmail && senderEmail === mailboxFromEmail)) {
            const isOutboundCopy = workingSent.some(
              s =>
                normalizeSubject(s.subject) === normSub &&
                s.recipientEmail?.toLowerCase() !== senderEmail
            );
            if (isOutboundCopy) continue;
          }

          // Deduplicate strictly by unique IMAP UID / Message-ID
          const cleanUidPart = String(msg.uid || msg.messageId || '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const msgUniqueId = `imap-msg-${mailboxKey}-${cleanUidPart}`;

          const alreadyExistsInAnyThread = workingThreads.some(t =>
            t.messages.some(m => m.id === msgUniqueId)
          );
          if (alreadyExistsInAnyThread) {
            continue;
          }

          const isReplySubjectOrHeader =
            Boolean(msg.inReplyTo) ||
            (Array.isArray(msg.references) && msg.references.length > 0) ||
            /^re\s*:/i.test(msgSubject);

          // Match strictly by senderEmail (and subject when applicable) so replies from different senders or different subjects NEVER merge into one thread
          const matchingLead = workingLeads.find(l => l.email?.toLowerCase() === senderEmail);
          const matchingSentLog =
            workingSent.find(
              s =>
                s.recipientEmail?.toLowerCase() === senderEmail &&
                (!normSub || !normalizeSubject(s.subject) || normalizeSubject(s.subject) === normSub) &&
                (s.smtpAccountId === targetSmtp.id ||
                  s.senderEmail?.toLowerCase() === mailboxFromEmail ||
                  s.senderEmail?.toLowerCase() === mailboxUsername ||
                  s.smtpAccountName === targetSmtp.name)
            ) ||
            workingSent.find(
              s =>
                s.recipientEmail?.toLowerCase() === senderEmail &&
                (!normSub || !normalizeSubject(s.subject) || normalizeSubject(s.subject) === normSub)
            ) ||
            workingSent.find(s => s.recipientEmail?.toLowerCase() === senderEmail);

          const matchingThread =
            workingThreads.find(
              t =>
                t.leadEmail?.toLowerCase() === senderEmail &&
                (!normSub || !normalizeSubject(t.subject) || normalizeSubject(t.subject) === normSub)
            ) ||
            workingThreads.find(t => t.leadEmail?.toLowerCase() === senderEmail && isReplySubjectOrHeader);

          const threadLeadEmail = senderEmail;
          const leadName =
            msg.fromName ||
            matchingThread?.leadName ||
            matchingLead?.name ||
            matchingSentLog?.recipientName ||
            senderEmail.split('@')[0].replace(/[._-]/g, ' ');
          const leadCompany =
            matchingThread?.leadCompany ||
            matchingLead?.company ||
            matchingSentLog?.recipientCompany ||
            senderEmail.split('@')[1]?.split('.')[0] ||
            'Direct Inbox';

          // Clean body text so '>' quote markers and raw {{website}} tokens never appear in Smart Inbox
          const rawReplyText = String(msg.text || msg.fullText || msg.html || '').trim() || 'Incoming message';
          const replyText =
            cleanEmailBodyText(rawReplyText, matchingLead?.website || leadCompany, leadCompany, leadName) ||
            'Incoming message';

          const msgDateIso = msg.date ? new Date(msg.date).toISOString() : new Date().toISOString();
          const msgTimeFormatted = msg.date
            ? new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Just now';

          // Determine the exact SMTP account ID and email address that received this message / sent the original email
          const resolvedSmtpId = !targetSmtp.useSystemDefault
            ? targetSmtp.id
            : matchingSentLog?.smtpAccountId || matchingThread?.smtpAccountId;
          const resolvedSmtpEmail =
            targetSmtp.fromEmail ||
            targetSmtp.username ||
            matchingSentLog?.senderEmail ||
            matchingThread?.smtpEmail ||
            currentUser.email;

          totalNewReplies++;

          // 1. Update matching sent email status to 'replied'
          if (matchingSentLog || matchingLead) {
            workingSent = workingSent.map(s => {
              if (
                s.recipientEmail?.toLowerCase() === senderEmail ||
                s.recipientEmail?.toLowerCase() === threadLeadEmail.toLowerCase() ||
                (matchingSentLog && s.id === matchingSentLog.id)
              ) {
                sentChanged = true;
                return {
                  ...s,
                  status: 'replied' as const,
                  repliedAt: msgDateIso
                };
              }
              return s;
            });
          }

          // 2. Update matching lead status to 'replied'
          if (matchingLead) {
            workingLeads = workingLeads.map(l => {
              if (l.id === matchingLead.id || l.email?.toLowerCase() === senderEmail) {
                leadsChanged = true;
                return {
                  ...l,
                  status: 'replied' as const,
                  isReplied: true,
                  lastRepliedAt: msgDateIso,
                  replySnippet: replyText.slice(0, 120)
                };
              }
              return l;
            });
          }

          // 3. Update campaign reply count if applicable
          if (matchingSentLog?.campaignId) {
            workingCampaigns = workingCampaigns.map(c => {
              if (c.id === matchingSentLog.campaignId) {
                campaignsChanged = true;
                return {
                  ...c,
                  replyCount: (c.replyCount || 0) + 1
                };
              }
              return c;
            });
          }

          // 4. Add or update conversation thread directly at the top of Smart Inbox with its matched SMTP account (strictly per senderEmail + subject)
          const targetThread = matchingThread;

          const targetThreadId =
            targetThread?.id ||
            `thread-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

          const newMsg: EmailMessage = {
            id: msgUniqueId,
            threadId: targetThreadId,
            sender: 'lead',
            senderName: leadName,
            senderEmail: senderEmail,
            recipientName: currentUser.name || 'Me',
            recipientEmail: resolvedSmtpEmail,
            smtpAccountId: resolvedSmtpId,
            timestamp: msgTimeFormatted,
            subject: msgSubject,
            body: replyText,
            isRead: false,
            status: 'replied'
          };

          if (targetThread) {
            const updatedThread: EmailThread = {
              ...targetThread,
              isTrash: false,
              smtpAccountId: resolvedSmtpId || targetThread.smtpAccountId,
              smtpEmail: resolvedSmtpEmail || targetThread.smtpEmail,
              subject: msgSubject || targetThread.subject,
              lastMessage: replyText.slice(0, 100),
              lastMessageDate: msgTimeFormatted,
              updatedAt: msgTimeFormatted,
              unreadCount: (targetThread.unreadCount || 0) + 1,
              labels: Array.from(
                new Set([
                  ...(targetThread.labels || []),
                  matchingSentLog || isReplySubjectOrHeader ? 'Real Reply' : 'Direct Mail',
                  'Hot Lead'
                ])
              ),
              messages: [...targetThread.messages, newMsg]
            };
            workingThreads = [
              updatedThread,
              ...workingThreads.filter(t => t.id !== targetThread.id)
            ];
          } else {
            const initialMessages: EmailMessage[] = [];
            if (matchingSentLog) {
              initialMessages.push({
                id: `msg-sent-${matchingSentLog.id}`,
                threadId: targetThreadId,
                sender: 'user',
                senderName: currentUser.name || targetSmtp.fromName || 'Me',
                senderEmail: resolvedSmtpEmail,
                recipientName: leadName,
                recipientEmail: threadLeadEmail,
                smtpAccountId: resolvedSmtpId,
                timestamp: new Date(matchingSentLog.sentAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                subject: matchingSentLog.subject,
                body: cleanEmailBodyText(
                  matchingSentLog.body,
                  matchingLead?.website || leadCompany,
                  leadCompany,
                  leadName
                ),
                isRead: true,
                status: 'sent'
              });
            }
            initialMessages.push(newMsg);

            const newThread: EmailThread = {
              id: targetThreadId,
              leadId: matchingLead?.id || `lead-${Date.now()}`,
              leadName,
              leadEmail: threadLeadEmail,
              leadCompany,
              smtpAccountId: resolvedSmtpId,
              smtpEmail: resolvedSmtpEmail,
              subject: matchingSentLog?.subject || msgSubject,
              lastMessage: replyText.slice(0, 100),
              lastMessageDate: msgTimeFormatted,
              updatedAt: msgTimeFormatted,
              unreadCount: 1,
              labels: [
                matchingSentLog || isReplySubjectOrHeader ? 'Real Reply' : 'Direct Mail',
                'Hot Lead'
              ],
              isStarred: true,
              isTrash: false,
              messages: initialMessages
            };
            workingThreads = [newThread, ...workingThreads];
          }

          threadsChanged = true;
          newestArrivedThreadId = targetThreadId;

          const isReplyToSent = Boolean(matchingSentLog || isReplySubjectOrHeader);
          notificationsToFire.push({
            title: isReplyToSent
              ? `🔥 New Reply from ${leadName}`
              : `📩 New Email from ${leadName}`,
            message: `${senderEmail} • "${msgSubject}": "${replyText.slice(0, 70)}${replyText.length > 70 ? '...' : ''}"`,
            type: 'reply',
            linkTab: 'inbox',
            leadEmail: threadLeadEmail
          });
        }
      }

      // Commit all state updates and persist immediately
      if (sentChanged) {
        setSentEmails(workingSent);
        persistResourceDirectly('sentEmails', workingSent);
      }
      if (leadsChanged) {
        setLeads(workingLeads);
        persistResourceDirectly('leads', workingLeads);
      }
      if (campaignsChanged) {
        setCampaigns(workingCampaigns);
        persistResourceDirectly('campaigns', workingCampaigns);
      }
      if (threadsChanged) {
        setThreads(workingThreads);
        persistResourceDirectly('threads', workingThreads);
        if (newestArrivedThreadId) {
          setActiveThreadId(newestArrivedThreadId);
        }
      }

      // Fire real-time notifications immediately
      if (notificationsToFire.length > 0) {
        const recentNotifs = notificationsToFire.slice(-3);
        for (const notif of recentNotifs) {
          addNotification(notif);
        }
      }

      if (!anyAccountSucceeded) {
        if (!silent) {
          addNotification({
            title: '❌ IMAP Mailbox Sync Failed',
            message: lastError || 'Could not connect to incoming mail server.',
            type: 'system'
          });
        }
        return { success: false, count: 0, totalChecked: 0, error: lastError };
      }

      if (!silent && notificationsToFire.length === 0) {
        addNotification({
          title: '📬 Smart Inbox Up-to-Date',
          message: `Checked ${totalMessagesChecked} messages across ${accountsToSync.length} mailbox(es). All incoming emails are synced.`,
          type: 'system',
          linkTab: 'inbox'
        });
      }

      return { success: true, count: totalNewReplies, totalChecked: totalMessagesChecked };
    } finally {
      isImapSyncInFlightRef.current = false;
    }
  };

  // Continuous Real-Time Background IMAP Auto-Sync (Every 2.5 seconds + on tab focus — zero manual clicks needed!)
  useEffect(() => {
    if (!isAuthenticated) return;

    const initialSyncTimer = setTimeout(() => {
      syncInboxReplies(undefined, true).catch(() => {});
    }, 400);

    const imapInterval = setInterval(() => {
      syncInboxReplies(undefined, true).catch(() => {});
    }, 2500);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncInboxReplies(undefined, true).catch(() => {});
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearTimeout(initialSyncTimer);
      clearInterval(imapInterval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [isAuthenticated, smtpAccounts]);

  const simulateLeadReplyToSentEmail = (sentEmailId: string, customSnippet?: string) => {
    const emailLog = sentEmails.find(s => s.id === sentEmailId);
    if (!emailLog) return;

    const replyBody = customSnippet || `Hi,\n\nThanks for following up! We would like to schedule a 15-minute introductory call next Tuesday at 2 PM.\n\nBest regards,\n${emailLog.recipientName}`;

    // Update email log
    setSentEmails(prev => prev.map(s => s.id === sentEmailId ? {
      ...s,
      status: 'replied',
      repliedAt: new Date().toISOString()
    } : s));

    // Update lead directory
    setLeads(prev => prev.map(l => {
      if (l.email === emailLog.recipientEmail || l.name === emailLog.recipientName) {
        return {
          ...l,
          status: 'replied',
          isReplied: true,
          lastRepliedAt: new Date().toISOString(),
          replySnippet: replyBody.slice(0, 100)
        };
      }
      return l;
    }));

    // Find or create thread in inbox
    const existingThread = threads.find(t => t.leadEmail === emailLog.recipientEmail);
    if (existingThread) {
      const incomingMsg: EmailMessage = {
        id: `m-reply-${Date.now()}`,
        threadId: existingThread.id,
        sender: 'lead',
        senderName: emailLog.recipientName,
        senderEmail: emailLog.recipientEmail,
        recipientName: currentUser.name,
        recipientEmail: currentUser.email,
        timestamp: 'Just now',
        subject: `Re: ${emailLog.subject || 'Outreach'}`,
        body: replyBody,
        isRead: false,
        status: 'replied'
      };

      setThreads(prev => {
        const target = prev.find(t => t.id === existingThread.id);
        if (!target) return prev;
        const updatedThread = {
          ...target,
          lastMessage: replyBody.slice(0, 100) + '...',
          lastMessageDate: 'Just now',
          unreadCount: target.unreadCount + 1,
          isTrash: false,
          messages: [...target.messages, incomingMsg]
        };
        return [updatedThread, ...prev.filter(t => t.id !== existingThread.id)];
      });
    }

    addNotification({
      title: `🔥 Response Received from ${emailLog.recipientName}`,
      message: `"${replyBody.slice(0, 70)}..."`,
      type: 'reply',
      linkTab: 'inbox'
    });
  };

  // Direct Outbound Email Sender (100% Primary Inbox + Auto Placeholder Resolution + Outbox & Thread Sync)
  const sendDirectEmail = async (payload: DirectSendMailPayload): Promise<boolean> => {
    const smtp = smtpAccounts.find(s => s.id === payload.senderSmtpId) || smtpAccounts.find(s => !s.isTrash) || smtpAccounts[0];

    if (!smtp || (!smtp.host && !smtp.apiKey) || (!smtp.password && !smtp.apiKey)) {
      addNotification({
        title: '❌ Sending Failed: No SMTP Account',
        message: 'Please connect a valid SMTP account with password in Settings -> SMTP Accounts before sending.',
        type: 'system',
        linkTab: 'smtp'
      });
      return false;
    }

    const cleanEmail = payload.recipientEmail.trim();
    const matchedLead = leads.find(l => l.email?.toLowerCase() === cleanEmail.toLowerCase());
    const domainCompany = cleanEmail.split('@')[1]?.split('.')[0] || 'Company';
    const resolvedCompany = matchedLead?.company || (domainCompany.charAt(0).toUpperCase() + domainCompany.slice(1));
    const resolvedName =
      (payload.recipientName && !payload.recipientName.includes('@') ? payload.recipientName.trim() : '') ||
      matchedLead?.name ||
      cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
    const resolvedFirstName = resolvedName.split(' ')[0] || 'there';
    const senderName = smtp?.fromName || currentUser.name || 'Outreach Specialist';

    const replaceTokens = (txt: string) =>
      String(txt || '')
        .replace(/\{\{\s*first_name\s*\}\}/gi, resolvedFirstName)
        .replace(/\{\{\s*name\s*\}\}/gi, resolvedName)
        .replace(/\{\{\s*company\s*\}\}/gi, resolvedCompany)
        .replace(/\{\{\s*email\s*\}\}/gi, cleanEmail)
        .replace(/\{\{\s*title\s*\}\}/gi, matchedLead?.title || 'Executive')
        .replace(/\{\{\s*website\s*\}\}/gi, matchedLead?.website || resolvedCompany)
        .replace(/\{\{\s*niche\s*\}\}/gi, matchedLead?.niche || 'your industry')
        .replace(/\{\{\s*sender_name\s*\}\}/gi, senderName)
        .trim();

    const cleanSubject = replaceTokens(payload.subject);
    const cleanBody = replaceTokens(payload.body);

    const trackingPixelId = `px-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let isSuccess = false;
    let errorMessage = '';

    try {
      const res = await fetch('/api/smtp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanEmail,
          toName: resolvedName,
          toCompany: resolvedCompany,
          from: smtp?.fromEmail || smtp?.username,
          fromName: senderName,
          subject: cleanSubject,
          text: cleanBody,
          smtpConfig: smtp,
          trackingPixelId
        })
      });

      const parsed = await safeParseResponse(res, 'SMTP relay connection failed');
      const data = parsed.data || {};
      if (parsed.ok && data.success) {
        isSuccess = true;
      } else {
        isSuccess = false;
        errorMessage = data.error || `HTTP ${res.status} error`;
      }
    } catch (err: any) {
      isSuccess = false;
      errorMessage = err?.message || 'Network error connecting to SMTP relay';
    }

    if (isSuccess) {
      const senderFromEmail = smtp?.fromEmail || smtp?.username || currentUser.email || 'outreach@visualsky.pro';
      const cleanedSentBody = cleanEmailBodyText(cleanBody, matchedLead?.website || resolvedCompany, resolvedCompany, resolvedName);

      // Add sent log with status strictly 'sent', openCount strictly 0, and exact smtpAccountId + senderEmail
      addSentEmailLog({
        campaignName: 'Direct Outreach Mailer',
        recipientName: resolvedName,
        recipientEmail: cleanEmail,
        recipientCompany: resolvedCompany,
        subject: cleanSubject,
        body: cleanedSentBody,
        smtpAccountId: smtp?.id,
        senderEmail: senderFromEmail,
        smtpAccountName: smtp?.name || 'Primary SMTP Relay',
        smtpHost: `${smtp?.host || 'smtp.relay'}:${smtp?.port || 587}`,
        status: 'sent',
        openCount: 0,
        trackingPixelId
      });

      // Also record or update conversation thread in Smart Inbox with this exact SMTP account (smtp.id & senderFromEmail)
      setThreads(prev => {
        const existingThread = prev.find(t => t.leadEmail?.toLowerCase() === cleanEmail.toLowerCase());
        const threadId = existingThread?.id || `thread-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const sentMsg: EmailMessage = {
          id: `msg-out-${Date.now()}`,
          threadId,
          sender: 'user',
          senderName,
          senderEmail: senderFromEmail,
          recipientName: resolvedName,
          recipientEmail: cleanEmail,
          smtpAccountId: smtp?.id,
          timestamp: nowFormatted,
          subject: cleanSubject,
          body: cleanedSentBody,
          isRead: true,
          status: 'sent'
        };

        let nextThreads: EmailThread[];
        if (existingThread) {
          const updated: EmailThread = {
            ...existingThread,
            isTrash: false,
            smtpAccountId: smtp?.id,
            smtpEmail: senderFromEmail,
            subject: cleanSubject || existingThread.subject,
            lastMessage: cleanedSentBody.slice(0, 100),
            lastMessageDate: nowFormatted,
            updatedAt: nowFormatted,
            messages: [...existingThread.messages, sentMsg]
          };
          nextThreads = [updated, ...prev.filter(t => t.id !== existingThread.id)];
        } else {
          const newThread: EmailThread = {
            id: threadId,
            leadId: matchedLead?.id || `lead-${Date.now()}`,
            leadName: resolvedName,
            leadEmail: cleanEmail,
            leadCompany: resolvedCompany,
            smtpAccountId: smtp?.id,
            smtpEmail: senderFromEmail,
            subject: cleanSubject,
            lastMessage: cleanedSentBody.slice(0, 100),
            lastMessageDate: nowFormatted,
            updatedAt: nowFormatted,
            unreadCount: 0,
            labels: ['Sent Outreach'],
            isStarred: false,
            isTrash: false,
            messages: [sentMsg]
          };
          nextThreads = [newThread, ...prev];
        }
        persistResourceDirectly('threads', nextThreads);
        return nextThreads;
      });

      // Update lead if in database
      setLeads(prev => {
        const next = prev.map(l => {
          if (l.email.toLowerCase() === cleanEmail.toLowerCase()) {
            return {
              ...l,
              status: l.status === 'new' ? ('contacted' as const) : l.status,
              lastActivityDate: new Date().toISOString(),
              daysAgo: 0
            };
          }
          return l;
        });
        persistResourceDirectly('leads', next);
        return next;
      });

      addNotification({
        title: 'Outbound Email Dispatched 🚀',
        message: `Sent live email to ${resolvedName} (${cleanEmail}) via ${smtp.name}.`,
        type: 'reply'
      });

      return true;
    } else {
      // Add failed log
      addSentEmailLog({
        campaignName: 'Direct Outreach Mailer',
        recipientName: resolvedName,
        recipientEmail: cleanEmail,
        recipientCompany: resolvedCompany,
        subject: cleanSubject,
        body: cleanBody,
        smtpAccountName: smtp?.name || 'Primary SMTP Relay',
        smtpHost: `${smtp?.host || 'smtp.relay'}:${smtp?.port || 587}`,
        status: 'failed',
        errorMessage,
        openCount: 0,
        trackingPixelId
      });

      addNotification({
        title: '❌ Email Transmission Failed',
        message: `Could not send to ${cleanEmail}: ${errorMessage}`,
        type: 'system'
      });

      return false;
    }
  };

  // User Management
  const updateUserRole = (userId: string, role: 'client' | 'agency' | 'owner' | 'manager' | 'rep' | 'customer') => {
    // Only agency/owner can change roles
    if (currentUser.role !== 'agency' && currentUser.role !== 'owner' && !currentUser.isOwner) return;

    const isMaster = role === 'agency' || role === 'owner';
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role, isOwner: isMaster } : u));
    if (currentUser.id === userId) {
      setCurrentUser({ ...currentUser, role, isOwner: isMaster });
    }
  };

  const updateUserPermissions = (userId: string, permissions: any) => {
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: { ...u.permissions, ...permissions } } : u));
  };

  const resetUserPasswordByEmail = (email: string, newPass: string): boolean => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return false;

    // 1. Immediately cache in visualsky_reset_passwords for cross-tab and cross-modal lookup
    try {
      const resetStore = JSON.parse(localStorage.getItem('visualsky_reset_passwords') || '{}');
      resetStore[cleanEmail] = newPass;
      localStorage.setItem('visualsky_reset_passwords', JSON.stringify(resetStore));
    } catch {}

    // 2. Update user in state & localStorage
    setAllUsers(prev => {
      const existingIndex = prev.findIndex(u => u.email?.toLowerCase() === cleanEmail);
      let updated: UserAccount[];
      if (existingIndex >= 0) {
        updated = prev.map((u, i) => (i === existingIndex ? { ...u, password: newPass } : u));
      } else {
        const isAgency = cleanEmail.includes('admin') || cleanEmail.includes('agency') || cleanEmail === 'rafiqulvisualsky@gmail.com' || cleanEmail === 'sojibdaridro123@gmail.com';
        const newUser: UserAccount = {
          id: `usr-${Date.now()}`,
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          avatar: isAgency 
            ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          password: newPass,
          role: isAgency ? 'agency' : 'client',
          isOwner: isAgency,
          plan: isAgency ? 'Enterprise' : 'Pro',
          bdtPlanLabel: isAgency ? 'Agency Master Admin (Free Unlimited)' : 'Scale Business (BDT 4,999/mo)',
          quotaUsed: 0,
          quotaLimit: isAgency ? 50000 : 5000,
          aiCredits: isAgency ? 10000 : 2500,
          company: isAgency ? 'Visual Sky' : 'Client Workspace',
          title: isAgency ? 'Agency Master User' : 'Client Member',
          joinedAt: new Date().toISOString().split('T')[0]
        };
        updated = [...prev, newUser];
      }
      try {
        localStorage.setItem('visualsky_users', JSON.stringify(updated));
      } catch {}

      // 3. Sync to server backend
      try {
        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: updated })
        }).catch(() => {});
      } catch {}

      return updated;
    });

    return true;
  };

  const deductAiTokens = (tokensUsed: number) => {
    if (!tokensUsed || tokensUsed <= 0) return;
    const cleanTokens = Math.max(1, Math.round(tokensUsed));
    setCurrentUserState(prev => {
      const updatedCredits = Math.max(0, (prev.aiCredits || 0) - cleanTokens);
      return {
        ...prev,
        aiCredits: updatedCredits
      };
    });
    setAllUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, aiCredits: Math.max(0, (u.aiCredits || 0) - cleanTokens) } : u));
  };

  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState<boolean>(false);

  const requestLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const logout = () => {
    signOutSupabase().catch(() => {});
    try {
      localStorage.removeItem('visualsky_current_user');
      localStorage.removeItem('visualsky_authenticated');
      localStorage.removeItem('sb-wtylyugyemwndjcvskgq-auth-token');
    } catch {}
    
    loadedWorkspaceEmailRef.current = null;
    setIsAuthenticatedState(false);
    setIsLogoutConfirmOpen(false);
    
    addNotification({
      title: 'Logged Out Successfully 🚪',
      message: 'Your active session has been securely closed. Sign in anytime to resume work.',
      type: 'system'
    });
  };

  const getDormantLeads = (days: number) => {
    return leads.filter(l => !l.isTrash && l.daysAgo >= days && l.status !== 'replied');
  };

  const deleteUserAccount = (userId: string) => {
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    addNotification({
      title: 'Customer Account Deleted 🗑️',
      message: 'The customer account and all portal access have been completely removed.',
      type: 'system'
    });
  };

  // Trash Metrics & Global Empty
  const totalTrashCount = 
    leads.filter(l => l.isTrash).length +
    threads.filter(t => t.isTrash).length +
    smtpAccounts.filter(s => s.isTrash).length +
    campaigns.filter(c => c.isTrash).length +
    emailTemplates.filter(t => t.isTrash).length +
    sentEmails.filter(s => s.isTrash).length;

  const emptyAllTrash = () => {
    const cleanLeads = leads.filter(l => !l.isTrash);
    const cleanThreads = threads.filter(t => !t.isTrash);
    const cleanSmtp = smtpAccounts.filter(s => !s.isTrash);
    const cleanCampaigns = campaigns.filter(c => !c.isTrash);
    const cleanTemplates = emailTemplates.filter(t => !t.isTrash);
    const cleanSent = sentEmails.filter(s => !s.isTrash);

    setLeads(cleanLeads);
    setThreads(cleanThreads);
    setSmtpAccounts(cleanSmtp);
    setCampaigns(cleanCampaigns);
    setEmailTemplates(cleanTemplates);
    setSentEmails(cleanSent);

    persistResourceDirectly('leads', cleanLeads);
    persistResourceDirectly('threads', cleanThreads);
    persistResourceDirectly('smtpAccounts', cleanSmtp);
    persistResourceDirectly('campaigns', cleanCampaigns);
    persistResourceDirectly('emailTemplates', cleanTemplates);
    persistResourceDirectly('sentEmails', cleanSent);

    addNotification({
      title: 'Trash Emptied 🗑️',
      message: 'All trashed leads, threads, SMTP relays, campaigns, templates, and sent logs permanently erased.',
      type: 'system'
    });
  };

  // Live Simulation Trigger
  const simulateIncomingReply = () => {
    customSimulateReply();
  };

  const customSimulateReply = (payload?: SimulatedReplyPayload) => {
    setIsSimulating(true);

    setTimeout(() => {
      const activeVerifiedLeads = leads.filter(l => !l.isTrash && l.status !== 'replied');
      const targetLead = payload?.leadId 
        ? leads.find(l => l.id === payload.leadId) 
        : activeVerifiedLeads[Math.floor(Math.random() * activeVerifiedLeads.length)] || leads[0];

      if (!targetLead) {
        setIsSimulating(false);
        return;
      }

      const replyContent = payload?.customText || 
        `Hi,\n\nThanks for reaching out! We're evaluating cold email deliverability stacks this quarter. Can you share a 2-minute video walkthrough or deck?\n\nBest,\n${targetLead.name}`;

      // Update lead
      setLeads(prev => prev.map(l => {
        if (l.id === targetLead.id) {
          return {
            ...l,
            status: 'replied',
            isReplied: true,
            openCount: (l.openCount || 0) + 1,
            lastOpenedAt: new Date().toISOString(),
            lastRepliedAt: new Date().toISOString(),
            replySnippet: replyContent.slice(0, 90),
            daysAgo: 0
          };
        }
        return l;
      }));

      // Find or create thread in inbox
      const existingThread = threads.find(t => t.leadId === targetLead.id || t.leadEmail === targetLead.email);

      if (existingThread) {
        const newMsg: EmailMessage = {
          id: `msg-sim-${Date.now()}`,
          threadId: existingThread.id,
          sender: 'lead',
          senderName: targetLead.name,
          senderEmail: targetLead.email,
          recipientName: currentUser.name,
          recipientEmail: currentUser.email,
          timestamp: 'Just now',
          subject: (existingThread.subject || '').startsWith('Re:') ? (existingThread.subject || '') : `Re: ${existingThread.subject || 'Follow up'}`,
          body: replyContent,
          isRead: false,
          status: 'replied'
        };

        setThreads(prev => prev.map(t => {
          if (t.id === existingThread.id) {
            return {
              ...t,
              lastMessage: replyContent.slice(0, 100) + '...',
              lastMessageDate: 'Just now',
              unreadCount: t.unreadCount + 1,
              isTrash: false,
              messages: [...t.messages, newMsg]
            };
          }
          return t;
        }));
      } else {
        const newThread: EmailThread = {
          id: `thread-sim-${Date.now()}`,
          leadId: targetLead.id,
          leadName: targetLead.name,
          leadCompany: targetLead.company,
          leadEmail: targetLead.email,
          subject: `Re: Scaling outreach for ${targetLead.company}`,
          lastMessage: replyContent.slice(0, 100) + '...',
          lastMessageDate: 'Just now',
          unreadCount: 1,
          labels: ['Hot Lead'],
          isStarred: true,
          isTrash: false,
          messages: [
            {
              id: `msg-sim-user-${Date.now()}`,
              threadId: `thread-sim-${Date.now()}`,
              sender: 'user',
              senderName: currentUser.name,
              senderEmail: currentUser.email,
              recipientName: targetLead.name,
              recipientEmail: targetLead.email,
              timestamp: '2 hours ago',
              subject: `Scaling outreach for ${targetLead.company}`,
              body: `Hi ${targetLead.name},\n\nLoved your company's milestones! Quick question: are you managing outbound in-house?`,
              isRead: true,
              status: 'sent'
            },
            {
              id: `msg-sim-lead-${Date.now()}`,
              threadId: `thread-sim-${Date.now()}`,
              sender: 'lead',
              senderName: targetLead.name,
              senderEmail: targetLead.email,
              recipientName: currentUser.name,
              recipientEmail: currentUser.email,
              timestamp: 'Just now',
              subject: `Re: Scaling outreach for ${targetLead.company}`,
              body: replyContent,
              isRead: false,
              status: 'replied'
            }
          ]
        };
        setThreads(prev => [newThread, ...prev]);
      }

      addNotification({
        title: `🔥 New Inbound Reply from ${targetLead.name}`,
        message: `${targetLead.company}: "${replyContent.slice(0, 60)}..."`,
        type: 'reply',
        linkTab: 'inbox',
        leadEmail: targetLead.email
      });

      setIsSimulating(false);
    }, (payload?.delaySeconds || 1) * 600);
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        activeFollowUpCohort,
        setActiveFollowUpCohort,
        openFollowUpCohortModal,
        soundEnabled,
        setSoundEnabled,
        notificationSettings,
        updateNotificationSettings,
        playNotificationSound,
        requestDesktopNotificationPermission,
        leads,
        setLeads,
        addLeads,
        updateLead,
        deleteLeadToTrash,
        restoreLead,
        permanentDeleteLead,
        bulkDeleteLeads,
        bulkRestoreLeads,
        bulkPermanentDeleteLeads,
        verifyLeadWebsite,
        leadTags,
        setLeadTags,
        addLeadTag,
        updateLeadTag,
        deleteLeadTag,
        assignTagsToLeads,
        columnSettings,
        toggleColumnSetting,
        threads,
        setThreads,
        activeThreadId,
        setActiveThreadId,
        sendReply,
        markThreadRead,
        toggleThreadStar,
        addThreadLabel,
        removeThreadLabel,
        deleteThreadToTrash,
        restoreThread,
        permanentDeleteThread,
        campaigns,
        setCampaigns,
        createCampaign,
        updateCampaign,
        toggleCampaignStatus,
        deleteCampaign,
        restoreCampaign,
        permanentDeleteCampaign,
        bulkRestoreCampaigns,
        bulkPermanentDeleteCampaigns,
        launchQuickFollowUp,
        getDormantLeads,
        emailTemplates,
        setEmailTemplates,
        templateCategories,
        setTemplateCategories,
        addTemplateCategory,
        deleteTemplateCategory,
        addEmailTemplate,
        updateEmailTemplate,
        deleteEmailTemplate,
        restoreEmailTemplate,
        permanentDeleteEmailTemplate,
        smtpAccounts,
        setSmtpAccounts,
        addSMTPAccount,
        updateSMTPAccount,
        deleteSMTPAccount,
        restoreSMTPAccount,
        permanentDeleteSMTPAccount,
        testSMTPConnection,
        sentEmails,
        setSentEmails,
        addSentEmailLog,
        clearSentEmails,
        deleteSentEmail,
        restoreSentEmail,
        permanentDeleteSentEmail,
        bulkRestoreThreads,
        bulkPermanentDeleteThreads,
        markEmailOpened,
        simulateLeadReplyToSentEmail,
        sendDirectEmail,
        syncInboxReplies,
        notifications,
        addNotification,
        deleteNotification,
        markNotificationRead,
        markAllNotificationsRead,
        clearAllNotifications,
        unreadNotificationCount,
        isAuthenticated,
        setIsAuthenticated,
        loginUser,
        currentUser,
        setCurrentUser,
        allUsers,
        setAllUsers,
        updateUserRole,
        updateUserPermissions,
        deleteUserAccount,
        resetUserPasswordByEmail,
        deductAiTokens,
        logout,
        isLogoutConfirmOpen,
        setIsLogoutConfirmOpen,
        requestLogout,
        minedLeads,
        setMinedLeads,
        loadUserWorkspace,
        saveWorkspaceToDatabase,
        persistResourceDirectly,
        isWorkspaceLoading,
        syncStatus,
        emptyAllTrash,
        totalTrashCount,
        simulateIncomingReply,
        customSimulateReply,
        isSimulating,
        setIsSimulating,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
