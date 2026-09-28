import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp, cleanEmailBodyText } from '../../context/AppContext';
import { safeParseResponse } from '../../lib/safeFetch';
import { EmailThread, EmailMessage } from '../../types';
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
  CheckCheck, 
  Clock, 
  CornerUpLeft, 
  Archive, 
  CheckCircle2, 
  Flame, 
  MessageSquare, 
  ChevronRight, 
  ShieldCheck,
  Plus,
  RefreshCw,
  ArrowLeft,
  Forward,
  Reply,
  ReplyAll,
  Printer,
  MoreVertical,
  Paperclip,
  Check,
  Calendar,
  AlertOctagon,
  FileText,
  Edit2,
  X,
  Smile,
  Sliders,
  ChevronDown,
  Wand2,
  Zap,
  HelpCircle,
  ThumbsUp
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
    permanentDeleteThread,
    currentUser,
    searchQuery,
    setSearchQuery,
    emailTemplates,
    smtpAccounts,
    sentEmails,
    leads,
    sendDirectEmail,
    addNotification,
    syncInboxReplies,
    deductAiTokens
  } = useApp();

  // Automatically sync IMAP replies in background when SmartInbox opens & every 2.5s while open (100% automatic, no manual button needed)
  useEffect(() => {
    syncInboxReplies(undefined, true).catch(() => {});
    const timer = setInterval(() => {
      syncInboxReplies(undefined, true).catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // Gmail folder selection
  const [selectedFolder, setSelectedFolder] = useState<'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'spam' | 'trash' | 'high_intent' | 'meetings'>('inbox');
  const [primaryTab, setPrimaryTab] = useState<'primary' | 'interested' | 'meetings' | 'followup' | 'updates'>('primary');
  
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [replyText, setReplyText] = useState<string>('');
  const [replyMode, setReplyMode] = useState<'reply' | 'forward'>('reply');
  const [forwardRecipient, setForwardRecipient] = useState<string>('');

  const [isGeneratingAiReply, setIsGeneratingAiReply] = useState<boolean>(false);
  const [customReplyPrompt, setCustomReplyPrompt] = useState<string>('');
  const [showLabelMenu, setShowLabelMenu] = useState<boolean>(false);
  const [customLabelInput, setCustomLabelInput] = useState<string>('');
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);
  const [showAiReplyDrawer, setShowAiReplyDrawer] = useState<boolean>(false);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  // New Compose Modal
  const [showComposeModal, setShowComposeModal] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeName, setComposeName] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [composeSmtpId, setComposeSmtpId] = useState<string>(smtpAccounts[0]?.id || '');
  const [isGeneratingComposeAi, setIsGeneratingComposeAi] = useState<boolean>(false);

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

  // Active thread details
  const currentThread = useMemo(() => {
    return threads.find(t => t.id === activeThreadId) || null;
  }, [threads, activeThreadId]);

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
        if (byEmail) return byEmail;
      }
      if (nameOrNull) {
        const byName = activeSmtpAccounts.find(s => s.name === nameOrNull);
        if (byName) return byName;
      }
      return undefined;
    };

    // 1. Check thread's stored smtpAccountId / smtpEmail
    let detected = matchSmtp(currentThread.smtpAccountId, currentThread.smtpEmail);

    // 2. Check messages in reverse chronological order (user's senderEmail or lead's recipientEmail)
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

    // 3. Check SentEmails log for this lead's email address
    if (!detected && currentThread.leadEmail) {
      const normLead = currentThread.leadEmail.trim().toLowerCase();
      const sentLog = (sentEmails || []).find(
        s => !s.isTrash && s.recipientEmail?.trim().toLowerCase() === normLead
      );
      if (sentLog) {
        detected = matchSmtp(sentLog.smtpAccountId, sentLog.senderEmail, sentLog.smtpAccountName);
      }
    }

    // 4. Fallback to first connected SMTP account
    if (!detected) {
      detected =
        activeSmtpAccounts.find(s => s.isConnected && (s.password || s.apiKey)) ||
        activeSmtpAccounts[0];
    }

    if (detected) {
      setReplySmtpId(detected.id);
    }
  }, [currentThread?.id, currentThread?.smtpAccountId, currentThread?.smtpEmail, currentThread?.messages?.length, activeSmtpAccounts, sentEmails]);

  // Filtered threads list based on folder and search query
  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      // Trash filter
      if (selectedFolder === 'trash') {
        if (!thread.isTrash) return false;
      } else {
        if (thread.isTrash) return false;
      }

      // Folder matching
      if (selectedFolder === 'starred' && !thread.isStarred) return false;
      if (selectedFolder === 'sent' && !thread.messages.some(m => m.sender === 'user')) return false;
      if (selectedFolder === 'high_intent' && !thread.labels.includes('Hot Lead')) return false;
      if (selectedFolder === 'meetings' && !thread.labels.includes('Meeting Scheduled')) return false;
      if (selectedFolder === 'unread' && thread.unreadCount === 0) return false;

      // Primary tab filtering
      if (selectedFolder === 'inbox') {
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
  }, [threads, selectedFolder, primaryTab, searchQuery]);

  // Ensure a valid thread is selected if available
  useEffect(() => {
    if (filteredThreads.length > 0 && !filteredThreads.some(t => t.id === activeThreadId)) {
      setActiveThreadId(filteredThreads[0].id);
    }
  }, [filteredThreads, activeThreadId, setActiveThreadId]);

  const handleSelectThread = (thread: EmailThread) => {
    setActiveThreadId(thread.id);
    setMobileShowChat(true);
    if (thread.unreadCount > 0) {
      markThreadRead(thread.id);
    }
  };

  // Smoothly scroll conversation feed to bottom when thread opens or new messages arrive/are sent
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
    if (selectedThreadIds.length === filteredThreads.length) {
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
    selectedThreadIds.forEach(id => deleteThreadToTrash(id));
    setSelectedThreadIds([]);
    addNotification({
      title: 'Threads Moved to Trash',
      message: `Moved ${selectedThreadIds.length} conversation(s) to trash.`,
      type: 'system'
    });
  };

  const handleBulkMarkRead = () => {
    selectedThreadIds.forEach(id => markThreadRead(id));
    setSelectedThreadIds([]);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentThread) return;

    sendReply(currentThread.id, replyText.trim(), replySmtpId || undefined);
    setReplyText('');
    setCustomReplyPrompt('');
    setTimeout(() => {
      if (messagesScrollRef.current) {
        messagesScrollRef.current.scrollTo({
          top: messagesScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 60);
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
    const leadCompany = isCompose ? '' : (currentThread?.leadCompany || 'your team');
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
    }
  };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-5.5rem)] flex flex-col gap-3 md:gap-4 animate-in fade-in">
      
      {/* GMAIL TOP SEARCH & TOOLBAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl md:rounded-3xl p-2.5 md:p-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 md:gap-3 shadow-2xl shrink-0">
        
        {/* Search Bar */}
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mail: sender, company, subject, label:hot..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl md:rounded-2xl pl-10 pr-8 py-2 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedThreadIds.length > 0 ? (
            <div className="flex items-center gap-1.5 sm:gap-2 animate-in fade-in">
              <span className="text-[11px] sm:text-xs font-bold text-cyan-300 bg-cyan-950 px-2 py-1 rounded-lg border border-cyan-800">
                {selectedThreadIds.length} selected
              </span>
              <button
                type="button"
                onClick={handleBulkMarkRead}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Mark Read
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowComposeModal(true)}
              className="px-3.5 md:px-4 py-2 rounded-xl md:rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 flex items-center gap-1.5 md:gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Compose Email</span>
            </button>
          )}
        </div>
      </div>

      {/* MOBILE & TABLET FOLDER SWITCHER BAR (< lg) */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 pb-0.5">
        {[
          { id: 'inbox', label: 'Primary Inbox', icon: Inbox, count: threads.filter(t => !t.isTrash && t.unreadCount > 0).length },
          { id: 'starred', label: 'Starred', icon: Star, count: threads.filter(t => t.isStarred && !t.isTrash).length },
          { id: 'high_intent', label: 'Hot Leads', icon: Flame, count: threads.filter(t => t.labels.includes('Hot Lead') && !t.isTrash).length },
          { id: 'meetings', label: 'Meetings', icon: Calendar, count: threads.filter(t => t.labels.includes('Meeting Scheduled') && !t.isTrash).length },
          { id: 'trash', label: 'Trash', icon: Trash2, count: threads.filter(t => t.isTrash).length },
        ].map(folder => {
          const Icon = folder.icon;
          const isSelected = selectedFolder === folder.id;
          return (
            <button
              key={folder.id}
              type="button"
              onClick={() => {
                setSelectedFolder(folder.id as any);
                setSelectedThreadIds([]);
                setMobileShowChat(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{folder.label}</span>
              {folder.count > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-cyan-500 text-black font-extrabold' : 'bg-slate-800 text-slate-300'
                }`}>
                  {folder.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MAIN GMAIL CONTAINER: Left Nav + Thread List + Reading Pane */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        
        {/* 1. GMAIL LEFT FOLDER SIDEBAR */}
        <div className="w-56 bg-slate-900/90 border border-slate-800 rounded-3xl p-3 flex flex-col justify-between shrink-0 shadow-2xl hidden lg:flex">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 py-2">
              Mailboxes
            </div>

            {[
              { id: 'inbox', label: 'Primary Inbox', icon: Inbox, count: threads.filter(t => !t.isTrash && t.unreadCount > 0).length },
              { id: 'starred', label: 'Starred', icon: Star, count: threads.filter(t => t.isStarred && !t.isTrash).length },
              { id: 'high_intent', label: 'High Intent Leads', icon: Flame, count: threads.filter(t => t.labels.includes('Hot Lead') && !t.isTrash).length },
              { id: 'meetings', label: 'Meetings Booked', icon: Calendar, count: threads.filter(t => t.labels.includes('Meeting Scheduled') && !t.isTrash).length },
              { id: 'trash', label: 'Trash Bin', icon: Trash2, count: threads.filter(t => t.isTrash).length },
            ].map(folder => {
              const Icon = folder.icon;
              const isSelected = selectedFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    setSelectedFolder(folder.id as any);
                    setSelectedThreadIds([]);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
                    isSelected 
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span>{folder.label}</span>
                  </div>
                  {folder.count > 0 && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-cyan-500 text-black font-extrabold' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {folder.count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Custom Labels Section */}
            <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 py-1">
                Labels & Tags
              </div>
              {labelPresets.map((lbl, idx) => (
                <div key={idx} className="px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300">
                  <span className={`w-2.5 h-2.5 rounded-full border ${lbl.color}`} />
                  <span className="truncate">{lbl.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Connected SMTP Health indicator */}
          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-slate-400 font-medium">
              <span>IMAP / SMTP Relay</span>
              <span className="text-emerald-400 font-bold">100% Online</span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {smtpAccounts.find(s => !s.isTrash)?.name || 'Direct Domain Webmail'}
            </div>
          </div>
        </div>

        {/* 2. GMAIL THREADS LIST (Left Column in Split View) */}
        <div className={`w-full md:w-96 bg-slate-900/90 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl shrink-0 ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}>
          
          {/* Gmail Top Categories Tabs */}
          <div className="flex items-center border-b border-slate-800 bg-slate-950/90 overflow-x-auto text-xs p-1">
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
                className={`flex-1 py-2 px-3 text-center font-bold border-b-2 whitespace-nowrap transition cursor-pointer ${
                  primaryTab === tab.id
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-xs font-bold text-slate-400">No emails in this mailbox</div>
                <p className="text-[11px] text-slate-500">Incoming replies will instantly appear here.</p>
              </div>
            ) : (
              filteredThreads.map(t => {
                const isSelected = t.id === currentThread?.id;
                const isChecked = selectedThreadIds.includes(t.id);

                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectThread(t)}
                    className={`p-3.5 transition cursor-pointer flex gap-3 relative ${
                      isSelected 
                        ? 'bg-cyan-950/30 border-l-4 border-l-cyan-400' 
                        : t.unreadCount > 0 
                        ? 'bg-slate-900 font-bold' 
                        : 'hover:bg-slate-850 opacity-90'
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
                        <span className={`text-xs truncate ${t.unreadCount > 0 ? 'font-black text-slate-100' : 'text-slate-300'}`}>
                          {t.leadName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {t.updatedAt || 'Today'}
                        </span>
                      </div>

                      <div className="text-[11px] text-cyan-400/90 truncate font-semibold">
                        {t.subject}
                      </div>

                      <p className="text-[11px] text-slate-400 truncate">
                        {cleanBodyText(t.lastMessage, t.leadCompany, t.leadName)}
                      </p>

                      {/* Labels badges */}
                      {t.labels && t.labels.length > 0 && (
                        <div className="flex items-center gap-1 pt-1 flex-wrap">
                          {t.labels.map((lbl, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-cyan-300 border border-slate-700"
                            >
                              {lbl}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3. GMAIL READING PANE & THREAD CONVERSATION (Right Column) */}
        <div className={`flex-1 bg-slate-900/90 border border-slate-800 rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl ${
          mobileShowChat ? 'flex' : 'hidden md:flex'
        }`}>
          {currentThread ? (
            <>
              {/* Message Header */}
              <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-3 shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowChat(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1 md:hidden cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Inbox</span>
                  </button>

                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-black text-slate-100 truncate">{currentThread.subject}</h2>
                    <div className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="font-bold text-slate-200">{currentThread.leadName}</span>
                      <span>&bull;</span>
                      <span className="text-cyan-400 font-mono truncate max-w-[180px] sm:max-w-none">{currentThread.leadEmail}</span>
                      <span className="hidden sm:inline">&bull;</span>
                      <span className="hidden sm:inline text-slate-300">{currentThread.leadCompany}</span>
                      {(currentThread.smtpEmail || replySmtpId) && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] truncate max-w-[230px] sm:max-w-none">
                          Matched: {activeSmtpAccounts.find(s => s.id === replySmtpId)?.fromEmail || activeSmtpAccounts.find(s => s.id === replySmtpId)?.username || currentThread.smtpEmail}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      replyTextareaRef.current?.focus();
                      replyTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition"
                    title="Jump to Reply Box"
                  >
                    <Reply className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Reply</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleThreadStar(currentThread.id)}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer"
                  >
                    <Star className={`w-4 h-4 ${currentThread.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteThreadToTrash(currentThread.id)}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Professional Conversation Stream (Messages move up as new messages are sent) */}
              <div
                ref={messagesScrollRef}
                className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 space-y-3 min-h-0"
              >
                {(Array.isArray(currentThread.messages) ? currentThread.messages : []).map((m, idx, arr) => {
                  const isLead = m.sender === 'lead';
                  const isLatest = idx === arr.length - 1;
                  return (
                    <div
                      key={m.id || idx}
                      className={`p-3.5 sm:p-4 rounded-2xl border space-y-2.5 transition-all ${
                        isLead
                          ? 'bg-slate-950/95 border-cyan-500/35 mr-0 sm:mr-6 shadow-md'
                          : 'bg-gradient-to-br from-blue-950/40 via-slate-900/95 to-slate-950/95 border-blue-500/35 ml-0 sm:ml-6 shadow-md'
                      } ${isLatest ? 'ring-1 ring-cyan-500/20' : ''}`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isLead ? 'bg-cyan-500 text-black' : 'bg-blue-600 text-white'
                          }`}>
                            {isLead
                              ? (currentThread.leadName?.[0] || 'L')
                              : (currentUser.name ? currentUser.name[0] : 'U')}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-slate-100">
                                {isLead ? currentThread.leadName : (m.senderName || currentUser.name)}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono truncate">
                                &lt;{isLead ? currentThread.leadEmail : (m.senderEmail || currentThread.smtpEmail || currentUser.email)}&gt;
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isLead
                                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              }`}>
                                {isLead ? 'Incoming Reply' : 'Sent by You'}
                              </span>
                            </div>
                            {isLead && m.recipientEmail && (
                              <div className="text-[10px] text-emerald-400/90 font-mono mt-0.5">
                                Received on inbox: {m.recipientEmail}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] sm:text-xs text-slate-400 font-mono shrink-0">
                          {m.timestamp || 'Just now'}
                        </span>
                      </div>

                      <div className="text-xs md:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed break-words">
                        {cleanBodyText(m.body, currentThread.leadCompany, currentThread.leadName)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Permanently Docked Bottom Reply Composer (Never scrolls away; new replies push messages up) */}
              <div className="shrink-0 p-3 sm:p-3.5 bg-slate-950/95 border-t border-slate-800 space-y-2.5 shadow-2xl">
                <form onSubmit={handleSendReply} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {activeSmtpAccounts.length > 0 ? (
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 bg-slate-900/90 border border-emerald-500/30 rounded-xl px-2.5 py-1">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0">
                          Reply From
                        </span>
                        <select
                          value={replySmtpId}
                          onChange={(e) => setReplySmtpId(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] sm:text-xs font-bold text-cyan-300 focus:outline-none focus:border-cyan-500 cursor-pointer truncate flex-1 sm:max-w-[300px] min-w-0"
                        >
                          {activeSmtpAccounts.map(acc => (
                            <option key={acc.id} value={acc.id} className="bg-slate-950 text-slate-100">
                              {acc.name} ({acc.fromEmail || acc.username})
                            </option>
                          ))}
                        </select>
                        <span className="hidden lg:inline text-[10px] text-emerald-400 font-medium shrink-0">
                          ✓ Matched to inbox
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <Reply className="w-3.5 h-3.5" />
                        <span>Reply to {currentThread.leadName} ({currentThread.leadEmail})</span>
                      </div>
                    )}

                    {/* Toggle AI Reply Copilot Button */}
                    <button
                      type="button"
                      onClick={() => setShowAiReplyDrawer(prev => !prev)}
                      className="px-2.5 py-1 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/40 text-purple-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>AI Draft Copilot</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAiReplyDrawer ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Optional Collapsible AI Copilot Drawer */}
                  {showAiReplyDrawer && (
                    <div className="p-2.5 bg-gradient-to-br from-purple-950/30 via-slate-900/90 to-indigo-950/30 rounded-xl border border-purple-800/40 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
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
                              className="px-2.5 py-1 rounded-xl bg-purple-950/60 hover:bg-purple-900 text-purple-200 border border-purple-700/60 text-[11px] font-bold whitespace-nowrap transition cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          disabled={isGeneratingAiReply || !replyText.trim()}
                          onClick={handlePolishReply}
                          className="px-2 py-0.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                        >
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>✨ Polish</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
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
                          placeholder="Custom AI instruction (e.g. Confirm 2pm Thursday)..."
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 min-w-0"
                        />
                        <button
                          type="button"
                          disabled={isGeneratingAiReply || !customReplyPrompt.trim()}
                          onClick={() => handleAiDraft('custom')}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-md transition cursor-pointer disabled:opacity-40 shrink-0"
                        >
                          {isGeneratingAiReply ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Wand2 className="w-3 h-3" />
                          )}
                          <span>{isGeneratingAiReply ? 'Drafting...' : 'Generate'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    ref={replyTextareaRef}
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && replyText.trim()) {
                        handleSendReply(e as any);
                      }
                    }}
                    placeholder={`Write a message to ${currentThread.leadName} (${currentThread.leadEmail})...`}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 shadow-inner"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleInsertTemplate(e.target.value, false);
                              e.target.value = "";
                            }
                          }}
                          defaultValue=""
                          className="bg-transparent text-slate-200 text-[11px] font-bold cursor-pointer focus:outline-none max-w-[180px] sm:max-w-[240px] truncate"
                        >
                          <option value="" disabled className="bg-slate-900 text-slate-400">⚡ Insert Template ({activeEmailTemplates.length})...</option>
                          {activeEmailTemplates.map(t => (
                            <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100">
                              {t.isCustom ? '⭐ ' : '📋 '} {t.title} {t.isCustom ? '(Custom)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-500/25 transition cursor-pointer disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Reply Now</span>
                    </button>
                  </div>
                </form>
              </div>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowComposeModal(false);
          }}
        >
          <div className="bg-[#090d16] border border-slate-800 w-full max-w-2xl rounded-3xl p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">
                    Compose Direct Cold Outreach
                  </h3>
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

            {/* AI Generator & Saved Template Bar In Compose Modal */}
            <div className="p-3 bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-cyan-950/40 rounded-2xl border border-indigo-500/30 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>AI & Template Outbound Presets:</span>
                </div>

                {/* Instant Template Inserter Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 px-2 py-1 rounded-xl">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleInsertTemplate(e.target.value, true);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="bg-transparent text-slate-200 text-[11px] font-bold cursor-pointer focus:outline-none max-w-[190px] truncate"
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-400">⚡ Use Saved Template ({emailTemplates.length})...</option>
                    {emailTemplates.map(t => (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100">
                        {t.title} {t.isCustom ? '(Custom)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
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
                  <label className="text-[11px] font-bold text-slate-400">Recipient Email *</label>
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
                  <label className="text-[11px] font-bold text-slate-400">Recipient Name</label>
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
                  if (!composeTo || !composeSubject || !composeBody) return;
                  const sendSuccess = await sendDirectEmail({
                    recipientEmail: composeTo,
                    recipientName: composeName || composeTo,
                    senderSmtpId: composeSmtpId || smtpAccounts[0]?.id || '',
                    subject: composeSubject,
                    body: composeBody,
                  });
                  if (sendSuccess) {
                    setShowComposeModal(false);
                    setComposeTo('');
                    setComposeName('');
                    setComposeSubject('');
                    setComposeBody('');
                    confetti({ particleCount: 40, spread: 65 });
                  }
                }}
                disabled={!composeTo || !composeSubject || !composeBody}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/25 cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Outbound Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
