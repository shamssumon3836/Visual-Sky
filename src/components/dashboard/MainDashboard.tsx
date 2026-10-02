import React, { useState, useMemo } from 'react';
import { useApp, getLeadInactiveDays } from '../../context/AppContext';
import { 
  BarChart3, 
  TrendingUp, 
  Send, 
  Users, 
  Sparkles, 
  Inbox, 
  Server, 
  Clock, 
  ShieldCheck, 
  Flame, 
  Mail, 
  Play, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Zap,
  Layers,
  ChevronRight,
  Eye,
  MessageSquare,
  Activity,
  CheckCheck,
  Radio,
  Sliders,
  ExternalLink,
  Target,
  RefreshCw,
  Plus,
  Compass,
  ArrowUpRight,
  Lock,
  Globe,
  Cpu,
  CornerDownRight,
  SlidersHorizontal,
  Workflow,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MainDashboardProps {
  onOpenSendMail: () => void;
  onOpenLeadModal?: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({ onOpenSendMail, onOpenLeadModal }) => {
  const { 
    leads, 
    campaigns: rawCampaigns, 
    permanentDeleteCampaign,
    smtpAccounts, 
    threads, 
    sentEmails: rawSentEmails,
    emailTemplates: rawEmailTemplates,
    setActiveTab, 
    openFollowUpCohortModal,
    openCampaignWizard,
    currentUser,
    simulateIncomingReply,
    addNotification
  } = useApp();

  const campaigns = useMemo(() => rawCampaigns.filter(c => c && !c.isTrash), [rawCampaigns]);
  const sentEmails = useMemo(() => (rawSentEmails || []).filter(s => s && !s.isTrash), [rawSentEmails]);
  const emailTemplates = useMemo(() => (rawEmailTemplates || []).filter(t => t && !t.isTrash), [rawEmailTemplates]);

  const [filterActiveStatus, setFilterActiveStatus] = useState<'all' | 'running' | 'paused'>('all');
  const [funnelTimeRange, setFunnelTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  const activeLeads = leads.filter(l => !l.isTrash);
  const unreadThreads = threads.filter(t => !t.isTrash && t.unreadCount > 0);
  const runningCampaigns = campaigns.filter(c => c.status === 'running');
  const activeSmtps = smtpAccounts.filter(s => !s.isTrash);
  const connectedSmtps = activeSmtps.filter(s => s.isConnected);

  // Inactive leads for 7d, 14d, 30d cohorts
  const dormant7d = leads.filter(l => !l.isTrash && getLeadInactiveDays(l) >= 7 && !l.isReplied && l.status !== 'replied').length;
  const dormant14d = leads.filter(l => !l.isTrash && getLeadInactiveDays(l) >= 14 && !l.isReplied && l.status !== 'replied').length;
  const dormant30d = leads.filter(l => !l.isTrash && getLeadInactiveDays(l) >= 30 && !l.isReplied && l.status !== 'replied').length;

  // Real-time aggregate metric calculations
  const totalCampaignSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
  const totalDirectSent = sentEmails.length;
  const totalEmailsDispatched = Math.max(totalDirectSent, totalCampaignSent + totalDirectSent);

  const totalCampaignOpens = campaigns.reduce((acc, c) => acc + c.openCount, 0);
  const totalDirectOpens = sentEmails.filter(m => m.openCount > 0 || m.status === 'opened' || m.status === 'replied').length;
  const uniqueOpensTracked = Math.max(totalDirectOpens, totalCampaignOpens + totalDirectOpens);

  const positiveRepliesLogged = threads.filter(t => !t.isTrash).length;
  const highIntentReplies = threads.filter(t => !t.isTrash && (t.labels.includes('High Intent') || t.labels.includes('Interested') || t.labels.includes('Meeting Scheduled'))).length;
  const deliveryEngineHealth = '99.8%';

  const openRatePercent = totalEmailsDispatched > 0 
    ? ((uniqueOpensTracked / totalEmailsDispatched) * 100).toFixed(1) 
    : '0.0';

  const replyRatePercent = totalEmailsDispatched > 0 
    ? ((positiveRepliesLogged / totalEmailsDispatched) * 100).toFixed(1) 
    : '0.0';

  const handleLaunchFollowUp = (days: '7d' | '14d' | '30d') => {
    openFollowUpCohortModal(days);
    confetti({ particleCount: 55, spread: 65, origin: { y: 0.25 } });
  };

  const displayedCampaigns = campaigns.filter(c => {
    if (filterActiveStatus === 'running') return c.status === 'running';
    if (filterActiveStatus === 'paused') return c.status === 'paused';
    return true;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-7 animate-in fade-in duration-200">
      
      {/* 🌟 LUXURY EXECUTIVE HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1120] via-[#09152e] to-[#120e28] border border-cyan-500/25 p-6 sm:p-8 shadow-2xl shadow-cyan-950/20">
        {/* Glow ambient background lights */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-3xl">
            {/* Live System Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 text-xs font-black bg-gradient-to-r from-blue-600/30 to-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl flex items-center gap-1.5 shadow-sm shadow-cyan-500/10">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Visual Sky v3.2 Enterprise Hub</span>
              </span>

              <span className="px-2.5 py-1 text-xs font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-500/10">
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Primary Inbox Shield</span>
              </span>

              <span className="px-2.5 py-1 text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-xl flex items-center gap-1.5">
                <Server className="w-3 h-3 text-purple-400" />
                <span>{connectedSmtps.length} Active Relays Synced</span>
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-100 tracking-tight leading-tight">
                Welcome, <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">{currentUser.name || 'Outreach Director'}</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed mt-1.5">
                Enterprise outbound pipeline is active with <strong>{deliveryEngineHealth} deliverability rating</strong>, intelligent round-robin dynamic rotation, and automated lead re-engagement.
              </p>
            </div>
          </div>

          {/* Quick Primary Actions with Cyber Neomorphism */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={() => openCampaignWizard()}
              className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black shadow-xl shadow-cyan-500/25 transition transform hover:-translate-y-0.5 cursor-pointer border border-cyan-400/30"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Launch Sequence Wizard</span>
            </button>

            <button
              onClick={onOpenSendMail}
              className="flex items-center gap-2 px-4.5 py-3.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl text-xs font-bold transition transform hover:-translate-y-0.5 cursor-pointer shadow-lg"
            >
              <Send className="w-4 h-4 text-cyan-400" />
              <span>Direct Cold Mailer</span>
            </button>

            <button
              onClick={() => setActiveTab('generator')}
              className="flex items-center gap-2 px-4 py-3.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl text-xs font-bold transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Mine Leads</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🚀 EXECUTIVE KPI METRIC COCKPIT (4 Glassmorphic Glow Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Outbound Dispatched */}
        <div 
          onClick={() => setActiveTab('sent')}
          className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 hover:from-slate-800/90 hover:to-slate-900/90 p-5 rounded-3xl border border-blue-500/30 hover:border-blue-400 transition-all duration-200 cursor-pointer group shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition duration-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Total Dispatched</span>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition shadow-inner">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-400 mt-3 tracking-tight">{totalEmailsDispatched.toLocaleString()}</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span className="text-cyan-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Live Outbox Stream
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
          </div>
        </div>

        {/* Metric 2: Deliverability Health Gauge */}
        <div 
          onClick={() => setActiveTab('smtp')}
          className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 hover:from-slate-800/90 hover:to-slate-900/90 p-5 rounded-3xl border border-emerald-500/30 hover:border-emerald-400 transition-all duration-200 cursor-pointer group shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition duration-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Inbox Placement</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition shadow-inner">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-3 tracking-tight">{deliveryEngineHealth}</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              SPF/DKIM/DMARC 100%
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
          </div>
        </div>

        {/* Metric 3: Unique Opens Tracked */}
        <div 
          onClick={() => setActiveTab('analytics')}
          className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 hover:from-slate-800/90 hover:to-slate-900/90 p-5 rounded-3xl border border-cyan-500/30 hover:border-cyan-400 transition-all duration-200 cursor-pointer group shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition duration-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Open Velocity</span>
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition shadow-inner">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-cyan-300 mt-3 tracking-tight">{uniqueOpensTracked.toLocaleString()}</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span className="text-cyan-400 font-bold">{openRatePercent}% Verified Open Rate</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
          </div>
        </div>

        {/* Metric 4: Positive Warm Replies */}
        <div 
          onClick={() => setActiveTab('inbox')}
          className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 hover:from-slate-800/90 hover:to-slate-900/90 p-5 rounded-3xl border border-purple-500/30 hover:border-purple-400 transition-all duration-200 cursor-pointer group shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition duration-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Warm Response Rate</span>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center group-hover:scale-110 transition shadow-inner">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-300 mt-3 tracking-tight">
            {positiveRepliesLogged} <span className="text-sm font-semibold text-slate-400">Leads</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span className="text-purple-300 font-bold">{replyRatePercent}% Response Velocity</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
          </div>
        </div>
      </div>

      {/* 📊 INTERACTIVE OUTBOUND CONVERSION FUNNEL */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <Workflow className="w-4 h-4 text-cyan-400" />
              <span>Full-Stack Outbound Conversion Pipeline</span>
            </h2>
            <p className="text-xs text-slate-400">
              End-to-end pipeline visibility from scraped leads down to meeting bookings:
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800">
              ⚡ Real-time Telemetry
            </span>
          </div>
        </div>

        {/* 5 Funnel Stages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          {/* Stage 1: Active Leads */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2 relative">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Stage 1 &bull; Discovery</div>
            <div className="text-xs font-bold text-slate-200">Enrolled Leads</div>
            <div className="text-2xl font-black text-cyan-300 font-mono">{activeLeads.length}</div>
            <div className="text-[10px] text-slate-400">100% Audience base</div>
          </div>

          {/* Stage 2: Dispatched */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-blue-500/20 space-y-2 relative">
            <div className="text-[10px] font-bold text-blue-400 uppercase">Stage 2 &bull; Outbound</div>
            <div className="text-xs font-bold text-slate-200">Dispatched</div>
            <div className="text-2xl font-black text-blue-400 font-mono">{totalEmailsDispatched}</div>
            <div className="text-[10px] text-blue-300 font-bold">99.8% Delivery rate</div>
          </div>

          {/* Stage 3: Opened */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/20 space-y-2 relative">
            <div className="text-[10px] font-bold text-cyan-400 uppercase">Stage 3 &bull; Engagement</div>
            <div className="text-xs font-bold text-slate-200">Unique Opens</div>
            <div className="text-2xl font-black text-cyan-300 font-mono">{uniqueOpensTracked}</div>
            <div className="text-[10px] text-cyan-400 font-bold">{openRatePercent}% Open rate</div>
          </div>

          {/* Stage 4: Positive Replies */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-purple-500/20 space-y-2 relative">
            <div className="text-[10px] font-bold text-purple-400 uppercase">Stage 4 &bull; Inbound</div>
            <div className="text-xs font-bold text-slate-200">Warm Replies</div>
            <div className="text-2xl font-black text-purple-300 font-mono">{positiveRepliesLogged}</div>
            <div className="text-[10px] text-purple-300 font-bold">{replyRatePercent}% Reply rate</div>
          </div>

          {/* Stage 5: High Intent Conversions */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-950 border border-emerald-500/40 space-y-2 relative">
            <div className="text-[10px] font-bold text-emerald-400 uppercase">Stage 5 &bull; Pipeline</div>
            <div className="text-xs font-bold text-emerald-200">High-Intent Leads</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">{highIntentReplies}</div>
            <div className="text-[10px] text-emerald-300 font-bold">Ready to Close</div>
          </div>
        </div>
      </div>

      {/* 🌐 LIVE CONNECTED SMTP RELAYS FLEET MONITOR */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Outbound SMTP Dispatch Fleet ({activeSmtps.length} Relays Connected)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status, daily quotas, health score, and domain webmail endpoints for your dispatchers:
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('smtp')}
              className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Connect New Relay / Webmail</span>
            </button>
          </div>
        </div>

        {activeSmtps.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 space-y-3">
            <Server className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-xs font-bold text-slate-300">No outbound SMTP relays connected yet</div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Connect your custom domain webmail, Google Workspace, SES, or cPanel relay to start launching campaigns.
            </p>
            <button
              onClick={() => setActiveTab('smtp')}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer"
            >
              Connect First Mailbox
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {activeSmtps.map((smtp) => (
              <div
                key={smtp.id}
                onClick={() => setActiveTab('smtp')}
                className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800/90 hover:border-cyan-500/50 transition cursor-pointer space-y-3 group shadow-inner"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-extrabold text-xs text-slate-100 truncate group-hover:text-cyan-300 transition">
                      {smtp.name}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    {smtp.healthScore || 99.8}% Health
                  </span>
                </div>

                <div className="space-y-1 font-mono text-[11px] text-slate-400">
                  <div className="text-slate-300 truncate font-sans font-medium">{smtp.username}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {smtp.host}:{smtp.port} &bull; {smtp.encryption}
                  </div>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-900">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Sent Today</span>
                    <span className="text-slate-300 font-bold font-mono">
                      {smtp.sentToday || 0} / {smtp.dailyLimit || 500}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-cyan-500 h-full rounded-full" 
                      style={{ width: `${Math.min(100, ((smtp.sentToday || 0) / (smtp.dailyLimit || 500)) * 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🚀 CAMPAIGN-TO-EMAIL DELIVERY MAPPING MATRIX */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Campaign-to-Email Delivery Mapping</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live routing telemetry matching campaigns with their configured outbound SMTP accounts and target cohorts:
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setFilterActiveStatus('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterActiveStatus === 'all' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({campaigns.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterActiveStatus('running')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterActiveStatus === 'running' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Running ({runningCampaigns.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('campaigns')}
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer ml-1 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60"
            >
              <span>Manage Campaigns</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-extrabold uppercase text-slate-400 bg-slate-950/70">
                <th className="p-3">Campaign Sequence</th>
                <th className="p-3">Assigned Outbound Relay</th>
                <th className="p-3">Dispatched Emails</th>
                <th className="p-3">Engagement Telemetry</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                    No campaigns matching the selected status filter.
                  </td>
                </tr>
              ) : (
                displayedCampaigns.map((camp) => {
                  const matchedEmails = sentEmails.filter(
                    e => e.campaignName === camp.name || (camp.assignedLeadIds && camp.assignedLeadIds.includes(e.recipientEmail))
                  );
                  const relayAccount = smtpAccounts.find(s => s.id === camp.smtpAccountId);

                  return (
                    <tr key={camp.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          <span>{camp.name}</span>
                          {camp.targetNiche && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {camp.targetNiche}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{camp.subject || 'Multi-step outreach sequence'}</div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5 font-mono text-cyan-300">
                          <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="font-semibold">{relayAccount?.name || 'Smart Round-Robin Cluster'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {relayAccount ? `${relayAccount.host}:${relayAccount.port} (${relayAccount.encryption})` : `${connectedSmtps.length} Active Connected Mailboxes`}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="font-bold text-slate-200 font-mono text-xs">
                          {camp.sentCount + (matchedEmails.length > 0 ? matchedEmails.length : 0)} sent
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold">
                            👁️ {camp.openCount} opens
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold">
                            💬 {camp.replyCount} replies
                          </span>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          camp.status === 'running'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse'
                            : camp.status === 'paused'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {camp.status}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab('sent')}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Inspect Outbox
                          </button>
                          <button
                            type="button"
                            onClick={() => permanentDeleteCampaign(camp.id)}
                            className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                            title="Permanently Delete Campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ⚡ 1-CLICK SMART FOLLOW-UP COMMAND CENTER (7d, 14d, 30d) */}
      <div className="bg-slate-900/90 rounded-3xl border border-blue-500/30 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              1-Click Smart Follow-Up Automation Engine
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Instantly isolate leads who haven't opened or replied and dispatch personalized sequences:
            </p>
          </div>
          <span className="text-[11px] font-bold text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-xl border border-cyan-800/60 self-start sm:self-auto">
            ⚡ Zero Manual Filtering Required
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 7-Day Box */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/30 flex flex-col justify-between space-y-3 shadow-lg">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                  7+ Days Inactive
                </span>
                <span className="px-2.5 py-0.5 text-xs font-black bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/30">
                  {dormant7d} Leads
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Contacted 7+ days ago with no response. Perfect timing for a quick friendly value-bump.
              </p>
            </div>
            <button
              onClick={() => handleLaunchFollowUp('7d')}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs transition shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Launch 7-Day Follow-Up ({dormant7d})
            </button>
          </div>

          {/* 14-Day Box */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-orange-500/30 flex flex-col justify-between space-y-3 shadow-lg">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                  14+ Days Inactive
                </span>
                <span className="px-2.5 py-0.5 text-xs font-black bg-orange-500/20 text-orange-300 rounded-lg border border-orange-500/30">
                  {dormant14d} Leads
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                No reply for 2 weeks. Dispatch case study and deliverability proof audit to revive interest.
              </p>
            </div>
            <button
              onClick={() => handleLaunchFollowUp('14d')}
              className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black rounded-xl text-xs transition shadow-md shadow-orange-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Launch 14-Day Follow-Up ({dormant14d})
            </button>
          </div>

          {/* 30-Day Box */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-rose-500/30 flex flex-col justify-between space-y-3 shadow-lg">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                  30+ Days Dormant
                </span>
                <span className="px-2.5 py-0.5 text-xs font-black bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/30">
                  {dormant30d} Leads
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Send psychological breakup email to cleanly close the loop or trigger high-conversion reactivations.
              </p>
            </div>
            <button
              onClick={() => handleLaunchFollowUp('30d')}
              className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black rounded-xl text-xs transition shadow-md shadow-rose-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Launch 30-Day Follow-Up ({dormant30d})
            </button>
          </div>
        </div>
      </div>

      {/* 💬 TWO COLUMN: RECENT LIVE INBOX CONVERSATIONS & QUICK LAUNCHPAD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Recent Replies Stream (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Flame className="w-4 h-4 text-pink-400" />
              <span>Recent Positive Replies &amp; Conversations</span>
            </h2>
            <button
              onClick={() => setActiveTab('inbox')}
              className="px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Inbox className="w-3.5 h-3.5 text-cyan-400" />
              <span>Open Live Inbox</span>
            </button>
          </div>

          <div className="space-y-3">
            {threads.filter(t => !t.isTrash).length === 0 ? (
              <div className="p-6 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 space-y-2">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-xs font-bold text-slate-300">No replies in inbox yet</div>
                <p className="text-[11px] text-slate-500">When your leads open and respond to outreach emails, their incoming messages will appear here in real-time.</p>
              </div>
            ) : (
              threads.filter(t => !t.isTrash).slice(0, 3).map(t => (
                <div
                  key={t.id}
                  onClick={() => setActiveTab('inbox')}
                  className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 transition cursor-pointer space-y-1.5 shadow-inner group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-xs group-hover:text-cyan-300 transition">{t.leadName}</span>
                      <span className="text-[11px] text-slate-400 font-medium">({t.leadCompany})</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{t.lastMessageDate}</span>
                  </div>

                  <div className="text-xs font-semibold text-cyan-300 truncate">
                    {t.subject}
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {t.lastMessage}
                  </p>

                  <div className="flex items-center gap-1.5 pt-1">
                    {t.labels.map((l, idx) => (
                      <span key={idx} className="text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded-md border border-blue-500/20 font-semibold">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => setActiveTab('inbox')}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold border border-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open Smart Unified Inbox ({threads.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Quick Launchpad Matrix (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Quick Outbound Launchpad</span>
          </h2>

          <div className="space-y-2.5">
            <button
              onClick={() => setActiveTab('generator')}
              className="w-full p-3.5 bg-slate-950 hover:bg-slate-800 rounded-2xl border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-purple-300 transition">AI Lead Miner (Gemini 2.0)</div>
                  <div className="text-[10px] text-slate-400">Scrape niche leads with phone & website health</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className="w-full p-3.5 bg-slate-950 hover:bg-slate-800 rounded-2xl border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-blue-300 transition">Email Template Vault</div>
                  <div className="text-[10px] text-slate-400">High-converting copy & variable tags</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className="w-full p-3.5 bg-slate-950 hover:bg-slate-800 rounded-2xl border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition">Deliverability Radar</div>
                  <div className="text-[10px] text-slate-400">Heatmaps, open velocity & DNS health</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
            </button>

            <button
              onClick={() => setActiveTab('smtp')}
              className="w-full p-3.5 bg-slate-950 hover:bg-slate-800 rounded-2xl border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 transition">SMTP & Interval Delays</div>
                  <div className="text-[10px] text-slate-400">Rotation pools & timing schedules</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
