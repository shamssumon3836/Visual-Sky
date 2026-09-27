import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { VisualSkyLogo } from '../brand/VisualSkyLogo';
import { ProfileModal } from '../profile/ProfileModal';
import { 
  Bell, 
  Search, 
  Sparkles, 
  Mail, 
  Send, 
  ShieldCheck, 
  User as UserIcon, 
  Volume2, 
  VolumeX, 
  Clock, 
  Flame, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Trash2,
  Play,
  Plus,
  LogOut,
  Settings,
  Server,
  FileText,
  Users,
  Menu,
  X,
  Cloud,
  CloudOff,
  RefreshCw,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface NavbarProps {
  onOpenAuth: () => void;
  onOpenSendMail?: () => void;
  onOpenMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, onOpenSendMail, onOpenMobileMenu }) => {
  const { 
    activeTab, 
    setActiveTab, 
    notifications, 
    addNotification,
    unreadNotificationCount, 
    markNotificationRead, 
    deleteNotification,
    markAllNotificationsRead, 
    clearAllNotifications, 
    soundEnabled, 
    setSoundEnabled, 
    currentUser, 
    logout,
    requestLogout,
    searchQuery, 
    setSearchQuery, 
    openFollowUpCohortModal,
    simulateIncomingReply, 
    leads,
    campaigns,
    smtpAccounts,
    emailTemplates,
    sentEmails,
    threads,
    isWorkspaceLoading,
    syncStatus,
    loadUserWorkspace,
    saveWorkspaceToDatabase
  } = useApp();

  const [showNotifs, setShowNotifs] = useState<boolean>(false);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showFollowUpMenu, setShowFollowUpMenu] = useState<boolean>(false);
  const [showSearchPopover, setShowSearchPopover] = useState<boolean>(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'reply' | 'open' | 'lead' | 'system'>('all');

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const followUpRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close popups when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (followUpRef.current && !followUpRef.current.contains(event.target as Node)) {
        setShowFollowUpMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickFollowupClick = (days: '7d' | '14d' | '30d') => {
    setShowFollowUpMenu(false);
    openFollowUpCohortModal(days);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.1 }
    });
  };

  const handleSimulateClick = () => {
    simulateIncomingReply();
  };

  const filteredNotifs = notifications.filter(n => {
    if (notifFilter === 'all') return true;
    return n.type === notifFilter;
  });

  // Universal Search Results across Leads, Campaigns, SMTP, Templates, Sent Emails, and Threads
  const q = searchQuery.trim().toLowerCase();
  const matchingLeads = q ? (leads || []).filter(l => !l.isTrash && (
    (l.name || '').toLowerCase().includes(q) ||
    (l.email || '').toLowerCase().includes(q) ||
    (l.company || '').toLowerCase().includes(q) ||
    ((l.title || '').toLowerCase().includes(q)) ||
    ((l.niche || '').toLowerCase().includes(q)) ||
    ((l.location || '').toLowerCase().includes(q)) ||
    ((l.phone || '').toLowerCase().includes(q)) ||
    (l.tags && l.tags.some(t => (t || '').toLowerCase().includes(q)))
  )).slice(0, 5) : [];

  const matchingCampaigns = q ? (campaigns || []).filter(c => (
    (c.name || '').toLowerCase().includes(q) ||
    (c.niche && c.niche.toLowerCase().includes(q)) ||
    (c.steps && c.steps.some(s => (s.subject || '').toLowerCase().includes(q) || (s.body || '').toLowerCase().includes(q)))
  )).slice(0, 4) : [];

  const matchingSmtp = q ? (smtpAccounts || []).filter(s => !s.isTrash && (
    (s.name || '').toLowerCase().includes(q) ||
    (s.username || '').toLowerCase().includes(q) ||
    (s.host || '').toLowerCase().includes(q) ||
    ((s.fromEmail || '').toLowerCase().includes(q)) ||
    ((s.fromName || '').toLowerCase().includes(q))
  )).slice(0, 4) : [];

  const matchingTemplates = q ? (emailTemplates || []).filter(t => (
    (t.title || '').toLowerCase().includes(q) ||
    (t.subject || '').toLowerCase().includes(q) ||
    (t.body || '').toLowerCase().includes(q) ||
    (t.category || '').toLowerCase().includes(q) ||
    (t.tags && t.tags.some(tg => tg.toLowerCase().includes(q)))
  )).slice(0, 4) : [];

  const matchingSent = q ? (sentEmails || []).filter(s => (
    (s.recipientName || '').toLowerCase().includes(q) ||
    (s.recipientEmail || '').toLowerCase().includes(q) ||
    (s.recipientCompany || '').toLowerCase().includes(q) ||
    (s.subject || '').toLowerCase().includes(q) ||
    (s.smtpAccountName || '').toLowerCase().includes(q) ||
    (s.campaignName || '').toLowerCase().includes(q)
  )).slice(0, 4) : [];

  const matchingThreads = q ? (threads || []).filter(t => !t.isTrash && (
    (t.leadName || '').toLowerCase().includes(q) ||
    (t.leadCompany || '').toLowerCase().includes(q) ||
    (t.leadEmail || '').toLowerCase().includes(q) ||
    (t.subject || '').toLowerCase().includes(q) ||
    (t.lastMessage || '').toLowerCase().includes(q)
  )).slice(0, 4) : [];

  const totalResultsCount = 
    matchingLeads.length + 
    matchingCampaigns.length + 
    matchingSmtp.length + 
    matchingTemplates.length + 
    matchingSent.length + 
    matchingThreads.length;

  return (
    <header className="sticky top-0 z-40 h-16 bg-[#090d16]/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 flex items-center justify-between gap-3 select-none">
      {/* Brand / Logo + Mobile Menu Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center justify-center cursor-pointer transition"
          aria-label="Open navigation menu"
          title="Open all modules menu"
        >
          <Menu className="w-4 h-4 text-cyan-400" />
        </button>

        <div 
          onClick={() => setActiveTab('dashboard')} 
          className="cursor-pointer hover:opacity-90 transition shrink-0"
        >
          <VisualSkyLogo size="sm" className="sm:hidden" />
          <VisualSkyLogo size="md" className="hidden sm:flex" />
        </div>
      </div>

      {/* Center Search Input with Instant Popover Results */}
      <div className="flex-1 max-w-sm lg:max-w-md hidden md:block relative" ref={searchRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setShowSearchPopover(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchPopover(true);
            }}
            placeholder="Search verified leads, campaigns, relays, tags..."
            className="w-full bg-slate-900/90 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition"
          />
          {searchQuery && (
            <button 
              onClick={() => {
                setSearchQuery('');
                setShowSearchPopover(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              &times;
            </button>
          )}
        </div>

        {/* Instant Search Dropdown Popover */}
        {showSearchPopover && q && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#0c121e] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 max-h-96 overflow-y-auto divide-y divide-slate-800/60 text-xs">
            <div className="p-2.5 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Search Results for &quot;<strong className="text-cyan-300">{searchQuery}</strong>&quot;</span>
              <span>{totalResultsCount} matches found</span>
            </div>

            {/* Matching Leads */}
            {matchingLeads.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
                  <Users className="w-3 h-3 text-cyan-400" />
                  Verified Leads ({matchingLeads.length})
                </div>
                {matchingLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setActiveTab('leads');
                      setShowSearchPopover(false);
                    }}
                    className="p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-200 group-hover:text-cyan-300">{lead.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{lead.email} &bull; {lead.company}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                      View Lead
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Matching Campaigns */}
            {matchingCampaigns.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
                  <Send className="w-3 h-3 text-emerald-400" />
                  Campaigns ({matchingCampaigns.length})
                </div>
                {matchingCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    onClick={() => {
                      setActiveTab('campaigns');
                      setShowSearchPopover(false);
                    }}
                    className="p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-200 group-hover:text-emerald-300">{camp.name}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{camp.status} &bull; {camp.sentCount} sent</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      Open Campaign
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Matching SMTP Accounts */}
            {matchingSmtp.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
                  <Server className="w-3 h-3 text-blue-400" />
                  SMTP Relays ({matchingSmtp.length})
                </div>
                {matchingSmtp.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveTab('smtp');
                      setShowSearchPopover(false);
                    }}
                    className="p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-200 group-hover:text-blue-300">{s.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{s.username} ({s.host}:{s.port})</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                      Manage Relay
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Matching Templates */}
            {matchingTemplates.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-purple-400" />
                  Email Templates ({matchingTemplates.length})
                </div>
                {matchingTemplates.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setActiveTab('templates');
                      setShowSearchPopover(false);
                    }}
                    className="p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-200 group-hover:text-purple-300">{t.title || (t as any).name || 'Email Template'}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{t.subject || ''}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                      Use Template
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Matching Sent Outbox Mails */}
            {matchingSent.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-sky-400" />
                  Sent Outbox Mails ({matchingSent.length})
                </div>
                {matchingSent.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveTab('sent');
                      setShowSearchPopover(false);
                    }}
                    className="p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-200 group-hover:text-sky-300">{s.recipientName} ({s.recipientCompany})</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{s.subject} &bull; <span className="text-cyan-400 capitalize">{s.status}</span></div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                      View Outbox
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Matching Inbox Threads */}
            {matchingThreads.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-emerald-400" />
                  Inbox Conversations ({matchingThreads.length})
                </div>
                {matchingThreads.map((th) => (
                  <div
                    key={th.id}
                    onClick={() => {
                      setActiveTab('inbox');
                      setShowSearchPopover(false);
                    }}
                    className="p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-200 group-hover:text-emerald-300">{th.leadName} &bull; {th.leadCompany}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{th.lastMessage}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      Open Chat
                    </span>
                  </div>
                ))}
              </div>
            )}

            {totalResultsCount === 0 && (
              <div className="p-6 text-center text-slate-500">
                No matching leads, campaigns, relays, or templates found for &quot;{searchQuery}&quot;.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Actions (Single Line Bar, Send Mail button prominently visible) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Direct Agency Master Quick Access Button if Agency User */}
        {(currentUser.role === 'agency' || currentUser.role === 'owner' || currentUser.isOwner || currentUser.email === 'sojibdaridro123@gmail.com' || currentUser.email === 'rafiqulvisualsky@gmail.com') && (
          <button
            onClick={() => setActiveTab('owner')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer border ${
              activeTab === 'owner'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-500/10'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50'
            }`}
            title="Agency Master Administrative Dashboard"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap font-extrabold">Agency Master</span>
          </button>
        )}

        {/* Direct Client Portal Quick Access Button if Client User */}
        {currentUser.role === 'client' && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer border ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-500/50'
            }`}
            title="Client Workspace Dashboard & Outreach Campaigns"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="whitespace-nowrap font-extrabold">Client Workspace</span>
          </button>
        )}

        {/* Send Mail Action Button (User request from original app) */}
        {onOpenSendMail && (
          <button
            onClick={onOpenSendMail}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:via-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 transition shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Send Mail</span>
          </button>
        )}

        {/* Sent Mails & Outbox Tracker Button */}
        <button
          onClick={() => setActiveTab('sent')}
          className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shrink-0 cursor-pointer ${
            activeTab === 'sent' || activeTab === 'outbox'
              ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 shadow-xs'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
          }`}
          title="Open Outbox Live Stream & Tracking Pixels"
        >
          <Send className="w-3.5 h-3.5 text-sky-400" />
          <span className="whitespace-nowrap">Sent Mails</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>

        {/* Quick Follow-up Dropdown (7d, 14d, 30d 1-click triggers) */}
        <div className="relative" ref={followUpRef}>
          <button
            onClick={() => setShowFollowUpMenu(!showFollowUpMenu)}
            className="hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-xs font-semibold shadow-sm transition"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="whitespace-nowrap">1-Click Follow-Up</span>
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
          </button>

          {showFollowUpMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 border-b border-slate-800">
                <div className="text-xs font-bold text-slate-200">Smart Follow-up Automation</div>
                <div className="text-[11px] text-slate-400">Target dormant leads with 1 click:</div>
              </div>
              <div className="py-1 space-y-1">
                <button
                  onClick={() => handleQuickFollowupClick('7d')}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center justify-between text-xs text-slate-200 transition group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <div>
                      <div className="font-medium group-hover:text-amber-300">7+ Days Inactive Leads</div>
                      <div className="text-[10px] text-slate-400">Opened or contacted &gt; 7 days ago</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20">
                    Launch
                  </span>
                </button>

                <button
                  onClick={() => handleQuickFollowupClick('14d')}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center justify-between text-xs text-slate-200 transition group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <div>
                      <div className="font-medium group-hover:text-orange-300">14+ Days Inactive Leads</div>
                      <div className="text-[10px] text-slate-400">No reply for 2 weeks</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-300 rounded border border-orange-500/20">
                    Launch
                  </span>
                </button>

                <button
                  onClick={() => handleQuickFollowupClick('30d')}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center justify-between text-xs text-slate-200 transition group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <div>
                      <div className="font-medium group-hover:text-rose-300">30+ Days Dormant Leads</div>
                      <div className="text-[10px] text-slate-400">Reactivation sequences</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-rose-500/10 text-rose-300 rounded border border-rose-500/20">
                    Launch
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Real-time Cloud Sync Status */}
        <button
          onClick={async () => {
            if (currentUser?.email) {
              const ok = await saveWorkspaceToDatabase();
              if (ok) {
                addNotification({
                  title: 'Cloud Synced! ☁️',
                  message: 'Workspace saved and confirmed synchronized with central cloud database.',
                  type: 'system'
                });
              } else {
                addNotification({
                  title: 'Syncing Status',
                  message: 'Workspace data cached locally. Automatic background sync active.',
                  type: 'system'
                });
              }
            }
          }}
          title={
            syncStatus === 'syncing' || isWorkspaceLoading
              ? 'Synchronizing workspace with cloud...'
              : syncStatus === 'synced'
              ? 'Workspace Cloud Synced (Click to instantly save to database)'
              : 'Local Mode (Click to retry cloud connection)'
          }
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
        >
          {isWorkspaceLoading || syncStatus === 'syncing' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span className="text-[11px] text-cyan-300 font-medium hidden lg:inline">Syncing...</span>
            </>
          ) : syncStatus === 'synced' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-slate-300 font-medium hidden lg:inline">Cloud Synced</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] text-amber-300 font-medium hidden lg:inline">Offline Sync</span>
            </>
          )}
        </button>

        {/* Notification Center */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-rose-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center px-1 shadow-lg shadow-rose-600/40 animate-pulse">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {/* Facebook-Style Dropdown Menu */}
          {showNotifs && (
            <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96 bg-[#0c121e]/98 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100 text-sm">Notifications</span>
                  {unreadNotificationCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-500/20 text-rose-300 rounded-full">
                      {unreadNotificationCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    title={soundEnabled ? 'Disable notification sound' : 'Enable notification sound'}
                    className="p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                  </button>
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-cyan-400 hover:text-cyan-300 font-medium transition cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center px-3 pt-2 gap-1 border-b border-slate-800/60 overflow-x-auto">
                {(['all', 'reply', 'open', 'lead', 'system'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setNotifFilter(tab)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition cursor-pointer ${
                      notifFilter === tab
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab === 'all' ? 'All' : tab === 'reply' ? '🔥 Replies' : tab === 'open' ? '👀 Opens' : tab === 'lead' ? '👥 Leads' : '⚙️ System'}
                  </button>
                ))}
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
                {filteredNotifs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No notifications in this category.
                  </div>
                ) : (
                  filteredNotifs.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.linkTab) setActiveTab(n.linkTab);
                        setShowNotifs(false);
                      }}
                      className={`p-3 hover:bg-slate-800/60 transition cursor-pointer flex items-start gap-3 group relative ${
                        !n.isRead ? 'bg-slate-800/30' : ''
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {n.type === 'reply' ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <Flame className="w-4 h-4" />
                          </div>
                        ) : n.type === 'open' ? (
                          <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                            <Mail className="w-4 h-4" />
                          </div>
                        ) : n.type === 'smtp' ? (
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-semibold truncate ${!n.isRead ? 'text-slate-100' : 'text-slate-300'}`}>
                            {n?.title || 'System Notification'}
                          </span>
                          <span className="text-[10px] text-slate-500 shrink-0">{n.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {typeof n.message === 'object'
                            ? ((n.message as any)?.message || (n.message as any)?.text || JSON.stringify(n.message))
                            : String(n.message || '')}
                        </p>
                      </div>

                      {/* Delete Notification Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        className="absolute right-2 top-2.5 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 self-center absolute right-3 bottom-3"></div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs px-3">
                <span className="text-[11px] text-slate-500">Auto real-time sync active</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-[11px] text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    Mark All Read
                  </button>
                  <span className="text-slate-700">&bull;</span>
                  <button
                    onClick={clearAllNotifications}
                    className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer font-semibold"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile / Portal Switch Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-lg object-cover ring-1 ring-cyan-500/50"
            />
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-200 leading-tight truncate max-w-[110px]">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-cyan-400 capitalize font-medium">
                {currentUser.role === 'agency' || currentUser.role === 'owner' || currentUser.isOwner ? '👑 Agency Master' : '💼 Client'} &bull; {currentUser.plan}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Profile Menu Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-from-top-2">
              <div className="px-3 py-2 border-b border-slate-800">
                <div className="font-bold text-xs text-slate-100">{currentUser.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Current Role:</span>
                  <span className={`px-2 py-0.5 font-bold rounded ${
                    currentUser.role === 'agency' || currentUser.role === 'owner' || currentUser.isOwner
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                      : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {currentUser.role}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowProfileModal(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 font-semibold cursor-pointer transition"
                >
                  <Settings className="w-3.5 h-3.5 text-cyan-400" />
                  My Profile & Settings
                </button>

                {(currentUser.role === 'agency' || currentUser.role === 'owner' || currentUser.isOwner || currentUser.email === 'sojibdaridro123@gmail.com' || currentUser.email === 'rafiqulvisualsky@gmail.com') && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setActiveTab('owner');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 flex items-center gap-2 font-bold cursor-pointer transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    👑 Agency Master Dashboard
                  </button>
                )}

                {currentUser.role === 'client' && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setActiveTab('dashboard');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 flex items-center gap-2 font-bold cursor-pointer transition"
                  >
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    💼 Client Workspace Dashboard
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenAuth();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-cyan-400 hover:bg-cyan-950/50 flex items-center gap-2 font-medium cursor-pointer transition"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  Switch Portal / Sign In
                </button>

                <div className="my-1 border-t border-slate-800" />

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    requestLogout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 font-bold cursor-pointer transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out / Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onOpenAuth={onOpenAuth}
      />
    </header>
  );
};
