import React from 'react';
import { useApp } from '../../context/AppContext';
import { VisualSkyLogo } from '../brand/VisualSkyLogo';
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
  MailCheck,
  X,
  Settings,
  LogOut,
  Mail,
  User as UserIcon,
  Search
} from 'lucide-react';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSendMail?: () => void;
  onOpenAuth?: () => void;
  onRequestLogout?: () => void;
  onOpenProfile?: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  onOpenSendMail,
  onOpenAuth,
  onRequestLogout,
  onOpenProfile
}) => {
  const { 
    activeTab, 
    setActiveTab, 
    leads, 
    threads, 
    campaigns, 
    smtpAccounts,
    currentUser,
    totalTrashCount
  } = useApp();

  if (!isOpen) return null;

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
      description: 'Client management, billing & master control',
      icon: ShieldCheck,
      badge: '👑 Master Admin',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
    }] : []),
    {
      id: 'dashboard',
      label: isAgency ? 'Main Dashboard' : 'Client Workspace',
      description: isAgency ? 'Analytics & pipeline overview' : 'Outreach campaigns, leads & AI inbox',
      icon: LayoutDashboard,
      badge: isAgency ? 'Overview' : '💼 Client',
      badgeColor: isAgency ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    },
    {
      id: 'smtp',
      label: 'SMTP / IMAP Hub',
      description: 'Rotations & warm-up relays',
      icon: Server,
      badge: isServiceDisabled('smtp') ? '🔒 Disabled' : (activeSmtpCount > 0 ? `${activeSmtpCount} Live` : 'Connect'),
      badgeColor: isServiceDisabled('smtp') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    },
    {
      id: 'generator',
      label: 'AI Lead Miner',
      description: 'Gemini 2.0 B2B lead discovery',
      icon: Sparkles,
      tag: isServiceDisabled('generator') ? '🔒 Disabled' : 'Gemini 2.0',
      tagColor: isServiceDisabled('generator') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    },
    {
      id: 'leads',
      label: 'Lead Directory',
      description: 'Verified contact lists & filters',
      icon: Users,
      badge: activeLeadsCount > 0 ? `${activeLeadsCount} Leads` : undefined,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    },
    {
      id: 'templates',
      label: 'Templates & Spam Audit',
      description: 'Copywriting & anti-spam scoring',
      icon: FileText,
      tag: isServiceDisabled('templates') ? '🔒 Disabled' : 'Anti-Spam',
      tagColor: isServiceDisabled('templates') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    {
      id: 'campaigns',
      label: 'Campaign Wizard',
      description: 'Multi-step automated sequences',
      icon: Send,
      badge: isServiceDisabled('campaigns') ? '🔒 Disabled' : (runningCampaignsCount > 0 ? `${runningCampaignsCount} Live` : undefined),
      badgeColor: isServiceDisabled('campaigns') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    {
      id: 'inbox',
      label: 'Smart Unified Inbox',
      description: 'Live replies & categorization',
      icon: Inbox,
      badge: isServiceDisabled('inbox') ? '🔒 Disabled' : (unreadThreadsCount > 0 ? `${unreadThreadsCount} Unread` : undefined),
      badgeColor: isServiceDisabled('inbox') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    {
      id: 'sent',
      label: 'Sent Mails & Outbox',
      description: 'Dispatch logs & open tracking',
      icon: MailCheck,
      tag: 'Live Tracker',
      tagColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
    },
    {
      id: 'analytics',
      label: 'Deliverability Radar',
      description: 'Inbox health & bounce audits',
      icon: BarChart3,
      tag: isServiceDisabled('analytics') ? '🔒 Disabled' : 'Stats',
      tagColor: isServiceDisabled('analytics') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    },
    {
      id: 'ai_copilot',
      label: 'AI Outreach Copilot',
      description: 'Gemini assistant & objection solver',
      icon: Bot,
      tag: isServiceDisabled('ai_copilot') ? '🔒 Disabled' : 'Chat',
      tagColor: isServiceDisabled('ai_copilot') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
      id: 'trash',
      label: 'Trash & Recovery',
      description: 'Deleted leads, relays & items',
      icon: Trash2,
      badge: totalTrashCount > 0 ? `${totalTrashCount} Items` : undefined,
      badgeColor: 'bg-slate-700/50 text-slate-300 border-slate-600/50'
    },
  ];

  const handleItemClick = (tabId: string) => {
    setActiveTab(tabId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 flex">
      {/* Drawer Body (Slide from left) */}
      <div 
        className="w-[85vw] max-w-sm h-full bg-[#090d16] border-r border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-left duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <div onClick={() => handleItemClick('dashboard')} className="cursor-pointer">
            <VisualSkyLogo size="md" />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Summary Card */}
        <div className="p-3 border-b border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center gap-2.5 mb-2">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-9 h-9 rounded-xl object-cover ring-1 ring-cyan-500/50 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-100 truncate">{currentUser.name}</div>
              <div className="text-[10px] text-cyan-400 truncate">
                {isAgency ? '👑 Agency Master' : '💼 Client Workspace'} &bull; {currentUser.plan} Plan
              </div>
            </div>
          </div>

          {/* Quota Progress */}
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 space-y-1 text-[10px]">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" />
                Monthly Quota
              </span>
              <span className="text-cyan-400 font-mono font-bold">
                {currentUser.quotaUsed.toLocaleString()} / {currentUser.quotaLimit.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full"
                style={{ width: `${Math.min((currentUser.quotaUsed / Math.max(currentUser.quotaLimit, 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Send Mail Action */}
        {onOpenSendMail && (
          <div className="p-3 pb-0">
            <button
              onClick={() => {
                onClose();
                onOpenSendMail();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Compose Cold Outreach</span>
            </button>
          </div>
        )}

        {/* Full Scrollable Navigation Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0 divide-y divide-slate-800/30">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pt-1 pb-1">
            All VisualSky Modules
          </div>

          <div className="space-y-1 pt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600/20 via-cyan-500/10 to-transparent text-cyan-300 border border-cyan-500/30 shadow-md font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800/80 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold">{item.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{item.description}</div>
                    </div>
                  </div>

                  {/* Badges / Tags */}
                  <div className="shrink-0 flex items-center gap-1 ml-2">
                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border whitespace-nowrap ${
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
        </div>

        {/* Footer Actions: Profile, Switch Portal, Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 space-y-1.5 shrink-0">
          {onOpenProfile && (
            <button
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Profile & Settings</span>
            </button>
          )}

          {onOpenAuth && (
            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-cyan-400 hover:bg-cyan-950/40 transition cursor-pointer"
            >
              <UserIcon className="w-4 h-4" />
              <span>Switch Portal / Sign In</span>
            </button>
          )}

          {onRequestLogout && (
            <button
              onClick={() => {
                onClose();
                onRequestLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out / Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Click outside backdrop to close */}
      <div className="flex-1" onClick={onClose} />
    </div>
  );
};
