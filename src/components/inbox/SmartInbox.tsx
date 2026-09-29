import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp, cleanEmailBodyText } from '../../context/AppContext';
import { safeParseResponse } from '../../lib/safeFetch';
import { EmailThread, LeadStatus, EmailAttachment } from '../../types';
import { verifyEmailSync, verifyEmailsWithDns, EmailVerificationResult } from '../../utils/emailVerifier';
import { 
  Inbox, 
  Search, 
  Star, 
  Trash2, 
  Tag, 
  Send, 
  Sparkles, 
  User, 
  Building, 
  Mail, 
  Phone, 
  Clock, 
  CornerUpLeft, 
  CheckCircle2, 
  Flame, 
  ShieldCheck,
  Plus,
  RefreshCw,
  ArrowLeft,
  Reply,
  Check,
  Calendar,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  Wand2,
  Copy,
  ExternalLink,
  UserPlus,
  BrainCircuit,
  StickyNote,
  Paperclip,
  FolderOpen,
  Link2
} from 'lucide-react';
import confetti from 'canvas-confetti';

const cleanBodyText = (text: string, fallbackCompany?: string, fallbackName?: string) => {
  if (!text) return '';
  return cleanEmailBodyText(text, fallbackCompany, fallbackCompany, fallbackName);
};

export const SmartInbox: React.FC = () => {
  const { 
    threads, 
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
    bulkRestoreThreads,
    bulkPermanentDeleteThreads,
    currentUser,
    searchQuery,
    setSearchQuery,
    emailTemplates,
    smtpAccounts,
    sentEmails,
    leads,
    addLeads,
    updateLead,
    sendDirectEmail,
    addNotification,
    syncInboxReplies,
    deductAiTokens,
    driveStorageSettings,
    updateDriveStorageSettings
  } = useApp();

  const [isSyncingManual, setIsSyncingManual] = useState<boolean>(false);

  // Automatically sync IMAP replies silently in background when SmartInbox opens & every 5s while visible (no manual button or reload needed)
  useEffect(() => {
    const runSilentSync = () => {
      if (document.visibilityState === 'visible') {
        syncInboxReplies(undefined, true)
          .then(() => {
            setLastAutoSyncTime(
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            );
          })
          .catch(() => {});
      }
    };
    const initTimer = setTimeout(runSilentSync, 400);
    const timer = setInterval(runSilentSync, 5000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(timer);
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncingManual) return;
    setIsSyncingManual(true);
    try {
      const res = await syncInboxReplies(undefined, false);
      if (res.success) {
        if (res.count > 0) {
          confetti({ particleCount: 40, spread: 60 });
          addNotification({
            title: '🎉 New Replies Synced!',
            message: `Fetched ${res.count} new reply from your IMAP inbox.`,
            type: 'lead'
          });
        } else {
          addNotification({
            title: 'IMAP Inbox Up-to-Date',
            message: `Checked ${res.totalChecked} messages. No new prospect replies detected.`,
            type: 'system'
          });
        }
      } else {
        addNotification({
          title: 'IMAP Sync Failed',
          message: res.error || 'Could not connect to mail server. Verify your credentials in SMTP settings.',
          type: 'smtp'
        });
      }
    } catch (err: any) {
      addNotification({
        title: 'IMAP Sync Error',
        message: err?.message || 'Failed to connect to inbox server.',
        type: 'smtp'
      });
    } finally {
      setIsSyncingManual(false);
    }
  };

  // Gmail folder & filter selection
  const [selectedFolder, setSelectedFolder] = useState<'inbox' | 'needs_reply' | 'sent' | 'starred' | 'high_intent' | 'meetings' | 'trash' | 'unread'>('inbox');
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(null);
  const [primaryTab, setPrimaryTab] = useState<'primary' | 'interested' | 'meetings' | 'followup'>('primary');
  const [quickStatusFilter, setQuickStatusFilter] = useState<'all' | 'unread' | 'needs_reply'>('all');
  
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [replyText, setReplyText] = useState<string>('');

  const [isGeneratingAiReply, setIsGeneratingAiReply] = useState<boolean>(false);
  const [customReplyPrompt, setCustomReplyPrompt] = useState<string>('');
  const [isAiCopilotExpanded, setIsAiCopilotExpanded] = useState<boolean>(false);
  const [isComposerMinimized, setIsComposerMinimized] = useState<boolean>(false);
  const [messageDirectionFilter, setMessageDirectionFilter] = useState<'all' | 'lead_only' | 'user_only'>('all');
  const [largeReadingText, setLargeReadingText] = useState<boolean>(true);
  const [expandedQuotesMap, setExpandedQuotesMap] = useState<Record<string, boolean>>({});
  const [translatedMessagesMap, setTranslatedMessagesMap] = useState<Record<string, string>>({});
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<string>('Live');
  const [showLabelMenu, setShowLabelMenu] = useState<boolean>(false);
  const [showBulkLabelMenu, setShowBulkLabelMenu] = useState<boolean>(false);
  const [customLabelInput, setCustomLabelInput] = useState<string>('');
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);

  // User-friendly CRM Drawer & AI Thread Summary states
  const [showLeadCrmCard, setShowLeadCrmCard] = useState<boolean>(false);
  const [leadNoteDraft, setLeadNoteDraft] = useState<string>('');
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  const [isAnalyzingThread, setIsAnalyzingThread] = useState<boolean>(false);
  const [threadAiSummary, setThreadAiSummary] = useState<{
    threadId: string;
    intent: string;
    summary: string;
    suggestedAction: string;
    suggestedReply: string;
  } | null>(null);

  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const replyFileInputRef = useRef<HTMLInputElement | null>(null);
  const composeFileInputRef = useRef<HTMLInputElement | null>(null);

  // Gmail-style File Attachments (Routed to User's Google Drive Folder — 0 KB Hosting Used)
  const [replyAttachments, setReplyAttachments] = useState<EmailAttachment[]>([]);
  const [composeAttachments, setComposeAttachments] = useState<EmailAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);

  // Google Drive Folder Link Settings Modal State
  const [showDriveSettingsModal, setShowDriveSettingsModal] = useState<boolean>(false);
  const [driveFolderUrlInput, setDriveFolderUrlInput] = useState<string>(driveStorageSettings.folderUrl || '');
  const [driveFolderNameInput, setDriveFolderNameInput] = useState<string>(driveStorageSettings.folderName || 'My Google Drive Email Attachments');
  const [driveScriptUrlInput, setDriveScriptUrlInput] = useState<string>(driveStorageSettings.appsScriptWebAppUrl || '');
  const [autoIncludeDriveLink, setAutoIncludeDriveLink] = useState<boolean>(driveStorageSettings.autoIncludeDriveLinkInEmail !== false);
  const [driveSavedFeedback, setDriveSavedFeedback] = useState<boolean>(false);

  useEffect(() => {
    setDriveFolderUrlInput(driveStorageSettings.folderUrl || '');
    setDriveFolderNameInput(driveStorageSettings.folderName || 'My Google Drive Email Attachments');
    setDriveScriptUrlInput(driveStorageSettings.appsScriptWebAppUrl || '');
    setAutoIncludeDriveLink(driveStorageSettings.autoIncludeDriveLinkInEmail !== false);
  }, [
    driveStorageSettings.folderUrl,
    driveStorageSettings.folderName,
    driveStorageSettings.appsScriptWebAppUrl,
    driveStorageSettings.autoIncludeDriveLinkInEmail
  ]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '1 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSaveDriveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateDriveStorageSettings({
      folderUrl: driveFolderUrlInput.trim(),
      folderName: driveFolderNameInput.trim() || 'My Google Drive Email Attachments',
      appsScriptWebAppUrl: driveScriptUrlInput.trim(),
      autoIncludeDriveLinkInEmail: autoIncludeDriveLink
    });
    setDriveSavedFeedback(true);
    setTimeout(() => setDriveSavedFeedback(false), 2500);
  };

  // Read any selected file(s) (*/*) in memory, sync with Google Drive folder link (0 KB on hosting server), and attach to email
  const handleAttachFiles = async (fileList: FileList | null, target: 'reply' | 'compose') => {
    if (!fileList || fileList.length === 0) return;
    setIsUploadingAttachment(true);

    const newItems: EmailAttachment[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        let driveFolderUrl = driveStorageSettings.folderUrl || 'https://drive.google.com/drive/my-drive';
        let driveFileUrl = driveFolderUrl;

        try {
          const upRes = await fetch('/api/drive-storage/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              contentBase64: base64DataUrl,
              folderUrl: driveStorageSettings.folderUrl,
              folderId: driveStorageSettings.folderId,
              appsScriptWebAppUrl: driveStorageSettings.appsScriptWebAppUrl
            })
          });
          const parsed = await safeParseResponse(upRes, 'Drive upload check');
          if (parsed.ok && parsed.data?.success) {
            driveFolderUrl = parsed.data.driveFolderUrl || driveFolderUrl;
            driveFileUrl = parsed.data.driveFileUrl || driveFolderUrl;
          }
        } catch {}

        newItems.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${i}`,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          driveFolderUrl,
          driveFileUrl,
          contentBase64: base64DataUrl
        });
      } catch (err) {
        console.warn('Error attaching file:', err);
      }
    }

    if (newItems.length > 0) {
      if (target === 'reply') {
        setReplyAttachments(prev => [...prev, ...newItems]);
      } else {
        setComposeAttachments(prev => [...prev, ...newItems]);
      }
    }
    setIsUploadingAttachment(false);
  };

  // New Compose Modal
  const [showComposeModal, setShowComposeModal] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeName, setComposeName] = useState<string>('');
  const [composeCompany, setComposeCompany] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [composeSmtpId, setComposeSmtpId] = useState<string>(smtpAccounts[0]?.id || '');
  const [isGeneratingComposeAi, setIsGeneratingComposeAi] = useState<boolean>(false);
  const [composeEmailCheck, setComposeEmailCheck] = useState<EmailVerificationResult | null>(null);

  useEffect(() => {
    if (!composeTo.trim()) {
      setComposeEmailCheck(null);
      return;
    }
    const syncRes = verifyEmailSync(composeTo);
    setComposeEmailCheck(syncRes);
    if (syncRes.isValid) {
      const timer = setTimeout(() => {
        verifyEmailsWithDns([composeTo]).then(resList => {
          const dnsRes = Array.isArray(resList) ? resList[0] : (resList as any)?.[composeTo.trim().toLowerCase()];
          if (dnsRes) setComposeEmailCheck(dnsRes);
        });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [composeTo]);

  // Active usable email templates (including all custom-created templates)
  const activeEmailTemplates = useMemo(() => {
    return (emailTemplates || [])
      .filter(t => !t.isTrash)
      .sort((a, b) => {
        if (a.isCustom && !b.isCustom) return -1;
        if (!a.isCustom && b.isCustom) return 1;
        return 0;
      });
  }, [emailTemplates]);

  // Label presets
  const labelPresets = [
    { name: 'Hot Lead', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    { name: 'Negotiation', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { name: 'Meeting Scheduled', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    { name: 'Needs Follow-Up', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { name: 'Interested', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  ];

  // Helper to check if a thread is waiting for user's reply (last message was from lead)
  const isThreadWaitingReply = (t: EmailThread): boolean => {
    if (!Array.isArray(t.messages) || t.messages.length === 0) return false;
    return t.messages[t.messages.length - 1]?.sender === 'lead';
  };

  // Active thread details
  const currentThread = useMemo(() => {
    return threads.find(t => t.id === activeThreadId) || null;
  }, [threads, activeThreadId]);

  // Matched Lead from CRM Directory
  const matchedCrmLead = useMemo(() => {
    if (!currentThread) return null;
    const normEmail = (currentThread.leadEmail || '').trim().toLowerCase();
    return (leads || []).find(
      l => !l.isTrash && (l.id === currentThread.leadId || l.email.trim().toLowerCase() === normEmail)
    ) || null;
  }, [currentThread, leads]);

  useEffect(() => {
    if (matchedCrmLead) {
      setLeadNoteDraft(matchedCrmLead.customNotes || '');
    } else {
      setLeadNoteDraft('');
    }
  }, [matchedCrmLead?.id, matchedCrmLead?.customNotes]);

  const activeSmtpAccounts = useMemo(() => {
    return (smtpAccounts || []).filter(s => !s.isTrash);
  }, [smtpAccounts]);

  const [replySmtpId, setReplySmtpId] = useState<string>('');

  // Auto-detect which SMTP account sent the original mail or received the reply whenever a thread is opened
  useEffect(() => {
    if (!currentThread) return;

    const matchSmtp = (idOrNull?: string, emailOrNull?: string, nameOrNull?: string) => {
      if (idOrNull) {
        const byId = activeSmtpAccounts.find(s => s.id === idOrNull);
        if (byId) return byId;
      }
      if (emailOrNull) {
        const normEmail = emailOrNull.trim().toLowerCase();
        const byEmail = activeSmtpAccounts.find(
          s =>
            s.fromEmail?.trim().toLowerCase() === normEmail ||
            s.username?.trim().toLowerCase() === normEmail
        );
        if (byEmail) return byIdOrAcc(byEmail);
      }
      if (nameOrNull) {
        const byName = activeSmtpAccounts.find(s => s.name === nameOrNull);
        if (byName) return byName;
      }
      return undefined;
    };

    const byIdOrAcc = (acc: any) => acc;

    let detected = matchSmtp(currentThread.smtpAccountId, currentThread.smtpEmail);

    if (!detected && Array.isArray(currentThread.messages)) {
      for (let i = currentThread.messages.length - 1; i >= 0; i--) {
        const m = currentThread.messages[i];
        const candidateEmail = m.sender === 'user' ? m.senderEmail : m.recipientEmail;
        const found = matchSmtp(m.smtpAccountId, candidateEmail);
        if (found) {
          detected = found;
          break;
        }
      }
    }

    if (!detected && currentThread.leadEmail) {
      const normLead = currentThread.leadEmail.trim().toLowerCase();
      const sentLog = (sentEmails || []).find(
        s => !s.isTrash && s.recipientEmail?.trim().toLowerCase() === normLead
      );
      if (sentLog) {
        detected = matchSmtp(sentLog.smtpAccountId, sentLog.senderEmail, sentLog.smtpAccountName);
      }
    }

    if (!detected) {
      detected =
        activeSmtpAccounts.find(s => s.isConnected && (s.password || s.apiKey)) ||
        activeSmtpAccounts[0];
    }

    if (detected) {
      setReplySmtpId(detected.id);
    }
  }, [currentThread?.id, currentThread?.smtpAccountId, currentThread?.smtpEmail, currentThread?.messages?.length, activeSmtpAccounts, sentEmails]);

  // Filtered threads list based on folder, label filter, quick filter, and search query
  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      if (selectedFolder === 'trash') {
        if (!thread.isTrash) return false;
      } else {
        if (thread.isTrash) return false;
      }

      // Folder matching
      if (selectedFolder === 'needs_reply' && !isThreadWaitingReply(thread)) return false;
      if (selectedFolder === 'sent' && !(Array.isArray(thread.messages) && thread.messages.some(m => m.sender === 'user'))) return false;
      if (selectedFolder === 'starred' && !thread.isStarred) return false;
      if (selectedFolder === 'high_intent' && !thread.labels.includes('Hot Lead')) return false;
      if (selectedFolder === 'meetings' && !thread.labels.includes('Meeting Scheduled')) return false;
      if (selectedFolder === 'unread' && thread.unreadCount === 0) return false;

      // Label sidebar filter
      if (selectedLabelFilter && !thread.labels.includes(selectedLabelFilter)) return false;

      // Quick status sub-filter
      if (quickStatusFilter === 'unread' && thread.unreadCount === 0) return false;
      if (quickStatusFilter === 'needs_reply' && !isThreadWaitingReply(thread)) return false;

      // Primary tab filtering
      if (selectedFolder === 'inbox' && !selectedLabelFilter) {
        if (primaryTab === 'interested' && !thread.labels.some(l => l.toLowerCase().includes('interested') || l === 'Hot Lead')) return false;
        if (primaryTab === 'meetings' && !thread.labels.includes('Meeting Scheduled')) return false;
        if (primaryTab === 'followup' && !thread.labels.includes('Needs Follow-Up')) return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLead = thread.leadName.toLowerCase().includes(q) || thread.leadEmail.toLowerCase().includes(q) || thread.leadCompany.toLowerCase().includes(q);
        const matchesSubject = thread.subject.toLowerCase().includes(q);
        const matchesMsg = thread.messages.some(m => m.body.toLowerCase().includes(q));
        const matchesLabel = thread.labels.some(l => l.toLowerCase().includes(q));
        if (!matchesLead && !matchesSubject && !matchesMsg && !matchesLabel) return false;
      }

      return true;
    });
  }, [threads, selectedFolder, selectedLabelFilter, quickStatusFilter, primaryTab, searchQuery]);

  // Ensure a valid thread is selected if available
  useEffect(() => {
    if (filteredThreads.length > 0 && !filteredThreads.some(t => t.id === activeThreadId)) {
      setActiveThreadId(filteredThreads[0].id);
    } else if (filteredThreads.length === 0 && activeThreadId !== null) {
      setActiveThreadId(null);
    }
  }, [filteredThreads, activeThreadId, setActiveThreadId]);

  const handleSelectThread = (thread: EmailThread) => {
    setActiveThreadId(thread.id);
    setMobileShowChat(true);
    setShowLabelMenu(false);
    if (thread.unreadCount > 0) {
      markThreadRead(thread.id);
    }
  };

  useEffect(() => {
    if (!currentThread) return;
    const timer = setTimeout(() => {
      if (messagesScrollRef.current) {
        messagesScrollRef.current.scrollTo({
          top: messagesScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [currentThread?.id, currentThread?.messages?.length]);

  const handleToggleSelectAll = () => {
    if (selectedThreadIds.length === filteredThreads.length && filteredThreads.length > 0) {
      setSelectedThreadIds([]);
    } else {
      setSelectedThreadIds(filteredThreads.map(t => t.id));
    }
  };

  const handleToggleSelectThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedThreadIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSingleSelect = (id: string, e: React.MouseEvent) => {
    handleToggleSelectThread(id, e);
  };

  const handleBulkDelete = () => {
    if (selectedThreadIds.length === 0) return;
    if (selectedFolder === 'trash') {
      bulkPermanentDeleteThreads(selectedThreadIds);
      setSelectedThreadIds([]);
    } else {
      selectedThreadIds.forEach(id => deleteThreadToTrash(id));
      setSelectedThreadIds([]);
      addNotification({
        title: 'Threads Moved to Trash',
        message: `Moved ${selectedThreadIds.length} conversation(s) to trash.`,
        type: 'system'
      });
    }
  };

  const handleBulkAssignLabel = (labelName: string) => {
    selectedThreadIds.forEach(id => addThreadLabel(id, labelName));
    setShowBulkLabelMenu(false);
    setSelectedThreadIds([]);
    addNotification({
      title: `Label "${labelName}" Applied`,
      message: `Tagged ${selectedThreadIds.length} conversation(s) with "${labelName}".`,
      type: 'system'
    });
  };

  const handleEmptyTrash = () => {
    const trashIds = threads.filter(t => t.isTrash).map(t => t.id);
    if (trashIds.length === 0) return;
    bulkPermanentDeleteThreads(trashIds);
    setSelectedThreadIds([]);
  };

  const handleBulkMarkRead = () => {
    selectedThreadIds.forEach(id => markThreadRead(id));
    setSelectedThreadIds([]);
  };

  const handleCopyText = (text: string, idKey: string, label: string = 'Copied to clipboard') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedTextId(idKey);
    setTimeout(() => {
      setCopiedTextId(prev => (prev === idKey ? null : prev));
    }, 1800);
    addNotification({
      title: `${label} ✓`,
      message: text.length > 70 ? `${text.slice(0, 70)}...` : text,
      type: 'system'
    });
  };

  const handleSaveCurrentSenderToLeads = () => {
    if (!currentThread) return;
    addLeads([
      {
        name: currentThread.leadName || currentThread.leadEmail.split('@')[0],
        title: 'Decision Maker',
        company: currentThread.leadCompany || (currentThread.leadEmail.split('@')[1] || 'Company'),
        email: currentThread.leadEmail,
        phone: '',
        website: currentThread.leadEmail.includes('@') ? `https://${currentThread.leadEmail.split('@')[1]}` : '',
        niche: 'Inbound / Smart Inbox',
        location: 'United States',
        source: 'Smart Inbox',
        companySize: '11-50',
        leadScore: 88,
        icebreaker: `Direct conversation regarding "${currentThread.subject}"`,
        socials: {},
        status: 'replied',
        websiteStatus: 'alive',
        lastActivityDate: 'Just now',
        daysAgo: 0,
        sentCampaigns: [],
        tags: currentThread.labels?.length ? [...currentThread.labels] : ['Hot Lead'],
        isReplied: true,
        isTrash: false
      }
    ]);
    setShowLeadCrmCard(true);
  };

  const handleSaveLeadNote = () => {
    if (!matchedCrmLead) return;
    updateLead(matchedCrmLead.id, { customNotes: leadNoteDraft });
    addNotification({
      title: 'CRM Note Saved 📝',
      message: `Saved note for ${matchedCrmLead.name}.`,
      type: 'lead'
    });
  };

  // AI Smart Thread Summary & Deal Analyzer
  const handleAnalyzeThreadIntent = async () => {
    if (!currentThread || isAnalyzingThread) return;
    setIsAnalyzingThread(true);
    try {
      const conversationLog = (currentThread.messages || [])
        .map(m => `${m.sender === 'lead' ? currentThread.leadName : 'Me'}: ${cleanBodyText(m.body, currentThread.leadCompany, currentThread.leadName)}`)
        .join('\n\n');

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Analyze this email thread with ${currentThread.leadName} at ${currentThread.leadCompany} (Subject: ${currentThread.subject}):\n\n${conversationLog}\n\nReturn a concise 3-part response separated by "|||":\nPart 1: Prospect Intent (e.g. High buying intent / Asking for pricing / Scheduling call / Needs follow-up)\nPart 2: 1-sentence key takeaway of what they want\nPart 3: Ready-to-send 3-sentence reply addressing their latest message. Sign off as ${currentUser.name || 'Outreach Specialist'}.`
            }
          ],
          systemInstruction: 'You are an expert B2B sales assistant. Always format output as Part1|||Part2|||Part3 without markdown code blocks.'
        })
      });

      const parsed = await safeParseResponse(response, 'Failed to analyze thread');
      const rawReply = parsed.data?.reply || '';
      const parts = rawReply.split('|||').map((s: string) => s.trim());

      if (parts.length >= 3) {
        setThreadAiSummary({
          threadId: currentThread.id,
          intent: parts[0] || 'Interested Prospect',
          summary: parts[1] || 'Prospect engaged with your outreach and is open to next steps.',
          suggestedAction: 'Send the tailored follow-up below within 1 hour for best conversion.',
          suggestedReply: cleanBodyText(parts.slice(2).join('\n\n'))
        });
      } else {
        const lastMsg = currentThread.messages?.[currentThread.messages.length - 1];
        const isWaiting = lastMsg?.sender === 'lead';
        setThreadAiSummary({
          threadId: currentThread.id,
          intent: isWaiting ? '⚡ Prospect Waiting for Your Reply' : '⏳ Awaiting Prospect Follow-Up',
          summary: rawReply
            ? cleanBodyText(rawReply).slice(0, 180)
            : `Conversation with ${currentThread.leadName} (${currentThread.leadCompany}) regarding "${currentThread.subject}".`,
          suggestedAction: isWaiting ? 'Respond promptly with a concrete time slot or answer.' : 'Send a polite value-add follow-up if no response in 3 days.',
          suggestedReply: `Hi ${currentThread.leadName},\n\nThank you for your note! I'd love to walk you through how we can help ${currentThread.leadCompany || 'your team'} achieve this.\n\nWould Tuesday or Thursday at 2:00 PM work for a quick 10-minute chat?\n\nBest regards,\n${currentUser.name}`
        });
      }
      deductAiTokens(110);
    } catch {
      setThreadAiSummary({
        threadId: currentThread.id,
        intent: '⚡ Active Outreach Thread',
        summary: `${currentThread.leadName} from ${currentThread.leadCompany}: "${cleanBodyText(currentThread.lastMessage).slice(0, 120)}"`,
        suggestedAction: 'Propose a 15-minute discovery call or share a quick overview.',
        suggestedReply: `Hi ${currentThread.leadName},\n\nThanks for getting back to me! I'd be happy to share all the details and a quick demo tailored for ${currentThread.leadCompany || 'your team'}.\n\nAre you available this Thursday at 2 PM for a brief 10-min call?\n\nBest regards,\n${currentUser.name}`
      });
    } finally {
      setIsAnalyzingThread(false);
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentThread) return;
    if (!replyText.trim() && replyAttachments.length === 0) {
      replyTextareaRef.current?.focus();
      addNotification({
        title: 'Write a Reply or Attach a File First ✍️',
        message: 'নিচে আপনার মেসেজ লিখুন, ফাইল অ্যাটাচ করুন অথবা উপরে Gemini AI বাটনে ক্লিক করে অটো-ড্রাফট তৈরি করুন।',
        type: 'system'
      });
      return;
    }

    const finalBody = replyText.trim() || `📎 Attached ${replyAttachments.length} file(s): ${replyAttachments.map(a => a.name).join(', ')}`;
    sendReply(
      currentThread.id,
      finalBody,
      replySmtpId || undefined,
      replyAttachments.length > 0 ? replyAttachments : undefined
    );
    setReplyText('');
    setReplyAttachments([]);
    setCustomReplyPrompt('');
  };

  // AI Reply Draft Generator
  const handleAiDraft = async (type: 'demo' | 'pricing' | 'objection' | 'friendly' | 'agreement' | 'custom', customPrompt?: string) => {
    if (!currentThread) return;
    setIsGeneratingAiReply(true);

    try {
      let promptInstruction = '';
      if (type === 'demo') {
        promptInstruction = 'Draft a polite, confident 3-sentence email proposing a quick 15-minute screen share demo for next Tuesday at 2 PM.';
      } else if (type === 'pricing') {
        promptInstruction = 'Draft a concise response addressing pricing options, highlighting proven ROI (+3.5x replies), flexible monthly tiers, and a free trial.';
      } else if (type === 'objection') {
        promptInstruction = 'Draft a reassuring response addressing deliverability, our automated multi-domain warmup engine, SPF/DKIM verification, and low barrier to test.';
      } else if (type === 'agreement') {
        promptInstruction = 'Draft an enthusiastic, professional agreement accepting their proposal, confirming next steps, and attaching a calendar invite.';
      } else if (type === 'friendly') {
        promptInstruction = 'Draft a warm, courteous follow-up thanking them and offering to share a quick 2-minute video breakdown.';
      } else {
        promptInstruction = customPrompt || customReplyPrompt || 'Draft a strategic, helpful response tailored to their last message.';
      }

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: `Context:\nLead: ${currentThread.leadName} (${currentThread.leadTitle || 'Executive'}) at ${currentThread.leadCompany}\nLast message: ${currentThread.lastMessage}\nTask: ${promptInstruction}` }
          ],
          systemInstruction: 'You are an elite B2B cold outreach specialist. Write clean email body text only. No subject line, no placeholders, no awkward bracket markers. Sign off as ' + (currentUser.name || 'Outreach Specialist') + '.'
        })
      });

      const parsed = await safeParseResponse(response, 'Failed to generate AI reply');
      const data = parsed.data || {};
      if (data.reply) {
        setReplyText(cleanBodyText(data.reply));
        replyTextareaRef.current?.focus();
      }
      const usedTokens = data?.usage?.totalTokens || 125;
      deductAiTokens(usedTokens);
    } catch {
      deductAiTokens(90);
      setReplyText(`Hi ${currentThread.leadName},\n\nThank you for following up! I'd love to share a quick 2-minute video preview of our platform.\n\nWould next Thursday at 2 PM work for a brief 10-min chat?\n\nBest regards,\n${currentUser.name}`);
    } finally {
      setIsGeneratingAiReply(false);
    }
  };

  // AI Polish & Proofread
  const handlePolishReply = async () => {
    if (!replyText.trim() || !currentThread) return;
    setIsGeneratingAiReply(true);

    try {
      const response = await fetch('/api/gemini/optimize-body', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: replyText,
          targetTone: 'Professional & Direct'
        })
      });

      const parsed = await safeParseResponse(response, 'Failed to polish reply');
      const data = parsed.data || {};
      if (parsed.ok && data.success && data.optimizedBody) {
        setReplyText(data.optimizedBody);
      }
      const usedTokens = data?.usage?.totalTokens || 95;
      deductAiTokens(usedTokens);
    } catch {} finally {
      setIsGeneratingAiReply(false);
    }
  };

  // AI Generator for the Compose Outbound Modal
  const handleGenerateComposeAi = async (presetPrompt: string, type: 'pitch' | 'demo' | 'audit') => {
    setIsGeneratingComposeAi(true);
    try {
      const res = await fetch('/api/gemini/generate-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: presetPrompt,
          type,
          recipientName: composeName || 'there',
          senderName: currentUser.name || 'Outreach Specialist'
        })
      });
      const parsed = await safeParseResponse(res, 'Failed to generate compose draft');
      const data = parsed.data || {};
      if (parsed.ok && data.success && data.subject && data.body) {
        setComposeSubject(data.subject);
        setComposeBody(data.body);
      }
      const usedTokens = data?.usage?.totalTokens || 160;
      deductAiTokens(usedTokens);
    } catch {} finally {
      setIsGeneratingComposeAi(false);
    }
  };

  // Instant Template Inserter with intelligent placeholder replacement
  const handleInsertTemplate = (templateId: string, isCompose: boolean = false) => {
    const tmpl = emailTemplates.find(item => item.id === templateId);
    if (!tmpl) return;

    const leadName = isCompose ? (composeName || 'there') : (currentThread?.leadName || 'there');
    const leadCompany = isCompose ? (composeCompany || 'your team') : (currentThread?.leadCompany || 'your team');
    const leadEmail = isCompose ? composeTo : (currentThread?.leadEmail || '');

    const replacePlaceholders = (text: string) => {
      return text
        .replace(/\{\{name\}\}/gi, leadName)
        .replace(/\{\{first_name\}\}/gi, leadName.split(' ')[0] || leadName)
        .replace(/\{\{company\}\}/gi, leadCompany || 'your company')
        .replace(/\{\{email\}\}/gi, leadEmail)
        .replace(/\{\{website\}\}/gi, 'your website')
        .replace(/\{\{sender_name\}\}/gi, currentUser.name);
    };

    const processedBody = replacePlaceholders(tmpl.body);
    const processedSubject = replacePlaceholders(tmpl.subject);

    if (isCompose) {
      setComposeSubject(processedSubject);
      setComposeBody(processedBody);
    } else {
      setReplyText(processedBody);
      replyTextareaRef.current?.focus();
    }
  };

  // Quick snippet inserter for Reply Box
  const handleInsertQuickSnippet = (snippetType: 'calendar' | 'followup' | 'signoff') => {
    if (!currentThread) return;
    const firstName = currentThread.leadName?.split(' ')[0] || currentThread.leadName || 'there';
    let snippet = '';
    if (snippetType === 'calendar') {
      snippet = `Would Tuesday or Thursday at 2:00 PM work for a quick 15-minute screen-share call?`;
    } else if (snippetType === 'followup') {
      snippet = `Hi ${firstName},\n\nJust wanted to quickly follow up on my previous note. Let me know if you have any questions!`;
    } else if (snippetType === 'signoff') {
      snippet = `\n\nBest regards,\n${currentUser.name || 'Outreach Team'}`;
    }
    setReplyText(prev => {
      if (!prev.trim()) return snippet.trimStart();
      return `${prev.trimEnd()}\n\n${snippet.trim()}`;
    });
    replyTextareaRef.current?.focus();
  };

  const waitingReplyCount = useMemo(
    () => threads.filter(t => !t.isTrash && isThreadWaitingReply(t)).length,
    [threads]
  );

  // Split email body into actual fresh reply vs quoted email chain ("On ... wrote:" or ">")
  const splitReplyAndQuotedHistory = (rawText: string): { mainReply: string; quotedHistory: string } => {
    if (!rawText) return { mainReply: '', quotedHistory: '' };
    const lines = rawText.split(/\r?\n/);
    const mainLines: string[] = [];
    const quoteLines: string[] = [];
    let inQuoteBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (
        !inQuoteBlock &&
        (/^On .+ wrote:$/i.test(trimmed) ||
          /^-----Original Message-----/i.test(trimmed) ||
          /^From:\s+.+@/i.test(trimmed) ||
          (trimmed.startsWith('>') && mainLines.join('').trim().length > 0))
      ) {
        inQuoteBlock = true;
      }
      if (inQuoteBlock) {
        quoteLines.push(line);
      } else {
        mainLines.push(line);
      }
    }

    const mainReply = mainLines.join('\n').trim();
    const quotedHistory = quoteLines.join('\n').trim();
    if (!mainReply && quotedHistory) {
      return { mainReply: rawText.trim(), quotedHistory: '' };
    }
    return { mainReply: mainReply || rawText.trim(), quotedHistory };
  };

  // 1-Click Translate & Explain Prospect's Reply in Bangla + English
  const handleTranslateMessage = async (msgId: string, textToTranslate: string) => {
    if (!textToTranslate.trim() || translatingMsgId === msgId) return;
    if (translatedMessagesMap[msgId]) {
      setTranslatedMessagesMap(prev => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      return;
    }
    setTranslatingMsgId(msgId);
    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Translate and clearly explain this incoming client email reply in simple Bengali (বাংলা) so the user can easily understand what the person on the other side said and what they want:\n\n"${textToTranslate}"\n\nFormat clearly:\n🇧🇩 বাংলা অনুবাদ (Exact Meaning):\n...\n\n💡 মূল কথা (Key Takeaway in 1 line):\n...`
            }
          ],
          systemInstruction: 'You are a helpful bilingual Bengali-English assistant. Be concise, accurate, and easy to read.'
        })
      });
      const parsed = await safeParseResponse(response, 'Translation failed');
      const reply = parsed.data?.reply || '';
      if (reply) {
        setTranslatedMessagesMap(prev => ({ ...prev, [msgId]: reply.trim() }));
      }
    } catch {
      setTranslatedMessagesMap(prev => ({
        ...prev,
        [msgId]: `🇧🇩 মূল বার্তা: "${textToTranslate.slice(0, 220)}"`
      }));
    } finally {
      setTranslatingMsgId(null);
    }
  };

  return (
    <div className="p-1.5 md:px-3 md:py-2 max-w-[1460px] mx-auto h-[calc(100vh-4rem)] flex flex-col animate-in fade-in">
      
      {/* MAIN 3-COLUMN SPLIT CONTAINER - TAKES FULL HEIGHT */}
      <div className="flex-1 flex gap-2.5 overflow-hidden min-h-0">
        
        {/* 1. LEFT MAILBOXES, COMPOSE & SEARCH SIDEBAR */}
        <div className="w-56 bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 flex flex-col justify-between shrink-0 shadow-2xl hidden lg:flex">
          <div className="space-y-2 overflow-y-auto no-scrollbar min-h-0">
            {/* Compose Email Button inside Mailboxes Sidebar */}
            <button
              type="button"
              onClick={() => setShowComposeModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Compose Email</span>
            </button>

            {/* Search Bar inside Mailboxes Sidebar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail, label:hot..."
                className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-8 pr-6 py-1.5 text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-0.5 pt-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2.5 py-1">
                Mailboxes
              </div>
              {[
                { id: 'inbox', label: 'Primary Inbox', icon: Inbox, count: threads.filter(t => !t.isTrash && t.unreadCount > 0).length },
                { id: 'needs_reply', label: 'Waiting Reply', icon: Clock, count: waitingReplyCount },
                { id: 'sent', label: 'Sent Mails', icon: Send, count: threads.filter(t => !t.isTrash && Array.isArray(t.messages) && t.messages.some(m => m.sender === 'user')).length },
                { id: 'starred', label: 'Starred', icon: Star, count: threads.filter(t => t.isStarred && !t.isTrash).length },
                { id: 'high_intent', label: 'High Intent Leads', icon: Flame, count: threads.filter(t => t.labels.includes('Hot Lead') && !t.isTrash).length },
                { id: 'meetings', label: 'Meetings Booked', icon: Calendar, count: threads.filter(t => t.labels.includes('Meeting Scheduled') && !t.isTrash).length },
                { id: 'trash', label: 'Trash Bin', icon: Trash2, count: threads.filter(t => t.isTrash).length },
              ].map(folder => {
                const Icon = folder.icon;
                const isSelected = selectedFolder === folder.id && !selectedLabelFilter;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => {
                      setSelectedFolder(folder.id as any);
                      setSelectedLabelFilter(null);
                      setSelectedThreadIds([]);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="truncate">{folder.label}</span>
                    </div>
                    {folder.count > 0 && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                        isSelected ? 'bg-cyan-500 text-black font-extrabold' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {folder.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 mt-2 border-t border-slate-800 space-y-0.5">
              <div className="flex items-center justify-between px-2.5 py-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Labels & Tags
                </span>
                {selectedLabelFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedLabelFilter(null)}
                    className="text-[10px] text-cyan-400 hover:underline cursor-pointer font-bold"
                  >
                    Reset
                  </button>
                )}
              </div>
              {labelPresets.map((preset, idx) => {
                const count = threads.filter(t => !t.isTrash && t.labels.includes(preset.name)).length;
                const isActiveLabel = selectedLabelFilter === preset.name;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (selectedFolder === 'trash') setSelectedFolder('inbox');
                      setSelectedLabelFilter(prev => (prev === preset.name ? null : preset.name));
                    }}
                    className={`w-full px-2.5 py-1 rounded-xl flex items-center justify-between gap-2 text-xs transition cursor-pointer ${
                      isActiveLabel
                        ? 'bg-slate-800 text-cyan-300 font-bold border border-cyan-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full border shrink-0 ${preset.color}`} />
                      <span className="truncate">{preset.name}</span>
                    </div>
                    {count > 0 && (
                      <span className="text-[10px] font-mono text-slate-400">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 shrink-0">
            {/* Google Drive Attachment Storage Card (0 KB Hosting Used) */}
            <div className="p-2.5 bg-gradient-to-br from-emerald-950/50 via-slate-950 to-cyan-950/40 rounded-xl border border-emerald-500/30 space-y-1.5 text-[10px]">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 font-extrabold text-emerald-300">
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Google Drive Storage</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                    driveStorageSettings.folderUrl
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {driveStorageSettings.folderUrl ? '✓ Linked' : 'Set Link'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {driveStorageSettings.folderUrl
                  ? driveStorageSettings.folderName || 'Drive Folder Connected'
                  : 'Store attached files in your Google Drive (0 KB hosting)'}
              </div>
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowDriveSettingsModal(true)}
                  className="flex-1 py-1 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-bold text-[10px] transition cursor-pointer text-center"
                >
                  {driveStorageSettings.folderUrl ? '⚙️ Change Drive Link' : '🔗 Add Drive Folder Link'}
                </button>
                {driveStorageSettings.folderUrl && (
                  <a
                    href={driveStorageSettings.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 hover:text-cyan-200 transition"
                    title="Open Connected Google Drive Folder"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-0.5 text-[10px]">
              <div className="flex items-center justify-between text-slate-400 font-medium">
                <span>IMAP / SMTP Relay</span>
                <span className="text-emerald-400 font-bold">100% Online</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {activeSmtpAccounts[0]?.name || 'Direct Domain Webmail'} ({activeSmtpAccounts.length} active)
              </div>
            </div>
          </div>
        </div>

        {/* 2. THREADS LIST (Middle Column) */}
        <div className={`w-full md:w-80 lg:w-[320px] bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl shrink-0 ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}>
          
          {/* Mobile/Tablet Search + Compose Bar (Only visible below lg where Left Sidebar is hidden) */}
          <div className="lg:hidden flex items-center gap-1.5 p-2 border-b border-slate-800 bg-slate-950/90 shrink-0">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-6 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowDriveSettingsModal(true)}
              className="px-2 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-extrabold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
              title="Set or Change Google Drive Folder Link for Attachments"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Drive</span>
            </button>
            <button
              type="button"
              onClick={() => setShowComposeModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Compose</span>
            </button>
          </div>

          {/* Gmail Top Categories Tabs */}
          <div className="flex items-center border-b border-slate-800 bg-slate-950/90 overflow-x-auto no-scrollbar text-[11px] px-1 shrink-0">
            {[
              { id: 'primary', label: 'Primary' },
              { id: 'interested', label: 'High Intent' },
              { id: 'meetings', label: 'Meetings' },
              { id: 'followup', label: 'Follow Up' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPrimaryTab(tab.id as any)}
                className={`flex-1 py-1.5 px-2 text-center font-bold border-b-2 whitespace-nowrap transition cursor-pointer ${
                  primaryTab === tab.id
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile/Tablet Folder Bar (visible below lg where left sidebar is hidden) */}
          <div className="lg:hidden flex items-center gap-1 px-2 py-1 border-b border-slate-800/80 bg-slate-950/60 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'inbox', label: 'Inbox' },
              { id: 'needs_reply', label: `Waiting (${waitingReplyCount})` },
              { id: 'sent', label: 'Sent' },
              { id: 'starred', label: 'Starred' },
              { id: 'high_intent', label: 'Hot Leads' },
              { id: 'meetings', label: 'Meetings' },
              { id: 'trash', label: 'Trash' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelectedFolder(f.id as any);
                  setSelectedLabelFilter(null);
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer transition ${
                  selectedFolder === f.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sub-header: Select All + Bulk Actions (when selected) or Quick Filter Pills */}
          <div className="px-3 py-1.5 border-b border-slate-800/80 bg-slate-950/50 flex items-center justify-between gap-1.5 text-[11px] text-slate-400 shrink-0 relative">
            <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-slate-200 shrink-0">
              <input
                type="checkbox"
                checked={filteredThreads.length > 0 && selectedThreadIds.length === filteredThreads.length}
                onChange={handleToggleSelectAll}
                className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer w-3.5 h-3.5"
              />
              <span className="font-bold text-[10px]">
                {selectedThreadIds.length > 0 ? `${selectedThreadIds.length} Selected` : `All (${filteredThreads.length})`}
              </span>
            </label>

            {selectedThreadIds.length > 0 ? (
              <div className="flex items-center gap-1 animate-in fade-in">
                {selectedFolder === 'trash' ? (
                  <button
                    type="button"
                    onClick={() => {
                      bulkRestoreThreads(selectedThreadIds);
                      setSelectedThreadIds([]);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold cursor-pointer"
                  >
                    Restore
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleBulkMarkRead}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                    >
                      Read
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowBulkLabelMenu(prev => !prev)}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>Label</span>
                      </button>
                      {showBulkLabelMenu && (
                        <div className="absolute right-0 mt-1.5 w-44 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-40 space-y-0.5">
                          {labelPresets.map(preset => (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => handleBulkAssignLabel(preset.name)}
                              className="w-full text-left px-2 py-1 rounded-lg hover:bg-slate-900 text-[11px] text-slate-200 cursor-pointer flex items-center gap-1.5"
                            >
                              <span className={`w-2 h-2 rounded-full border ${preset.color}`} />
                              <span>{preset.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-2 py-0.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-bold cursor-pointer"
                >
                  Delete
                </button>
              </div>
            ) : selectedFolder === 'trash' && threads.some(t => t.isTrash) ? (
              <button
                type="button"
                onClick={handleEmptyTrash}
                className="px-2 py-0.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-2.5 h-2.5 text-rose-400" />
                <span>Empty Trash</span>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'unread', label: 'Unread' },
                  { id: 'needs_reply', label: 'Needs Reply' }
                ].map(flt => (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => setQuickStatusFilter(flt.id as any)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      quickStatusFilter === flt.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {flt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 min-h-0">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-xs font-bold text-slate-400">No emails in this view</div>
                <p className="text-[11px] text-slate-500">Incoming replies and conversations will appear here.</p>
              </div>
            ) : (
              filteredThreads.map(t => {
                const isSelected = t.id === currentThread?.id;
                const isChecked = selectedThreadIds.includes(t.id);
                const waitingForUser = isThreadWaitingReply(t);
                const msgCount = Array.isArray(t.messages) ? t.messages.length : 1;
                const isUnread =
                  (t.unreadCount || 0) > 0 ||
                  (Array.isArray(t.messages) &&
                    t.messages.some(m => m.sender === 'lead' && m.isRead === false));
                const isReplyMail =
                  msgCount > 1 ||
                  (Array.isArray(t.labels) && t.labels.includes('Real Reply')) ||
                  (Array.isArray(t.messages) && t.messages.some(m => m.sender === 'lead') && t.messages.some(m => m.sender === 'user'));

                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectThread(t)}
                    className={`p-3.5 transition-all cursor-pointer flex gap-3 relative group ${
                      isUnread
                        ? 'bg-gradient-to-r from-emerald-500/25 via-cyan-500/15 to-slate-900 border-l-4 border-l-emerald-400 ring-1 ring-emerald-400/40 shadow-[inset_0_0_24px_rgba(16,185,129,0.18)]'
                        : isSelected
                        ? 'bg-slate-800/75 border-l-4 border-l-cyan-400'
                        : 'hover:bg-slate-800/40 opacity-85'
                    }`}
                  >
                    {/* Checkbox + Star */}
                    <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleToggleSingleSelect(t.id, e as any)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer w-3.5 h-3.5"
                      />
                      <button
                        type="button"
                        onClick={() => toggleThreadStar(t.id)}
                        className="text-slate-500 hover:text-amber-400 cursor-pointer transition"
                      >
                        <Star className={`w-3.5 h-3.5 ${t.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                      </button>
                    </div>

                    {/* Sender Info & Preview */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isUnread && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0" title="Unseen New Mail">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                            </span>
                          )}
                          <span
                            className={`truncate ${
                              isUnread
                                ? 'text-[13px] font-black text-white'
                                : 'text-xs font-medium text-slate-300'
                            }`}
                          >
                            {t.leadName}
                          </span>
                          {msgCount > 1 && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                                isUnread
                                  ? 'bg-emerald-500/30 text-emerald-200 font-bold border border-emerald-400/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {msgCount}
                            </span>
                          )}
                          {isUnread && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-sm animate-pulse shrink-0">
                              {isReplyMail ? '✨ NEW REPLY' : '✨ NEW MAIL'}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-mono shrink-0 ${
                            isUnread ? 'text-emerald-300 font-extrabold' : 'text-slate-500'
                          }`}
                        >
                          {t.updatedAt || t.lastMessageDate || 'Today'}
                        </span>
                      </div>

                      <div
                        className={`text-[11px] truncate ${
                          isUnread
                            ? 'text-emerald-300 font-extrabold'
                            : 'text-slate-400 font-normal'
                        }`}
                      >
                        {t.subject}
                      </div>

                      {(() => {
                        const latestLeadReply = Array.isArray(t.messages)
                          ? [...t.messages].reverse().find(m => m.sender === 'lead')
                          : null;
                        const rawPreview = latestLeadReply
                          ? cleanBodyText(latestLeadReply.body, t.leadCompany, t.leadName)
                          : cleanBodyText(t.lastMessage, t.leadCompany, t.leadName);
                        const { mainReply } = splitReplyAndQuotedHistory(rawPreview);
                        return isUnread ? (
                          <div className="mt-1 p-2 rounded-xl bg-emerald-950/70 border border-emerald-400/50 text-[11px] text-white font-bold line-clamp-2 leading-snug shadow-sm">
                            <span className="text-emerald-300 font-black mr-1">
                              {isReplyMail ? '📩 New Reply:' : '📩 New Mail:'}
                            </span>
                            {mainReply}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-normal line-clamp-2 leading-snug">
                            {latestLeadReply ? `💬 ${mainReply}` : mainReply}
                          </p>
                        );
                      })()}

                      <div className="flex items-center justify-between gap-1 pt-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {waitingForUser ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              ⚡ Needs Reply
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              ✓ Replied
                            </span>
                          )}
                          {t.labels && t.labels.map((lbl, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-cyan-300 border border-slate-700"
                            >
                              {lbl}
                            </span>
                          ))}
                        </div>

                        {/* Quick Hover Trash / Restore Action */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {t.isTrash ? (
                            <>
                              <button
                                type="button"
                                onClick={() => restoreThread(t.id)}
                                className="px-1.5 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold cursor-pointer"
                                title="Restore to Inbox"
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={() => permanentDeleteThread(t.id)}
                                className="px-1.5 py-0.5 rounded bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-[9px] font-bold cursor-pointer"
                                title="Delete Permanently"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => deleteThreadToTrash(t.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-950/70 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3. GMAIL READING PANE & THREAD CONVERSATION (Right Column) */}
        <div className={`flex-1 min-w-0 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-2xl ${
          mobileShowChat ? 'flex' : 'hidden md:flex'
        }`}>
          {currentThread ? (
            <>
              {/* Compact Message Header */}
              <div className="px-3.5 py-2 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md flex flex-col gap-1.5 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileShowChat(false)}
                      className="p-1 rounded-lg bg-slate-800 text-slate-300 md:hidden cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-sm md:text-[15px] font-black text-slate-100 truncate">{currentThread.subject}</h2>
                        {currentThread.labels && currentThread.labels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 flex items-center gap-1"
                          >
                            <span>{lbl}</span>
                            <button
                              type="button"
                              onClick={() => removeThreadLabel(currentThread.id, lbl)}
                              className="hover:text-rose-400 cursor-pointer"
                              title="Remove label"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-200">{currentThread.leadName}</span>
                        <span>&bull;</span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(currentThread.leadEmail, 'header-email', 'Email Copied')}
                          className="text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 cursor-pointer"
                          title="Click to copy prospect email"
                        >
                          <span>{currentThread.leadEmail}</span>
                          {copiedTextId === 'header-email' ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 opacity-70" />
                          )}
                        </button>
                        <span>&bull;</span>
                        <span className="text-slate-300 truncate">{currentThread.leadCompany}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1 shrink-0 relative">
                    {/* AI Thread Summary Button */}
                    <button
                      type="button"
                      onClick={handleAnalyzeThreadIntent}
                      disabled={isAnalyzingThread}
                      className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                      title="AI Thread Summary & Recommended Action"
                    >
                      <BrainCircuit className={`w-3 h-3 text-purple-300 ${isAnalyzingThread ? 'animate-spin' : ''}`} />
                      <span className="hidden xl:inline">{isAnalyzingThread ? 'Analyzing...' : 'AI Summary'}</span>
                    </button>

                    {/* CRM Lead Card Toggle or Save to CRM */}
                    {matchedCrmLead ? (
                      <button
                        type="button"
                        onClick={() => setShowLeadCrmCard(prev => !prev)}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                          showLeadCrmCard
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                        title="View & Edit Lead CRM Profile and Notes"
                      >
                        <User className="w-3 h-3 text-cyan-400" />
                        <span className="hidden xl:inline">CRM Info</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveCurrentSenderToLeads}
                        className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                        title="Save this contact to your Leads Directory"
                      >
                        <UserPlus className="w-3 h-3 text-emerald-400" />
                        <span className="hidden xl:inline">Save Lead</span>
                      </button>
                    )}

                    {/* Label Dropdown */}
                    {!currentThread.isTrash && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowLabelMenu(prev => !prev)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-400 cursor-pointer"
                          title="Assign Label"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                        {showLabelMenu && (
                          <div className="absolute right-0 mt-2 w-52 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2.5 z-30 space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Assign Label</div>
                            <div className="space-y-1">
                              {labelPresets.map(preset => {
                                const hasLabel = currentThread.labels.includes(preset.name);
                                return (
                                  <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => {
                                      if (hasLabel) removeThreadLabel(currentThread.id, preset.name);
                                      else addThreadLabel(currentThread.id, preset.name);
                                      setShowLabelMenu(false);
                                    }}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-900 text-xs text-slate-200 cursor-pointer"
                                  >
                                    <span>{preset.name}</span>
                                    {hasLabel && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-1 pt-1 border-t border-slate-800">
                              <input
                                type="text"
                                value={customLabelInput}
                                onChange={(e) => setCustomLabelInput(e.target.value)}
                                placeholder="Custom label..."
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-500 min-w-0"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (customLabelInput.trim()) {
                                    addThreadLabel(currentThread.id, customLabelInput.trim());
                                    setCustomLabelInput('');
                                    setShowLabelMenu(false);
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-cyan-600 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {currentThread.isTrash && (
                      <button
                        type="button"
                        onClick={() => restoreThread(currentThread.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Restore to Inbox"
                      >
                        <CornerUpLeft className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleThreadStar(currentThread.id)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer"
                      title="Star conversation"
                    >
                      <Star className={`w-3.5 h-3.5 ${currentThread.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentThread.isTrash || selectedFolder === 'trash') {
                          permanentDeleteThread(currentThread.id);
                        } else {
                          deleteThreadToTrash(currentThread.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer"
                      title={currentThread.isTrash ? 'Delete Permanently' : 'Move to Trash'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Collapsible Lead CRM Context & Quick Notes Panel */}
                {showLeadCrmCard && matchedCrmLead && (
                  <div className="p-2.5 rounded-xl bg-slate-900/95 border border-cyan-500/30 space-y-2 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className="font-bold text-cyan-300 flex items-center gap-1">
                          <Building className="w-3.5 h-3.5" />
                          {matchedCrmLead.company} ({matchedCrmLead.title || 'Executive'})
                        </span>
                        {matchedCrmLead.website && (
                          <a
                            href={matchedCrmLead.website.startsWith('http') ? matchedCrmLead.website : `https://${matchedCrmLead.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-300 hover:text-cyan-400 flex items-center gap-1 underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Website</span>
                          </a>
                        )}
                        {matchedCrmLead.phone && (
                          <span className="text-slate-400 flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3" />
                            {matchedCrmLead.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">CRM Stage:</span>
                        <select
                          value={matchedCrmLead.status}
                          onChange={(e) => updateLead(matchedCrmLead.id, { status: e.target.value as LeadStatus })}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-bold text-emerald-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="new">New Lead</option>
                          <option value="contacted">Contacted</option>
                          <option value="opened">Opened</option>
                          <option value="replied">Replied</option>
                          <option value="converted">Converted / Won</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowLeadCrmCard(false)}
                          className="text-slate-500 hover:text-white p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <input
                        type="text"
                        value={leadNoteDraft}
                        onChange={(e) => setLeadNoteDraft(e.target.value)}
                        placeholder="Add private CRM notes about this lead..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveLeadNote}
                        className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer shrink-0"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                )}

                {/* Collapsible AI Thread Summary & Deal Intelligence Banner */}
                {threadAiSummary && threadAiSummary.threadId === currentThread.id && (
                  <div className="p-2.5 rounded-xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/40 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="w-3.5 h-3.5 text-purple-300" />
                        <span className="text-xs font-black text-purple-200">{threadAiSummary.intent}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyText(threadAiSummary.suggestedReply);
                            replyTextareaRef.current?.focus();
                          }}
                          className="px-2 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          ✨ Use Suggested Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => setThreadAiSummary(null)}
                          className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{threadAiSummary.summary}</p>
                  </div>
                )}

                {/* Compact Reading Controls Bar: Filter Client Replies Only, Text Size, & Maximize View */}
                {(() => {
                  const allMsgs = Array.isArray(currentThread.messages) ? currentThread.messages : [];
                  const leadRepliesCount = allMsgs.filter(m => m.sender === 'lead').length;
                  const sentMsgsCount = allMsgs.filter(m => m.sender === 'user').length;
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80 text-[10px]">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setMessageDirectionFilter('all')}
                          className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                            messageDirectionFilter === 'all'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          All ({allMsgs.length || 1})
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessageDirectionFilter('lead_only')}
                          className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer ${
                            messageDirectionFilter === 'lead_only'
                              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/50'
                              : 'bg-slate-900 text-emerald-400/90 hover:text-emerald-300 border border-slate-800'
                          }`}
                          title="Show only what the other person replied"
                        >
                          <span>📥 Client Replies ({leadRepliesCount})</span>
                        </button>
                        {sentMsgsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setMessageDirectionFilter('user_only')}
                            className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                              messageDirectionFilter === 'user_only'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            📤 My Sent ({sentMsgsCount})
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setLargeReadingText(prev => !prev)}
                          className={`px-2 py-0.5 rounded-lg font-bold border transition cursor-pointer ${
                            largeReadingText
                              ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                          title="Toggle Larger Clear Font for Easy Reading"
                        >
                          {largeReadingText ? '🔍 Large Text: ON' : '🔍 Normal Text'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsComposerMinimized(prev => !prev)}
                          className={`px-2 py-0.5 rounded-lg font-bold border transition cursor-pointer ${
                            isComposerMinimized
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                          title="Minimize or Expand bottom reply box to see more of the conversation"
                        >
                          {isComposerMinimized ? '⬆️ Show Reply Box' : '⬇️ Hide Reply Box'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Scrollable Messages Stream - Maximum Vertical Space for Reading */}
              <div
                ref={messagesScrollRef}
                className="flex-1 overflow-y-auto p-2.5 md:p-4 space-y-3 min-h-0 bg-gradient-to-b from-slate-950/40 to-slate-900/40"
              >
                {/* Ultra-Compact 1-Line Latest Reply Quick-Translate Bar (when thread has multiple messages) */}
                {(() => {
                  const allMsgs = Array.isArray(currentThread.messages) ? currentThread.messages : [];
                  const latestLeadMsg = [...allMsgs].reverse().find(m => m.sender === 'lead');
                  if (!latestLeadMsg || messageDirectionFilter === 'user_only' || allMsgs.length <= 1) return null;
                  const cleanedSpotlight = cleanBodyText(
                    latestLeadMsg.body,
                    currentThread.leadCompany,
                    currentThread.leadName
                  );
                  const { mainReply } = splitReplyAndQuotedHistory(cleanedSpotlight);
                  const spotlightKey = `spotlight-${latestLeadMsg.id || currentThread.id}`;

                  return (
                    <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-900/95 to-cyan-950/50 border border-emerald-500/40 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shrink-0">
                            📩 Latest Reply
                          </span>
                          <span className="text-xs text-emerald-50 font-medium truncate">
                            {mainReply}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleTranslateMessage(spotlightKey, mainReply)}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
                            <span>
                              {translatingMsgId === spotlightKey
                                ? 'অনুবাদ হচ্ছে...'
                                : translatedMessagesMap[spotlightKey]
                                ? 'Hide বাংলা'
                                : '🇧🇩 বাংলায় বুঝুন'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsComposerMinimized(false);
                              replyTextareaRef.current?.focus();
                            }}
                            className="px-2 py-0.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition"
                          >
                            <Reply className="w-2.5 h-2.5" />
                            <span>Reply</span>
                          </button>
                        </div>
                      </div>

                      {translatedMessagesMap[spotlightKey] && (
                        <div className="p-2 rounded-lg bg-slate-950/90 border border-emerald-500/40 text-xs text-emerald-200 whitespace-pre-wrap leading-relaxed">
                          {translatedMessagesMap[spotlightKey]}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const baseMessages =
                    Array.isArray(currentThread.messages) && currentThread.messages.length > 0
                      ? currentThread.messages
                      : [
                          {
                            id: `${currentThread.id}-fallback`,
                            sender: 'lead' as const,
                            senderName: currentThread.leadName,
                            senderEmail: currentThread.leadEmail,
                            body: currentThread.lastMessage || 'No message body.',
                            timestamp: currentThread.lastMessageDate || currentThread.updatedAt || 'Today',
                            isRead: true
                          }
                        ];

                  const visibleMessages = baseMessages.filter(m => {
                    if (messageDirectionFilter === 'lead_only') return m.sender === 'lead';
                    if (messageDirectionFilter === 'user_only') return m.sender === 'user';
                    return true;
                  });

                  if (visibleMessages.length === 0) {
                    return (
                      <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <div className="text-sm font-bold text-slate-300">
                          {messageDirectionFilter === 'lead_only'
                            ? 'No incoming reply from this contact yet'
                            : 'No messages match this filter'}
                        </div>
                        <button
                          type="button"
                          onClick={() => setMessageDirectionFilter('all')}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold cursor-pointer"
                        >
                          Show All Messages
                        </button>
                      </div>
                    );
                  }

                  return visibleMessages.map((m, idx) => {
                    const isLead = m.sender === 'lead';
                    const isMsgUnseen = isLead && (m.isRead === false || (currentThread.unreadCount || 0) > 0 && idx === visibleMessages.length - 1);
                    const msgKey = String(m.id || `${currentThread.id}-${idx}`);
                    const cleanedBody = cleanBodyText(m.body, currentThread.leadCompany, currentThread.leadName);
                    const { mainReply, quotedHistory } = splitReplyAndQuotedHistory(cleanedBody);
                    const isQuoteExpanded = Boolean(expandedQuotesMap[msgKey]);

                    return (
                      <div
                        key={msgKey}
                        onClick={() => {
                          if (
                            (currentThread.unreadCount || 0) > 0 ||
                            (Array.isArray(currentThread.messages) &&
                              currentThread.messages.some(msg => msg.sender === 'lead' && msg.isRead === false))
                          ) {
                            markThreadRead(currentThread.id);
                          }
                        }}
                        className={`p-3 md:p-4 rounded-2xl border space-y-2 shadow-md transition ${
                          isMsgUnseen
                            ? 'bg-gradient-to-r from-emerald-950/60 via-[#0b1526] to-[#0b1526] border-emerald-400 ring-2 ring-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.18)]'
                            : isLead
                            ? 'bg-[#0b1526] border-slate-800'
                            : 'bg-slate-900/80 border-blue-500/25 md:ml-6'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-1.5 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                isLead ? 'bg-emerald-500 text-slate-950' : 'bg-blue-600 text-white'
                              }`}
                            >
                              {isLead
                                ? currentThread.leadName?.[0] || 'L'
                                : currentUser.name
                                ? currentUser.name[0]
                                : 'U'}
                            </div>
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs md:text-sm text-white">
                                {isLead ? currentThread.leadName : m.senderName || currentUser.name}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  isLead
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {isLead ? '📥 Prospect Reply' : '📤 Sent by You'}
                              </span>
                              {isMsgUnseen && (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[9px] uppercase tracking-wider animate-pulse">
                                  ✨ NEW UNSEEN
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400 font-mono truncate hidden sm:inline">
                                &lt;{isLead ? currentThread.leadEmail : m.senderEmail || currentUser.email}&gt;
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-slate-400 font-mono mr-1">
                              {m.timestamp || 'Just now'}
                            </span>
                            {isLead && (
                              <button
                                type="button"
                                onClick={() => handleTranslateMessage(msgKey, mainReply)}
                                className="px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer transition"
                                title="Translate & explain this message in Bangla"
                              >
                                {translatingMsgId === msgKey
                                  ? '...'
                                  : translatedMessagesMap[msgKey]
                                  ? 'Hide বাংলা'
                                  : '🇧🇩 বাংলা'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopyText(mainReply, `msg-${msgKey}`, 'Message Copied')}
                              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                              title="Copy message text"
                            >
                              {copiedTextId === `msg-${msgKey}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsComposerMinimized(false);
                                replyTextareaRef.current?.focus();
                              }}
                              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition cursor-pointer"
                              title="Reply to this message"
                            >
                              <Reply className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Main Message Body with Crystal-Clear Contrast & Adjustable Size */}
                        <div
                          className={`${
                            largeReadingText
                              ? isLead
                                ? 'text-[15px] md:text-base text-white font-medium'
                                : 'text-sm md:text-[15px] text-slate-100'
                              : 'text-xs md:text-sm text-slate-200'
                          } whitespace-pre-wrap leading-relaxed`}
                        >
                          {mainReply}
                        </div>

                        {/* Gmail-Style Attached Files Display (Stored in Google Drive — 0 KB Hosting Used) */}
                        {Array.isArray((m as any).attachments) && (m as any).attachments.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
                              <span className="flex items-center gap-1">
                                <Paperclip className="w-3 h-3 text-emerald-400" />
                                <span>{(m as any).attachments.length} Attached File(s) • Google Drive Storage</span>
                              </span>
                              {driveStorageSettings.folderUrl && (
                                <a
                                  href={driveStorageSettings.folderUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-300 hover:underline flex items-center gap-1"
                                >
                                  <span>Open Drive Folder</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(m as any).attachments.map((att: EmailAttachment, attIdx: number) => {
                                const openUrl =
                                  att.driveFileUrl ||
                                  att.driveFolderUrl ||
                                  driveStorageSettings.folderUrl ||
                                  'https://drive.google.com/drive/my-drive';
                                return (
                                  <a
                                    key={att.id || attIdx}
                                    href={openUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-emerald-500/30 hover:border-emerald-400/60 flex items-center gap-2 text-xs text-slate-100 transition group shadow-sm"
                                    title="View / Manage Attachment in Google Drive"
                                  >
                                    <Paperclip className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <div className="min-w-0">
                                      <div className="font-bold text-[11px] text-white truncate max-w-[180px]">
                                        {att.name}
                                      </div>
                                      <div className="text-[9px] text-emerald-300/90 font-mono flex items-center gap-1">
                                        <span>{formatFileSize(att.size)}</span>
                                        <span>•</span>
                                        <span>☁️ Google Drive ↗</span>
                                      </div>
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Bangla Translation Box if activated */}
                        {translatedMessagesMap[msgKey] && (
                          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs md:text-sm text-emerald-200 whitespace-pre-wrap leading-relaxed">
                            {translatedMessagesMap[msgKey]}
                          </div>
                        )}

                        {/* Collapsible Quoted Email History so main reply is never cluttered */}
                        {quotedHistory && (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedQuotesMap(prev => ({
                                  ...prev,
                                  [msgKey]: !prev[msgKey]
                                }))
                              }
                              className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[10px] font-bold text-slate-400 hover:text-slate-200 cursor-pointer transition"
                            >
                              {isQuoteExpanded
                                ? '▴ Hide Previous Quoted Email History'
                                : '⋯ Show Previous Quoted Email History'}
                            </button>
                            {isQuoteExpanded && (
                              <div className="mt-1.5 pl-3 border-l-2 border-slate-700 text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                                {quotedHistory}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Bottom Reply & AI Draft Box (AI Draft options inside Toggle + Compact Composer so reading area stays huge) */}
              {isComposerMinimized ? (
                <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsComposerMinimized(false);
                      setTimeout(() => replyTextareaRef.current?.focus(), 50);
                    }}
                    className="flex-1 text-left px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate">✍️ Click to write a reply to {currentThread.leadName} ({currentThread.leadEmail})...</span>
                    <span className="text-cyan-400 font-bold shrink-0 ml-2">Expand Reply ⬆️</span>
                  </button>
                </div>
              ) : (
              <div className="px-3 py-2 bg-slate-950/95 border-t border-slate-800 space-y-1.5 shrink-0">
                {/* Toggleable AI Draft Options Panel (Hidden by default until user clicks '✨ AI Draft' toggle) */}
                {isAiCopilotExpanded && (
                  <div className="p-2.5 bg-gradient-to-r from-purple-950/40 via-slate-900/95 to-indigo-950/40 rounded-xl border border-purple-700/50 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Sparkles className="w-3 h-3 text-purple-400 animate-pulse shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 mr-1">
                          AI Draft Presets:
                        </span>
                        {[
                          { id: 'demo', label: '📅 Book 15m Demo' },
                          { id: 'pricing', label: '💰 Share Pricing & ROI' },
                          { id: 'objection', label: '🛡️ Handle Objection' },
                          { id: 'agreement', label: '⚡ Agree & Schedule' },
                          { id: 'friendly', label: '🤝 Friendly Video Intro' },
                        ].map(btn => (
                          <button
                            key={btn.id}
                            type="button"
                            disabled={isGeneratingAiReply}
                            onClick={() => handleAiDraft(btn.id as any)}
                            className="px-2 py-0.5 rounded-lg bg-purple-950/70 hover:bg-purple-900 text-purple-200 border border-purple-700/60 text-[10px] font-bold whitespace-nowrap transition cursor-pointer disabled:opacity-50"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isGeneratingAiReply || !replyText.trim()}
                          onClick={handlePolishReply}
                          className="px-2 py-0.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-40 whitespace-nowrap"
                          title="Polish grammar, tone, and eliminate spam triggers"
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                          <span>✨ AI Polish & Proofread</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAiCopilotExpanded(false)}
                          className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
                          title="Close AI Draft Panel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customReplyPrompt}
                        onChange={(e) => setCustomReplyPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAiDraft('custom');
                          }
                        }}
                        placeholder="Custom AI instruction (e.g. Confirm 2pm Thursday, emphasize free trial, ask for phone)..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        disabled={isGeneratingAiReply || !customReplyPrompt.trim()}
                        onClick={() => handleAiDraft('custom')}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40 shrink-0"
                      >
                        {isGeneratingAiReply ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3" />
                        )}
                        <span>{isGeneratingAiReply ? 'Drafting...' : '✨ Generate'}</span>
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendReply} className="space-y-1.5">
                  {/* Hidden Any-File Input for Reply Composer */}
                  <input
                    ref={replyFileInputRef}
                    type="file"
                    multiple
                    accept="*/*"
                    onChange={(e) => {
                      handleAttachFiles(e.target.files, 'reply');
                      e.target.value = '';
                    }}
                    className="hidden"
                  />

                  {/* Attached Files Chips above Reply Textarea */}
                  {replyAttachments.length > 0 && (
                    <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
                        <span className="flex items-center gap-1">
                          <Paperclip className="w-3 h-3 text-emerald-400" />
                          <span>
                            {replyAttachments.length} File(s) Attached • Stored via Google Drive (0 KB Hosting Used)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowDriveSettingsModal(true)}
                          className="text-cyan-300 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span>{driveStorageSettings.folderUrl ? 'Change Drive Folder' : 'Set Drive Folder Link'}</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {replyAttachments.map((att) => (
                          <div
                            key={att.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/40 flex items-center gap-2 text-[11px] text-slate-100"
                          >
                            <Paperclip className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="font-bold truncate max-w-[160px]">{att.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(att.size)})</span>
                            {att.driveFolderUrl && (
                              <a
                                href={att.driveFileUrl || att.driveFolderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-emerald-300 hover:underline flex items-center gap-0.5"
                                title="Open in Google Drive"
                              >
                                <span>Drive ↗</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setReplyAttachments(prev => prev.filter(item => item.id !== att.id))}
                              className="text-slate-400 hover:text-rose-400 cursor-pointer ml-0.5"
                              title="Remove attachment"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <textarea
                    ref={replyTextareaRef}
                    rows={2}
                    value={replyText}
                    onFocus={() => {
                      if (
                        (currentThread.unreadCount || 0) > 0 ||
                        (Array.isArray(currentThread.messages) &&
                          currentThread.messages.some(msg => msg.sender === 'lead' && msg.isRead === false))
                      ) {
                        markThreadRead(currentThread.id);
                      }
                    }}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && (replyText.trim() || replyAttachments.length > 0)) {
                        handleSendReply(e as any);
                      }
                    }}
                    placeholder={`Reply to ${currentThread.leadName} (${currentThread.leadEmail})...`}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 shadow-inner resize-y"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Gmail-style Attach Any File Button (Google Drive Storage) */}
                      <button
                        type="button"
                        onClick={() => replyFileInputRef.current?.click()}
                        disabled={isUploadingAttachment}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition shadow-sm"
                        title="Attach any file (PDF, Image, Doc, Zip, Video) — Stored in Google Drive, 0 KB on your hosting"
                      >
                        <Paperclip className="w-3 h-3 text-emerald-400" />
                        <span>{isUploadingAttachment ? 'Attaching...' : '📎 Attach File'}</span>
                      </button>

                      {/* Quick Google Drive Folder Link Button right in Reply Bar */}
                      <button
                        type="button"
                        onClick={() => setShowDriveSettingsModal(true)}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
                          driveStorageSettings.folderUrl
                            ? 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/30'
                            : 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border-amber-500/40'
                        }`}
                        title="Set or Change your Google Drive Folder Link for attached files"
                      >
                        <FolderOpen className="w-3 h-3 text-cyan-400" />
                        <span>{driveStorageSettings.folderUrl ? '☁️ Drive Folder ✓' : '☁️ Set Drive Link'}</span>
                      </button>

                      {/* 1-Click Toggle Button for AI Draft Options */}
                      <button
                        type="button"
                        onClick={() => setIsAiCopilotExpanded(prev => !prev)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition ${
                          isAiCopilotExpanded
                            ? 'bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-500/30'
                            : 'bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border-purple-700/60'
                        }`}
                        title="Toggle AI Draft Presets, AI Polish & Custom AI Reply Generator"
                      >
                        <Sparkles className="w-3 h-3 text-purple-300" />
                        <span>✨ AI Draft {isAiCopilotExpanded ? '▾' : '▸'}</span>
                      </button>

                      {/* Quick AI Polish button right in bar when text is typed */}
                      {replyText.trim() && !isAiCopilotExpanded && (
                        <button
                          type="button"
                          disabled={isGeneratingAiReply}
                          onClick={handlePolishReply}
                          className="px-2 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                          title="Polish grammar, tone, and eliminate spam triggers"
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                          <span>✨ Polish</span>
                        </button>
                      )}

                      {/* Instant Template Selector */}
                      <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-0.5">
                        <FileText className="w-3 h-3 text-cyan-400" />
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleInsertTemplate(e.target.value, false);
                              e.target.value = "";
                            }
                          }}
                          defaultValue=""
                          className="bg-transparent text-slate-200 text-[10px] font-bold cursor-pointer focus:outline-none max-w-[150px] truncate"
                        >
                          <option value="" disabled className="bg-slate-900 text-slate-400">
                            ⚡ Template ({activeEmailTemplates.length})...
                          </option>
                          {activeEmailTemplates.map(t => (
                            <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100">
                              {t.isCustom ? '⭐ ' : '📋 '} {t.title} {t.isCustom ? '(Custom)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Matched SMTP Account Selector */}
                      {activeSmtpAccounts.length > 0 && (
                        <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-0.5">
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">From:</span>
                          <select
                            value={replySmtpId}
                            onChange={(e) => setReplySmtpId(e.target.value)}
                            className="bg-transparent text-slate-200 text-[10px] font-bold cursor-pointer focus:outline-none max-w-[140px] truncate"
                          >
                            {activeSmtpAccounts.map(acc => (
                              <option key={acc.id} value={acc.id} className="bg-slate-900 text-slate-100">
                                {acc.name} ({acc.fromEmail || acc.username})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Quick Insert Snippets */}
                      <button
                        type="button"
                        onClick={() => handleInsertQuickSnippet('calendar')}
                        className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer transition"
                        title="Insert a proposed meeting slot"
                      >
                        📅 +Slot
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsComposerMinimized(true)}
                        className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-bold cursor-pointer transition"
                        title="Minimize reply box for full screen reading"
                      >
                        ⬇️ Hide
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {replyText.trim() && (
                        <button
                          type="button"
                          onClick={() => setReplyText('')}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-bold cursor-pointer transition"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer"
                        title="Send Reply (Ctrl+Enter)"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send Reply</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <Mail className="w-12 h-12 text-slate-700" />
              <div className="text-sm font-bold text-slate-300">Select an email to read</div>
              <p className="text-xs text-slate-500 max-w-sm">
                Choose any conversation from your mailbox to inspect full thread history and reply.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* NEW EMAIL COMPOSE MODAL */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-slate-800 w-full max-w-2xl rounded-3xl p-5 md:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">Compose Direct Cold Outreach</h3>
                  <p className="text-[10px] text-slate-400">100% Primary Inbox &bull; Multi-domain SMTP relay</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-cyan-950/40 rounded-2xl border border-indigo-500/30 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>1-Click AI Draft Presets:</span>
                </div>
                {leads.filter(l => !l.isTrash).length > 0 && (
                  <select
                    onChange={(e) => {
                      const picked = leads.find(l => l.id === e.target.value);
                      if (picked) {
                        setComposeTo(picked.email);
                        setComposeName(picked.name);
                        setComposeCompany(picked.company);
                      }
                      e.target.value = '';
                    }}
                    defaultValue=""
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-cyan-300 cursor-pointer focus:outline-none"
                  >
                    <option value="" disabled>👤 Auto-Fill from CRM Leads...</option>
                    {leads.filter(l => !l.isTrash).slice(0, 50).map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.email} • {l.company})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '🚀 SaaS Pitch (99.8% Placement)', type: 'pitch' as const, prompt: 'Pitch cold outreach software highlighting 99.8% inbox placement and instant lead generation.' },
                  { label: '📅 15m Demo Request', type: 'demo' as const, prompt: 'Ask for a quick 15-min screen share demo for next Tuesday or Wednesday.' },
                  { label: '🛡️ Deliverability Audit', type: 'audit' as const, prompt: 'Offer a complimentary 1-page domain deliverability & SPF/DKIM audit.' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isGeneratingComposeAi}
                    onClick={() => handleGenerateComposeAi(item.prompt, item.type)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer hover:border-cyan-500"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-400">Recipient Email *</label>
                    {composeEmailCheck && (
                      <span className={`text-[10px] font-extrabold ${composeEmailCheck.isValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {composeEmailCheck.isValid ? '✓ Verified Valid' : '⚠️ Invalid Email'}
                      </span>
                    )}
                  </div>
                  <input
                    type="email"
                    required
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="prospect@company.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={composeName}
                    onChange={(e) => setComposeName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400">Sender SMTP Relay *</label>
                <select
                  value={composeSmtpId}
                  onChange={(e) => setComposeSmtpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {smtpAccounts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.username} &bull; {s.host})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-400">Subject Line *</label>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5">
                    <FileText className="w-3 h-3 text-cyan-400" />
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleInsertTemplate(e.target.value, true);
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                      className="bg-transparent text-cyan-300 text-[10px] font-bold cursor-pointer focus:outline-none max-w-[190px] truncate"
                    >
                      <option value="" disabled className="bg-slate-900 text-slate-400">⚡ Insert Saved Template...</option>
                      {activeEmailTemplates.map(t => (
                        <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100">
                          {t.isCustom ? '⭐ ' : '📋 '} {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Quick question regarding your outbound pipeline..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400">Body Content *</label>
                <textarea
                  rows={6}
                  required
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Hi {{name}},&#10;&#10;Noticed your recent work and wanted to share..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-sans leading-relaxed"
                />
              </div>

              {/* Gmail-Style Any-File Attachment Section in Compose Modal (Google Drive Storage) */}
              <div className="p-3 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2">
                <input
                  ref={composeFileInputRef}
                  type="file"
                  multiple
                  accept="*/*"
                  onChange={(e) => {
                    handleAttachFiles(e.target.files, 'compose');
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => composeFileInputRef.current?.click()}
                      disabled={isUploadingAttachment}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isUploadingAttachment ? 'Attaching...' : '📎 Attach Any File (Google Drive)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDriveSettingsModal(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{driveStorageSettings.folderUrl ? '⚙️ Change Drive Folder Link' : '🔗 Set Google Drive Folder Link'}</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    ☁️ 0 KB Hosting Used • Stored in Google Drive
                  </span>
                </div>

                {composeAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {composeAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/40 flex items-center gap-2 text-[11px] text-slate-100"
                      >
                        <Paperclip className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="font-bold truncate max-w-[180px]">{att.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(att.size)})</span>
                        <button
                          type="button"
                          onClick={() => setComposeAttachments(prev => prev.filter(item => item.id !== att.id))}
                          className="text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!composeTo || !composeSubject || (!composeBody && composeAttachments.length === 0)) return;
                  const sendSuccess = await sendDirectEmail({
                    recipientEmail: composeTo,
                    recipientName: composeName || composeTo,
                    senderSmtpId: composeSmtpId || smtpAccounts[0]?.id || '',
                    subject: composeSubject,
                    body: composeBody || `📎 Attached ${composeAttachments.length} file(s)`,
                    attachments: composeAttachments.length > 0 ? composeAttachments : undefined
                  });
                  if (sendSuccess) {
                    setShowComposeModal(false);
                    setComposeTo('');
                    setComposeName('');
                    setComposeCompany('');
                    setComposeSubject('');
                    setComposeBody('');
                    setComposeAttachments([]);
                    confetti({ particleCount: 40, spread: 65 });
                  }
                }}
                disabled={!composeTo || !composeSubject || (!composeBody && composeAttachments.length === 0)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/25 cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Outbound Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE DRIVE FOLDER LINK & ATTACHMENT STORAGE MODAL */}
      {showDriveSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-emerald-500/40 w-full max-w-xl rounded-3xl p-5 md:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-100 text-sm md:text-base">
                    ☁️ Google Drive Attachment Storage Link
                  </h3>
                  <p className="text-[11px] text-emerald-300 font-medium">
                    আপনার ইমেইলের সব অ্যাটাচ ফাইল আপনার Google Drive ফোল্ডারে স্টোর ও লিংক হবে (হোস্টিংয়ে ০ KB জায়গা নেবে)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDriveSettingsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer p-1.5 rounded-xl hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDriveSettings} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-1.5">
                <div className="font-bold text-emerald-200 flex items-center justify-between">
                  <span>✅ কীভাবে কাজ করে (Zero Hosting Storage):</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                    Hosting Disk: 0 KB Used
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  নিচে আপনার **Google Drive Folder Link** পেস্ট করে সেভ করুন। এরপর ইনবক্স থেকে যেকোনো ফাইল (`PDF, Image, ZIP, Doc, Video` ইত্যাদি) অ্যাটাচ করলে সেটি আপনার হোস্টিং সার্ভারে জমা না হয়ে সরাসরি প্রাপকের মেইলে যাবে এবং আপনার Google Drive ফোল্ডারের সাথে যুক্ত থাকবে। আপনি যেকোনো সময় নিচের লিংকটি পরিবর্তন (Change) করতে পারবেন।
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Your Google Drive Shared Folder Link *
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={driveFolderUrlInput}
                    onChange={(e) => setDriveFolderUrlInput(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?usp=sharing"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>
                {driveStorageSettings.folderId && (
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-emerald-300 font-mono">
                    <span>✓ Connected Folder ID: {driveStorageSettings.folderId}</span>
                    {driveStorageSettings.folderUrl && (
                      <a
                        href={driveStorageSettings.folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-300 hover:underline flex items-center gap-1 font-sans font-bold"
                      >
                        <span>Open Folder in Google Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Folder Display Label (Optional)
                </label>
                <input
                  type="text"
                  value={driveFolderNameInput}
                  onChange={(e) => setDriveFolderNameInput(e.target.value)}
                  placeholder="My Google Drive Email Attachments"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoIncludeDriveLink}
                  onChange={(e) => setAutoIncludeDriveLink(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-slate-200 text-xs">
                    Include Google Drive Attachment Link in Sent Emails
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ফাইলটি সরাসরি ইমেইলে অ্যাটাচ হওয়ার পাশাপাশি প্রাপক আপনার Google Drive লিংক থেকেও ডাউনলোড করতে পারবে।
                  </div>
                </div>
              </label>

              {driveSavedFeedback && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>✅ আপনার Google Drive ফোল্ডার লিংক সফলভাবে সেভ ও আপডেট হয়েছে!</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                {driveFolderUrlInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setDriveFolderUrlInput('');
                      updateDriveStorageSettings({ folderUrl: '', folderId: '' });
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/50 text-rose-300 text-xs font-bold cursor-pointer"
                  >
                    Remove Link
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowDriveSettingsModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save / Update Google Drive Link</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
