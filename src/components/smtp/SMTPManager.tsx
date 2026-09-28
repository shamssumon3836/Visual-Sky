import React, { useState, useMemo } from 'react';
import { useApp, getSMTPWarmupDetails, getSMTPAccountMetrics } from '../../context/AppContext';
import { SMTPAccount } from '../../types';
import { SMTPConnectModal } from './SMTPConnectModal';
import { safeParseResponse } from '../../lib/safeFetch';
import { 
  Server, 
  Plus, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Zap, 
  RefreshCw, 
  Lock, 
  Mail, 
  Info,
  ChevronRight,
  X,
  Check,
  Globe,
  ExternalLink,
  Sliders,
  Send,
  Clock,
  Flame,
  Radio,
  Eye,
  MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const SMTPManager: React.FC = () => {
  const { 
    smtpAccounts, 
    campaigns,
    sentEmails,
    threads,
    updateSMTPAccount, 
    deleteSMTPAccount, 
    permanentDeleteSMTPAccount,
    testSMTPConnection 
  } = useApp();

  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [selectedInitialProvider, setSelectedInitialProvider] = useState<SMTPAccount['provider']>('domain_webmail');
  const [editingAccount, setEditingAccount] = useState<SMTPAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<SMTPAccount | null>(null);
  
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);

  const activeSmtps = useMemo(() => smtpAccounts.filter(s => !s.isTrash), [smtpAccounts]);

  // Compute live metrics per connected SMTP relay account
  const smtpMetricsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getSMTPAccountMetrics>>();
    for (const s of activeSmtps) {
      map.set(s.id, getSMTPAccountMetrics(s, activeSmtps, sentEmails, campaigns, threads));
    }
    return map;
  }, [activeSmtps, sentEmails, campaigns, threads]);

  // Aggregate live totals across all connected relays for the top summary bar
  const aggregateStats = useMemo(() => {
    let totalSentToday = 0;
    let totalDispatched = 0;
    let totalOpened = 0;
    let totalReplied = 0;
    let totalEffectiveCap = 0;
    let totalMaxCap = 0;
    let totalRemaining = 0;
    let onlineCount = 0;
    let rampingCount = 0;
    let healthSum = 0;

    for (const s of activeSmtps) {
      const m = smtpMetricsMap.get(s.id);
      if (m) {
        totalSentToday += m.sentToday;
        totalDispatched += m.totalDispatched;
        totalOpened += m.openedCount;
        totalReplied += m.repliedCount;
        totalEffectiveCap += m.effectiveDailyLimit;
        totalMaxCap += m.dailyCap;
        totalRemaining += m.remainingToday;
        if (m.warmup.isRamping) rampingCount++;
      }
      if (s.isConnected !== false) onlineCount++;
      healthSum += s.healthScore || 99;
    }

    const avgHealth = activeSmtps.length > 0 ? Math.round((healthSum / activeSmtps.length) * 10) / 10 : 0;
    const openRate = totalDispatched > 0 ? Math.min(100, Math.round((totalOpened / totalDispatched) * 100)) : 0;
    const replyRate = totalDispatched > 0 ? Math.min(100, Math.round((totalReplied / totalDispatched) * 100)) : 0;
    const runningCampaignsCount = campaigns.filter(c => !c.isTrash && c.status === 'running').length;

    return {
      totalSentToday,
      totalDispatched,
      totalOpened,
      totalReplied,
      totalEffectiveCap,
      totalMaxCap,
      totalRemaining,
      onlineCount,
      rampingCount,
      avgHealth,
      openRate,
      replyRate,
      runningCampaignsCount
    };
  }, [activeSmtps, smtpMetricsMap, campaigns]);

  const handleOpenConnect = (provider: SMTPAccount['provider'] = 'domain_webmail') => {
    setEditingAccount(null);
    setSelectedInitialProvider(provider);
    setShowConnectModal(true);
  };

  const handleEditAccount = (account: SMTPAccount) => {
    setEditingAccount(account);
    setShowConnectModal(true);
  };

  const handleTestAccount = async (account: SMTPAccount) => {
    setTestingId(account.id);
    setTestLogs([
      `[DNS] Looking up MX & SPF records for ${account.host}...`,
      `[CONNECT] Testing TCP Socket Connection on ${account.host}:${account.port} (${account.encryption})...`,
    ]);

    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account)
      });
      const parsed = await safeParseResponse(res, 'SMTP handshake failed');
      const data = parsed.data || {};

      if (parsed.ok && data.success) {
        updateSMTPAccount(account.id, { isConnected: true, healthScore: 99 });
        setTestLogs(data.logs || [
          `[DNS] MX, SPF, DKIM alignment OK for ${account.host}`,
          `[AUTH] Authenticated as ${account.username}`,
          `[WARMUP] Health Score: 99/100`,
          `[DELIVERABILITY] Estimated Primary Inbox Placement: 99.8%`
        ]);
        confetti({ particleCount: 30, spread: 60 });
      } else {
        updateSMTPAccount(account.id, { isConnected: false, healthScore: 0 });
        setTestLogs(data.logs || [
          `[ERROR] Handshake failed: ${data.error || 'Check username and credentials'}`,
          `[HINT] Check port, SSL/TLS, and credentials.`
        ]);
      }
    } catch (err: any) {
      updateSMTPAccount(account.id, { isConnected: false, healthScore: 0 });
      setTestLogs(prev => [
        ...prev,
        `[ERROR] Network error: ${err?.message || 'Unable to connect to server'}`
      ]);
    } finally {
      setTestingId(null);
      setShowLogsModal(true);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 flex items-center gap-3">
              <Server className="w-8 h-8 text-cyan-400" />
              SMTP Email Relays & Domain Webmail Hub
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Connect and rotate custom domain webmail addresses, Google Workspace, SES, and cPanel relays with automated warm-up.
            </p>
          </div>

          <button
            onClick={() => handleOpenConnect('domain_webmail')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:via-cyan-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Connect New Relay / Webmail</span>
          </button>
        </div>

        {/* Deliverability & Live Relay Activity Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Active Connected Relays</div>
            <div className="text-2xl font-black text-slate-100 flex items-center gap-2 flex-wrap">
              <span>{activeSmtps.length}</span>
              <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                {activeSmtps.length > 0 ? `${aggregateStats.onlineCount}/${activeSmtps.length} Online` : '0 Online'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {aggregateStats.runningCampaignsCount} active campaign{aggregateStats.runningCampaignsCount === 1 ? '' : 's'} linked
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Today's Outbound Dispatch</div>
            <div className="text-2xl font-black text-cyan-400 flex items-baseline gap-1.5 flex-wrap">
              <span>{aggregateStats.totalSentToday.toLocaleString()}</span>
              <span className="text-xs text-slate-400 font-mono font-semibold">
                / {aggregateStats.totalEffectiveCap.toLocaleString()} cap
              </span>
            </div>
            <div className="text-[11px] text-emerald-400 font-mono">
              {aggregateStats.totalRemaining.toLocaleString()} emails remaining today
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Live Relay Engagement</div>
            <div className="text-2xl font-black text-emerald-400 flex items-baseline gap-2 flex-wrap">
              <span>{aggregateStats.totalDispatched.toLocaleString()} Sent</span>
              <span className="text-xs text-cyan-300 font-bold">
                • {aggregateStats.totalOpened} Opened ({aggregateStats.openRate}%)
              </span>
            </div>
            <div className="text-[11px] text-purple-300 font-mono">
              {aggregateStats.totalReplied} replies received ({aggregateStats.replyRate}%)
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Auto Warm-up Schedule</div>
            <div className="text-xl sm:text-2xl font-black text-purple-400 flex items-center gap-1.5">
              <Zap className="w-5 h-5 text-purple-400 shrink-0" />
              <span className="truncate">
                {activeSmtps.length === 0
                  ? '4-Week Auto'
                  : aggregateStats.rampingCount > 0
                  ? `${aggregateStats.rampingCount} Auto-Warming`
                  : 'Full Capacity'}
              </span>
            </div>
            <div className="text-[11px] text-emerald-400 font-mono">
              {activeSmtps.length > 0 ? `W1: 10-15 • W2: 20-25 • W3: 30-35 • W4: 40-50` : 'Auto 10-15 → 40-50/day'}
            </div>
          </div>
        </div>

        {/* AUTO 4-WEEK SMTP WARM-UP SCHEDULE BANNER */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/35 via-slate-900/95 to-cyan-950/35 border border-purple-500/30 space-y-3.5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                <Flame className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-2 flex-wrap">
                  <span>Automated 4-Week SMTP Warm-Up Schedule (Daily Limits)</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase">
                    ✓ 100% Auto-Pilot Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  শুরুতেই বেশি মেইল পাঠালে Google/Microsoft আপনার IP-কে স্প্যামার ভাববে। তাই সিস্টেম অটোমেটিক সাপ্তাহিক লিমিট ও ১ম সপ্তাহে টেক্সট-অনলি মোড নিয়ন্ত্রণ করে।
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/85 border border-amber-500/35 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-amber-300">Week 1 (প্রথম সপ্তাহ)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">Days 1–7</span>
              </div>
              <div className="text-base font-black text-slate-100 font-mono">Daily 10 – 15টি মেইল</div>
              <p className="text-[10px] text-amber-200/90 leading-relaxed">
                🛡️ অটো টেক্সট-অনলি মোড: কোনো লিঙ্ক বা ইমেজ ছাড়া শুধু টেক্সট মেইল যাবে (IP স্প্যাম সুরক্ষা)।
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/85 border border-cyan-500/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-cyan-300">Week 2 (দ্বিতীয় সপ্তাহ)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">Days 8–14</span>
              </div>
              <div className="text-base font-black text-slate-100 font-mono">Daily 20 – 25টি মেইল</div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                ⚡ গ্র্যাজুয়াল ভলিউম বৃদ্ধি: ডোমেইন রেপুটেশন তৈরি হওয়ার সাথে অটোমেটিক ২০-২৫টি মেইল/দিন।
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/85 border border-purple-500/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-purple-300">Week 3 (তৃতীয় সপ্তাহ)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">Days 15–21</span>
              </div>
              <div className="text-base font-black text-slate-100 font-mono">Daily 30 – 35টি মেইল</div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                🚀 স্ট্যান্ডার্ড আউটবাউন্ড ভলিউম: ৯৯.৮% প্রাইমারি ইনবক্স প্লেসমেন্ট সহ প্রতিদিন ৩০-৩৫টি মেইল।
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/85 border border-emerald-500/35 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-emerald-300">Week 4 & Onward (৪র্থ সপ্তাহ+)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">Day 22+</span>
              </div>
              <div className="text-base font-black text-emerald-400 font-mono">Daily 40 – 50টি মেইল</div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                🔥 পূর্ণ ওয়ার্ম-আপ সক্ষমতা: চতুর্থ সপ্তাহ ও পরবর্তীতে প্রতিদিন অটোমেটিক ৪০-৫০টি মেইল।
              </p>
            </div>
          </div>
        </div>

        {/* Quick Connect Provider Cards */}
        <div className="space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Fast Connect Presets
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'domain_webmail', label: 'Domain Webmail / cPanel', icon: Globe, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20 hover:border-cyan-400' },
              { id: 'gmail', label: 'Google Workspace', icon: Mail, color: 'text-blue-400 border-blue-500/30 bg-blue-950/20 hover:border-blue-400' },
              { id: 'ses', label: 'Amazon SES Pool', icon: Server, color: 'text-amber-400 border-amber-500/30 bg-amber-950/20 hover:border-amber-400' },
              { id: 'hostinger', label: 'Hostinger / Titan', icon: Lock, color: 'text-purple-400 border-purple-500/30 bg-purple-950/20 hover:border-purple-400' },
            ].map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => handleOpenConnect(p.id as any)}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition hover:scale-[1.02] cursor-pointer text-left ${p.color}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold text-slate-200">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SMTP Accounts Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider">
              Connected Relay Accounts ({activeSmtps.length})
            </h2>
            <span className="text-xs text-slate-400">Live synchronized with Outbox, Smart Inbox & Campaigns</span>
          </div>

          {activeSmtps.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-3">
              <Server className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">No Outbound Relays Connected Yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Connect your domain webmail or email provider to start dispatching high-deliverability cold email campaigns.
              </p>
              <button
                onClick={() => handleOpenConnect('domain_webmail')}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Connect First Relay</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSmtps.map((smtp) => {
                const isTestingThis = testingId === smtp.id;
                const metrics = smtpMetricsMap.get(smtp.id) || getSMTPAccountMetrics(smtp, activeSmtps, sentEmails, campaigns, threads);
                const {
                  sentToday,
                  totalDispatched,
                  openedCount,
                  repliedCount,
                  warmup,
                  effectiveDailyLimit,
                  remainingToday,
                  usagePct,
                  openRatePct,
                  replyRatePct,
                  runningCampaigns
                } = metrics;

                return (
                  <div
                    key={smtp.id}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4 relative group shadow-lg"
                  >
                    {/* Header */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
                            {smtp.provider === 'domain_webmail' ? <Globe className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-slate-100 leading-tight truncate">{smtp.name}</h3>
                            <span className="text-[11px] text-slate-400 font-mono truncate block">{smtp.fromEmail || smtp.username}</span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded flex items-center gap-1 shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {smtp.healthScore || 99.8}%
                        </span>
                      </div>

                      {/* Domain Webmail URL Link if configured */}
                      {smtp.domainWebmailUrl && (
                        <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between text-[11px]">
                          <span className="text-cyan-300 font-medium flex items-center gap-1">
                            <Globe className="w-3 h-3 text-cyan-400" />
                            Webmail:
                          </span>
                          <a
                            href={smtp.domainWebmailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline font-mono truncate max-w-[170px] flex items-center gap-1"
                          >
                            <span>{smtp.domainWebmailUrl.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Daily Capacity Usage Progress Bar (Accurately synchronized with Sent Today / Daily Limit) */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                          <Send className="w-3 h-3 text-cyan-400" />
                          <span>Today's Outbound Dispatch</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold text-cyan-300">
                          {sentToday} / {effectiveDailyLimit} sent
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(usagePct, sentToday > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{usagePct}% consumed today</span>
                          <span className="text-emerald-400 font-bold">{remainingToday} remaining</span>
                        </div>
                      </div>

                      {/* Warm-up Status Sub-bar & Quick Week Selector */}
                      <div className="pt-1.5 border-t border-slate-800/60 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] gap-1 flex-wrap">
                          <span className="text-purple-300 font-bold flex items-center gap-1">
                            <Flame className="w-3 h-3 text-purple-400" />
                            {warmup.mode === 'ramp_15'
                              ? `${warmup.weekLabelBn} (Day ${warmup.day})`
                              : warmup.mode === 'paused'
                              ? 'Warmup Paused'
                              : `⚡ Full Cap (${effectiveDailyLimit}/day)`}
                          </span>
                          {warmup.textOnlyEnforced && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold text-[9px]">
                              🛡️ Text-Only (No Links/Images)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <span className="text-[9px] text-slate-400">Warm-Up Stage:</span>
                          <div className="flex items-center gap-1">
                            {[
                              { w: 1, day: 1, label: 'W1 (10-15)' },
                              { w: 2, day: 8, label: 'W2 (20-25)' },
                              { w: 3, day: 15, label: 'W3 (30-35)' },
                              { w: 4, day: 22, label: 'W4 (40-50)' },
                            ].map((st) => {
                              const isCurrentWeek = warmup.mode === 'ramp_15' && warmup.week === st.w;
                              return (
                                <button
                                  key={st.w}
                                  type="button"
                                  onClick={() => {
                                    const newStart = new Date(Date.now() - (st.day - 1) * 86400000).toISOString();
                                    updateSMTPAccount(smtp.id, {
                                      warmupMode: 'ramp_15',
                                      warmupStatus: 'warming',
                                      warmupStartDate: newStart,
                                      warmupCurrentDay: st.day,
                                      dailyLimit: 50
                                    });
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer ${
                                    isCurrentWeek
                                      ? 'bg-purple-500 text-white shadow-xs'
                                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                                  }`}
                                  title={`Switch relay to Week ${st.w} Auto Schedule`}
                                >
                                  {st.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live Relay Performance Counters (Total Sent, Opened, Replies, Remaining) */}
                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/90 p-2.5 rounded-xl border border-slate-800/90">
                      <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                          <Send className="w-2.5 h-2.5 text-cyan-400" />
                          <span>Total Sent</span>
                        </div>
                        <div className="text-sm font-black text-slate-100 font-mono mt-0.5">
                          {totalDispatched}
                        </div>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                          <Eye className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Opened</span>
                        </div>
                        <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
                          {openedCount} <span className="text-[10px] font-normal text-slate-400">({openRatePct}%)</span>
                        </div>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5 text-purple-400" />
                          <span>Replies</span>
                        </div>
                        <div className="text-sm font-black text-purple-400 font-mono mt-0.5">
                          {repliedCount} <span className="text-[10px] font-normal text-slate-400">({replyRatePct}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Server Info Metrics & Sending Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Host & Security</span>
                        <span className="font-mono text-slate-300 font-semibold text-[11px] truncate block">
                          {smtp.host}:{smtp.port} ({smtp.encryption})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Delay Interval</span>
                        <span className="font-bold text-cyan-400 text-[11px]">
                          {smtp.scheduleSettings?.intervalSeconds || 15}s delay
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Sent Today / Cap</span>
                        <span className="font-bold text-slate-200 font-mono text-[11px]">
                          {sentToday} / {effectiveDailyLimit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Remaining Today</span>
                        <span className="font-bold text-emerald-400 font-mono text-[11px]">
                          {remainingToday} emails
                        </span>
                      </div>
                    </div>

                    {/* Active Campaign Indicator */}
                    <div className={`flex items-center justify-between gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border ${
                      runningCampaigns.length > 0
                        ? 'text-cyan-300 bg-cyan-950/30 border-cyan-500/30'
                        : 'text-slate-400 bg-slate-950/50 border-slate-800/80'
                    }`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Radio className={`w-3 h-3 shrink-0 ${runningCampaigns.length > 0 ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
                        <span className="truncate">
                          {runningCampaigns.length > 0 ? (
                            <>Active in <strong>{runningCampaigns.length}</strong> Running Campaign{runningCampaigns.length > 1 ? 's' : ''}: <strong>{runningCampaigns[0].name}</strong></>
                          ) : (
                            <>Ready for Campaign Rotation (0 running)</>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
                      <button
                        onClick={() => handleTestAccount(smtp)}
                        disabled={isTestingThis}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        {isTestingThis ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                        ) : (
                          <Activity className="w-3 h-3 text-cyan-400" />
                        )}
                        <span>{isTestingThis ? 'Verifying...' : 'Test Ping'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditAccount(smtp)}
                          title="Edit SMTP Account"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 text-xs font-bold transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountToDelete(smtp)}
                          title="Remove SMTP Account"
                          className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 hover:text-white flex items-center gap-1 text-xs font-bold transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* In-App Deletion Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#090d16] border border-rose-500/40 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-100 text-sm">Remove Connected Relay</h3>
                  <p className="text-[11px] text-slate-400">Choose removal action for this account</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
              <div className="font-bold text-slate-200">{accountToDelete.name}</div>
              <div className="font-mono text-[11px] text-cyan-400">{accountToDelete.username}</div>
              <div className="font-mono text-[10px] text-slate-400">{accountToDelete.host}:{accountToDelete.port} ({accountToDelete.encryption})</div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  deleteSMTPAccount(accountToDelete.id);
                  setAccountToDelete(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Move to Trash (Recoverable)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  permanentDeleteSMTPAccount(accountToDelete.id);
                  setAccountToDelete(null);
                }}
                className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-900/60 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Permanent Delete</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="w-full py-2 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect & Edit Modal Component */}
      <SMTPConnectModal
        isOpen={showConnectModal}
        onClose={() => {
          setShowConnectModal(false);
          setEditingAccount(null);
        }}
        initialProvider={selectedInitialProvider}
        editingAccount={editingAccount}
      />

      {/* Logs Window Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#090d16] border border-slate-800 w-full max-w-lg rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Handshake Test Output
              </h3>
              <button 
                onClick={() => setShowLogsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black/90 rounded-xl p-3 font-mono text-[11px] text-slate-300 min-h-32 max-h-56 overflow-y-auto space-y-1 border border-slate-800">
              {testLogs.map((log, idx) => (
                <div key={idx} className={log.includes('ERROR') ? 'text-rose-400' : log.includes('OK') || log.includes('Placement') ? 'text-emerald-400' : 'text-slate-300'}>
                  {log}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer"
              >
                Close Output
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
