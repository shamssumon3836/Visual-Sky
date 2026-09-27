import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  Users, 
  Inbox, 
  Server, 
  CheckSquare, 
  Square,
  Sparkles,
  ShieldAlert,
  Send,
  FileText,
  Layers,
  Search
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const TrashManager: React.FC = () => {
  const { 
    leads, 
    restoreLead, 
    permanentDeleteLead, 
    bulkRestoreLeads, 
    bulkPermanentDeleteLeads,
    threads, 
    restoreThread, 
    permanentDeleteThread, 
    bulkRestoreThreads, 
    bulkPermanentDeleteThreads,
    smtpAccounts, 
    restoreSMTPAccount, 
    permanentDeleteSMTPAccount,
    campaigns,
    restoreCampaign,
    permanentDeleteCampaign,
    emailTemplates,
    restoreEmailTemplate,
    permanentDeleteEmailTemplate,
    sentEmails,
    restoreSentEmail,
    permanentDeleteSentEmail,
    emptyAllTrash,
    totalTrashCount
  } = useApp();

  const [trashTab, setTrashTab] = useState<'all' | 'leads' | 'campaigns' | 'templates' | 'sent' | 'inbox' | 'smtp'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showEmptyConfirm, setShowEmptyConfirm] = useState<boolean>(false);

  const trashLeads = leads.filter(l => l.isTrash && (!searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.company.toLowerCase().includes(searchTerm.toLowerCase()) || l.email.toLowerCase().includes(searchTerm.toLowerCase())));
  const trashThreads = threads.filter(t => t.isTrash && (!searchTerm || t.leadName.toLowerCase().includes(searchTerm.toLowerCase()) || t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || t.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())));
  const trashSmtp = smtpAccounts.filter(s => s.isTrash && (!searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.username.toLowerCase().includes(searchTerm.toLowerCase()) || s.host.toLowerCase().includes(searchTerm.toLowerCase())));
  const trashCampaigns = campaigns.filter(c => c.isTrash && (!searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.niche.toLowerCase().includes(searchTerm.toLowerCase())));
  const trashTemplates = emailTemplates.filter(t => t.isTrash && (!searchTerm || t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.subject.toLowerCase().includes(searchTerm.toLowerCase())));
  const trashSentEmails = sentEmails.filter(s => s.isTrash && (!searchTerm || s.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) || s.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase()) || s.recipientCompany.toLowerCase().includes(searchTerm.toLowerCase()) || s.subject.toLowerCase().includes(searchTerm.toLowerCase())));

  const handleRestoreAllLeads = () => {
    bulkRestoreLeads(trashLeads.map(l => l.id));
    confetti({ particleCount: 50, spread: 60 });
  };

  const handleRestoreAllThreads = () => {
    bulkRestoreThreads(trashThreads.map(t => t.id));
    confetti({ particleCount: 50, spread: 60 });
  };

  const handleEmptyAll = () => {
    emptyAllTrash();
    setShowEmptyConfirm(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <Trash2 className="w-6 h-6 text-rose-400" />
            Trash & Soft-Deleted Recovery Hub
            <span className="text-xs font-bold px-2.5 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/30 rounded-full">
              {totalTrashCount} Items in Bin
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Safely restore leads, campaigns, templates, sent emails, inbox threads, or SMTP relays back to active status anytime.
          </p>
        </div>

        {totalTrashCount > 0 && (
          <button
            onClick={() => setShowEmptyConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-lg shadow-rose-600/30 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Empty Entire Trash
          </button>
        )}
      </div>

      {/* Search and Category Tabs Bar */}
      <div className="space-y-3">
        {totalTrashCount > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search deleted items across all categories..."
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Trash', count: totalTrashCount, icon: Trash2 },
            { id: 'leads', label: 'Leads', count: leads.filter(l => l.isTrash).length, icon: Users },
            { id: 'campaigns', label: 'Campaigns', count: campaigns.filter(c => c.isTrash).length, icon: Layers },
            { id: 'templates', label: 'Templates', count: emailTemplates.filter(t => t.isTrash).length, icon: FileText },
            { id: 'sent', label: 'Sent Mails', count: sentEmails.filter(s => s.isTrash).length, icon: Send },
            { id: 'inbox', label: 'Inbox Threads', count: threads.filter(t => t.isTrash).length, icon: Inbox },
            { id: 'smtp', label: 'SMTP Relays', count: smtpAccounts.filter(s => s.isTrash).length, icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setTrashTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  trashTab === tab.id
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 rounded text-slate-300 font-mono">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {totalTrashCount === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-200 text-base">Trash is Clean & Empty</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Deleted leads, campaigns, templates, sent emails, threads, or SMTP relays will safely show up here for recovery.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Deleted Leads Section */}
          {(trashTab === 'all' || trashTab === 'leads') && trashLeads.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-sm text-slate-200">
                    Deleted Leads ({trashLeads.length})
                  </h3>
                </div>
                <button
                  onClick={handleRestoreAllLeads}
                  className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore All Leads
                </button>
              </div>

              <div className="divide-y divide-slate-800/60">
                {trashLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{lead.name} &bull; {lead.company}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{lead.email} &bull; {lead.phone}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          restoreLead(lead.id);
                          confetti({ particleCount: 30, spread: 50 });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>

                      <button
                        onClick={() => permanentDeleteLead(lead.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition cursor-pointer"
                        title="Permanently Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deleted Campaigns Section */}
          {(trashTab === 'all' || trashTab === 'campaigns') && trashCampaigns.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <h3 className="font-bold text-sm text-slate-200">
                    Deleted Campaign Sequences ({trashCampaigns.length})
                  </h3>
                </div>
              </div>

              <div className="divide-y divide-slate-800/60">
                {trashCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{camp.name}</div>
                      <div className="text-[11px] text-slate-400">Niche: {camp.niche} &bull; {camp.totalLeads} Leads</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          restoreCampaign(camp.id);
                          confetti({ particleCount: 30, spread: 50 });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>

                      <button
                        onClick={() => permanentDeleteCampaign(camp.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition cursor-pointer"
                        title="Permanently Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deleted Templates Section */}
          {(trashTab === 'all' || trashTab === 'templates') && trashTemplates.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-sm text-slate-200">
                    Deleted Email Templates ({trashTemplates.length})
                  </h3>
                </div>
              </div>

              <div className="divide-y divide-slate-800/60">
                {trashTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{tmpl.title}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-md">Subject: {tmpl.subject}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          restoreEmailTemplate(tmpl.id);
                          confetti({ particleCount: 30, spread: 50 });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>

                      <button
                        onClick={() => permanentDeleteEmailTemplate(tmpl.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition cursor-pointer"
                        title="Permanently Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deleted Sent Emails Section */}
          {(trashTab === 'all' || trashTab === 'sent') && trashSentEmails.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-200">
                    Deleted Sent Outbox Logs ({trashSentEmails.length})
                  </h3>
                </div>
              </div>

              <div className="divide-y divide-slate-800/60">
                {trashSentEmails.map((mail) => (
                  <div
                    key={mail.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{mail.recipientName} ({mail.recipientCompany})</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">{mail.subject}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          restoreSentEmail(mail.id);
                          confetti({ particleCount: 30, spread: 50 });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>

                      <button
                        onClick={() => permanentDeleteSentEmail(mail.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition cursor-pointer"
                        title="Permanently Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deleted Inbox Threads Section */}
          {(trashTab === 'all' || trashTab === 'inbox') && trashThreads.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-slate-200">
                    Deleted Email Threads ({trashThreads.length})
                  </h3>
                </div>
                <button
                  onClick={handleRestoreAllThreads}
                  className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore All Threads
                </button>
              </div>

              <div className="divide-y divide-slate-800/60">
                {trashThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{thread.leadName} &bull; {thread.subject}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-md">{thread.lastMessage}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          restoreThread(thread.id);
                          confetti({ particleCount: 30, spread: 50 });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>

                      <button
                        onClick={() => permanentDeleteThread(thread.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition cursor-pointer"
                        title="Permanently Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deleted SMTP Section */}
          {(trashTab === 'all' || trashTab === 'smtp') && trashSmtp.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-200">
                    Deleted SMTP Accounts ({trashSmtp.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    trashSmtp.forEach(s => restoreSMTPAccount(s.id));
                    confetti({ particleCount: 50, spread: 60 });
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore All Relays
                </button>
              </div>

              <div className="divide-y divide-slate-800/60">
                {trashSmtp.map((smtp) => (
                  <div
                    key={smtp.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{smtp.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{smtp.username} &bull; {smtp.host}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => restoreSMTPAccount(smtp.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>

                      <button
                        onClick={() => permanentDeleteSMTPAccount(smtp.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition cursor-pointer"
                        title="Permanently Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-100">Permanently Empty All Trash?</h3>
              <p className="text-xs text-slate-400">
                This action cannot be undone. All {totalTrashCount} deleted items will be permanently erased.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEmptyAll}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Yes, Empty Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
