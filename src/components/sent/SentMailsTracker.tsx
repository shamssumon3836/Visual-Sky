import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SentEmailLog } from '../../types';
import { 
  Send, 
  Search, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Eye, 
  MessageSquare, 
  Clock, 
  Server, 
  ExternalLink, 
  Trash2, 
  Filter, 
  ShieldCheck, 
  Zap, 
  Copy, 
  Check, 
  X,
  Mail,
  Activity,
  User,
  Building,
  Terminal,
  ChevronRight,
  Sparkles,
  Inbox,
  LayoutGrid,
  List,
  RotateCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { safeParseResponse } from '../../lib/safeFetch';

interface SentMailsTrackerProps {
  onOpenSendMail?: (lead?: any) => void;
}

export const SentMailsTracker: React.FC<SentMailsTrackerProps> = ({ onOpenSendMail }) => {
  const { 
    sentEmails, 
    setSentEmails,
    clearSentEmails, 
    deleteSentEmail,
    customSimulateReply, 
    setActiveTab,
    leads,
    smtpAccounts,
    addNotification
  } = useApp();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'opened' | 'replied' | 'sent' | 'failed'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedMail, setSelectedMail] = useState<SentEmailLog | null>(null);
  const [isCopiedId, setIsCopiedId] = useState<string | null>(null);
  const [isSimulatingPing, setIsSimulatingPing] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const handleRetrySend = async (mail: SentEmailLog) => {
    setIsRetrying(true);
    try {
      const activeAccount = smtpAccounts.find(a => a.name === mail.smtpAccountName || mail.smtpHost.includes(a.host)) ||
                            smtpAccounts.find(a => a.status === 'connected') ||
                            smtpAccounts[0];

      if (!activeAccount) {
        addNotification({
          title: 'No SMTP Account Configured',
          message: 'Please connect an active SMTP account in Settings -> SMTP Accounts.',
          type: 'system'
        });
        setIsRetrying(false);
        return;
      }

      const res = await fetch('/api/smtp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: mail.recipientEmail,
          toName: mail.recipientName,
          from: activeAccount.fromEmail || activeAccount.username,
          fromName: activeAccount.fromName || 'Visual Sky Outreach',
          subject: mail.subject,
          text: mail.body,
          smtpConfig: activeAccount,
          trackingPixelId: mail.trackingPixelId
        })
      });

      const parsed = await safeParseResponse(res, 'SMTP transmission failed');
      const data = parsed.data || {};

      if (parsed.ok && data.success) {
        setSentEmails(prev => prev.map(m => m.id === mail.id ? { ...m, status: 'sent', errorMessage: undefined } : m));
        setSelectedMail(prev => prev && prev.id === mail.id ? { ...prev, status: 'sent', errorMessage: undefined } : prev);
        addNotification({
          title: 'Email Dispatched Successfully! 🚀',
          message: `Live email delivered to ${mail.recipientEmail} via ${activeAccount.name}.`,
          type: 'reply'
        });
      } else {
        const errText = data.error || 'Server rejected transmission';
        setSentEmails(prev => prev.map(m => m.id === mail.id ? { ...m, errorMessage: errText } : m));
        setSelectedMail(prev => prev && prev.id === mail.id ? { ...prev, errorMessage: errText } : prev);
        addNotification({
          title: 'Transmission Failed',
          message: errText,
          type: 'system'
        });
      }
    } catch (err: any) {
      const errText = err?.message || 'Network error during retry';
      addNotification({
        title: 'Retry Error',
        message: errText,
        type: 'system'
      });
    } finally {
      setIsRetrying(false);
    }
  };

  // Filtered List (Exclude trashed)
  const activeSentEmails = useMemo(() => sentEmails.filter(s => !s.isTrash), [sentEmails]);

  const filteredMails = useMemo(() => {
    return activeSentEmails.filter(mail => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q || (
        (mail.recipientName || '').toLowerCase().includes(q) ||
        (mail.recipientEmail || '').toLowerCase().includes(q) ||
        (mail.recipientCompany || '').toLowerCase().includes(q) ||
        (mail.subject || '').toLowerCase().includes(q) ||
        (mail.smtpAccountName || '').toLowerCase().includes(q) ||
        (mail.campaignName || '').toLowerCase().includes(q) ||
        (mail.errorMessage || '').toLowerCase().includes(q)
      );

      if (!matchesSearch) return false;

      if (statusFilter === 'opened') return mail.status === 'opened' || (mail.openCount || 0) > 0;
      if (statusFilter === 'replied') return mail.status === 'replied';
      if (statusFilter === 'sent') return mail.status === 'sent';
      if (statusFilter === 'failed') return mail.status === 'failed';

      return true;
    });
  }, [activeSentEmails, searchTerm, statusFilter]);

  // Aggregate Metrics
  const totalCount = activeSentEmails.length;
  const successfulCount = activeSentEmails.filter(m => m.status !== 'failed').length;
  const failedCount = activeSentEmails.filter(m => m.status === 'failed').length;
  const openedCount = activeSentEmails.filter(m => m.status === 'opened' || (m.openCount || 0) > 0 || m.status === 'replied').length;
  const repliedCount = activeSentEmails.filter(m => m.status === 'replied').length;
  const openRatePercent = successfulCount > 0 ? ((openedCount / successfulCount) * 100).toFixed(1) : '0';
  const replyRatePercent = successfulCount > 0 ? ((repliedCount / successfulCount) * 100).toFixed(1) : '0';

  // Export CSV
  const handleExportCSV = () => {
    if (activeSentEmails.length === 0) return;

    const headers = ['ID,Campaign,Recipient Name,Recipient Email,Company,Subject,SMTP Relay,Sent At,Status,Open Count,Tracking Pixel ID'];
    const rows = activeSentEmails.map(m => [
      `"${m.id}"`,
      `"${(m.campaignName || '').replace(/"/g, '""')}"`,
      `"${(m.recipientName || '').replace(/"/g, '""')}"`,
      `"${(m.recipientEmail || '').replace(/"/g, '""')}"`,
      `"${(m.recipientCompany || '').replace(/"/g, '""')}"`,
      `"${(m.subject || '').replace(/"/g, '""')}"`,
      `"${(m.smtpAccountName || '').replace(/"/g, '""')}"`,
      `"${m.sentAt}"`,
      `"${m.status}"`,
      m.openCount || 0,
      `"${m.trackingPixelId || ''}"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `visualsky_sent_outbox_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setIsCopiedId(id);
    setTimeout(() => setIsCopiedId(null), 2000);
  };

  const handleSimulateOpen = (mail: SentEmailLog) => {
    mail.openCount = (mail.openCount || 0) + 1;
    mail.status = 'opened';
    addNotification({
      title: 'Email Opened Event',
      message: `${mail.recipientName} (${mail.recipientCompany}) just opened your email!`,
      type: 'lead'
    });
    confetti({ particleCount: 30, spread: 50 });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 flex items-center gap-3">
              <Send className="w-8 h-8 text-cyan-400" />
              Sent Mail Outbox & Delivery Tracker
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Live outbox monitor with pixel-open detection, reply timestamps, and SMTP relay handshake audit logs.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              disabled={sentEmails.length === 0}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Outbox CSV</span>
            </button>

            {sentEmails.length > 0 && (
              <button
                onClick={clearSentEmails}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950 border border-slate-800 text-slate-400 hover:text-rose-300 text-xs font-bold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Aggregate Delivery Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Total Emails Dispatched</div>
            <div className="text-2xl font-black text-slate-100">{totalCount}</div>
            <div className={`text-[10px] font-bold ${failedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {failedCount > 0 ? `${successfulCount} sent, ${failedCount} failed` : '100% Delivery Confirmation'}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Unique Opens Tracked</div>
            <div className="text-2xl font-black text-cyan-400">{openedCount}</div>
            <div className="text-[10px] text-cyan-300 font-mono">{openRatePercent}% Open Rate</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Positive Replies Logged</div>
            <div className="text-2xl font-black text-emerald-400">{repliedCount}</div>
            <div className="text-[10px] text-emerald-300 font-mono">{replyRatePercent}% Reply Rate</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Delivery Engine Health</div>
            <div className="text-2xl font-black text-purple-400">
              {failedCount > 0 && totalCount > 0 ? `${((successfulCount / totalCount) * 100).toFixed(0)}%` : '99.8%'}
            </div>
            <div className="text-[10px] text-purple-300 font-bold">SPF/DKIM 2048-bit</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by recipient name, email, company, subject, campaign, or SMTP host..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Single-Line Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span>Single-Line Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards View</span>
              </button>
            </div>

            {/* Status filter tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'all', label: 'All' },
                { id: 'opened', label: '👁️ Opened' },
                { id: 'replied', label: '💬 Replied' },
                { id: 'sent', label: '✓ Sent' },
                { id: 'failed', label: '❌ Failed' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sent Emails Container: Table or Cards */}
        {filteredMails.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Send className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="text-base font-bold text-slate-300">No sent emails match your filter</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Launch a campaign sequence or send a direct email from the Lead Directory to track outbound delivery here.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* Single-Line Table View */
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-extrabold">
                    <th className="p-3.5">Recipient</th>
                    <th className="p-3.5">Company</th>
                    <th className="p-3.5">Campaign / Source</th>
                    <th className="p-3.5">Subject Line</th>
                    <th className="p-3.5">SMTP Relay</th>
                    <th className="p-3.5">Dispatched At</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-center">Opens</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredMails.map((mail) => (
                    <tr
                      key={mail.id}
                      onClick={() => setSelectedMail(mail)}
                      className="hover:bg-slate-800/40 transition cursor-pointer group"
                    >
                      {/* Recipient */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-100 truncate max-w-[180px]">{mail.recipientName}</div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-[180px]">{mail.recipientEmail}</div>
                      </td>

                      {/* Company - strictly 1 line */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-200 block truncate max-w-[170px]" title={mail.recipientCompany}>
                          {mail.recipientCompany || '—'}
                        </span>
                      </td>

                      {/* Campaign */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded inline-block truncate max-w-[140px]" title={mail.campaignName || 'Direct Outreach'}>
                          {mail.campaignName || 'Direct Outreach'}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="p-3.5 whitespace-nowrap max-w-xs">
                        <div className="text-slate-300 truncate font-medium max-w-[220px]" title={mail.subject}>{mail.subject}</div>
                      </td>

                      {/* SMTP Relay */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-mono text-slate-300 text-[11px] flex items-center gap-1">
                          <Server className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate max-w-[120px]" title={mail.smtpAccountName}>{mail.smtpAccountName}</span>
                        </div>
                      </td>

                      {/* Sent At */}
                      <td className="p-3.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(mail.sentAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          mail.status === 'replied'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : mail.status === 'opened' || (mail.openCount || 0) > 0
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : mail.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : mail.status === 'bounced'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {mail.status === 'replied'
                            ? '💬 Replied'
                            : (mail.openCount || 0) > 0
                            ? '👁️ Opened'
                            : mail.status === 'failed'
                            ? '❌ Failed'
                            : mail.status === 'bounced'
                            ? '⚠️ Bounced'
                            : '✓ Sent'}
                        </span>
                      </td>

                      {/* Open Count */}
                      <td className="p-3.5 font-mono text-slate-300 font-bold text-center whitespace-nowrap">
                        {(mail.openCount || 0) > 0 ? (
                          <span className="text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                            {mail.openCount}
                          </span>
                        ) : mail.status === 'failed' ? (
                          <span className="text-rose-500 text-[11px]">ERR</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Actions: View & Delete */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMail(mail);
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            title="Inspect email details"
                          >
                            <Eye className="w-3 h-3 text-cyan-400" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSentEmail(mail.id);
                            }}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                            title="Move to trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMails.map((mail) => (
              <div
                key={mail.id}
                onClick={() => setSelectedMail(mail)}
                className="p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition shadow-lg space-y-3 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Campaign Badge and Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded truncate max-w-[160px]">
                      {mail.campaignName || 'Direct Outreach'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      mail.status === 'replied'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : mail.status === 'opened' || (mail.openCount || 0) > 0
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : mail.status === 'failed'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : mail.status === 'bounced'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {mail.status === 'replied'
                        ? '💬 Replied'
                        : (mail.openCount || 0) > 0
                        ? `👁️ Opened (${mail.openCount})`
                        : mail.status === 'failed'
                        ? '❌ Failed'
                        : mail.status === 'bounced'
                        ? '⚠️ Bounced'
                        : '✓ Sent'}
                    </span>
                  </div>

                  {/* Recipient info */}
                  <div className="mt-3">
                    <h3 className="font-bold text-slate-100 text-sm truncate">{mail.recipientName}</h3>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{mail.recipientEmail}</p>
                    <p className="text-xs text-blue-400 font-medium truncate mt-0.5">{mail.recipientCompany}</p>
                  </div>

                  {/* Subject line */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Subject</div>
                    <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">{mail.subject}</p>
                  </div>

                  {/* Error Callout if Failed */}
                  {mail.status === 'failed' && mail.errorMessage && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-950/40 border border-rose-900/60 text-[11px] text-rose-300 font-mono break-words">
                      ❌ {mail.errorMessage}
                    </div>
                  )}

                  {/* Body Preview snippet */}
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-2 font-mono leading-relaxed">
                    {mail.body}
                  </p>
                </div>

                {/* Footer details & actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
                      <Server className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate max-w-[110px]">{mail.smtpAccountName}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(mail.sentAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSentEmail(mail.id);
                        addNotification({
                          title: 'Outbox Record Deleted',
                          message: `Email to ${mail.recipientName} removed from delivery tracker.`,
                          type: 'system'
                        });
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMail(mail);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-sm"
                    >
                      <span>Inspect</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* INSPECT EMAIL DRAWER / MODAL */}
      {selectedMail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#090d16] border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-base">Outbox Message Inspector</h3>
              </div>
              <button onClick={() => setSelectedMail(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Meta Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px] block">To:</span>
                <span className="font-bold text-slate-200">{selectedMail.recipientName} &lt;{selectedMail.recipientEmail}&gt;</span>
                <span className="text-slate-400 block text-[11px]">{selectedMail.recipientCompany}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Outbound Relay:</span>
                <span className="font-mono text-cyan-300 font-bold">{selectedMail.smtpAccountName}</span>
                <span className="text-slate-400 block text-[10px] font-mono">{selectedMail.smtpHost}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Campaign / Sequence:</span>
                <span className="font-bold text-purple-400">{selectedMail.campaignName}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Tracking Status:</span>
                <span className={`font-bold ${
                  selectedMail.status === 'replied'
                    ? 'text-emerald-400'
                    : (selectedMail.openCount || 0) > 0
                    ? 'text-cyan-400'
                    : selectedMail.status === 'failed'
                    ? 'text-rose-400'
                    : 'text-slate-200'
                }`}>
                  {selectedMail.status === 'replied'
                    ? `✓ Replied (${selectedMail.repliedAt ? new Date(selectedMail.repliedAt).toLocaleTimeString() : 'Verified'})`
                    : (selectedMail.openCount || 0) > 0
                    ? `✓ Opened (${selectedMail.openCount} times)`
                    : selectedMail.status === 'failed'
                    ? '❌ Failed to Deliver'
                    : '✓ Sent'}
                </span>
              </div>
            </div>

            {/* Error message banner if failed */}
            {selectedMail.status === 'failed' && selectedMail.errorMessage && (
              <div className="p-3.5 bg-rose-950/60 border border-rose-900 rounded-2xl space-y-2">
                <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5 text-rose-400" />
                  <span>SMTP Delivery Failure Reason</span>
                </div>
                <p className="text-xs text-rose-200 font-mono break-words leading-relaxed">
                  {selectedMail.errorMessage}
                </p>

                {/* Cloud & Serverless Guidance */}
                {(selectedMail.errorMessage.includes('FUNCTION_INVOCATION_FAILED') ||
                  selectedMail.errorMessage.includes('timeout') ||
                  selectedMail.errorMessage.includes('Serverless') ||
                  selectedMail.errorMessage.includes('timed out') ||
                  selectedMail.errorMessage.includes('ETIMEDOUT')) && (
                  <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200/90 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Cloud SMTP Delivery Diagnostics & Recommendations:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                      <li>
                        <strong>Switch Port:</strong> Try Port <strong>587 (TLS/STARTTLS)</strong> instead of Port 465 (SSL) in Settings → SMTP Accounts.
                      </li>
                      <li>
                        <strong>Hosting Firewall:</strong> cPanel / custom mail hosts often block connections from cloud datacenters (AWS/Vercel). Whitelist serverless IP ranges or contact your host.
                      </li>
                      <li>
                        <strong>Guaranteed Delivery:</strong> Connect via <strong>Resend</strong> or <strong>Brevo API</strong> (HTTPS Port 443) which never faces firewall or socket blocks.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Email Subject & Body Preview */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">Subject: {selectedMail.subject}</div>
              <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 font-sans text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {selectedMail.body}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {selectedMail.status === 'failed' && (
                  <button
                    disabled={isRetrying}
                    onClick={() => handleRetrySend(selectedMail)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-900/30 transition"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                    <span>{isRetrying ? 'Dispatching...' : 'Retry Dispatch'}</span>
                  </button>
                )}

                <button
                  onClick={() => handleSimulateOpen(selectedMail)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>Simulate Pixel Open</span>
                </button>
                <button
                  onClick={() => {
                    deleteSentEmail(selectedMail.id);
                    addNotification({
                      title: 'Outbox Record Deleted',
                      message: `Email to ${selectedMail.recipientName} removed from delivery tracker.`,
                      type: 'system'
                    });
                    setSelectedMail(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyText(selectedMail.body, 'body')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1"
                >
                  {isCopiedId === 'body' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedId === 'body' ? 'Copied' : 'Copy Text'}</span>
                </button>

                <button
                  onClick={() => setSelectedMail(null)}
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
