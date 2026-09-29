import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard,
  Users, 
  Sparkles, 
  Inbox, 
  Send, 
  Server, 
  Bot, 
  ShieldCheck, 
  Trash2, 
  Zap,
  BarChart3,
  FileText,
  FolderOpen
} from 'lucide-react';

interface SidebarProps {
  onOpenBilling?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenBilling }) => {
  const { 
    activeTab, 
    setActiveTab, 
    leads, 
    threads, 
    campaigns, 
    smtpAccounts,
    currentUser,
    totalTrashCount,
    driveStorageSettings
  } = useApp();

  const activeLeadsCount = leads.filter(l => !l.isTrash).length;
  const unreadThreadsCount = threads.filter(t => !t.isTrash && t.unreadCount > 0).length;
  const runningCampaignsCount = campaigns.filter(c => c.status === 'running').length;
  const activeSmtpCount = smtpAccounts.filter(s => !s.isTrash && s.isConnected).length;

  const isAgency = currentUser.role === 'agency' || currentUser.role === 'owner' || Boolean(currentUser.isOwner);

  const isServiceDisabled = (tabId: string) => {
    if (isAgency) return false;
    if (currentUser.permissions?.accountStatus === 'suspended') return true;
    if (tabId === 'generator' && currentUser.permissions?.leadMinerEnabled === false) return true;
    if (tabId === 'inbox' && currentUser.permissions?.smartInboxEnabled === false) return true;
    if (tabId === 'campaigns' && currentUser.permissions?.campaignAutomationEnabled === false) return true;
    if (tabId === 'smtp' && currentUser.permissions?.smtpRotationEnabled === false) return true;
    if (tabId === 'ai_copilot' && currentUser.permissions?.aiCopilotEnabled === false) return true;
    if (tabId === 'templates' && currentUser.permissions?.templatesEnabled === false) return true;
    if (tabId === 'analytics' && currentUser.permissions?.analyticsEnabled === false) return true;
    return false;
  };

  const navItems = [
    ...(isAgency ? [{
      id: 'owner',
      label: 'Agency Master Dashboard',
      icon: ShieldCheck,
      badge: '👑 Master Admin',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
    }] : []),
    {
      id: 'dashboard',
      label: 'Main Dashboard',
      icon: LayoutDashboard,
      badge: 'Overview',
      badgeColor: 'bg-blue-500/10 text-blue-300 border-blue-500/20'
    },
    {
      id: 'drive_storage',
      label: 'Google Drive Storage',
      icon: FolderOpen,
      badge: driveStorageSettings?.folderUrl ? '✓ Linked' : '0 KB Host',
      badgeColor: driveStorageSettings?.folderUrl
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
    },
    {
      id: 'smtp',
      label: 'SMTP / IMAP Hub',
      icon: Server,
      badge: isServiceDisabled('smtp') ? '🔒 Disabled' : (activeSmtpCount > 0 ? `${activeSmtpCount} Live` : 'Connect'),
      badgeColor: isServiceDisabled('smtp') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    },
    {
      id: 'generator',
      label: 'AI Lead Miner',
      icon: Sparkles,
      tag: isServiceDisabled('generator') ? '🔒 Disabled' : 'Gemini 2.0',
      tagColor: isServiceDisabled('generator') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    },
    {
      id: 'leads',
      label: 'Lead Directory',
      icon: Users,
      badge: activeLeadsCount > 0 ? activeLeadsCount : undefined,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    },
    {
      id: 'templates',
      label: 'Templates & Spam Audit',
      icon: FileText,
      tag: isServiceDisabled('templates') ? '🔒 Disabled' : 'Anti-Spam',
      tagColor: isServiceDisabled('templates') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    {
      id: 'campaigns',
      label: 'Campaign Wizard',
      icon: Send,
      badge: isServiceDisabled('campaigns') ? '🔒 Disabled' : (runningCampaignsCount > 0 ? `${runningCampaignsCount} Live` : undefined),
      badgeColor: isServiceDisabled('campaigns') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    {
      id: 'inbox',
      label: 'Smart Inbox',
      icon: Inbox,
      badge: isServiceDisabled('inbox') ? '🔒 Disabled' : (unreadThreadsCount > 0 ? unreadThreadsCount : undefined),
      badgeColor: isServiceDisabled('inbox') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    {
      id: 'sent',
      label: 'Sent Mails & Outbox',
      icon: Send,
      tag: 'Live Tracker',
      tagColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
    },
    {
      id: 'analytics',
      label: 'Deliverability Radar',
      icon: BarChart3,
      tag: isServiceDisabled('analytics') ? '🔒 Disabled' : 'Stats',
      tagColor: isServiceDisabled('analytics') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    },
    {
      id: 'ai_copilot',
      label: 'AI Outreach Copilot',
      icon: Bot,
      tag: isServiceDisabled('ai_copilot') ? '🔒 Disabled' : 'Chat',
      tagColor: isServiceDisabled('ai_copilot') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
      id: 'trash',
      label: 'Trash & Recovery',
      icon: Trash2,
      badge: totalTrashCount > 0 ? totalTrashCount : undefined,
      badgeColor: 'bg-slate-700/50 text-slate-300 border-slate-600/50'
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#090d16]/95 border-r border-slate-800/80 flex flex-col justify-between hidden md:flex h-full min-h-0 select-none">
      {/* Navigation Section */}
      <div className="p-3.5 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
          Visual Sky Modules
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600/20 via-cyan-500/10 to-transparent text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/5 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition ${
                    isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span className="truncate whitespace-nowrap text-[12px]">{item.label}</span>
              </div>

              {/* Badges / Tags */}
              <div className="shrink-0 flex items-center gap-1.5 ml-2">
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md border whitespace-nowrap ${
                      item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.tag && (
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase rounded border whitespace-nowrap ${
                      item.tagColor
                    }`}
                  >
                    {item.tag}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Plan & Resource Usage Bottom Bar */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40">
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />
              <span className="truncate">
                {currentUser.role === 'agency' || currentUser.role === 'owner' || currentUser.isOwner ? '👑 Agency Master' : '💼 Client Workspace'}
              </span>
            </div>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
              {currentUser.plan}
            </span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min((currentUser.quotaUsed / currentUser.quotaLimit) * 100, 100)}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{currentUser.quotaUsed.toLocaleString()} Sent</span>
            <span>{currentUser.quotaLimit.toLocaleString()} Quota</span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('drive_storage')}
            className="w-full mt-1 py-2 px-3 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-200 text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>{driveStorageSettings?.folderUrl ? '☁️ Change Drive Link' : '☁️ Add Google Drive Link'}</span>
          </button>

          {onOpenBilling && (
            <button
              type="button"
              onClick={onOpenBilling}
              className="w-full mt-1.5 py-2 px-3 rounded-xl bg-[#E2136E] hover:bg-[#c91060] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <span>Upgrade Plan (bKash)</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
