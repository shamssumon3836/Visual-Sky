import React, { useState, useEffect, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LandingPage } from './components/landing/LandingPage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { FloatingNotificationCorner } from './components/notifications/FloatingNotificationCorner';
import { GlobalSaaSAnimations } from './components/ui/GlobalSaaSAnimations';
import { Lead } from './types';
import { 
  LayoutDashboard,
  Users, 
  Sparkles, 
  Inbox, 
  Send, 
  Server, 
  FileText,
  BarChart3,
  Bot, 
  ShieldCheck, 
  Grid,
  FolderOpen,
  Paperclip,
  Link2,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

// Code-split heavy views and modals so initial page load & reload are ultra-fast
const SmartInbox = React.lazy(() => import('./components/inbox/SmartInbox').then(m => ({ default: m.SmartInbox })));
const CampaignManager = React.lazy(() => import('./components/campaigns/CampaignManager').then(m => ({ default: m.CampaignManager })));
const LeadDirectory = React.lazy(() => import('./components/leads/LeadDirectory').then(m => ({ default: m.LeadDirectory })));
const AILeadGenerator = React.lazy(() => import('./components/leads/AILeadGenerator').then(m => ({ default: m.AILeadGenerator })));
const TemplateManager = React.lazy(() => import('./components/templates/TemplateManager').then(m => ({ default: m.TemplateManager })));
const AnalyticsView = React.lazy(() => import('./components/analytics/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const SMTPManager = React.lazy(() => import('./components/smtp/SMTPManager').then(m => ({ default: m.SMTPManager })));
const SentMailsTracker = React.lazy(() => import('./components/sent/SentMailsTracker').then(m => ({ default: m.SentMailsTracker })));
const GeminiAssistant = React.lazy(() => import('./components/ai/GeminiAssistant').then(m => ({ default: m.GeminiAssistant })));
const OwnerPanel = React.lazy(() => import('./components/owner/OwnerPanel').then(m => ({ default: m.OwnerPanel })));
const TrashManager = React.lazy(() => import('./components/trash/TrashManager').then(m => ({ default: m.TrashManager })));
const GoogleDriveStorageView = React.lazy(() => import('./components/drive/GoogleDriveStorageView').then(m => ({ default: m.GoogleDriveStorageView })));
const MobileNavDrawer = React.lazy(() => import('./components/layout/MobileNavDrawer').then(m => ({ default: m.MobileNavDrawer })));
const AuthModal = React.lazy(() => import('./components/auth/AuthModal').then(m => ({ default: m.AuthModal })));
const LogoutConfirmModal = React.lazy(() => import('./components/auth/LogoutConfirmModal').then(m => ({ default: m.LogoutConfirmModal })));
const ProfileModal = React.lazy(() => import('./components/profile/ProfileModal').then(m => ({ default: m.ProfileModal })));
const SendMailModal = React.lazy(() => import('./components/mail/SendMailModal').then(m => ({ default: m.SendMailModal })));
const BkashSubscriptionModal = React.lazy(() => import('./components/billing/BkashSubscriptionModal').then(m => ({ default: m.BkashSubscriptionModal })));

const ViewLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[55vh] text-slate-400">
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
      <div className="w-4 h-4 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
      <span className="text-xs font-bold text-slate-300 tracking-wide">Loading module...</span>
    </div>
  </div>
);

const MainContent: React.FC = () => {
  const { 
    isAuthenticated,
    activeTab, 
    setActiveTab, 
    threads, 
    currentUser, 
    isLogoutConfirmOpen, 
    setIsLogoutConfirmOpen, 
    logout,
    activeFollowUpCohort,
    driveStorageSettings,
    updateDriveStorageSettings
  } = useApp();
  
  const [globalDriveUrl, setGlobalDriveUrl] = useState<string>(driveStorageSettings?.folderUrl || '');
  const [globalDriveSaved, setGlobalDriveSaved] = useState<boolean>(false);

  useEffect(() => {
    setGlobalDriveUrl(driveStorageSettings?.folderUrl || '');
  }, [driveStorageSettings?.folderUrl]);
  
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authInitialPortal, setAuthInitialPortal] = useState<'client' | 'agency'>('client');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup' | 'forgot_password'>('signin');
  const [authInitialPlan, setAuthInitialPlan] = useState<string>('scale');

  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isBillingOpen, setIsBillingOpen] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isSendMailOpen, setIsSendMailOpen] = useState<boolean>(false);
  const [selectedLeadForMail, setSelectedLeadForMail] = useState<Lead | undefined>(undefined);
  const [hasVisitedCampaigns, setHasVisitedCampaigns] = useState<boolean>(activeTab === 'campaigns');

  useEffect(() => {
    if (activeTab === 'campaigns' || activeFollowUpCohort) {
      setHasVisitedCampaigns(true);
    }
  }, [activeTab, activeFollowUpCohort]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLogoutConfirmOpen) setIsLogoutConfirmOpen(false);
        else if (isSendMailOpen) setIsSendMailOpen(false);
        else if (isBillingOpen) setIsBillingOpen(false);
        else if (isProfileOpen) setIsProfileOpen(false);
        else if (isAuthOpen) setIsAuthOpen(false);
        else if (isMobileDrawerOpen) setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLogoutConfirmOpen, isSendMailOpen, isBillingOpen, isProfileOpen, isAuthOpen, isMobileDrawerOpen, setIsLogoutConfirmOpen]);

  const unreadCount = threads.filter(t => !t.isTrash && t.unreadCount > 0).length;

  const handleOpenAuth = (
    mode: 'signin' | 'signup' | 'forgot_password' = 'signin',
    portal: 'client' | 'agency' = 'client',
    plan: string = 'scale'
  ) => {
    setAuthInitialMode(mode);
    setAuthInitialPortal(portal);
    setAuthInitialPlan(plan);
    setIsAuthOpen(true);
  };

  const handleOpenSendMail = (lead?: Lead) => {
    setSelectedLeadForMail(lead);
    setIsSendMailOpen(true);
  };

  const isAgencySession =
    currentUser.role === 'agency' ||
    currentUser.role === 'owner' ||
    Boolean(currentUser.isOwner);

  const hasVerifiedClientPayment = Boolean(
    currentUser.paymentInfo?.trxId &&
      currentUser.paymentInfo?.trxId !== 'BKA9823KL12' &&
      currentUser.paymentInfo?.trxId !== 'BKEV6RCP8X' &&
      currentUser.paymentInfo?.status !== 'rejected'
  );

  // If user is not authenticated OR is a client without a verified bKash payment, render Landing Page
  if (!isAuthenticated || (!isAgencySession && !hasVerifiedClientPayment)) {
    return (
      <div className="min-h-screen bg-[#080c14] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        <LandingPage onOpenAuth={handleOpenAuth} />
        
        {/* Auth Modal for Sign in / Sign up / Forgot Password */}
        {isAuthOpen && (
          <Suspense fallback={null}>
            <AuthModal 
              isOpen={isAuthOpen} 
              onClose={() => setIsAuthOpen(false)}
              initialPortal={authInitialPortal}
              initialMode={authInitialMode}
              initialPlan={authInitialPlan}
            />
          </Suspense>
        )}

        {/* Global Notifications */}
        <FloatingNotificationCorner />

        {/* Global Modern SaaS Interactive Click & Cursor Animations */}
        <GlobalSaaSAnimations />
      </div>
    );
  }

  // Helper to render locked service view if customer's permission is turned off by Owner
  const renderRestrictedServiceView = (serviceName: string, serviceIcon: React.ReactNode) => (
    <div className="p-6 md:p-12 max-w-2xl mx-auto text-center space-y-6 animate-in fade-in">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/50">
        {serviceIcon}
      </div>
      <div className="space-y-2">
        <span className="px-3 py-1 text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30 rounded-full">
          🔒 Service Disabled by Workspace Owner
        </span>
        <h2 className="text-2xl font-black text-slate-100 mt-3">{serviceName} Access Restricted</h2>
        <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
          The Workspace Owner has disabled <strong>{serviceName}</strong> for your account (<code className="text-cyan-300">{currentUser.email}</code>). 
          Please contact your administrator or upgrade your subscription plan to restore access.
        </p>
      </div>

      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-xs text-slate-300 max-w-md mx-auto space-y-2 text-left">
        <div className="font-bold text-slate-200 flex items-center gap-2">
          <span>Current Account Plan:</span>
          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-extrabold uppercase">
            {currentUser.plan} Tier
          </span>
        </div>
        <div className="text-slate-400 text-[11px]">
          Status: <span className="text-rose-400 font-bold">{currentUser.permissions?.accountStatus === 'suspended' ? 'Account Suspended' : 'Feature Restricted'}</span>
        </div>
      </div>

      <button
        onClick={() => setActiveTab('dashboard')}
        className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
      >
        &larr; Return to Dashboard
      </button>
    </div>
  );

  const renderActiveView = () => {
    const isAgency = currentUser.role === 'agency' || currentUser.role === 'owner' || Boolean(currentUser.isOwner) || currentUser.email === 'sojibdaridro123@gmail.com' || currentUser.email === 'rafiqulvisualsky@gmail.com';
    const isClientRole = !isAgency && (currentUser.role === 'client' || currentUser.role === 'customer');
    
    // Check if account is suspended
    if (isClientRole && currentUser.permissions?.accountStatus === 'suspended') {
      return renderRestrictedServiceView('Entire Account', <ShieldCheck className="w-10 h-10" />);
    }

    // Check specific module permissions for clients
    if (isClientRole) {
      if (activeTab === 'generator' && currentUser.permissions?.leadMinerEnabled === false) {
        return renderRestrictedServiceView('AI Lead Miner', <Sparkles className="w-10 h-10" />);
      }
      if (activeTab === 'inbox' && currentUser.permissions?.smartInboxEnabled === false) {
        return renderRestrictedServiceView('Smart Unified Inbox', <Inbox className="w-10 h-10" />);
      }
      if (activeTab === 'campaigns' && currentUser.permissions?.campaignAutomationEnabled === false) {
        return renderRestrictedServiceView('Campaign Wizard & Sequences', <Send className="w-10 h-10" />);
      }
      if (activeTab === 'smtp' && currentUser.permissions?.smtpRotationEnabled === false) {
        return renderRestrictedServiceView('SMTP / IMAP Hub', <Server className="w-10 h-10" />);
      }
      if (activeTab === 'ai_copilot' && currentUser.permissions?.aiCopilotEnabled === false) {
        return renderRestrictedServiceView('AI Outreach Copilot', <Bot className="w-10 h-10" />);
      }
      if (activeTab === 'templates' && currentUser.permissions?.templatesEnabled === false) {
        return renderRestrictedServiceView('Templates & Anti-Spam Audit', <FileText className="w-10 h-10" />);
      }
      if (activeTab === 'analytics' && currentUser.permissions?.analyticsEnabled === false) {
        return renderRestrictedServiceView('Deliverability Radar', <BarChart3 className="w-10 h-10" />);
      }
      if (activeTab === 'owner') {
        return renderRestrictedServiceView('Agency Master Dashboard (Requires Agency Role)', <ShieldCheck className="w-10 h-10" />);
      }
    }

    switch (activeTab) {
      case 'dashboard':
        return <MainDashboard onOpenSendMail={() => handleOpenSendMail()} onOpenLeadModal={() => setActiveTab('leads')} />;
      case 'leads':
        return <LeadDirectory onOpenSendMail={(lead) => handleOpenSendMail(lead)} />;
      case 'generator':
        return <AILeadGenerator />;
      case 'inbox':
        return <SmartInbox />;
      case 'sent':
      case 'outbox':
        return <SentMailsTracker onOpenSendMail={(lead) => handleOpenSendMail(lead)} />;
      case 'campaigns':
        return null;
      case 'templates':
        return <TemplateManager />;
      case 'analytics':
        return <AnalyticsView />;
      case 'smtp':
        return <SMTPManager />;
      case 'ai_copilot':
        return <GeminiAssistant />;
      case 'owner':
        return <OwnerPanel />;
      case 'drive_storage':
        return <GoogleDriveStorageView onOpenSendMail={() => handleOpenSendMail()} />;
      case 'trash':
        return <TrashManager />;
      default:
        return <MainDashboard onOpenSendMail={() => handleOpenSendMail()} onOpenLeadModal={() => setActiveTab('leads')} />;
    }
  };

  const isCampaignsRestricted =
    currentUser.role !== 'owner' && currentUser.permissions?.campaignsEnabled === false;

  return (
    <div className="h-screen w-full bg-[#080c14] text-slate-100 flex flex-col overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar 
        onOpenAuth={() => setIsAuthOpen(true)} 
        onOpenSendMail={() => handleOpenSendMail()} 
        onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
      />

      {/* Always-Visible Global Google Drive Folder Link & Email Attachment Bar */}
      <div className="bg-gradient-to-r from-emerald-950/90 via-[#090d16] to-cyan-950/90 border-b border-emerald-500/40 px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 z-30">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[260px]">
          <button
            type="button"
            onClick={() => setActiveTab('drive_storage')}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-black text-[11px] flex items-center gap-1.5 shrink-0 cursor-pointer transition"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>☁️ Google Drive Folder Link (0 KB Hosting):</span>
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateDriveStorageSettings({ folderUrl: globalDriveUrl.trim() });
              setGlobalDriveSaved(true);
              setTimeout(() => setGlobalDriveSaved(false), 2500);
            }}
            className="flex items-center gap-1.5 flex-1 min-w-[220px] max-w-xl"
          >
            <div className="relative flex-1">
              <Link2 className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={globalDriveUrl}
                onChange={(e) => setGlobalDriveUrl(e.target.value)}
                placeholder="Paste Google Drive Folder Link (https://drive.google.com/drive/folders/...)"
                className="w-full bg-slate-950/95 border border-emerald-500/40 focus:border-emerald-400 rounded-lg pl-8 pr-2.5 py-1 text-[11px] text-slate-100 placeholder-slate-400 font-mono focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] shrink-0 cursor-pointer transition whitespace-nowrap shadow"
            >
              {globalDriveSaved
                ? '✓ Saved!'
                : driveStorageSettings?.folderUrl
                ? '💾 Change / Save Link'
                : '💾 Save Drive Link'}
            </button>
            {driveStorageSettings?.folderUrl && (
              <a
                href={driveStorageSettings.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center gap-1 shrink-0 transition whitespace-nowrap"
                title="Open Connected Google Drive Folder"
              >
                <span>Open Drive</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
          </form>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenSendMail()}
            className="px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-200 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
          >
            <Paperclip className="w-3 h-3 text-emerald-400" />
            <span>📎 Attach File &amp; Send Mail</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('drive_storage')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
          >
            <FolderOpen className="w-3 h-3 text-cyan-400" />
            <span>⚙️ Drive Hub</span>
          </button>
        </div>
      </div>

      {/* Body Layout: Sidebar + Main Content View */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar onOpenBilling={() => setIsBillingOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-20 md:pb-6 relative">
          <div className="saas-view-enter min-h-full">
            <Suspense fallback={<ViewLoader />}>
              {renderActiveView()}
              {(hasVisitedCampaigns || activeTab === 'campaigns') && (
                <CampaignManager isHidden={activeTab !== 'campaigns' || isCampaignsRestricted} />
              )}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Floating Live Notification HUD in Screen Corner */}
      <FloatingNotificationCorner />

      {/* Global Modern SaaS Interactive Click & Cursor Animations */}
      <GlobalSaaSAnimations />

      {/* Mobile Responsive Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/98 backdrop-blur-xl border-t border-slate-800/90 flex items-center justify-around px-1.5 py-1.5 shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'dashboard' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'leads' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Leads</span>
        </button>

        <button
          onClick={() => setActiveTab('generator')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'generator' ? 'text-purple-400 bg-purple-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Miner</span>
        </button>

        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition relative cursor-pointer ${
            activeTab === 'inbox' ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Inbox</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('drive_storage')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'drive_storage' ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-400/80 hover:text-emerald-300'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Drive Link</span>
        </button>

        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'campaigns' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Campaigns</span>
        </button>

        {/* Full Menu / Drawer Toggle */}
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            isMobileDrawerOpen ? 'text-cyan-300 bg-cyan-500/20' : 'text-slate-300 hover:text-white bg-slate-900/80 border border-slate-800'
          }`}
          title="Open all sidebar options and settings"
        >
          <Grid className="w-4 h-4 text-cyan-400" />
          <span>All Modules</span>
        </button>
      </nav>

      {/* Mobile Slide-over Full Drawer containing ALL sidebar items */}
      {isMobileDrawerOpen && (
        <Suspense fallback={null}>
          <MobileNavDrawer 
            isOpen={isMobileDrawerOpen} 
            onClose={() => setIsMobileDrawerOpen(false)}
            onOpenSendMail={() => handleOpenSendMail()}
            onOpenAuth={(mode, portal) => handleOpenAuth(mode || 'signin', portal || 'client')}
            onRequestLogout={() => setIsLogoutConfirmOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
          />
        </Suspense>
      )}

      {/* Logout Confirmation Permission Modal */}
      {isLogoutConfirmOpen && (
        <Suspense fallback={null}>
          <LogoutConfirmModal
            isOpen={isLogoutConfirmOpen}
            onClose={() => setIsLogoutConfirmOpen(false)}
            onConfirm={() => {
              logout();
              setIsLogoutConfirmOpen(false);
              handleOpenAuth('signin', 'client');
            }}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {/* Profile Modal */}
      {isProfileOpen && (
        <Suspense fallback={null}>
          <ProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            onOpenAuth={(mode, portal) => handleOpenAuth(mode || 'signin', portal || 'client')}
          />
        </Suspense>
      )}

      {/* Auth Modal */}
      {isAuthOpen && (
        <Suspense fallback={null}>
          <AuthModal 
            isOpen={isAuthOpen} 
            onClose={() => setIsAuthOpen(false)}
            initialPortal={authInitialPortal}
            initialMode={authInitialMode}
            initialPlan={authInitialPlan}
          />
        </Suspense>
      )}

      {/* Send Mail Cold Outreach Modal */}
      {isSendMailOpen && (
        <Suspense fallback={null}>
          <SendMailModal 
            isOpen={isSendMailOpen} 
            onClose={() => {
              setIsSendMailOpen(false);
              setSelectedLeadForMail(undefined);
            }} 
            initialLead={selectedLeadForMail}
          />
        </Suspense>
      )}

      {/* bKash Personal Subscription Checkout Modal */}
      {isBillingOpen && (
        <Suspense fallback={null}>
          <BkashSubscriptionModal
            isOpen={isBillingOpen}
            onClose={() => setIsBillingOpen(false)}
            initialPlanId={authInitialPlan}
          />
        </Suspense>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
